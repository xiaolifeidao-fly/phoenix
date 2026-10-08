package kakrolot

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

func TestExternalOrderConfigServiceProxiesLegacyAPI(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if token := r.Header.Get("X-Token"); token != "manager-token" {
			t.Fatalf("X-Token = %q", token)
		}
		w.Header().Set("Content-Type", "application/json")
		switch r.URL.Path {
		case "/externalOrderConfig/list":
			query := r.URL.Query()
			if r.Method != http.MethodGet || query.Get("page") != "2" || query.Get("limit") != "10" ||
				query.Get("channel") != "yike" || query.Get("active") != "false" {
				t.Fatalf("list request = %s %s", r.Method, r.URL.String())
			}
			_, _ = w.Write([]byte(`{"code":"0","data":{"total":1,"items":[{"id":3,"channel":"yike","prefixUrl":"https://a","prefixUrlAvailable":true,"active":false,"updateTime":1722816000000,"syncOk":12,"syncOkP95":"≤1000ms","syncQueueDepth":0}]}}`))
		case "/externalOrderConfig/3/update":
			var body UpdateExternalOrderConfigDTO
			if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.PrefixURL != "https://b" {
				t.Fatalf("update body = %#v, err=%v", body, err)
			}
			_, _ = w.Write([]byte(`{"code":"0","data":"修改成功"}`))
		case "/externalOrderConfig/3/disable":
			_, _ = w.Write([]byte(`{"code":"1","message":"禁用失败: boom"}`))
		case "/externalOrderConfig/3/enable":
			_, _ = w.Write([]byte(`{"code":"0","data":"启用成功"}`))
		default:
			http.NotFound(w, r)
		}
	}))
	defer server.Close()

	service := NewExternalOrderConfigService(&Client{baseURL: server.URL, timeout: time.Second})
	ctx := context.Background()

	page, err := service.List(ctx, ExternalOrderConfigQueryDTO{PageIndex: 2, PageSize: 10, Channel: " yike ", Active: "false"}, "manager-token")
	if err != nil {
		t.Fatalf("List error: %v", err)
	}
	if page.Total != 1 || len(page.Data) != 1 {
		t.Fatalf("page = %#v", page)
	}
	item := page.Data[0]
	if item.ID != 3 || item.Active || item.PrefixURLAvailable == nil || !*item.PrefixURLAvailable ||
		item.SyncOK == nil || *item.SyncOK != 12 || item.SyncFailNet != nil || item.UpdatedAt == nil || item.SyncOKP95 != "≤1000ms" {
		t.Fatalf("item = %#v", item)
	}

	if msg, err := service.UpdatePrefixURL(ctx, 3, UpdateExternalOrderConfigDTO{PrefixURL: " https://b "}, "manager-token"); err != nil || msg != "修改成功" {
		t.Fatalf("Update = %q, %v", msg, err)
	}
	if _, err := service.UpdatePrefixURL(ctx, 3, UpdateExternalOrderConfigDTO{PrefixURL: "  "}, "manager-token"); err == nil {
		t.Fatalf("Update with blank prefixUrl should fail")
	}
	if _, err := service.Disable(ctx, 3, "manager-token"); err == nil || err.Error() != "禁用失败: boom" {
		t.Fatalf("Disable err = %v", err)
	}
	if msg, err := service.Enable(ctx, 3, "manager-token"); err != nil || msg != "启用成功" {
		t.Fatalf("Enable = %q, %v", msg, err)
	}
}
