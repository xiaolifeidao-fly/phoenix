package barry

import (
	"context"
	"fmt"
	barryDTO "suffer/service/barry/dto"
)

type UserWhitelistService struct {
	client *Client
}

func NewUserWhitelistService(client *Client) *UserWhitelistService {
	return &UserWhitelistService{client: client}
}

func (s *UserWhitelistService) List(ctx context.Context, query barryDTO.UserWhitelistQueryDTO) (*barryDTO.ListResponseDTO[barryDTO.UserWhitelistDTO], error) {
	response := &barryDTO.ListResponseDTO[barryDTO.UserWhitelistDTO]{}
	err := s.client.GetAbsolute(ctx, innerServicePath(barryInnerUserWhitelistListPath), buildValues(
		"requestId", query.RequestID,
		"page", query.Page,
		"pageIndex", query.PageIndex,
		"pageSize", query.PageSize,
		"shopCategoryId", query.ShopCategoryID,
		"group", query.Group,
		"userId", query.UserID,
		"username", query.Username,
		"status", query.Status,
	), response)
	if err != nil {
		return nil, err
	}
	return response, nil
}

func (s *UserWhitelistService) Save(ctx context.Context, req *barryDTO.SaveUserWhitelistDTO) (*barryDTO.DetailResponseDTO[barryDTO.UserWhitelistDTO], error) {
	if req == nil {
		return nil, fmt.Errorf("request is nil")
	}
	response := &barryDTO.DetailResponseDTO[barryDTO.UserWhitelistDTO]{}
	err := s.client.PostAbsolute(ctx, innerServicePath(barryInnerUserWhitelistSavePath), req, response)
	if err != nil {
		return nil, err
	}
	return response, nil
}

func (s *UserWhitelistService) UpdateStatus(ctx context.Context, req *barryDTO.UpdateUserWhitelistStatusDTO) (*barryDTO.DetailResponseDTO[barryDTO.UserWhitelistDTO], error) {
	if req == nil {
		return nil, fmt.Errorf("request is nil")
	}
	response := &barryDTO.DetailResponseDTO[barryDTO.UserWhitelistDTO]{}
	err := s.client.PostAbsolute(ctx, innerServicePath(barryInnerUserWhitelistActivePath), req, response)
	if err != nil {
		return nil, err
	}
	return response, nil
}

func (s *UserWhitelistService) UpdateGroup(ctx context.Context, req *barryDTO.UpdateUserWhitelistGroupDTO) (*barryDTO.DetailResponseDTO[barryDTO.UserWhitelistDTO], error) {
	if req == nil {
		return nil, fmt.Errorf("request is nil")
	}
	response := &barryDTO.DetailResponseDTO[barryDTO.UserWhitelistDTO]{}
	err := s.client.PostAbsolute(ctx, innerServicePath(barryInnerUserWhitelistGroupPath), req, response)
	if err != nil {
		return nil, err
	}
	return response, nil
}
