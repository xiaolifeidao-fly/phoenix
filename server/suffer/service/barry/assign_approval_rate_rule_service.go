package barry

import (
	"context"
	"fmt"

	barryDTO "suffer/service/barry/dto"
)

// AssignApprovalRateRuleService 分配策略-审核通过率维度规则，按品类维护。
type AssignApprovalRateRuleService struct {
	client *Client
}

func NewAssignApprovalRateRuleService(client *Client) *AssignApprovalRateRuleService {
	return &AssignApprovalRateRuleService{client: client}
}

func (s *AssignApprovalRateRuleService) Get(ctx context.Context, query barryDTO.AssignApprovalRateRuleQueryDTO) (*barryDTO.DetailResponseDTO[barryDTO.AssignApprovalRateRuleDTO], error) {
	response := &barryDTO.DetailResponseDTO[barryDTO.AssignApprovalRateRuleDTO]{}
	err := s.client.GetAbsolute(ctx, innerServicePath(barryInnerAssignApprovalRateRuleGetPath), buildValues(
		"shopCategoryId", query.ShopCategoryID,
	), response)
	if err != nil {
		return nil, err
	}
	return response, nil
}

func (s *AssignApprovalRateRuleService) Save(ctx context.Context, req *barryDTO.SaveAssignApprovalRateRuleDTO) (*barryDTO.ActionResponseDTO, error) {
	if req == nil {
		return nil, fmt.Errorf("request is nil")
	}
	response := &barryDTO.ActionResponseDTO{}
	err := s.client.PostAbsolute(ctx, innerServicePath(barryInnerAssignApprovalRateRuleSavePath), req, response)
	if err != nil {
		return nil, err
	}
	return response, nil
}
