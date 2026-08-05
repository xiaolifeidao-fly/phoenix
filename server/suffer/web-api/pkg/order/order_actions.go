package order

import (
	commonRouter "common/middleware/routers"
	authService "suffer/service/auth"
	orderDTO "suffer/service/order/dto"
	webAuth "suffer/web-api/auth"

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

// refundOrderRecord 订单退单，转调 kakrolot
func (h *OrderHandler) refundOrderRecord(c *gin.Context) {
	id, ok := parseOrderID(c)
	if !ok {
		return
	}
	e := h.orderService.RefundOrderRecord(c.Request.Context(), id, currentOperator(c), currentToken(c))
	if e == gorm.ErrRecordNotFound {
		commonRouter.ToError(c, "订单不存在")
		return
	}
	if e != nil {
		commonRouter.ToError(c, e.Error())
		return
	}
	commonRouter.ToJson(c, gin.H{"refunded": true}, nil)
}

// batchRefundOrderRecords 批量退单，逐单转调 kakrolot
func (h *OrderHandler) batchRefundOrderRecords(c *gin.Context) {
	var req orderDTO.BatchRefundOrderDTO
	if c.ShouldBindJSON(&req) != nil {
		commonRouter.ToError(c, "参数错误")
		return
	}
	if len(req.OrderIDs) == 0 {
		commonRouter.ToError(c, "请选择需要退单的订单")
		return
	}
	result := h.orderService.RefundOrderRecordBatch(c.Request.Context(), req.OrderIDs, currentOperator(c), currentToken(c))
	commonRouter.ToJson(c, result, nil)
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
	e := h.orderService.BkOrderRecord(c.Request.Context(), id, req.Num, currentOperator(c), currentToken(c))
	if e == gorm.ErrRecordNotFound {
		commonRouter.ToError(c, "订单不存在")
		return
	}
	if e != nil {
		commonRouter.ToError(c, e.Error())
		return
	}
	commonRouter.ToJson(c, gin.H{"bk": true}, nil)
}

// markOrderRecordException 订单异常打标：打标 + 停止分发
func (h *OrderHandler) markOrderRecordException(c *gin.Context) {
	id, ok := parseOrderID(c)
	if !ok {
		return
	}
	var req orderDTO.MarkOrderExceptionDTO
	if c.Request.ContentLength > 0 && c.ShouldBindJSON(&req) != nil {
		commonRouter.ToError(c, "参数错误")
		return
	}
	e := h.orderService.MarkOrderException(c.Request.Context(), id, req.Reason, currentOperator(c))
	if e == gorm.ErrRecordNotFound {
		commonRouter.ToError(c, "订单不存在")
		return
	}
	if e != nil {
		commonRouter.ToError(c, e.Error())
		return
	}
	commonRouter.ToJson(c, gin.H{"marked": true}, nil)
}

// batchMarkOrderRecordException 批量订单异常打标
func (h *OrderHandler) batchMarkOrderRecordException(c *gin.Context) {
	var req orderDTO.BatchMarkOrderExceptionDTO
	if c.ShouldBindJSON(&req) != nil {
		commonRouter.ToError(c, "参数错误")
		return
	}
	if len(req.OrderIDs) == 0 {
		commonRouter.ToError(c, "请选择需要打标的订单")
		return
	}
	result := h.orderService.MarkOrderExceptionBatch(c.Request.Context(), req.OrderIDs, req.Reason, currentOperator(c))
	commonRouter.ToJson(c, result, nil)
}

// currentToken 取当前登录 token，用于透传给 kakrolot
// forceFinishOrderRecords 强制完成（单笔与批量共用）
func (h *OrderHandler) forceFinishOrderRecords(c *gin.Context) {
	var req orderDTO.ForceFinishOrderDTO
	if c.ShouldBindJSON(&req) != nil {
		commonRouter.ToError(c, "参数错误")
		return
	}
	if len(req.OrderIDs) == 0 {
		commonRouter.ToError(c, "请选择需要强制完成的订单")
		return
	}
	result, e := h.orderService.ForceFinishOrders(c.Request.Context(), req.OrderIDs, currentOperator(c))
	if e != nil {
		commonRouter.ToError(c, e.Error())
		return
	}
	commonRouter.ToJson(c, result, nil)
}

func currentToken(c *gin.Context) string {
	if value, exists := c.Get(webAuth.ContextTokenKey); exists {
		if token, ok := value.(string); ok {
			return token
		}
	}
	return ""
}

func currentOperator(c *gin.Context) string {
	if value, exists := c.Get("auth.user"); exists {
		if user, ok := value.(*authService.LoginUser); ok {
			return user.Username
		}
	}
	return ""
}
