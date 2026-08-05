package kakrolot

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strconv"
	orderDTO "suffer/service/order/dto"
	"testing"
	"time"
)

func TestRefundBatchServiceProxiesLegacyAPI(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if token := r.Header.Get("X-Token"); token != "manager-token" {
			t.Fatalf("X-Token = %q", token)
		}
		w.Header().Set("Content-Type", "application/json")
		switch r.URL.Path {
		case "/refund/batch/tasks":
			if r.Method != http.MethodGet {
				t.Fatalf("tasks method = %s", r.Method)
			}
			if status := r.URL.Query().Get("taskStatus"); status == "PROCESSING" {
				_, _ = w.Write([]byte(`{"code":"0","data":{"total":1,"items":[{"id":42,"taskName":"运行中任务","totalCount":2,"successCount":1,"pendingCount":1,"taskStatus":"PROCESSING","createTime":1722816000000}]}}`))
				return
			}
			if r.URL.Query().Get("page") == "1" {
				_, _ = w.Write([]byte(`{"code":"0","data":{"total":0,"items":[]}}`))
				return
			}
			if r.URL.Query().Get("page") != "2" || r.URL.Query().Get("limit") != "20" {
				t.Fatalf("tasks query = %s", r.URL.RawQuery)
			}
			_, _ = w.Write([]byte(`{"code":"0","data":{"total":1,"items":[{"id":7,"taskName":"历史任务","totalCount":1,"successCount":1,"taskStatus":"COMPLETED"}]}}`))
		case "/refund/batch/details":
			if r.Method != http.MethodGet || r.URL.Query().Get("page") != "2" || r.URL.Query().Get("taskId") != "7" {
				t.Fatalf("details request = %s %s", r.Method, r.URL.String())
			}
			_, _ = w.Write([]byte(`{"code":"0","data":{"total":1,"items":[{"id":8,"taskId":7,"tinyUrl":"https://t/1","detailStatus":"SUCCESS","processedAt":1722816000000}]}}`))
		case "/refund/batch/import":
			var body orderDTO.CreateRefundBatchDTO
			if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.TaskName != "任务A" || body.TinyURLs != "url-1" {
				t.Fatalf("import body = %#v, err=%v", body, err)
			}
			_, _ = w.Write([]byte(`{"code":"0","message":"导入成功，任务ID：9，共1条记录"}`))
		case "/refund/batch/tasks/9/execute":
			if r.Method != http.MethodPost {
				t.Fatalf("execute method = %s", r.Method)
			}
			_, _ = w.Write([]byte(`{"code":"0","message":"任务已开始执行"}`))
		default:
			http.NotFound(w, r)
		}
	}))
	defer server.Close()

	service := NewRefundBatchService(&Client{baseURL: server.URL, timeout: time.Second})
	ctx := context.Background()

	tasks, err := service.ListTasks(ctx, orderDTO.RefundBatchTaskQueryDTO{PageIndex: 2, PageSize: 20}, "manager-token")
	if err != nil || tasks.Total != 1 || len(tasks.Data) != 1 || tasks.Data[0].ID != 7 {
		t.Fatalf("tasks = %#v, err=%v", tasks, err)
	}
	firstPage, err := service.ListTasks(ctx, orderDTO.RefundBatchTaskQueryDTO{}, "manager-token")
	if err != nil || firstPage.Total != 0 {
		t.Fatalf("first page = %#v, err=%v", firstPage, err)
	}
	focused, err := service.ListTasks(ctx, orderDTO.RefundBatchTaskQueryDTO{TaskID: 42}, "manager-token")
	if err != nil || focused.Total != 1 || focused.Data[0].TaskStatus != "PROCESSING" {
		t.Fatalf("focused task = %#v, err=%v", focused, err)
	}
	details, err := service.ListDetails(ctx, orderDTO.RefundBatchDetailQueryDTO{PageIndex: 2, PageSize: 20, TaskID: 7}, "manager-token")
	if err != nil || details.Total != 1 || details.Data[0].DetailStatusDesc != "成功" {
		t.Fatalf("details = %#v, err=%v", details, err)
	}
	if message, err := service.Import(ctx, orderDTO.CreateRefundBatchDTO{TaskName: "任务A", TinyURLs: "url-1"}, "manager-token"); err != nil || message == "" {
		t.Fatalf("import message=%q err=%v", message, err)
	}
	if message, err := service.Execute(ctx, 9, "manager-token"); err != nil || message != "任务已开始执行" {
		t.Fatalf("execute message=%q err=%v", message, err)
	}
}

func TestRefundBatchServiceFindsHistoricalTaskThroughLegacyPages(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		if r.URL.Query().Get("taskStatus") == "PROCESSING" {
			_, _ = w.Write([]byte(`{"code":"0","data":{"total":0,"items":[]}}`))
			return
		}
		pageIndex, _ := strconv.Atoi(r.URL.Query().Get("page"))
		limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
		offset := (pageIndex - 1) * limit
		items := make([]map[string]any, 0, limit)
		for index := offset; index < offset+limit && index < 1200; index++ {
			items = append(items, map[string]any{"id": 1200 - index, "taskStatus": "COMPLETED"})
		}
		_ = json.NewEncoder(w).Encode(map[string]any{
			"code": "0",
			"data": map[string]any{"total": 1200, "items": items},
		})
	}))
	defer server.Close()

	service := NewRefundBatchService(&Client{baseURL: server.URL, timeout: time.Second})
	result, err := service.ListTasks(context.Background(), orderDTO.RefundBatchTaskQueryDTO{TaskID: 137}, "token")
	if err != nil || result.Total != 1 || len(result.Data) != 1 || result.Data[0].ID != 137 {
		t.Fatalf("result=%#v err=%v", result, err)
	}
}

func TestLegacyTimeSupportsJavaTimezone(t *testing.T) {
	var value legacyTime
	if err := json.Unmarshal([]byte(`"2026-08-05T02:26:00.000+0000"`), &value); err != nil {
		t.Fatal(err)
	}
	if got := value.UTC().Format(time.RFC3339); got != "2026-08-05T02:26:00Z" {
		t.Fatalf("parsed time = %s", got)
	}
}
