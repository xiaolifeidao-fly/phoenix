package recon

import (
	"math"
	"testing"

	reconDTO "suffer/service/recon/dto"
)

func book(id int, date, currency string, balance, balanceRmb float64) reconDTO.ManualBookDTO {
	return reconDTO.ManualBookDTO{ID: id, BookDate: date, Currency: currency, Balance: balance, BalanceRmb: balanceRmb}
}

func near(value *float64, want float64) bool {
	return value != nil && math.Abs(*value-want) < 1e-6
}

func TestManualBookCompareDailyAndTotal(t *testing.T) {
	books := []reconDTO.ManualBookDTO{
		book(1, "2026-09-30", "USDT", 1000, 7000),
		book(2, "2026-10-01", "USDT", 1100, 7700), // +700, 出入账 +700 → 一致
		book(3, "2026-10-02", "USDT", 1150, 8050), // +350, 出入账 +300 → 差 50
		// 10-03 没记账
		book(4, "2026-10-04", "RMB", 8200, 8200), // 窗口 10-03 ~ 10-04: +150, 出入账 100 + 50
	}
	ledger := map[string]ledgerDay{
		"2026-10-01": {in: 1000, out: 300},
		"2026-10-02": {in: 400, out: 100},
		"2026-10-03": {in: 100},
		"2026-10-04": {in: 80, out: 30},
	}
	result := buildManualBookCompare(books, ledger, day("2026-10-01"), day("2026-10-04"))

	if len(result.Days) != 4 || len(result.Books) != 3 {
		t.Fatalf("days = %d books = %d", len(result.Days), len(result.Books))
	}
	first := result.Days[0]
	if first.Status != reconDTO.CompareStatusOK || first.BaselineDate != "2026-09-30" || !near(first.ManualProfit, 700) || first.LedgerProfit != 700 {
		t.Fatalf("10-01 = %+v", first)
	}
	if !near(first.BalanceChange, 100) {
		t.Fatalf("同币种应带原币种变化: %+v", first.BalanceChange)
	}
	second := result.Days[1]
	if second.Status != reconDTO.CompareStatusDiff || !near(second.Diff, 50) || !near(second.DiffRatio, 50.0/300) {
		t.Fatalf("10-02 = %+v", second)
	}
	if result.Days[2].Status != reconDTO.CompareStatusMissing || result.Days[2].LedgerProfit != 100 {
		t.Fatalf("10-03 = %+v", result.Days[2])
	}
	fourth := result.Days[3]
	if fourth.Status != reconDTO.CompareStatusOK || fourth.GapDays != 2 || fourth.BaselineDate != "2026-10-02" || fourth.LedgerProfit != 150 || fourth.BalanceChange != nil {
		t.Fatalf("10-04 = %+v", fourth)
	}
	if result.DiffDays != 1 {
		t.Fatalf("diffDays = %d", result.DiffDays)
	}

	total := result.Total
	// 起点取开始日之前最近一份(09-30), 和每日加起来一致: 8200 − 7000 = 1200, 出入账 700 + 300 + 150 = 1150
	if total.BaselineDate != "2026-09-30" || total.Date != "2026-10-04" || !near(total.ManualProfit, 1200) || total.LedgerProfit != 1150 || !near(total.Diff, 50) {
		t.Fatalf("total = %+v", total)
	}
}

func TestManualBookCompareWithoutEarlierBook(t *testing.T) {
	books := []reconDTO.ManualBookDTO{
		book(1, "2026-10-02", "USDT", 100, 720),
		book(2, "2026-10-05", "USDT", 90, 648),
	}
	result := buildManualBookCompare(books, map[string]ledgerDay{"2026-10-03": {out: 72}}, day("2026-10-01"), day("2026-10-06"))

	if result.Days[1].Status != reconDTO.CompareStatusNoBaseline || !near(result.Days[1].BalanceRmb, 720) {
		t.Fatalf("10-02 = %+v", result.Days[1])
	}
	// 开始日之前没有记账: 起点取区间内第一份, 终点取最后一份
	if result.Total.BaselineDate != "2026-10-02" || result.Total.Date != "2026-10-05" || result.Total.Status != reconDTO.CompareStatusOK || result.Total.GapDays != 3 {
		t.Fatalf("total = %+v", result.Total)
	}
	if result.Days[5].Status != reconDTO.CompareStatusMissing {
		t.Fatalf("10-06 = %+v", result.Days[5])
	}

	// 出入账利润为 0 时不算比例
	zero := buildManualBookCompare(books, nil, day("2026-10-03"), day("2026-10-05"))
	if zero.Total.DiffRatio != nil || zero.Total.Status != reconDTO.CompareStatusDiff {
		t.Fatalf("zero ledger = %+v", zero.Total)
	}

	single := buildManualBookCompare(books[:1], nil, day("2026-10-01"), day("2026-10-03"))
	if single.Total.Status != reconDTO.CompareStatusNoBaseline {
		t.Fatalf("single = %+v", single.Total)
	}
	empty := buildManualBookCompare(nil, nil, day("2026-10-01"), day("2026-10-03"))
	if empty.Total.Status != reconDTO.CompareStatusMissing || len(empty.Days) != 3 {
		t.Fatalf("empty = %+v", empty.Total)
	}
}

func TestValidateManualBook(t *testing.T) {
	amount := func(v float64) *float64 { return &v }
	ok, err := validateManualBook(reconDTO.SaveManualBookDTO{
		BookDate: "2026-10-06", Balance: amount(86166.04), ExchangeRate: amount(7.2),
		Debts: []reconDTO.SaveManualBookDebtDTO{
			{UpstreamUserID: 1, Amount: amount(3900)},
			{UpstreamUserID: 2, Currency: "U", Amount: amount(-10)},
		},
	})
	if err != nil {
		t.Fatalf("unexpected %v", err)
	}
	if ok.currency != "USDT" || math.Abs(ok.balanceRmb-86166.04*7.2) > 1e-6 || ok.debts[0].currency != "RMB" || ok.debts[0].amountRmb != 3900 || ok.debts[1].amountRmb != -72 {
		t.Fatalf("normalized = %+v", ok)
	}

	rmb, err := validateManualBook(reconDTO.SaveManualBookDTO{BookDate: "2026-10-06", Currency: "RMB", Balance: amount(100), ExchangeRate: amount(7.2)})
	if err != nil || rmb.rate != nil || rmb.balanceRmb != 100 {
		t.Fatalf("全是 RMB 时不存汇率: %+v %v", rmb, err)
	}

	cases := map[string]reconDTO.SaveManualBookDTO{
		"缺汇率":   {BookDate: "2026-10-06", Balance: amount(1)},
		"缺剩余金额": {BookDate: "2026-10-06", Currency: "RMB"},
		"日期错误":  {BookDate: "10-06", Currency: "RMB", Balance: amount(1)},
		"汇率为0":  {BookDate: "2026-10-06", Balance: amount(1), ExchangeRate: amount(0)},
		"币种错误":  {BookDate: "2026-10-06", Currency: "EUR", Balance: amount(1)},
		"社区重复": {BookDate: "2026-10-06", Currency: "RMB", Balance: amount(1), Debts: []reconDTO.SaveManualBookDebtDTO{
			{UpstreamUserID: 1, Amount: amount(1)}, {UpstreamUserID: 1, Amount: amount(2)},
		}},
		"欠款缺金额": {BookDate: "2026-10-06", Currency: "RMB", Balance: amount(1), Debts: []reconDTO.SaveManualBookDebtDTO{{UpstreamUserID: 1}}},
		"欠款按U缺汇率": {BookDate: "2026-10-06", Currency: "RMB", Balance: amount(1), Debts: []reconDTO.SaveManualBookDebtDTO{
			{UpstreamUserID: 1, Currency: "USDT", Amount: amount(1)},
		}},
	}
	for name, req := range cases {
		if _, err := validateManualBook(req); err == nil {
			t.Errorf("%s 应该被拒绝", name)
		}
	}
}

func TestManualBookCompareDebtChanges(t *testing.T) {
	withDebts := func(b reconDTO.ManualBookDTO, debts ...reconDTO.ManualBookDebtDTO) reconDTO.ManualBookDTO {
		b.Debts = debts
		for _, debt := range debts {
			b.DebtTotalRmb += debt.AmountRmb
		}
		return b
	}
	debt := func(userID uint64, currency string, amount, amountRmb float64) reconDTO.ManualBookDebtDTO {
		return reconDTO.ManualBookDebtDTO{UpstreamUserID: userID, Currency: currency, Amount: amount, AmountRmb: amountRmb}
	}
	books := []reconDTO.ManualBookDTO{
		withDebts(book(1, "2026-09-30", "USDT", 0, 0), debt(1, "RMB", 3900, 3900), debt(2, "RMB", 1000, 1000)),
		withDebts(book(2, "2026-10-01", "USDT", 0, 0), debt(1, "RMB", 4100, 4100), debt(2, "USDT", 100, 720), debt(3, "RMB", -1961, -1961)),
		withDebts(book(3, "2026-10-02", "USDT", 0, 0), debt(1, "RMB", 4000, 4000)),
	}
	result := buildManualBookCompare(books, nil, day("2026-10-01"), day("2026-10-02"))

	first := result.Days[0]
	if !near(first.DebtTotalRmb, 2859) || !near(first.DebtChangeRmb, 2859-4900) || len(first.Debts) != 3 {
		t.Fatalf("10-01 = %+v", first)
	}
	if !near(first.Debts[0].Change, 200) || !near(first.Debts[0].ChangeRmb, 200) || first.Debts[0].IsNew {
		t.Fatalf("火车头 = %+v", first.Debts[0])
	}
	// 换了币种: 只给 RMB 增量
	if first.Debts[1].Change != nil || !near(first.Debts[1].ChangeRmb, -280) {
		t.Fatalf("十年 = %+v", first.Debts[1])
	}
	if !first.Debts[2].IsNew || !near(first.Debts[2].ChangeRmb, -1961) {
		t.Fatalf("新增社区 = %+v", first.Debts[2])
	}
	if !near(result.Days[1].Debts[0].Change, -100) {
		t.Fatalf("10-02 = %+v", result.Days[1].Debts[0])
	}
	// 合计: 终点 10-02 对起点 09-30
	if !near(result.Total.DebtTotalRmb, 4000) || !near(result.Total.DebtChangeRmb, -900) || !near(result.Total.Debts[0].Change, 100) {
		t.Fatalf("total = %+v", result.Total)
	}
	// 没有上一份时不给增量
	if result := buildManualBookCompare(books[:1], nil, day("2026-09-30"), day("2026-09-30")); result.Days[0].DebtChangeRmb != nil || result.Days[0].Debts[0].ChangeRmb != nil {
		t.Fatalf("no baseline = %+v", result.Days[0])
	}
}
