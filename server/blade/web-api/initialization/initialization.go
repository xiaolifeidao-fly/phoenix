package initialization

import (
	taskConsumer "blade/web-api/pkg/task/consumer"
	"blade/web-api/routers"
	"common/middleware/db"
	"common/middleware/redis"
	"common/middleware/vipper"
	"fmt"
	"log"
	"time"
)

type InitOrder int

const (
	ConfigInit InitOrder = iota
	DBInit
	RedisInit
	RouterInit
	TaskConsumerInit
)

type Initializer struct {
	Order  InitOrder
	Name   string
	InitFn func() error
}

var initializers = []Initializer{
	{
		Order: ConfigInit,
		Name:  "Config",
		InitFn: func() error {
			vipper.Init()
			return nil
		},
	},
	{
		Order: DBInit,
		Name:  "Database",
		InitFn: func() error {
			db.InitDB()
			return nil
		},
	},
	{
		Order: RedisInit,
		Name:  "Redis",
		InitFn: func() error {
			return redis.InitRedisClient(vipper.GetString("redis.addr"), vipper.GetString("redis.password"))
		},
	},
	{
		Order: RouterInit,
		Name:  "Router",
		InitFn: func() error {
			routers.Init()
			return nil
		},
	},
	{
		Order: TaskConsumerInit,
		Name:  "TaskConsumer",
		InitFn: func() error {
			return taskConsumer.StartDefaultTaskConsumer()
		},
	},
}

func Init() error {
	for _, init := range initializers {
		log.Printf("Initializing %s...", init.Name)
		start := time.Now()
		if err := init.InitFn(); err != nil {
			if init.Order == RedisInit {
				log.Printf("Skipping optional initializer %s after %s: %v", init.Name, time.Since(start), err)
				continue
			}
			return fmt.Errorf("failed to initialize %s after %s: %v", init.Name, time.Since(start), err)
		}
		log.Printf("%s initialized successfully in %s", init.Name, time.Since(start))
	}
	return nil
}
