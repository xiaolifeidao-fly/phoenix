package barry

import (
	commonRouter "common/middleware/routers"
	"strconv"
	"strings"

	barryDTO "suffer/service/barry/dto"

	"github.com/gin-gonic/gin"
)

// 监控补单数据: 当天补单单数与成本、补单明细、按人工商品筛选.
func (h *BarryHandler) registerDropRepairRoutes(engine *gin.RouterGroup) {
	engine.GET("/barry/drop-repair-summary", h.getDropRepairSummary)
	engine.GET("/barry/drop-repair-details", h.listDropRepairDetails)
	engine.GET("/barry/drop-monitor-summary", h.getDropMonitorSummary)
	engine.GET("/barry/drop-monitor-details", h.listDropMonitorDetails)
	engine.GET("/barry/drop-monitor-records", h.listDropMonitorRecords)
	engine.GET("/barry/drop-monitor-runtime", h.getDropMonitorRuntime)
	engine.GET("/barry/drop-monitor-job-records", h.listDropMonitorJobRecords)
}

// 运行健康度: 任务在不在跑、跑不跑得过来、有没有丢消息.
func (h *BarryHandler) getDropMonitorRuntime(c *gin.Context) {
	response, err := h.barryService.ShopDropMonitor.Runtime(c.Request.Context())
	commonRouter.ToJson(c, response, err)
}

// 定时任务每一轮的运行流水, 空轮次也有记录.
func (h *BarryHandler) listDropMonitorJobRecords(c *gin.Context) {
	var q barryDTO.ShopDropMonitorJobRecordQueryDTO
	if c.ShouldBindQuery(&q) != nil {
		commonRouter.ToError(c, "参数错误")
		return
	}
	if q.PageIndex <= 0 {
		q.PageIndex = 1
	}
	if q.PageSize <= 0 || q.PageSize > 200 {
		q.PageSize = 20
	}
	response, err := h.barryService.ShopDropMonitor.JobRecords(c.Request.Context(), q)
	commonRouter.ToJson(c, response, err)
}

// 掉量监控数据: 不开自动补单也能看到掉量情况, 灰度期定参数就靠它.
func (h *BarryHandler) getDropMonitorSummary(c *gin.Context) {
	var q barryDTO.ShopDropMonitorQueryDTO
	if c.ShouldBindQuery(&q) != nil {
		commonRouter.ToError(c, "参数错误")
		return
	}
	response, err := h.barryService.ShopDropMonitor.Summary(c.Request.Context(), q)
	commonRouter.ToJson(c, response, err)
}

func (h *BarryHandler) listDropMonitorDetails(c *gin.Context) {
	var q barryDTO.ShopDropMonitorQueryDTO
	if c.ShouldBindQuery(&q) != nil {
		commonRouter.ToError(c, "参数错误")
		return
	}
	if q.PageIndex <= 0 {
		q.PageIndex = 1
	}
	if q.PageSize <= 0 || q.PageSize > 200 {
		q.PageSize = 20
	}
	response, err := h.barryService.ShopDropMonitor.Query(c.Request.Context(), q)
	commonRouter.ToJson(c, response, err)
}

func (h *BarryHandler) listDropMonitorRecords(c *gin.Context) {
	monitorID, err := strconv.ParseInt(strings.TrimSpace(c.Query("monitorId")), 10, 64)
	if err != nil || monitorID <= 0 {
		commonRouter.ToError(c, "参数错误")
		return
	}
	response, recordErr := h.barryService.ShopDropMonitor.Records(c.Request.Context(), monitorID)
	commonRouter.ToJson(c, response, recordErr)
}

func (h *BarryHandler) getDropRepairSummary(c *gin.Context) {
	var q barryDTO.ShopDropRepairQueryDTO
	if c.ShouldBindQuery(&q) != nil {
		commonRouter.ToError(c, "参数错误")
		return
	}
	response, err := h.barryService.ShopDropRepair.Summary(c.Request.Context(), q)
	commonRouter.ToJson(c, response, err)
}

func (h *BarryHandler) listDropRepairDetails(c *gin.Context) {
	var q barryDTO.ShopDropRepairQueryDTO
	if c.ShouldBindQuery(&q) != nil {
		commonRouter.ToError(c, "参数错误")
		return
	}
	if q.PageIndex <= 0 {
		q.PageIndex = 1
	}
	if q.PageSize <= 0 || q.PageSize > 200 {
		q.PageSize = 20
	}
	response, err := h.barryService.ShopDropRepair.Query(c.Request.Context(), q)
	commonRouter.ToJson(c, response, err)
}
