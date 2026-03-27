package routers

import (
	"common/middleware/routers"
	"log"
	"suffer/order-gateway/pkg/approveuser"
	"suffer/order-gateway/pkg/order"
	"suffer/order-gateway/pkg/shop"
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
		build("order-gateway-order", func() routers.Handler { return order.NewOrderHandler() }),
		build("order-gateway-shop", func() routers.Handler { return shop.NewShopHandler() }),
		build("order-gateway-approve-user", func() routers.Handler { return approveuser.NewApproveUserHandler() }),
	}
}
