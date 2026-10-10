package barry

import (
	"context"
	"io"
	"net/http"
	"net/http/httptest"
	"strconv"
	"strings"
	"testing"
	"time"

	barryDTO "suffer/service/barry/dto"

	"github.com/spf13/viper"
)

func TestReconciliationServiceManualDimension(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		if r.URL.Path != "/reconciliation/manual-dimension" {
			t.Fatalf("path = %q", r.URL.Path)
		}
		if r.URL.Query().Get("startDate") == "2026-09-30" {
			_, _ = w.Write([]byte(`{"code":"1","errorMsg":"endDate must be greater than or equal to startDate"}`))
			return
		}
		if start, end := r.URL.Query().Get("startDate"), r.URL.Query().Get("endDate"); start != "2026-09-01" || end != "2026-09-30" {
			t.Fatalf("startDate = %q endDate = %q", start, end)
		}
		_, _ = w.Write([]byte(`{"code":"0","errorMsg":"操作成功","data":{"startDate":"2026-09-01","endDate":"2026-09-30","taskNum":140,"checkedNum":110,"points":1500,"taskPoints":1200,"childrenPoints":300,"pointsUserCount":4,"shopCategoryList":[{"shopCategoryId":1,"shopCategoryName":"A","taskNum":100,"checkedNum":80,"userCount":3}]}}`))
	}))
	defer server.Close()

	viper.Set(barryInnerPrefixPath, server.URL)
	viper.Set(barryInnerReconManualDimensionPath, "/reconciliation/manual-dimension")
	defer viper.Set(barryInnerPrefixPath, nil)
	defer viper.Set(barryInnerReconManualDimensionPath, nil)

	service := NewReconciliationService(&Client{timeout: time.Second})
	result, err := service.ManualDimension(context.Background(), barryDTO.ReconManualDimensionQueryDTO{StartDate: "2026-09-01", EndDate: "2026-09-30"})
	if err != nil {
		t.Fatalf("ManualDimension() error = %v", err)
	}
	if result.TaskNum != 140 || result.Points != 1500 || result.ChildrenPoints != 300 || len(result.ShopCategories) != 1 ||
		result.ShopCategories[0].ShopCategoryName != "A" || result.ShopCategories[0].TaskNum != 100 {
		t.Fatalf("unexpected result %+v", result)
	}

	if _, err := service.ManualDimension(context.Background(), barryDTO.ReconManualDimensionQueryDTO{StartDate: "2026-09-30", EndDate: "2026-09-01"}); err == nil ||
		err.Error() != "endDate must be greater than or equal to startDate" {
		t.Fatalf("expected barry error message, got %v", err)
	}
}

func TestReconciliationServiceLedger(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		q := r.URL.Query()
		switch r.URL.Path {
		case "/reconciliation/ledger/list":
			if q.Get("category") != "MANUAL_SETTLE,PAYOUT_FEE" || q.Get("page") != "2" || q.Get("recordType") != "" ||
				q.Get("sortField") != "user" || q.Get("sortOrder") != "asc" {
				t.Fatalf("list query = %v", q)
			}
			_, _ = w.Write([]byte(`{"code":"0","data":{"total":1,"data":[{"id":5,"recordDate":"2026-10-02","recordType":"OUT","category":"MANUAL_SETTLE","categoryName":"人工结算","source":"WITHDRAW","editable":false,"currency":"USDT","amountRmb":144.0,"amountU":20.0,"exchangeRate":7.2,"userId":8,"username":"u8","points":1440000}]}}`))
		case "/reconciliation/ledger/save":
			body, _ := io.ReadAll(r.Body)
			if q.Get("operator") != "alice" || !strings.Contains(string(body), `"category":"COMMUNITY_IN"`) || !strings.Contains(string(body), `"settleChannelId":1`) {
				t.Fatalf("save query = %v body = %s", q, body)
			}
			_, _ = w.Write([]byte(`{"code":"1","errorMsg":"结算通道不存在"}`))
		case "/reconciliation/ledger/delete":
			if q.Get("id") != "9" || q.Get("operator") != "" {
				t.Fatalf("delete query = %v", q)
			}
			_, _ = w.Write([]byte(`{"code":"0","errorMsg":"删除成功"}`))
		case "/reconciliation/ledger/sync-withdraw":
			_, _ = w.Write([]byte(`{"code":"0","data":{"withdrawCount":11,"created":0,"failed":11,"firstError":"提现 6036：Unknown column"}}`))
		default:
			t.Fatalf("path = %q", r.URL.Path)
		}
	}))
	defer server.Close()

	viper.Set(barryInnerPrefixPath, server.URL)
	viper.Set(barryInnerReconLedgerListPath, "/reconciliation/ledger/list")
	viper.Set(barryInnerReconLedgerSavePath, "/reconciliation/ledger/save")
	viper.Set(barryInnerReconLedgerDeletePath, "/reconciliation/ledger/delete")
	viper.Set(barryInnerReconLedgerSyncWithdrawPath, "/reconciliation/ledger/sync-withdraw")
	defer viper.Reset()

	service := NewReconciliationService(&Client{timeout: time.Second})
	ctx := context.Background()
	page, err := service.ListLedger(ctx, barryDTO.ReconLedgerQueryDTO{StartDate: "2026-10-01", EndDate: "2026-10-03", Category: "MANUAL_SETTLE,PAYOUT_FEE", SortField: "user", SortOrder: "asc", Page: 2})
	if err != nil || page.Total != 1 || *page.Data[0].AmountU != 20 || page.Data[0].Editable || page.Data[0].Username != "u8" {
		t.Fatalf("unexpected list %+v err %v", page, err)
	}

	amount, channel := 100.0, int64(1)
	_, err = service.SaveLedger(ctx, &barryDTO.ReconLedgerDTO{RecordDate: "2026-10-02", Category: "COMMUNITY_IN", Currency: "RMB", Amount: &amount, SettleChannelID: &channel}, "alice")
	if err == nil || err.Error() != "结算通道不存在" {
		t.Fatalf("expected barry error, got %v", err)
	}
	if err := service.DeleteLedger(ctx, 9, ""); err != nil {
		t.Fatalf("delete error = %v", err)
	}
	if result, err := service.SyncWithdraw(ctx, "2026-10-01", "2026-10-03"); err != nil || result.WithdrawCount != 11 || result.Failed != 11 || result.FirstError == "" {
		t.Fatalf("sync = %+v err %v", result, err)
	}
}

func TestReconciliationServiceLedgerSnapshots(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/reconciliation/ledger/snapshots" || r.URL.Query().Get("ledgerId") != "9" {
			t.Fatalf("path = %q query = %q", r.URL.Path, r.URL.RawQuery)
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"code":"0","data":[` +
			`{"id":1,"ledgerId":9,"version":1,"action":"ORIGINAL","ledgerActive":true,"operator":"alice","snapshotTime":"2026-10-08 10:00:00","recordDate":"2026-10-08","category":"MANUAL_SETTLE","categoryName":"人工出款","currency":"RMB","amountRmb":195122},` +
			`{"id":2,"ledgerId":9,"version":2,"action":"UPDATE","ledgerActive":true,"operator":"bob","snapshotTime":"2026-10-09 11:00:00","recordDate":"2026-10-08","category":"MANUAL_SETTLE","categoryName":"人工出款","currency":"RMB","amountRmb":195000,"remark":"整体出款"}]}`))
	}))
	defer server.Close()
	viper.Set(barryInnerPrefixPath, server.URL)
	viper.Set(barryInnerReconLedgerSnapshotsPath, "/reconciliation/ledger/snapshots")
	defer viper.Reset()

	service := NewReconciliationService(&Client{timeout: time.Second})
	result, err := service.LedgerSnapshots(context.Background(), 9)
	if err != nil || len(result) != 2 || result[0].Action != "ORIGINAL" || result[1].Version != 2 ||
		*result[1].AmountRmb != 195000 || result[1].Operator != "bob" || result[1].SnapshotTime != "2026-10-09 11:00:00" {
		t.Fatalf("snapshots = %+v err %v", result, err)
	}
}

func TestReconciliationServiceUpstreamSums(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		body, _ := io.ReadAll(r.Body)
		if r.URL.Path != "/reconciliation/ledger/upstream-sums" || !strings.Contains(string(body), `"upstreamUserId":"12"`) {
			t.Fatalf("path = %q body = %s", r.URL.Path, body)
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"code":"0","data":[{"key":"12:period","upstreamUserId":"12","startDate":"2026-09-01","endDate":"2026-09-07","incomeRmb":1000,"collectFeeRmb":45}]}`))
	}))
	defer server.Close()
	viper.Set(barryInnerPrefixPath, server.URL)
	viper.Set(barryInnerReconLedgerUpstreamSumsPath, "/reconciliation/ledger/upstream-sums")
	defer viper.Reset()

	service := NewReconciliationService(&Client{timeout: time.Second})
	result, err := service.UpstreamSums(context.Background(), []barryDTO.ReconUpstreamSumDTO{
		{Key: "12:period", UpstreamUserID: "12", StartDate: "2026-09-01", EndDate: "2026-09-07"},
	})
	if err != nil || len(result) != 1 || result[0].IncomeRmb != 1000 || result[0].CollectFeeRmb != 45 {
		t.Fatalf("unexpected %+v %v", result, err)
	}
	if empty, err := service.UpstreamSums(context.Background(), nil); err != nil || len(empty) != 0 {
		t.Fatalf("empty windows should not call barry: %+v %v", empty, err)
	}
}

func TestReconciliationServiceLedgerDaily(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/reconciliation/ledger/daily" || r.URL.Query().Get("startDate") != "2026-10-01" || r.URL.Query().Get("endDate") != "2026-10-02" {
			t.Fatalf("path = %q query = %q", r.URL.Path, r.URL.RawQuery)
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"code":"0","data":[{"date":"2026-10-01","inRmb":720,"outRmb":306,"netRmb":414,"count":5},{"date":"2026-10-02","inRmb":0,"outRmb":0,"netRmb":0,"count":0}]}`))
	}))
	defer server.Close()
	viper.Set(barryInnerPrefixPath, server.URL)
	viper.Set(barryInnerReconLedgerDailyPath, "/reconciliation/ledger/daily")
	defer viper.Reset()

	service := NewReconciliationService(&Client{timeout: time.Second})
	result, err := service.LedgerDaily(context.Background(), "2026-10-01", "2026-10-02")
	if err != nil || len(result) != 2 || result[0].NetRmb != 414 || result[1].Date != "2026-10-02" {
		t.Fatalf("unexpected %+v %v", result, err)
	}
}

func TestReconciliationServiceFindIncomeWithFee(t *testing.T) {
	// 第 1 页满 100 条(含入账 7), 手续费在第 2 页: 要翻到第 2 页才算找全
	firstPage := make([]string, 0, 100)
	firstPage = append(firstPage, `{"id":7,"recordDate":"2026-10-08","category":"COMMUNITY_IN","currency":"RMB","amountRmb":1000,"upstreamUserId":"12"}`)
	for i := 1; i < 100; i++ {
		firstPage = append(firstPage, `{"id":`+strconv.Itoa(100+i)+`,"recordDate":"2026-10-08","category":"COMMUNITY_IN","currency":"RMB","amountRmb":1}`)
	}
	pages := 0
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		q := r.URL.Query()
		if q.Get("startDate") != "2026-10-08" || q.Get("endDate") != "2026-10-08" || q.Get("category") != "COMMUNITY_IN,COLLECT_FEE" || q.Get("pageSize") != "100" {
			t.Fatalf("list query = %v", q)
		}
		pages++
		w.Header().Set("Content-Type", "application/json")
		switch q.Get("page") {
		case "1":
			_, _ = w.Write([]byte(`{"code":"0","data":{"total":101,"data":[` + strings.Join(firstPage, ",") + `]}}`))
		case "2":
			_, _ = w.Write([]byte(`{"code":"0","data":{"total":101,"data":[{"id":8,"recordDate":"2026-10-08","category":"COLLECT_FEE","parentId":7,"currency":"RMB","amountRmb":6.5}]}}`))
		default:
			t.Fatalf("page = %q", q.Get("page"))
		}
	}))
	defer server.Close()
	viper.Set(barryInnerPrefixPath, server.URL)
	viper.Set(barryInnerReconLedgerListPath, "/reconciliation/ledger/list")
	defer viper.Reset()

	service := NewReconciliationService(&Client{timeout: time.Second})
	income, fee, err := service.FindIncomeWithFee(context.Background(), 7, "2026-10-08")
	if err != nil || income == nil || income.UpstreamUserID != "12" || fee == nil || *fee.AmountRmb != 6.5 || pages != 2 {
		t.Fatalf("income = %+v fee = %+v pages = %d err %v", income, fee, pages, err)
	}

	pages = 0
	income, fee, err = service.FindIncomeWithFee(context.Background(), 99, "2026-10-08")
	if err != nil || income != nil || fee != nil || pages != 2 {
		t.Fatalf("missing ledger: income = %+v fee = %+v pages = %d err %v", income, fee, pages, err)
	}
}
