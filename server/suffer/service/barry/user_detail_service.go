package barry

import (
	"context"
	"fmt"
	"net/url"
	"strings"

	barryDTO "suffer/service/barry/dto"
)

type UserDetailService struct {
	client *Client
}

func NewUserDetailService(client *Client) *UserDetailService {
	return &UserDetailService{client: client}
}

func (s *UserDetailService) FindByUsername(ctx context.Context, username string) (*barryDTO.DetailResponseDTO[barryDTO.UserDetailDTO], error) {
	response := &barryDTO.DetailResponseDTO[barryDTO.UserDetailDTO]{}
	requestURL := strings.ReplaceAll(innerServicePath(barryInnerUserDetailFindPath), "{username}", strings.TrimSpace(username))
	err := s.client.GetAbsolute(ctx, requestURL, nil, response)
	if err != nil {
		return nil, err
	}
	return response, nil
}

func (s *UserDetailService) List(ctx context.Context, query barryDTO.UserDetailQueryDTO) (*barryDTO.ListResponseDTO[barryDTO.UserDetailDTO], error) {
	response := &barryDTO.ListResponseDTO[barryDTO.UserDetailDTO]{}
	err := s.client.GetAbsolute(ctx, innerServicePath(barryInnerUserDetailListPath), buildUserDetailValues(query), response)
	if err != nil {
		return nil, err
	}
	return response, nil
}

func (s *UserDetailService) ListBasic(ctx context.Context, query barryDTO.UserDetailQueryDTO) (*barryDTO.ListResponseDTO[barryDTO.UserDetailDTO], error) {
	requestPath := configuredInnerServicePath(barryInnerUserDetailBasicListPath)
	if requestPath == "" {
		response, err := s.List(ctx, query)
		if err != nil {
			return nil, err
		}
		clearPaymentMethods(response.Data)
		return response, nil
	}

	response := &barryDTO.ListResponseDTO[barryDTO.UserDetailDTO]{}
	err := s.client.GetAbsolute(ctx, requestPath, buildUserDetailValues(query), response)
	if err != nil {
		return nil, err
	}
	clearPaymentMethods(response.Data)
	return response, nil
}

func (s *UserDetailService) ListPaymentMethods(ctx context.Context, query barryDTO.UserDetailQueryDTO) (*barryDTO.ListResponseDTO[barryDTO.PaymentMethodDTO], error) {
	if strings.TrimSpace(query.Username) == "" {
		return nil, fmt.Errorf("username is required")
	}

	requestPath := configuredInnerServicePath(barryInnerUserPaymentMethodListPath)
	if requestPath != "" {
		response := &barryDTO.ListResponseDTO[barryDTO.PaymentMethodDTO]{}
		err := s.client.GetAbsolute(ctx, requestPath, buildUserDetailValues(query), response)
		if err != nil {
			return nil, err
		}
		return response, nil
	}

	response, err := s.List(ctx, query)
	if err != nil {
		return nil, err
	}

	result := &barryDTO.ListResponseDTO[barryDTO.PaymentMethodDTO]{
		Success: response.Success,
		Code:    response.Code,
		Message: response.Message,
	}
	for _, item := range response.Data {
		if item == nil || strings.TrimSpace(item.Username) != strings.TrimSpace(query.Username) {
			continue
		}
		if query.Channel != "" && strings.TrimSpace(item.Channel) != strings.TrimSpace(query.Channel) {
			continue
		}
		result.Data = item.PaymentMethods
		result.Total = len(result.Data)
		return result, nil
	}
	return result, nil
}

func (s *UserDetailService) Save(ctx context.Context, req *barryDTO.SaveUserDetailDTO) (*barryDTO.ActionResponseDTO, error) {
	if req == nil {
		return nil, fmt.Errorf("request is nil")
	}
	response := &barryDTO.ActionResponseDTO{Success: true}
	err := s.client.PostAbsolute(ctx, innerServicePath(barryInnerUserDetailSavePath), req, response)
	if err != nil {
		return nil, err
	}
	return response, nil
}

func buildUserDetailValues(query barryDTO.UserDetailQueryDTO) url.Values {
	values := buildValues(
		"requestId", query.RequestID,
		"username", query.Username,
		"pageIndex", query.PageIndex,
		"pageSize", query.PageSize,
	)
	values.Set("channel", strings.TrimSpace(query.Channel))
	return values
}

func clearPaymentMethods(users []*barryDTO.UserDetailDTO) {
	for _, item := range users {
		if item != nil {
			item.PaymentMethods = nil
		}
	}
}

func (s *UserDetailService) Update(ctx context.Context, req *barryDTO.UpdateUserDetailDTO) (*barryDTO.ActionResponseDTO, error) {
	if req == nil {
		return nil, fmt.Errorf("request is nil")
	}
	response := &barryDTO.ActionResponseDTO{Success: true}
	err := s.client.PostAbsolute(ctx, innerServicePath(barryInnerUserDetailUpdatePath), req, response)
	if err != nil {
		return nil, err
	}
	return response, nil
}
