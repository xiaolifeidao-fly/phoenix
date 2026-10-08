// Package upstream 新管理端「上游」菜单的接口，目前只有上游社区配置（转发 kakrolot-web /externalOrderConfig）。
package upstream

import (
	"log"
	"net/http"
	"strconv"

	commonRouter "common/middleware/routers"
	kakrolotService "suffer/service/kakrolot"
	webAuth "suffer/web-api/auth"

	"github.com/gin-gonic/gin"
)

type UpstreamHandler struct {
	*commonRouter.BaseHandler
	externalOrderConfigService *kakrolotService.ExternalOrderConfigService
}

func NewUpstreamHandler() *UpstreamHandler {
	return &UpstreamHandler{
		BaseHandler:                &commonRouter.BaseHandler{},
		externalOrderConfigService: kakrolotService.NewExternalOrderConfigService(kakrolotService.NewClient()),
	}
}

func (h *UpstreamHandler) RegisterHandler(engine *gin.RouterGroup) {
	engine.GET("/upstream/communities", h.listCommunities)
	engine.POST("/upstream/communities/:id/update", h.updateCommunity)
	engine.POST("/upstream/communities/:id/disable", h.disableCommunity)
	engine.POST("/upstream/communities/:id/enable", h.enableCommunity)
}

func (h *UpstreamHandler) listCommunities(c *gin.Context) {
	var query kakrolotService.ExternalOrderConfigQueryDTO
	if c.ShouldBindQuery(&query) != nil {
		commonRouter.ToError(c, "参数错误")
		return
	}
	result, err := h.externalOrderConfigService.List(c.Request.Context(), query, currentToken(c))
	if err != nil {
		log.Printf("upstream community list failed: %v", err)
	}
	commonRouter.ToJson(c, result, err)
}

func (h *UpstreamHandler) updateCommunity(c *gin.Context) {
	id, ok := parseID(c)
	if !ok {
		return
	}
	var req kakrolotService.UpdateExternalOrderConfigDTO
	if c.ShouldBindJSON(&req) != nil {
		commonRouter.ToError(c, "参数错误")
		return
	}
	resultMessage, err := h.externalOrderConfigService.UpdatePrefixURL(c.Request.Context(), id, req, currentToken(c))
	h.respondAction(c, "update", id, resultMessage, err)
}

func (h *UpstreamHandler) disableCommunity(c *gin.Context) {
	id, ok := parseID(c)
	if !ok {
		return
	}
	resultMessage, err := h.externalOrderConfigService.Disable(c.Request.Context(), id, currentToken(c))
	h.respondAction(c, "disable", id, resultMessage, err)
}

func (h *UpstreamHandler) enableCommunity(c *gin.Context) {
	id, ok := parseID(c)
	if !ok {
		return
	}
	resultMessage, err := h.externalOrderConfigService.Enable(c.Request.Context(), id, currentToken(c))
	h.respondAction(c, "enable", id, resultMessage, err)
}

func (h *UpstreamHandler) respondAction(c *gin.Context, action string, id uint64, resultMessage string, err error) {
	if err != nil {
		log.Printf("upstream community %s failed: id=%d err=%v", action, id, err)
		commonRouter.ToError(c, err.Error())
		return
	}
	commonRouter.ToJson(c, gin.H{"message": resultMessage}, nil)
}

func currentToken(c *gin.Context) string {
	if value, exists := c.Get(webAuth.ContextTokenKey); exists {
		if token, ok := value.(string); ok {
			return token
		}
	}
	return ""
}

func parseID(c *gin.Context) (uint64, bool) {
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
