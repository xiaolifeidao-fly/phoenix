package barry

import (
	commonRouter "common/middleware/routers"
	barryDTO "suffer/service/barry/dto"

	"github.com/gin-gonic/gin"
)

const defaultOrderManualDetailPageSize = 20

func (h *BarryHandler) registerOrderManualDetailRoutes(engine *gin.RouterGroup) {
	engine.GET("/barry/order-manual-details", h.getOrderManualDetails)
	engine.GET("/barry/order-manual-details/users", h.listOrderManualDetailUsers)
}

// getOrderManualDetails 订单管理「做单明细」弹框下方的明细分页
func (h *BarryHandler) getOrderManualDetails(c *gin.Context) {
	var query barryDTO.OrderManualDetailQueryDTO
	if c.ShouldBindQuery(&query) != nil {
		commonRouter.ToError(c, "参数错误")
		return
	}
	if query.Page <= 0 {
		query.Page = 1
	}
	if query.PageSize <= 0 {
		query.PageSize = defaultOrderManualDetailPageSize
	}
	response, err := h.barryService.OrderManualDetails.Page(c.Request.Context(), query)
	commonRouter.ToJson(c, response, err)
}

// listOrderManualDetailUsers 订单管理「做单明细」弹框上方的做单人分布
func (h *BarryHandler) listOrderManualDetailUsers(c *gin.Context) {
	var query struct {
		OrderID string `form:"orderId" binding:"required"`
	}
	if c.ShouldBindQuery(&query) != nil {
		commonRouter.ToError(c, "参数错误")
		return
	}
	response, err := h.barryService.OrderManualDetails.Users(c.Request.Context(), query.OrderID)
	commonRouter.ToJson(c, response, err)
}
