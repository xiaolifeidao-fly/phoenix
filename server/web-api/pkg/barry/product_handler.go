package barry

import (
	commonRouter "common/middleware/routers"
	barryDTO "service/barry/dto"

	"github.com/gin-gonic/gin"
)

func (h *BarryHandler) registerProductRoutes(engine *gin.RouterGroup) {
	engine.GET("/barry/product-types", h.listProductTypes)
	engine.GET("/barry/product-categories", h.listProductCategories)
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
