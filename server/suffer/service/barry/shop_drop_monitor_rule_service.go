package barry

import (
	"context"
	"fmt"

	barryDTO "suffer/service/barry/dto"
)

// ShopDropMonitorRuleService 已完成单掉量监控配置, 按人工商品(shopCategoryId)维护.
type ShopDropMonitorRuleService struct {
	client *Client
}

func NewShopDropMonitorRuleService(client *Client) *ShopDropMonitorRuleService {
	return &ShopDropMonitorRuleService{client: client}
}

func (s *ShopDropMonitorRuleService) Get(ctx context.Context, query barryDTO.ShopDropMonitorRuleQueryDTO) (*barryDTO.DetailResponseDTO[barryDTO.ShopDropMonitorRuleDTO], error) {
	response := &barryDTO.DetailResponseDTO[barryDTO.ShopDropMonitorRuleDTO]{}
	err := s.client.GetAbsolute(ctx, innerServicePath(barryInnerShopDropMonitorRuleGetPath), buildValues(
		"shopCategoryId", query.ShopCategoryID,
	), response)
	if err != nil {
		return nil, err
	}
	return response, nil
}

func (s *ShopDropMonitorRuleService) Save(ctx context.Context, req *barryDTO.SaveShopDropMonitorRuleDTO) (*barryDTO.ActionResponseDTO, error) {
	if req == nil {
		return nil, fmt.Errorf("request is nil")
	}
	response := &barryDTO.ActionResponseDTO{}
	err := s.client.PostAbsolute(ctx, innerServicePath(barryInnerShopDropMonitorRuleSavePath), req, response)
	if err != nil {
		return nil, err
	}
	return response, nil
}
