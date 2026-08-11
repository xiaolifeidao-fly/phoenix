package barry

import (
	commonRouter "common/middleware/routers"
	"strconv"

	barryDTO "suffer/service/barry/dto"

	"github.com/gin-gonic/gin"
)

func (h *BarryHandler) registerProductRoutes(engine *gin.RouterGroup) {
	engine.GET("/barry/product-types", h.listProductTypes)
	engine.GET("/barry/shop-groups", h.listShopGroups)
	engine.POST("/barry/shop-groups", h.createShopGroup)
	engine.PUT("/barry/shop-groups/:shopGroupId", h.updateShopGroup)
	engine.DELETE("/barry/shop-groups/:shopGroupId", h.deleteShopGroup)
	engine.GET("/barry/shop-groups/:shopGroupId/bridge-configs", h.listBridgeConfigs)
	engine.POST("/barry/shop-groups/:shopGroupId/bridge-configs", h.createBridgeConfig)
	engine.PUT("/barry/shop-groups/:shopGroupId/bridge-configs/:bridgeConfigId", h.updateBridgeConfig)
	engine.DELETE("/barry/shop-groups/:shopGroupId/bridge-configs/:bridgeConfigId", h.deleteBridgeConfig)
	engine.PUT("/barry/shop-groups/:shopGroupId/bridge-configs/:bridgeConfigId/active", h.activateBridgeConfig)
	engine.PUT("/barry/shop-groups/:shopGroupId/bridge-configs/:bridgeConfigId/disable", h.disableBridgeConfig)
	engine.POST("/barry/shop-groups/:shopGroupId/bridge-configs/:bridgeConfigId/reset-statistics", h.resetBridgeConfigStatistics)
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
	engine.GET("/barry/assign-approval-rate-rules", h.getAssignApprovalRateRule)
	engine.POST("/barry/assign-approval-rate-rules", h.saveAssignApprovalRateRule)
	engine.GET("/barry/assign-video-user-rules", h.listAssignVideoUserRules)
	engine.POST("/barry/assign-video-user-rules", h.saveAssignVideoUserRule)
	engine.DELETE("/barry/assign-video-user-rules", h.deleteAssignVideoUserRule)
	engine.GET("/barry/assign-whitelist-switch", h.getAssignWhitelistSwitch)
	engine.POST("/barry/assign-whitelist-switch", h.saveAssignWhitelistSwitch)
	engine.GET("/barry/assign-whitelist-approval-rate", h.getAssignWhitelistApprovalRate)
	engine.POST("/barry/assign-whitelist-approval-rate", h.saveAssignWhitelistApprovalRate)
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

func (h *BarryHandler) listShopGroups(c *gin.Context) {
	response, err := h.barryService.ShopGroup.List(c.Request.Context())
	commonRouter.ToJson(c, response, err)
}

func (h *BarryHandler) createShopGroup(c *gin.Context) {
	h.saveShopGroup(c, 0)
}

func (h *BarryHandler) updateShopGroup(c *gin.Context) {
	shopGroupID, ok := parseBarryPositiveID(c, "shopGroupId")
	if !ok {
		return
	}
	h.saveShopGroup(c, int(shopGroupID))
}

func (h *BarryHandler) saveShopGroup(c *gin.Context, shopGroupID int) {
	var request barryDTO.ShopGroupDTO
	if c.ShouldBindJSON(&request) != nil || request.Name == "" || request.Code == "" {
		commonRouter.ToError(c, "参数错误")
		return
	}
	request.ID = shopGroupID
	response, err := h.barryService.ShopGroup.Save(c.Request.Context(), &request)
	commonRouter.ToJson(c, response, err)
}

func (h *BarryHandler) deleteShopGroup(c *gin.Context) {
	shopGroupID, ok := parseBarryPositiveID(c, "shopGroupId")
	if !ok {
		return
	}
	err := h.barryService.ShopGroup.Delete(c.Request.Context(), shopGroupID)
	commonRouter.ToJson(c, map[string]bool{"deleted": err == nil}, err)
}

func (h *BarryHandler) listBridgeConfigs(c *gin.Context) {
	shopGroupID, ok := parseBarryPositiveID(c, "shopGroupId")
	if !ok {
		return
	}
	response, err := h.barryService.BridgeConfig.List(c.Request.Context(), shopGroupID)
	commonRouter.ToJson(c, response, err)
}

func (h *BarryHandler) createBridgeConfig(c *gin.Context) {
	shopGroupID, ok := parseBarryPositiveID(c, "shopGroupId")
	if !ok {
		return
	}
	var request barryDTO.BridgeConfigDTO
	if c.ShouldBindJSON(&request) != nil {
		commonRouter.ToError(c, "参数错误")
		return
	}
	response, err := h.barryService.BridgeConfig.Save(c.Request.Context(), shopGroupID, &request)
	commonRouter.ToJson(c, response, err)
}

func (h *BarryHandler) updateBridgeConfig(c *gin.Context) {
	shopGroupID, ok := parseBarryPositiveID(c, "shopGroupId")
	if !ok {
		return
	}
	bridgeConfigID, ok := parseBarryPositiveID(c, "bridgeConfigId")
	if !ok {
		return
	}
	var request barryDTO.BridgeConfigDTO
	if c.ShouldBindJSON(&request) != nil {
		commonRouter.ToError(c, "参数错误")
		return
	}
	request.ID = int(bridgeConfigID)
	response, err := h.barryService.BridgeConfig.Save(c.Request.Context(), shopGroupID, &request)
	commonRouter.ToJson(c, response, err)
}

func (h *BarryHandler) deleteBridgeConfig(c *gin.Context) {
	shopGroupID, ok := parseBarryPositiveID(c, "shopGroupId")
	if !ok {
		return
	}
	bridgeConfigID, ok := parseBarryPositiveID(c, "bridgeConfigId")
	if !ok {
		return
	}
	err := h.barryService.BridgeConfig.Delete(c.Request.Context(), shopGroupID, bridgeConfigID)
	commonRouter.ToJson(c, map[string]bool{"deleted": err == nil}, err)
}

func (h *BarryHandler) activateBridgeConfig(c *gin.Context) {
	h.changeBridgeConfigStatus(c, true)
}

func (h *BarryHandler) disableBridgeConfig(c *gin.Context) {
	h.changeBridgeConfigStatus(c, false)
}

func (h *BarryHandler) resetBridgeConfigStatistics(c *gin.Context) {
	if _, ok := parseBarryPositiveID(c, "shopGroupId"); !ok {
		return
	}
	bridgeConfigID, ok := parseBarryPositiveID(c, "bridgeConfigId")
	if !ok {
		return
	}
	err := h.barryService.BridgeConfig.ResetStatistics(c.Request.Context(), bridgeConfigID)
	commonRouter.ToJson(c, map[string]bool{"reset": err == nil}, err)
}

func (h *BarryHandler) changeBridgeConfigStatus(c *gin.Context, active bool) {
	if _, ok := parseBarryPositiveID(c, "shopGroupId"); !ok {
		return
	}
	bridgeConfigID, ok := parseBarryPositiveID(c, "bridgeConfigId")
	if !ok {
		return
	}
	var err error
	if active {
		err = h.barryService.BridgeConfig.Active(c.Request.Context(), bridgeConfigID)
	} else {
		err = h.barryService.BridgeConfig.Disable(c.Request.Context(), bridgeConfigID)
	}
	commonRouter.ToJson(c, map[string]bool{"updated": err == nil}, err)
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
	id, ok := parseBarryPositiveID(c, "id")
	if !ok {
		return 0, false
	}
	return int(id), true
}

func parseBarryPositiveID(c *gin.Context, name string) (int64, bool) {
	id, err := strconv.ParseInt(c.Param(name), 10, 64)
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

func (h *BarryHandler) getAssignApprovalRateRule(c *gin.Context) {
	var q barryDTO.AssignApprovalRateRuleQueryDTO
	if c.ShouldBindQuery(&q) != nil || q.ShopCategoryID <= 0 {
		commonRouter.ToError(c, "参数错误")
		return
	}
	response, err := h.barryService.AssignApprovalRateRule.Get(c.Request.Context(), q)
	if err != nil {
		commonRouter.ToJson(c, nil, err)
		return
	}
	commonRouter.ToJson(c, response.Data, nil)
}

func (h *BarryHandler) saveAssignApprovalRateRule(c *gin.Context) {
	var req barryDTO.SaveAssignApprovalRateRuleDTO
	if c.ShouldBindJSON(&req) != nil || req.ShopCategoryID <= 0 || req.MinFansNum < 0 || req.RecentApprovalRateDays <= 0 || req.MinRecentApprovalRate < 0 || req.MinRecentApprovalRate > 1 || req.MinDailySubmitNum < 0 {
		commonRouter.ToError(c, "参数错误")
		return
	}
	response, err := h.barryService.AssignApprovalRateRule.Save(c.Request.Context(), &req)
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

func (h *BarryHandler) getAssignWhitelistApprovalRate(c *gin.Context) {
	var q barryDTO.AssignSwitchQueryDTO
	if c.ShouldBindQuery(&q) != nil || q.ShopCategoryID <= 0 {
		commonRouter.ToError(c, "参数错误")
		return
	}
	response, err := h.barryService.AssignWhitelistSwitch.GetApprovalRate(c.Request.Context(), q)
	if err != nil {
		commonRouter.ToJson(c, nil, err)
		return
	}
	commonRouter.ToJson(c, response.Data, nil)
}

func (h *BarryHandler) saveAssignWhitelistApprovalRate(c *gin.Context) {
	var req struct {
		ShopCategoryID         int64   `json:"shopCategoryId"`
		MinRecentApprovalRate  float64 `json:"minRecentApprovalRate"`
		RecentApprovalRateDays *int    `json:"recentApprovalRateDays"`
	}
	if c.ShouldBindJSON(&req) != nil || req.ShopCategoryID <= 0 || req.MinRecentApprovalRate < 0 || req.MinRecentApprovalRate > 1 ||
		(req.MinRecentApprovalRate == 0 && req.RecentApprovalRateDays == nil) ||
		(req.RecentApprovalRateDays != nil && *req.RecentApprovalRateDays <= 0) {
		commonRouter.ToError(c, "参数错误")
		return
	}
	response, err := h.barryService.AssignWhitelistSwitch.SaveApprovalRate(c.Request.Context(), req.ShopCategoryID, req.MinRecentApprovalRate, req.RecentApprovalRateDays)
	if err != nil {
		commonRouter.ToJson(c, nil, err)
		return
	}
	if !response.Success {
		commonRouter.ToError(c, "保存失败")
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
