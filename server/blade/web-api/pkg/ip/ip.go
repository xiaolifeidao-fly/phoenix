package ip

import (
	webAuth "blade/web-api/auth"
	ipBusiness "blade/web-api/business/ip"
	commonRouter "common/middleware/routers"

	"github.com/gin-gonic/gin"
)

type IPHandler struct {
	*commonRouter.BaseHandler
	v2Manager *ipBusiness.V2Manager
}

func NewIPHandler() *IPHandler {
	v2Manager := ipBusiness.GetDefaultV2Manager()
	if ipBusiness.IsV2Enabled() {
		v2Manager.Start()
	}
	return &IPHandler{
		BaseHandler: &commonRouter.BaseHandler{},
		v2Manager:   v2Manager,
	}
}

func (h *IPHandler) RegisterHandler(engine *gin.RouterGroup) {
	webAuth.PublicGET(engine, "/ip/getIpV2", h.getIPV2)
}

func (h *IPHandler) getIPV2(context *gin.Context) {
	scene, err := ipBusiness.ParseScene(context.DefaultQuery("scene", ipBusiness.SceneCollectDevice.Name()))
	if err != nil {
		commonRouter.ToJson(context, nil, err)
		return
	}
	item, err := h.v2Manager.GetByScene(scene)
	commonRouter.ToJson(context, item, err)
}
