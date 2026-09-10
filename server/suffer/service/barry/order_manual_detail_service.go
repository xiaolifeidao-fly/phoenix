package barry

import (
	"context"
	"fmt"
	"strings"

	barryDTO "suffer/service/barry/dto"
)

// OrderManualDetailService 单个订单的做单明细，全部转发 barry gateway-inner。
// 订单 ID 即 barry shop_inlet_record.ori_shop_id，barry 侧再经 shop_inlet_record -> shop 定位到 order_record。
type OrderManualDetailService struct {
	client *Client
}

func NewOrderManualDetailService(client *Client) *OrderManualDetailService {
	return &OrderManualDetailService{client: client}
}

// Users 该订单的做单人分布，按做单用户聚合做单量。
func (s *OrderManualDetailService) Users(ctx context.Context, orderID string) ([]*barryDTO.OrderManualUserSummaryDTO, error) {
	requestURL, err := s.buildURL(barryInnerOrderManualDetailUsersPath, orderID)
	if err != nil {
		return nil, err
	}
	response := &barryDTO.ListResponseDTO[barryDTO.OrderManualUserSummaryDTO]{}
	if err := s.client.GetAbsolute(ctx, requestURL, nil, response); err != nil {
		return nil, err
	}
	if !response.Success {
		return nil, responseError(response.Message, "barry order manual detail user response is invalid")
	}
	return response.Data, nil
}

// Page 该订单的做单明细分页，UserID 为 0 时查全部做单用户。
func (s *OrderManualDetailService) Page(ctx context.Context, query barryDTO.OrderManualDetailQueryDTO) (*barryDTO.OrderManualDetailPageDTO, error) {
	requestURL, err := s.buildURL(barryInnerOrderManualDetailsPath, query.OrderID)
	if err != nil {
		return nil, err
	}
	response := &barryDTO.DetailResponseDTO[barryDTO.OrderManualDetailPageDTO]{}
	err = s.client.GetAbsolute(ctx, requestURL, buildValues(
		"userId", query.UserID,
		"page", query.Page,
		"pageSize", query.PageSize,
	), response)
	if err != nil {
		return nil, err
	}
	if !response.Success || response.Data == nil {
		return nil, responseError(response.Message, "barry order manual detail response is empty")
	}
	return response.Data, nil
}

func (s *OrderManualDetailService) buildURL(configKey, orderID string) (string, error) {
	orderID = strings.TrimSpace(orderID)
	if orderID == "" {
		return "", fmt.Errorf("orderId is required")
	}
	requestPath := innerServicePath(configKey)
	if strings.TrimSpace(requestPath) == "" {
		return "", fmt.Errorf("barry 订单做单明细接口未配置")
	}
	return strings.ReplaceAll(requestPath, "{orderId}", orderID), nil
}
