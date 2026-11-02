package barry

import (
	"testing"

	barryDTO "suffer/service/barry/dto"
)

func TestPointsRuleValidation(t *testing.T) {
	str := func(s string) *string { return &s }
	num := func(f float64) *float64 { return &f }
	if normalizeEatMode(str("  ")) != nil || normalizeEatMode(nil) != nil {
		t.Fatal("blank eat mode should normalize to nil")
	}
	if got := normalizeEatMode(str(" APPROVE ")); got == nil || *got != "APPROVE" {
		t.Fatalf("expected trimmed APPROVE, got %v", got)
	}
	valid := [][2]interface{}{{(*float64)(nil), (*string)(nil)}, {num(0), str("SUBMIT_COUNT")}, {num(1), str("APPROVE")}, {(*float64)(nil), str("SUBMIT_COUNT")}, {num(0.1), (*string)(nil)}}
	for _, c := range valid {
		if msg := validatePointsRule(c[0].(*float64), c[1].(*string)); msg != "" {
			t.Fatalf("expected valid %v: %s", c, msg)
		}
	}
	if validatePointsRule(num(1.2), nil) == "" || validatePointsRule(num(-0.1), nil) == "" {
		t.Fatal("ratio out of range should be rejected")
	}
	if validatePointsRule(nil, str("POINTS")) == "" || validatePointsRule(nil, str("approve")) == "" {
		t.Fatal("unknown eat mode should be rejected")
	}
}

func TestScoreConfigValidation(t *testing.T) {
	valid := barryDTO.ScoreConfigDTO{
		Options: []barryDTO.ScoreOptionDTO{{ID: 1, Score: 55}},
		Groups:  []barryDTO.ScoreGroupDTO{{ID: 2, Name: "标准", DefaultGroup: true, Items: []barryDTO.ScoreGroupItemDTO{{OptionID: 0, Weight: 1}, {OptionID: 1, Weight: 0.5}}}},
	}
	if msg := validateScoreConfig(valid); msg != "" {
		t.Fatalf("expected valid: %s", msg)
	}
	if validateScoreConfig(barryDTO.ScoreConfigDTO{}) != "" {
		t.Fatal("empty config means clear and should be valid")
	}
	negative := barryDTO.ScoreConfigDTO{Options: []barryDTO.ScoreOptionDTO{{ID: 1, Score: -1}}}
	if validateScoreConfig(negative) == "" {
		t.Fatal("negative score should be rejected")
	}
	zeroWeight := barryDTO.ScoreConfigDTO{Groups: []barryDTO.ScoreGroupDTO{{ID: 2, Name: "标准", Items: []barryDTO.ScoreGroupItemDTO{{OptionID: 0, Weight: 0}}}}}
	if validateScoreConfig(zeroWeight) == "" {
		t.Fatal("zero weight should be rejected")
	}
}
