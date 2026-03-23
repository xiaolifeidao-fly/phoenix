package barry

import (
	commonRouter "common/middleware/routers"
	barryDTO "service/barry/dto"

	"github.com/gin-gonic/gin"
)

func (h *BarryHandler) registerTransactionRoutes(engine *gin.RouterGroup) {
	engine.GET("/barry/entries", h.listEntries)
	engine.GET("/barry/returns", h.listReturns)
	engine.GET("/barry/order-summaries", h.listOrderSummaries)
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
