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

func TestWorkbenchDashboardStatisticsServiceProxiesPendingDetectionAndDelayConsumption(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		switch r.URL.Path {
		case "/workbench/dashboard/pending-detection-count":
			if shopGroupIDs := r.URL.Query().Get("shopGroupIds"); shopGroupIDs != "17,19" {
				t.Fatalf("shopGroupIds = %q", shopGroupIDs)
			}
			_, _ = w.Write([]byte(`{"success":true,"data":{"total":8,"pendingDetectionCount":8,"finishAssignmentPendingDetectionCount":8,"delayAssignmentPendingDetectionCount":3,"groupList":[{"shopGroupId":17,"groupName":"真人","groupCode":"REAL","pendingDetectionCount":5,"finishAssignmentPendingDetectionCount":5,"delayAssignmentPendingDetectionCount":2}]}}`))
		case "/workbench/dashboard/delay-assignment-count":
			if shopCategoryIDs := r.URL.Query().Get("shopCategoryIds"); shopCategoryIDs != "7,12" {
				t.Fatalf("shopCategoryIds = %q", shopCategoryIDs)
			}
			_, _ = w.Write([]byte(`{"success":true,"data":{"total":18,"consumedCount":18,"consumePerMinute":1.5,"finishAssignmentConsumedCount":18,"finishAssignmentConsumePerMinute":1.5,"delayAssignmentConsumedCount":6,"delayAssignmentConsumePerMinute":0.5,"categoryList":[{"shopCategoryId":7,"consumedCount":9,"consumePerMinute":0.75,"finishAssignmentConsumedCount":9,"finishAssignmentConsumePerMinute":0.75,"delayAssignmentConsumedCount":3,"delayAssignmentConsumePerMinute":0.25}]}}`))
		default:
			t.Fatalf("path = %q", r.URL.Path)
		}
	}))
	defer server.Close()

	viper.Set(barryInnerPrefixPath, server.URL)
	viper.Set(barryInnerWorkbenchDashboardPendingDetectionCountPath, "/workbench/dashboard/pending-detection-count")
	viper.Set(barryInnerWorkbenchDashboardDelayAssignmentCountPath, "/workbench/dashboard/delay-assignment-count")
	defer viper.Set(barryInnerPrefixPath, nil)
	defer viper.Set(barryInnerWorkbenchDashboardPendingDetectionCountPath, nil)
	defer viper.Set(barryInnerWorkbenchDashboardDelayAssignmentCountPath, nil)

	service := NewWorkbenchDashboardStatisticsService(&Client{timeout: time.Second})
	pending, err := service.PendingDetectionCount(context.Background(), barryDTO.WorkbenchDashboardMetricQueryDTO{ShopGroupIDs: "17,19"})
	if err != nil {
		t.Fatalf("PendingDetectionCount() error = %v", err)
	}
	if pending.Total != 8 || pending.PendingDetectionCount != 8 {
		t.Fatalf("unexpected pending response: %+v", pending)
	}
	if pending.FinishAssignmentPendingDetectionCount != 8 || pending.DelayAssignmentPendingDetectionCount != 3 {
		t.Fatalf("unexpected pending dual metrics: %+v", pending)
	}
	if len(pending.GroupList) != 1 || pending.GroupList[0].ShopGroupID != 17 {
		t.Fatalf("unexpected pending groups: %+v", pending.GroupList)
	}
	if pending.GroupList[0].FinishAssignmentPendingDetectionCount != 5 || pending.GroupList[0].DelayAssignmentPendingDetectionCount != 2 {
		t.Fatalf("unexpected pending group dual metrics: %+v", pending.GroupList[0])
	}

	delay, err := service.DelayAssignmentCount(context.Background(), barryDTO.WorkbenchDashboardMetricQueryDTO{ShopCategoryIDs: "7,12"})
	if err != nil {
		t.Fatalf("DelayAssignmentCount() error = %v", err)
	}
	if delay.ConsumedCount != 18 || delay.ConsumePerMinute != 1.5 {
		t.Fatalf("unexpected delay response: %+v", delay)
	}
	if delay.FinishAssignmentConsumedCount != 18 || delay.FinishAssignmentConsumePerMinute != 1.5 {
		t.Fatalf("unexpected finish assignment delay response: %+v", delay)
	}
	if delay.DelayAssignmentConsumedCount != 6 || delay.DelayAssignmentConsumePerMinute != 0.5 {
		t.Fatalf("unexpected user delay response: %+v", delay)
	}
	if len(delay.CategoryList) != 1 || delay.CategoryList[0].ShopCategoryID != 7 {
		t.Fatalf("unexpected delay categories: %+v", delay.CategoryList)
	}
	if delay.CategoryList[0].DelayAssignmentConsumedCount != 3 || delay.CategoryList[0].DelayAssignmentConsumePerMinute != 0.25 {
		t.Fatalf("unexpected user delay category: %+v", delay.CategoryList[0])
	}
}
