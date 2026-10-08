package barry

import "testing"

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
