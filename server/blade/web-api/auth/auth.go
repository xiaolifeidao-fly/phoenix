package auth

import "github.com/gin-gonic/gin"

func Middleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Next()
	}
}

func PublicGET(group *gin.RouterGroup, relativePath string, handlers ...gin.HandlerFunc) {
	group.GET(relativePath, handlers...)
}

func PublicPOST(group *gin.RouterGroup, relativePath string, handlers ...gin.HandlerFunc) {
	group.POST(relativePath, handlers...)
}

func PublicPUT(group *gin.RouterGroup, relativePath string, handlers ...gin.HandlerFunc) {
	group.PUT(relativePath, handlers...)
}

func PublicDELETE(group *gin.RouterGroup, relativePath string, handlers ...gin.HandlerFunc) {
	group.DELETE(relativePath, handlers...)
}
