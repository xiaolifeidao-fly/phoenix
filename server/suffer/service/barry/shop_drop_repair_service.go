package barry

import (
	"context"

	barryDTO "suffer/service/barry/dto"
)

// ShopDropRepairService 掉量补单数据: 概览与明细, 支持按人工商品筛选.
type ShopDropRepairService struct {
	client *Client
}

func NewShopDropRepairService(client *Client) *ShopDropRepairService {
	return &ShopDropRepairService{client: client}
}

func (s *ShopDropRepairService) Summary(ctx context.Context, query barryDTO.ShopDropRepairQueryDTO) (*barryDTO.ShopDropRepairSummaryDTO, error) {
	response := &barryDTO.DetailResponseDTO[barryDTO.ShopDropRepairSummaryDTO]{}
	err := s.client.GetAbsolute(ctx, innerServicePath(barryInnerShopDropRepairSummaryPath), buildValues(
		"startDate", query.StartDate,
		"endDate", query.EndDate,
		"shopCategoryIds", query.ShopCategoryIDs,
	), response)
	if err != nil {
		return nil, err
	}
	if !response.Success || response.Data == nil {
		return nil, responseError(response.Message, "barry drop repair summary response is empty")
	}
	return response.Data, nil
}

func (s *ShopDropRepairService) Query(ctx context.Context, query barryDTO.ShopDropRepairQueryDTO) (*barryDTO.ShopDropRepairPageDTO, error) {
	response := &barryDTO.DetailResponseDTO[barryDTO.ShopDropRepairPageDTO]{}
	err := s.client.GetAbsolute(ctx, innerServicePath(barryInnerShopDropRepairQueryPath), buildValues(
		"startDate", query.StartDate,
		"endDate", query.EndDate,
		"shopCategoryIds", query.ShopCategoryIDs,
		"oriShopId", query.OriShopID,
		"businessId", query.BusinessID,
		"status", query.Status,
		"pageIndex", query.PageIndex,
		"pageSize", query.PageSize,
	), response)
	if err != nil {
		return nil, err
	}
	if !response.Success || response.Data == nil {
		return nil, responseError(response.Message, "barry drop repair query response is empty")
	}
	return response.Data, nil
}
