package barry

import (
	"context"
	"fmt"

	barryDTO "suffer/service/barry/dto"
)

// AssignVideoRuleService 分配策略-视频维度过滤规则(shop 域), 按品类维护.
type AssignVideoRuleService struct {
	client *Client
}

func NewAssignVideoRuleService(client *Client) *AssignVideoRuleService {
	return &AssignVideoRuleService{client: client}
}

func (s *AssignVideoRuleService) Get(ctx context.Context, query barryDTO.AssignVideoRuleQueryDTO) (*barryDTO.DetailResponseDTO[barryDTO.AssignVideoRuleDTO], error) {
	response := &barryDTO.DetailResponseDTO[barryDTO.AssignVideoRuleDTO]{}
	err := s.client.GetAbsolute(ctx, innerServicePath(barryInnerAssignVideoRuleGetPath), buildValues(
		"shopCategoryId", query.ShopCategoryID,
	), response)
	if err != nil {
		return nil, err
	}
	return response, nil
}

func (s *AssignVideoRuleService) Save(ctx context.Context, req *barryDTO.SaveAssignVideoRuleDTO) (*barryDTO.ActionResponseDTO, error) {
	if req == nil {
		return nil, fmt.Errorf("request is nil")
	}
	response := &barryDTO.ActionResponseDTO{}
	err := s.client.PostAbsolute(ctx, innerServicePath(barryInnerAssignVideoRuleSavePath), req, response)
	if err != nil {
		return nil, err
	}
	return response, nil
}
