package barry

import (
	"context"
	"fmt"

	barryDTO "suffer/service/barry/dto"
)

// AssignVideoUserRuleService 分配策略-指定用户的视频维度过滤规则(user 域), 按(品类,用户)维护.
type AssignVideoUserRuleService struct {
	client *Client
}

func NewAssignVideoUserRuleService(client *Client) *AssignVideoUserRuleService {
	return &AssignVideoUserRuleService{client: client}
}

func (s *AssignVideoUserRuleService) List(ctx context.Context, query barryDTO.AssignVideoUserRuleQueryDTO) (*barryDTO.ListResponseDTO[barryDTO.AssignVideoUserRuleDTO], error) {
	response := &barryDTO.ListResponseDTO[barryDTO.AssignVideoUserRuleDTO]{}
	err := s.client.GetAbsolute(ctx, innerServicePath(barryInnerAssignVideoUserRuleListPath), buildValues(
		"shopCategoryId", query.ShopCategoryID,
	), response)
	if err != nil {
		return nil, err
	}
	return response, nil
}

func (s *AssignVideoUserRuleService) Save(ctx context.Context, req *barryDTO.SaveAssignVideoUserRuleDTO) (*barryDTO.ActionResponseDTO, error) {
	if req == nil {
		return nil, fmt.Errorf("request is nil")
	}
	response := &barryDTO.ActionResponseDTO{}
	err := s.client.PostAbsolute(ctx, innerServicePath(barryInnerAssignVideoUserRuleSavePath), req, response)
	if err != nil {
		return nil, err
	}
	return response, nil
}

func (s *AssignVideoUserRuleService) Delete(ctx context.Context, req barryDTO.DeleteAssignVideoUserRuleDTO) (*barryDTO.ActionResponseDTO, error) {
	response := &barryDTO.ActionResponseDTO{}
	requestURL := innerServicePath(barryInnerAssignVideoUserRuleDeletePath)
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
