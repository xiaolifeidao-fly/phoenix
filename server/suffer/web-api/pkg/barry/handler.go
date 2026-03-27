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
}

func normalizeBarryPage(q *barryDTO.PageQueryDTO) {
	if q == nil {
		return
	}
	if q.PageIndex <= 0 {
		q.PageIndex = 1
	}
	if q.PageSize <= 0 {
		q.PageSize = 200
	}
}
