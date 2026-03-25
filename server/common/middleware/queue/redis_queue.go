package queue

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"sync"
	"time"

	redisclient "common/middleware/redis"
	goredis "github.com/go-redis/redis"
)

type redisCommander interface {
	LPush(key string, values ...interface{}) *goredis.IntCmd
	RPush(key string, values ...interface{}) *goredis.IntCmd
	BRPopLPush(source string, destination string, timeout time.Duration) *goredis.StringCmd
	LRem(key string, count int64, value interface{}) *goredis.IntCmd
	LPop(key string) *goredis.StringCmd
}

type RedisQueue struct {
	client       redisCommander
	keyPrefix    string
	blockTimeout time.Duration
	nowFn        func() time.Time
}

var _ Queue = (*RedisQueue)(nil)

func NewRedisQueue(client goredis.Cmdable, opts ...RedisOption) (*RedisQueue, error) {
	if client == nil {
		return nil, ErrClientNil
	}
	return newRedisQueue(client, opts...), nil
}

func NewRedisQueueFromDefaultClient(opts ...RedisOption) (*RedisQueue, error) {
	if redisclient.Rdb == nil {
		return nil, ErrClientNil
	}
	return newRedisQueue(redisclient.Rdb, opts...), nil
}

func newRedisQueue(client redisCommander, opts ...RedisOption) *RedisQueue {
	cfg := defaultRedisOptions()
	for _, opt := range opts {
		opt(&cfg)
	}

	return &RedisQueue{
		client:       client,
		keyPrefix:    cfg.keyPrefix,
		blockTimeout: cfg.blockTimeout,
		nowFn:        time.Now,
	}
}

func (q *RedisQueue) Publish(ctx context.Context, queueName string, message *Message, opts ...PublishOption) error {
	if err := ctx.Err(); err != nil {
		return err
	}
	if queueName == "" {
		return ErrQueueNameEmpty
	}
	if message == nil {
		return ErrMessageNil
	}

	msg := q.cloneMessage(message)
	cfg := defaultPublishOptions()
	for _, opt := range opts {
		opt(&cfg)
	}
	q.applyPublishOptions(msg, cfg)
	if msg.CreatedAt.IsZero() {
		msg.CreatedAt = q.nowFn()
	}

	body, err := json.Marshal(msg)
	if err != nil {
		return err
	}

	return q.client.RPush(q.readyKey(queueName), string(body)).Err()
}

func (q *RedisQueue) Consume(ctx context.Context, queueName string, handler Handler, opts ...ConsumeOption) error {
	if queueName == "" {
		return ErrQueueNameEmpty
	}
	if handler == nil {
		return ErrHandlerNil
	}

	cfg := defaultConsumeOptions()
	for _, opt := range opts {
		opt(&cfg)
	}
	if cfg.blockTimeout <= 0 {
		cfg.blockTimeout = q.blockTimeout
	}

	errCh := make(chan error, cfg.concurrency)
	var wg sync.WaitGroup

	for i := 0; i < cfg.concurrency; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			q.consumeLoop(ctx, queueName, handler, cfg, errCh)
		}()
	}

	doneCh := make(chan struct{})
	go func() {
		wg.Wait()
		close(doneCh)
	}()

	select {
	case <-ctx.Done():
		<-doneCh
		return ctx.Err()
	case err := <-errCh:
		return err
	case <-doneCh:
		return nil
	}
}

func (q *RedisQueue) Pop(ctx context.Context, queueName string) (*Message, error) {
	if err := ctx.Err(); err != nil {
		return nil, err
	}
	if queueName == "" {
		return nil, ErrQueueNameEmpty
	}

	raw, err := q.client.LPop(q.readyKey(queueName)).Result()
	if err != nil {
		if errors.Is(err, goredis.Nil) {
			return nil, nil
		}
		return nil, err
	}

	msg := &Message{}
	if err = json.Unmarshal([]byte(raw), msg); err != nil {
		return nil, err
	}
	return msg, nil
}

func (q *RedisQueue) consumeLoop(ctx context.Context, queueName string, handler Handler, cfg consumeOptions, errCh chan<- error) {
	readyKey := q.readyKey(queueName)
	processingKey := q.processingKey(queueName)

	for {
		if err := ctx.Err(); err != nil {
			return
		}

		raw, err := q.client.BRPopLPush(readyKey, processingKey, cfg.blockTimeout).Result()
		if err != nil {
			if errors.Is(err, goredis.Nil) {
				continue
			}

			select {
			case errCh <- err:
			default:
			}
			return
		}

		msg := &Message{}
		if err = json.Unmarshal([]byte(raw), msg); err != nil {
			_ = q.removeFromProcessing(queueName, raw)
			if cfg.onError != nil {
				cfg.onError(&Delivery{Queue: queueName, Message: &Message{}}, err)
			}
			continue
		}

		delivery := &Delivery{
			Queue:   queueName,
			Message: msg,
			ackFn: func() error {
				return q.removeFromProcessing(queueName, raw)
			},
			nackFn: func(cause error, opts ...NackOption) error {
				return q.nack(queueName, raw, msg, cause, opts...)
			},
		}

		if err = handler(ctx, delivery); err != nil {
			if cfg.onError != nil {
				cfg.onError(delivery, err)
			}
			if !delivery.Settled() {
				_ = delivery.nack(ctx, err)
			}
			continue
		}

		if cfg.autoAck && !delivery.Settled() {
			if err = delivery.Ack(ctx); err != nil && cfg.onError != nil {
				cfg.onError(delivery, err)
			}
		}
	}
}

func (q *RedisQueue) nack(queueName string, raw string, msg *Message, cause error, opts ...NackOption) error {
	cfg := defaultNackOptions()
	for _, opt := range opts {
		opt(&cfg)
	}

	if err := q.removeFromProcessing(queueName, raw); err != nil {
		return err
	}

	next := q.cloneMessage(msg)
	next.Retry++
	if cause != nil {
		next.LastError = cause.Error()
	}

	body, err := json.Marshal(next)
	if err != nil {
		return err
	}

	targetKey := q.readyKey(queueName)
	if !cfg.requeue || (next.MaxRetry > 0 && next.Retry > next.MaxRetry) {
		targetKey = q.deadKey(queueName)
	}
	return q.client.RPush(targetKey, string(body)).Err()
}

func (q *RedisQueue) removeFromProcessing(queueName string, raw string) error {
	return q.client.LRem(q.processingKey(queueName), 1, raw).Err()
}

func (q *RedisQueue) readyKey(queueName string) string {
	return fmt.Sprintf("%s:%s:ready", q.keyPrefix, queueName)
}

func (q *RedisQueue) processingKey(queueName string) string {
	return fmt.Sprintf("%s:%s:processing", q.keyPrefix, queueName)
}

func (q *RedisQueue) deadKey(queueName string) string {
	return fmt.Sprintf("%s:%s:dead", q.keyPrefix, queueName)
}

func (q *RedisQueue) cloneMessage(message *Message) *Message {
	if message == nil {
		return nil
	}

	cloned := *message
	if len(message.Payload) > 0 {
		cloned.Payload = append([]byte(nil), message.Payload...)
	}
	cloned.Headers = cloneStringMap(message.Headers)
	cloned.Metadata = cloneStringMap(message.Metadata)
	return &cloned
}

func (q *RedisQueue) applyPublishOptions(message *Message, cfg publishOptions) {
	if cfg.topic != "" {
		message.Topic = cfg.topic
	}
	if cfg.messageID != "" {
		message.ID = cfg.messageID
	}
	if len(cfg.headers) > 0 {
		message.Headers = cloneStringMap(cfg.headers)
	}
	if len(cfg.metadata) > 0 {
		message.Metadata = cloneStringMap(cfg.metadata)
	}
	if cfg.maxRetry > 0 {
		message.MaxRetry = cfg.maxRetry
	}
}
