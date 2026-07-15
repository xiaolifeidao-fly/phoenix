package barry

import (
	"context"
	"fmt"
	"strconv"

	barryDTO "suffer/service/barry/dto"
)

// AssignWhitelistSwitchService 用户ID维度(白名单)总开关(user 域), 有记录即启用.
type AssignWhitelistSwitchService struct {
	client *Client
}

func NewAssignWhitelistSwitchService(client *Client) *AssignWhitelistSwitchService {
	return &AssignWhitelistSwitchService{client: client}
}

func (s *AssignWhitelistSwitchService) Get(ctx context.Context, query barryDTO.AssignSwitchQueryDTO) (*barryDTO.DetailResponseDTO[bool], error) {
	response := &barryDTO.DetailResponseDTO[bool]{}
	err := s.client.GetAbsolute(ctx, innerServicePath(barryInnerAssignWhitelistSwitchGetPath), buildValues(
		"shopCategoryId", query.ShopCategoryID,
	), response)
	if err != nil {
		return nil, err
	}
	return response, nil
}

func (s *AssignWhitelistSwitchService) Save(ctx context.Context, req *barryDTO.SaveAssignSwitchDTO) (*barryDTO.ActionResponseDTO, error) {
	if req == nil {
		return nil, fmt.Errorf("request is nil")
	}
	return postSwitch(ctx, s.client, barryInnerAssignWhitelistSwitchSavePath, req)
}

// AssignUidSwitchService uid维度总开关(user 域), 有记录即启用.
type AssignUidSwitchService struct {
	client *Client
}

func NewAssignUidSwitchService(client *Client) *AssignUidSwitchService {
	return &AssignUidSwitchService{client: client}
}

func (s *AssignUidSwitchService) Get(ctx context.Context, query barryDTO.AssignSwitchQueryDTO) (*barryDTO.DetailResponseDTO[bool], error) {
	response := &barryDTO.DetailResponseDTO[bool]{}
	err := s.client.GetAbsolute(ctx, innerServicePath(barryInnerAssignUidSwitchGetPath), buildValues(
		"shopCategoryId", query.ShopCategoryID,
	), response)
	if err != nil {
		return nil, err
	}
	return response, nil
}

func (s *AssignUidSwitchService) Save(ctx context.Context, req *barryDTO.SaveAssignSwitchDTO) (*barryDTO.ActionResponseDTO, error) {
	if req == nil {
		return nil, fmt.Errorf("request is nil")
	}
	return postSwitch(ctx, s.client, barryInnerAssignUidSwitchSavePath, req)
}

// postSwitch 以 query param(@RequestParam) 形式调用 barry 的开关 save 接口.
func postSwitch(ctx context.Context, client *Client, configKey string, req *barryDTO.SaveAssignSwitchDTO) (*barryDTO.ActionResponseDTO, error) {
	response := &barryDTO.ActionResponseDTO{}
	values := buildValues("shopCategoryId", req.ShopCategoryID)
	values.Set("enabled", strconv.FormatBool(req.Enabled))
	requestURL := innerServicePath(configKey) + "?" + values.Encode()
	if err := client.PostAbsolute(ctx, requestURL, nil, response); err != nil {
		return nil, err
	}
	return response, nil
}
