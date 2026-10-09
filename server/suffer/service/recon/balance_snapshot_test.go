package recon

import (
	"testing"
	"time"

	reconDTO "suffer/service/recon/dto"
	reconRepository "suffer/service/recon/repository"
)

func TestBalanceLookupFill(t *testing.T) {
	captured := time.Date(2026, 10, 9, 0, 0, 1, 0, time.Local)
	lookup := &balanceLookup{
		snapshots: map[string]map[uint64]*reconRepository.UpstreamBalanceSnapshot{
			"2026-10-08": {1: {UserID: 1, Balance: "120.50000000", CapturedTime: captured}},
		},
		current: map[uint64]float64{1: 999, 2: 888},
		today:   "2026-10-09",
	}
	fill := func(date string, userID uint64) reconDTO.ManualBookDebtDTO {
		debt := reconDTO.ManualBookDebtDTO{UpstreamUserID: userID}
		lookup.fill(date, &debt)
		return debt
	}

	// 有快照: 用那天的快照, 不是当前余额
	if got := fill("2026-10-08", 1); got.UpstreamBalance == nil || *got.UpstreamBalance != 120.5 || got.UpstreamBalanceLive ||
		got.UpstreamBalanceTime != "2026-10-09 00:00:01" {
		t.Fatalf("snapshot: %+v", got)
	}
	// 过去的日期没有快照: 为空, 不拿当前余额充数
	if got := fill("2026-10-08", 2); got.UpstreamBalance != nil || got.UpstreamBalanceLive {
		t.Fatalf("missing: %+v", got)
	}
	// 当天还没到打快照的时候: 当前余额, 标为实时
	if got := fill("2026-10-09", 2); got.UpstreamBalance == nil || *got.UpstreamBalance != 888 || !got.UpstreamBalanceLive {
		t.Fatalf("today: %+v", got)
	}
}
