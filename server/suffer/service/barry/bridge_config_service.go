package barry

import (
	"context"
	"fmt"
	"strings"

	barryDTO "suffer/service/barry/dto"
)

// BridgeConfigService adapts the Barry Inner Gateway configuration endpoints
// for the authenticated management API. Barry remains the source of truth for
// the product-group-to-Bridge mapping and all configuration changes.
type BridgeConfigService struct {
	client *Client
}

func NewBridgeConfigService(client *Client) *BridgeConfigService {
	return &BridgeConfigService{client: client}
}

func (s *BridgeConfigService) List(ctx context.Context, shopGroupID int64) ([]*barryDTO.BridgeConfigDTO, error) {
	response := &barryDTO.ListResponseDTO[barryDTO.BridgeConfigDTO]{}
	if err := s.client.GetAbsolute(ctx, bridgeConfigPath(barryInnerBridgeConfigListPath, shopGroupID, 0), nil, response); err != nil {
		return nil, err
	}
	if !response.Success {
		return nil, responseError(response.Message, "barry bridge configuration list response is empty")
	}
	return response.Data, nil
}

func (s *BridgeConfigService) Save(ctx context.Context, shopGroupID int64, request *barryDTO.BridgeConfigDTO) (*barryDTO.BridgeConfigDTO, error) {
	if request == nil {
		return nil, fmt.Errorf("request is nil")
	}
	response := &barryDTO.DetailResponseDTO[barryDTO.BridgeConfigDTO]{}
	if err := s.client.PostAbsolute(ctx, bridgeConfigPath(barryInnerBridgeConfigSavePath, shopGroupID, 0), request, response); err != nil {
		return nil, err
	}
	if !response.Success || response.Data == nil {
		return nil, responseError(response.Message, "barry bridge configuration save failed")
	}
	return response.Data, nil
}

func (s *BridgeConfigService) Delete(ctx context.Context, shopGroupID, bridgeConfigID int64) error {
	response := &barryDTO.ActionResponseDTO{}
	if err := s.client.DeleteAbsolute(ctx, bridgeConfigPath(barryInnerBridgeConfigDeletePath, shopGroupID, bridgeConfigID), response); err != nil {
		return err
	}
	if !response.Success {
		return responseError(response.Message, "barry bridge configuration delete failed")
	}
	return nil
}

func (s *BridgeConfigService) Active(ctx context.Context, bridgeConfigID int64) error {
	return s.changeStatus(ctx, barryInnerBridgeConfigActivePath, bridgeConfigID, "上线")
}

func (s *BridgeConfigService) Disable(ctx context.Context, bridgeConfigID int64) error {
	return s.changeStatus(ctx, barryInnerBridgeConfigDisablePath, bridgeConfigID, "下线")
}

func (s *BridgeConfigService) ResetStatistics(ctx context.Context, bridgeConfigID int64) error {
	response := &barryDTO.DetailResponseDTO[barryDTO.BridgeConfigDTO]{}
	if err := s.client.PostAbsolute(ctx, bridgeConfigPath(barryInnerBridgeConfigResetPath, 0, bridgeConfigID), nil, response); err != nil {
		return err
	}
	if !response.Success || response.Data == nil {
		return responseError(response.Message, "barry bridge configuration reset failed")
	}
	return nil
}

func (s *BridgeConfigService) changeStatus(ctx context.Context, configPath string, bridgeConfigID int64, action string) error {
	response := &barryDTO.ActionResponseDTO{}
	if err := s.client.GetAbsolute(ctx, bridgeConfigPath(configPath, 0, bridgeConfigID), nil, response); err != nil {
		return err
	}
	if !response.Success {
		return responseError(response.Message, "barry bridge configuration "+action+" failed")
	}
	return nil
}

func bridgeConfigPath(configPath string, shopGroupID, bridgeConfigID int64) string {
	requestURL := innerServicePath(configPath)
	requestURL = strings.ReplaceAll(requestURL, "{shopGroupId}", int64ToString(shopGroupID))
	requestURL = strings.ReplaceAll(requestURL, "{bridgeConfigId}", int64ToString(bridgeConfigID))
	return requestURL
}
