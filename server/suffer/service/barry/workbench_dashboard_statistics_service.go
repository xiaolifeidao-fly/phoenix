package barry

import (
	"context"
	"fmt"
	"strings"

	barryDTO "suffer/service/barry/dto"
)

// WorkbenchDashboardStatisticsService proxies independent Barry-only cards.
// Existing manual statistics endpoints remain untouched for Kakrolot callers.
type WorkbenchDashboardStatisticsService struct {
	client *Client
}

func NewWorkbenchDashboardStatisticsService(client *Client) *WorkbenchDashboardStatisticsService {
	return &WorkbenchDashboardStatisticsService{client: client}
}

func (s *WorkbenchDashboardStatisticsService) UserOverview(ctx context.Context) (*barryDTO.WorkbenchUserOverviewDTO, error) {
	response := &barryDTO.DetailResponseDTO[barryDTO.WorkbenchUserOverviewDTO]{}
	if err := s.client.GetAbsolute(ctx, innerServicePath(barryInnerWorkbenchDashboardUserOverviewPath), nil, response); err != nil {
		return nil, err
	}
	if !response.Success || response.Data == nil {
		return nil, responseError(response.Message, "barry workbench user overview response is empty")
	}
	return response.Data, nil
}

func (s *WorkbenchDashboardStatisticsService) TaskRemaining(ctx context.Context, query barryDTO.WorkbenchDashboardMetricQueryDTO) (*barryDTO.WorkbenchDashboardMetricDTO, error) {
	return s.metric(ctx, barryInnerWorkbenchDashboardTaskRemainingPath, query)
}

func (s *WorkbenchDashboardStatisticsService) ManualSubmitted(ctx context.Context, query barryDTO.WorkbenchDashboardMetricQueryDTO) (*barryDTO.WorkbenchDashboardMetricDTO, error) {
	return s.metric(ctx, barryInnerWorkbenchDashboardManualSubmittedPath, query)
}

// ManualSubmittedComparison delegates the selected categories to Barry. Barry reads
// today's order summary and yesterday's same-time data from order_minute_sum_record.
func (s *WorkbenchDashboardStatisticsService) ManualSubmittedComparison(ctx context.Context, query barryDTO.WorkbenchDashboardMetricQueryDTO) (*barryDTO.WorkbenchDashboardManualSubmittedComparisonDTO, error) {
	response := &barryDTO.DetailResponseDTO[barryDTO.WorkbenchDashboardManualSubmittedComparisonDTO]{}
	err := s.client.GetAbsolute(ctx, innerServicePath(barryInnerWorkbenchDashboardManualSubmittedComparisonPath), buildValues(
		"shopCategoryIds", query.ShopCategoryIDs,
	), response)
	if err != nil {
		return nil, err
	}
	if !response.Success || response.Data == nil {
		return nil, responseError(response.Message, "barry workbench manual submission comparison response is empty")
	}
	return response.Data, nil
}

func (s *WorkbenchDashboardStatisticsService) ActualCompleted(ctx context.Context, query barryDTO.WorkbenchDashboardMetricQueryDTO) (*barryDTO.WorkbenchDashboardMetricDTO, error) {
	return s.metric(ctx, barryInnerWorkbenchDashboardActualCompletedPath, query)
}

func (s *WorkbenchDashboardStatisticsService) metric(ctx context.Context, configPath string, query barryDTO.WorkbenchDashboardMetricQueryDTO) (*barryDTO.WorkbenchDashboardMetricDTO, error) {
	response := &barryDTO.DetailResponseDTO[barryDTO.WorkbenchDashboardMetricDTO]{}
	err := s.client.GetAbsolute(ctx, innerServicePath(configPath), buildValues(
		"startDate", query.StartDate,
		"endDate", query.EndDate,
		"shopCategoryIds", query.ShopCategoryIDs,
	), response)
	if err != nil {
		return nil, err
	}
	if !response.Success || response.Data == nil {
		return nil, responseError(response.Message, "barry workbench metric response is empty")
	}
	return response.Data, nil
}

func responseError(message, fallback string) error {
	message = strings.TrimSpace(message)
	if message == "" {
		message = fallback
	}
	return fmt.Errorf("%s", message)
}
