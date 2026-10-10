package recon

import (
	"math"
	"strings"
	"testing"

	barryDTO "suffer/service/barry/dto"
	reconDTO "suffer/service/recon/dto"
)

func book(id int, date, currency string, balance, balanceRmb float64) reconDTO.ManualBookDTO {
	return reconDTO.ManualBookDTO{ID: id, BookDate: date, Currency: currency, Balance: balance, BalanceRmb: balanceRmb}
}

func near(value *float64, want float64) bool {
	return value != nil && math.Abs(*value-want) < 1e-6
}

func opening(date, currency string, balance, balanceRmb float64, rate *float64) *reconDTO.OpeningBalanceDTO {
	return &reconDTO.OpeningBalanceDTO{BalanceDate: date, Currency: currency, Balance: balance, BalanceRmb: balanceRmb, ExchangeRate: rate}
}

func TestManualBookCompareAgainstOpeningBalance(t *testing.T) {
	books := []reconDTO.ManualBookDTO{
		book(9, "2026-09-29", "RMB", 1, 1),         // 早于初始余额日期, 不对比
		book(1, "2026-09-30", "USDT", 1000, 7100), // 和初始余额(7000)差 100, 但不作为系统余额的起点
		book(2, "2026-10-01", "USDT", 1100, 7700), // 系统 7000 + 700 = 7700 → 一致
		book(3, "2026-10-02", "USDT", 1150, 8050), // 系统 7700 + 300 = 8000 → 差 50, 当天新增 50
		// 10-03 没记账
		book(4, "2026-10-04", "RMB", 8200, 8200), // 系统 8000 + 100 + 50 = 8150 → 仍差 50, 当天没有新增
	}
	ledger := map[string]ledgerDay{
		"2026-09-29": {in: 5},
		"2026-10-01": {in: 1000, out: 300},
		"2026-10-02": {in: 400, out: 100},
		"2026-10-03": {in: 100},
		"2026-10-04": {in: 80, out: 30},
	}
	result := buildManualBookCompare(books, opening("2026-09-30", "RMB", 7000, 7000, nil), ledger, day("2026-09-29"), day("2026-10-04"))

	if len(result.Days) != 6 || len(result.Books) != 5 || result.OpeningBalance == nil {
		t.Fatalf("days = %d books = %d", len(result.Days), len(result.Books))
	}
	if before := result.Days[0]; before.Status != reconDTO.CompareStatusBeforeStart || before.SystemBalanceRmb != nil || before.LedgerIn != 5 {
		t.Fatalf("09-29 = %+v", before)
	}
	// 初始余额当天: 系统 = 初始余额, 人工 7100 → 差 100
	if same := result.Days[1]; !near(same.SystemBalanceRmb, 7000) || !near(same.Diff, 100) || !same.BaselineIsOpening || same.GapDays != 0 {
		t.Fatalf("09-30 = %+v", same)
	}
	first := result.Days[2]
	if first.Status != reconDTO.CompareStatusOK || !near(first.SystemBalanceRmb, 7700) || !near(first.Diff, 0) ||
		first.BaselineDate != "2026-09-30" || first.BaselineIsOpening || !near(first.ManualProfit, 600) || !near(first.DayDiff, -100) {
		t.Fatalf("10-01 = %+v", first)
	}
	if !near(first.BalanceChange, 100) || !near(first.BaselineSystemBalance, 7000) {
		t.Fatalf("10-01 上一份 = %+v", first)
	}
	second := result.Days[3]
	if second.Status != reconDTO.CompareStatusDiff || !near(second.Diff, 50) || !near(second.DayDiff, 50) || !near(second.DiffRatio, 50.0/8000) {
		t.Fatalf("10-02 = %+v", second)
	}
	if missing := result.Days[4]; missing.Status != reconDTO.CompareStatusMissing || missing.LedgerProfit != 100 || !near(missing.SystemBalanceRmb, 8100) {
		t.Fatalf("10-03 = %+v", missing)
	}
	fourth := result.Days[5]
	if fourth.Status != reconDTO.CompareStatusDiff || fourth.GapDays != 2 || fourth.BaselineDate != "2026-10-02" || !near(fourth.SystemBalanceRmb, 8150) ||
		!near(fourth.Diff, 50) || !near(fourth.DayDiff, 0) || fourth.BalanceChange != nil || fourth.SinceIn != 1580 || fourth.SinceOut != 430 {
		t.Fatalf("10-04 = %+v", fourth)
	}
	if !strings.Contains(issueText(fourth), "差异从 10-02 开始出现") {
		t.Fatalf("10-04 issues = %v", fourth.Issues)
	}
	if result.DiffDays != 3 {
		t.Fatalf("diffDays = %d", result.DiffDays)
	}

	// 合计: 开始日不晚于初始余额次日, 起点就是初始余额: 8200 − 7000 = 1200, 出入账 1150
	total := result.Total
	if !total.BaselineIsOpening || total.Date != "2026-10-04" || !near(total.ManualProfit, 1200) || total.LedgerProfit != 1150 || !near(total.Diff, 50) {
		t.Fatalf("total = %+v", total)
	}
	// 开始日更晚: 起点取开始日之前最近一份, 差值仍以初始余额为基准
	later := buildManualBookCompare(books, opening("2026-09-30", "RMB", 7000, 7000, nil), ledger, day("2026-10-03"), day("2026-10-04"))
	if later.Total.BaselineDate != "2026-10-02" || !near(later.Total.Diff, 50) || !near(later.Total.DayDiff, 0) {
		t.Fatalf("later total = %+v", later.Total)
	}
}

func TestManualBookCompareWithoutOpeningBalance(t *testing.T) {
	books := []reconDTO.ManualBookDTO{
		book(1, "2026-10-02", "USDT", 100, 720),
		book(2, "2026-10-05", "USDT", 90, 648),
	}
	result := buildManualBookCompare(books, nil, map[string]ledgerDay{"2026-10-03": {out: 72}}, day("2026-10-01"), day("2026-10-06"))
	if result.Days[1].Status != reconDTO.CompareStatusNoBaseline || !near(result.Days[1].BalanceRmb, 720) || result.Days[1].Diff != nil {
		t.Fatalf("10-02 = %+v", result.Days[1])
	}
	if result.Days[2].Status != reconDTO.CompareStatusMissing || result.Days[2].LedgerOut != 72 {
		t.Fatalf("10-03 = %+v", result.Days[2])
	}
	if result.Total.Status != reconDTO.CompareStatusNoBaseline || result.DiffDays != 0 {
		t.Fatalf("total = %+v", result.Total)
	}

	// 区间内没有初始余额之后的记账: 合计只给系统应有余额
	empty := buildManualBookCompare(nil, opening("2026-10-01", "RMB", 500, 500, nil), map[string]ledgerDay{"2026-10-02": {in: 20}}, day("2026-10-01"), day("2026-10-03"))
	if empty.Total.Status != reconDTO.CompareStatusMissing || !near(empty.Total.SystemBalanceRmb, 520) || len(empty.Days) != 3 {
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
	result := buildManualBookCompare(books, nil, nil, day("2026-10-01"), day("2026-10-02"))

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
	// 没有上一份时不给增量
	if result := buildManualBookCompare(books[:1], nil, nil, day("2026-09-30"), day("2026-09-30")); result.Days[0].DebtChangeRmb != nil || result.Days[0].Debts[0].ChangeRmb != nil {
		t.Fatalf("no baseline = %+v", result.Days[0])
	}
}

func TestManualBookCompareHints(t *testing.T) {
	rate := func(v float64) *float64 { return &v }
	withRate := func(b reconDTO.ManualBookDTO, r float64) reconDTO.ManualBookDTO {
		b.ExchangeRate = rate(r)
		return b
	}
	category := func(recordType, code, name string, amount float64) barryDTO.ReconLedgerDailyCategoryDTO {
		return barryDTO.ReconLedgerDailyCategoryDTO{RecordType: recordType, Category: code, CategoryName: name, Count: 1, AmountRmb: amount}
	}
	joined := issueText

	books := []reconDTO.ManualBookDTO{
		book(1, "2026-10-01", "RMB", 1000, 1000),
		book(2, "2026-10-02", "RMB", 1300, 1300), // 系统 1000 + 500 − 300 = 1200, 多 100 = 服务器出款
		book(3, "2026-10-03", "RMB", 1250, 1250), // 系统 1200, 多 50; 当天新增 −50
		book(4, "2026-10-04", "RMB", 1300, 1300), // 系统 1200, 多 100; 当天新增 +50, 和 10-03 抵消
	}
	ledger := toLedgerDays([]barryDTO.ReconLedgerDailyDTO{
		{Date: "2026-10-02", InRmb: 500, OutRmb: 300, CategoryList: []barryDTO.ReconLedgerDailyCategoryDTO{
			category("IN", "COMMUNITY_IN", "社区入账", 500), category("OUT", "SERVER_OUT", "服务器出款", 100), category("OUT", "MANUAL_SETTLE", "人工出款", 200),
		}},
	})
	result := buildManualBookCompare(books, opening("2026-10-01", "RMB", 1000, 1000, nil), ledger, day("2026-10-02"), day("2026-10-04"))
	second := result.Days[0]
	if !near(second.SystemBalanceRmb, 1200) || !near(second.Diff, 100) || len(second.LedgerCategories) != 3 ||
		second.LedgerCategories[1].Category != "MANUAL_SETTLE" || !strings.Contains(joined(second), "「服务器出款」") {
		t.Fatalf("10-02 = %+v", second)
	}
	if !near(result.Days[1].Diff, 50) || !near(result.Days[2].Diff, 100) {
		t.Fatalf("累计差 = %+v / %+v", result.Days[1].Diff, result.Days[2].Diff)
	}
	if !strings.Contains(joined(result.Days[1]), "和 10-04 新增的差值正好抵消") || !strings.Contains(joined(result.Days[2]), "和 10-03 新增的差值正好抵消") {
		t.Fatalf("offset = %v / %v", result.Days[1].Issues, result.Days[2].Issues)
	}

	// 初始余额 1000U@7.2, 当天仍是 1000U 但汇率 7.1: 差 −100 全是汇率
	fx := buildManualBookCompare([]reconDTO.ManualBookDTO{
		withRate(book(2, "2026-10-02", "USDT", 1000, 7100), 7.1),
	}, opening("2026-10-01", "USDT", 1000, 7200, rate(7.2)), map[string]ledgerDay{}, day("2026-10-02"), day("2026-10-02"))
	if item := fx.Days[0]; !near(item.FxEffect, -100) || !near(item.Diff, -100) || !strings.Contains(joined(item), "差值正好是汇率变化") {
		t.Fatalf("fx = %+v", item)
	}
}

func issueText(item reconDTO.ManualBookCompareItemDTO) string {
	texts := make([]string, 0, len(item.Issues))
	for _, issue := range item.Issues {
		texts = append(texts, issue.Text)
	}
	return strings.Join(texts, ";")
}
