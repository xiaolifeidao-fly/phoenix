package routers

import (
	"common/middleware/routers"
	"log"
	"time"
	"web-api/pkg/account"
	"web-api/pkg/barry"
	"web-api/pkg/login"
	"web-api/pkg/notice"
	"web-api/pkg/order"
	"web-api/pkg/permission"
	"web-api/pkg/shop"
	"web-api/pkg/tenant"
	"web-api/pkg/user"
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
		build("login", func() routers.Handler { return login.NewLoginHandler() }),
		build("notice", func() routers.Handler { return notice.NewNoticeHandler() }),
		build("order", func() routers.Handler { return order.NewOrderHandler() }),
		build("permission", func() routers.Handler { return permission.NewPermissionHandler() }),
		build("shop", func() routers.Handler { return shop.NewShopHandler() }),
		build("tenant", func() routers.Handler { return tenant.NewTenantHandler() }),
		build("user", func() routers.Handler { return user.NewUserHandler() }),
	}
}
