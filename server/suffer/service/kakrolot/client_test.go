package kakrolot

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

func TestAccountServiceRechargeUsesLegacyEndpoint(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/accounts/19/payAmount" {
			t.Fatalf("path = %q", r.URL.Path)
		}
		if token := r.Header.Get("X-Token"); token != "manager-token" {
			t.Fatalf("X-Token = %q", token)
		}
		var body struct {
			Amount     float64 `json:"amount"`
			GivenScale int     `json:"givenScale"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			t.Fatal(err)
		}
		if body.Amount != 88.5 || body.GivenScale != 15 {
			t.Fatalf("body = %+v", body)
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"code":"0","message":"充值成功"}`))
	}))
	defer server.Close()

	client := &Client{baseURL: server.URL, timeout: time.Second}
	message, err := NewAccountService(client).Recharge(context.Background(), 19, 88.5, 15, "manager-token")
	if err != nil {
		t.Fatal(err)
	}
	if message != "充值成功" {
		t.Fatalf("message = %q", message)
	}
}

func TestOrderServiceRefundUsesOnlyLegacyActionEndpoint(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			t.Fatalf("method = %q", r.Method)
		}
		if r.URL.Path != "/orders/42/refund/force" {
			t.Fatalf("path = %q", r.URL.Path)
		}
		if token := r.Header.Get("X-Token"); token != "manager-token" {
			t.Fatalf("X-Token = %q", token)
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"code":"0","message":"退单请求已发送"}`))
	}))
	defer server.Close()

	client := &Client{baseURL: server.URL, timeout: time.Second}
	if err := NewOrderService(client).Refund(context.Background(), 42, "manager-token"); err != nil {
		t.Fatal(err)
	}
}
