package barry

import (
	"context"

	barryDTO "suffer/service/barry/dto"
)

type UserAssignQueueService struct {
	client *Client
}

func NewUserAssignQueueService(client *Client) *UserAssignQueueService {
	return &UserAssignQueueService{client: client}
}

func (s *UserAssignQueueService) UID(ctx context.Context, query barryDTO.UserAssignQueueQueryDTO) ([]*barryDTO.UserAssignQueueDTO, error) {
	response := &barryDTO.ListResponseDTO[barryDTO.UserAssignQueueDTO]{}
	values := buildValues(
		"userId", query.UserID,
		"uid", query.UID,
	)
	if err := s.client.GetAbsolute(ctx, innerServicePath(barryInnerUserAssignQueueUIDPath), values, response); err != nil {
		return nil, err
	}
	if !response.Success {
		return nil, responseError(response.Message, "barry user assign queue response is invalid")
	}
	return response.Data, nil
}
