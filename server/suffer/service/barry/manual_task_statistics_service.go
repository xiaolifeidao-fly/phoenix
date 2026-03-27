package barry

import (
	"context"
	"fmt"
	"slices"
	"strings"
	"time"

	"common/middleware/db"
	barryDTO "suffer/service/barry/dto"
	shopRepository "suffer/service/shop/repository"
)

const (
	manualTaskStatisticsDateLayout = "2006-01-02"
	manualTaskStatisticsMaxDays    = 31
)

type ManualTaskStatisticsService struct {
	orderSummaryService *OrderSummaryService
	shopGroupRepository *shopRepository.ShopGroupRepository
}

func NewManualTaskStatisticsService(orderSummaryService *OrderSummaryService) *ManualTaskStatisticsService {
	return &ManualTaskStatisticsService{
		orderSummaryService: orderSummaryService,
		shopGroupRepository: db.GetRepository[shopRepository.ShopGroupRepository](),
	}
}

func (s *ManualTaskStatisticsService) Summary(ctx context.Context, query barryDTO.ManualTaskStatisticsQueryDTO) (*barryDTO.ManualTaskStatisticsDTO, error) {
	if s.shopGroupRepository == nil || s.shopGroupRepository.Db == nil {
		return nil, fmt.Errorf("database is not initialized")
	}

	startDate, endDate, err := normalizeManualTaskStatisticsRange(query.StartDate, query.EndDate)
	if err != nil {
		return nil, err
	}

	groupOptions, err := s.listGroupOptions()
	if err != nil {
		return nil, err
	}

	groups, err := s.listTargetGroups(query)
	if err != nil {
		return nil, err
	}

	result := &barryDTO.ManualTaskStatisticsDTO{
		StartDate:    startDate.Format(manualTaskStatisticsDateLayout),
		EndDate:      endDate.Format(manualTaskStatisticsDateLayout),
		GroupCount:   len(groups),
		DetailList:   make([]*barryDTO.ManualTaskStatisticsDetailDTO, 0, len(groups)),
		GroupOptions: groupOptions,
	}

	if len(groups) == 0 {
		return result, nil
	}

	for _, group := range groups {
		detail, err := s.buildGroupSummary(ctx, group, startDate, endDate)
		if err != nil {
			return nil, err
		}
		result.TotalNum += detail.TotalNum
		result.PendingNum += detail.PendingNum
		result.WaitNum += detail.WaitNum
		result.DoneNum += detail.DoneNum
		result.ErrorNum += detail.ErrorNum
		result.DetailList = append(result.DetailList, detail)
	}

	slices.SortFunc(result.DetailList, func(a, b *barryDTO.ManualTaskStatisticsDetailDTO) int {
		if a == nil || b == nil {
			return 0
		}
		if a.DoneNum != b.DoneNum {
			return compareInt64Desc(a.DoneNum, b.DoneNum)
		}
		if a.WaitNum != b.WaitNum {
			return compareInt64Desc(a.WaitNum, b.WaitNum)
		}
		return strings.Compare(a.Name, b.Name)
	})

	return result, nil
}

func (s *ManualTaskStatisticsService) buildGroupSummary(ctx context.Context, group *shopRepository.ShopGroup, startDate, endDate time.Time) (*barryDTO.ManualTaskStatisticsDetailDTO, error) {
	code := manualTaskStatisticsGroupCode(group)
	if code == "" {
		return &barryDTO.ManualTaskStatisticsDetailDTO{
			ShopGroupID:  int64(group.Id),
			Name:         manualTaskStatisticsGroupName(group),
			BusinessType: strings.TrimSpace(group.BusinessType),
			BusinessCode: strings.TrimSpace(group.BusinessCode),
		}, nil
	}

	detail := &barryDTO.ManualTaskStatisticsDetailDTO{
		ShopGroupID:  int64(group.Id),
		Name:         manualTaskStatisticsGroupName(group),
		BusinessType: strings.TrimSpace(group.BusinessType),
		BusinessCode: strings.TrimSpace(group.BusinessCode),
	}

	for current := startDate; !current.After(endDate); current = current.AddDate(0, 0, 1) {
		response, err := s.orderSummaryService.RecordSummary(ctx, code, current.Format(manualTaskStatisticsDateLayout))
		if err != nil {
			return nil, err
		}
		if response == nil || response.Data == nil {
			continue
		}
		detail.TotalNum += response.Data.TotalNum
		detail.PendingNum += response.Data.PendingNum
		detail.WaitNum += response.Data.UnCheckNum
		detail.DoneNum += response.Data.CheckedNum
		detail.ErrorNum += response.Data.CheckErrorNum
	}

	detail.CompletionCount = detail.WaitNum + detail.DoneNum
	if detail.CompletionCount > 0 {
		detail.CompletionRate = float64(detail.DoneNum) / float64(detail.CompletionCount)
	}
	return detail, nil
}

func (s *ManualTaskStatisticsService) listTargetGroups(query barryDTO.ManualTaskStatisticsQueryDTO) ([]*shopRepository.ShopGroup, error) {
	dbQuery := s.shopGroupRepository.Db.Model(&shopRepository.ShopGroup{}).
		Where("active = ?", 1).
		Where("dashboard_active = ?", 1)

	if query.ShopGroupID > 0 {
		dbQuery = dbQuery.Where("id = ?", query.ShopGroupID)
	}
	if keyword := strings.TrimSpace(query.Keyword); keyword != "" {
		likeValue := "%" + keyword + "%"
		dbQuery = dbQuery.Where(
			"name LIKE ? OR dashboard_title LIKE ? OR business_type LIKE ? OR business_code LIKE ?",
			likeValue, likeValue, likeValue, likeValue,
		)
	}

	var groups []*shopRepository.ShopGroup
	err := dbQuery.Order("dashboard_sort_id ASC").Order("id ASC").Find(&groups).Error
	return groups, err
}

func (s *ManualTaskStatisticsService) listGroupOptions() ([]*barryDTO.ManualTaskStatisticsGroupOptionDTO, error) {
	var groups []*shopRepository.ShopGroup
	err := s.shopGroupRepository.Db.Model(&shopRepository.ShopGroup{}).
		Where("active = ?", 1).
		Where("dashboard_active = ?", 1).
		Order("dashboard_sort_id ASC").
		Order("id ASC").
		Find(&groups).Error
	if err != nil {
		return nil, err
	}

	options := make([]*barryDTO.ManualTaskStatisticsGroupOptionDTO, 0, len(groups))
	for _, group := range groups {
		options = append(options, &barryDTO.ManualTaskStatisticsGroupOptionDTO{
			ID:            int64(group.Id),
			Name:          manualTaskStatisticsGroupName(group),
			BusinessType:  strings.TrimSpace(group.BusinessType),
			BusinessCode:  strings.TrimSpace(group.BusinessCode),
			DashboardSort: group.DashboardSortID,
		})
	}
	return options, nil
}

func normalizeManualTaskStatisticsRange(startDateValue, endDateValue string) (time.Time, time.Time, error) {
	location := time.Local
	now := time.Now().In(location)
	defaultDate := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, location)

	startDate := defaultDate
	endDate := defaultDate
	var err error

	if strings.TrimSpace(startDateValue) != "" {
		startDate, err = time.ParseInLocation(manualTaskStatisticsDateLayout, strings.TrimSpace(startDateValue), location)
		if err != nil {
			return time.Time{}, time.Time{}, fmt.Errorf("invalid startDate, expected %s", manualTaskStatisticsDateLayout)
		}
	}
	if strings.TrimSpace(endDateValue) != "" {
		endDate, err = time.ParseInLocation(manualTaskStatisticsDateLayout, strings.TrimSpace(endDateValue), location)
		if err != nil {
			return time.Time{}, time.Time{}, fmt.Errorf("invalid endDate, expected %s", manualTaskStatisticsDateLayout)
		}
	} else {
		endDate = startDate
	}

	if endDate.Before(startDate) {
		return time.Time{}, time.Time{}, fmt.Errorf("endDate must be greater than or equal to startDate")
	}
	if int(endDate.Sub(startDate).Hours()/24)+1 > manualTaskStatisticsMaxDays {
		return time.Time{}, time.Time{}, fmt.Errorf("date range cannot exceed %d days", manualTaskStatisticsMaxDays)
	}

	return startDate, endDate, nil
}

func manualTaskStatisticsGroupName(group *shopRepository.ShopGroup) string {
	if group == nil {
		return ""
	}
	if value := strings.TrimSpace(group.DashboardTitle); value != "" {
		return value
	}
	if value := strings.TrimSpace(group.Name); value != "" {
		return value
	}
	return strings.TrimSpace(group.Code)
}

func manualTaskStatisticsGroupCode(group *shopRepository.ShopGroup) string {
	if group == nil {
		return ""
	}
	for _, value := range []string{group.BusinessType, group.BusinessCode, group.Code} {
		if trimmed := strings.TrimSpace(value); trimmed != "" {
			return trimmed
		}
	}
	return ""
}

func compareInt64Desc(left, right int64) int {
	switch {
	case left > right:
		return -1
	case left < right:
		return 1
	default:
		return 0
	}
}
