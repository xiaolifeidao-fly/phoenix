package barry

import (
	"context"
	"fmt"
	"strings"

	barryDTO "suffer/service/barry/dto"
)

// ShopGroupService exposes Barry's complete product-group list to Phoenix consumers.
// The source of truth remains Barry; Phoenix only adapts the Inner Gateway
// response to its authenticated management API.
type ShopGroupService struct {
	client *Client
}

func NewShopGroupService(client *Client) *ShopGroupService {
	return &ShopGroupService{client: client}
}

func (s *ShopGroupService) List(ctx context.Context) ([]*barryDTO.ShopGroupDTO, error) {
	response := &barryDTO.ListResponseDTO[barryDTO.ShopGroupDTO]{}
	if err := s.client.GetAbsolute(ctx, innerServicePath(barryInnerAllShopGroupListPath), nil, response); err != nil {
		return nil, err
	}
	if response.Success {
		return response.Data, nil
	}

	message := strings.TrimSpace(response.Message)
	if message == "" {
		message = "barry shop groups response is empty"
	}
	return nil, fmt.Errorf("%s", message)
}

func (s *ShopGroupService) Save(ctx context.Context, request *barryDTO.ShopGroupDTO) (*barryDTO.ShopGroupDTO, error) {
	if request == nil {
		return nil, fmt.Errorf("request is nil")
	}
	response := &barryDTO.DetailResponseDTO[barryDTO.ShopGroupDTO]{}
	if err := s.client.PostAbsolute(ctx, innerServicePath(barryInnerShopGroupSavePath), request, response); err != nil {
		return nil, err
	}
	if !response.Success || response.Data == nil {
		return nil, responseError(response.Message, "barry shop group save failed")
	}
	return response.Data, nil
}

func (s *ShopGroupService) Delete(ctx context.Context, shopGroupID int64) error {
	response := &barryDTO.ActionResponseDTO{}
	requestURL := strings.ReplaceAll(innerServicePath(barryInnerShopGroupDeletePath), "{shopGroupId}", int64ToString(shopGroupID))
	if err := s.client.DeleteAbsolute(ctx, requestURL, response); err != nil {
		return err
	}
	if !response.Success {
		return responseError(response.Message, "barry shop group delete failed")
	}
	return nil
}
