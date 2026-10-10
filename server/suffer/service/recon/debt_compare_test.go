package recon

import (
	"strings"
	"testing"

	reconDTO "suffer/service/recon/dto"
)

// debtInput 初始欠款 3900 是 10-06 的欠款, 上一份人工记账 10-07, 核对 10-08.
// day 是 10-08 当天的流水, total 是 10-07 ~ 10-08 的累计流水.
func debtInput(day, total flowSum, prevManual, manual *float64) *debtCompareInput {
	opening := 3900.0
	input := &debtCompareInput{
		userID: 1, name: "火车头", isTrading: true, opening: &opening, openingDate: "2026-10-06",
		base: "2026-10-06", prevDate: "2026-10-07", checkDate: "2026-10-08", day: day, total: total,
	}
	if prevManual != nil {
		input.prevManual = &reconDTO.ManualBookDebtDTO{UpstreamUserID: 1, Currency: "RMB", Amount: *prevManual, AmountRmb: *prevManual}
	} else {
		input.prevDate = input.base
	}
	if manual != nil {
		input.manual = &reconDTO.ManualBookDebtDTO{UpstreamUserID: 1, Currency: "RMB", Amount: *manual, AmountRmb: *manual}
	}
	return input
}

func TestBuildDebtCompareRow(t *testing.T) {
	amount := func(v float64) *float64 { return &v }
	joined := func(row reconDTO.DebtCompareRowDTO) string { return strings.Join(row.Issues, ";") }
	// 10-07: 充值 1000; 10-08: 充值 5000, 入账 2910, 手续费 90
	day := flowSum{recharge: 5000, income: 2910, collectFee: 90}
	total := flowSum{recharge: 6000, income: 2910, collectFee: 90}

	// 系统: 10-07 欠款 3900 + 1000 = 4900, 10-08 欠款 4900 + 2000 = 6900; 人工两天都对得上
	ok := buildDebtCompareRow(debtInput(day, total, amount(4900), amount(6900)))
	if ok.Status != reconDTO.DebtCompareStatusOK || ok.Recharge != 5000 || ok.DebtChange != 2000 || ok.PrevSystemDebt != 4900 ||
		ok.SystemDebt != 6900 || ok.SystemReceivable != 5000 || !near(ok.ManualReceivable, 5000) ||
		!near(ok.ManualDebtChange, 2000) || !near(ok.Diff, 0) || !near(ok.DayDiff, 0) || ok.PrevIsOpening || ok.DayStart != "2026-10-08" {
		t.Fatalf("ok = %+v", ok)
	}

	// 10-08 人工没扣手续费: 当天新增差异 90 = 代收手续费(90 ÷ 9900 < 1%, 相差较小); 人工应收比充值多 90
	fee := buildDebtCompareRow(debtInput(day, total, amount(4900), amount(6990)))
	if fee.Status != reconDTO.DebtCompareStatusMinor || !near(fee.Diff, 90) || !near(fee.DayDiff, 90) || !near(fee.ManualReceivable, 5090) ||
		!strings.Contains(joined(fee), "当天代收手续费") || !strings.Contains(joined(fee), "人工欠款比系统欠款多") || !strings.Contains(joined(fee), "10-08 新增差异") || strings.Contains(joined(fee), "~") {
		t.Fatalf("fee = %+v", fee)
	}

	// 10-07 就差了 100, 10-08 没有新增: 指向之前
	carried := buildDebtCompareRow(debtInput(day, total, amount(5000), amount(7000)))
	if !near(carried.Diff, 100) || !near(carried.DayDiff, 0) || !strings.Contains(joined(carried), "10-07 之前就已经差了") {
		t.Fatalf("carried = %+v", carried)
	}

	// 没有上一份人工记账: 上一份就是初始欠款, 当天窗口从欠款日期次日开始(= 累计窗口)
	first := buildDebtCompareRow(debtInput(total, total, nil, amount(6900)))
	if first.Status != reconDTO.DebtCompareStatusOK || !first.PrevIsOpening || first.PrevManualDebt != 3900 || first.PrevSystemDebt != 3900 ||
		first.DayStart != "2026-10-07" || first.DebtChange != 3000 || !near(first.ManualDebtChange, 3000) {
		t.Fatalf("first = %+v", first)
	}

	// 当天没记这个社区: 系统照算, 人工为空
	noManual := buildDebtCompareRow(debtInput(day, total, amount(4900), nil))
	if noManual.Status != reconDTO.DebtCompareStatusNoManual || noManual.Diff != nil || noManual.ManualDebtChange != nil || noManual.SystemDebt != 6900 {
		t.Fatalf("noManual = %+v", noManual)
	}

	// 记账日早于欠款日期: 没法核对
	early := debtInput(day, total, nil, amount(3900))
	early.checkDate = "2026-10-05"
	if row := buildDebtCompareRow(early); row.Status != reconDTO.DebtCompareStatusBeforeStart || row.Diff != nil ||
		!strings.Contains(joined(row), "早于初始欠款的欠款日期 10-06") {
		t.Fatalf("early = %+v", row)
	}

	// 没录初始欠款: 按 0 算, 有提示
	missing := debtInput(flowSum{}, flowSum{}, nil, amount(0))
	missing.opening, missing.openingDate = nil, ""
	if row := buildDebtCompareRow(missing); row.Status != reconDTO.DebtCompareStatusOK || !row.OpeningMissing || !strings.Contains(joined(row), "按 0 算") {
		t.Fatalf("missing = %+v", row)
	}

	notTrading := debtInput(flowSum{}, flowSum{}, amount(3900), amount(3900))
	notTrading.isTrading = false
	if row := buildDebtCompareRow(notTrading); row.Status != reconDTO.DebtCompareStatusOK || !strings.Contains(row.Issues[0], "不是活跃用户") {
		t.Fatalf("notTrading = %+v", row)
	}
}

func TestPreviousManualDebt(t *testing.T) {
	book := func(date string, users ...uint64) *reconDTO.ManualBookDTO {
		result := &reconDTO.ManualBookDTO{BookDate: date}
		for _, user := range users {
			result.Debts = append(result.Debts, reconDTO.ManualBookDebtDTO{UpstreamUserID: user, AmountRmb: float64(user)})
		}
		return result
	}
	books := []*reconDTO.ManualBookDTO{book("2026-10-05", 1), book("2026-10-06", 1), book("2026-10-07", 2), book("2026-10-08", 1)}
	// 10-07 没记社区 1, 往前找到 10-06
	if date, debt := previousManualDebt(books, 1, "2026-10-01", "2026-10-08"); date != "2026-10-06" || debt == nil {
		t.Fatalf("got %s %+v", date, debt)
	}
	// 只认欠款日期之后的记账: 10-06 当天的记账不算上一份, 上一份就是初始欠款
	if date, debt := previousManualDebt(books, 1, "2026-10-06", "2026-10-08"); date != "2026-10-06" || debt != nil {
		t.Fatalf("got %s %+v", date, debt)
	}
}
