package barry

import (
	"context"
	"fmt"
	barryDTO "service/barry/dto"
)

const channelPath = "barry.services.channel.path"

type ChannelService struct {
	client *Client
}

func NewChannelService(client *Client) *ChannelService {
	return &ChannelService{client: client}
}

func (s *ChannelService) List(ctx context.Context, query barryDTO.ChannelQueryDTO) (*barryDTO.ListResponseDTO[barryDTO.ChannelDTO], error) {
	response := &barryDTO.ListResponseDTO[barryDTO.ChannelDTO]{}
	err := s.client.Get(ctx, servicePath(channelPath), buildValues(
		"requestId", query.RequestID,
		"page", query.Page,
		"pageIndex", query.PageIndex,
		"pageSize", query.PageSize,
		"code", query.Code,
		"name", query.Name,
		"type", query.Type,
	), response)
	if err != nil {
		return nil, err
	}
	return response, nil
}

func (s *ChannelService) ListDetails(ctx context.Context) (*barryDTO.ListResponseDTO[barryDTO.ChannelDetailDTO], error) {
	response := &barryDTO.ListResponseDTO[barryDTO.ChannelDetailDTO]{}
	err := s.client.GetAbsolute(ctx, innerServicePath(barryInnerChannelDetailListPath), nil, response)
	if err != nil {
		return nil, err
	}
	return response, nil
}

func (s *ChannelService) SaveDetail(ctx context.Context, req *barryDTO.SaveChannelDetailDTO) (*barryDTO.ActionResponseDTO, error) {
	if req == nil {
		return nil, fmt.Errorf("request is nil")
	}
	response := &barryDTO.ActionResponseDTO{Success: true}
	err := s.client.PostAbsolute(ctx, innerServicePath(barryInnerChannelDetailSavePath), req, response)
	if err != nil {
		return nil, err
	}
	return response, nil
}

func (s *ChannelService) UpdateDetail(ctx context.Context, req *barryDTO.UpdateChannelDetailDTO) (*barryDTO.ActionResponseDTO, error) {
	if req == nil {
		return nil, fmt.Errorf("request is nil")
	}
	response := &barryDTO.ActionResponseDTO{Success: true}
	err := s.client.PostAbsolute(ctx, innerServicePath(barryInnerChannelDetailUpdatePath), req, response)
	if err != nil {
		return nil, err
	}
	return response, nil
}
