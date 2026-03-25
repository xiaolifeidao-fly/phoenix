package queue

import "errors"

var (
	ErrClientNil       = errors.New("queue client is nil")
	ErrQueueNameEmpty  = errors.New("queue name is empty")
	ErrMessageNil      = errors.New("queue message is nil")
	ErrHandlerNil      = errors.New("queue handler is nil")
	ErrDeliverySettled = errors.New("queue delivery already settled")
)
