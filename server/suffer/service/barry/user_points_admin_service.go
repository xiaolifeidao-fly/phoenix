package barry

import (
	"context"
	"fmt"
	"strings"

	barryDTO "suffer/service/barry/dto"
)

// UserPointsAdminService covers the console-side points operations on 做单用户:
// a manual signed adjustment, the all-accounts balance summary, and one user's
// points history (daily summary + paged records).
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

// Daily 某个做单用户在区间内按天、按来源汇总的积分变动, 只有有流水的天, 日期倒序.
func (s *UserPointsAdminService) Daily(ctx context.Context, query barryDTO.UserPointsHistoryQueryDTO) ([]barryDTO.UserPointsDailyStatDTO, error) {
	response := &barryDTO.ListResponseDTO[barryDTO.UserPointsDailyStatDTO]{}
	err := s.client.GetAbsolute(ctx, innerServicePath(barryInnerUserPointsDailyPath), buildValues(
		"userId", query.UserID,
		"startDate", query.StartDate,
		"endDate", query.EndDate,
	), response)
	if err := unwrapUserPointsResponse(response.Success, response.Message, err, "积分汇总查询失败"); err != nil {
		return nil, err
	}
	result := make([]barryDTO.UserPointsDailyStatDTO, 0, len(response.Data))
	for _, item := range response.Data {
		if item != nil {
			result = append(result, *item)
		}
	}
	return result, nil
}

// Records 某个做单用户在区间内的积分明细, 最新在前分页.
func (s *UserPointsAdminService) Records(ctx context.Context, query barryDTO.UserPointsHistoryQueryDTO) (*barryDTO.UserPointsRecordPageDTO, error) {
	response := &barryDTO.DetailResponseDTO[barryDTO.UserPointsRecordPageDTO]{}
	err := s.client.GetAbsolute(ctx, innerServicePath(barryInnerUserPointsRecordsPath), buildValues(
		"userId", query.UserID,
		"startDate", query.StartDate,
		"endDate", query.EndDate,
		"source", query.Source,
		"page", query.Page,
		"pageSize", query.PageSize,
	), response)
	if err := unwrapUserPointsResponse(response.Success, response.Message, err, "积分明细查询失败"); err != nil {
		return nil, err
	}
	if response.Data == nil {
		response.Data = &barryDTO.UserPointsRecordPageDTO{}
	}
	if response.Data.Data == nil {
		response.Data.Data = []*barryDTO.UserPointsRecordDTO{}
	}
	return response.Data, nil
}

// unwrapUserPointsResponse 请求错误原样返回; barry 业务失败时带上它的中文原因.
func unwrapUserPointsResponse(success bool, message string, err error, fallback string) error {
	if err != nil {
		return err
	}
	if !success {
		message = strings.TrimSpace(message)
		if message == "" {
			message = fallback
		}
		return fmt.Errorf("%s", message)
	}
	return nil
}
