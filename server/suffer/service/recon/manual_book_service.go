package recon

import (
	"context"
	"errors"
	"fmt"
	"math"
	"strconv"
	"strings"
	"time"

	reconDTO "suffer/service/recon/dto"
	reconRepository "suffer/service/recon/repository"

	"github.com/go-sql-driver/mysql"
	"gorm.io/gorm"
)

const manualBookMaxDebts = 200

type normalizedDebt struct {
	userID    uint64
	currency  string
	amount    float64
	amountRmb float64
}

type normalizedBook struct {
	date       time.Time
	currency   string
	balance    float64
	rate       *float64
	balanceRmb float64
	remark     string
	debts      []normalizedDebt
}

// ManualBookDetail 某天的记账 + 之前最近一份(新记账时预填剩余金额和社区欠款).
func (s *ReconService) ManualBookDetail(date string) (*reconDTO.ManualBookDetailDTO, error) {
	day, err := time.ParseInLocation(dateLayout, strings.TrimSpace(date), time.Local)
	if err != nil {
		return nil, fmt.Errorf("记账日期格式应为 yyyy-MM-dd")
	}
	book, err := s.books.FindByDate(day)
	if err != nil {
		return nil, err
	}
	previous, err := s.books.FindLatestBefore(day)
	if err != nil {
		return nil, err
	}
	loaded, err := s.toManualBookDTOs(nil, []*reconRepository.ManualBook{book, previous})
	if err != nil {
		return nil, err
	}
	return &reconDTO.ManualBookDetailDTO{Book: loaded[0], Previous: loaded[1]}, nil
}

// CreateManualBook 每天只有一份; 当天已经记过账时拒绝, 删除过的复用同一行.
func (s *ReconService) CreateManualBook(req reconDTO.SaveManualBookDTO, operator string) (*reconDTO.ManualBookDTO, error) {
	book, err := validateManualBook(req)
	if err != nil {
		return nil, err
	}
	var saved *reconRepository.ManualBook
	err = s.books.Db.Transaction(func(tx *gorm.DB) error {
		existing, err := s.books.LockByDate(tx, book.date)
		if err != nil {
			return err
		}
		if existing != nil && existing.Active == 1 {
			return fmt.Errorf("%s 已经记过账，请在列表里修改", dateKey(book.date))
		}
		saved = existing
		if saved == nil {
			saved = &reconRepository.ManualBook{}
			saved.CreatedBy = operator
			saved.CreatedTime = time.Now()
		}
		if err := s.writeManualBook(tx, saved, book, operator); err != nil {
			return err
		}
		after, err := s.snapshotIn(tx, saved)
		if err != nil {
			return err
		}
		return writeManualBookLog(tx, saved.Id, book.date, reconRepository.ManualBookActionCreate, nil, after, operator)
	})
	if err != nil {
		return nil, friendlyManualBookError(err)
	}
	return s.loadManualBook(saved)
}

// UpdateManualBook 改剩余金额、欠款和备注; 记账日期不能改.
func (s *ReconService) UpdateManualBook(id uint, req reconDTO.SaveManualBookDTO, operator string) (*reconDTO.ManualBookDTO, error) {
	book, err := validateManualBook(req)
	if err != nil {
		return nil, err
	}
	var saved *reconRepository.ManualBook
	err = s.books.Db.Transaction(func(tx *gorm.DB) error {
		existing, err := s.books.LockByID(tx, id)
		if err != nil {
			return err
		}
		if existing == nil {
			return fmt.Errorf("记账不存在")
		}
		if dateKey(existing.BookDate) != dateKey(book.date) {
			return fmt.Errorf("记账日期不能修改，请删除后在新的日期重新记账")
		}
		// 改之前先读出原内容, writeManualBook 会把旧欠款置无效
		before, err := s.snapshotIn(tx, existing)
		if err != nil {
			return err
		}
		saved = existing
		if err := s.writeManualBook(tx, saved, book, operator); err != nil {
			return err
		}
		after, err := s.snapshotIn(tx, saved)
		if err != nil {
			return err
		}
		// 什么都没改就不记
		if len(diffManualBook(before, after)) == 0 {
			return nil
		}
		return writeManualBookLog(tx, saved.Id, book.date, reconRepository.ManualBookActionUpdate, before, after, operator)
	})
	if err != nil {
		return nil, err
	}
	return s.loadManualBook(saved)
}

// DeleteManualBook 逻辑删除这一天的记账和它的欠款, 修改记录里留下删除前的快照.
func (s *ReconService) DeleteManualBook(id uint, operator string) error {
	return s.books.Db.Transaction(func(tx *gorm.DB) error {
		existing, err := s.books.LockByID(tx, id)
		if err != nil {
			return err
		}
		if existing == nil {
			return fmt.Errorf("记账不存在")
		}
		before, err := s.snapshotIn(tx, existing)
		if err != nil {
			return err
		}
		if err := writeManualBookLog(tx, existing.Id, existing.BookDate, reconRepository.ManualBookActionDelete, before, nil, operator); err != nil {
			return err
		}
		now := time.Now()
		if err := tx.Model(&reconRepository.ManualBook{}).Where("id = ?", existing.Id).Updates(map[string]interface{}{
			"active": 0, "updated_by": operator, "updated_time": now,
		}).Error; err != nil {
			return err
		}
		return deactivateDebts(tx, existing.Id, operator, now)
	})
}

// CompareManualBooks 所选区间人工记账利润 vs 出入账利润: 总的一行 + 每天一行. 区间最长 93 天.
func (s *ReconService) CompareManualBooks(ctx context.Context, startDate, endDate string) (*reconDTO.ManualBookCompareDTO, error) {
	start, end, err := parseRange(startDate, endDate)
	if err != nil {
		return nil, err
	}
	records, err := s.books.ListBetween(start.AddDate(0, 0, -manualBookLookbackDays), end)
	if err != nil {
		return nil, err
	}
	books, err := s.toManualBookDTOs(nil, records)
	if err != nil {
		return nil, err
	}
	list := make([]reconDTO.ManualBookDTO, 0, len(books))
	for _, book := range books {
		list = append(list, *book)
	}
	// 出入账从最早可能用到的那天开始取: 开始日之前最近一份的次日, 没有就从开始日
	ledgerStart := start
	for i := len(list) - 1; i >= 0; i-- {
		if list[i].BookDate < dateKey(start) {
			ledgerStart, _ = time.ParseInLocation(dateLayout, list[i].BookDate, time.Local)
			ledgerStart = ledgerStart.AddDate(0, 0, 1)
			break
		}
	}
	daily, err := s.reconciliation.LedgerDaily(ctx, dateKey(ledgerStart), dateKey(end))
	if err != nil {
		return nil, fmt.Errorf("查询出入账失败：%w", err)
	}
	result := buildManualBookCompare(list, toLedgerDays(daily), start, end)
	return &result, nil
}

// writeManualBook 写记账行(新增 / 恢复 / 修改), 欠款整组替换: 旧的置无效, 再写入这次的.
func (s *ReconService) writeManualBook(tx *gorm.DB, record *reconRepository.ManualBook, book *normalizedBook, operator string) error {
	users, err := s.books.FindUpstreamUsers(tx, debtUserIDs(book.debts))
	if err != nil {
		return err
	}
	names := make(map[uint64]string, len(users))
	for _, user := range users {
		names[user.ID] = firstNonEmpty(user.Name, user.Username)
	}
	for _, debt := range book.debts {
		if _, ok := names[debt.userID]; !ok {
			return fmt.Errorf("上游社区 #%d 不存在", debt.userID)
		}
	}

	now := time.Now()
	record.Active = 1
	record.BookDate = book.date
	record.Currency = book.currency
	record.Balance = formatAmount(book.balance)
	record.BalanceRmb = formatAmount(book.balanceRmb)
	record.ExchangeRate = nil
	if book.rate != nil {
		rate := formatAmount(*book.rate)
		record.ExchangeRate = &rate
	}
	record.Remark = book.remark
	record.UpdatedBy, record.UpdatedTime = operator, now
	if record.Id == 0 {
		if err := tx.Create(record).Error; err != nil {
			return err
		}
	} else {
		if err := tx.Model(&reconRepository.ManualBook{}).Where("id = ?", record.Id).Updates(map[string]interface{}{
			"active": 1, "currency": record.Currency, "balance": record.Balance, "exchange_rate": record.ExchangeRate,
			"balance_rmb": record.BalanceRmb, "remark": record.Remark, "updated_by": operator, "updated_time": now,
		}).Error; err != nil {
			return err
		}
		if err := deactivateDebts(tx, record.Id, operator, now); err != nil {
			return err
		}
	}
	if len(book.debts) == 0 {
		return nil
	}
	rows := make([]*reconRepository.ManualBookDebt, 0, len(book.debts))
	for _, debt := range book.debts {
		row := &reconRepository.ManualBookDebt{
			BookID: record.Id, UpstreamUserID: debt.userID, UpstreamUserName: names[debt.userID],
			Currency: debt.currency, Amount: formatAmount(debt.amount), AmountRmb: formatAmount(debt.amountRmb),
		}
		row.Active = 1
		row.CreatedBy, row.UpdatedBy = operator, operator
		row.CreatedTime, row.UpdatedTime = now, now
		rows = append(rows, row)
	}
	return tx.Create(&rows).Error
}

func deactivateDebts(tx *gorm.DB, bookID int, operator string, now time.Time) error {
	return tx.Model(&reconRepository.ManualBookDebt{}).Where("book_id = ? AND active = 1", bookID).Updates(map[string]interface{}{
		"active": 0, "updated_by": operator, "updated_time": now,
	}).Error
}

func (s *ReconService) loadManualBook(record *reconRepository.ManualBook) (*reconDTO.ManualBookDTO, error) {
	loaded, err := s.toManualBookDTOs(nil, []*reconRepository.ManualBook{record})
	if err != nil {
		return nil, err
	}
	return loaded[0], nil
}

// snapshotIn 事务里读这一份记账当前的内容(含欠款), 写修改记录用.
func (s *ReconService) snapshotIn(tx *gorm.DB, record *reconRepository.ManualBook) (*manualBookSnapshot, error) {
	loaded, err := s.toManualBookDTOs(tx, []*reconRepository.ManualBook{record})
	if err != nil {
		return nil, err
	}
	return snapshotOf(loaded[0]), nil
}

// toManualBookDTOs 带上各自的欠款; 入参里的 nil 原位返回 nil. database 为空用默认连接.
func (s *ReconService) toManualBookDTOs(database *gorm.DB, records []*reconRepository.ManualBook) ([]*reconDTO.ManualBookDTO, error) {
	ids := make([]int, 0, len(records))
	for _, record := range records {
		if record != nil {
			ids = append(ids, record.Id)
		}
	}
	debts, err := s.books.ListDebts(database, ids)
	if err != nil {
		return nil, err
	}
	debtsByBook := make(map[int][]*reconRepository.ManualBookDebt, len(ids))
	userIDs := make([]uint64, 0, len(debts))
	for _, debt := range debts {
		debtsByBook[debt.BookID] = append(debtsByBook[debt.BookID], debt)
		userIDs = append(userIDs, debt.UpstreamUserID)
	}
	users, err := s.books.FindUpstreamUsers(database, uniqueIDs(userIDs))
	if err != nil {
		return nil, err
	}
	usersByID := make(map[uint64]reconRepository.UpstreamUserRow, len(users))
	current := make(map[uint64]float64, len(users))
	for _, user := range users {
		usersByID[user.ID] = user
		current[user.ID] = user.Balance
	}
	dates := make([]time.Time, 0, len(records))
	for _, record := range records {
		if record != nil {
			dates = append(dates, record.BookDate)
		}
	}
	balances, err := s.loadBalanceLookup(dates, current)
	if err != nil {
		return nil, err
	}
	result := make([]*reconDTO.ManualBookDTO, len(records))
	for i, record := range records {
		if record != nil {
			dto := toManualBookDTO(record, debtsByBook[record.Id])
			for j := range dto.Debts {
				user := usersByID[dto.Debts[j].UpstreamUserID]
				dto.Debts[j].UpstreamUsername, dto.Debts[j].UpstreamRemark = user.Username, user.Remark
				balances.fill(dto.BookDate, &dto.Debts[j])
			}
			result[i] = &dto
		}
	}
	return result, nil
}

func toManualBookDTO(record *reconRepository.ManualBook, debts []*reconRepository.ManualBookDebt) reconDTO.ManualBookDTO {
	result := reconDTO.ManualBookDTO{
		ID: record.Id, BookDate: dateKey(record.BookDate), Currency: record.Currency,
		Balance: parseAmount(record.Balance), BalanceRmb: parseAmount(record.BalanceRmb),
		Debts: make([]reconDTO.ManualBookDebtDTO, 0, len(debts)), Remark: record.Remark,
		CreatedBy: record.CreatedBy, UpdatedBy: record.UpdatedBy,
	}
	if record.ExchangeRate != nil {
		rate := parseAmount(*record.ExchangeRate)
		result.ExchangeRate = &rate
	}
	if !record.UpdatedTime.IsZero() {
		result.UpdatedTime = record.UpdatedTime.Format("2006-01-02 15:04:05")
	}
	for _, debt := range debts {
		item := reconDTO.ManualBookDebtDTO{
			UpstreamUserID: debt.UpstreamUserID, UpstreamUserName: debt.UpstreamUserName,
			Currency: debt.Currency, Amount: parseAmount(debt.Amount), AmountRmb: parseAmount(debt.AmountRmb),
		}
		result.DebtTotalRmb += item.AmountRmb
		result.Debts = append(result.Debts, item)
	}
	return result
}

// validateManualBook 剩余金额默认按 U, 欠款默认按 RMB; 有 U 金额时汇率必填, 折算 RMB = U × 汇率.
func validateManualBook(req reconDTO.SaveManualBookDTO) (*normalizedBook, error) {
	date, err := time.ParseInLocation(dateLayout, strings.TrimSpace(req.BookDate), time.Local)
	if err != nil {
		return nil, fmt.Errorf("记账日期格式应为 yyyy-MM-dd")
	}
	currency, err := normalizeCurrency(req.Currency, reconRepository.CurrencyUSDT)
	if err != nil {
		return nil, err
	}
	if !validNumber(req.Balance) {
		return nil, fmt.Errorf("请填写剩余金额")
	}
	remark := strings.TrimSpace(req.Remark)
	if len([]rune(remark)) > remarkMaxLength {
		return nil, fmt.Errorf("备注不能超过%d个字符", remarkMaxLength)
	}
	if len(req.Debts) > manualBookMaxDebts {
		return nil, fmt.Errorf("社区欠款最多%d条", manualBookMaxDebts)
	}
	book := &normalizedBook{date: date, currency: currency, balance: *req.Balance, remark: remark}
	needRate := currency == reconRepository.CurrencyUSDT
	seen := make(map[uint64]bool, len(req.Debts))
	for _, item := range req.Debts {
		if item.UpstreamUserID == 0 {
			return nil, fmt.Errorf("请选择上游社区")
		}
		if seen[item.UpstreamUserID] {
			return nil, fmt.Errorf("同一个上游社区一天只能记一条欠款")
		}
		seen[item.UpstreamUserID] = true
		if !validNumber(item.Amount) {
			return nil, fmt.Errorf("请填写社区欠款金额")
		}
		debtCurrency, err := normalizeCurrency(item.Currency, reconRepository.CurrencyRMB)
		if err != nil {
			return nil, err
		}
		needRate = needRate || debtCurrency == reconRepository.CurrencyUSDT
		book.debts = append(book.debts, normalizedDebt{userID: item.UpstreamUserID, currency: debtCurrency, amount: *item.Amount})
	}
	if req.ExchangeRate != nil {
		if !validNumber(req.ExchangeRate) || *req.ExchangeRate <= 0 {
			return nil, fmt.Errorf("汇率必须大于 0")
		}
		if needRate {
			book.rate = req.ExchangeRate
		}
	}
	if needRate && book.rate == nil {
		return nil, fmt.Errorf("有按 U 记的金额，请填写汇率（1U = ? RMB）")
	}
	book.balanceRmb = toRmb(book.balance, book.currency, book.rate)
	for i := range book.debts {
		book.debts[i].amountRmb = toRmb(book.debts[i].amount, book.debts[i].currency, book.rate)
	}
	return book, nil
}

func normalizeCurrency(value, fallback string) (string, error) {
	switch strings.ToUpper(strings.TrimSpace(value)) {
	case "":
		return fallback, nil
	case reconRepository.CurrencyRMB:
		return reconRepository.CurrencyRMB, nil
	case reconRepository.CurrencyUSDT, "U":
		return reconRepository.CurrencyUSDT, nil
	default:
		return "", fmt.Errorf("币种只能是 U 或 RMB")
	}
}

func toRmb(amount float64, currency string, rate *float64) float64 {
	if currency == reconRepository.CurrencyUSDT && rate != nil {
		return amount * *rate
	}
	return amount
}

func validNumber(value *float64) bool {
	return value != nil && !math.IsNaN(*value) && !math.IsInf(*value, 0)
}

func formatAmount(value float64) string {
	return strconv.FormatFloat(value, 'f', amountDecimalScale, 64)
}

func uniqueIDs(ids []uint64) []uint64 {
	seen := make(map[uint64]bool, len(ids))
	result := make([]uint64, 0, len(ids))
	for _, id := range ids {
		if !seen[id] {
			seen[id] = true
			result = append(result, id)
		}
	}
	return result
}

func debtUserIDs(debts []normalizedDebt) []uint64 {
	ids := make([]uint64, 0, len(debts))
	for _, debt := range debts {
		ids = append(ids, debt.userID)
	}
	return ids
}

func firstNonEmpty(values ...string) string {
	for _, value := range values {
		if strings.TrimSpace(value) != "" {
			return value
		}
	}
	return ""
}

// friendlyManualBookError 两个人同时给同一天新增记账时, 后一个撞唯一键.
func friendlyManualBookError(err error) error {
	var mysqlErr *mysql.MySQLError
	if errors.As(err, &mysqlErr) && mysqlErr.Number == 1062 {
		return fmt.Errorf("这一天刚被其他人记过账，请刷新后在列表里修改")
	}
	return err
}
