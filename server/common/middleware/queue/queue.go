package queue

import "context"

type Handler func(context.Context, *Delivery) error

type Queue interface {
	Publish(ctx context.Context, queueName string, message *Message, opts ...PublishOption) error
	Consume(ctx context.Context, queueName string, handler Handler, opts ...ConsumeOption) error
	Pop(ctx context.Context, queueName string) (*Message, error)
}
