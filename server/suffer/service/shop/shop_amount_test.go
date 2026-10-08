package shop

import "testing"

func TestNormalizeShopAmount(t *testing.T) {
	cases := map[string]string{"": "0.00000000", "  ": "0.00000000", "0": "0", " 1.5 ": "1.5", "0.00000001": "0.00000001", "120": "120"}
	for in, want := range cases {
		got, err := normalizeShopAmount(in, "返点金额")
		if err != nil || got != want {
			t.Fatalf("normalizeShopAmount(%q) = %q, %v; want %q", in, got, err, want)
		}
	}
	for _, in := range []string{"-1", "abc", "1.123456789", "1.", ".5", "1e3"} {
		if _, err := normalizeShopAmount(in, "小费金额"); err == nil {
			t.Fatalf("normalizeShopAmount(%q) should fail", in)
		}
	}
}
