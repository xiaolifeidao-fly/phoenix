package consumer

import (
	taskService "blade/service/task"
	taskDTO "blade/service/task/dto"
	"context"
	"log"
	"sync"
	"time"

	"common/middleware/queue"
	redisclient "common/middleware/redis"
)

type TaskConsumer struct {
	taskService *taskService.TaskService
	processor   TaskProcessor
	queue       queue.Queue
	queueName   string
	ctx         context.Context
	cancel      context.CancelFunc
	once        sync.Once
}

var (
	defaultTaskConsumer *TaskConsumer
	consumerOnce        sync.Once
)

func StartDefaultTaskConsumer() error {
	var initErr error
	consumerOnce.Do(func() {
		service := taskService.NewTaskService()
		if redisclient.Rdb == nil {
			initErr = nil
			return
		}

		taskQueue, err := queue.NewRedisQueueFromDefaultClient(queue.WithKeyPrefix("blade:queue"))
		if err != nil {
			initErr = err
			return
		}

		ctx, cancel := context.WithCancel(context.Background())
		defaultTaskConsumer = &TaskConsumer{
			taskService: service,
			processor:   NewDefaultTaskProcessor(),
			queue:       taskQueue,
			queueName:   service.DefaultQueueName(),
			ctx:         ctx,
			cancel:      cancel,
		}
		go defaultTaskConsumer.run()
	})
	return initErr
}

func (c *TaskConsumer) run() {
	log.Printf("task consumer started, queue=%s", c.queueName)
	err := c.queue.Consume(c.ctx, c.queueName, c.handle,
		queue.WithConcurrency(c.taskService.DefaultWorkerParallelism()),
		queue.WithBlockTimeout(3*time.Second),
		queue.WithAutoAck(false),
		queue.WithErrorHandler(func(delivery *queue.Delivery, err error) {
			log.Printf("task consumer error, queue=%s, messageId=%s, err=%v", delivery.Queue, delivery.Message.ID, err)
		}),
	)
	if err != nil && err != context.Canceled {
		log.Printf("task consumer stopped with error: %v", err)
	}
}

func (c *TaskConsumer) handle(ctx context.Context, delivery *queue.Delivery) error {
	var payload taskDTO.TaskDispatchDTO
	if err := delivery.Message.Decode(&payload); err != nil {
		_ = delivery.Nack(ctx, queue.WithRequeue(false))
		return err
	}

	err := c.processor.Process(ctx, &payload)
	if err != nil {
		_ = delivery.Nack(ctx)
		return err
	}
	return delivery.Ack(ctx)
}

func (c *TaskConsumer) Stop() {
	if c == nil {
		return
	}
	c.once.Do(func() {
		if c.cancel != nil {
			c.cancel()
		}
	})
}
