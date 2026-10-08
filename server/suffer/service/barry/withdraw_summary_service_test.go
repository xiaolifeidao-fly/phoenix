package barry

import (
	"net/url"
	"testing"
	"time"

	barryDTO "suffer/service/barry/dto"

	"github.com/spf13/viper"
)

func TestParseWithdrawSummaryRange(t *testing.T) {
	start, end, err := ParseWithdrawSummaryRange("2026-10-01", "2026-10-01")
	if err != nil {
		t.Fatalf("single day should be valid: %v", err)
	}
	if end.Sub(start) != 24*time.Hour || start.Format(withdrawSummaryTimeLayout) != "2026-10-01 00:00:00" {
		t.Fatalf("unexpected range %s ~ %s", start, end)
	}
	if _, _, err := ParseWithdrawSummaryRange("2026-09-01", "2026-10-01"); err != nil {
		t.Fatalf("31 days should be valid: %v", err)
	}
	for _, c := range [][2]string{{"2026-09-01", "2026-10-02"}, {"2026-10-02", "2026-10-01"}, {"", "2026-10-01"}, {"2026/10/01", "2026-10-01"}} {
		if _, _, err := ParseWithdrawSummaryRange(c[0], c[1]); err == nil {
			t.Fatalf("%v should be rejected", c)
		}
	}
}

func TestBuildWithdrawSummaryRow(t *testing.T) {
	row := BuildWithdrawSummaryRow("CH", "2026-10-01", []*barryDTO.WithdrawSummaryItemDTO{
		{Status: "UN_APPROVE", Number: 1, Points: 100},
		{Status: "APPROVING", Number: 2, Points: 200},
		{Status: "ACCOUNTING", Number: 3, Points: 300},
		{Status: "FINISH", Number: 4, Points: 400},
		{Status: "ERROR", Number: 5, Points: 500},
		{Status: "CANCEL", Number: 6, Points: 600},
		nil,
	})
	if row.ApprovingNum != 3 || row.ApprovingPoints != 300 || row.AccountingNum != 3 || row.AccountingPoints != 300 ||
		row.FinishNum != 4 || row.FinishPoints != 400 || row.ErrorNum != 5 || row.ErrorPoints != 500 {
		t.Fatalf("unexpected row %+v", row)
	}
}

func TestBuildWithdrawSummaryURLEscapes(t *testing.T) {
	viper.Set(barryInnerPrefixPath, "http://barry:9999/")
	viper.Set(barryInnerPointWithdrawSummaryPath, "/point/withdrawSummary?channel={channel}&startTime={startTime}&endTime={endTime}")
	defer viper.Reset()
	start, end, _ := ParseWithdrawSummaryRange("2026-10-01", "2026-10-01")
	raw := buildWithdrawSummaryURL(barryInnerPointWithdrawSummaryPath, "渠道 A&B", start, end)
	parsed, err := url.Parse(raw)
	if err != nil {
		t.Fatalf("url should parse: %v", err)
	}
	q := parsed.Query()
	if parsed.Path != "/point/withdrawSummary" || q.Get("channel") != "渠道 A&B" ||
		q.Get("startTime") != "2026-10-01 00:00:00" || q.Get("endTime") != "2026-10-02 00:00:00" {
		t.Fatalf("unexpected url %s", raw)
	}
}
