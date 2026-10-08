package barry

import (
	"context"
	commonRouter "common/middleware/routers"
	"strings"
	"time"

	barryService "suffer/service/barry"
	barryDTO "suffer/service/barry/dto"

	"github.com/gin-gonic/gin"
)

// 人工 - 提现和结算管理 - 提现汇总(迁移自老管理端). 提现记录复用 GET /barry/user-withdraw-records.
func (h *BarryHandler) registerWithdrawSummaryRoutes(engine *gin.RouterGroup) {
	engine.GET("/barry/withdraw-summaries", h.listWithdrawSummaries)
	engine.POST("/barry/withdraw-summaries/account", h.accountWithdrawSummary)
	engine.POST("/barry/withdraw-summaries/finish", h.finishWithdrawSummary)
}

func (h *BarryHandler) listWithdrawSummaries(c *gin.Context) {
	var q barryDTO.WithdrawSummaryQueryDTO
	if c.ShouldBindQuery(&q) != nil {
		commonRouter.ToError(c, "参数错误")
		return
	}
	channel, start, endExclusive, msg := parseWithdrawSummaryQuery(&q)
	if msg != "" {
		commonRouter.ToError(c, msg)
		return
	}
	rows, err := h.barryService.WithdrawSummary.List(c.Request.Context(), channel, start, endExclusive)
	if err != nil {
		commonRouter.ToJson(c, nil, err)
		return
	}
	commonRouter.ToJson(c, rows, nil)
}

func (h *BarryHandler) accountWithdrawSummary(c *gin.Context) {
	h.handleWithdrawSummaryAction(c, "发起积分结算失败", h.barryService.WithdrawSummary.Account)
}

func (h *BarryHandler) finishWithdrawSummary(c *gin.Context) {
	h.handleWithdrawSummaryAction(c, "发起积分核销失败", h.barryService.WithdrawSummary.Finish)
}

func (h *BarryHandler) handleWithdrawSummaryAction(c *gin.Context, fallbackMessage string,
	operation func(ctx context.Context, channel string, start, endExclusive time.Time) (*barryDTO.ActionResponseDTO, error)) {
	var req barryDTO.WithdrawSummaryQueryDTO
	if c.ShouldBindJSON(&req) != nil {
		commonRouter.ToError(c, "参数错误")
		return
	}
	channel, start, endExclusive, msg := parseWithdrawSummaryQuery(&req)
	if msg != "" {
		commonRouter.ToError(c, msg)
		return
	}
	response, err := operation(c.Request.Context(), channel, start, endExclusive)
	if err != nil {
		commonRouter.ToJson(c, nil, err)
		return
	}
	if !response.Success {
		commonRouter.ToError(c, firstNonEmpty(response.Message, fallbackMessage))
		return
	}
	commonRouter.ToJson(c, "已提交，后台异步处理", nil)
}

// parseWithdrawSummaryQuery 渠道必填(老管理端同样必填), 日期为 yyyy-MM-dd 闭区间.
func parseWithdrawSummaryQuery(q *barryDTO.WithdrawSummaryQueryDTO) (string, time.Time, time.Time, string) {
	channel := strings.TrimSpace(q.Channel)
	if channel == "" {
		return "", time.Time{}, time.Time{}, "请选择渠道"
	}
	start, endExclusive, err := barryService.ParseWithdrawSummaryRange(q.StartDate, q.EndDate)
	if err != nil {
		return "", time.Time{}, time.Time{}, err.Error()
	}
	return channel, start, endExclusive, ""
}
