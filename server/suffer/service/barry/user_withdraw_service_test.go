package barry

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	barryDTO "suffer/service/barry/dto"

	"github.com/spf13/viper"
)

func TestUserWithdrawListPassesApproveTimeRange(t *testing.T) {
	var got map[string]string
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		q := r.URL.Query()
		got = map[string]string{
			"status":           q.Get("status"),
			"startTime":        q.Get("startTime"),
			"approveStartTime": q.Get("approveStartTime"),
			"approveEndTime":   q.Get("approveEndTime"),
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"code":"0","data":[]}`))
	}))
	defer server.Close()

	viper.Set(barryInnerPrefixPath, server.URL)
	viper.Set(barryInnerUserWithdrawRecordPath, "/point/user/withdrawRecord?username={username}&channel={channel}&status={status}&startTime={startTime}&endTime={endTime}")
	defer viper.Reset()

	service := NewUserWithdrawService(&Client{timeout: time.Second})
	if _, err := service.List(context.Background(), barryDTO.UserWithdrawRecordQueryDTO{
		Status:           "FINISH",
		StartTime:        "2026-09-01 00:00:00",
		ApproveStartTime: "2026-09-04 00:00:00",
		ApproveEndTime:   "2026-09-04 23:59:59",
	}); err != nil {
		t.Fatalf("List() error = %v", err)
	}
	if got["status"] != "FINISH" || got["startTime"] != "2026-09-01 00:00:00" ||
		got["approveStartTime"] != "2026-09-04 00:00:00" || got["approveEndTime"] != "2026-09-04 23:59:59" {
		t.Fatalf("unexpected query %v", got)
	}

	// 不传审核时间时不带这两个参数
	if _, err := service.List(context.Background(), barryDTO.UserWithdrawRecordQueryDTO{Status: "FINISH"}); err != nil {
		t.Fatalf("List() error = %v", err)
	}
	if got["approveStartTime"] != "" || got["approveEndTime"] != "" {
		t.Fatalf("approve range should be omitted, got %v", got)
	}
}
