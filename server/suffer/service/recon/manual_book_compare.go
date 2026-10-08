package recon

import (
	"math"
	"time"

	barryDTO "suffer/service/barry/dto"
	reconDTO "suffer/service/recon/dto"
)

const (
	// manualBookLookbackDays 总对比 / 每日对比往开始日之前找上一份记账的天数
	manualBookLookbackDays = 31
	// manualBookTolerance 差异绝对值不超过它算一致(RMB), 吸收 U 折算的舍入
	manualBookTolerance = 0.01
)

type ledgerDay struct {
	in  float64
	out float64
}

func toLedgerDays(rows []barryDTO.ReconLedgerDailyDTO) map[string]ledgerDay {
	result := make(map[string]ledgerDay, len(rows))
	for _, row := range rows {
		current := result[row.Date]
		current.in += row.InRmb
		current.out += row.OutRmb
		result[row.Date] = current
	}
	return result
}

// buildManualBookCompare 人工记账利润 vs 出入账利润.
// books 按日期升序, 含开始日之前回看的那几份; ledger 至少覆盖 [最早的上一份 + 1, end].
func buildManualBookCompare(books []reconDTO.ManualBookDTO, ledger map[string]ledgerDay, start, end time.Time) reconDTO.ManualBookCompareDTO {
	startKey, endKey := dateKey(start), dateKey(end)
	result := reconDTO.ManualBookCompareDTO{
		StartDate: startKey, EndDate: endKey, Tolerance: manualBookTolerance,
		Days: make([]reconDTO.ManualBookCompareItemDTO, 0), Books: make([]reconDTO.ManualBookDTO, 0),
	}
	byDate := make(map[string]int, len(books))
	inRange := make([]int, 0, len(books))
	for i := range books {
		byDate[books[i].BookDate] = i
		if books[i].BookDate >= startKey && books[i].BookDate <= endKey {
			inRange = append(inRange, i)
			result.Books = append(result.Books, books[i])
		}
	}

	for current := truncateDay(start); !current.After(end); current = current.AddDate(0, 0, 1) {
		key := dateKey(current)
		index, ok := byDate[key]
		var item reconDTO.ManualBookCompareItemDTO
		switch {
		case !ok:
			item = singleDayItem(key, ledger, reconDTO.CompareStatusMissing)
		case index == 0:
			item = singleDayItem(key, ledger, reconDTO.CompareStatusNoBaseline)
			fillBook(&item, &books[index])
		default:
			item = compareWindow(&books[index-1], &books[index], ledger)
		}
		if item.Status == reconDTO.CompareStatusDiff {
			result.DiffDays++
		}
		result.Days = append(result.Days, item)
	}

	switch {
	case len(inRange) == 0:
		result.Total = reconDTO.ManualBookCompareItemDTO{Date: endKey, Status: reconDTO.CompareStatusMissing}
	case inRange[0] > 0:
		// 开始日之前有记账: 起点取最近那份, 和每日对比加起来一致
		result.Total = compareWindow(&books[inRange[0]-1], &books[inRange[len(inRange)-1]], ledger)
	case len(inRange) > 1:
		result.Total = compareWindow(&books[inRange[0]], &books[inRange[len(inRange)-1]], ledger)
	default:
		result.Total = reconDTO.ManualBookCompareItemDTO{Date: books[inRange[0]].BookDate, Status: reconDTO.CompareStatusNoBaseline}
		fillBook(&result.Total, &books[inRange[0]])
	}
	return result
}

// compareWindow 窗口 (baseline, book]: 人工利润 = 两份剩余金额(RMB)之差, 出入账利润 = 窗口内入账 − 出账.
func compareWindow(baseline, book *reconDTO.ManualBookDTO, ledger map[string]ledgerDay) reconDTO.ManualBookCompareItemDTO {
	from, _ := time.ParseInLocation(dateLayout, baseline.BookDate, time.Local)
	to, _ := time.ParseInLocation(dateLayout, book.BookDate, time.Local)
	item := reconDTO.ManualBookCompareItemDTO{Date: book.BookDate, BaselineDate: baseline.BookDate}
	for current := from.AddDate(0, 0, 1); !current.After(to); current = current.AddDate(0, 0, 1) {
		day := ledger[dateKey(current)]
		item.LedgerIn += day.in
		item.LedgerOut += day.out
		item.GapDays++
	}
	item.LedgerProfit = item.LedgerIn - item.LedgerOut
	fillBook(&item, book)
	item.BaselineBalance = floatPtr(baseline.BalanceRmb)
	item.DebtChangeRmb = floatPtr(book.DebtTotalRmb - baseline.DebtTotalRmb)
	previous := make(map[uint64]reconDTO.ManualBookDebtDTO, len(baseline.Debts))
	for _, debt := range baseline.Debts {
		previous[debt.UpstreamUserID] = debt
	}
	for i := range item.Debts {
		debt := &item.Debts[i]
		last, ok := previous[debt.UpstreamUserID]
		if !ok {
			debt.IsNew = true
			debt.Change, debt.ChangeRmb = floatPtr(debt.Amount), floatPtr(debt.AmountRmb)
			continue
		}
		debt.ChangeRmb = floatPtr(debt.AmountRmb - last.AmountRmb)
		if last.Currency == debt.Currency {
			debt.Change = floatPtr(debt.Amount - last.Amount)
		}
	}
	if baseline.Currency == book.Currency {
		item.BalanceChange = floatPtr(book.Balance - baseline.Balance)
	}
	profit := book.BalanceRmb - baseline.BalanceRmb
	diff := profit - item.LedgerProfit
	item.ManualProfit, item.Diff = floatPtr(profit), floatPtr(diff)
	if item.LedgerProfit != 0 {
		item.DiffRatio = floatPtr(diff / math.Abs(item.LedgerProfit))
	}
	item.Status = reconDTO.CompareStatusOK
	if math.Abs(diff) > manualBookTolerance {
		item.Status = reconDTO.CompareStatusDiff
	}
	return item
}

func singleDayItem(key string, ledger map[string]ledgerDay, status string) reconDTO.ManualBookCompareItemDTO {
	day := ledger[key]
	return reconDTO.ManualBookCompareItemDTO{
		Date: key, Status: status, GapDays: 1,
		LedgerIn: day.in, LedgerOut: day.out, LedgerProfit: day.in - day.out,
	}
}

func fillBook(item *reconDTO.ManualBookCompareItemDTO, book *reconDTO.ManualBookDTO) {
	item.BookID = book.ID
	item.Currency = book.Currency
	item.Balance = floatPtr(book.Balance)
	item.BalanceRmb = floatPtr(book.BalanceRmb)
	item.DebtTotalRmb = floatPtr(book.DebtTotalRmb)
	item.Debts = make([]reconDTO.ManualBookDebtCompareDTO, 0, len(book.Debts))
	for _, debt := range book.Debts {
		item.Debts = append(item.Debts, reconDTO.ManualBookDebtCompareDTO{
			UpstreamUserID: debt.UpstreamUserID, UpstreamUserName: debt.UpstreamUserName,
			UpstreamUsername: debt.UpstreamUsername, UpstreamRemark: debt.UpstreamRemark, UpstreamBalance: debt.UpstreamBalance,
			Currency: debt.Currency, Amount: debt.Amount, AmountRmb: debt.AmountRmb,
		})
	}
}

func floatPtr(value float64) *float64 { return &value }
