package routers

import (
	"blade/web-api/pkg/ip"
	"blade/web-api/pkg/task"
	"blade/web-api/pkg/webdevice"
	"common/middleware/routers"
	"log"
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
		build("ip", func() routers.Handler { return ip.NewIPHandler() }),
		build("task", func() routers.Handler { return task.NewTaskHandler() }),
		build("webdevice", func() routers.Handler { return webdevice.NewWebDeviceHandler() }),
	}
}
