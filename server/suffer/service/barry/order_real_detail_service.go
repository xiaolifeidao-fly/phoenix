package barry

import (
	"context"
	"fmt"
	"strings"

	barryDTO "suffer/service/barry/dto"
)

// OrderRealDetailService 订单实时数据，转发 barry gateway-inner 的 /orderRecords/detail。
// barry 侧会按 ori_shop_id 找到进件与商品，再现调第三方平台拿当前值（nowNum）并算出实际增量（factNum）。
type OrderRealDetailService struct {
	client *Client
}

func NewOrderRealDetailService(client *Client) *OrderRealDetailService {
	return &OrderRealDetailService{client: client}
}

// Detail orderID 为 kakrolot 的订单 ID，即 barry shop_inlet_record.ori_shop_id。
func (s *OrderRealDetailService) Detail(ctx context.Context, orderID string) (*barryDTO.OrderRealDetailDTO, error) {
	orderID = strings.TrimSpace(orderID)
	if orderID == "" {
		return nil, fmt.Errorf("orderId is required")
	}
	requestURL := innerServicePath(barryInnerOrderRealDetailPath)
	if strings.TrimSpace(requestURL) == "" {
		return nil, fmt.Errorf("barry 订单实时数据接口未配置")
	}
	response := &barryDTO.DetailResponseDTO[barryDTO.OrderRealDetailDTO]{}
	err := s.client.GetAbsolute(ctx, requestURL, buildValues("extOrderId", orderID), response)
	if err != nil {
		return nil, err
	}
	if !response.Success || response.Data == nil {
		return nil, responseError(response.Message, "barry order real detail response is empty")
	}
	return response.Data, nil
}
