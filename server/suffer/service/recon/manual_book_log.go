package recon

import (
	"encoding/json"
	"fmt"
	"strconv"
	"strings"
	"time"

	reconDTO "suffer/service/recon/dto"
	reconRepository "suffer/service/recon/repository"

	"gorm.io/gorm"
)

const manualBookLogLimit = 500

// manualBookSnapshot 修改记录里存的快照: 只放业务字段, 不含操作人、时间.
type manualBookSnapshot struct {
	Currency     string                       `json:"currency"`
	Balance      float64                      `json:"balance"`
	ExchangeRate *float64                     `json:"exchangeRate"`
	BalanceRmb   float64                      `json:"balanceRmb"`
	Remark       string                       `json:"remark,omitempty"`
	Debts        []reconDTO.ManualBookDebtDTO `json:"debts"`
}

func snapshotOf(book *reconDTO.ManualBookDTO) *manualBookSnapshot {
	if book == nil {
		return nil
	}
	debts := make([]reconDTO.ManualBookDebtDTO, 0, len(book.Debts))
	for _, debt := range book.Debts {
		debt.UpstreamUsername, debt.UpstreamRemark, debt.UpstreamBalance = "", "", nil
		debt.UpstreamBalanceLive, debt.UpstreamBalanceTime = false, ""
		debts = append(debts, debt)
	}
	return &manualBookSnapshot{
		Currency: book.Currency, Balance: book.Balance, ExchangeRate: book.ExchangeRate,
		BalanceRmb: book.BalanceRmb, Remark: book.Remark, Debts: debts,
	}
}

// writeManualBookLog 和记账改动在同一个事务里写, 改动失败日志一起回滚.
func writeManualBookLog(tx *gorm.DB, bookID int, bookDate time.Time, action string, before, after *manualBookSnapshot, operator string) error {
	encode := func(snapshot *manualBookSnapshot) (*string, error) {
		if snapshot == nil {
			return nil, nil
		}
		data, err := json.Marshal(snapshot)
		if err != nil {
			return nil, err
		}
		text := string(data)
		return &text, nil
	}
	beforeText, err := encode(before)
	if err != nil {
		return err
	}
	afterText, err := encode(after)
	if err != nil {
		return err
	}
	now := time.Now()
	row := &reconRepository.ManualBookLog{BookID: bookID, BookDate: bookDate, Action: action, Before: beforeText, After: afterText}
	row.Active = 1
	row.CreatedBy, row.UpdatedBy = operator, operator
	row.CreatedTime, row.UpdatedTime = now, now
	return tx.Create(row).Error
}

// ManualBookLogs [startDate, endDate] 内各天的修改记录, 按时间倒序; 只查一天时两个日期传同一天. 区间最长 93 天.
func (s *ReconService) ManualBookLogs(startDate, endDate string) ([]reconDTO.ManualBookLogDTO, error) {
	start, end, err := parseRange(startDate, endDate)
	if err != nil {
		return nil, err
	}
	rows, err := s.books.ListLogs(start, end, manualBookLogLimit)
	if err != nil {
		return nil, err
	}
	result := make([]reconDTO.ManualBookLogDTO, 0, len(rows))
	for _, row := range rows {
		result = append(result, toManualBookLogDTO(row))
	}
	return result, nil
}

func toManualBookLogDTO(row *reconRepository.ManualBookLog) reconDTO.ManualBookLogDTO {
	decode := func(text *string) *manualBookSnapshot {
		if text == nil || strings.TrimSpace(*text) == "" {
			return nil
		}
		snapshot := &manualBookSnapshot{}
		if json.Unmarshal([]byte(*text), snapshot) != nil {
			return nil
		}
		return snapshot
	}
	result := reconDTO.ManualBookLogDTO{
		ID: row.Id, BookID: row.BookID, BookDate: dateKey(row.BookDate), Action: row.Action,
		Operator: row.CreatedBy, Changes: diffManualBook(decode(row.Before), decode(row.After)),
	}
	if !row.CreatedTime.IsZero() {
		result.Time = row.CreatedTime.Format("2006-01-02 15:04:05")
	}
	return result
}

// diffManualBook 逐项比较两份快照; 新增时 before 为 nil(列出全部内容), 删除时 after 为 nil.
func diffManualBook(before, after *manualBookSnapshot) []reconDTO.ManualBookChangeDTO {
	changes := make([]reconDTO.ManualBookChangeDTO, 0)
	add := func(field, label, from, to string) {
		if from != to {
			changes = append(changes, reconDTO.ManualBookChangeDTO{Field: field, Label: label, Before: from, After: to})
		}
	}
	pick := func(snapshot *manualBookSnapshot, value func(*manualBookSnapshot) string) string {
		if snapshot == nil {
			return ""
		}
		return value(snapshot)
	}
	add("balance", "截至当天余额",
		pick(before, func(v *manualBookSnapshot) string { return amountText(v.Balance, v.Currency) }),
		pick(after, func(v *manualBookSnapshot) string { return amountText(v.Balance, v.Currency) }))
	add("exchangeRate", "汇率",
		pick(before, func(v *manualBookSnapshot) string { return rateText(v.ExchangeRate) }),
		pick(after, func(v *manualBookSnapshot) string { return rateText(v.ExchangeRate) }))

	beforeDebts, afterDebts := debtMap(before), debtMap(after)
	order := make([]uint64, 0, len(beforeDebts)+len(afterDebts))
	for _, snapshot := range []*manualBookSnapshot{before, after} {
		if snapshot == nil {
			continue
		}
		for _, debt := range snapshot.Debts {
			order = append(order, debt.UpstreamUserID)
		}
	}
	seen := make(map[uint64]bool, len(order))
	for _, userID := range order {
		if seen[userID] {
			continue
		}
		seen[userID] = true
		from, inBefore := beforeDebts[userID]
		to, inAfter := afterDebts[userID]
		name := firstNonEmpty(to.UpstreamUserName, from.UpstreamUserName, "#"+strconv.FormatUint(userID, 10))
		fromText, toText := "", ""
		if inBefore {
			fromText = amountText(from.Amount, from.Currency)
		}
		if inAfter {
			toText = amountText(to.Amount, to.Currency)
		}
		add("debt", "欠款 · "+name, fromText, toText)
	}
	add("remark", "备注",
		pick(before, func(v *manualBookSnapshot) string { return v.Remark }),
		pick(after, func(v *manualBookSnapshot) string { return v.Remark }))
	return changes
}

func debtMap(snapshot *manualBookSnapshot) map[uint64]reconDTO.ManualBookDebtDTO {
	result := make(map[uint64]reconDTO.ManualBookDebtDTO)
	if snapshot == nil {
		return result
	}
	for _, debt := range snapshot.Debts {
		result[debt.UpstreamUserID] = debt
	}
	return result
}

// amountText 千分位, 最多两位小数, 带币种: 86,166.04 U / -1,961 RMB
func amountText(amount float64, currency string) string {
	unit := "RMB"
	if currency == reconRepository.CurrencyUSDT {
		unit = "U"
	}
	return groupThousands(strconv.FormatFloat(roundTo(amount, 2), 'f', -1, 64)) + " " + unit
}

func rateText(rate *float64) string {
	if rate == nil {
		return ""
	}
	return fmt.Sprintf("1U = %s RMB", strconv.FormatFloat(*rate, 'f', -1, 64))
}

func roundTo(value float64, digits int) float64 {
	text := strconv.FormatFloat(value, 'f', digits, 64)
	result, _ := strconv.ParseFloat(text, 64)
	return result
}

func groupThousands(text string) string {
	sign := ""
	if strings.HasPrefix(text, "-") {
		sign, text = "-", text[1:]
	}
	integer, fraction := text, ""
	if index := strings.Index(text, "."); index >= 0 {
		integer, fraction = text[:index], text[index:]
	}
	var builder strings.Builder
	for i, char := range integer {
		if i > 0 && (len(integer)-i)%3 == 0 {
			builder.WriteByte(',')
		}
		builder.WriteRune(char)
	}
	return sign + builder.String() + fraction
}
