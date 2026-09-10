package barry

import (
	"context"
	"fmt"
	"strings"

	barryDTO "suffer/service/barry/dto"
)

// WhitelistGroupService adapts Barry's 白名单分组字典 endpoints. The dictionary is
// owned by a 商品分组; the 分配策略 whitelist dimension only ever stores a group's
// Code, so Barry stays the source of truth for both the codes and their labels.
type WhitelistGroupService struct {
	client *Client
}

func NewWhitelistGroupService(client *Client) *WhitelistGroupService {
	return &WhitelistGroupService{client: client}
}

func (s *WhitelistGroupService) List(ctx context.Context, shopGroupID int64) ([]*barryDTO.WhitelistGroupDTO, error) {
	response := &barryDTO.ListResponseDTO[barryDTO.WhitelistGroupDTO]{}
	requestURL := whitelistGroupPath(barryInnerWhitelistGroupListPath, shopGroupID, 0)
	if err := s.client.GetAbsolute(ctx, requestURL, nil, response); err != nil {
		return nil, err
	}
	if !response.Success {
		return nil, responseError(response.Message, "barry whitelist group list response is empty")
	}
	return response.Data, nil
}

func (s *WhitelistGroupService) Save(ctx context.Context, shopGroupID int64, request *barryDTO.WhitelistGroupDTO) (*barryDTO.WhitelistGroupDTO, error) {
	if request == nil {
		return nil, fmt.Errorf("request is nil")
	}
	response := &barryDTO.DetailResponseDTO[barryDTO.WhitelistGroupDTO]{}
	requestURL := whitelistGroupPath(barryInnerWhitelistGroupSavePath, shopGroupID, 0)
	if err := s.client.PostAbsolute(ctx, requestURL, request, response); err != nil {
		return nil, err
	}
	if !response.Success || response.Data == nil {
		return nil, responseError(response.Message, "barry whitelist group save failed")
	}
	return response.Data, nil
}

func (s *WhitelistGroupService) Delete(ctx context.Context, shopGroupID, whitelistGroupID int64) error {
	response := &barryDTO.ActionResponseDTO{}
	requestURL := whitelistGroupPath(barryInnerWhitelistGroupDeletePath, shopGroupID, whitelistGroupID)
	if err := s.client.DeleteAbsolute(ctx, requestURL, response); err != nil {
		return err
	}
	if !response.Success {
		return responseError(response.Message, "barry whitelist group delete failed")
	}
	return nil
}

func whitelistGroupPath(configPath string, shopGroupID, whitelistGroupID int64) string {
	requestURL := innerServicePath(configPath)
	requestURL = strings.ReplaceAll(requestURL, "{shopGroupId}", int64ToString(shopGroupID))
	requestURL = strings.ReplaceAll(requestURL, "{whitelistGroupId}", int64ToString(whitelistGroupID))
	return requestURL
}
