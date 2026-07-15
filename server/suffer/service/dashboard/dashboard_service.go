package dashboard

import (
	"math"
	"sort"
	dashboardDTO "suffer/service/dashboard/dto"
	dashboardRepository "suffer/service/dashboard/repository"
	"time"
)

// DashboardService contains the Kakrolot-compatible calculation rules for
// upstream financial and order statistics used by the new manager Web API.
type DashboardService struct {
	repository *dashboardRepository.DashboardRepository
}

func NewDashboardService() *DashboardService {
	return &DashboardService{repository: dashboardRepository.NewDashboardRepository()}
}

func (s *DashboardService) TodayConsumeSummary() (*dashboardDTO.ConsumeSummaryDTO, error) {
	start, end := todayRange()
	result, err := s.consumeSummary(start, end, true)
	if err != nil {
		return nil, err
	}

	yesterdayStart, yesterdayEnd := yesterdaySameTimeRange()
	yesterday, err := s.consumeSummary(yesterdayStart, yesterdayEnd, false)
	if err != nil {
		return nil, err
	}
	result.YesterdayAmount = yesterday.Amount
	result.AmountChange = result.Amount - result.YesterdayAmount
	result.AmountChangeRate = comparisonRate(result.AmountChange, result.YesterdayAmount)
	return result, nil
}

func (s *DashboardService) consumeSummary(start, end time.Time, includeDetails bool) (*dashboardDTO.ConsumeSummaryDTO, error) {
	// Single scan returns per-account CONSUMER/REFUND/BK sums, so the three separate
	// SumLedgerAmount scans are no longer needed: the total is derived from these rows.
	rows, err := s.repository.ListConsumeDetails(start, end)
	if err != nil {
		return nil, err
	}

	var totalConsume, totalRefund, totalBK float64
	result := &dashboardDTO.ConsumeSummaryDTO{
		DetailList: make([]dashboardDTO.ConsumeSummaryDetailDTO, 0, len(rows)),
	}
	for _, row := range rows {
		totalConsume += row.ConsumeAmount
		totalRefund += row.RefundAmount
		totalBK += row.BKAmount
		// Match the original card behaviour: only accounts that consumed in the
		// selected period appear in details. Refund/BK-only rows still affect totals.
		if !includeDetails || row.ConsumeAmount == 0 {
			continue
		}
		result.DetailList = append(result.DetailList, dashboardDTO.ConsumeSummaryDetailDTO{
			AccountID: row.AccountID, UserID: row.UserID, Username: row.Username, Remark: row.Remark,
			ConsumeAmount: math.Abs(row.ConsumeAmount), RefundAmount: row.RefundAmount, BKAmount: row.BKAmount,
		})
	}
	result.Amount = math.Abs(totalConsume) - math.Abs(totalRefund) - math.Abs(totalBK)
	return result, nil
}

func (s *DashboardService) TodayRechargeSummary() (*dashboardDTO.RechargeSummaryDTO, error) {
	start, end := todayRange()
	result, err := s.rechargeSummary(start, end, true)
	if err != nil {
		return nil, err
	}

	yesterdayStart, yesterdayEnd := yesterdaySameTimeRange()
	yesterday, err := s.rechargeSummary(yesterdayStart, yesterdayEnd, false)
	if err != nil {
		return nil, err
	}
	result.YesterdayAmount = yesterday.Amount
	result.AmountChange = result.Amount - result.YesterdayAmount
	result.AmountChangeRate = comparisonRate(result.AmountChange, result.YesterdayAmount)
	return result, nil
}

func (s *DashboardService) rechargeSummary(start, end time.Time, includeDetails bool) (*dashboardDTO.RechargeSummaryDTO, error) {
	total, err := s.repository.SumLedgerAmount([]string{"PAY", "GIVEN"}, start, end)
	if err != nil {
		return nil, err
	}
	if !includeDetails {
		return &dashboardDTO.RechargeSummaryDTO{Amount: math.Abs(total), DetailList: []dashboardDTO.RechargeSummaryDetailDTO{}}, nil
	}
	pays, err := s.repository.ListRechargeDetails("PAY", start, end)
	if err != nil {
		return nil, err
	}
	givens, err := s.repository.ListRechargeDetails("GIVEN", start, end)
	if err != nil {
		return nil, err
	}

	// Kakrolot exposes only accounts that have PAY records. GIVEN amounts are
	// matched by username after sorting the gift rows by amount.
	sort.SliceStable(givens, func(i, j int) bool { return givens[i].Amount > givens[j].Amount })
	firstGivenByUsername := make(map[string]float64, len(givens))
	for _, given := range givens {
		if _, exists := firstGivenByUsername[given.Username]; !exists {
			firstGivenByUsername[given.Username] = math.Abs(given.Amount)
		}
	}

	result := &dashboardDTO.RechargeSummaryDTO{
		Amount:     math.Abs(total),
		DetailList: make([]dashboardDTO.RechargeSummaryDetailDTO, 0, len(pays)),
	}
	for _, pay := range pays {
		result.DetailList = append(result.DetailList, dashboardDTO.RechargeSummaryDetailDTO{
			AccountID: pay.AccountID, UserID: pay.UserID, Username: pay.Username, Remark: pay.Remark,
			RechargeAmount: math.Abs(pay.Amount), GivenAmount: firstGivenByUsername[pay.Username],
		})
	}
	return result, nil
}

func (s *DashboardService) SystemBalanceSummary() (*dashboardDTO.SystemBalanceSummaryDTO, error) {
	rows, err := s.repository.ListSystemBalanceDetails()
	if err != nil {
		return nil, err
	}
	result := &dashboardDTO.SystemBalanceSummaryDTO{DetailList: make([]dashboardDTO.SystemBalanceSummaryDetailDTO, 0, len(rows))}
	for _, row := range rows {
		amount := math.Abs(row.BalanceAmount)
		result.Amount += amount
		result.DetailList = append(result.DetailList, dashboardDTO.SystemBalanceSummaryDetailDTO{
			AccountID: row.AccountID, UserID: row.UserID, Username: row.Username, Remark: row.Remark, AccountAmount: amount,
		})
	}
	return result, nil
}

func (s *DashboardService) TodayActualCompleted(shopCategoryIDs []uint64) (*dashboardDTO.ActualCompletedSummaryDTO, error) {
	todayStart, tomorrowStart := todayRange()
	yesterdayStart := todayStart.AddDate(0, 0, -1)
	_, yesterdaySameTimeEnd := yesterdaySameTimeRange()
	periodRows, err := s.repository.ActualCompletedPeriodsByCategory(todayStart, tomorrowStart, yesterdaySameTimeEnd, shopCategoryIDs)
	if err != nil {
		return nil, err
	}
	snapshotRows, err := s.repository.ActualCompletedSnapshotByCategory(yesterdayStart.Format("2006-01-02"), shopCategoryIDs)
	if err != nil {
		return nil, err
	}

	counts := make(map[uint64]*dashboardDTO.ActualCompletedCategoryDTO, len(shopCategoryIDs)+len(periodRows))
	for _, id := range shopCategoryIDs {
		counts[id] = &dashboardDTO.ActualCompletedCategoryDTO{ShopCategoryID: id}
	}
	for _, row := range periodRows {
		counts[row.ShopCategoryID] = &dashboardDTO.ActualCompletedCategoryDTO{
			ShopCategoryID: row.ShopCategoryID,
			Count:          row.TodayCount,
		}
	}
	snapshotCounts := categoryCounts(snapshotRows)
	result := &dashboardDTO.ActualCompletedSummaryDTO{CategoryList: make([]dashboardDTO.ActualCompletedCategoryDTO, 0, len(counts))}
	for _, row := range periodRows {
		category := counts[row.ShopCategoryID]
		if row.YesterdayCurrentCount > snapshotCounts[row.ShopCategoryID] {
			category.Count += row.YesterdayCurrentCount - snapshotCounts[row.ShopCategoryID]
		}
		result.Count += category.Count
		result.YesterdayCount += row.YesterdaySameCount
		result.PendingOrderCount += row.PendingOrderCount
		result.PendingCount += row.PendingCount
		result.TotalOrderCount += row.TotalOrderCount
		result.TotalCount += row.TotalCount
		result.CompletedOrderCount += row.CompletedOrderCount
	}
	for _, category := range counts {
		result.CategoryList = append(result.CategoryList, *category)
	}
	sort.Slice(result.CategoryList, func(left, right int) bool {
		return result.CategoryList[left].ShopCategoryID < result.CategoryList[right].ShopCategoryID
	})
	result.CountChange = result.Count - result.YesterdayCount
	result.CountChangeRate = comparisonRate(float64(result.CountChange), float64(result.YesterdayCount))
	return result, nil
}

func categoryCounts(rows []dashboardRepository.ActualCompletedCategoryRow) map[uint64]int64 {
	result := make(map[uint64]int64, len(rows))
	for _, row := range rows {
		result[row.ShopCategoryID] = row.Count
	}
	return result
}

func todayRange() (time.Time, time.Time) {
	now := time.Now()
	start := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, now.Location())
	return start, start.AddDate(0, 0, 1)
}

// Kakrolot's dashboard compares today's running total with yesterday's total at
// the same clock time, rather than with the whole of yesterday.
func yesterdaySameTimeRange() (time.Time, time.Time) {
	now := time.Now()
	todayStart := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, now.Location())
	return todayStart.AddDate(0, 0, -1), now.AddDate(0, 0, -1)
}

func comparisonRate(change, previous float64) float64 {
	if previous == 0 {
		return 0
	}
	return math.Round(change/previous*10000) / 100
}
