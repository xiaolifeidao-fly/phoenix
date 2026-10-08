package recon

import (
	"strings"
	"testing"

	reconDTO "suffer/service/recon/dto"
)

func debtInput(recharge, income, fee float64, previous, manual *float64) *debtCompareInput {
	input := &debtCompareInput{
		userID: 1, name: "火车头", isTrading: true, recharge: recharge, income: income, collectFee: fee,
		hasPrevious: true, previousDate: "2026-10-05", checkDate: "2026-10-06",
	}
	if previous != nil {
		input.previous = &reconDTO.ManualBookDebtDTO{UpstreamUserID: 1, Currency: "RMB", Amount: *previous, AmountRmb: *previous}
	}
	if manual != nil {
		input.manual = &reconDTO.ManualBookDebtDTO{UpstreamUserID: 1, Currency: "RMB", Amount: *manual, AmountRmb: *manual}
	}
	return input
}

func TestBuildDebtCompareRow(t *testing.T) {
	amount := func(v float64) *float64 { return &v }
	joined := func(row reconDTO.DebtCompareRowDTO) string { return strings.Join(row.Issues, ";") }

	// 充值 5000 = 入账 2910 + 手续费 90 + 欠款增量 (5900 − 3900)
	ok := buildDebtCompareRow(debtInput(5000, 2910, 90, amount(3900), amount(5900)))
	if ok.Status != reconDTO.DebtCompareStatusOK || !near(ok.DebtChange, 2000) || !near(ok.ManualTotal, 5000) || !near(ok.Diff, 0) {
		t.Fatalf("ok = %+v", ok)
	}

	// 人工欠款没扣手续费: 欠款多记 90 → 差 90 = 代收手续费
	fee := buildDebtCompareRow(debtInput(5000, 2910, 90, amount(3900), amount(5990)))
	if fee.Status != reconDTO.DebtCompareStatusDiff || !near(fee.Diff, 90) || !strings.Contains(joined(fee), "代收手续费") {
		t.Fatalf("fee = %+v", fee)
	}

	// 人工欠款没加充值: 欠款没变, 差 −5000
	recharge := buildDebtCompareRow(debtInput(5000, 0, 0, amount(3900), amount(3900)))
	if !near(recharge.Diff, -5000) || !strings.Contains(joined(recharge), "没把这段时间的充值加进去") {
		t.Fatalf("recharge = %+v", recharge)
	}

	// 差 30 / 5000 = 0.6% → 相差较小
	minor := buildDebtCompareRow(debtInput(5000, 2910, 90, amount(3900), amount(5930)))
	if minor.Status != reconDTO.DebtCompareStatusMinor || !near(minor.DiffRatio, 30.0/5000) {
		t.Fatalf("minor = %+v", minor)
	}

	// 上一份没记这个社区: 按 0 算, 有提示
	missing := buildDebtCompareRow(debtInput(5000, 3000, 0, nil, amount(2000)))
	if missing.Status != reconDTO.DebtCompareStatusOK || !missing.PreviousMissing || !strings.Contains(joined(missing), "按 0 算") {
		t.Fatalf("missing = %+v", missing)
	}

	noManual := buildDebtCompareRow(debtInput(5000, 0, 0, amount(3900), nil))
	if noManual.Status != reconDTO.DebtCompareStatusNoManual || noManual.ManualTotal != nil {
		t.Fatalf("noManual = %+v", noManual)
	}

	first := debtInput(5000, 0, 0, nil, amount(3900))
	first.hasPrevious = false
	if row := buildDebtCompareRow(first); row.Status != reconDTO.DebtCompareStatusNoBaseline || !near(row.ManualDebt, 3900) {
		t.Fatalf("first = %+v", row)
	}

	notTrading := debtInput(0, 0, 0, amount(100), amount(100))
	notTrading.isTrading = false
	if row := buildDebtCompareRow(notTrading); row.Status != reconDTO.DebtCompareStatusOK || !strings.Contains(row.Issues[0], "不是活跃用户") {
		t.Fatalf("notTrading = %+v", row)
	}
}
