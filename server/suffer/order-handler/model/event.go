package model

import "time"

const (
	EventTopicOrderCreate = "order.create"
	EventTopicOrderRefund = "order.refund"
	EventTopicOrderUpdate = "order.update"

	OrderEventQueueName = "order-handler-events"
)

type OrderEvent struct {
	OrderID   uint64    `json:"orderId,omitempty"`
	RefundID  uint64    `json:"refundId,omitempty"`
	RemoteIP  string    `json:"remoteIp,omitempty"`
	CreatedAt time.Time `json:"createdAt,omitempty"`
}
