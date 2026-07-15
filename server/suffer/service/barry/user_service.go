package barry

import (
	"context"
	barryDTO "suffer/service/barry/dto"
)

type UserService struct {
	client *Client
}

func NewUserService(client *Client) *UserService {
	return &UserService{client: client}
}

func (s *UserService) List(ctx context.Context, query barryDTO.UserQueryDTO) (*barryDTO.ListResponseDTO[barryDTO.UserDTO], error) {
	response := &barryDTO.ListResponseDTO[barryDTO.UserDTO]{}
	err := s.client.GetAbsolute(ctx, innerServicePath(barryInnerAppUserListPath), buildValues(
		"requestId", query.RequestID,
		"page", query.Page,
		"pageIndex", query.PageIndex,
		"pageSize", query.PageSize,
		"userId", query.UserID,
		"username", query.Username,
		"name", query.Name,
		"phone", query.Phone,
		"status", query.Status,
		"channel", query.Channel,
		"group", query.Group,
		"shopCategoryId", query.ShopCategoryID,
	), response)
	if err != nil {
		return nil, err
	}
	return response, nil
}
