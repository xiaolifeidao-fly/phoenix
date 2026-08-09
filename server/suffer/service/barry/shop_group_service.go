package barry

import (
	"context"
	"fmt"
	"strings"

	barryDTO "suffer/service/barry/dto"
)

// ShopGroupService exposes Barry's active subgroup list to Phoenix consumers.
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
	if err := s.client.GetAbsolute(ctx, innerServicePath(barryInnerShopGroupListPath), nil, response); err != nil {
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
