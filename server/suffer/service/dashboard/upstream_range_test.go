package dashboard

import (
	"testing"
	"time"
)

func TestParseUpstreamRange(t *testing.T) {
	start, end, err := parseUpstreamRange("2026-09-04", " 2026-09-04 ")
	if err != nil {
		t.Fatalf("single day should be valid: %v", err)
	}
	if end.Sub(start) != 24*time.Hour || start.Format("2006-01-02 15:04:05") != "2026-09-04 00:00:00" {
		t.Fatalf("unexpected range %s ~ %s", start, end)
	}
	if _, _, err := parseUpstreamRange("2026-01-01", "2026-04-03"); err != nil {
		t.Fatalf("93 days should be valid: %v", err)
	}
	for _, c := range [][2]string{{"2026-01-01", "2026-04-04"}, {"2026-09-05", "2026-09-04"}, {"", "2026-09-04"}, {"2026/09/04", "2026-09-04"}} {
		if _, _, err := parseUpstreamRange(c[0], c[1]); err == nil {
			t.Fatalf("%v should be rejected", c)
		}
	}
}
