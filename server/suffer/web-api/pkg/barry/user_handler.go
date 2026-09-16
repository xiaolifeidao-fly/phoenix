package barry

import (
	baseDTO "common/base/dto"
	commonRouter "common/middleware/routers"
	"strconv"
	"strings"
	barryDTO "suffer/service/barry/dto"

	"github.com/gin-gonic/gin"
)

func (h *BarryHandler) registerUserRoutes(engine *gin.RouterGroup) {
	engine.GET("/barry/users", h.listUsers)
	engine.GET("/barry/user-whitelists", h.listUserWhitelists)
	engine.POST("/barry/user-whitelists", h.saveUserWhitelist)
	engine.PUT("/barry/user-whitelists/:id/status", h.updateUserWhitelistStatus)
	engine.PUT("/barry/user-whitelists/:id/group", h.updateUserWhitelistGroup)
	engine.GET("/barry/user-details", h.listUserDetails)
	engine.GET("/barry/user-details/payment-methods", h.listUserPaymentMethods)
	engine.GET("/barry/user-details/detail", h.getUserDetail)
	engine.POST("/barry/user-details", h.createUserDetail)
	engine.PUT("/barry/user-details", h.updateUserDetail)
	engine.PUT("/barry/user-details/password", h.changeUserDetailPassword)
	engine.GET("/barry/user-points", h.listUserPoints)
	engine.POST("/barry/user-points/adjust", h.adjustUserPoints)
	engine.GET("/barry/user-points/summary", h.getUserPointsSummary)
	engine.GET("/barry/point-withdraws", h.listPointWithdraws)
	engine.GET("/barry/user-withdraw-records", h.listUserWithdrawRecords)
	engine.POST("/barry/user-withdraws/account", h.accountUserWithdraw)
	engine.POST("/barry/user-withdraws/finish", h.finishUserWithdraw)
	engine.POST("/barry/user-withdraws/cancel", h.cancelUserWithdraw)
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
	commonRouter.ToJson(c, baseDTO.BuildPage(response.Total, response.Data), nil)
}

func (h *BarryHandler) listUserWhitelists(c *gin.Context) {
	var q barryDTO.UserWhitelistQueryDTO
	if c.ShouldBindQuery(&q) != nil || q.ShopCategoryID == "" {
		commonRouter.ToError(c, "商品分类不能为空")
		return
	}
	normalizeBarryPageWithDefault(&q.PageQueryDTO, 10)
	response, err := h.barryService.UserWhitelist.List(c.Request.Context(), q)
	if err != nil {
		commonRouter.ToJson(c, nil, err)
		return
	}
	commonRouter.ToJson(c, baseDTO.BuildPage(response.Total, response.Data), nil)
}

func (h *BarryHandler) saveUserWhitelist(c *gin.Context) {
	var req barryDTO.SaveUserWhitelistDTO
	if c.ShouldBindJSON(&req) != nil || req.UserID <= 0 || req.ShopCategoryID <= 0 ||
		(req.FetchTaskLoopNum != nil && *req.FetchTaskLoopNum <= 0) {
		commonRouter.ToError(c, "参数错误")
		return
	}
	// 审核通过率是闭区间 [下限, 上限]，任一侧留空表示该侧不限制。
	if !isValidApprovalRate(req.MinRecentApprovalRate) || !isValidApprovalRate(req.MaxRecentApprovalRate) {
		commonRouter.ToError(c, "审核通过率需在0~100%之间")
		return
	}
	if req.MinRecentApprovalRate != nil && req.MaxRecentApprovalRate != nil &&
		*req.MinRecentApprovalRate > *req.MaxRecentApprovalRate {
		commonRouter.ToError(c, "审核通过率下限不能大于上限")
		return
	}
	response, err := h.barryService.UserWhitelist.Save(c.Request.Context(), &req)
	if err != nil {
		commonRouter.ToJson(c, nil, err)
		return
	}
	if !response.Success && response.Code != "0" {
		if response.Message == "" {
			commonRouter.ToError(c, "添加白名单失败")
			return
		}
		commonRouter.ToError(c, response.Message)
		return
	}
	commonRouter.ToJson(c, response.Data, nil)
}

func (h *BarryHandler) updateUserWhitelistStatus(c *gin.Context) {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil || id <= 0 {
		commonRouter.ToError(c, "参数错误")
		return
	}
	var req barryDTO.UpdateUserWhitelistStatusDTO
	if c.ShouldBindJSON(&req) != nil || req.Active == nil {
		commonRouter.ToError(c, "参数错误")
		return
	}
	req.ID = id
	response, err := h.barryService.UserWhitelist.UpdateStatus(c.Request.Context(), &req)
	if err != nil {
		commonRouter.ToJson(c, nil, err)
		return
	}
	if !response.Success && response.Code != "0" {
		if response.Message == "" {
			commonRouter.ToError(c, "更新白名单状态失败")
			return
		}
		commonRouter.ToError(c, response.Message)
		return
	}
	commonRouter.ToJson(c, response.Data, nil)
}

func (h *BarryHandler) updateUserWhitelistGroup(c *gin.Context) {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil || id <= 0 {
		commonRouter.ToError(c, "参数错误")
		return
	}
	var req barryDTO.UpdateUserWhitelistGroupDTO
	if c.ShouldBindJSON(&req) != nil || req.Group == "" {
		commonRouter.ToError(c, "参数错误")
		return
	}
	req.ID = id
	response, err := h.barryService.UserWhitelist.UpdateGroup(c.Request.Context(), &req)
	if err != nil {
		commonRouter.ToJson(c, nil, err)
		return
	}
	if !response.Success && response.Code != "0" {
		commonRouter.ToError(c, "更新白名单分组失败")
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

// 人工调整用户积分：正数增加、负数扣减，只作用于可用余额。
func (h *BarryHandler) adjustUserPoints(c *gin.Context) {
	var req barryDTO.AdjustUserPointsDTO
	if c.ShouldBindJSON(&req) != nil || req.UserID <= 0 || req.Points == 0 || strings.TrimSpace(req.Description) == "" {
		commonRouter.ToError(c, "参数错误")
		return
	}
	req.Description = strings.TrimSpace(req.Description)
	req.Serial = strings.TrimSpace(req.Serial)
	response, err := h.barryService.UserPointsAdmin.Adjust(c.Request.Context(), &req)
	if err != nil {
		commonRouter.ToJson(c, nil, err)
		return
	}
	if !response.Success {
		if response.Message == "" {
			commonRouter.ToError(c, "积分调整失败")
			return
		}
		commonRouter.ToError(c, response.Message)
		return
	}
	commonRouter.ToJson(c, "操作成功", nil)
}

// 全部账号余额汇总：更新时间下界 + 排除用户，两者都可留空。
func (h *BarryHandler) getUserPointsSummary(c *gin.Context) {
	var q barryDTO.UserPointsSummaryQueryDTO
	if c.ShouldBindQuery(&q) != nil {
		commonRouter.ToError(c, "参数错误")
		return
	}
	response, err := h.barryService.UserPointsAdmin.Summary(c.Request.Context(), q)
	if err != nil {
		commonRouter.ToJson(c, nil, err)
		return
	}
	if !response.Success {
		if response.Message == "" {
			commonRouter.ToError(c, "统计账号余额失败")
			return
		}
		commonRouter.ToError(c, response.Message)
		return
	}
	commonRouter.ToJson(c, response.Data, nil)
}

func (h *BarryHandler) listUserDetails(c *gin.Context) {
	var q barryDTO.UserDetailQueryDTO
	if c.ShouldBindQuery(&q) != nil {
		commonRouter.ToError(c, "参数错误")
		return
	}
	normalizeBarryPageWithDefault(&q.PageQueryDTO, 10)
	response, err := h.barryService.UserDetail.List(c.Request.Context(), q)
	if err != nil {
		commonRouter.ToJson(c, nil, err)
		return
	}
	commonRouter.ToJson(c, baseDTO.BuildPage(response.Total, response.Data), nil)
}

func (h *BarryHandler) listUserPaymentMethods(c *gin.Context) {
	var q barryDTO.UserDetailQueryDTO
	if c.ShouldBindQuery(&q) != nil || q.Username == "" {
		commonRouter.ToError(c, "用户名不能为空")
		return
	}
	response, err := h.barryService.UserDetail.ListPaymentMethods(c.Request.Context(), q)
	if err != nil {
		commonRouter.ToJson(c, nil, err)
		return
	}
	commonRouter.ToJson(c, response.Data, nil)
}

func (h *BarryHandler) getUserDetail(c *gin.Context) {
	var q barryDTO.UserDetailQueryDTO
	if c.ShouldBindQuery(&q) != nil || q.Username == "" {
		commonRouter.ToError(c, "用户名不能为空")
		return
	}
	response, err := h.barryService.UserDetail.FindByUsername(c.Request.Context(), q.Username)
	if err != nil {
		commonRouter.ToJson(c, nil, err)
		return
	}
	commonRouter.ToJson(c, response.Data, nil)
}

func (h *BarryHandler) createUserDetail(c *gin.Context) {
	var req barryDTO.SaveUserDetailDTO
	if c.ShouldBindJSON(&req) != nil {
		commonRouter.ToError(c, "参数错误")
		return
	}
	response, err := h.barryService.UserDetail.Save(c.Request.Context(), &req)
	if err != nil {
		commonRouter.ToJson(c, nil, err)
		return
	}
	commonRouter.ToJson(c, response.Data, nil)
}

func (h *BarryHandler) updateUserDetail(c *gin.Context) {
	var req barryDTO.UpdateUserDetailDTO
	if c.ShouldBindJSON(&req) != nil {
		commonRouter.ToError(c, "参数错误")
		return
	}
	response, err := h.barryService.UserDetail.Update(c.Request.Context(), &req)
	if err != nil {
		commonRouter.ToJson(c, nil, err)
		return
	}
	commonRouter.ToJson(c, response.Data, nil)
}

func (h *BarryHandler) changeUserDetailPassword(c *gin.Context) {
	var req barryDTO.ChangeUserDetailPasswordDTO
	if c.ShouldBindJSON(&req) != nil {
		commonRouter.ToError(c, "参数错误")
		return
	}
	response, err := h.barryService.UserDetail.ChangePassword(c.Request.Context(), &req)
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

func (h *BarryHandler) listUserWithdrawRecords(c *gin.Context) {
	var q barryDTO.UserWithdrawRecordQueryDTO
	if c.ShouldBindQuery(&q) != nil {
		commonRouter.ToError(c, "参数错误")
		return
	}
	response, err := h.barryService.UserWithdraw.List(c.Request.Context(), q)
	if err != nil {
		commonRouter.ToJson(c, nil, err)
		return
	}
	commonRouter.ToJson(c, response.Data, nil)
}

func (h *BarryHandler) accountUserWithdraw(c *gin.Context) {
	h.handleUserWithdrawAction(c, "发起积分结算失败", func(req *barryDTO.UserWithdrawActionDTO) (*barryDTO.ActionResponseDTO, error) {
		return h.barryService.UserWithdraw.Account(c.Request.Context(), req)
	})
}

func (h *BarryHandler) finishUserWithdraw(c *gin.Context) {
	h.handleUserWithdrawAction(c, "发起积分核销失败", func(req *barryDTO.UserWithdrawActionDTO) (*barryDTO.ActionResponseDTO, error) {
		return h.barryService.UserWithdraw.Finish(c.Request.Context(), req)
	})
}

func (h *BarryHandler) cancelUserWithdraw(c *gin.Context) {
	h.handleUserWithdrawAction(c, "发起取消提现失败", func(req *barryDTO.UserWithdrawActionDTO) (*barryDTO.ActionResponseDTO, error) {
		return h.barryService.UserWithdraw.Cancel(c.Request.Context(), req)
	})
}

func (h *BarryHandler) handleUserWithdrawAction(c *gin.Context, fallbackMessage string, operation func(req *barryDTO.UserWithdrawActionDTO) (*barryDTO.ActionResponseDTO, error)) {
	var req barryDTO.UserWithdrawActionDTO
	if c.ShouldBindJSON(&req) != nil || req.UserPointWithdrawRecordID <= 0 {
		commonRouter.ToError(c, "参数错误")
		return
	}
	if c.FullPath() == "/barry/user-withdraws/cancel" && req.Description == "" {
		commonRouter.ToError(c, "驳回原因不能为空")
		return
	}
	response, err := operation(&req)
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
	commonRouter.ToJson(c, "操作成功", nil)
}
