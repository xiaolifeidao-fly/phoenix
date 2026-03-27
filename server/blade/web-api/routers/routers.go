package routers

import (
	commonRouters "common/middleware/routers"

	"github.com/gin-gonic/gin"
)

var router *commonRouters.GinRouter

func Init() {
	router = commonRouters.NewGinRouter()
	InitAllRouters(router, registerHandler())
}

func Run(middleware ...gin.HandlerFunc) error {
	router.Use(middleware...)
	return router.Run()
}

func InitAllRouters(router *commonRouters.GinRouter, handlers []commonRouters.Handler) {
	for _, handler := range handlers {
		router.Include(handler.RegisterHandler)
	}
}
