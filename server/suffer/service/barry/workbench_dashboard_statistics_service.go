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

func (s *WorkbenchDashboardStatisticsService) UserOverview(ctx context.Context, query barryDTO.WorkbenchDashboardMetricQueryDTO) (*barryDTO.WorkbenchUserOverviewDTO, error) {
	return s.userOverview(ctx, barryInnerWorkbenchDashboardUserOverviewPath, query)
}

func (s *WorkbenchDashboardStatisticsService) UserOnlineOverview(ctx context.Context, query barryDTO.WorkbenchDashboardMetricQueryDTO) (*barryDTO.WorkbenchUserOverviewDTO, error) {
	return s.userOverview(ctx, barryInnerWorkbenchDashboardUserOnlineOverviewPath, query)
}

func (s *WorkbenchDashboardStatisticsService) userOverview(ctx context.Context, configPath string, query barryDTO.WorkbenchDashboardMetricQueryDTO) (*barryDTO.WorkbenchUserOverviewDTO, error) {
	response := &barryDTO.DetailResponseDTO[barryDTO.WorkbenchUserOverviewDTO]{}
	if err := s.client.GetAbsolute(ctx, innerServicePath(configPath), buildValues(
		"windowSeconds", query.WindowSeconds,
	), response); err != nil {
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

func (s *WorkbenchDashboardStatisticsService) ManualSpeed(ctx context.Context, query barryDTO.WorkbenchDashboardMetricQueryDTO) (*barryDTO.WorkbenchDashboardManualSpeedDTO, error) {
	response := &barryDTO.DetailResponseDTO[barryDTO.WorkbenchDashboardManualSpeedDTO]{}
	err := s.client.GetAbsolute(ctx, innerServicePath(barryInnerWorkbenchDashboardManualSpeedPath), buildValues(
		"shopCategoryIds", query.ShopCategoryIDs,
		"shopCategoryCodes", query.ShopCategoryCodes,
		"windowSeconds", query.WindowSeconds,
	), response)
	if err != nil {
		return nil, err
	}
	if !response.Success || response.Data == nil {
		return nil, responseError(response.Message, "barry workbench manual speed response is empty")
	}
	return response.Data, nil
}

func (s *WorkbenchDashboardStatisticsService) PendingDetectionCount(ctx context.Context, query barryDTO.WorkbenchDashboardMetricQueryDTO) (*barryDTO.WorkbenchDashboardPendingDetectionCountDTO, error) {
	response := &barryDTO.DetailResponseDTO[barryDTO.WorkbenchDashboardPendingDetectionCountDTO]{}
	err := s.client.GetAbsolute(ctx, innerServicePath(barryInnerWorkbenchDashboardPendingDetectionCountPath), buildValues(
		"shopGroupIds", query.ShopGroupIDs,
	), response)
	if err != nil {
		return nil, err
	}
	if !response.Success || response.Data == nil {
		return nil, responseError(response.Message, "barry workbench pending detection count response is empty")
	}
	return response.Data, nil
}

func (s *WorkbenchDashboardStatisticsService) DelayAssignmentCount(ctx context.Context, query barryDTO.WorkbenchDashboardMetricQueryDTO) (*barryDTO.WorkbenchDashboardDelayAssignmentCountDTO, error) {
	response := &barryDTO.DetailResponseDTO[barryDTO.WorkbenchDashboardDelayAssignmentCountDTO]{}
	err := s.client.GetAbsolute(ctx, innerServicePath(barryInnerWorkbenchDashboardDelayAssignmentCountPath), buildValues(
		"shopCategoryIds", query.ShopCategoryIDs,
	), response)
	if err != nil {
		return nil, err
	}
	if !response.Success || response.Data == nil {
		return nil, responseError(response.Message, "barry workbench delay assignment count response is empty")
	}
	return response.Data, nil
}

// ManualSubmittedComparison delegates the selected categories to Barry. Barry reads
// today's order summary and yesterday's same-time data from order_minute_sum_record.
func (s *WorkbenchDashboardStatisticsService) ManualSubmittedComparison(ctx context.Context, query barryDTO.WorkbenchDashboardMetricQueryDTO) (*barryDTO.WorkbenchDashboardManualSubmittedComparisonDTO, error) {
	response := &barryDTO.DetailResponseDTO[barryDTO.WorkbenchDashboardManualSubmittedComparisonDTO]{}
	err := s.client.GetAbsolute(ctx, innerServicePath(barryInnerWorkbenchDashboardManualSubmittedComparisonPath), buildValues(
		"shopCategoryIds", query.ShopCategoryIDs,
		"shopCategoryCodes", query.ShopCategoryCodes,
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

// BridgeDailyStatistics resolves one configured 商品分组 + BridgeType scope in
// Barry, then aggregates its related Bridge configurations by calendar day.
func (s *WorkbenchDashboardStatisticsService) BridgeDailyStatistics(ctx context.Context, query barryDTO.BridgeDailyStatisticQueryDTO) (*barryDTO.BridgeDailyStatisticSummaryDTO, error) {
	response := &barryDTO.DetailResponseDTO[barryDTO.BridgeDailyStatisticSummaryDTO]{}
	err := s.client.GetAbsolute(ctx, innerServicePath(barryInnerWorkbenchDashboardBridgeDailyStatisticsPath), buildValues(
		"startDate", query.StartDate,
		"endDate", query.EndDate,
		"shopGroupIds", query.ShopGroupIDs,
		"bridgeType", query.BridgeType,
	), response)
	if err != nil {
		return nil, err
	}
	if !response.Success || response.Data == nil {
		return nil, responseError(response.Message, "barry workbench bridge daily statistics response is empty")
	}
	return response.Data, nil
}

// BridgeTypes returns Barry's authoritative BridgeType enum values for the
// workbench selector. Phoenix deliberately does not duplicate the enum.
func (s *WorkbenchDashboardStatisticsService) BridgeTypes(ctx context.Context) ([]string, error) {
	response := &barryDTO.ListResponseDTO[string]{}
	if err := s.client.GetAbsolute(ctx, innerServicePath(barryInnerWorkbenchDashboardBridgeTypesPath), nil, response); err != nil {
		return nil, err
	}
	if !response.Success {
		return nil, responseError(response.Message, "barry bridge types response is empty")
	}

	bridgeTypes := make([]string, 0, len(response.Data))
	for _, bridgeType := range response.Data {
		if bridgeType == nil || strings.TrimSpace(*bridgeType) == "" {
			continue
		}
		bridgeTypes = append(bridgeTypes, strings.TrimSpace(*bridgeType))
	}
	return bridgeTypes, nil
}

func (s *WorkbenchDashboardStatisticsService) metric(ctx context.Context, configPath string, query barryDTO.WorkbenchDashboardMetricQueryDTO) (*barryDTO.WorkbenchDashboardMetricDTO, error) {
	response := &barryDTO.DetailResponseDTO[barryDTO.WorkbenchDashboardMetricDTO]{}
	err := s.client.GetAbsolute(ctx, innerServicePath(configPath), buildValues(
		"startDate", query.StartDate,
		"endDate", query.EndDate,
		"shopCategoryIds", query.ShopCategoryIDs,
		"shopCategoryCodes", query.ShopCategoryCodes,
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
