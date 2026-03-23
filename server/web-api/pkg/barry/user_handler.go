package barry

import (
	commonRouter "common/middleware/routers"
	barryDTO "service/barry/dto"

	"github.com/gin-gonic/gin"
)

func (h *BarryHandler) registerUserRoutes(engine *gin.RouterGroup) {
	engine.GET("/barry/users", h.listUsers)
	engine.GET("/barry/user-points", h.listUserPoints)
	engine.GET("/barry/point-withdraws", h.listPointWithdraws)
}

func (h *BarryHandler) listUsers(c *gin.Context) {
	var q barryDTO.UserQueryDTO
	if c.ShouldBindQuery(&q) != nil {
		commonRouter.ToError(c, "参数错误")
		return
	}
	normalizeBarryPage(&q.PageQueryDTO)
	response, err := h.barryService.User.List(c.Request.Context(), q)
	if err != nil {
		commonRouter.ToJson(c, nil, err)
		return
	}
	commonRouter.ToJson(c, response.Data, nil)
}

func (h *BarryHandler) listUserPoints(c *gin.Context) {
	var q barryDTO.UserPointQueryDTO
	if c.ShouldBindQuery(&q) != nil {
		commonRouter.ToError(c, "参数错误")
		return
	}
	normalizeBarryPage(&q.PageQueryDTO)
	response, err := h.barryService.UserPoint.List(c.Request.Context(), q)
	if err != nil {
		commonRouter.ToJson(c, nil, err)
		return
	}
	commonRouter.ToJson(c, response.Data, nil)
}

func (h *BarryHandler) listPointWithdraws(c *gin.Context) {
	var q barryDTO.PointWithdrawQueryDTO
	if c.ShouldBindQuery(&q) != nil {
		commonRouter.ToError(c, "参数错误")
		return
	}
	normalizeBarryPage(&q.PageQueryDTO)
	response, err := h.barryService.PointWithdraw.List(c.Request.Context(), q)
	if err != nil {
		commonRouter.ToJson(c, nil, err)
		return
	}
	commonRouter.ToJson(c, response.Data, nil)
}
