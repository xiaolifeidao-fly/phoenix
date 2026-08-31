package dto

import (
	"encoding/json"
	"testing"
)

func TestProductCategoryActionResultAcceptsBarryIDResponse(t *testing.T) {
	var response ProductCategoryActionResultDTO
	if err := response.UnmarshalJSON([]byte(`{"code":"0","data":42,"errorMsg":"操作成功"}`)); err != nil {
		t.Fatalf("UnmarshalJSON() error = %v", err)
	}
	if !response.Success || response.Code != "0" || string(response.Data) != "42" {
		t.Fatalf("unexpected response: %+v", response)
	}
}

func TestProductCategoryActionResultReadsBarryErrorMessage(t *testing.T) {
	var response ProductCategoryActionResultDTO
	if err := response.UnmarshalJSON([]byte(`{"code":"1","data":null,"errorMsg":"商品ID或编码不能为空"}`)); err != nil {
		t.Fatalf("UnmarshalJSON() error = %v", err)
	}
	if response.Success || response.Code != "1" || response.Message != "商品ID或编码不能为空" {
		t.Fatalf("unexpected response: %+v", response)
	}
}

func TestSaveUserWhitelistCarriesPolicyFields(t *testing.T) {
	rate := 0.8
	days := 7
	timeRanges := "09:00-12:00"
	payload := SaveUserWhitelistDTO{
		UserID:                 1698,
		ShopCategoryID:         18,
		UpdatePolicy:           true,
		MinRecentApprovalRate:  &rate,
		RecentApprovalRateDays: &days,
		DailyAssignTimeRanges:  &timeRanges,
	}

	encoded, err := json.Marshal(payload)
	if err != nil {
		t.Fatalf("Marshal() error = %v", err)
	}
	var decoded map[string]any
	if err := json.Unmarshal(encoded, &decoded); err != nil {
		t.Fatalf("Unmarshal() error = %v", err)
	}
	for _, field := range []string{"updatePolicy", "minRecentApprovalRate", "recentApprovalRateDays", "dailyAssignTimeRanges"} {
		if _, ok := decoded[field]; !ok {
			t.Errorf("saved whitelist payload is missing %q: %s", field, encoded)
		}
	}
}

func TestAssignConfigListResponseCarriesAllowAssignTime(t *testing.T) {
	var response AssignConfigListResponseDTO
	if err := json.Unmarshal([]byte(`{"code":"0","data":[{"id":42,"shopTypeId":18,"allowAssignTime":"2026-08-31 09:30:00"}]}`), &response); err != nil {
		t.Fatalf("Unmarshal() error = %v", err)
	}
	if !response.Success || len(response.Data) != 1 || response.Data[0].AllowAssignTime != "2026-08-31 09:30:00" {
		t.Fatalf("unexpected response: %+v", response)
	}
}

func TestSaveAssignConfigCarriesAllowAssignTime(t *testing.T) {
	payload := SaveAssignConfigDTO{
		ShopTypeID:      18,
		QueueCode:       "manual-queue",
		AllowAssignTime: "2026-08-31 09:30:00",
	}

	encoded, err := json.Marshal(payload)
	if err != nil {
		t.Fatalf("Marshal() error = %v", err)
	}
	var decoded map[string]any
	if err := json.Unmarshal(encoded, &decoded); err != nil {
		t.Fatalf("Unmarshal() error = %v", err)
	}
	if got, ok := decoded["allowAssignTime"].(string); !ok || got != payload.AllowAssignTime {
		t.Fatalf("saved assign config payload has allowAssignTime = %#v, want %q", decoded["allowAssignTime"], payload.AllowAssignTime)
	}
}
