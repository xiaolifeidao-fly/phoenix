package main

import (
	webAuth "blade/web-api/auth"
	"blade/web-api/initialization"
	"blade/web-api/routers"

	"github.com/gin-gonic/gin"
)

func main() {
	gin.SetMode(gin.ReleaseMode)
	if err := initialization.Init(); err != nil {
		panic(err)
	}
	routers.Run(webAuth.Middleware())
}
