package order

import (
	commonRouter "common/middleware/routers"
	authService "suffer/service/auth"
	orderDTO "suffer/service/order/dto"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// listOrderRecordAmountDetails 订单金额明细（订单明细）
func (h *OrderHandler) listOrderRecordAmountDetails(c *gin.Context) {
	id, ok := parseOrderID(c)
	if !ok {
		return
	}
	r, e := h.orderService.ListOrderAmountDetails(orderDTO.OrderAmountDetailQueryDTO{
		OrderID:  uint64(id),
		PageSize: 200,
	})
	commonRouter.ToJson(c, r, e)
}

// refundOrderRecord 订单退单
func (h *OrderHandler) refundOrderRecord(c *gin.Context) {
	id, ok := parseOrderID(c)
	if !ok {
		return
	}
	r, e := h.orderService.RefundOrderRecord(id, currentOperator(c))
	if e == gorm.ErrRecordNotFound {
		commonRouter.ToError(c, "订单不存在")
		return
	}
	if e != nil {
		commonRouter.ToError(c, e.Error())
		return
	}
	commonRouter.ToJson(c, r, nil)
}

// bkOrderRecord 订单补款
func (h *OrderHandler) bkOrderRecord(c *gin.Context) {
	id, ok := parseOrderID(c)
	if !ok {
		return
	}
	var req orderDTO.BkOrderRequestDTO
	if c.ShouldBindJSON(&req) != nil {
		commonRouter.ToError(c, "参数错误")
		return
	}
	r, e := h.orderService.BkOrderRecord(id, req.Num, currentOperator(c))
	if e == gorm.ErrRecordNotFound {
		commonRouter.ToError(c, "订单不存在")
		return
	}
	if e != nil {
		commonRouter.ToError(c, e.Error())
		return
	}
	commonRouter.ToJson(c, r, nil)
}

func currentOperator(c *gin.Context) string {
	if value, exists := c.Get("auth.user"); exists {
		if user, ok := value.(*authService.LoginUser); ok {
			return user.Username
		}
	}
	return ""
}
