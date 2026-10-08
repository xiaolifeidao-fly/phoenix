package barry

import (
	commonRouter "common/middleware/routers"
	"strconv"
	"strings"
	barryDTO "suffer/service/barry/dto"

	"github.com/gin-gonic/gin"
)

// 人工商品 - 积分配置. 用户列表复用 GET /barry/user-whitelists(不传 status 即包含已剔除的失效用户).
func (h *BarryHandler) registerPointsRuleRoutes(engine *gin.RouterGroup) {
	engine.GET("/barry/points-rules", h.getPointsRule)
	engine.POST("/barry/points-rules", h.savePointsRule)
	engine.PUT("/barry/user-whitelists/:id/points-rule", h.saveUserPointsRule)
}

func (h *BarryHandler) getPointsRule(c *gin.Context) {
	var q barryDTO.AssignSwitchQueryDTO
	if c.ShouldBindQuery(&q) != nil || q.ShopCategoryID <= 0 {
		commonRouter.ToError(c, "参数错误")
		return
	}
	response, err := h.barryService.PointsRule.GetGlobal(c.Request.Context(), q.ShopCategoryID)
	if err != nil {
		commonRouter.ToJson(c, nil, err)
		return
	}
	commonRouter.ToJson(c, response.Data, nil)
}

func (h *BarryHandler) savePointsRule(c *gin.Context) {
	var req struct {
		ShopCategoryID int64 `json:"shopCategoryId"`
		barryDTO.PointsRuleDTO
	}
	if c.ShouldBindJSON(&req) != nil || req.ShopCategoryID <= 0 {
		commonRouter.ToError(c, "参数错误")
		return
	}
	// 吃量比例与审核加积分方式互不相关, 各自可留空.
	req.EatMode = normalizeEatMode(req.EatMode)
	if msg := validatePointsRule(req.EatRatio, req.EatMode); msg != "" {
		commonRouter.ToError(c, msg)
		return
	}
	response, err := h.barryService.PointsRule.SaveGlobal(c.Request.Context(), req.ShopCategoryID, req.PointsRuleDTO)
	if err != nil {
		commonRouter.ToJson(c, nil, err)
		return
	}
	if !response.Success && response.Code != "0" {
		commonRouter.ToError(c, firstNonEmpty(response.Message, "保存积分配置失败"))
		return
	}
	commonRouter.ToJson(c, response.Data, nil)
}

func (h *BarryHandler) saveUserPointsRule(c *gin.Context) {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil || id <= 0 {
		commonRouter.ToError(c, "参数错误")
		return
	}
	var req barryDTO.SaveUserPointsRuleDTO
	if c.ShouldBindJSON(&req) != nil {
		commonRouter.ToError(c, "参数错误")
		return
	}
	req.ID = id
	// 用户维度两项各自兜底到商品全局值, 允许只填一项.
	req.EatMode = normalizeEatMode(req.EatMode)
	if msg := validatePointsRule(req.EatRatio, req.EatMode); msg != "" {
		commonRouter.ToError(c, msg)
		return
	}
	response, err := h.barryService.PointsRule.SaveUser(c.Request.Context(), &req)
	if err != nil {
		commonRouter.ToJson(c, nil, err)
		return
	}
	if !response.Success && response.Code != "0" {
		commonRouter.ToError(c, firstNonEmpty(response.Message, "保存用户积分配置失败"))
		return
	}
	commonRouter.ToJson(c, response.Data, nil)
}

// validatePointsRule 吃量比例 0~1、审核加积分方式 SUBMIT_COUNT(按提交量)/APPROVE(按审核); nil 表示未配置, 视为合法.
func validatePointsRule(ratio *float64, mode *string) string {
	if ratio != nil && (*ratio < 0 || *ratio > 1) {
		return "吃量比例需在0~100%之间"
	}
	if mode != nil && *mode != "SUBMIT_COUNT" && *mode != "APPROVE" {
		return "审核加积分方式不正确"
	}
	return ""
}

// normalizeEatMode 空白加积分方式归一为 nil.
func normalizeEatMode(mode *string) *string {
	if mode == nil || strings.TrimSpace(*mode) == "" {
		return nil
	}
	trimmed := strings.TrimSpace(*mode)
	return &trimmed
}

func firstNonEmpty(value, fallback string) string {
	if value != "" {
		return value
	}
	return fallback
}
