package barry

import (
	"context"
	"fmt"

	barryDTO "suffer/service/barry/dto"
)

// AssignUidSubmitRateUserRuleService 管理指定用户的 uid 提交率覆盖规则。
type AssignUidSubmitRateUserRuleService struct {
	client *Client
}

func NewAssignUidSubmitRateUserRuleService(client *Client) *AssignUidSubmitRateUserRuleService {
	return &AssignUidSubmitRateUserRuleService{client: client}
}

func (s *AssignUidSubmitRateUserRuleService) List(ctx context.Context, query barryDTO.AssignUidSubmitRateUserRuleQueryDTO) (*barryDTO.ListResponseDTO[barryDTO.AssignUidSubmitRateUserRuleDTO], error) {
	response := &barryDTO.ListResponseDTO[barryDTO.AssignUidSubmitRateUserRuleDTO]{}
	err := s.client.GetAbsolute(ctx, innerServicePath(barryInnerAssignUidSubmitRateUserRuleListPath), buildValues(
		"shopCategoryId", query.ShopCategoryID,
	), response)
	if err != nil {
		return nil, err
	}
	return response, nil
}

func (s *AssignUidSubmitRateUserRuleService) Save(ctx context.Context, req *barryDTO.SaveAssignUidSubmitRateUserRuleDTO) (*barryDTO.ActionResponseDTO, error) {
	if req == nil {
		return nil, fmt.Errorf("request is nil")
	}
	response := &barryDTO.ActionResponseDTO{}
	err := s.client.PostAbsolute(ctx, innerServicePath(barryInnerAssignUidSubmitRateUserRuleSavePath), req, response)
	if err != nil {
		return nil, err
	}
	return response, nil
}

func (s *AssignUidSubmitRateUserRuleService) Delete(ctx context.Context, req barryDTO.DeleteAssignUidSubmitRateUserRuleDTO) (*barryDTO.ActionResponseDTO, error) {
	response := &barryDTO.ActionResponseDTO{}
	requestURL := innerServicePath(barryInnerAssignUidSubmitRateUserRuleDeletePath)
	if encoded := buildValues(
		"shopCategoryId", req.ShopCategoryID,
		"userId", req.UserID,
	).Encode(); encoded != "" {
		requestURL = requestURL + "?" + encoded
	}
	err := s.client.PostAbsolute(ctx, requestURL, nil, response)
	if err != nil {
		return nil, err
	}
	return response, nil
}
