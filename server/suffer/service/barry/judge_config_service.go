package barry

import (
	"context"
	"fmt"
	"strings"

	barryDTO "suffer/service/barry/dto"
)

type JudgeConfigService struct {
	client *Client
}

func NewJudgeConfigService(client *Client) *JudgeConfigService {
	return &JudgeConfigService{client: client}
}

func (s *JudgeConfigService) List(ctx context.Context, query barryDTO.JudgeConfigQueryDTO) (*barryDTO.JudgeConfigListResponseDTO, error) {
	response := &barryDTO.JudgeConfigListResponseDTO{}
	err := s.client.GetAbsolute(ctx, innerServicePath(barryInnerJudgeConfigListPath), buildValues(
		"requestId", query.RequestID,
		"shopTypeId", query.ShopTypeID,
	), response)
	if err != nil {
		if strings.Contains(err.Error(), "status=404") {
			return &barryDTO.JudgeConfigListResponseDTO{Success: true, Data: []*barryDTO.JudgeConfigDTO{}}, nil
		}
		return nil, err
	}
	return response, nil
}

func (s *JudgeConfigService) Save(ctx context.Context, req *barryDTO.SaveJudgeConfigDTO) (*barryDTO.JudgeConfigActionResultDTO, error) {
	if req == nil {
		return nil, fmt.Errorf("request is nil")
	}
	response := &barryDTO.JudgeConfigActionResultDTO{}
	err := s.client.PostAbsolute(ctx, innerServicePath(barryInnerJudgeConfigSavePath), req, response)
	if err != nil {
		return nil, err
	}
	return response, nil
}
