package barry

import (
	"context"
	"fmt"

	barryDTO "suffer/service/barry/dto"
)

// SettleService 人工结算: 结算通道配置 + 做单用户结算配置(按 U / 按 RMB).
type SettleService struct {
	client *Client
}

func NewSettleService(client *Client) *SettleService {
	return &SettleService{client: client}
}

func (s *SettleService) ListChannels(ctx context.Context) (*barryDTO.ListResponseDTO[barryDTO.SettleChannelDTO], error) {
	response := &barryDTO.ListResponseDTO[barryDTO.SettleChannelDTO]{}
	err := s.client.GetAbsolute(ctx, innerServicePath(barryInnerSettleChannelListPath), nil, response)
	return response, err
}

// SaveChannel ID 为空新增, 否则更新.
func (s *SettleService) SaveChannel(ctx context.Context, req *barryDTO.SettleChannelDTO) (*barryDTO.DetailResponseDTO[barryDTO.SettleChannelDTO], error) {
	if req == nil {
		return nil, fmt.Errorf("request is nil")
	}
	response := &barryDTO.DetailResponseDTO[barryDTO.SettleChannelDTO]{}
	err := s.client.PostAbsolute(ctx, innerServicePath(barryInnerSettleChannelSavePath), req, response)
	return response, err
}

// GetUserConfig 未配置时 Data 为 nil.
func (s *SettleService) GetUserConfig(ctx context.Context, userID int64) (*barryDTO.DetailResponseDTO[barryDTO.UserSettleConfigDTO], error) {
	response := &barryDTO.DetailResponseDTO[barryDTO.UserSettleConfigDTO]{}
	err := s.client.GetAbsolute(ctx, innerServicePath(barryInnerUserSettleGetPath), buildValues("userId", userID), response)
	return response, err
}

func (s *SettleService) SaveUserConfig(ctx context.Context, req *barryDTO.UserSettleConfigDTO) (*barryDTO.DetailResponseDTO[barryDTO.UserSettleConfigDTO], error) {
	if req == nil {
		return nil, fmt.Errorf("request is nil")
	}
	response := &barryDTO.DetailResponseDTO[barryDTO.UserSettleConfigDTO]{}
	err := s.client.PostAbsolute(ctx, innerServicePath(barryInnerUserSettleSavePath), req, response)
	return response, err
}
