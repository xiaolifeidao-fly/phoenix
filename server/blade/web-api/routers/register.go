package routers

import (
	"blade/web-api/pkg/task"
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
		build("task", func() routers.Handler { return task.NewTaskHandler() }),
	}
}
