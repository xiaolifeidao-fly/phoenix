package main

import (
	webAuth "suffer/web-api/auth"
	"suffer/web-api/initialization"
	"suffer/web-api/routers"

	"github.com/gin-gonic/gin"
)

func main() {
	gin.SetMode(gin.ReleaseMode)
	initialization.Init()
	routers.Run(webAuth.Middleware())
}
