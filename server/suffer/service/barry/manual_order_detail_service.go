package barry

import (
	"context"
	"fmt"
	"strings"

	barryDTO "suffer/service/barry/dto"
)

type ManualOrderDetailService struct {
	client *Client
}

func NewManualOrderDetailService(client *Client) *ManualOrderDetailService {
	return &ManualOrderDetailService{client: client}
}

func (s *ManualOrderDetailService) List(ctx context.Context, query barryDTO.ManualOrderDetailQueryDTO) (*barryDTO.ManualOrderDetailPageDTO, error) {
	response := &barryDTO.DetailResponseDTO[barryDTO.ManualOrderDetailPageDTO]{}
	err := s.client.GetAbsolute(ctx, innerServicePath(barryInnerManualOrderDetailsPath), buildValues(
		"startDate", query.StartDate,
		"endDate", query.EndDate,
		"userId", query.UserID,
		"uid", query.UID,
		"fansNumOrder", query.FansNumOrder,
		"fansNumMin", query.FansNumMin,
		"fansNumMax", query.FansNumMax,
		"approvalRateMin", query.ApprovalRateMin,
		"approvalRateMax", query.ApprovalRateMax,
		"page", query.Page,
		"pageSize", query.PageSize,
	), response)
	if err != nil {
		return nil, err
	}
	if !response.Success || response.Data == nil {
		message := strings.TrimSpace(response.Message)
		if message == "" {
			message = "barry manual order detail response is empty"
		}
		return nil, fmt.Errorf("%s", message)
	}
	return response.Data, nil
}

func (s *ManualOrderDetailService) FindLatestSecUID(ctx context.Context, userID int64, uid string) (string, error) {
	response := &barryDTO.DetailResponseDTO[string]{}
	err := s.client.GetAbsolute(ctx, innerServicePath(barryInnerManualOrderDetailSecUidPath), buildValues(
		"userId", userID,
		"uid", uid,
	), response)
	if err != nil {
		return "", err
	}
	if !response.Success {
		message := strings.TrimSpace(response.Message)
		if message == "" {
			message = "barry manual order detail sec uid response is invalid"
		}
		return "", fmt.Errorf("%s", message)
	}
	if response.Data == nil {
		return "", nil
	}
	return strings.TrimSpace(*response.Data), nil
}
