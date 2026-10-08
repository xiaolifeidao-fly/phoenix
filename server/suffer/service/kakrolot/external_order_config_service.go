package kakrolot

import (
	baseDTO "common/base/dto"
	"context"
	"encoding/json"
	"fmt"
	"net/url"
	"strconv"
	"strings"
	"time"
)

const externalOrderConfigBasePath = "/externalOrderConfig"

// ExternalOrderConfigService 上游社区配置（kakrolot external_order_config），数据与同步统计都在 kakrolot，这里只做转发。
type ExternalOrderConfigService struct {
	client *Client
}

func NewExternalOrderConfigService(client *Client) *ExternalOrderConfigService {
	return &ExternalOrderConfigService{client: client}
}

type ExternalOrderConfigQueryDTO struct {
	PageIndex int    `form:"pageIndex"`
	PageSize  int    `form:"pageSize"`
	Channel   string `form:"channel"`
	// Active 为空表示不过滤；用字符串接收，避免 gin 把缺省值绑定成 false。
	Active string `form:"active"`
}

type UpdateExternalOrderConfigDTO struct {
	PrefixURL string `json:"prefixUrl"`
}

// ExternalOrderConfigDTO 上游社区配置，sync* 为「上一个完整分钟」的同步统计，无样本时为 null。
type ExternalOrderConfigDTO struct {
	ID                 uint64     `json:"id"`
	Channel            string     `json:"channel"`
	PrefixURL          string     `json:"prefixUrl"`
	PrefixURLAvailable *bool      `json:"prefixUrlAvailable"`
	Active             bool       `json:"active"`
	CreateBy           string     `json:"createBy"`
	UpdateBy           string     `json:"updateBy"`
	CreatedAt          *time.Time `json:"createdAt"`
	UpdatedAt          *time.Time `json:"updatedAt"`
	SyncOK             *int64     `json:"syncOk"`
	SyncFailNet        *int64     `json:"syncFailNet"`
	SyncFailAuth       *int64     `json:"syncFailAuth"`
	SyncFailBiz        *int64     `json:"syncFailBiz"`
	SyncOKAvgMs        *int64     `json:"syncOkAvgMs"`
	SyncFailAvgMs      *int64     `json:"syncFailAvgMs"`
	SyncOKP95          string     `json:"syncOkP95"`
	SyncQueueDepth     *int       `json:"syncQueueDepth"`
}

type legacyExternalOrderConfig struct {
	ID                 uint64     `json:"id"`
	Channel            string     `json:"channel"`
	PrefixURL          string     `json:"prefixUrl"`
	PrefixURLAvailable *bool      `json:"prefixUrlAvailable"`
	Active             *bool      `json:"active"`
	CreateBy           string     `json:"createBy"`
	UpdateBy           string     `json:"updateBy"`
	CreateTime         legacyTime `json:"createTime"`
	UpdateTime         legacyTime `json:"updateTime"`
	SyncOK             *int64     `json:"syncOk"`
	SyncFailNet        *int64     `json:"syncFailNet"`
	SyncFailAuth       *int64     `json:"syncFailAuth"`
	SyncFailBiz        *int64     `json:"syncFailBiz"`
	SyncOKAvgMs        *int64     `json:"syncOkAvgMs"`
	SyncFailAvgMs      *int64     `json:"syncFailAvgMs"`
	SyncOKP95          string     `json:"syncOkP95"`
	SyncQueueDepth     *int       `json:"syncQueueDepth"`
}

func (item *legacyExternalOrderConfig) toDTO() *ExternalOrderConfigDTO {
	return &ExternalOrderConfigDTO{
		ID: item.ID, Channel: item.Channel, PrefixURL: item.PrefixURL, PrefixURLAvailable: item.PrefixURLAvailable,
		Active: item.Active != nil && *item.Active, CreateBy: item.CreateBy, UpdateBy: item.UpdateBy,
		CreatedAt: item.CreateTime.Pointer(), UpdatedAt: item.UpdateTime.Pointer(),
		SyncOK: item.SyncOK, SyncFailNet: item.SyncFailNet, SyncFailAuth: item.SyncFailAuth, SyncFailBiz: item.SyncFailBiz,
		SyncOKAvgMs: item.SyncOKAvgMs, SyncFailAvgMs: item.SyncFailAvgMs, SyncOKP95: item.SyncOKP95,
		SyncQueueDepth: item.SyncQueueDepth,
	}
}

func (s *ExternalOrderConfigService) List(ctx context.Context, query ExternalOrderConfigQueryDTO, token string) (*baseDTO.PageDTO[ExternalOrderConfigDTO], error) {
	pageIndex, pageSize := normalizeLegacyPage(query.PageIndex, query.PageSize)
	params := url.Values{}
	params.Set("page", strconv.Itoa(pageIndex))
	params.Set("limit", strconv.Itoa(pageSize))
	if channel := strings.TrimSpace(query.Channel); channel != "" {
		params.Set("channel", channel)
	}
	switch strings.TrimSpace(query.Active) {
	case "true", "1":
		params.Set("active", "true")
	case "false", "0":
		params.Set("active", "false")
	}
	response, err := s.client.Get(ctx, externalOrderConfigBasePath+"/list?"+params.Encode(), token)
	if err := validateLegacyResponse(response, err); err != nil {
		return nil, err
	}
	page := &legacyPage[legacyExternalOrderConfig]{}
	if len(response.Data) > 0 && string(response.Data) != "null" {
		if err := json.Unmarshal(response.Data, page); err != nil {
			return nil, fmt.Errorf("kakrolot external order config response decode failed: %w", err)
		}
	}
	items := make([]*ExternalOrderConfigDTO, 0, len(page.Items))
	for _, item := range page.Items {
		if item != nil {
			items = append(items, item.toDTO())
		}
	}
	return baseDTO.BuildPage(int(page.Total), items), nil
}

func (s *ExternalOrderConfigService) UpdatePrefixURL(ctx context.Context, id uint64, req UpdateExternalOrderConfigDTO, token string) (string, error) {
	prefixURL := strings.TrimSpace(req.PrefixURL)
	if prefixURL == "" {
		return "", fmt.Errorf("prefixUrl 不能为空")
	}
	return s.post(ctx, id, "update", UpdateExternalOrderConfigDTO{PrefixURL: prefixURL}, token)
}

func (s *ExternalOrderConfigService) Disable(ctx context.Context, id uint64, token string) (string, error) {
	return s.post(ctx, id, "disable", nil, token)
}

func (s *ExternalOrderConfigService) Enable(ctx context.Context, id uint64, token string) (string, error) {
	return s.post(ctx, id, "enable", nil, token)
}

func (s *ExternalOrderConfigService) post(ctx context.Context, id uint64, action string, body any, token string) (string, error) {
	if id == 0 {
		return "", fmt.Errorf("id 不能为空")
	}
	path := externalOrderConfigBasePath + "/" + strconv.FormatUint(id, 10) + "/" + action
	response, err := s.client.Post(ctx, path, body, token)
	if err := validateLegacyResponse(response, err); err != nil {
		return "", err
	}
	return legacyResultMessage(response), nil
}

// legacyResultMessage kakrolot 成功时把提示放在 data（字符串）里，message 通常为空。
func legacyResultMessage(response *ResponseDTO) string {
	if message := strings.TrimSpace(response.Message); message != "" {
		return message
	}
	var data string
	if len(response.Data) > 0 && json.Unmarshal(response.Data, &data) == nil {
		return strings.TrimSpace(data)
	}
	return ""
}
