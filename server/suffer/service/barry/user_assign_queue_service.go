package barry

import (
	"context"
	"fmt"
	"strings"

	barryDTO "suffer/service/barry/dto"
)

type UserAssignQueueService struct {
	client *Client
}

func NewUserAssignQueueService(client *Client) *UserAssignQueueService {
	return &UserAssignQueueService{client: client}
}

func (s *UserAssignQueueService) UID(ctx context.Context, query barryDTO.UserAssignQueueQueryDTO) ([]*barryDTO.UserAssignQueueDTO, error) {
	response := &barryDTO.ListResponseDTO[barryDTO.UserAssignQueueDTO]{}
	values := buildValues(
		"userId", query.UserID,
		"uid", query.UID,
	)
	if err := s.client.GetAbsolute(ctx, innerServicePath(barryInnerUserAssignQueueUIDPath), values, response); err != nil {
		return nil, err
	}
	if !response.Success {
		return nil, responseError(response.Message, "barry user assign queue response is invalid")
	}
	return response.Data, nil
}

// FetchTask 代替做单用户按商品分组取一次任务，barry 侧用该用户的 pubToken 调 APP 网关。
func (s *UserAssignQueueService) FetchTask(ctx context.Context, query barryDTO.UserFetchTaskQueryDTO) (*barryDTO.UserFetchTaskDTO, error) {
	requestURL := innerServicePath(barryInnerUserFetchTaskPath)
	if strings.TrimSpace(requestURL) == "" {
		return nil, fmt.Errorf("barry 代取任务接口未配置")
	}
	response := &barryDTO.DetailResponseDTO[barryDTO.UserFetchTaskDTO]{}
	if err := s.client.PostAbsolute(ctx, requestURL, query, response); err != nil {
		return nil, err
	}
	if !response.Success {
		return nil, responseError(response.Message, "barry 代取任务失败")
	}
	return response.Data, nil
}
