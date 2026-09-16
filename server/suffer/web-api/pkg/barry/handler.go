package barry

import (
	commonRouter "common/middleware/routers"
	"suffer/service/barry"
	barryDTO "suffer/service/barry/dto"

	"github.com/gin-gonic/gin"
)

type BarryHandler struct {
	*commonRouter.BaseHandler
	barryService *barry.BarryService
}

func NewBarryHandler() *BarryHandler {
	return &BarryHandler{
		BaseHandler:  &commonRouter.BaseHandler{},
		barryService: barry.NewBarryService(),
	}
}

func (h *BarryHandler) RegisterHandler(engine *gin.RouterGroup) {
	h.registerProductRoutes(engine)
	h.registerChannelRoutes(engine)
	h.registerUserRoutes(engine)
	h.registerTransactionRoutes(engine)
	h.registerOrderFetchMonitorRoutes(engine)
	h.registerOrderManualDetailRoutes(engine)
	h.registerOrderRealDetailRoutes(engine)
	h.registerDropRepairRoutes(engine)
}

// isValidApprovalRate 审核通过率取值校验, 0~1 之间; nil 表示该侧不限制, 视为合法.
func isValidApprovalRate(rate *float64) bool {
	return rate == nil || (*rate >= 0 && *rate <= 1)
}

func normalizeBarryPage(q *barryDTO.PageQueryDTO) {
	normalizeBarryPageWithDefault(q, 200)
}

func normalizeBarryPageWithDefault(q *barryDTO.PageQueryDTO, defaultPageSize int) {
	if q == nil {
		return
	}
	if defaultPageSize <= 0 {
		defaultPageSize = 10
	}
	if q.PageIndex <= 0 {
		q.PageIndex = q.Page
	}
	if q.PageIndex <= 0 {
		q.PageIndex = 1
	}
	if q.Page <= 0 {
		q.Page = q.PageIndex
	}
	if q.PageSize <= 0 {
		q.PageSize = defaultPageSize
	}
}
