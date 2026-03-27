package barry

import (
	commonRouter "common/middleware/routers"
	"strconv"
	barryDTO "suffer/service/barry/dto"

	"github.com/gin-gonic/gin"
)

func (h *BarryHandler) registerProductRoutes(engine *gin.RouterGroup) {
	engine.GET("/barry/product-types", h.listProductTypes)
	engine.GET("/barry/product-categories", h.listProductCategories)
	engine.POST("/barry/product-categories", h.createProductCategory)
	engine.PUT("/barry/product-categories/:id", h.updateProductCategory)
	engine.DELETE("/barry/product-categories/:id", h.deleteProductCategory)
	engine.PUT("/barry/product-categories/:id/expire", h.expireProductCategory)
	engine.PUT("/barry/product-categories/:id/active", h.activateProductCategory)
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

func (h *BarryHandler) createProductCategory(c *gin.Context) {
	var req barryDTO.SaveProductCategoryDTO
	if c.ShouldBindJSON(&req) != nil {
		commonRouter.ToError(c, "参数错误")
		return
	}
	h.saveProductCategory(c, &req, false)
}

func (h *BarryHandler) updateProductCategory(c *gin.Context) {
	id, ok := parseBarryProductCategoryID(c)
	if !ok {
		return
	}
	var req barryDTO.SaveProductCategoryDTO
	if c.ShouldBindJSON(&req) != nil {
		commonRouter.ToError(c, "参数错误")
		return
	}
	req.ID = id
	h.saveProductCategory(c, &req, true)
}

func (h *BarryHandler) deleteProductCategory(c *gin.Context) {
	h.operateProductCategory(c, "删除失败", func(ctx *gin.Context, req *barryDTO.ProductCategoryOperateDTO) (*barryDTO.ProductCategoryActionResultDTO, error) {
		return h.barryService.ProductCategory.Delete(ctx.Request.Context(), req)
	})
}

func (h *BarryHandler) expireProductCategory(c *gin.Context) {
	h.operateProductCategory(c, "下架失败", func(ctx *gin.Context, req *barryDTO.ProductCategoryOperateDTO) (*barryDTO.ProductCategoryActionResultDTO, error) {
		return h.barryService.ProductCategory.Expire(ctx.Request.Context(), req)
	})
}

func (h *BarryHandler) activateProductCategory(c *gin.Context) {
	h.operateProductCategory(c, "启用失败", func(ctx *gin.Context, req *barryDTO.ProductCategoryOperateDTO) (*barryDTO.ProductCategoryActionResultDTO, error) {
		return h.barryService.ProductCategory.Active(ctx.Request.Context(), req)
	})
}

func (h *BarryHandler) saveProductCategory(c *gin.Context, req *barryDTO.SaveProductCategoryDTO, isUpdate bool) {
	response, err := h.barryService.ProductCategory.Save(c.Request.Context(), req)
	if err != nil {
		commonRouter.ToJson(c, nil, err)
		return
	}
	if !response.Success {
		if response.Message == "" {
			if isUpdate {
				commonRouter.ToError(c, "更新失败")
				return
			}
			commonRouter.ToError(c, "添加失败")
			return
		}
		commonRouter.ToError(c, response.Message)
		return
	}
	commonRouter.ToJson(c, response.Data, nil)
}

func (h *BarryHandler) operateProductCategory(c *gin.Context, fallbackMessage string, operation func(*gin.Context, *barryDTO.ProductCategoryOperateDTO) (*barryDTO.ProductCategoryActionResultDTO, error)) {
	id, ok := parseBarryProductCategoryID(c)
	if !ok {
		return
	}
	response, err := operation(c, &barryDTO.ProductCategoryOperateDTO{ID: id})
	if err != nil {
		commonRouter.ToJson(c, nil, err)
		return
	}
	if !response.Success {
		if response.Message == "" {
			commonRouter.ToError(c, fallbackMessage)
			return
		}
		commonRouter.ToError(c, response.Message)
		return
	}
	commonRouter.ToJson(c, response.Data, nil)
}

func parseBarryProductCategoryID(c *gin.Context) (int, bool) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil || id <= 0 {
		commonRouter.ToError(c, "参数错误")
		return 0, false
	}
	return id, true
}
