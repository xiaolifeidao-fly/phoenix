package barry

import (
	"context"
	"fmt"

	barryDTO "suffer/service/barry/dto"
)

// UserPointsAdminService covers the console-side points operations on 做单用户:
// a manual signed adjustment, and the all-accounts balance summary.
//
// Deliberately separate from UserPointService: that one is wired to
// barry.services.user-point.path, which is not configured in any environment.
type UserPointsAdminService struct {
	client *Client
}

func NewUserPointsAdminService(client *Client) *UserPointsAdminService {
	return &UserPointsAdminService{client: client}
}

func (s *UserPointsAdminService) Adjust(ctx context.Context, request *barryDTO.AdjustUserPointsDTO) (*barryDTO.ActionResponseDTO, error) {
	if request == nil {
		return nil, fmt.Errorf("request is nil")
	}
	response := &barryDTO.ActionResponseDTO{}
	if err := s.client.PostAbsolute(ctx, innerServicePath(barryInnerUserPointsAdjustPath), request, response); err != nil {
		return nil, err
	}
	return response, nil
}

func (s *UserPointsAdminService) Summary(ctx context.Context, query barryDTO.UserPointsSummaryQueryDTO) (*barryDTO.DetailResponseDTO[barryDTO.UserPointsSummaryDTO], error) {
	response := &barryDTO.DetailResponseDTO[barryDTO.UserPointsSummaryDTO]{}
	// buildValues drops empty strings, which is exactly the wanted behaviour:
	// a blank time or exclusion list means "no filter" on the Barry side.
	values := buildValues(
		"updatedTime", query.UpdatedTime,
		"excludedUserIds", query.ExcludedUserIDs,
	)
	if err := s.client.GetAbsolute(ctx, innerServicePath(barryInnerUserPointsSummaryPath), values, response); err != nil {
		return nil, err
	}
	return response, nil
}
