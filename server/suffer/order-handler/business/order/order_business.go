package order

import (
	"context"

	"suffer/order-handler/consumer"
)

type Business struct {
	consumer *consumer.OrderConsumer
}

func NewBusiness() (*Business, error) {
	orderConsumer, err := consumer.NewOrderConsumer()
	if err != nil {
		return nil, err
	}
	return &Business{
		consumer: orderConsumer,
	}, nil
}

func (b *Business) Run(ctx context.Context) error {
	return b.consumer.Run(ctx)
}
