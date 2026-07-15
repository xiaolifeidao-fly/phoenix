package routers

import (
	"common/middleware/routers"
	"log"
	"suffer/web-api/pkg/account"
	"suffer/web-api/pkg/barry"
	"suffer/web-api/pkg/dashboard"
	"suffer/web-api/pkg/login"
	"suffer/web-api/pkg/notice"
	"suffer/web-api/pkg/order"
	"suffer/web-api/pkg/permission"
	"suffer/web-api/pkg/shop"
	"suffer/web-api/pkg/tenant"
	"suffer/web-api/pkg/user"
	"time"
)

func registerHandler() []routers.Handler {
	build := func(name string, fn func() routers.Handler) routers.Handler {
		start := time.Now()
		handler := fn()
		log.Printf("Handler %s initialized in %s", name, time.Since(start))
		return handler
	}

	return []routers.Handler{
		build("account", func() routers.Handler { return account.NewAccountHandler() }),
		build("barry", func() routers.Handler { return barry.NewBarryHandler() }),
		build("dashboard", func() routers.Handler { return dashboard.NewDashboardHandler() }),
		build("login", func() routers.Handler { return login.NewLoginHandler() }),
		build("notice", func() routers.Handler { return notice.NewNoticeHandler() }),
		build("order", func() routers.Handler { return order.NewOrderHandler() }),
		build("permission", func() routers.Handler { return permission.NewPermissionHandler() }),
		build("shop", func() routers.Handler { return shop.NewShopHandler() }),
		build("tenant", func() routers.Handler { return tenant.NewTenantHandler() }),
		build("user", func() routers.Handler { return user.NewUserHandler() }),
	}
}
