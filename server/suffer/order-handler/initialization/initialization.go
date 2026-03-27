package initialization

import (
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
}

func Init() error {
	for _, initializer := range initializers {
		start := time.Now()
		log.Printf("Initializing %s...", initializer.Name)
		if err := initializer.InitFn(); err != nil {
			if initializer.Order == RedisInit {
				log.Printf("Skipping optional initializer %s after %s: %v", initializer.Name, time.Since(start), err)
				continue
			}
			return fmt.Errorf("failed to initialize %s after %s: %v", initializer.Name, time.Since(start), err)
		}
		log.Printf("%s initialized successfully in %s", initializer.Name, time.Since(start))
	}
	return nil
}
