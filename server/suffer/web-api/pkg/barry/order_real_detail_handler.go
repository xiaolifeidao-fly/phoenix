package barry

import (
	commonRouter "common/middleware/routers"

	"github.com/gin-gonic/gin"
)

func (h *BarryHandler) registerOrderRealDetailRoutes(engine *gin.RouterGroup) {
	engine.GET("/barry/order-real-detail", h.getOrderRealDetail)
}

// getOrderRealDetail 订单补款前查实时数据：平台当前值、实际增量、barry 审核情况
func (h *BarryHandler) getOrderRealDetail(c *gin.Context) {
	var query struct {
		OrderID string `form:"orderId" binding:"required"`
	}
	if c.ShouldBindQuery(&query) != nil {
		commonRouter.ToError(c, "参数错误")
		return
	}
	response, err := h.barryService.OrderRealDetail.Detail(c.Request.Context(), query.OrderID)
	commonRouter.ToJson(c, response, err)
}
