package barry

import (
	commonRouter "common/middleware/routers"
	"context"
	barryDTO "suffer/service/barry/dto"

	"github.com/gin-gonic/gin"
)

func (h *BarryHandler) registerTransactionRoutes(engine *gin.RouterGroup) {
	engine.GET("/barry/entries", h.listEntries)
	engine.GET("/barry/returns", h.listReturns)
	engine.GET("/barry/order-summaries", h.listOrderSummaries)
	engine.GET("/barry/manual-task-statistics", h.getManualTaskStatistics)
	engine.GET("/barry/manual-order-details", h.getManualOrderDetails)
	engine.GET("/barry/manual-order-details/sec-uid", h.getManualOrderDetailSecUid)
	engine.GET("/barry/workbench-dashboard/user-overview", h.getWorkbenchUserOverview)
	engine.GET("/barry/workbench-dashboard/user-online-overview", h.getWorkbenchUserOnlineOverview)
	engine.GET("/barry/workbench-dashboard/task-remaining", h.getWorkbenchTaskRemaining)
	engine.GET("/barry/workbench-dashboard/manual-submitted", h.getWorkbenchManualSubmitted)
	engine.GET("/barry/workbench-dashboard/manual-speed", h.getWorkbenchManualSpeed)
	engine.GET("/barry/workbench-dashboard/manual-submitted-comparison", h.getWorkbenchManualSubmittedComparison)
	engine.GET("/barry/workbench-dashboard/actual-completed", h.getWorkbenchActualCompleted)
	engine.GET("/barry/manual-task-statistics/users", h.listManualTaskStatisticUsers)
}

func (h *BarryHandler) listEntries(c *gin.Context) {
	var q barryDTO.EntryQueryDTO
	if c.ShouldBindQuery(&q) != nil {
		commonRouter.ToError(c, "参数错误")
		return
	}
	normalizeBarryPage(&q.PageQueryDTO)
	response, err := h.barryService.Entry.List(c.Request.Context(), q)
	if err != nil {
		commonRouter.ToJson(c, nil, err)
		return
	}
	commonRouter.ToJson(c, response.Data, nil)
}

func (h *BarryHandler) listReturns(c *gin.Context) {
	var q barryDTO.ReturnQueryDTO
	if c.ShouldBindQuery(&q) != nil {
		commonRouter.ToError(c, "参数错误")
		return
	}
	normalizeBarryPage(&q.PageQueryDTO)
	response, err := h.barryService.Return.List(c.Request.Context(), q)
	if err != nil {
		commonRouter.ToJson(c, nil, err)
		return
	}
	commonRouter.ToJson(c, response.Data, nil)
}

func (h *BarryHandler) listOrderSummaries(c *gin.Context) {
	var q barryDTO.OrderSummaryQueryDTO
	if c.ShouldBindQuery(&q) != nil {
		commonRouter.ToError(c, "参数错误")
		return
	}
	normalizeBarryPage(&q.PageQueryDTO)
	response, err := h.barryService.OrderSummary.List(c.Request.Context(), q)
	if err != nil {
		commonRouter.ToJson(c, nil, err)
		return
	}
	commonRouter.ToJson(c, response.Data, nil)
}

func (h *BarryHandler) getManualTaskStatistics(c *gin.Context) {
	var q barryDTO.ManualTaskStatisticsQueryDTO
	if c.ShouldBindQuery(&q) != nil {
		commonRouter.ToError(c, "参数错误")
		return
	}
	response, err := h.barryService.ManualTaskStats.Summary(c.Request.Context(), q)
	if err != nil {
		commonRouter.ToJson(c, nil, err)
		return
	}
	commonRouter.ToJson(c, response, nil)
}

func (h *BarryHandler) getManualOrderDetails(c *gin.Context) {
	var q barryDTO.ManualOrderDetailQueryDTO
	if c.ShouldBindQuery(&q) != nil {
		commonRouter.ToError(c, "参数错误")
		return
	}
	response, err := h.barryService.ManualOrderDetails.List(c.Request.Context(), q)
	if err != nil {
		commonRouter.ToJson(c, nil, err)
		return
	}
	commonRouter.ToJson(c, response, nil)
}

func (h *BarryHandler) getManualOrderDetailSecUid(c *gin.Context) {
	var q struct {
		UserID int64  `form:"userId" binding:"required"`
		UID    string `form:"uid" binding:"required"`
	}
	if c.ShouldBindQuery(&q) != nil {
		commonRouter.ToError(c, "参数错误")
		return
	}
	secUID, err := h.barryService.ManualOrderDetails.FindLatestSecUID(c.Request.Context(), q.UserID, q.UID)
	if err != nil {
		commonRouter.ToJson(c, nil, err)
		return
	}
	commonRouter.ToJson(c, secUID, nil)
}

func (h *BarryHandler) getWorkbenchUserOverview(c *gin.Context) {
	var q barryDTO.WorkbenchDashboardMetricQueryDTO
	if c.ShouldBindQuery(&q) != nil {
		commonRouter.ToError(c, "参数错误")
		return
	}
	response, err := h.barryService.WorkbenchDashboardStats.UserOverview(c.Request.Context(), q)
	commonRouter.ToJson(c, response, err)
}

func (h *BarryHandler) getWorkbenchUserOnlineOverview(c *gin.Context) {
	var q barryDTO.WorkbenchDashboardMetricQueryDTO
	if c.ShouldBindQuery(&q) != nil {
		commonRouter.ToError(c, "参数错误")
		return
	}
	response, err := h.barryService.WorkbenchDashboardStats.UserOnlineOverview(c.Request.Context(), q)
	commonRouter.ToJson(c, response, err)
}

func (h *BarryHandler) getWorkbenchTaskRemaining(c *gin.Context) {
	h.getWorkbenchMetric(c, h.barryService.WorkbenchDashboardStats.TaskRemaining)
}

func (h *BarryHandler) getWorkbenchManualSubmitted(c *gin.Context) {
	h.getWorkbenchMetric(c, h.barryService.WorkbenchDashboardStats.ManualSubmitted)
}

func (h *BarryHandler) getWorkbenchManualSpeed(c *gin.Context) {
	var q barryDTO.WorkbenchDashboardMetricQueryDTO
	if c.ShouldBindQuery(&q) != nil {
		commonRouter.ToError(c, "参数错误")
		return
	}
	response, err := h.barryService.WorkbenchDashboardStats.ManualSpeed(c.Request.Context(), q)
	commonRouter.ToJson(c, response, err)
}

func (h *BarryHandler) getWorkbenchManualSubmittedComparison(c *gin.Context) {
	var q barryDTO.WorkbenchDashboardMetricQueryDTO
	if c.ShouldBindQuery(&q) != nil {
		commonRouter.ToError(c, "参数错误")
		return
	}
	response, err := h.barryService.WorkbenchDashboardStats.ManualSubmittedComparison(c.Request.Context(), q)
	commonRouter.ToJson(c, response, err)
}

func (h *BarryHandler) getWorkbenchActualCompleted(c *gin.Context) {
	h.getWorkbenchMetric(c, h.barryService.WorkbenchDashboardStats.ActualCompleted)
}

func (h *BarryHandler) getWorkbenchMetric(c *gin.Context, getter func(context.Context, barryDTO.WorkbenchDashboardMetricQueryDTO) (*barryDTO.WorkbenchDashboardMetricDTO, error)) {
	var q barryDTO.WorkbenchDashboardMetricQueryDTO
	if c.ShouldBindQuery(&q) != nil {
		commonRouter.ToError(c, "参数错误")
		return
	}
	response, err := getter(c.Request.Context(), q)
	commonRouter.ToJson(c, response, err)
}

func (h *BarryHandler) listManualTaskStatisticUsers(c *gin.Context) {
	users, err := h.barryService.ManualTaskStats.Users(c.Request.Context(), c.Query("keyword"))
	if err != nil {
		commonRouter.ToJson(c, nil, err)
		return
	}
	commonRouter.ToJson(c, users, nil)
}
