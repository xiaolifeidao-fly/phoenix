package barry

import (
	commonRouter "common/middleware/routers"
	barryDTO "suffer/service/barry/dto"

	"github.com/gin-gonic/gin"
)

func (h *BarryHandler) registerOrderFetchMonitorRoutes(engine *gin.RouterGroup) {
	engine.GET("/barry/order-fetch-monitor/users", h.listOrderFetchMonitorUsers)
	engine.GET("/barry/order-fetch-monitor/uids", h.listOrderFetchMonitorUIDs)
}

func (h *BarryHandler) listOrderFetchMonitorUsers(c *gin.Context) {
	var query barryDTO.OrderFetchMonitorUsersQueryDTO
	if c.ShouldBindQuery(&query) != nil {
		commonRouter.ToError(c, "参数错误")
		return
	}
	response, err := h.barryService.OrderFetchMonitor.Users(c.Request.Context(), query)
	commonRouter.ToJson(c, response, err)
}

func (h *BarryHandler) listOrderFetchMonitorUIDs(c *gin.Context) {
	var query barryDTO.OrderFetchMonitorUIDsQueryDTO
	if c.ShouldBindQuery(&query) != nil {
		commonRouter.ToError(c, "参数错误")
		return
	}
	response, err := h.barryService.OrderFetchMonitor.UIDs(c.Request.Context(), query)
	commonRouter.ToJson(c, response, err)
}
