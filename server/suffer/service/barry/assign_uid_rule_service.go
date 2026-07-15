package barry

import (
	"context"
	"fmt"

	barryDTO "suffer/service/barry/dto"
)

// AssignUidRuleService 分配策略-uid维度过滤规则(user 域), 按品类维护.
type AssignUidRuleService struct {
	client *Client
}

func NewAssignUidRuleService(client *Client) *AssignUidRuleService {
	return &AssignUidRuleService{client: client}
}

func (s *AssignUidRuleService) Get(ctx context.Context, query barryDTO.AssignUidRuleQueryDTO) (*barryDTO.DetailResponseDTO[barryDTO.AssignUidRuleDTO], error) {
	response := &barryDTO.DetailResponseDTO[barryDTO.AssignUidRuleDTO]{}
	err := s.client.GetAbsolute(ctx, innerServicePath(barryInnerAssignUidRuleGetPath), buildValues(
		"shopCategoryId", query.ShopCategoryID,
	), response)
	if err != nil {
		return nil, err
	}
	return response, nil
}

func (s *AssignUidRuleService) Save(ctx context.Context, req *barryDTO.SaveAssignUidRuleDTO) (*barryDTO.ActionResponseDTO, error) {
	if req == nil {
		return nil, fmt.Errorf("request is nil")
	}
	response := &barryDTO.ActionResponseDTO{}
	err := s.client.PostAbsolute(ctx, innerServicePath(barryInnerAssignUidRuleSavePath), req, response)
	if err != nil {
		return nil, err
	}
	return response, nil
}
