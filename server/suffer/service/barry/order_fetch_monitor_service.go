package barry

import (
	"context"

	barryDTO "suffer/service/barry/dto"
)

type OrderFetchMonitorService struct {
	client *Client
}

func NewOrderFetchMonitorService(client *Client) *OrderFetchMonitorService {
	return &OrderFetchMonitorService{client: client}
}

func (s *OrderFetchMonitorService) Users(ctx context.Context, query barryDTO.OrderFetchMonitorUsersQueryDTO) ([]*barryDTO.OrderFetchMonitorDTO, error) {
	return s.list(ctx, barryInnerOrderFetchMonitorUsersPath, buildValues(
		"userIds", query.UserIDs,
		"windowSeconds", query.WindowSeconds,
	))
}

func (s *OrderFetchMonitorService) UIDs(ctx context.Context, query barryDTO.OrderFetchMonitorUIDsQueryDTO) ([]*barryDTO.OrderFetchMonitorDTO, error) {
	return s.list(ctx, barryInnerOrderFetchMonitorUIDsPath, buildValues(
		"userIds", query.UserIDs,
		"uids", query.UIDs,
		"windowSeconds", query.WindowSeconds,
	))
}

func (s *OrderFetchMonitorService) list(ctx context.Context, path string, values map[string][]string) ([]*barryDTO.OrderFetchMonitorDTO, error) {
	response := &barryDTO.ListResponseDTO[barryDTO.OrderFetchMonitorDTO]{}
	if err := s.client.GetAbsolute(ctx, innerServicePath(path), values, response); err != nil {
		return nil, err
	}
	if !response.Success {
		return nil, responseError(response.Message, "barry order fetch monitor response is invalid")
	}
	return response.Data, nil
}
