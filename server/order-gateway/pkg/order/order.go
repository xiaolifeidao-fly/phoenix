package order

import (
	"net/http"
	orderBusiness "order-gateway/business/order"
	"order-gateway/model"

	commonRouter "common/middleware/routers"

	"github.com/gin-gonic/gin"
)

type OrderHandler struct {
	*commonRouter.BaseHandler
	business *orderBusiness.Business
}

func NewOrderHandler() *OrderHandler {
	business := orderBusiness.NewBusiness()
	_ = business.EnsureTable()
	return &OrderHandler{
		BaseHandler: &commonRouter.BaseHandler{},
		business:    business,
	}
}

func (h *OrderHandler) RegisterHandler(engine *gin.RouterGroup) {
	engine.POST("/orders/submit", h.submit)
	engine.POST("/orders/refund", h.refund)
	engine.POST("/orders/get", h.get)
	engine.GET("/orders/get/init", h.getInit)
	engine.POST("/orders/update", h.update)
	engine.GET("/orders/refunds", h.refunds)
}

func (h *OrderHandler) submit(c *gin.Context) {
	var req model.OrderRequestModel
	if c.ShouldBindJSON(&req) != nil {
		c.JSON(http.StatusOK, model.Error("参数不合规"))
		return
	}
	data, err := h.business.Submit(&req, clientIP(c))
	if err != nil {
		c.JSON(http.StatusOK, model.Error(err.Error()))
		return
	}
	c.JSON(http.StatusOK, model.Success(data))
}

func (h *OrderHandler) refund(c *gin.Context) {
	var req model.OrderRequestModel
	if c.ShouldBindJSON(&req) != nil {
		c.JSON(http.StatusOK, model.Error("参数不合规"))
		return
	}
	if err := h.business.Refund(&req); err != nil {
		c.JSON(http.StatusOK, model.Error(err.Error()))
		return
	}
	c.JSON(http.StatusOK, model.Success("退单请求已发送"))
}

func (h *OrderHandler) get(c *gin.Context) {
	var req model.OrderRequestModel
	if c.ShouldBindJSON(&req) != nil {
		c.JSON(http.StatusOK, model.Error("参数不合规"))
		return
	}
	data, err := h.business.Get(&req)
	if err != nil {
		c.JSON(http.StatusOK, model.Error(err.Error()))
		return
	}
	c.JSON(http.StatusOK, model.Success(data))
}

func (h *OrderHandler) getInit(c *gin.Context) {
	var req model.OrderRequestModel
	if c.ShouldBindQuery(&req) != nil {
		c.JSON(http.StatusOK, model.Error("参数不合规"))
		return
	}
	data, err := h.business.GetInitOrders(&req)
	if err != nil {
		c.JSON(http.StatusOK, model.Error(err.Error()))
		return
	}
	c.JSON(http.StatusOK, model.Success(data))
}

func (h *OrderHandler) update(c *gin.Context) {
	var req model.OrderRequestModel
	if c.ShouldBindJSON(&req) != nil {
		c.JSON(http.StatusOK, model.Error("参数不合规"))
		return
	}
	if err := h.business.Update(&req); err != nil {
		c.JSON(http.StatusOK, model.Error(err.Error()))
		return
	}
	c.JSON(http.StatusOK, model.Success("更新订单状态和数量"))
}

func (h *OrderHandler) refunds(c *gin.Context) {
	var req model.OrderRequestModel
	if c.ShouldBindQuery(&req) != nil {
		c.JSON(http.StatusOK, model.Error("参数不合规"))
		return
	}
	data, err := h.business.ListRefunds(&req)
	if err != nil {
		c.JSON(http.StatusOK, model.Error(err.Error()))
		return
	}
	c.JSON(http.StatusOK, model.Success(data))
}

func clientIP(c *gin.Context) string {
	for _, header := range []string{"x-forwarded-for", "Proxy-Client-IP", "WL-Proxy-Client-IP"} {
		if value := c.GetHeader(header); value != "" && value != "unknown" {
			return value
		}
	}
	if c.ClientIP() == "::1" {
		return "127.0.0.1"
	}
	return c.ClientIP()
}
