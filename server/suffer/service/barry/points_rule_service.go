package barry

import (
	"context"
	"fmt"
	"strconv"

	barryDTO "suffer/service/barry/dto"
)

// PointsRuleService 人工商品积分配置(吃量比例 + 审核加积分方式): 商品全局 + 白名单用户维度.
type PointsRuleService struct {
	client *Client
}

func NewPointsRuleService(client *Client) *PointsRuleService {
	return &PointsRuleService{client: client}
}

func (s *PointsRuleService) GetGlobal(ctx context.Context, shopCategoryID int64) (*barryDTO.DetailResponseDTO[barryDTO.PointsRuleDTO], error) {
	response := &barryDTO.DetailResponseDTO[barryDTO.PointsRuleDTO]{}
	err := s.client.GetAbsolute(ctx, innerServicePath(barryInnerPointsRuleGetPath), buildValues("shopCategoryId", shopCategoryID), response)
	return response, err
}

// SaveGlobal 为 nil 的一项不下发参数, barry 侧清空为未配置.
func (s *PointsRuleService) SaveGlobal(ctx context.Context, shopCategoryID int64, rule barryDTO.PointsRuleDTO) (*barryDTO.DetailResponseDTO[barryDTO.PointsRuleDTO], error) {
	response := &barryDTO.DetailResponseDTO[barryDTO.PointsRuleDTO]{}
	values := buildValues("shopCategoryId", shopCategoryID)
	if rule.EatRatio != nil {
		values.Set("eatRatio", strconv.FormatFloat(*rule.EatRatio, 'f', -1, 64))
	}
	if rule.EatMode != nil {
		values.Set("eatMode", *rule.EatMode)
	}
	err := s.client.PostAbsolute(ctx, innerServicePath(barryInnerPointsRuleSavePath)+"?"+values.Encode(), nil, response)
	return response, err
}

// SaveUser 只改白名单记录上的积分配置, 不动白名单状态.
func (s *PointsRuleService) SaveUser(ctx context.Context, req *barryDTO.SaveUserPointsRuleDTO) (*barryDTO.DetailResponseDTO[barryDTO.UserWhitelistDTO], error) {
	if req == nil {
		return nil, fmt.Errorf("request is nil")
	}
	response := &barryDTO.DetailResponseDTO[barryDTO.UserWhitelistDTO]{}
	err := s.client.PostAbsolute(ctx, innerServicePath(barryInnerUserPointsRuleSavePath), req, response)
	return response, err
}
