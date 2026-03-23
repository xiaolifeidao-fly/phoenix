package barry

import (
	commonRouter "common/middleware/routers"
	barryDTO "service/barry/dto"

	"github.com/gin-gonic/gin"
)

func (h *BarryHandler) registerChannelRoutes(engine *gin.RouterGroup) {
	engine.GET("/barry/channels", h.listChannels)
	engine.GET("/barry/channel-details", h.listChannelDetails)
	engine.POST("/barry/channel-details", h.createChannelDetail)
	engine.PUT("/barry/channel-details", h.updateChannelDetail)
}

func (h *BarryHandler) listChannels(c *gin.Context) {
	var q barryDTO.ChannelQueryDTO
	if c.ShouldBindQuery(&q) != nil {
		commonRouter.ToError(c, "参数错误")
		return
	}
	normalizeBarryPage(&q.PageQueryDTO)
	response, err := h.barryService.Channel.List(c.Request.Context(), q)
	if err != nil {
		commonRouter.ToJson(c, nil, err)
		return
	}
	commonRouter.ToJson(c, response.Data, nil)
}

func (h *BarryHandler) listChannelDetails(c *gin.Context) {
	response, err := h.barryService.Channel.ListDetails(c.Request.Context())
	if err != nil {
		commonRouter.ToJson(c, nil, err)
		return
	}
	commonRouter.ToJson(c, response.Data, nil)
}

func (h *BarryHandler) createChannelDetail(c *gin.Context) {
	var req barryDTO.SaveChannelDetailDTO
	if c.ShouldBindJSON(&req) != nil {
		commonRouter.ToError(c, "参数错误")
		return
	}
	response, err := h.barryService.Channel.SaveDetail(c.Request.Context(), &req)
	if err != nil {
		commonRouter.ToJson(c, nil, err)
		return
	}
	if !response.Success {
		if response.Message == "" {
			commonRouter.ToError(c, "添加失败")
			return
		}
		commonRouter.ToError(c, response.Message)
		return
	}
	commonRouter.ToJson(c, "添加成功", nil)
}

func (h *BarryHandler) updateChannelDetail(c *gin.Context) {
	var req barryDTO.UpdateChannelDetailDTO
	if c.ShouldBindJSON(&req) != nil {
		commonRouter.ToError(c, "参数错误")
		return
	}
	response, err := h.barryService.Channel.UpdateDetail(c.Request.Context(), &req)
	if err != nil {
		commonRouter.ToJson(c, nil, err)
		return
	}
	if !response.Success {
		if response.Message == "" {
			commonRouter.ToError(c, "更新失败")
			return
		}
		commonRouter.ToError(c, response.Message)
		return
	}
	commonRouter.ToJson(c, "更新成功", nil)
}
