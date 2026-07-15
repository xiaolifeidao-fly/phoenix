package barry

import (
	"context"
	"fmt"
	"strings"

	barryDTO "suffer/service/barry/dto"
)

type ManualTaskStatisticsService struct {
	client *Client
}

func NewManualTaskStatisticsService(client *Client) *ManualTaskStatisticsService {
	return &ManualTaskStatisticsService{client: client}
}

func (s *ManualTaskStatisticsService) Summary(ctx context.Context, query barryDTO.ManualTaskStatisticsQueryDTO) (*barryDTO.ManualTaskStatisticsDTO, error) {
	response := &barryDTO.DetailResponseDTO[barryDTO.ManualTaskStatisticsDTO]{}
	err := s.client.GetAbsolute(ctx, innerServicePath(barryInnerManualTaskStatisticsPath), buildValues(
		"startDate", query.StartDate,
		"endDate", query.EndDate,
		"shopCategoryIds", query.ShopCategoryIDs,
		"userId", query.UserID,
		"page", query.Page,
		"pageSize", query.PageSize,
	), response)
	if err != nil {
		return nil, err
	}
	if !response.Success || response.Data == nil {
		message := strings.TrimSpace(response.Message)
		if message == "" {
			message = "barry manual task statistics response is empty"
		}
		return nil, fmt.Errorf("%s", message)
	}
	return response.Data, nil
}

func (s *ManualTaskStatisticsService) Users(ctx context.Context, keyword string) ([]*barryDTO.ManualUserOptionDTO, error) {
	response := &barryDTO.ListResponseDTO[barryDTO.ManualUserOptionDTO]{}
	if err := s.client.GetAbsolute(ctx, innerServicePath(barryInnerManualTaskStatisticsUsersPath), buildValues("keyword", keyword), response); err != nil {
		return nil, err
	}
	if !response.Success {
		message := strings.TrimSpace(response.Message)
		if message == "" {
			message = "barry manual user list response is empty"
		}
		return nil, fmt.Errorf("%s", message)
	}
	return response.Data, nil
}
