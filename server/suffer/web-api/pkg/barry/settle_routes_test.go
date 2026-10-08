package barry

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
)

// 新增的带参路由与 /barry/user-details/detail 这类静态路由同级, 确认注册不 panic 且各自命中正确的路由模板
// (鉴权按路由模板匹配资源, 模板错了就会走错权限).
func TestSettleAndPointsRuleRoutesResolve(t *testing.T) {
	gin.SetMode(gin.TestMode)
	engine := gin.New()
	var matched string
	engine.Use(func(c *gin.Context) {
		matched = c.FullPath()
		c.AbortWithStatus(http.StatusNoContent)
	})
	group := engine.Group("")
	h := &BarryHandler{}
	h.registerUserRoutes(group)
	h.registerSettleRoutes(group)
	h.registerPointsRuleRoutes(group)

	cases := []struct{ method, url, route string }{
		{"GET", "/barry/user-details/detail", "/barry/user-details/detail"},
		{"GET", "/barry/user-details/payment-methods", "/barry/user-details/payment-methods"},
		{"PUT", "/barry/user-details/password", "/barry/user-details/password"},
		{"GET", "/barry/user-details/12/settle", "/barry/user-details/:userId/settle"},
		{"PUT", "/barry/user-details/12/settle", "/barry/user-details/:userId/settle"},
		{"GET", "/barry/settle-channels", "/barry/settle-channels"},
		{"PUT", "/barry/settle-channels/3", "/barry/settle-channels/:id"},
		{"GET", "/barry/points-rules", "/barry/points-rules"},
		{"PUT", "/barry/user-whitelists/5/points-rule", "/barry/user-whitelists/:id/points-rule"},
		{"PUT", "/barry/user-whitelists/5/status", "/barry/user-whitelists/:id/status"},
	}
	for _, tc := range cases {
		matched = ""
		engine.ServeHTTP(httptest.NewRecorder(), httptest.NewRequest(tc.method, tc.url, nil))
		if matched != tc.route {
			t.Fatalf("%s %s matched %q, want %q", tc.method, tc.url, matched, tc.route)
		}
	}
}
