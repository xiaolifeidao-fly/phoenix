package approveuser

import (
	"net/http"
	approveUserBusiness "order-gateway/business/approveuser"
	"order-gateway/model"
	"strconv"

	commonRouter "common/middleware/routers"

	"github.com/gin-gonic/gin"
)

type ApproveUserHandler struct {
	*commonRouter.BaseHandler
	business *approveUserBusiness.Business
}

func NewApproveUserHandler() *ApproveUserHandler {
	business := approveUserBusiness.NewBusiness()
	return &ApproveUserHandler{
		BaseHandler: &commonRouter.BaseHandler{},
		business:    business,
	}
}

func (h *ApproveUserHandler) RegisterHandler(engine *gin.RouterGroup) {
	engine.POST("/approveUsers/save", h.save)
	engine.POST("/approveUsers/remove", h.remove)
}

func (h *ApproveUserHandler) save(c *gin.Context) {
	userID, err := parseUserID(c)
	if err != nil {
		c.JSON(http.StatusOK, model.Error("参数不合规"))
		return
	}
	if err := h.business.Save(userID); err != nil {
		c.JSON(http.StatusOK, model.Error(err.Error()))
		return
	}
	c.JSON(http.StatusOK, model.Success("success"))
}

func (h *ApproveUserHandler) remove(c *gin.Context) {
	userID, err := parseUserID(c)
	if err != nil {
		c.JSON(http.StatusOK, model.Error("参数不合规"))
		return
	}
	if err := h.business.Remove(userID); err != nil {
		c.JSON(http.StatusOK, model.Error(err.Error()))
		return
	}
	c.JSON(http.StatusOK, model.Success("success"))
}

func parseUserID(c *gin.Context) (uint64, error) {
	return strconv.ParseUint(c.Query("userId"), 10, 64)
}
