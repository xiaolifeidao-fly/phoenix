package recon

import (
	commonRouter "common/middleware/routers"
	"strconv"
	authService "suffer/service/auth"
	reconService "suffer/service/recon"
	reconDTO "suffer/service/recon/dto"
	webAuth "suffer/web-api/auth"

	"github.com/gin-gonic/gin"
)

// ReconHandler 对账工作台 - 账户状态: 人工录入欠款时间线 + 系统计算欠款; 人工记账及其与出入账的利润对比.
type ReconHandler struct {
	*commonRouter.BaseHandler
	reconService *reconService.ReconService
}

func NewReconHandler() *ReconHandler {
	service := reconService.NewReconService()
	// 以 add_recon_account_opening_debt.sql、add_recon_manual_book.sql 为准; 这里和其他模块一样兜底建表, 失败不影响启动
	_ = service.EnsureTable()
	return &ReconHandler{BaseHandler: &commonRouter.BaseHandler{}, reconService: service}
}

func (h *ReconHandler) RegisterHandler(engine *gin.RouterGroup) {
	engine.GET("/reconciliation/account-status", h.accountStatus)
	engine.GET("/reconciliation/opening-debts", h.listOpeningDebts)
	engine.POST("/reconciliation/opening-debts", h.createOpeningDebt)
	engine.PUT("/reconciliation/opening-debts/:id", h.updateOpeningDebt)
	engine.DELETE("/reconciliation/opening-debts/:id", h.revokeOpeningDebt)
	engine.GET("/reconciliation/manual-books/compare", h.compareManualBooks)
	engine.GET("/reconciliation/debt-compare", h.debtCompare)
	engine.GET("/reconciliation/manual-books/detail", h.manualBookDetail)
	engine.GET("/reconciliation/manual-books/logs", h.manualBookLogs)
	engine.POST("/reconciliation/manual-books", h.createManualBook)
	engine.PUT("/reconciliation/manual-books/:id", h.updateManualBook)
	engine.DELETE("/reconciliation/manual-books/:id", h.deleteManualBook)
}

func (h *ReconHandler) compareManualBooks(c *gin.Context) {
	result, err := h.reconService.CompareManualBooks(c.Request.Context(), c.Query("startDate"), c.Query("endDate"))
	commonRouter.ToJson(c, result, err)
}

// debtCompare 欠款核对: 每个上游社区的系统应收 vs 人工应收(入账 + 人工记账欠款).
func (h *ReconHandler) debtCompare(c *gin.Context) {
	result, err := h.reconService.DebtCompare(c.Request.Context(), c.Query("startDate"), c.Query("endDate"))
	commonRouter.ToJson(c, result, err)
}

func (h *ReconHandler) manualBookDetail(c *gin.Context) {
	result, err := h.reconService.ManualBookDetail(c.Query("date"))
	commonRouter.ToJson(c, result, err)
}

// manualBookLogs 修改记录: 查一天时 startDate、endDate 传同一天.
func (h *ReconHandler) manualBookLogs(c *gin.Context) {
	result, err := h.reconService.ManualBookLogs(c.Query("startDate"), c.Query("endDate"))
	commonRouter.ToJson(c, result, err)
}

func (h *ReconHandler) createManualBook(c *gin.Context) {
	var req reconDTO.SaveManualBookDTO
	if c.ShouldBindJSON(&req) != nil {
		commonRouter.ToError(c, "参数错误")
		return
	}
	result, err := h.reconService.CreateManualBook(req, operator(c))
	commonRouter.ToJson(c, result, err)
}

func (h *ReconHandler) updateManualBook(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil || id == 0 {
		commonRouter.ToError(c, "参数错误")
		return
	}
	var req reconDTO.SaveManualBookDTO
	if c.ShouldBindJSON(&req) != nil {
		commonRouter.ToError(c, "参数错误")
		return
	}
	result, err := h.reconService.UpdateManualBook(uint(id), req, operator(c))
	commonRouter.ToJson(c, result, err)
}

func (h *ReconHandler) deleteManualBook(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil || id == 0 {
		commonRouter.ToError(c, "参数错误")
		return
	}
	if err := h.reconService.DeleteManualBook(uint(id), operator(c)); err != nil {
		commonRouter.ToJson(c, nil, err)
		return
	}
	commonRouter.ToJson(c, true, nil)
}

func (h *ReconHandler) accountStatus(c *gin.Context) {
	result, err := h.reconService.AccountStatus(c.Request.Context(), c.Query("startDate"), c.Query("endDate"))
	commonRouter.ToJson(c, result, err)
}

func (h *ReconHandler) listOpeningDebts(c *gin.Context) {
	userID, _ := strconv.ParseUint(c.Query("userId"), 10, 64)
	result, err := h.reconService.ListOpeningDebts(userID)
	commonRouter.ToJson(c, result, err)
}

func (h *ReconHandler) createOpeningDebt(c *gin.Context) {
	var req reconDTO.SaveOpeningDebtDTO
	if c.ShouldBindJSON(&req) != nil {
		commonRouter.ToError(c, "参数错误")
		return
	}
	result, err := h.reconService.CreateOpeningDebt(req, operator(c))
	commonRouter.ToJson(c, result, err)
}

func (h *ReconHandler) updateOpeningDebt(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil || id == 0 {
		commonRouter.ToError(c, "参数错误")
		return
	}
	var req reconDTO.SaveOpeningDebtDTO
	if c.ShouldBindJSON(&req) != nil {
		commonRouter.ToError(c, "参数错误")
		return
	}
	result, err := h.reconService.UpdateOpeningDebt(uint(id), req, operator(c))
	commonRouter.ToJson(c, result, err)
}

func (h *ReconHandler) revokeOpeningDebt(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil || id == 0 {
		commonRouter.ToError(c, "参数错误")
		return
	}
	if err := h.reconService.RevokeOpeningDebt(uint(id), operator(c)); err != nil {
		commonRouter.ToJson(c, nil, err)
		return
	}
	commonRouter.ToJson(c, true, nil)
}

// operator 当前登录用户名, 记到 created_by / updated_by.
func operator(c *gin.Context) string {
	value, exists := c.Get(webAuth.ContextUserKey)
	if !exists {
		return ""
	}
	user, ok := value.(*authService.LoginUser)
	if !ok || user == nil {
		return ""
	}
	if user.Username != "" {
		return user.Username
	}
	return user.Name
}
