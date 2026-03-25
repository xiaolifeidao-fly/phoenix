package shop

import (
	"net/http"
	shopBusiness "order-gateway/business/shop"
	"order-gateway/model"
	"strconv"

	commonRouter "common/middleware/routers"

	"github.com/gin-gonic/gin"
)

type ShopHandler struct {
	*commonRouter.BaseHandler
	business *shopBusiness.Business
}

func NewShopHandler() *ShopHandler {
	business := shopBusiness.NewBusiness()
	return &ShopHandler{
		BaseHandler: &commonRouter.BaseHandler{},
		business:    business,
	}
}

func (h *ShopHandler) RegisterHandler(engine *gin.RouterGroup) {
	engine.GET("/shops/:shopCategoryId", h.getByID)
}

func (h *ShopHandler) getByID(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("shopCategoryId"), 10, 32)
	if err != nil || id == 0 {
		c.JSON(http.StatusOK, model.Error("参数不合规"))
		return
	}
	data, err := h.business.GetByID(uint(id))
	if err != nil {
		c.JSON(http.StatusOK, model.Error("未找到商品"))
		return
	}
	c.JSON(http.StatusOK, model.Success(data))
}
