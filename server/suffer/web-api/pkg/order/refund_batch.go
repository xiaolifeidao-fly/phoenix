package order

import (
	"log"
	"net/http"
	"strconv"

	commonRouter "common/middleware/routers"
	orderDTO "suffer/service/order/dto"

	"github.com/gin-gonic/gin"
)

func (h *OrderHandler) listRefundBatchTasks(c *gin.Context) {
	var query orderDTO.RefundBatchTaskQueryDTO
	if c.ShouldBindQuery(&query) != nil {
		log.Printf("refund batch task list rejected: invalid query")
		commonRouter.ToError(c, "参数错误")
		return
	}
	result, err := h.refundBatchService.ListTasks(c.Request.Context(), query, currentToken(c))
	if err != nil {
		log.Printf("refund batch task list failed: %v", err)
	}
	commonRouter.ToJson(c, result, err)
}

func (h *OrderHandler) importRefundBatch(c *gin.Context) {
	var req orderDTO.CreateRefundBatchDTO
	if c.ShouldBindJSON(&req) != nil {
		log.Printf("refund batch import rejected: invalid request body")
		commonRouter.ToError(c, "参数错误")
		return
	}
	resultMessage, err := h.refundBatchService.Import(c.Request.Context(), req, currentToken(c))
	if err != nil {
		log.Printf("refund batch import failed: %v", err)
		commonRouter.ToError(c, err.Error())
		return
	}
	commonRouter.ToJson(c, gin.H{
		"message": resultMessage,
	}, nil)
}

func (h *OrderHandler) executeRefundBatchTask(c *gin.Context) {
	taskID, ok := parseRefundBatchID(c)
	if !ok {
		return
	}
	resultMessage, err := h.refundBatchService.Execute(c.Request.Context(), taskID, currentToken(c))
	if err != nil {
		log.Printf("refund batch execute failed: taskId=%d err=%v", taskID, err)
		commonRouter.ToError(c, err.Error())
		return
	}
	commonRouter.ToJson(c, gin.H{"message": resultMessage}, nil)
}

func (h *OrderHandler) listRefundBatchDetails(c *gin.Context) {
	var query orderDTO.RefundBatchDetailQueryDTO
	if c.ShouldBindQuery(&query) != nil {
		log.Printf("refund batch detail list rejected: invalid query")
		commonRouter.ToError(c, "参数错误")
		return
	}
	result, err := h.refundBatchService.ListDetails(c.Request.Context(), query, currentToken(c))
	if err != nil {
		log.Printf("refund batch detail list failed: %v", err)
	}
	commonRouter.ToJson(c, result, err)
}

func parseRefundBatchID(c *gin.Context) (uint64, bool) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil || id == 0 {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"code":    commonRouter.FailCode,
			"data":    nil,
			"message": "参数错误",
			"error":   "id必须是正整数",
		})
		return 0, false
	}
	return id, true
}
