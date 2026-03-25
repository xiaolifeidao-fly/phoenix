package handler

import (
	"context"
	"fmt"
	"log"
	"strings"

	"common/middleware/queue"
	"order-handler/model"
	orderService "service/order"
	orderDTO "service/order/dto"
)

const (
	orderStatusInit          = "INIT"
	orderStatusInitIng       = "INIT_ING"
	orderStatusPending       = "PENDING"
	orderStatusDone          = "DONE"
	orderStatusRefundPending = "REFUND_PENDING"
	orderStatusRefundHanding = "REFUND_HANDING"
)

type OrderHandler struct {
	orderService *orderService.OrderService
}

func NewOrderHandler() *OrderHandler {
	return &OrderHandler{
		orderService: orderService.NewOrderService(),
	}
}

func (h *OrderHandler) EnsureTable() error {
	return h.orderService.EnsureTable()
}

func (h *OrderHandler) Handle(ctx context.Context, delivery *queue.Delivery) error {
	if delivery == nil || delivery.Message == nil {
		return fmt.Errorf("delivery is nil")
	}

	var event model.OrderEvent
	if err := delivery.Message.Decode(&event); err != nil {
		return err
	}

	switch strings.TrimSpace(delivery.Message.Topic) {
	case model.EventTopicOrderCreate:
		return h.handleCreate(ctx, &event)
	case model.EventTopicOrderRefund:
		return h.handleRefund(ctx, &event)
	case model.EventTopicOrderUpdate:
		return h.handleUpdate(ctx, &event)
	default:
		return fmt.Errorf("unsupported order event topic: %s", delivery.Message.Topic)
	}
}

func (h *OrderHandler) handleCreate(ctx context.Context, event *model.OrderEvent) error {
	if err := ctx.Err(); err != nil {
		return err
	}
	if event == nil || event.OrderID == 0 {
		return fmt.Errorf("orderId is required")
	}

	current, err := h.orderService.GetOrderRecordByID(uint(event.OrderID))
	if err != nil {
		return err
	}
	if !strings.EqualFold(current.OrderStatus, orderStatusInit) {
		return nil
	}

	initIng := orderStatusInitIng
	if _, err = h.orderService.UpdateOrderRecord(uint(current.Id), &orderDTO.UpdateOrderRecordDTO{
		OrderStatus: &initIng,
	}); err != nil {
		return err
	}

	nextStatus := orderStatusPending
	if current.OrderNum <= 0 || uint64(maxInt64(current.OrderNum, 0)) <= current.EndNum {
		nextStatus = orderStatusDone
	}
	if _, err = h.orderService.UpdateOrderRecord(uint(current.Id), &orderDTO.UpdateOrderRecordDTO{
		OrderStatus: &nextStatus,
	}); err != nil {
		return err
	}

	log.Printf("handled create event for order %d, remoteIP=%s nextStatus=%s", current.Id, strings.TrimSpace(event.RemoteIP), nextStatus)
	return nil
}

func (h *OrderHandler) handleRefund(ctx context.Context, event *model.OrderEvent) error {
	if err := ctx.Err(); err != nil {
		return err
	}
	if event == nil || event.RefundID == 0 {
		return fmt.Errorf("refundId is required")
	}

	currentRefund, err := h.orderService.GetOrderRefundRecordByID(uint(event.RefundID))
	if err != nil {
		return err
	}
	if !strings.EqualFold(currentRefund.OrderRefundStatus, orderStatusRefundHanding) {
		return nil
	}

	orderRecord, err := h.orderService.GetOrderRecordByID(uint(currentRefund.OrderID))
	if err != nil {
		return err
	}

	refundAmount := strings.TrimSpace(currentRefund.RefundAmount)
	if refundAmount == "" || refundAmount == "0" || refundAmount == "0.00000000" {
		refundAmount = orderRecord.OrderAmount
	}
	nextRefundStatus := orderStatusRefundPending
	if _, err = h.orderService.UpdateOrderRefundRecord(uint(currentRefund.Id), &orderDTO.UpdateOrderRefundRecordDTO{
		RefundAmount:      &refundAmount,
		OrderRefundStatus: &nextRefundStatus,
	}); err != nil {
		return err
	}
	if _, err = h.orderService.UpdateOrderRecord(uint(orderRecord.Id), &orderDTO.UpdateOrderRecordDTO{
		OrderStatus: &nextRefundStatus,
	}); err != nil {
		return err
	}

	log.Printf("handled refund event for refund %d, order=%d", currentRefund.Id, orderRecord.Id)
	return nil
}

func (h *OrderHandler) handleUpdate(ctx context.Context, event *model.OrderEvent) error {
	if err := ctx.Err(); err != nil {
		return err
	}
	if event == nil || event.OrderID == 0 {
		return fmt.Errorf("orderId is required")
	}

	current, err := h.orderService.GetOrderRecordByID(uint(event.OrderID))
	if err != nil {
		return err
	}
	log.Printf("handled update event for order %d, currentStatus=%s", current.Id, current.OrderStatus)
	return nil
}

func maxInt64(value, fallback int64) int64 {
	if value < 0 {
		return fallback
	}
	return value
}
