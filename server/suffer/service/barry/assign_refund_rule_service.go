package barry

import (
	"context"
	"fmt"

	barryDTO "suffer/service/barry/dto"
)

// AssignRefundRuleService 分配策略-退单维度规则(按分发轮次判断退单/异常打标), 按品类维护.
type AssignRefundRuleService struct {
	client *Client
}

func NewAssignRefundRuleService(client *Client) *AssignRefundRuleService {
	return &AssignRefundRuleService{client: client}
}

func (s *AssignRefundRuleService) Get(ctx context.Context, query barryDTO.AssignRefundRuleQueryDTO) (*barryDTO.DetailResponseDTO[barryDTO.AssignRefundRuleDTO], error) {
	response := &barryDTO.DetailResponseDTO[barryDTO.AssignRefundRuleDTO]{}
	err := s.client.GetAbsolute(ctx, innerServicePath(barryInnerAssignRefundRuleGetPath), buildValues(
		"shopCategoryId", query.ShopCategoryID,
	), response)
	if err != nil {
		return nil, err
	}
	return response, nil
}

func (s *AssignRefundRuleService) Save(ctx context.Context, req *barryDTO.SaveAssignRefundRuleDTO) (*barryDTO.ActionResponseDTO, error) {
	if req == nil {
		return nil, fmt.Errorf("request is nil")
	}
	response := &barryDTO.ActionResponseDTO{}
	err := s.client.PostAbsolute(ctx, innerServicePath(barryInnerAssignRefundRuleSavePath), req, response)
	if err != nil {
		return nil, err
	}
	return response, nil
}
