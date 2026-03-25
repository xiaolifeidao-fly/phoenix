package consumer

import (
	"context"
	"log"
	"time"

	"common/middleware/queue"
	"github.com/spf13/viper"
	handlerpkg "order-handler/handler"
	"order-handler/model"
)

type OrderConsumer struct {
	queue   queue.Queue
	handler *handlerpkg.OrderHandler
}

func NewOrderConsumer() (*OrderConsumer, error) {
	q, err := queue.NewRedisQueueFromDefaultClient(
		queue.WithKeyPrefix(queuePrefix()),
		queue.WithDefaultBlockTimeout(blockTimeout()),
	)
	if err != nil {
		return nil, err
	}
	return &OrderConsumer{
		queue:   q,
		handler: handlerpkg.NewOrderHandler(),
	}, nil
}

func (c *OrderConsumer) Run(ctx context.Context) error {
	if err := c.handler.EnsureTable(); err != nil {
		return err
	}
	log.Printf("order consumer started, queue=%s concurrency=%d", model.OrderEventQueueName, concurrency())
	return c.queue.Consume(
		ctx,
		model.OrderEventQueueName,
		c.handler.Handle,
		queue.WithConcurrency(concurrency()),
		queue.WithBlockTimeout(blockTimeout()),
		queue.WithAutoAck(true),
		queue.WithErrorHandler(func(delivery *queue.Delivery, err error) {
			if delivery != nil && delivery.Message != nil {
				log.Printf("order consumer failed, topic=%s retry=%d err=%v", delivery.Message.Topic, delivery.Message.Retry, err)
				return
			}
			log.Printf("order consumer failed: %v", err)
		}),
	)
}

func concurrency() int {
	value := viper.GetInt("order.handler.consumer.concurrency")
	if value <= 0 {
		return 1
	}
	return value
}

func blockTimeout() time.Duration {
	value := viper.GetInt("order.handler.consumer.block-timeout-seconds")
	if value <= 0 {
		value = 3
	}
	return time.Duration(value) * time.Second
}

func queuePrefix() string {
	value := viper.GetString("order.handler.queue.prefix")
	if value == "" {
		return "queue"
	}
	return value
}
