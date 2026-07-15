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
	engine.GET("/barry/assign-configs", h.listAssignConfigs)
	engine.POST("/barry/assign-configs", h.saveAssignConfig)
	engine.GET("/barry/judge-configs", h.listJudgeConfigs)
	engine.POST("/barry/judge-configs", h.saveJudgeConfig)
	engine.GET("/barry/assign-uid-rules", h.getAssignUidRule)
	engine.POST("/barry/assign-uid-rules", h.saveAssignUidRule)
	engine.GET("/barry/assign-video-rules", h.getAssignVideoRule)
	engine.POST("/barry/assign-video-rules", h.saveAssignVideoRule)
	engine.GET("/barry/assign-refund-rules", h.getAssignRefundRule)
	engine.POST("/barry/assign-refund-rules", h.saveAssignRefundRule)
	engine.GET("/barry/assign-video-user-rules", h.listAssignVideoUserRules)
	engine.POST("/barry/assign-video-user-rules", h.saveAssignVideoUserRule)
	engine.DELETE("/barry/assign-video-user-rules", h.deleteAssignVideoUserRule)
	engine.GET("/barry/assign-whitelist-switch", h.getAssignWhitelistSwitch)
	engine.POST("/barry/assign-whitelist-switch", h.saveAssignWhitelistSwitch)
	engine.GET("/barry/assign-uid-switch", h.getAssignUidSwitch)
	engine.POST("/barry/assign-uid-switch", h.saveAssignUidSwitch)
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

func (h *BarryHandler) listAssignConfigs(c *gin.Context) {
	var q barryDTO.AssignConfigQueryDTO
	if c.ShouldBindQuery(&q) != nil || q.ShopTypeID <= 0 {
		commonRouter.ToError(c, "参数错误")
		return
	}
	response, err := h.barryService.AssignConfig.List(c.Request.Context(), q)
	if err != nil {
		commonRouter.ToJson(c, nil, err)
		return
	}
	commonRouter.ToJson(c, response.Data, nil)
}

func (h *BarryHandler) saveAssignConfig(c *gin.Context) {
	var req barryDTO.SaveAssignConfigDTO
	if c.ShouldBindJSON(&req) != nil || req.ShopTypeID <= 0 {
		commonRouter.ToError(c, "参数错误")
		return
	}
	response, err := h.barryService.AssignConfig.Save(c.Request.Context(), &req)
	if err != nil {
		commonRouter.ToJson(c, nil, err)
		return
	}
	if !response.Success {
		if response.Message == "" {
			commonRouter.ToError(c, "保存失败")
			return
		}
		commonRouter.ToError(c, response.Message)
		return
	}
	commonRouter.ToJson(c, response.Data, nil)
}

func (h *BarryHandler) listJudgeConfigs(c *gin.Context) {
	var q barryDTO.JudgeConfigQueryDTO
	if c.ShouldBindQuery(&q) != nil || q.ShopTypeID <= 0 {
		commonRouter.ToError(c, "参数错误")
		return
	}
	response, err := h.barryService.JudgeConfig.List(c.Request.Context(), q)
	if err != nil {
		commonRouter.ToJson(c, nil, err)
		return
	}
	commonRouter.ToJson(c, response.Data, nil)
}

func (h *BarryHandler) saveJudgeConfig(c *gin.Context) {
	var req barryDTO.SaveJudgeConfigDTO
	if c.ShouldBindJSON(&req) != nil || req.ShopTypeID <= 0 {
		commonRouter.ToError(c, "参数错误")
		return
	}
	response, err := h.barryService.JudgeConfig.Save(c.Request.Context(), &req)
	if err != nil {
		commonRouter.ToJson(c, nil, err)
		return
	}
	if !response.Success {
		if response.Message == "" {
			commonRouter.ToError(c, "保存失败")
			return
		}
		commonRouter.ToError(c, response.Message)
		return
	}
	commonRouter.ToJson(c, response.Data, nil)
}

func (h *BarryHandler) getAssignUidRule(c *gin.Context) {
	var q barryDTO.AssignUidRuleQueryDTO
	if c.ShouldBindQuery(&q) != nil || q.ShopCategoryID <= 0 {
		commonRouter.ToError(c, "参数错误")
		return
	}
	response, err := h.barryService.AssignUidRule.Get(c.Request.Context(), q)
	if err != nil {
		commonRouter.ToJson(c, nil, err)
		return
	}
	commonRouter.ToJson(c, response.Data, nil)
}

func (h *BarryHandler) saveAssignUidRule(c *gin.Context) {
	var req barryDTO.SaveAssignUidRuleDTO
	if c.ShouldBindJSON(&req) != nil || req.ShopCategoryID <= 0 {
		commonRouter.ToError(c, "参数错误")
		return
	}
	response, err := h.barryService.AssignUidRule.Save(c.Request.Context(), &req)
	if err != nil {
		commonRouter.ToJson(c, nil, err)
		return
	}
	if !response.Success {
		if response.Message == "" {
			commonRouter.ToError(c, "保存失败")
			return
		}
		commonRouter.ToError(c, response.Message)
		return
	}
	commonRouter.ToJson(c, response.Data, nil)
}

func (h *BarryHandler) getAssignVideoRule(c *gin.Context) {
	var q barryDTO.AssignVideoRuleQueryDTO
	if c.ShouldBindQuery(&q) != nil || q.ShopCategoryID <= 0 {
		commonRouter.ToError(c, "参数错误")
		return
	}
	response, err := h.barryService.AssignVideoRule.Get(c.Request.Context(), q)
	if err != nil {
		commonRouter.ToJson(c, nil, err)
		return
	}
	commonRouter.ToJson(c, response.Data, nil)
}

func (h *BarryHandler) saveAssignVideoRule(c *gin.Context) {
	var req barryDTO.SaveAssignVideoRuleDTO
	if c.ShouldBindJSON(&req) != nil || req.ShopCategoryID <= 0 {
		commonRouter.ToError(c, "参数错误")
		return
	}
	response, err := h.barryService.AssignVideoRule.Save(c.Request.Context(), &req)
	if err != nil {
		commonRouter.ToJson(c, nil, err)
		return
	}
	if !response.Success {
		if response.Message == "" {
			commonRouter.ToError(c, "保存失败")
			return
		}
		commonRouter.ToError(c, response.Message)
		return
	}
	commonRouter.ToJson(c, response.Data, nil)
}

func (h *BarryHandler) getAssignRefundRule(c *gin.Context) {
	var q barryDTO.AssignRefundRuleQueryDTO
	if c.ShouldBindQuery(&q) != nil || q.ShopCategoryID <= 0 {
		commonRouter.ToError(c, "参数错误")
		return
	}
	response, err := h.barryService.AssignRefundRule.Get(c.Request.Context(), q)
	if err != nil {
		commonRouter.ToJson(c, nil, err)
		return
	}
	commonRouter.ToJson(c, response.Data, nil)
}

func (h *BarryHandler) saveAssignRefundRule(c *gin.Context) {
	var req barryDTO.SaveAssignRefundRuleDTO
	if c.ShouldBindJSON(&req) != nil || req.ShopCategoryID <= 0 {
		commonRouter.ToError(c, "参数错误")
		return
	}
	response, err := h.barryService.AssignRefundRule.Save(c.Request.Context(), &req)
	if err != nil {
		commonRouter.ToJson(c, nil, err)
		return
	}
	if !response.Success {
		if response.Message == "" {
			commonRouter.ToError(c, "保存失败")
			return
		}
		commonRouter.ToError(c, response.Message)
		return
	}
	commonRouter.ToJson(c, response.Data, nil)
}

func (h *BarryHandler) listAssignVideoUserRules(c *gin.Context) {
	var q barryDTO.AssignVideoUserRuleQueryDTO
	if c.ShouldBindQuery(&q) != nil || q.ShopCategoryID <= 0 {
		commonRouter.ToError(c, "参数错误")
		return
	}
	response, err := h.barryService.AssignVideoUserRule.List(c.Request.Context(), q)
	if err != nil {
		commonRouter.ToJson(c, nil, err)
		return
	}
	commonRouter.ToJson(c, response.Data, nil)
}

func (h *BarryHandler) saveAssignVideoUserRule(c *gin.Context) {
	var req barryDTO.SaveAssignVideoUserRuleDTO
	if c.ShouldBindJSON(&req) != nil || req.ShopCategoryID <= 0 || req.UserID <= 0 {
		commonRouter.ToError(c, "参数错误")
		return
	}
	response, err := h.barryService.AssignVideoUserRule.Save(c.Request.Context(), &req)
	if err != nil {
		commonRouter.ToJson(c, nil, err)
		return
	}
	if !response.Success {
		if response.Message == "" {
			commonRouter.ToError(c, "保存失败")
			return
		}
		commonRouter.ToError(c, response.Message)
		return
	}
	commonRouter.ToJson(c, response.Data, nil)
}

func (h *BarryHandler) deleteAssignVideoUserRule(c *gin.Context) {
	var req barryDTO.DeleteAssignVideoUserRuleDTO
	if c.ShouldBindQuery(&req) != nil || req.ShopCategoryID <= 0 || req.UserID <= 0 {
		commonRouter.ToError(c, "参数错误")
		return
	}
	response, err := h.barryService.AssignVideoUserRule.Delete(c.Request.Context(), req)
	if err != nil {
		commonRouter.ToJson(c, nil, err)
		return
	}
	if !response.Success {
		if response.Message == "" {
			commonRouter.ToError(c, "删除失败")
			return
		}
		commonRouter.ToError(c, response.Message)
		return
	}
	commonRouter.ToJson(c, response.Data, nil)
}

func (h *BarryHandler) getAssignWhitelistSwitch(c *gin.Context) {
	var q barryDTO.AssignSwitchQueryDTO
	if c.ShouldBindQuery(&q) != nil || q.ShopCategoryID <= 0 {
		commonRouter.ToError(c, "参数错误")
		return
	}
	response, err := h.barryService.AssignWhitelistSwitch.Get(c.Request.Context(), q)
	if err != nil {
		commonRouter.ToJson(c, nil, err)
		return
	}
	commonRouter.ToJson(c, gin.H{"enabled": response.Data != nil && *response.Data}, nil)
}

func (h *BarryHandler) saveAssignWhitelistSwitch(c *gin.Context) {
	var req barryDTO.SaveAssignSwitchDTO
	if c.ShouldBindJSON(&req) != nil || req.ShopCategoryID <= 0 {
		commonRouter.ToError(c, "参数错误")
		return
	}
	response, err := h.barryService.AssignWhitelistSwitch.Save(c.Request.Context(), &req)
	if err != nil {
		commonRouter.ToJson(c, nil, err)
		return
	}
	if !response.Success {
		if response.Message == "" {
			commonRouter.ToError(c, "保存失败")
			return
		}
		commonRouter.ToError(c, response.Message)
		return
	}
	commonRouter.ToJson(c, response.Data, nil)
}

func (h *BarryHandler) getAssignUidSwitch(c *gin.Context) {
	var q barryDTO.AssignSwitchQueryDTO
	if c.ShouldBindQuery(&q) != nil || q.ShopCategoryID <= 0 {
		commonRouter.ToError(c, "参数错误")
		return
	}
	response, err := h.barryService.AssignUidSwitch.Get(c.Request.Context(), q)
	if err != nil {
		commonRouter.ToJson(c, nil, err)
		return
	}
	commonRouter.ToJson(c, gin.H{"enabled": response.Data != nil && *response.Data}, nil)
}

func (h *BarryHandler) saveAssignUidSwitch(c *gin.Context) {
	var req barryDTO.SaveAssignSwitchDTO
	if c.ShouldBindJSON(&req) != nil || req.ShopCategoryID <= 0 {
		commonRouter.ToError(c, "参数错误")
		return
	}
	response, err := h.barryService.AssignUidSwitch.Save(c.Request.Context(), &req)
	if err != nil {
		commonRouter.ToJson(c, nil, err)
		return
	}
	if !response.Success {
		if response.Message == "" {
			commonRouter.ToError(c, "保存失败")
			return
		}
		commonRouter.ToError(c, response.Message)
		return
	}
	commonRouter.ToJson(c, response.Data, nil)
}
