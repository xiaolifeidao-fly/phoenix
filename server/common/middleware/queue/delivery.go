package queue

import (
	"context"
	"sync"
)

type Delivery struct {
	Queue   string
	Message *Message

	ackFn  func() error
	nackFn func(error, ...NackOption) error

	mu      sync.Mutex
	settled bool
}

func (d *Delivery) Ack(ctx context.Context) error {
	if err := ctx.Err(); err != nil {
		return err
	}

	d.mu.Lock()
	if d.settled {
		d.mu.Unlock()
		return ErrDeliverySettled
	}
	d.mu.Unlock()

	if err := d.ackFn(); err != nil {
		return err
	}

	d.mu.Lock()
	d.settled = true
	d.mu.Unlock()
	return nil
}

func (d *Delivery) Nack(ctx context.Context, opts ...NackOption) error {
	return d.nack(ctx, nil, opts...)
}

func (d *Delivery) nack(ctx context.Context, cause error, opts ...NackOption) error {
	if err := ctx.Err(); err != nil {
		return err
	}

	d.mu.Lock()
	if d.settled {
		d.mu.Unlock()
		return ErrDeliverySettled
	}
	d.mu.Unlock()

	if err := d.nackFn(cause, opts...); err != nil {
		return err
	}

	d.mu.Lock()
	d.settled = true
	d.mu.Unlock()
	return nil
}

func (d *Delivery) Settled() bool {
	d.mu.Lock()
	defer d.mu.Unlock()
	return d.settled
}
