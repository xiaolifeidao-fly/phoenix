package recon

import (
	"testing"
	"time"

	reconDTO "suffer/service/recon/dto"
	reconRepository "suffer/service/recon/repository"
)

func day(value string) time.Time {
	t, _ := time.ParseInLocation(dateLayout, value, time.Local)
	return t
}

func record(id int, effective, status string) *reconRepository.OpeningDebt {
	r := &reconRepository.OpeningDebt{EffectiveDate: day(effective), SettleStatus: status, Amount: "100"}
	r.Id = id
	return r
}

func timeline() []*reconRepository.OpeningDebt {
	return []*reconRepository.OpeningDebt{
		record(1, "2026-08-01", reconRepository.SettleStatusSettled),
		record(2, "2026-09-01", reconRepository.SettleStatusUnsettled),
	}
}

func TestBaselineAtPicksLatestEffectiveOnOrBeforeDay(t *testing.T) {
	records := timeline()
	if baselineAt(records, day("2026-07-31")) != nil {
		t.Fatal("before first record there is no baseline (未建账)")
	}
	if got := baselineAt(records, day("2026-08-01")); got == nil || got.Id != 1 {
		t.Fatalf("effective day itself uses that record, got %+v", got)
	}
	// 已结清的记录在它有效的那段时间里仍是起点
	if got := baselineAt(records, day("2026-08-31")); got == nil || got.Id != 1 {
		t.Fatalf("settled record still baseline inside its window, got %+v", got)
	}
	if got := baselineAt(records, day("2026-09-15")); got == nil || got.Id != 2 {
		t.Fatalf("later day uses newer record, got %+v", got)
	}
}

func TestAccumulateWindowStartsDayAfterEffective(t *testing.T) {
	baseline := record(2, "2026-09-01", reconRepository.SettleStatusUnsettled)
	if _, _, ok := accumulateWindow(baseline, day("2026-09-01")); ok {
		t.Fatal("effective day itself has no accumulation (流水算在初始欠款里)")
	}
	from, to, ok := accumulateWindow(baseline, day("2026-09-07"))
	if !ok || dateKey(from) != "2026-09-02" || dateKey(to) != "2026-09-07" {
		t.Fatalf("unexpected window %s ~ %s", from, to)
	}
}

func TestCheckCreateRequiresLaterDateAndSettlesCurrent(t *testing.T) {
	records := timeline()
	if _, err := checkCreate(records, day("2026-09-01")); err == nil {
		t.Fatal("same date as last record should be rejected")
	}
	if _, err := checkCreate(records, day("2026-08-15")); err == nil {
		t.Fatal("inserting into history should be rejected")
	}
	toSettle, err := checkCreate(records, day("2026-10-01"))
	if err != nil || toSettle == nil || toSettle.Id != 2 {
		t.Fatalf("new record should settle current one, got %+v %v", toSettle, err)
	}
	if toSettle, err := checkCreate(nil, day("2026-10-01")); err != nil || toSettle != nil {
		t.Fatalf("first record settles nothing, got %+v %v", toSettle, err)
	}
}

func TestCheckUpdateAndRevokeOnlyCurrent(t *testing.T) {
	records := timeline()
	if _, err := checkUpdate(records, records[0], day("2026-08-02")); err == nil {
		t.Fatal("settled record cannot be updated")
	}
	if _, err := checkUpdate(records, records[1], day("2026-08-01")); err == nil {
		t.Fatal("current record must stay after previous one")
	}
	previous, err := checkUpdate(records, records[1], day("2026-09-10"))
	if err != nil || previous == nil || previous.Id != 1 {
		t.Fatalf("update should return previous to sync settle date, got %+v %v", previous, err)
	}
	if _, err := checkRevoke(records, records[0]); err == nil {
		t.Fatal("settled record cannot be revoked")
	}
	previous, err = checkRevoke(records, records[1])
	if err != nil || previous == nil || previous.Id != 1 {
		t.Fatalf("revoke should restore previous, got %+v %v", previous, err)
	}
}

func TestValidateSaveAndParseRange(t *testing.T) {
	amount := -12.5
	value, effective, remark, err := validateSave(reconDTO.SaveOpeningDebtDTO{Amount: &amount, EffectiveDate: " 2026-09-01 ", Remark: " 期初 "})
	if err != nil || value != "-12.50000000" || dateKey(effective) != "2026-09-01" || remark != "期初" {
		t.Fatalf("unexpected %q %s %q %v", value, effective, remark, err)
	}
	if _, _, _, err := validateSave(reconDTO.SaveOpeningDebtDTO{EffectiveDate: "2026-09-01"}); err == nil {
		t.Fatal("amount is required")
	}
	if _, _, _, err := validateSave(reconDTO.SaveOpeningDebtDTO{Amount: &amount, EffectiveDate: "2026/09/01"}); err == nil {
		t.Fatal("bad date should be rejected")
	}
	if _, _, err := parseRange("2026-01-01", "2026-04-04"); err == nil {
		t.Fatal("range over 93 days should be rejected")
	}
}
