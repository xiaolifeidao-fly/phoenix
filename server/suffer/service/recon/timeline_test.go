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

func TestOpeningDebtByUserKeepsLast(t *testing.T) {
	first := &reconRepository.OpeningDebt{UserID: 1, Amount: "100"}
	second := &reconRepository.OpeningDebt{UserID: 1, Amount: "200"}
	other := &reconRepository.OpeningDebt{UserID: 2, Amount: "300"}
	result := openingDebtByUser([]*reconRepository.OpeningDebt{first, second, other})
	if len(result) != 2 || result[1] != second || result[2] != other {
		t.Fatalf("unexpected %+v", result)
	}
}

func TestValidateSaveAndParseRange(t *testing.T) {
	amount := -12.5
	values, err := validateSave(reconDTO.SaveOpeningDebtDTO{Amount: &amount, DebtDate: " 2026-10-01 ", Remark: " 期初 "})
	if err != nil || values.amount != "-12.50000000" || dateKey(values.debtDate) != "2026-10-01" || values.remark != "期初" {
		t.Fatalf("unexpected %+v %v", values, err)
	}
	if _, err := validateSave(reconDTO.SaveOpeningDebtDTO{DebtDate: "2026-10-01"}); err == nil {
		t.Fatal("amount is required")
	}
	if _, err := validateSave(reconDTO.SaveOpeningDebtDTO{Amount: &amount}); err == nil {
		t.Fatal("debt date is required")
	}
	if _, _, err := parseRange("2026-01-01", "2026-04-04"); err == nil {
		t.Fatal("range over 93 days should be rejected")
	}
}
