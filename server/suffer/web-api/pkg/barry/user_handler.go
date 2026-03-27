package barry

import (
	commonRouter "common/middleware/routers"
	barryDTO "suffer/service/barry/dto"

	"github.com/gin-gonic/gin"
)

func (h *BarryHandler) registerUserRoutes(engine *gin.RouterGroup) {
	engine.GET("/barry/users", h.listUsers)
	engine.GET("/barry/user-details", h.listUserDetails)
	engine.GET("/barry/user-details/detail", h.getUserDetail)
	engine.POST("/barry/user-details", h.createUserDetail)
	engine.PUT("/barry/user-details", h.updateUserDetail)
	engine.GET("/barry/user-points", h.listUserPoints)
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

func (h *BarryHandler) listUserDetails(c *gin.Context) {
	var q barryDTO.UserDetailQueryDTO
	if c.ShouldBindQuery(&q) != nil {
		commonRouter.ToError(c, "参数错误")
		return
	}
	response, err := h.barryService.UserDetail.List(c.Request.Context(), q)
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
