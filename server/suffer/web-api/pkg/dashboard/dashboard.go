package dashboard

import (
	commonRouter "common/middleware/routers"
	"strconv"
	"strings"
	dashboardService "suffer/service/dashboard"

	"github.com/gin-gonic/gin"
)

// DashboardHandler owns Web API account-ledger cards. They remain independent
// from Barry's manual-product dashboard endpoints.
type DashboardHandler struct {
	*commonRouter.BaseHandler
	dashboardService *dashboardService.DashboardService
}

func NewDashboardHandler() *DashboardHandler {
	return &DashboardHandler{
		BaseHandler:      &commonRouter.BaseHandler{},
		dashboardService: dashboardService.NewDashboardService(),
	}
}

func (h *DashboardHandler) RegisterHandler(engine *gin.RouterGroup) {
	engine.GET("/dashboard/today-consume", h.todayConsume)
	engine.GET("/dashboard/today-recharge", h.todayRecharge)
	engine.GET("/dashboard/system-balance", h.systemBalance)
	engine.GET("/dashboard/actual-completed", h.actualCompleted)
}

func (h *DashboardHandler) todayConsume(c *gin.Context) {
	result, err := h.dashboardService.TodayConsumeSummary()
	commonRouter.ToJson(c, result, err)
}

func (h *DashboardHandler) todayRecharge(c *gin.Context) {
	result, err := h.dashboardService.TodayRechargeSummary()
	commonRouter.ToJson(c, result, err)
}

func (h *DashboardHandler) systemBalance(c *gin.Context) {
	result, err := h.dashboardService.SystemBalanceSummary()
	commonRouter.ToJson(c, result, err)
}

func (h *DashboardHandler) actualCompleted(c *gin.Context) {
	shopCategoryIDs, err := parseShopCategoryIDs(c.Query("shopCategoryIds"))
	if err != nil {
		commonRouter.ToError(c, "商品类目参数错误")
		return
	}
	result, err := h.dashboardService.TodayActualCompleted(shopCategoryIDs)
	commonRouter.ToJson(c, result, err)
}

func parseShopCategoryIDs(value string) ([]uint64, error) {
	if strings.TrimSpace(value) == "" {
		return nil, nil
	}
	seen := make(map[uint64]struct{})
	result := make([]uint64, 0)
	for _, part := range strings.Split(value, ",") {
		id, err := strconv.ParseUint(strings.TrimSpace(part), 10, 64)
		if err != nil {
			return nil, err
		}
		if id == 0 {
			return nil, strconv.ErrSyntax
		}
		if _, exists := seen[id]; !exists {
			seen[id] = struct{}{}
			result = append(result, id)
		}
	}
	return result, nil
}
