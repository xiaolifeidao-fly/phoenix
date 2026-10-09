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

// ReconService 对账工作台 - 账户状态: 人工录入欠款的时间线维护 + 系统计算欠款; 人工记账及其与出入账的利润对比.
// 上游用户、账户、充值流水、人工记账在 surfer 库; 出入账在 barry, 通过接口取.
type ReconService struct {
	repository     *reconRepository.OpeningDebtRepository
	books          *reconRepository.ManualBookRepository
	snapshots      *reconRepository.BalanceSnapshotRepository
	reconciliation *barry.ReconciliationService
}

func NewReconService() *ReconService {
	return &ReconService{
		repository:     db.GetRepository[reconRepository.OpeningDebtRepository](),
		books:          db.GetRepository[reconRepository.ManualBookRepository](),
		snapshots:      db.GetRepository[reconRepository.BalanceSnapshotRepository](),
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
	return s.snapshots.EnsureTable()
}

// ListOpeningDebts 某个用户的人工录入欠款时间线, 生效日期倒序(最新在前).
func (s *ReconService) ListOpeningDebts(userID uint64) ([]reconDTO.OpeningDebtDTO, error) {
	if userID == 0 {
		return nil, fmt.Errorf("请选择上游用户")
	}
	records, err := s.repository.ListByUsers(nil, []uint64{userID})
	if err != nil {
		return nil, err
	}
	result := make([]reconDTO.OpeningDebtDTO, 0, len(records))
	for i := len(records) - 1; i >= 0; i-- {
		result = append(result, toOpeningDebtDTO(records[i]))
	}
	return result, nil
}

// CreateOpeningDebt 录入新的一条; 当前未结清的那条在同一事务里结清, 结清日期 = 新记录的生效日期.
func (s *ReconService) CreateOpeningDebt(req reconDTO.SaveOpeningDebtDTO, operator string) (*reconDTO.OpeningDebtDTO, error) {
	amount, effective, remark, err := validateSave(req)
	if err != nil {
		return nil, err
	}
	if req.UserID == 0 {
		return nil, fmt.Errorf("请选择上游用户")
	}
	var created *reconRepository.OpeningDebt
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
		toSettle, err := checkCreate(records, effective)
		if err != nil {
			return err
		}
		now := time.Now()
		if toSettle != nil {
			if err := tx.Model(&reconRepository.OpeningDebt{}).Where("id = ?", toSettle.Id).Updates(map[string]interface{}{
				"settle_status": reconRepository.SettleStatusSettled, "settle_date": effective,
				"updated_by": operator, "updated_time": now,
			}).Error; err != nil {
				return err
			}
		}
		accountID, err := s.repository.LatestAccountID(tx, req.UserID)
		if err != nil {
			return err
		}
		created = &reconRepository.OpeningDebt{
			UserID: req.UserID, AccountID: accountID, Amount: amount, EffectiveDate: effective,
			SettleStatus: reconRepository.SettleStatusUnsettled, Remark: remark,
		}
		created.Active = 1
		created.CreatedBy, created.UpdatedBy = operator, operator
		created.CreatedTime, created.UpdatedTime = now, now
		return tx.Create(created).Error
	})
	if err != nil {
		return nil, err
	}
	result := toOpeningDebtDTO(created)
	return &result, nil
}

// UpdateOpeningDebt 只能改当前未结清的那条; 改了生效日期时, 上一条的结清日期跟着改.
func (s *ReconService) UpdateOpeningDebt(id uint, req reconDTO.SaveOpeningDebtDTO, operator string) (*reconDTO.OpeningDebtDTO, error) {
	amount, effective, remark, err := validateSave(req)
	if err != nil {
		return nil, err
	}
	var saved *reconRepository.OpeningDebt
	err = s.repository.Db.Transaction(func(tx *gorm.DB) error {
		target, records, err := s.loadForChange(tx, id)
		if err != nil {
			return err
		}
		previous, err := checkUpdate(records, target, effective)
		if err != nil {
			return err
		}
		now := time.Now()
		if err := tx.Model(&reconRepository.OpeningDebt{}).Where("id = ?", target.Id).Updates(map[string]interface{}{
			"amount": amount, "effective_date": effective, "remark": remark, "updated_by": operator, "updated_time": now,
		}).Error; err != nil {
			return err
		}
		if previous != nil {
			if err := tx.Model(&reconRepository.OpeningDebt{}).Where("id = ?", previous.Id).Updates(map[string]interface{}{
				"settle_date": effective, "updated_by": operator, "updated_time": now,
			}).Error; err != nil {
				return err
			}
		}
		target.Amount, target.EffectiveDate, target.Remark, target.UpdatedBy, target.UpdatedTime = amount, effective, remark, operator, now
		saved = target
		return nil
	})
	if err != nil {
		return nil, err
	}
	result := toOpeningDebtDTO(saved)
	return &result, nil
}

// RevokeOpeningDebt 撤销当前未结清的那条(逻辑删除), 上一条恢复成未结清.
func (s *ReconService) RevokeOpeningDebt(id uint, operator string) error {
	return s.repository.Db.Transaction(func(tx *gorm.DB) error {
		target, records, err := s.loadForChange(tx, id)
		if err != nil {
			return err
		}
		previous, err := checkRevoke(records, target)
		if err != nil {
			return err
		}
		now := time.Now()
		if err := tx.Model(&reconRepository.OpeningDebt{}).Where("id = ?", target.Id).Updates(map[string]interface{}{
			"active": 0, "updated_by": operator, "updated_time": now,
		}).Error; err != nil {
			return err
		}
		if previous == nil {
			return nil
		}
		return tx.Model(&reconRepository.OpeningDebt{}).Where("id = ?", previous.Id).Updates(map[string]interface{}{
			"settle_status": reconRepository.SettleStatusUnsettled, "settle_date": nil,
			"updated_by": operator, "updated_time": now,
		}).Error
	})
}

// loadForChange 锁住记录所属用户后, 重新读这条记录和该用户的时间线.
func (s *ReconService) loadForChange(tx *gorm.DB, id uint) (*reconRepository.OpeningDebt, []*reconRepository.OpeningDebt, error) {
	var found []*reconRepository.OpeningDebt
	if err := tx.Where("id = ? AND active = 1", id).Limit(1).Find(&found).Error; err != nil {
		return nil, nil, err
	}
	if len(found) == 0 {
		return nil, nil, fmt.Errorf("记录不存在")
	}
	if _, err := s.repository.LockUser(tx, found[0].UserID); err != nil {
		return nil, nil, err
	}
	records, err := s.repository.ListByUsers(tx, []uint64{found[0].UserID})
	if err != nil {
		return nil, nil, err
	}
	for _, record := range records {
		if record.Id == found[0].Id {
			return record, records, nil
		}
	}
	return nil, nil, fmt.Errorf("记录不存在")
}

// AccountStatus 活跃上游用户的账户状态. 日期 yyyy-MM-dd, 两端都包含, 区间最长 93 天.
// 期初 = 截至开始日前一天, 期末 = 截至结束日; 各自取自己的起点, 区间中间换过起点也能算对.
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
	allRecords, err := s.repository.ListByUsers(nil, userIDs)
	if err != nil {
		return nil, err
	}
	recordsByUser := make(map[uint64][]*reconRepository.OpeningDebt, len(users))
	for _, record := range allRecords {
		recordsByUser[record.UserID] = append(recordsByUser[record.UserID], record)
	}

	openingDay := start.AddDate(0, 0, -1)
	rows := make([]reconDTO.AccountStatusRowDTO, 0, len(users))
	windows := make([]barryDTO.ReconUpstreamSumDTO, 0, len(users)*3)
	recharges := make(map[string]float64, len(users)*3)
	addWindow := func(key string, userID uint64, from, to time.Time) error {
		windows = append(windows, barryDTO.ReconUpstreamSumDTO{
			Key: key, UpstreamUserID: strconv.FormatUint(userID, 10),
			StartDate: dateKey(from), EndDate: dateKey(to),
		})
		amount, err := s.repository.SumRecharge(userID, from, to.AddDate(0, 0, 1))
		recharges[key] = amount
		return err
	}
	for _, user := range users {
		records := recordsByUser[user.UserID]
		row := reconDTO.AccountStatusRowDTO{
			UserID: user.UserID, Name: user.Name, Username: user.Username, Remark: user.Remark,
			AccountID: user.AccountID, AccountStatus: user.AccountStatus, BalanceAmount: user.BalanceAmount,
		}
		if current := currentOf(records); current != nil {
			dto := toOpeningDebtDTO(current)
			row.CurrentDebt = &dto
		}
		if err := addWindow(windowKey(user.UserID, "period"), user.UserID, start, end); err != nil {
			return nil, err
		}
		if baseline := baselineAt(records, openingDay); baseline != nil {
			if from, to, ok := accumulateWindow(baseline, openingDay); ok {
				if err := addWindow(windowKey(user.UserID, "opening"), user.UserID, from, to); err != nil {
					return nil, err
				}
			}
		}
		if baseline := baselineAt(records, end); baseline != nil {
			dto := toOpeningDebtDTO(baseline)
			row.ClosingBaseline = &dto
			if from, to, ok := accumulateWindow(baseline, end); ok {
				if err := addWindow(windowKey(user.UserID, "closing"), user.UserID, from, to); err != nil {
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
		records := recordsByUser[row.UserID]
		period := ledgerByKey[windowKey(row.UserID, "period")]
		row.PeriodRecharge = recharges[windowKey(row.UserID, "period")]
		row.PeriodIncome = period.IncomeRmb
		row.PeriodCollectFee = period.CollectFeeRmb
		if baseline := baselineAt(records, openingDay); baseline != nil {
			key := windowKey(row.UserID, "opening")
			value := parseAmount(baseline.Amount) + recharges[key] - ledgerByKey[key].IncomeRmb - ledgerByKey[key].CollectFeeRmb
			row.OpeningDebt = &value
		}
		if baseline := baselineAt(records, end); baseline != nil {
			key := windowKey(row.UserID, "closing")
			row.ClosingRecharge = recharges[key]
			row.ClosingIncome = ledgerByKey[key].IncomeRmb
			row.ClosingCollectFee = ledgerByKey[key].CollectFeeRmb
			value := parseAmount(baseline.Amount) + row.ClosingRecharge - row.ClosingIncome - row.ClosingCollectFee
			row.ClosingDebt = &value
		}
	}
	return rows, nil
}

func windowKey(userID uint64, kind string) string {
	return strconv.FormatUint(userID, 10) + ":" + kind
}

func validateSave(req reconDTO.SaveOpeningDebtDTO) (string, time.Time, string, error) {
	if req.Amount == nil || math.IsNaN(*req.Amount) || math.IsInf(*req.Amount, 0) {
		return "", time.Time{}, "", fmt.Errorf("请填写欠款金额")
	}
	effective, err := time.ParseInLocation(dateLayout, strings.TrimSpace(req.EffectiveDate), time.Local)
	if err != nil {
		return "", time.Time{}, "", fmt.Errorf("生效日期格式应为 yyyy-MM-dd")
	}
	remark := strings.TrimSpace(req.Remark)
	if len([]rune(remark)) > remarkMaxLength {
		return "", time.Time{}, "", fmt.Errorf("备注不能超过%d个字符", remarkMaxLength)
	}
	return strconv.FormatFloat(*req.Amount, 'f', amountDecimalScale, 64), effective, remark, nil
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
		Amount: parseAmount(record.Amount), EffectiveDate: dateKey(record.EffectiveDate),
		SettleStatus: record.SettleStatus, Remark: record.Remark,
		CreatedBy: record.CreatedBy, UpdatedBy: record.UpdatedBy,
	}
	if record.SettleDate != nil && !record.SettleDate.IsZero() {
		result.SettleDate = dateKey(*record.SettleDate)
	}
	if !record.CreatedTime.IsZero() {
		result.CreatedTime = record.CreatedTime.Format("2006-01-02 15:04:05")
	}
	if !record.UpdatedTime.IsZero() {
		result.UpdatedTime = record.UpdatedTime.Format("2006-01-02 15:04:05")
	}
	return result
}
