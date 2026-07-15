package barry

import (
	"context"
	"fmt"

	barryDTO "suffer/service/barry/dto"
)

type AssignConfigService struct {
	client *Client
}

func NewAssignConfigService(client *Client) *AssignConfigService {
	return &AssignConfigService{client: client}
}

func (s *AssignConfigService) List(ctx context.Context, query barryDTO.AssignConfigQueryDTO) (*barryDTO.AssignConfigListResponseDTO, error) {
	response := &barryDTO.AssignConfigListResponseDTO{}
	err := s.client.GetAbsolute(ctx, innerServicePath(barryInnerAssignConfigListPath), buildValues(
		"requestId", query.RequestID,
		"shopTypeId", query.ShopTypeID,
	), response)
	if err != nil {
		return nil, err
	}
	return response, nil
}

func (s *AssignConfigService) Save(ctx context.Context, req *barryDTO.SaveAssignConfigDTO) (*barryDTO.AssignConfigActionResultDTO, error) {
	if req == nil {
		return nil, fmt.Errorf("request is nil")
	}
	response := &barryDTO.AssignConfigActionResultDTO{}
	err := s.client.PostAbsolute(ctx, innerServicePath(barryInnerAssignConfigSavePath), req, response)
	if err != nil {
		return nil, err
	}
	return response, nil
}
