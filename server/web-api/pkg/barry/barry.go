package barry

import (
	commonRouter "common/middleware/routers"
	"service/barry"
	barryDTO "service/barry/dto"

	"github.com/gin-gonic/gin"
)

type BarryHandler struct {
	*commonRouter.BaseHandler
	barryService *barry.BarryService
}

func NewBarryHandler() *BarryHandler {
	return &BarryHandler{
		BaseHandler:  &commonRouter.BaseHandler{},
		barryService: barry.NewBarryService(),
	}
}

func (h *BarryHandler) RegisterHandler(engine *gin.RouterGroup) {
	engine.GET("/barry/product-types", h.listProductTypes)
	engine.GET("/barry/product-categories", h.listProductCategories)
	engine.GET("/barry/channels", h.listChannels)
	engine.GET("/barry/users", h.listUsers)
	engine.GET("/barry/user-points", h.listUserPoints)
	engine.GET("/barry/point-withdraws", h.listPointWithdraws)
	engine.GET("/barry/entries", h.listEntries)
	engine.GET("/barry/returns", h.listReturns)
	engine.GET("/barry/order-summaries", h.listOrderSummaries)
}

func normalizeBarryPage(q *barryDTO.PageQueryDTO) {
	if q == nil {
		return
	}
	if q.PageIndex <= 0 {
		q.PageIndex = 1
	}
	if q.PageSize <= 0 {
		q.PageSize = 200
	}
}

func (h *BarryHandler) listProductTypes(c *gin.Context) {
	var q barryDTO.ProductTypeQueryDTO
	if c.ShouldBindQuery(&q) != nil {
		commonRouter.ToError(c, "参数错误")
		return
	}
	normalizeBarryPage(&q.PageQueryDTO)
	response, err := h.barryService.ProductType.List(c.Request.Context(), q)
	if err != nil {
		commonRouter.ToJson(c, nil, err)
		return
	}
	commonRouter.ToJson(c, response.Data, nil)
}

func (h *BarryHandler) listProductCategories(c *gin.Context) {
	var q barryDTO.ProductCategoryQueryDTO
	if c.ShouldBindQuery(&q) != nil {
		commonRouter.ToError(c, "参数错误")
		return
	}
	normalizeBarryPage(&q.PageQueryDTO)
	response, err := h.barryService.ProductCategory.List(c.Request.Context(), q)
	if err != nil {
		commonRouter.ToJson(c, nil, err)
		return
	}
	commonRouter.ToJson(c, response.Data, nil)
}

func (h *BarryHandler) listChannels(c *gin.Context) {
	var q barryDTO.ChannelQueryDTO
	if c.ShouldBindQuery(&q) != nil {
		commonRouter.ToError(c, "参数错误")
		return
	}
	normalizeBarryPage(&q.PageQueryDTO)
	response, err := h.barryService.Channel.List(c.Request.Context(), q)
	if err != nil {
		commonRouter.ToJson(c, nil, err)
		return
	}
	commonRouter.ToJson(c, response.Data, nil)
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
