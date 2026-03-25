package main

import (
	webAuth "web-api/auth"
	"web-api/initialization"
	"web-api/routers"

	"github.com/gin-gonic/gin"
)

func main() {
	gin.SetMode(gin.ReleaseMode)
	initialization.Init()
	routers.Run(webAuth.Middleware())
}
