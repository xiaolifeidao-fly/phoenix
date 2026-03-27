package webdevice

import (
	webDeviceDTO "blade/service/webdevice/dto"
	webAuth "blade/web-api/auth"
	webDeviceBusiness "blade/web-api/business/webdevice"
	commonRouter "common/middleware/routers"
	"fmt"

	"github.com/gin-gonic/gin"
)

type WebDeviceHandler struct {
	*commonRouter.BaseHandler
	facade *webDeviceBusiness.Facade
}

func NewWebDeviceHandler() *WebDeviceHandler {
	facade := webDeviceBusiness.NewFacade()
	_ = facade.EnsureTable()
	return &WebDeviceHandler{
		BaseHandler: &commonRouter.BaseHandler{},
		facade:      facade,
	}
}

func (h *WebDeviceHandler) RegisterHandler(engine *gin.RouterGroup) {
	webAuth.PublicGET(engine, "/devices/list", h.list)
	webAuth.PublicPOST(engine, "/devices/save", h.save)
	webAuth.PublicPOST(engine, "/log/get", h.saveLog)
	webAuth.PublicGET(engine, "/devices/down", h.downloadSessions)
}

func (h *WebDeviceHandler) list(context *gin.Context) {
	result, err := h.facade.List()
	commonRouter.ToJson(context, result, err)
}

func (h *WebDeviceHandler) save(context *gin.Context) {
	var req webDeviceDTO.WebDeviceDTO
	if err := context.ShouldBindJSON(&req); err != nil {
		commonRouter.ToJson(context, nil, err)
		return
	}
	result, err := h.facade.Save(&req)
	commonRouter.ToJson(context, result, err)
}

func (h *WebDeviceHandler) saveLog(context *gin.Context) {
	var req webDeviceDTO.EncryptedRequest
	if err := context.ShouldBindJSON(&req); err != nil {
		commonRouter.ToJson(context, nil, err)
		return
	}
	_, err := h.facade.SaveEncryptedSessionLog(req.EncryptData)
	commonRouter.ToJson(context, "log get success", err)
}

func (h *WebDeviceHandler) downloadSessions(context *gin.Context) {
	deviceID := context.Query("deviceId")
	result, err := h.facade.DownloadSessionArchive(deviceID)
	if err != nil {
		commonRouter.ToJson(context, nil, err)
		return
	}
	context.Header("Content-Type", "application/zip")
	context.Header("Content-Disposition", fmt.Sprintf("attachment; filename=sessions_%s.zip", deviceID))
	context.Data(200, "application/zip", result)
}
