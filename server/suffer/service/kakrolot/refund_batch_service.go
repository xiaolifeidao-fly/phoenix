package kakrolot

import (
	baseDTO "common/base/dto"
	"context"
	"encoding/json"
	"fmt"
	"net/url"
	"strconv"
	"strings"
	orderDTO "suffer/service/order/dto"
	"time"
)

const (
	refundBatchBasePath       = "/refund/batch"
	refundBatchLookupPageSize = 500
)

type RefundBatchService struct {
	client *Client
}

func NewRefundBatchService(client *Client) *RefundBatchService {
	return &RefundBatchService{client: client}
}

func (s *RefundBatchService) ListTasks(ctx context.Context, query orderDTO.RefundBatchTaskQueryDTO, token string) (*baseDTO.PageDTO[orderDTO.RefundBatchTaskDTO], error) {
	if query.TaskID > 0 {
		return s.findTaskByID(ctx, query.TaskID, token)
	}
	pageIndex, pageSize := normalizeLegacyPage(query.PageIndex, query.PageSize)
	page, err := s.fetchTaskPage(ctx, strings.TrimSpace(query.TaskStatus), pageIndex, pageSize, token)
	if err != nil {
		return nil, err
	}
	items := make([]*orderDTO.RefundBatchTaskDTO, 0, len(page.Items))
	for _, item := range page.Items {
		items = append(items, item.toDTO())
	}
	return baseDTO.BuildPage(int(page.Total), items), nil
}

func (s *RefundBatchService) findTaskByID(ctx context.Context, taskID uint64, token string) (*baseDTO.PageDTO[orderDTO.RefundBatchTaskDTO], error) {
	processingPage, err := s.fetchTaskPage(ctx, "PROCESSING", 1, 100, token)
	if err != nil {
		return nil, err
	}
	if item := findLegacyTask(processingPage.Items, taskID); item != nil {
		return baseDTO.BuildPage(1, []*orderDTO.RefundBatchTaskDTO{item.toDTO()}), nil
	}
	firstPage, err := s.fetchTaskPage(ctx, "", 1, 1, token)
	if err != nil {
		return nil, err
	}
	if len(firstPage.Items) == 0 || taskID > firstPage.Items[0].ID {
		return baseDTO.BuildPage(0, []*orderDTO.RefundBatchTaskDTO{}), nil
	}
	pageCount := (int(firstPage.Total) + refundBatchLookupPageSize - 1) / refundBatchLookupPageSize
	lowPage, highPage := 1, pageCount
	for lowPage <= highPage {
		pageIndex := lowPage + (highPage-lowPage)/2
		page, pageErr := s.fetchTaskPage(ctx, "", pageIndex, refundBatchLookupPageSize, token)
		if pageErr != nil {
			return nil, pageErr
		}
		if item := findLegacyTask(page.Items, taskID); item != nil {
			return baseDTO.BuildPage(1, []*orderDTO.RefundBatchTaskDTO{item.toDTO()}), nil
		}
		if len(page.Items) == 0 {
			return baseDTO.BuildPage(0, []*orderDTO.RefundBatchTaskDTO{}), nil
		}
		firstID := page.Items[0].ID
		lastID := page.Items[len(page.Items)-1].ID
		switch {
		case taskID > firstID:
			highPage = pageIndex - 1
		case taskID < lastID:
			lowPage = pageIndex + 1
		default:
			return baseDTO.BuildPage(0, []*orderDTO.RefundBatchTaskDTO{}), nil
		}
	}
	return baseDTO.BuildPage(0, []*orderDTO.RefundBatchTaskDTO{}), nil
}

func (s *RefundBatchService) fetchTaskPage(ctx context.Context, status string, pageIndex, limit int, token string) (*legacyPage[legacyRefundBatchTask], error) {
	params := url.Values{}
	params.Set("page", strconv.Itoa(pageIndex))
	params.Set("limit", strconv.Itoa(limit))
	if status != "" {
		params.Set("taskStatus", status)
	}
	response, err := s.client.Get(ctx, refundBatchBasePath+"/tasks?"+params.Encode(), token)
	if err := validateLegacyResponse(response, err); err != nil {
		return nil, err
	}
	page := &legacyPage[legacyRefundBatchTask]{}
	if err := json.Unmarshal(response.Data, page); err != nil {
		return nil, fmt.Errorf("kakrolot batch task response decode failed: %w", err)
	}
	return page, nil
}

func (s *RefundBatchService) Import(ctx context.Context, req orderDTO.CreateRefundBatchDTO, token string) (string, error) {
	response, err := s.client.Post(ctx, refundBatchBasePath+"/import", req, token)
	if err := validateLegacyResponse(response, err); err != nil {
		return "", err
	}
	return response.Message, nil
}

func (s *RefundBatchService) Execute(ctx context.Context, taskID uint64, token string) (string, error) {
	if taskID == 0 {
		return "", fmt.Errorf("任务 ID 无效")
	}
	response, err := s.client.Post(ctx, refundBatchBasePath+"/tasks/"+strconv.FormatUint(taskID, 10)+"/execute", nil, token)
	if err := validateLegacyResponse(response, err); err != nil {
		return "", err
	}
	return response.Message, nil
}

func (s *RefundBatchService) ListDetails(ctx context.Context, query orderDTO.RefundBatchDetailQueryDTO, token string) (*baseDTO.PageDTO[orderDTO.RefundBatchDetailDTO], error) {
	pageIndex, pageSize := normalizeLegacyPage(query.PageIndex, query.PageSize)
	params := url.Values{}
	params.Set("page", strconv.Itoa(pageIndex))
	params.Set("limit", strconv.Itoa(pageSize))
	if query.TaskID > 0 {
		params.Set("taskId", strconv.FormatUint(query.TaskID, 10))
	}
	if query.OrderRecordID > 0 {
		params.Set("orderRecordId", strconv.FormatUint(query.OrderRecordID, 10))
	}
	if tinyURL := strings.TrimSpace(query.TinyURL); tinyURL != "" {
		params.Set("tinyUrl", tinyURL)
	}
	response, err := s.client.Get(ctx, refundBatchBasePath+"/details?"+params.Encode(), token)
	if err := validateLegacyResponse(response, err); err != nil {
		return nil, err
	}
	page := &legacyPage[legacyRefundBatchDetail]{}
	if err := json.Unmarshal(response.Data, page); err != nil {
		return nil, fmt.Errorf("kakrolot batch detail response decode failed: %w", err)
	}
	items := make([]*orderDTO.RefundBatchDetailDTO, 0, len(page.Items))
	for _, item := range page.Items {
		items = append(items, item.toDTO())
	}
	return baseDTO.BuildPage(int(page.Total), items), nil
}

func validateLegacyResponse(response *ResponseDTO, err error) error {
	if err != nil {
		return err
	}
	if response == nil {
		return fmt.Errorf("kakrolot response is empty")
	}
	if !response.IsSuccess() {
		return fmt.Errorf("%s", response.ErrorMessage())
	}
	return nil
}

func normalizeLegacyPage(pageIndex, pageSize int) (int, int) {
	if pageIndex <= 0 {
		pageIndex = 1
	}
	if pageSize <= 0 {
		pageSize = 20
	}
	if pageSize > 5000 {
		pageSize = 5000
	}
	return pageIndex, pageSize
}

func findLegacyTask(items []*legacyRefundBatchTask, taskID uint64) *legacyRefundBatchTask {
	for _, item := range items {
		if item != nil && item.ID == taskID {
			return item
		}
	}
	return nil
}

type legacyPage[T any] struct {
	Total int64 `json:"total"`
	Items []*T  `json:"items"`
}

type legacyRefundBatchTask struct {
	ID             uint64     `json:"id"`
	TaskName       string     `json:"taskName"`
	TotalCount     int        `json:"totalCount"`
	SuccessCount   int        `json:"successCount"`
	FailCount      int        `json:"failCount"`
	PendingCount   int        `json:"pendingCount"`
	TaskStatus     string     `json:"taskStatus"`
	TaskStatusDesc string     `json:"taskStatusDesc"`
	UploadFileName string     `json:"uploadFileName"`
	CreatedAt      legacyTime `json:"createdAt"`
	UpdatedAt      legacyTime `json:"updatedAt"`
	CreateTime     legacyTime `json:"createTime"`
	UpdateTime     legacyTime `json:"updateTime"`
}

func (item *legacyRefundBatchTask) toDTO() *orderDTO.RefundBatchTaskDTO {
	createdAt := item.CreatedAt.Time
	if createdAt.IsZero() {
		createdAt = item.CreateTime.Time
	}
	updatedAt := item.UpdatedAt.Time
	if updatedAt.IsZero() {
		updatedAt = item.UpdateTime.Time
	}
	return &orderDTO.RefundBatchTaskDTO{
		ID: item.ID, TaskName: item.TaskName, TotalCount: item.TotalCount,
		SuccessCount: item.SuccessCount, FailCount: item.FailCount, PendingCount: item.PendingCount,
		TaskStatus: item.TaskStatus, TaskStatusDesc: legacyBatchStatusDesc(item.TaskStatus, item.TaskStatusDesc),
		UploadFileName: item.UploadFileName, CreatedAt: createdAt, UpdatedAt: updatedAt,
	}
}

type legacyRefundBatchDetail struct {
	ID               uint64     `json:"id"`
	TaskID           uint64     `json:"taskId"`
	TinyURL          string     `json:"tinyUrl"`
	OrderRecordID    uint64     `json:"orderRecordId"`
	OrderCreateTime  legacyTime `json:"orderCreateTime"`
	InitNum          uint64     `json:"initNum"`
	EndNum           uint64     `json:"endNum"`
	FactEndNum       uint64     `json:"factEndNum"`
	OrderNum         int64      `json:"orderNum"`
	ActualQuantity   uint64     `json:"actualQuantity"`
	RGApproveNum     uint64     `json:"rgApproveNum"`
	RGUnApproveNum   uint64     `json:"rgUnApproveNum"`
	BkNum            uint64     `json:"bkNum"`
	DetailStatus     string     `json:"detailStatus"`
	DetailStatusDesc string     `json:"detailStatusDesc"`
	ErrorReason      string     `json:"errorReason"`
	ProcessedAt      legacyTime `json:"processedAt"`
	CreatedAt        legacyTime `json:"createdAt"`
	UpdatedAt        legacyTime `json:"updatedAt"`
	CreateTime       legacyTime `json:"createTime"`
	UpdateTime       legacyTime `json:"updateTime"`
}

func (item *legacyRefundBatchDetail) toDTO() *orderDTO.RefundBatchDetailDTO {
	createdAt := item.CreatedAt.Time
	if createdAt.IsZero() {
		createdAt = item.CreateTime.Time
	}
	updatedAt := item.UpdatedAt.Time
	if updatedAt.IsZero() {
		updatedAt = item.UpdateTime.Time
	}
	return &orderDTO.RefundBatchDetailDTO{
		ID: item.ID, TaskID: item.TaskID, TinyURL: item.TinyURL, OrderRecordID: item.OrderRecordID,
		OrderCreateTime: item.OrderCreateTime.Pointer(), InitNum: item.InitNum, EndNum: item.EndNum,
		FactEndNum: item.FactEndNum, OrderNum: item.OrderNum, ActualQuantity: item.ActualQuantity,
		RGApproveNum: item.RGApproveNum, RGUnApproveNum: item.RGUnApproveNum, BkNum: item.BkNum,
		DetailStatus: item.DetailStatus, DetailStatusDesc: legacyBatchStatusDesc(item.DetailStatus, item.DetailStatusDesc),
		ErrorReason: item.ErrorReason, ProcessedAt: item.ProcessedAt.Pointer(), CreatedAt: createdAt, UpdatedAt: updatedAt,
	}
}

func legacyBatchStatusDesc(status, description string) string {
	if strings.TrimSpace(description) != "" {
		return description
	}
	return map[string]string{
		"PENDING": "待处理", "PROCESSING": "处理中", "COMPLETED": "已完成",
		"FAILED": "失败", "SUCCESS": "成功",
	}[status]
}

type legacyTime struct {
	time.Time
}

func (value *legacyTime) UnmarshalJSON(data []byte) error {
	if string(data) == "null" || len(data) == 0 {
		return nil
	}
	var milliseconds int64
	if json.Unmarshal(data, &milliseconds) == nil {
		value.Time = time.UnixMilli(milliseconds)
		return nil
	}
	var text string
	if err := json.Unmarshal(data, &text); err != nil {
		return err
	}
	for _, layout := range []string{
		time.RFC3339Nano,
		"2006-01-02T15:04:05.999999999-0700",
		"2006-01-02T15:04:05-0700",
		"2006-01-02 15:04:05",
	} {
		parsed, err := time.Parse(layout, text)
		if err == nil {
			value.Time = parsed
			return nil
		}
	}
	return fmt.Errorf("unsupported kakrolot time %q", text)
}

func (value legacyTime) Pointer() *time.Time {
	if value.Time.IsZero() {
		return nil
	}
	result := value.Time
	return &result
}
