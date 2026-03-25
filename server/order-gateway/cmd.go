package main

import (
	"order-gateway/initialization"
	"order-gateway/routers"

	"github.com/gin-gonic/gin"
)

func main() {
	gin.SetMode(gin.ReleaseMode)
	if err := initialization.Init(); err != nil {
		panic(err)
	}
	if err := routers.Run(); err != nil {
		panic(err)
	}
}
