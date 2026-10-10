package barry

import (
	commonRouter "common/middleware/routers"
	"errors"
	"strconv"
	"strings"
	authService "suffer/service/auth"
	barryDTO "suffer/service/barry/dto"
	userService "suffer/service/user"
	webAuth "suffer/web-api/auth"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// lookupUpstreamUser 按 suffer 用户 ID 取上游社区名称; 用户不存在返回 errUpstreamUserNotFound. 测试里替换.
var lookupUpstreamUser = func(id uint) (string, error) {
	user, err := userService.NewUserService().GetUserByID(id)
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return "", errUpstreamUserNotFound
	}
	if err != nil {
		return "", err
	}
	if strings.TrimSpace(user.Name) != "" {
		return strings.TrimSpace(user.Name), nil
	}
	return strings.TrimSpace(user.Username), nil
}

var errUpstreamUserNotFound = errors.New("上游社区不存在")

// 新管理端 - 对账 - 对账工作台.
func (h *BarryHandler) registerReconciliationRoutes(engine *gin.RouterGroup) {
	engine.GET("/barry/reconciliation/manual-dimension", h.getReconManualDimension)
	engine.GET("/barry/reconciliation/ledgers", h.listReconLedgers)
	engine.GET("/barry/reconciliation/ledgers/summary", h.getReconLedgerSummary)
	engine.POST("/barry/reconciliation/ledgers", h.saveReconLedger)
	engine.PUT("/barry/reconciliation/ledgers/:id", h.saveReconLedger)
	engine.DELETE("/barry/reconciliation/ledgers/:id", h.deleteReconLedger)
	engine.POST("/barry/reconciliation/ledgers/:id/fee-given", h.giveReconLedgerFee)
	engine.GET("/barry/reconciliation/ledgers/:id/snapshots", h.listReconLedgerSnapshots)
	engine.POST("/barry/reconciliation/ledgers/sync-withdraw", h.syncReconLedgerWithdraw)
}

func (h *BarryHandler) getReconManualDimension(c *gin.Context) {
	var q barryDTO.ReconManualDimensionQueryDTO
	if c.ShouldBindQuery(&q) != nil {
		commonRouter.ToError(c, "请选择开始和结束日期")
		return
	}
	response, err := h.barryService.Reconciliation.ManualDimension(c.Request.Context(), q)
	if err != nil {
		commonRouter.ToJson(c, nil, err)
		return
	}
	commonRouter.ToJson(c, response, nil)
}

func (h *BarryHandler) listReconLedgers(c *gin.Context) {
	var q barryDTO.ReconLedgerQueryDTO
	if c.ShouldBindQuery(&q) != nil {
		commonRouter.ToError(c, "请选择开始和结束日期")
		return
	}
	response, err := h.barryService.Reconciliation.ListLedger(c.Request.Context(), q)
	if err != nil {
		commonRouter.ToJson(c, nil, err)
		return
	}
	commonRouter.ToJson(c, response, nil)
}

func (h *BarryHandler) getReconLedgerSummary(c *gin.Context) {
	var q barryDTO.ReconManualDimensionQueryDTO
	if c.ShouldBindQuery(&q) != nil {
		commonRouter.ToError(c, "请选择开始和结束日期")
		return
	}
	response, err := h.barryService.Reconciliation.LedgerSummary(c.Request.Context(), q.StartDate, q.EndDate)
	if err != nil {
		commonRouter.ToJson(c, nil, err)
		return
	}
	commonRouter.ToJson(c, response, nil)
}

// saveReconLedger POST 新增, PUT /:id 修改. 业务校验(类目、币种、汇率、通道)都在 barry.
func (h *BarryHandler) saveReconLedger(c *gin.Context) {
	var req barryDTO.ReconLedgerDTO
	if c.ShouldBindJSON(&req) != nil {
		commonRouter.ToError(c, "参数错误")
		return
	}
	req.ID = nil
	if raw := c.Param("id"); raw != "" {
		id, err := strconv.ParseInt(raw, 10, 64)
		if err != nil || id <= 0 {
			commonRouter.ToError(c, "参数错误")
			return
		}
		req.ID = &id
	}
	if msg := validateReconLedger(&req); msg != "" {
		commonRouter.ToError(c, msg)
		return
	}
	if msg, err := fillUpstreamUser(&req); err != nil {
		commonRouter.ToJson(c, nil, err)
		return
	} else if msg != "" {
		commonRouter.ToError(c, msg)
		return
	}
	response, err := h.barryService.Reconciliation.SaveLedger(c.Request.Context(), &req, reconOperator(c))
	if err != nil {
		commonRouter.ToJson(c, nil, err)
		return
	}
	commonRouter.ToJson(c, response, nil)
}

func (h *BarryHandler) deleteReconLedger(c *gin.Context) {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil || id <= 0 {
		commonRouter.ToError(c, "参数错误")
		return
	}
	if err := h.barryService.Reconciliation.DeleteLedger(c.Request.Context(), id, reconOperator(c)); err != nil {
		commonRouter.ToJson(c, nil, err)
		return
	}
	commonRouter.ToJson(c, true, nil)
}

// giveReconLedgerFee 入账赠送: 把社区入账的代收手续费加到该上游社区的 Kakrolot 余额.
// 金额以 barry 记的手续费为准, 不取前端的值; Kakrolot 按入账 ID 幂等, 每条入账只赠送一次.
func (h *BarryHandler) giveReconLedgerFee(c *gin.Context) {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil || id <= 0 {
		commonRouter.ToError(c, "参数错误")
		return
	}
	var req struct {
		RecordDate string `json:"recordDate"`
	}
	if c.ShouldBindJSON(&req) != nil || strings.TrimSpace(req.RecordDate) == "" {
		commonRouter.ToError(c, "入账日期不能为空")
		return
	}
	income, fee, err := h.barryService.Reconciliation.FindIncomeWithFee(c.Request.Context(), id, strings.TrimSpace(req.RecordDate))
	if err != nil {
		commonRouter.ToJson(c, nil, err)
		return
	}
	if income == nil || income.Category != "COMMUNITY_IN" {
		commonRouter.ToError(c, "社区入账不存在")
		return
	}
	if fee == nil || fee.AmountRmb == nil || *fee.AmountRmb <= 0 {
		commonRouter.ToError(c, "该入账没有代收手续费")
		return
	}
	upstreamUserID, err := strconv.ParseUint(strings.TrimSpace(income.UpstreamUserID), 10, 64)
	if err != nil || upstreamUserID == 0 {
		commonRouter.ToError(c, "该入账没有上游社区")
		return
	}
	token := ""
	if value, exists := c.Get(webAuth.ContextTokenKey); exists {
		token, _ = value.(string)
	}
	given, err := h.kakrolotAccount.IncomeGiven(c.Request.Context(), upstreamUserID, id, *fee.AmountRmb, token)
	if err != nil {
		commonRouter.ToError(c, err.Error())
		return
	}
	commonRouter.ToJson(c, barryDTO.ReconLedgerFeeGivenDTO{
		LedgerID:         id,
		UpstreamUserID:   income.UpstreamUserID,
		UpstreamUserName: income.UpstreamUserName,
		Amount:           *fee.AmountRmb,
		Given:            given,
	}, nil)
}

// listReconLedgerSnapshots 某条出入账的人工修改快照.
func (h *BarryHandler) listReconLedgerSnapshots(c *gin.Context) {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil || id <= 0 {
		commonRouter.ToError(c, "参数错误")
		return
	}
	result, err := h.barryService.Reconciliation.LedgerSnapshots(c.Request.Context(), id)
	if err != nil {
		commonRouter.ToJson(c, nil, err)
		return
	}
	commonRouter.ToJson(c, result, nil)
}

func (h *BarryHandler) syncReconLedgerWithdraw(c *gin.Context) {
	var req barryDTO.ReconManualDimensionQueryDTO
	if c.ShouldBindJSON(&req) != nil {
		commonRouter.ToError(c, "请选择开始和结束日期")
		return
	}
	result, err := h.barryService.Reconciliation.SyncWithdraw(c.Request.Context(), req.StartDate, req.EndDate)
	if err != nil {
		commonRouter.ToJson(c, nil, err)
		return
	}
	commonRouter.ToJson(c, result, nil)
}

// validateReconLedger 只做形状校验, 免得明显错误的请求打到 barry.
func validateReconLedger(req *barryDTO.ReconLedgerDTO) string {
	req.RecordDate = strings.TrimSpace(req.RecordDate)
	req.Category = strings.TrimSpace(req.Category)
	req.Currency = strings.TrimSpace(req.Currency)
	req.UpstreamUserID = strings.TrimSpace(req.UpstreamUserID)
	if req.RecordDate == "" {
		return "日期不能为空"
	}
	if req.Category == "" {
		return "请选择类目"
	}
	if req.Category == "COMMUNITY_IN" && req.UpstreamUserID == "" {
		return "社区入账需选择上游社区"
	}
	// 下游人工用户只属于人工出款: 人工录入的人工出款必选, 其他类目丢掉
	if req.Category == "MANUAL_SETTLE" {
		if req.UserID == nil || *req.UserID <= 0 {
			return "人工出款需选择下游人工用户"
		}
	} else {
		req.UserID = nil
	}
	if !isValidSettleCurrency(req.Currency) {
		return "币种不正确"
	}
	if req.Amount == nil || *req.Amount <= 0 {
		return "金额需大于0"
	}
	if req.ExchangeRate != nil && *req.ExchangeRate <= 0 {
		return "汇率需大于0"
	}
	return ""
}

// reconOperator 当前登录人, 记到 barry 的 created_by / updated_by.
func reconOperator(c *gin.Context) string {
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

// fillUpstreamUser 社区入账: 校验上游社区在 suffer 用户表里存在, 并用表里的名称覆盖前端传的名称;
// 其他类目清空上游字段. 返回的 msg 非空表示参数问题, err 表示查询失败.
func fillUpstreamUser(req *barryDTO.ReconLedgerDTO) (string, error) {
	if req.Category != "COMMUNITY_IN" {
		req.UpstreamUserID = ""
		req.UpstreamUserName = ""
		return "", nil
	}
	id, err := strconv.ParseUint(req.UpstreamUserID, 10, 64)
	if err != nil || id == 0 {
		return "上游社区不正确", nil
	}
	name, err := lookupUpstreamUser(uint(id))
	if errors.Is(err, errUpstreamUserNotFound) {
		return errUpstreamUserNotFound.Error(), nil
	}
	if err != nil {
		return "", err
	}
	req.UpstreamUserName = name
	return "", nil
}
