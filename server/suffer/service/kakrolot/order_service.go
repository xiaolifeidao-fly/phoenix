package kakrolot

import (
	"context"
	"fmt"
	"strconv"
	"strings"

	"common/middleware/vipper"
)

// 退单路径可配置：管理端默认走强制退单（/orders/{orderId}/refund/force），
// 普通退单接口 /orders/{orderId}/refund 会校验订单归属，管理员账号调用会被拒。
const (
	orderRefundPathKey     = "kakrolot.url.order.refund.path"
	defaultOrderRefundPath = "/orders/{orderId}/refund/force"
	orderBkPathKey         = "kakrolot.url.order.bk.path"
	defaultOrderBkPath     = "/orders/{orderId}/bk"
	// 异常打标是独立部署的接口，域名与路径都和退单/补款不同，单独配置
	orderExceptionPathKey     = "order-exception.path"
	defaultOrderExceptionPath = "/order/{orderId}/exception"
)

// OrderService 订单相关的外部调用。
// 退单/补款走 kakrolot-web；异常打标是另一个服务，用独立的客户端。
type OrderService struct {
	client          *Client
	exceptionClient *Client
}

func NewOrderService(client *Client) *OrderService {
	// order-exception.base-url 未配置时回退到 kakrolot，兼容两者同域部署
	exceptionClient := NewClientWithPrefix("order-exception")
	if !exceptionClient.IsConfigured() {
		exceptionClient = client
	}
	return &OrderService{client: client, exceptionClient: exceptionClient}
}

// MarkException 标记订单异常，reason 为空时由对端生成默认原因。
// 该接口不鉴权，不需要传 token。
func (s *OrderService) MarkException(ctx context.Context, orderID uint64, reason string) error {
	if orderID == 0 {
		return fmt.Errorf("orderId is required")
	}
	body := map[string]any{}
	if trimmed := strings.TrimSpace(reason); trimmed != "" {
		body["reason"] = trimmed
	}
	response, err := s.exceptionClient.Post(ctx, buildPath(orderExceptionPathKey, defaultOrderExceptionPath, orderID), body, "")
	if err != nil {
		return err
	}
	if !response.IsSuccess() {
		return fmt.Errorf("%s", response.ErrorMessage())
	}
	return nil
}

// Refund 订单退单，由 kakrolot 落退单记录并通知 barry。
// token 为新管理端的登录 token，透传给 kakrolot 做鉴权。
func (s *OrderService) Refund(ctx context.Context, orderID uint64, token string) error {
	if orderID == 0 {
		return fmt.Errorf("orderId is required")
	}
	response, err := s.client.Post(ctx, buildOrderRefundPath(orderID), map[string]any{}, token)
	if err != nil {
		return err
	}
	if !response.IsSuccess() {
		return fmt.Errorf("%s", response.ErrorMessage())
	}
	return nil
}

// Bk 订单补款，由 kakrolot 校验状态、落补款记录并生成金额明细。
// token 为新管理端的登录 token，透传给 kakrolot 做鉴权。
func (s *OrderService) Bk(ctx context.Context, orderID uint64, num uint64, token string) error {
	if orderID == 0 {
		return fmt.Errorf("orderId is required")
	}
	if num == 0 {
		return fmt.Errorf("补款数量无效")
	}
	response, err := s.client.Post(ctx, buildPath(orderBkPathKey, defaultOrderBkPath, orderID), map[string]any{
		"bkNum": num,
	}, token)
	if err != nil {
		return err
	}
	if !response.IsSuccess() {
		return fmt.Errorf("%s", response.ErrorMessage())
	}
	return nil
}

func buildOrderRefundPath(orderID uint64) string {
	return buildPath(orderRefundPathKey, defaultOrderRefundPath, orderID)
}

func buildPath(configKey, fallback string, orderID uint64) string {
	path := strings.TrimSpace(vipper.GetString(configKey))
	if path == "" {
		path = fallback
	}
	return strings.ReplaceAll(path, "{orderId}", strconv.FormatUint(orderID, 10))
}
