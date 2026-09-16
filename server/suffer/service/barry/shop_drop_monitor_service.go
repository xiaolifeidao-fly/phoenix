package barry

import (
	"context"
	"fmt"

	barryDTO "suffer/service/barry/dto"
)

// ShopDropMonitorService 掉量监控数据: 不管有没有开自动补单都能看到掉量情况.
type ShopDropMonitorService struct {
	client *Client
}

func NewShopDropMonitorService(client *Client) *ShopDropMonitorService {
	return &ShopDropMonitorService{client: client}
}

func (s *ShopDropMonitorService) Summary(ctx context.Context, query barryDTO.ShopDropMonitorQueryDTO) (*barryDTO.ShopDropMonitorSummaryDTO, error) {
	response := &barryDTO.DetailResponseDTO[barryDTO.ShopDropMonitorSummaryDTO]{}
	err := s.client.GetAbsolute(ctx, innerServicePath(barryInnerShopDropMonitorSummaryPath), buildValues(
		"startDate", query.StartDate,
		"endDate", query.EndDate,
		"shopCategoryIds", query.ShopCategoryIDs,
	), response)
	if err != nil {
		return nil, err
	}
	if !response.Success || response.Data == nil {
		return nil, responseError(response.Message, "barry drop monitor summary response is empty")
	}
	return response.Data, nil
}

func (s *ShopDropMonitorService) Query(ctx context.Context, query barryDTO.ShopDropMonitorQueryDTO) (*barryDTO.ShopDropMonitorPageDTO, error) {
	response := &barryDTO.DetailResponseDTO[barryDTO.ShopDropMonitorPageDTO]{}
	err := s.client.GetAbsolute(ctx, innerServicePath(barryInnerShopDropMonitorQueryPath), buildValues(
		"startDate", query.StartDate,
		"endDate", query.EndDate,
		"shopCategoryIds", query.ShopCategoryIDs,
		"oriShopId", query.OriShopID,
		"businessId", query.BusinessID,
		"status", query.Status,
		"onlyDropped", query.OnlyDropped,
		"pageIndex", query.PageIndex,
		"pageSize", query.PageSize,
	), response)
	if err != nil {
		return nil, err
	}
	if !response.Success || response.Data == nil {
		return nil, responseError(response.Message, "barry drop monitor query response is empty")
	}
	return response.Data, nil
}

// Records 某一单的逐次检测明细.
func (s *ShopDropMonitorService) Records(ctx context.Context, monitorID int64) ([]*barryDTO.ShopDropMonitorRecordDTO, error) {
	if monitorID <= 0 {
		return nil, fmt.Errorf("monitorId is required")
	}
	path := innerServicePath(barryInnerShopDropMonitorRecordPath)
	if path == "" {
		return nil, fmt.Errorf("barry drop monitor record path is not configured")
	}
	response := &barryDTO.ListResponseDTO[barryDTO.ShopDropMonitorRecordDTO]{}
	err := s.client.GetAbsolute(ctx, fmt.Sprintf("%s/%d/records", path, monitorID), nil, response)
	if err != nil {
		return nil, err
	}
	return response.Data, nil
}

// Runtime 运行健康度.
func (s *ShopDropMonitorService) Runtime(ctx context.Context) (*barryDTO.ShopDropMonitorRuntimeDTO, error) {
	response := &barryDTO.DetailResponseDTO[barryDTO.ShopDropMonitorRuntimeDTO]{}
	err := s.client.GetAbsolute(ctx, innerServicePath(barryInnerShopDropMonitorRuntimePath), nil, response)
	if err != nil {
		return nil, err
	}
	if !response.Success || response.Data == nil {
		return nil, responseError(response.Message, "barry drop monitor runtime response is empty")
	}
	return response.Data, nil
}

// JobRecords 定时任务运行流水.
func (s *ShopDropMonitorService) JobRecords(ctx context.Context, query barryDTO.ShopDropMonitorJobRecordQueryDTO) (*barryDTO.ShopDropMonitorJobRecordPageDTO, error) {
	response := &barryDTO.DetailResponseDTO[barryDTO.ShopDropMonitorJobRecordPageDTO]{}
	err := s.client.GetAbsolute(ctx, innerServicePath(barryInnerShopDropMonitorJobPath), buildValues(
		"startDate", query.StartDate,
		"endDate", query.EndDate,
		"pageIndex", query.PageIndex,
		"pageSize", query.PageSize,
	), response)
	if err != nil {
		return nil, err
	}
	if !response.Success || response.Data == nil {
		return nil, responseError(response.Message, "barry drop monitor job record response is empty")
	}
	return response.Data, nil
}
