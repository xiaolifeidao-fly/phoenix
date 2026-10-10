package recon

import (
	"fmt"
	"strings"
	"time"

	reconDTO "suffer/service/recon/dto"
	reconRepository "suffer/service/recon/repository"

	"gorm.io/gorm"
)

// GetOpeningBalance 全局初始余额, 没录过返回 nil.
func (s *ReconService) GetOpeningBalance() (*reconDTO.OpeningBalanceDTO, error) {
	record, err := s.balances.Find()
	if err != nil || record == nil {
		return nil, err
	}
	result := toOpeningBalanceDTO(record)
	return &result, nil
}

// SaveOpeningBalance 录入 / 修改全局初始余额: 只有一条, 已有(含已清除的)就改它.
func (s *ReconService) SaveOpeningBalance(req reconDTO.SaveOpeningBalanceDTO, operator string) (*reconDTO.OpeningBalanceDTO, error) {
	date, err := time.ParseInLocation(dateLayout, strings.TrimSpace(req.BalanceDate), time.Local)
	if err != nil {
		return nil, fmt.Errorf("请选择初始余额日期（yyyy-MM-dd）")
	}
	currency, err := normalizeCurrency(req.Currency, reconRepository.CurrencyUSDT)
	if err != nil {
		return nil, err
	}
	if !validNumber(req.Balance) {
		return nil, fmt.Errorf("请填写初始余额")
	}
	remark := strings.TrimSpace(req.Remark)
	if len([]rune(remark)) > remarkMaxLength {
		return nil, fmt.Errorf("备注不能超过%d个字符", remarkMaxLength)
	}
	var rate *string
	if currency == reconRepository.CurrencyUSDT {
		if !validNumber(req.ExchangeRate) || *req.ExchangeRate <= 0 {
			return nil, fmt.Errorf("按 U 记的初始余额，请填写大于 0 的汇率（1U = ? RMB）")
		}
		value := formatAmount(*req.ExchangeRate)
		rate = &value
	}
	balanceRmb := toRmb(*req.Balance, currency, req.ExchangeRate)

	var saved *reconRepository.OpeningBalance
	err = s.balances.Db.Transaction(func(tx *gorm.DB) error {
		existing, err := s.balances.Lock(tx)
		if err != nil {
			return err
		}
		now := time.Now()
		saved = existing
		if saved == nil {
			saved = &reconRepository.OpeningBalance{Scope: reconRepository.OpeningBalanceScopeGlobal}
			saved.CreatedBy, saved.CreatedTime = operator, now
		}
		saved.Active = 1
		saved.BalanceDate, saved.Currency, saved.ExchangeRate, saved.Remark = date, currency, rate, remark
		saved.Balance, saved.BalanceRmb = formatAmount(*req.Balance), formatAmount(balanceRmb)
		saved.UpdatedBy, saved.UpdatedTime = operator, now
		if saved.Id == 0 {
			return tx.Create(saved).Error
		}
		return tx.Model(&reconRepository.OpeningBalance{}).Where("id = ?", saved.Id).Updates(map[string]interface{}{
			"active": 1, "balance_date": date, "currency": currency, "balance": saved.Balance, "exchange_rate": rate,
			"balance_rmb": saved.BalanceRmb, "remark": remark, "updated_by": operator, "updated_time": now,
		}).Error
	})
	if err != nil {
		return nil, err
	}
	result := toOpeningBalanceDTO(saved)
	return &result, nil
}

// ClearOpeningBalance 清除初始余额(逻辑删除), 人工记账对比回到「未设初始余额」.
func (s *ReconService) ClearOpeningBalance(operator string) error {
	return s.balances.Db.Model(&reconRepository.OpeningBalance{}).
		Where("scope = ? AND active = 1", reconRepository.OpeningBalanceScopeGlobal).
		Updates(map[string]interface{}{"active": 0, "updated_by": operator, "updated_time": time.Now()}).Error
}

func toOpeningBalanceDTO(record *reconRepository.OpeningBalance) reconDTO.OpeningBalanceDTO {
	result := reconDTO.OpeningBalanceDTO{
		ID: record.Id, BalanceDate: dateKey(record.BalanceDate), Currency: record.Currency,
		Balance: parseAmount(record.Balance), BalanceRmb: parseAmount(record.BalanceRmb),
		Remark: record.Remark, UpdatedBy: record.UpdatedBy,
	}
	if record.ExchangeRate != nil {
		rate := parseAmount(*record.ExchangeRate)
		result.ExchangeRate = &rate
	}
	if !record.UpdatedTime.IsZero() {
		result.UpdatedTime = record.UpdatedTime.Format("2006-01-02 15:04:05")
	}
	return result
}
