package barry

import (
	"context"
	"fmt"
	"strings"

	barryDTO "suffer/service/barry/dto"
)

// ReconciliationService 对账工作台(barry-gateway-pro /reconciliation).
type ReconciliationService struct {
	client *Client
}

func NewReconciliationService(client *Client) *ReconciliationService {
	return &ReconciliationService{client: client}
}

// ManualDimension 人工维度: 所选日期区间的任务数量(按人工商品)与积分数量(合计).
func (s *ReconciliationService) ManualDimension(ctx context.Context, query barryDTO.ReconManualDimensionQueryDTO) (*barryDTO.ReconManualDimensionDTO, error) {
	response := &barryDTO.DetailResponseDTO[barryDTO.ReconManualDimensionDTO]{}
	err := s.client.GetAbsolute(ctx, innerServicePath(barryInnerReconManualDimensionPath), buildValues(
		"startDate", query.StartDate,
		"endDate", query.EndDate,
	), response)
	if err != nil {
		return nil, err
	}
	if !response.Success || response.Data == nil {
		message := strings.TrimSpace(response.Message)
		if message == "" {
			message = "barry reconciliation manual dimension response is empty"
		}
		return nil, fmt.Errorf("%s", message)
	}
	if response.Data.ShopCategories == nil {
		response.Data.ShopCategories = []barryDTO.ReconManualDimensionShopCategoryDTO{}
	}
	return response.Data, nil
}

func (s *ReconciliationService) ListLedger(ctx context.Context, query barryDTO.ReconLedgerQueryDTO) (*barryDTO.ReconLedgerPageDTO, error) {
	response := &barryDTO.DetailResponseDTO[barryDTO.ReconLedgerPageDTO]{}
	err := s.client.GetAbsolute(ctx, innerServicePath(barryInnerReconLedgerListPath), buildValues(
		"startDate", query.StartDate,
		"endDate", query.EndDate,
		"recordType", query.RecordType,
		"category", query.Category,
		"sortField", query.SortField,
		"sortOrder", query.SortOrder,
		"page", query.Page,
		"pageSize", query.PageSize,
	), response)
	if err := unwrapReconResponse(response.Success, response.Data != nil, response.Message, err, "ledger list"); err != nil {
		return nil, err
	}
	if response.Data.Data == nil {
		response.Data.Data = []*barryDTO.ReconLedgerDTO{}
	}
	return response.Data, nil
}

// FindIncomeWithFee 按 ID 找某天的社区入账和它的代收手续费(barry 没有按 ID 查询, 只能按当天列表翻页找);
// 入账不存在返回 nil, 没有手续费时 fee 为 nil.
func (s *ReconciliationService) FindIncomeWithFee(ctx context.Context, ledgerID int64, recordDate string) (income, fee *barryDTO.ReconLedgerDTO, err error) {
	const pageSize = 100
	for page := 1; ; page++ {
		result, err := s.ListLedger(ctx, barryDTO.ReconLedgerQueryDTO{
			StartDate: recordDate,
			EndDate:   recordDate,
			Category:  "COMMUNITY_IN,COLLECT_FEE",
			SortField: "date",
			SortOrder: "asc",
			Page:      page,
			PageSize:  pageSize,
		})
		if err != nil {
			return nil, nil, err
		}
		for _, row := range result.Data {
			if row == nil || row.ID == nil {
				continue
			}
			if *row.ID == ledgerID {
				income = row
			} else if row.Category == "COLLECT_FEE" && row.ParentID != nil && *row.ParentID == ledgerID {
				fee = row
			}
		}
		if (income != nil && fee != nil) || len(result.Data) < pageSize {
			return income, fee, nil
		}
	}
}

func (s *ReconciliationService) LedgerSummary(ctx context.Context, startDate, endDate string) (*barryDTO.ReconLedgerSummaryDTO, error) {
	response := &barryDTO.DetailResponseDTO[barryDTO.ReconLedgerSummaryDTO]{}
	err := s.client.GetAbsolute(ctx, innerServicePath(barryInnerReconLedgerSummaryPath), buildValues(
		"startDate", startDate,
		"endDate", endDate,
	), response)
	if err := unwrapReconResponse(response.Success, response.Data != nil, response.Message, err, "ledger summary"); err != nil {
		return nil, err
	}
	return response.Data, nil
}

// SaveLedger ID 为空新增, 否则修改; 只能操作人工录入的记录, barry 侧校验.
func (s *ReconciliationService) SaveLedger(ctx context.Context, req *barryDTO.ReconLedgerDTO, operator string) (*barryDTO.ReconLedgerDTO, error) {
	if req == nil {
		return nil, fmt.Errorf("request is nil")
	}
	response := &barryDTO.DetailResponseDTO[barryDTO.ReconLedgerDTO]{}
	err := s.client.PostAbsolute(ctx, innerServicePath(barryInnerReconLedgerSavePath)+"?"+buildValues("operator", operator).Encode(), req, response)
	if err := unwrapReconResponse(response.Success, response.Data != nil, response.Message, err, "ledger save"); err != nil {
		return nil, err
	}
	return response.Data, nil
}

func (s *ReconciliationService) DeleteLedger(ctx context.Context, id int64, operator string) error {
	response := &barryDTO.DetailResponseDTO[string]{}
	err := s.client.PostAbsolute(ctx, innerServicePath(barryInnerReconLedgerDeletePath)+"?"+buildValues("id", id, "operator", operator).Encode(), nil, response)
	return unwrapReconResponse(response.Success, true, response.Message, err, "ledger delete")
}

// LedgerSnapshots 某条出入账的快照, 按版本升序; 没被人工改过的为空列表.
func (s *ReconciliationService) LedgerSnapshots(ctx context.Context, ledgerID int64) ([]*barryDTO.ReconLedgerSnapshotDTO, error) {
	response := &barryDTO.ListResponseDTO[barryDTO.ReconLedgerSnapshotDTO]{}
	err := s.client.GetAbsolute(ctx, innerServicePath(barryInnerReconLedgerSnapshotsPath), buildValues("ledgerId", ledgerID), response)
	if err := unwrapReconResponse(response.Success, true, response.Message, err, "ledger snapshots"); err != nil {
		return nil, err
	}
	if response.Data == nil {
		return []*barryDTO.ReconLedgerSnapshotDTO{}, nil
	}
	return response.Data, nil
}

// SyncWithdraw 补记区间内提现成功但还没记账的记录.
func (s *ReconciliationService) SyncWithdraw(ctx context.Context, startDate, endDate string) (*barryDTO.ReconLedgerSyncResultDTO, error) {
	response := &barryDTO.DetailResponseDTO[barryDTO.ReconLedgerSyncResultDTO]{}
	err := s.client.PostAbsolute(ctx, innerServicePath(barryInnerReconLedgerSyncWithdrawPath)+"?"+buildValues("startDate", startDate, "endDate", endDate).Encode(), nil, response)
	if err := unwrapReconResponse(response.Success, response.Data != nil, response.Message, err, "ledger sync withdraw"); err != nil {
		return nil, err
	}
	return response.Data, nil
}

// UpstreamSums 账户状态: 按窗口批量取上游社区的社区入账、代收手续费(RMB). 窗口为空时不发请求.
func (s *ReconciliationService) UpstreamSums(ctx context.Context, windows []barryDTO.ReconUpstreamSumDTO) ([]barryDTO.ReconUpstreamSumDTO, error) {
	if len(windows) == 0 {
		return []barryDTO.ReconUpstreamSumDTO{}, nil
	}
	response := &barryDTO.ListResponseDTO[barryDTO.ReconUpstreamSumDTO]{}
	err := s.client.PostAbsolute(ctx, innerServicePath(barryInnerReconLedgerUpstreamSumsPath), windows, response)
	if err != nil {
		return nil, err
	}
	if !response.Success {
		message := strings.TrimSpace(response.Message)
		if message == "" {
			message = "barry reconciliation upstream sums failed"
		}
		return nil, fmt.Errorf("%s", message)
	}
	result := make([]barryDTO.ReconUpstreamSumDTO, 0, len(response.Data))
	for _, item := range response.Data {
		if item != nil {
			result = append(result, *item)
		}
	}
	return result, nil
}

// LedgerDaily 出入账按天汇总, 区间内每天一行(barry 补 0), 日期升序; barry 侧区间最长 186 天.
func (s *ReconciliationService) LedgerDaily(ctx context.Context, startDate, endDate string) ([]barryDTO.ReconLedgerDailyDTO, error) {
	response := &barryDTO.ListResponseDTO[barryDTO.ReconLedgerDailyDTO]{}
	err := s.client.GetAbsolute(ctx, innerServicePath(barryInnerReconLedgerDailyPath), buildValues(
		"startDate", startDate,
		"endDate", endDate,
	), response)
	if err := unwrapReconResponse(response.Success, true, response.Message, err, "ledger daily"); err != nil {
		return nil, err
	}
	result := make([]barryDTO.ReconLedgerDailyDTO, 0, len(response.Data))
	for _, item := range response.Data {
		if item != nil {
			result = append(result, *item)
		}
	}
	return result, nil
}

// unwrapReconResponse 把请求错误和 barry 的业务失败统一成 error, 业务失败时保留 barry 的中文原因.
func unwrapReconResponse(success, hasData bool, message string, err error, action string) error {
	if err != nil {
		return err
	}
	if !success || !hasData {
		message = strings.TrimSpace(message)
		if message == "" {
			message = "barry reconciliation " + action + " response is empty"
		}
		return fmt.Errorf("%s", message)
	}
	return nil
}
