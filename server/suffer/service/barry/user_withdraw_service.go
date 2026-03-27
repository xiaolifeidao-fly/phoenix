package barry

import (
	"context"
	"fmt"
	"strings"

	barryDTO "suffer/service/barry/dto"
)

type UserWithdrawService struct {
	client *Client
}

func NewUserWithdrawService(client *Client) *UserWithdrawService {
	return &UserWithdrawService{client: client}
}

func (s *UserWithdrawService) List(ctx context.Context, query barryDTO.UserWithdrawRecordQueryDTO) (*barryDTO.ListResponseDTO[barryDTO.UserWithdrawRecordDTO], error) {
	response := &barryDTO.ListResponseDTO[barryDTO.UserWithdrawRecordDTO]{}
	requestURL := innerServicePath(barryInnerUserWithdrawRecordPath)
	requestURL = strings.ReplaceAll(requestURL, "{username}", strings.TrimSpace(query.Username))
	requestURL = strings.ReplaceAll(requestURL, "{channel}", strings.TrimSpace(query.Channel))
	requestURL = strings.ReplaceAll(requestURL, "{status}", strings.TrimSpace(query.Status))
	requestURL = strings.ReplaceAll(requestURL, "{startTime}", strings.TrimSpace(query.StartTime))
	requestURL = strings.ReplaceAll(requestURL, "{endTime}", strings.TrimSpace(query.EndTime))
	err := s.client.GetAbsolute(ctx, requestURL, nil, response)
	if err != nil {
		return nil, err
	}
	return response, nil
}

func (s *UserWithdrawService) Account(ctx context.Context, req *barryDTO.UserWithdrawActionDTO) (*barryDTO.ActionResponseDTO, error) {
	return s.postAction(ctx, innerServicePath(barryInnerUserWithdrawAccountPath), req)
}

func (s *UserWithdrawService) Finish(ctx context.Context, req *barryDTO.UserWithdrawActionDTO) (*barryDTO.ActionResponseDTO, error) {
	return s.postAction(ctx, innerServicePath(barryInnerUserWithdrawFinishPath), req)
}

func (s *UserWithdrawService) Cancel(ctx context.Context, req *barryDTO.UserWithdrawActionDTO) (*barryDTO.ActionResponseDTO, error) {
	return s.postAction(ctx, innerServicePath(barryInnerUserWithdrawCancelPath), req)
}

func (s *UserWithdrawService) postAction(ctx context.Context, requestURL string, req *barryDTO.UserWithdrawActionDTO) (*barryDTO.ActionResponseDTO, error) {
	if req == nil {
		return nil, fmt.Errorf("request is nil")
	}
	response := &barryDTO.ActionResponseDTO{Success: true}
	err := s.client.PostAbsolute(ctx, requestURL, req, response)
	if err != nil {
		return nil, err
	}
	return response, nil
}
