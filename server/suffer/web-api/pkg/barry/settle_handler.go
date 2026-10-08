package barry

import (
	commonRouter "common/middleware/routers"
	"strconv"
	"strings"
	barryDTO "suffer/service/barry/dto"

	"github.com/gin-gonic/gin"
)

// 人工 - 结算通道配置 + 做单用户结算配置. 用户列表 GET /barry/user-details 已带出结算方式与通道.
func (h *BarryHandler) registerSettleRoutes(engine *gin.RouterGroup) {
	engine.GET("/barry/settle-channels", h.listSettleChannels)
	engine.POST("/barry/settle-channels", h.createSettleChannel)
	engine.PUT("/barry/settle-channels/:id", h.updateSettleChannel)
	engine.GET("/barry/user-details/:userId/settle", h.getUserSettleConfig)
	engine.PUT("/barry/user-details/:userId/settle", h.saveUserSettleConfig)
}

func (h *BarryHandler) listSettleChannels(c *gin.Context) {
	response, err := h.barryService.Settle.ListChannels(c.Request.Context())
	if err != nil {
		commonRouter.ToJson(c, nil, err)
		return
	}
	if response.Data == nil {
		response.Data = []*barryDTO.SettleChannelDTO{}
	}
	commonRouter.ToJson(c, response.Data, nil)
}

func (h *BarryHandler) createSettleChannel(c *gin.Context) {
	var req barryDTO.SettleChannelDTO
	if c.ShouldBindJSON(&req) != nil {
		commonRouter.ToError(c, "参数错误")
		return
	}
	req.ID = nil
	h.saveSettleChannel(c, &req)
}

func (h *BarryHandler) updateSettleChannel(c *gin.Context) {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil || id <= 0 {
		commonRouter.ToError(c, "参数错误")
		return
	}
	var req barryDTO.SettleChannelDTO
	if c.ShouldBindJSON(&req) != nil {
		commonRouter.ToError(c, "参数错误")
		return
	}
	req.ID = &id
	h.saveSettleChannel(c, &req)
}

func (h *BarryHandler) saveSettleChannel(c *gin.Context, req *barryDTO.SettleChannelDTO) {
	req.Name = strings.TrimSpace(req.Name)
	if msg := validateSettleChannel(req); msg != "" {
		commonRouter.ToError(c, msg)
		return
	}
	response, err := h.barryService.Settle.SaveChannel(c.Request.Context(), req)
	if err != nil {
		commonRouter.ToJson(c, nil, err)
		return
	}
	if !response.Success && response.Code != "0" {
		commonRouter.ToError(c, firstNonEmpty(response.Message, "保存结算通道失败"))
		return
	}
	commonRouter.ToJson(c, response.Data, nil)
}

func (h *BarryHandler) getUserSettleConfig(c *gin.Context) {
	userID, err := strconv.ParseInt(c.Param("userId"), 10, 64)
	if err != nil || userID <= 0 {
		commonRouter.ToError(c, "参数错误")
		return
	}
	response, err := h.barryService.Settle.GetUserConfig(c.Request.Context(), userID)
	if err != nil {
		commonRouter.ToJson(c, nil, err)
		return
	}
	commonRouter.ToJson(c, response.Data, nil)
}

func (h *BarryHandler) saveUserSettleConfig(c *gin.Context) {
	userID, err := strconv.ParseInt(c.Param("userId"), 10, 64)
	if err != nil || userID <= 0 {
		commonRouter.ToError(c, "参数错误")
		return
	}
	var req barryDTO.UserSettleConfigDTO
	if c.ShouldBindJSON(&req) != nil {
		commonRouter.ToError(c, "参数错误")
		return
	}
	req.UserID = userID
	req.SettleCurrency = strings.TrimSpace(req.SettleCurrency)
	if !isValidSettleCurrency(req.SettleCurrency) {
		commonRouter.ToError(c, "请选择结算方式：按U结算或按RMB结算")
		return
	}
	response, err := h.barryService.Settle.SaveUserConfig(c.Request.Context(), &req)
	if err != nil {
		commonRouter.ToJson(c, nil, err)
		return
	}
	if !response.Success && response.Code != "0" {
		commonRouter.ToError(c, firstNonEmpty(response.Message, "保存结算配置失败"))
		return
	}
	commonRouter.ToJson(c, response.Data, nil)
}

// validateSettleChannel 名称必填, 代收/代付费率必填且在 0~1 之间.
func validateSettleChannel(req *barryDTO.SettleChannelDTO) string {
	if req.Name == "" {
		return "通道名称不能为空"
	}
	if req.CollectFeeRate == nil || *req.CollectFeeRate < 0 || *req.CollectFeeRate > 1 {
		return "代收手续费率需在0~100%之间"
	}
	if req.PayoutFeeRate == nil || *req.PayoutFeeRate < 0 || *req.PayoutFeeRate > 1 {
		return "代付手续费率需在0~100%之间"
	}
	if req.CollectFeeRateU == nil || *req.CollectFeeRateU < 0 || *req.CollectFeeRateU > 1 {
		return "U 代收手续费率需在0~100%之间"
	}
	if req.PayoutFeeRateU == nil || *req.PayoutFeeRateU < 0 || *req.PayoutFeeRateU > 1 {
		return "U 代付手续费率需在0~100%之间"
	}
	if req.ExchangeRate != nil && *req.ExchangeRate <= 0 {
		return "汇率需大于0"
	}
	if req.DefaultChannel != nil && *req.DefaultChannel && req.Enabled != nil && !*req.Enabled {
		return "停用的通道不能设为默认通道"
	}
	return ""
}

func isValidSettleCurrency(currency string) bool {
	return currency == "USDT" || currency == "RMB"
}
