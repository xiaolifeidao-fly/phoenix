package barry

import (
	"context"
	"fmt"
	"strings"

	barryDTO "service/barry/dto"
)

type UserDetailService struct {
	client *Client
}

func NewUserDetailService(client *Client) *UserDetailService {
	return &UserDetailService{client: client}
}

func (s *UserDetailService) FindByUsername(ctx context.Context, username string) (*barryDTO.DetailResponseDTO[barryDTO.UserDetailDTO], error) {
	response := &barryDTO.DetailResponseDTO[barryDTO.UserDetailDTO]{}
	requestURL := strings.ReplaceAll(innerServicePath(barryInnerUserDetailFindPath), "{username}", strings.TrimSpace(username))
	err := s.client.GetAbsolute(ctx, requestURL, nil, response)
	if err != nil {
		return nil, err
	}
	return response, nil
}

func (s *UserDetailService) List(ctx context.Context, query barryDTO.UserDetailQueryDTO) (*barryDTO.ListResponseDTO[barryDTO.UserDetailDTO], error) {
	response := &barryDTO.ListResponseDTO[barryDTO.UserDetailDTO]{}
	err := s.client.GetAbsolute(ctx, innerServicePath(barryInnerUserDetailListPath), buildValues(
		"requestId", query.RequestID,
		"channel", query.Channel,
		"username", query.Username,
	), response)
	if err != nil {
		return nil, err
	}
	return response, nil
}

func (s *UserDetailService) Save(ctx context.Context, req *barryDTO.SaveUserDetailDTO) (*barryDTO.ActionResponseDTO, error) {
	if req == nil {
		return nil, fmt.Errorf("request is nil")
	}
	response := &barryDTO.ActionResponseDTO{Success: true}
	err := s.client.PostAbsolute(ctx, innerServicePath(barryInnerUserDetailSavePath), req, response)
	if err != nil {
		return nil, err
	}
	return response, nil
}

func (s *UserDetailService) Update(ctx context.Context, req *barryDTO.UpdateUserDetailDTO) (*barryDTO.ActionResponseDTO, error) {
	if req == nil {
		return nil, fmt.Errorf("request is nil")
	}
	response := &barryDTO.ActionResponseDTO{Success: true}
	err := s.client.PostAbsolute(ctx, innerServicePath(barryInnerUserDetailUpdatePath), req, response)
	if err != nil {
		return nil, err
	}
	return response, nil
}
