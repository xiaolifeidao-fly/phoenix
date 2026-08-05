package barry

import (
	"context"
	"encoding/json"
	"fmt"
	"strconv"
	"strings"

	barryDTO "suffer/service/barry/dto"
)

// OrderAssignService 订单分发操作，目前用于管理端异常打标后的停止分发。
type OrderAssignService struct {
	client *Client
}

func NewOrderAssignService(client *Client) *OrderAssignService {
	return &OrderAssignService{client: client}
}

// StopAssign 停止订单的分发。orderID 为订单主键，即 barry shop_inlet_record.ori_shop_id。
func (s *OrderAssignService) StopAssign(ctx context.Context, orderID uint64) (*barryDTO.ActionResponseDTO, error) {
	if orderID == 0 {
		return nil, fmt.Errorf("orderId is required")
	}
	requestPath := innerServicePath(barryInnerOrderStopAssignPath)
	if strings.TrimSpace(requestPath) == "" {
		return nil, fmt.Errorf("barry 停止分发接口未配置")
	}
	requestURL := strings.TrimRight(requestPath, "/") + "/" + strconv.FormatUint(orderID, 10) + "/stopAssign"
	response := &barryDTO.ActionResponseDTO{Success: true}
	if err := s.client.PostAbsolute(ctx, requestURL, map[string]any{}, response); err != nil {
		return nil, err
	}
	if !response.Success {
		message := strings.TrimSpace(response.Message)
		if message == "" {
			message = "barry 停止分发失败"
		}
		return response, fmt.Errorf("%s", message)
	}
	return response, nil
}

// ForceFinishResultDTO 单笔强制完成的结果
type ForceFinishResultDTO struct {
	OriShopID    string `json:"oriShopId"`
	Success      bool   `json:"success"`
	Message      string `json:"message"`
	ShopID       int64  `json:"shopId"`
	AssignmentID int64  `json:"assignmentId"`
	NowNum       int64  `json:"nowNum"`
}

// ForceFinishOrderDTO 强制完成的单笔入参。
// barry 查不到 shop_inlet_record 时，用 TotalNum / BusinessID 兜底通知 kak。
type ForceFinishOrderDTO struct {
	OriShopID  string `json:"oriShopId"`
	TotalNum   int64  `json:"totalNum"`
	BusinessID string `json:"businessId"`
}

// ForceFinish 强制完成：停止分发 + assignment/shop 置为完成 + 通知 kak。
// OriShopID 为订单主键，即 barry shop_inlet_record.ori_shop_id。
func (s *OrderAssignService) ForceFinish(ctx context.Context, orders []ForceFinishOrderDTO) ([]*ForceFinishResultDTO, error) {
	if len(orders) == 0 {
		return nil, fmt.Errorf("orders is required")
	}
	requestPath := innerServicePath(barryInnerOrderStopAssignPath)
	if strings.TrimSpace(requestPath) == "" {
		return nil, fmt.Errorf("barry 订单接口未配置")
	}
	requestURL := strings.TrimRight(requestPath, "/") + "/forceFinish"
	response := &barryDTO.ActionResponseDTO{Success: true}
	if err := s.client.PostAbsolute(ctx, requestURL, map[string]any{"orders": orders}, response); err != nil {
		return nil, err
	}
	if !response.Success {
		message := strings.TrimSpace(response.Message)
		if message == "" {
			message = "barry 强制完成失败"
		}
		return nil, fmt.Errorf("%s", message)
	}
	var results []*ForceFinishResultDTO
	if len(response.Data) > 0 {
		if err := json.Unmarshal(response.Data, &results); err != nil {
			return nil, fmt.Errorf("barry 强制完成结果解析失败: %w", err)
		}
	}
	return results, nil
}
