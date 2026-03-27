package routers

import (
	commonRouters "common/middleware/routers"
)

var router *commonRouters.GinRouter

func Init() {
	router = commonRouters.NewGinRouter()
	InitAllRouters(router, registerHandler())
}

func Run() error {
	return router.Run()
}

func InitAllRouters(router *commonRouters.GinRouter, handlers []commonRouters.Handler) {
	for _, handler := range handlers {
		router.Include(handler.RegisterHandler)
	}
}
