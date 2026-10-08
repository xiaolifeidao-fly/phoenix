package barry

import (
	"context"
	"fmt"
	"net/url"
	"strings"
	"time"

	barryDTO "suffer/service/barry/dto"
)

const (
	withdrawSummaryDateLayout = "2006-01-02"
	withdrawSummaryTimeLayout = "2006-01-02 15:04:05"
	// WithdrawSummaryMaxDays 按天逐日调用 barry, 限制跨度避免一次查询打出过多请求.
	WithdrawSummaryMaxDays = 31
)

// WithdrawSummaryService 人工提现汇总: 迁移自老管理端「提现汇总」.
// barry /point/withdrawSummary 只按状态汇总一个时间窗, 按天拆分与状态归类在这里完成(与老管理端 Kakrolot 口径一致).
type WithdrawSummaryService struct {
	client *Client
}

func NewWithdrawSummaryService(client *Client) *WithdrawSummaryService {
	return &WithdrawSummaryService{client: client}
}

// ParseWithdrawSummaryRange 解析 yyyy-MM-dd 闭区间, 返回 [start 00:00, end+1 00:00).
func ParseWithdrawSummaryRange(startDate, endDate string) (time.Time, time.Time, error) {
	start, err := time.ParseInLocation(withdrawSummaryDateLayout, strings.TrimSpace(startDate), time.Local)
	if err != nil {
		return time.Time{}, time.Time{}, fmt.Errorf("开始日期格式错误，应为 yyyy-MM-dd")
	}
	end, err := time.ParseInLocation(withdrawSummaryDateLayout, strings.TrimSpace(endDate), time.Local)
	if err != nil {
		return time.Time{}, time.Time{}, fmt.Errorf("结束日期格式错误，应为 yyyy-MM-dd")
	}
	if end.Before(start) {
		return time.Time{}, time.Time{}, fmt.Errorf("结束日期不能早于开始日期")
	}
	endExclusive := end.AddDate(0, 0, 1)
	if days := int(endExclusive.Sub(start).Hours()/24 + 0.5); days > WithdrawSummaryMaxDays {
		return time.Time{}, time.Time{}, fmt.Errorf("日期跨度不能超过 %d 天", WithdrawSummaryMaxDays)
	}
	return start, endExclusive, nil
}

// List 按天汇总, 只返回有提现记录的日期, 日期升序.
func (s *WithdrawSummaryService) List(ctx context.Context, channel string, start, endExclusive time.Time) ([]*barryDTO.WithdrawSummaryDTO, error) {
	rows := make([]*barryDTO.WithdrawSummaryDTO, 0)
	for day := start; day.Before(endExclusive); day = day.AddDate(0, 0, 1) {
		response := &barryDTO.ListResponseDTO[barryDTO.WithdrawSummaryItemDTO]{}
		requestURL := buildWithdrawSummaryURL(barryInnerPointWithdrawSummaryPath, channel, day, day.AddDate(0, 0, 1))
		if err := s.client.GetAbsolute(ctx, requestURL, nil, response); err != nil {
			return nil, err
		}
		if !response.Success {
			return nil, fmt.Errorf("%s", firstNonBlank(response.Message, "查询提现汇总失败"))
		}
		if len(response.Data) == 0 {
			continue
		}
		rows = append(rows, BuildWithdrawSummaryRow(channel, day.Format(withdrawSummaryDateLayout), response.Data))
	}
	return rows, nil
}

// Account 批量发起结算: barry 异步把区间内 APPROVING 的记录推进到 ACCOUNTING.
func (s *WithdrawSummaryService) Account(ctx context.Context, channel string, start, endExclusive time.Time) (*barryDTO.ActionResponseDTO, error) {
	return s.action(ctx, barryInnerPointWithdrawSummaryAccountPath, channel, start, endExclusive)
}

// Finish 批量发起核销: barry 异步把区间内 ACCOUNTING 的记录推进到 FINISH.
func (s *WithdrawSummaryService) Finish(ctx context.Context, channel string, start, endExclusive time.Time) (*barryDTO.ActionResponseDTO, error) {
	return s.action(ctx, barryInnerPointWithdrawSummaryFinishPath, channel, start, endExclusive)
}

func (s *WithdrawSummaryService) action(ctx context.Context, configKey, channel string, start, endExclusive time.Time) (*barryDTO.ActionResponseDTO, error) {
	response := &barryDTO.ActionResponseDTO{}
	err := s.client.GetAbsolute(ctx, buildWithdrawSummaryURL(configKey, channel, start, endExclusive), nil, response)
	if err != nil {
		return nil, err
	}
	return response, nil
}

func buildWithdrawSummaryURL(configKey, channel string, start, endExclusive time.Time) string {
	requestURL := innerServicePath(configKey)
	requestURL = strings.ReplaceAll(requestURL, "{channel}", url.QueryEscape(strings.TrimSpace(channel)))
	requestURL = strings.ReplaceAll(requestURL, "{startTime}", url.QueryEscape(start.Format(withdrawSummaryTimeLayout)))
	requestURL = strings.ReplaceAll(requestURL, "{endTime}", url.QueryEscape(endExclusive.Format(withdrawSummaryTimeLayout)))
	return requestURL
}

// BuildWithdrawSummaryRow 状态归类同老管理端: 审核中=UN_APPROVE+APPROVING, 结算中=ACCOUNTING, 提现完成=FINISH, 提现失败=ERROR;
// 取消/待完成不计入.
func BuildWithdrawSummaryRow(channel, date string, items []*barryDTO.WithdrawSummaryItemDTO) *barryDTO.WithdrawSummaryDTO {
	row := &barryDTO.WithdrawSummaryDTO{Date: date, Channel: channel}
	for _, item := range items {
		if item == nil {
			continue
		}
		switch item.Status {
		case "UN_APPROVE", "APPROVING":
			row.ApprovingNum += item.Number
			row.ApprovingPoints += item.Points
		case "ACCOUNTING":
			row.AccountingNum += item.Number
			row.AccountingPoints += item.Points
		case "FINISH":
			row.FinishNum += item.Number
			row.FinishPoints += item.Points
		case "ERROR":
			row.ErrorNum += item.Number
			row.ErrorPoints += item.Points
		}
	}
	return row
}

func firstNonBlank(values ...string) string {
	for _, value := range values {
		if strings.TrimSpace(value) != "" {
			return value
		}
	}
	return ""
}
