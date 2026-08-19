package barry

import (
	commonRouter "common/middleware/routers"
	barryDTO "suffer/service/barry/dto"

	"github.com/gin-gonic/gin"
)

func (h *BarryHandler) registerOrderFetchMonitorRoutes(engine *gin.RouterGroup) {
	engine.GET("/barry/order-fetch-monitor/users", h.listOrderFetchMonitorUsers)
	engine.GET("/barry/order-fetch-monitor/uids", h.listOrderFetchMonitorUIDs)
	engine.GET("/barry/assign-queue/uid", h.listUserAssignQueues)
	engine.POST("/barry/assign-queue/fetch-task", h.fetchUserTask)
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

func (h *BarryHandler) listUserAssignQueues(c *gin.Context) {
	var query barryDTO.UserAssignQueueQueryDTO
	if c.ShouldBindQuery(&query) != nil {
		commonRouter.ToError(c, "参数错误")
		return
	}
	response, err := h.barryService.UserAssignQueue.UID(c.Request.Context(), query)
	commonRouter.ToJson(c, response, err)
}

func (h *BarryHandler) fetchUserTask(c *gin.Context) {
	var query barryDTO.UserFetchTaskQueryDTO
	if c.ShouldBindJSON(&query) != nil {
		commonRouter.ToError(c, "参数错误")
		return
	}
	response, err := h.barryService.UserAssignQueue.FetchTask(c.Request.Context(), query)
	commonRouter.ToJson(c, response, err)
}
