package queue

import "time"

type PublishOption func(*publishOptions)

type publishOptions struct {
	topic     string
	messageID string
	headers   map[string]string
	metadata  map[string]string
	maxRetry  int
}

func defaultPublishOptions() publishOptions {
	return publishOptions{}
}

func WithTopic(topic string) PublishOption {
	return func(opts *publishOptions) {
		opts.topic = topic
	}
}

func WithMessageID(messageID string) PublishOption {
	return func(opts *publishOptions) {
		opts.messageID = messageID
	}
}

func WithHeaders(headers map[string]string) PublishOption {
	return func(opts *publishOptions) {
		opts.headers = cloneStringMap(headers)
	}
}

func WithMetadata(metadata map[string]string) PublishOption {
	return func(opts *publishOptions) {
		opts.metadata = cloneStringMap(metadata)
	}
}

func WithMaxRetry(maxRetry int) PublishOption {
	return func(opts *publishOptions) {
		opts.maxRetry = maxRetry
	}
}

type ConsumeOption func(*consumeOptions)

type ErrorHandler func(*Delivery, error)

type consumeOptions struct {
	concurrency  int
	blockTimeout time.Duration
	autoAck      bool
	onError      ErrorHandler
}

func defaultConsumeOptions() consumeOptions {
	return consumeOptions{
		concurrency:  1,
		blockTimeout: 3 * time.Second,
		autoAck:      true,
	}
}

func WithConcurrency(concurrency int) ConsumeOption {
	return func(opts *consumeOptions) {
		if concurrency > 0 {
			opts.concurrency = concurrency
		}
	}
}

func WithBlockTimeout(timeout time.Duration) ConsumeOption {
	return func(opts *consumeOptions) {
		if timeout > 0 {
			opts.blockTimeout = timeout
		}
	}
}

func WithAutoAck(autoAck bool) ConsumeOption {
	return func(opts *consumeOptions) {
		opts.autoAck = autoAck
	}
}

func WithErrorHandler(handler ErrorHandler) ConsumeOption {
	return func(opts *consumeOptions) {
		opts.onError = handler
	}
}

type RedisOption func(*redisOptions)

type redisOptions struct {
	keyPrefix    string
	blockTimeout time.Duration
}

func defaultRedisOptions() redisOptions {
	return redisOptions{
		keyPrefix:    "queue",
		blockTimeout: 3 * time.Second,
	}
}

func WithKeyPrefix(prefix string) RedisOption {
	return func(opts *redisOptions) {
		if prefix != "" {
			opts.keyPrefix = prefix
		}
	}
}

func WithDefaultBlockTimeout(timeout time.Duration) RedisOption {
	return func(opts *redisOptions) {
		if timeout > 0 {
			opts.blockTimeout = timeout
		}
	}
}

type NackOption func(*nackOptions)

type nackOptions struct {
	requeue bool
}

func defaultNackOptions() nackOptions {
	return nackOptions{
		requeue: true,
	}
}

func WithRequeue(requeue bool) NackOption {
	return func(opts *nackOptions) {
		opts.requeue = requeue
	}
}
