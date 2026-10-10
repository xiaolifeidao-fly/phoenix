package recon

import (
	"common/middleware/db"
	"context"
	"fmt"
	"math"
	"strconv"
	"strings"
	"time"

	"suffer/service/barry"
	barryDTO "suffer/service/barry/dto"
	reconDTO "suffer/service/recon/dto"
	reconRepository "suffer/service/recon/repository"

	"gorm.io/gorm"
)

const (
	maxRangeDays       = 93
	remarkMaxLength    = 255
	amountDecimalScale = 8
)

// ReconService 对账工作台 - 账户状态: 人工录入欠款(和社区一对一)维护 + 系统计算欠款; 人工记账及其与出入账的利润对比.
// 上游用户、账户、充值流水、人工记账在 surfer 库; 出入账在 barry, 通过接口取.
type ReconService struct {
	repository     *reconRepository.OpeningDebtRepository
	books          *reconRepository.ManualBookRepository
	snapshots      *reconRepository.BalanceSnapshotRepository
	balances       *reconRepository.OpeningBalanceRepository
	reconciliation *barry.ReconciliationService
}

func NewReconService() *ReconService {
	return &ReconService{
		repository:     db.GetRepository[reconRepository.OpeningDebtRepository](),
		books:          db.GetRepository[reconRepository.ManualBookRepository](),
		snapshots:      db.GetRepository[reconRepository.BalanceSnapshotRepository](),
		balances:       db.GetRepository[reconRepository.OpeningBalanceRepository](),
		reconciliation: barry.NewBarryService().Reconciliation,
	}
}

func (s *ReconService) EnsureTable() error {
	if err := s.repository.EnsureTable(); err != nil {
		return err
	}
	if err := s.books.EnsureTable(); err != nil {
		return err
	}
	if err := s.balances.EnsureTable(); err != nil {
		return err
	}
	return s.snapshots.EnsureTable()
}

// GetOpeningDebt 某个社区的人工录入欠款; 没录过返回 nil.
func (s *ReconService) GetOpeningDebt(userID uint64) (*reconDTO.OpeningDebtDTO, error) {
	if userID == 0 {
		return nil, fmt.Errorf("请选择上游用户")
	}
	records, err := s.repository.ListByUsers(nil, []uint64{userID})
	if err != nil || len(records) == 0 {
		return nil, err
	}
	result := toOpeningDebtDTO(records[len(records)-1])
	return &result, nil
}

// SaveOpeningDebt 录入人工录入欠款: 和社区一对一, 已有一条时直接改它, 没有时新建.
func (s *ReconService) SaveOpeningDebt(req reconDTO.SaveOpeningDebtDTO, operator string) (*reconDTO.OpeningDebtDTO, error) {
	values, err := validateSave(req)
	if err != nil {
		return nil, err
	}
	if req.UserID == 0 {
		return nil, fmt.Errorf("请选择上游用户")
	}
	var saved *reconRepository.OpeningDebt
	err = s.repository.Db.Transaction(func(tx *gorm.DB) error {
		exists, err := s.repository.LockUser(tx, req.UserID)
		if err != nil {
			return err
		}
		if !exists {
			return fmt.Errorf("上游用户不存在")
		}
		records, err := s.repository.ListByUsers(tx, []uint64{req.UserID})
		if err != nil {
			return err
		}
		if len(records) > 0 {
			saved, err = updateOpeningDebt(tx, records[len(records)-1], values, operator)
			return err
		}
		accountID, err := s.repository.LatestAccountID(tx, req.UserID)
		if err != nil {
			return err
		}
		now := time.Now()
		saved = &reconRepository.OpeningDebt{
			UserID: req.UserID, AccountID: accountID, Amount: values.amount, DebtDate: &values.debtDate, Remark: values.remark,
		}
		saved.Active = 1
		saved.CreatedBy, saved.UpdatedBy = operator, operator
		saved.CreatedTime, saved.UpdatedTime = now, now
		return tx.Create(saved).Error
	})
	if err != nil {
		return nil, err
	}
	result := toOpeningDebtDTO(saved)
	return &result, nil
}

// UpdateOpeningDebt 按 id 改金额和备注.
func (s *ReconService) UpdateOpeningDebt(id uint, req reconDTO.SaveOpeningDebtDTO, operator string) (*reconDTO.OpeningDebtDTO, error) {
	values, err := validateSave(req)
	if err != nil {
		return nil, err
	}
	var saved *reconRepository.OpeningDebt
	err = s.repository.Db.Transaction(func(tx *gorm.DB) error {
		target, err := s.loadForChange(tx, id)
		if err != nil {
			return err
		}
		saved, err = updateOpeningDebt(tx, target, values, operator)
		return err
	})
	if err != nil {
		return nil, err
	}
	result := toOpeningDebtDTO(saved)
	return &result, nil
}

// RevokeOpeningDebt 清除人工录入欠款(逻辑删除), 这个社区回到未建账.
func (s *ReconService) RevokeOpeningDebt(id uint, operator string) error {
	return s.repository.Db.Transaction(func(tx *gorm.DB) error {
		target, err := s.loadForChange(tx, id)
		if err != nil {
			return err
		}
		return tx.Model(&reconRepository.OpeningDebt{}).Where("id = ?", target.Id).Updates(map[string]interface{}{
			"active": 0, "updated_by": operator, "updated_time": time.Now(),
		}).Error
	})
}

func updateOpeningDebt(tx *gorm.DB, target *reconRepository.OpeningDebt, values openingDebtValues, operator string) (*reconRepository.OpeningDebt, error) {
	now := time.Now()
	if err := tx.Model(&reconRepository.OpeningDebt{}).Where("id = ?", target.Id).Updates(map[string]interface{}{
		"amount": values.amount, "debt_date": values.debtDate, "remark": values.remark, "updated_by": operator, "updated_time": now,
	}).Error; err != nil {
		return nil, err
	}
	target.Amount, target.DebtDate, target.Remark = values.amount, &values.debtDate, values.remark
	target.UpdatedBy, target.UpdatedTime = operator, now
	return target, nil
}

// loadForChange 锁住记录所属用户后重新读这条记录.
func (s *ReconService) loadForChange(tx *gorm.DB, id uint) (*reconRepository.OpeningDebt, error) {
	var found []*reconRepository.OpeningDebt
	if err := tx.Where("id = ? AND active = 1", id).Limit(1).Find(&found).Error; err != nil {
		return nil, err
	}
	if len(found) == 0 {
		return nil, fmt.Errorf("记录不存在")
	}
	if _, err := s.repository.LockUser(tx, found[0].UserID); err != nil {
		return nil, err
	}
	found = found[:0]
	if err := tx.Where("id = ? AND active = 1", id).Limit(1).Find(&found).Error; err != nil {
		return nil, err
	}
	if len(found) == 0 {
		return nil, fmt.Errorf("记录不存在")
	}
	return found[0], nil
}

// AccountStatus 活跃上游用户的账户状态. 日期 yyyy-MM-dd, 两端都包含, 区间最长 93 天.
// 截至 D 日的系统欠款 = 人工录入欠款 + 欠款日期次日到 D 日的(充值 − 社区入账 − 代收手续费);
// 期初 = 截至开始日前一天, 期末 = 截至结束日; D 早于欠款日期时算不出(为 null).
func (s *ReconService) AccountStatus(ctx context.Context, startDate, endDate string) ([]reconDTO.AccountStatusRowDTO, error) {
	start, end, err := parseRange(startDate, endDate)
	if err != nil {
		return nil, err
	}
	users, err := s.repository.ListTradingUserBalances()
	if err != nil {
		return nil, err
	}
	userIDs := make([]uint64, 0, len(users))
	for _, user := range users {
		userIDs = append(userIDs, user.UserID)
	}
	records, err := s.repository.ListByUsers(nil, userIDs)
	if err != nil {
		return nil, err
	}
	openings := openingDebtByUser(records)

	rows := make([]reconDTO.AccountStatusRowDTO, 0, len(users))
	windows := make([]barryDTO.ReconUpstreamSumDTO, 0, len(users)*3)
	recharges := make(map[string]float64, len(users)*3)
	addWindow := func(key string, userID uint64, from, to time.Time) error {
		windows = append(windows, barryDTO.ReconUpstreamSumDTO{
			Key: key, UpstreamUserID: strconv.FormatUint(userID, 10), StartDate: dateKey(from), EndDate: dateKey(to),
		})
		amount, err := s.repository.SumRecharge(userID, from, to.AddDate(0, 0, 1))
		recharges[key] = amount
		return err
	}
	for _, user := range users {
		row := reconDTO.AccountStatusRowDTO{
			UserID: user.UserID, Name: user.Name, Username: user.Username, Remark: user.Remark,
			AccountID: user.AccountID, AccountStatus: user.AccountStatus, BalanceAmount: user.BalanceAmount,
		}
		if err := addWindow(windowKey(user.UserID, "period"), user.UserID, start, end); err != nil {
			return nil, err
		}
		if opening := openings[user.UserID]; opening != nil {
			dto := toOpeningDebtDTO(opening)
			row.CurrentDebt = &dto
			from := accumulateFrom(opening, start)
			// 期初窗口 [欠款日期次日, 开始日前一天], 欠款日期就是开始日前一天时为空(期初 = 录入金额)
			if from.Before(start) {
				if err := addWindow(windowKey(user.UserID, "opening"), user.UserID, from, start.AddDate(0, 0, -1)); err != nil {
					return nil, err
				}
			}
			// 期末窗口 [欠款日期次日, 结束日], 欠款日期就是结束日时为空(期末 = 录入金额)
			if !from.After(end) {
				if err := addWindow(windowKey(user.UserID, "closing"), user.UserID, from, end); err != nil {
					return nil, err
				}
			}
		}
		rows = append(rows, row)
	}

	sums, err := s.reconciliation.UpstreamSums(ctx, windows)
	if err != nil {
		return nil, fmt.Errorf("查询社区入账失败：%w", err)
	}
	ledgerByKey := make(map[string]barryDTO.ReconUpstreamSumDTO, len(sums))
	for _, sum := range sums {
		ledgerByKey[sum.Key] = sum
	}

	for i := range rows {
		row := &rows[i]
		period := ledgerByKey[windowKey(row.UserID, "period")]
		row.PeriodRecharge = recharges[windowKey(row.UserID, "period")]
		row.PeriodIncome = period.IncomeRmb
		row.PeriodCollectFee = period.CollectFeeRmb
		if row.CurrentDebt == nil {
			continue
		}
		from := accumulateFrom(openings[row.UserID], start)
		if !from.After(start) {
			key := windowKey(row.UserID, "opening")
			value := row.CurrentDebt.Amount + recharges[key] - ledgerByKey[key].IncomeRmb - ledgerByKey[key].CollectFeeRmb
			row.OpeningDebt = &value
		}
		if !from.After(end.AddDate(0, 0, 1)) {
			key := windowKey(row.UserID, "closing")
			row.ClosingRecharge = recharges[key]
			row.ClosingIncome = ledgerByKey[key].IncomeRmb
			row.ClosingCollectFee = ledgerByKey[key].CollectFeeRmb
			value := row.CurrentDebt.Amount + row.ClosingRecharge - row.ClosingIncome - row.ClosingCollectFee
			row.ClosingDebt = &value
		}
	}
	return rows, nil
}

func windowKey(userID uint64, kind string) string {
	return strconv.FormatUint(userID, 10) + ":" + kind
}

// accumulateFrom 从哪天开始累计流水: 欠款日期的次日; 没录初始欠款或旧数据没填欠款日期时用 fallback(所选开始日).
func accumulateFrom(opening *reconRepository.OpeningDebt, fallback time.Time) time.Time {
	if opening == nil || opening.DebtDate == nil || opening.DebtDate.IsZero() {
		return fallback
	}
	return truncateDay(*opening.DebtDate).AddDate(0, 0, 1)
}

// openingDebtValues 校验后的人工录入欠款.
type openingDebtValues struct {
	amount   string
	debtDate time.Time
	remark   string
}

func validateSave(req reconDTO.SaveOpeningDebtDTO) (openingDebtValues, error) {
	if req.Amount == nil || math.IsNaN(*req.Amount) || math.IsInf(*req.Amount, 0) {
		return openingDebtValues{}, fmt.Errorf("请填写欠款金额")
	}
	debtDate, err := time.ParseInLocation(dateLayout, strings.TrimSpace(req.DebtDate), time.Local)
	if err != nil {
		return openingDebtValues{}, fmt.Errorf("请选择欠款日期（yyyy-MM-dd）")
	}
	remark := strings.TrimSpace(req.Remark)
	if len([]rune(remark)) > remarkMaxLength {
		return openingDebtValues{}, fmt.Errorf("备注不能超过%d个字符", remarkMaxLength)
	}
	return openingDebtValues{
		amount: strconv.FormatFloat(*req.Amount, 'f', amountDecimalScale, 64), debtDate: debtDate, remark: remark,
	}, nil
}

func parseRange(startDate, endDate string) (time.Time, time.Time, error) {
	start, err := time.ParseInLocation(dateLayout, strings.TrimSpace(startDate), time.Local)
	if err != nil {
		return time.Time{}, time.Time{}, fmt.Errorf("开始日期格式应为 yyyy-MM-dd")
	}
	end, err := time.ParseInLocation(dateLayout, strings.TrimSpace(endDate), time.Local)
	if err != nil {
		return time.Time{}, time.Time{}, fmt.Errorf("结束日期格式应为 yyyy-MM-dd")
	}
	if end.Before(start) {
		return time.Time{}, time.Time{}, fmt.Errorf("结束日期不能早于开始日期")
	}
	if int(end.Sub(start).Hours()/24)+1 > maxRangeDays {
		return time.Time{}, time.Time{}, fmt.Errorf("日期区间最长%d天", maxRangeDays)
	}
	return start, end, nil
}

func parseAmount(value string) float64 {
	amount, _ := strconv.ParseFloat(strings.TrimSpace(value), 64)
	return amount
}

func toOpeningDebtDTO(record *reconRepository.OpeningDebt) reconDTO.OpeningDebtDTO {
	result := reconDTO.OpeningDebtDTO{
		ID: record.Id, UserID: record.UserID, AccountID: record.AccountID,
		Amount: parseAmount(record.Amount), Remark: record.Remark,
		CreatedBy: record.CreatedBy, UpdatedBy: record.UpdatedBy,
	}
	if record.DebtDate != nil && !record.DebtDate.IsZero() {
		result.DebtDate = dateKey(*record.DebtDate)
	}
	if !record.CreatedTime.IsZero() {
		result.CreatedTime = record.CreatedTime.Format("2006-01-02 15:04:05")
	}
	if !record.UpdatedTime.IsZero() {
		result.UpdatedTime = record.UpdatedTime.Format("2006-01-02 15:04:05")
	}
	return result
}
