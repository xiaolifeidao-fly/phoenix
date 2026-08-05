package kakrolot

import (
	"context"
	"fmt"
	"strconv"
)

type AccountService struct {
	client *Client
}

func NewAccountService(client *Client) *AccountService {
	return &AccountService{client: client}
}

func (s *AccountService) Recharge(ctx context.Context, accountID uint64, amount float64, givenScale int, token string) (string, error) {
	if accountID == 0 {
		return "", fmt.Errorf("accountId is required")
	}
	if amount <= 0 {
		return "", fmt.Errorf("充值金额需大于 0")
	}
	if givenScale < 0 {
		return "", fmt.Errorf("赠送比例不能小于 0")
	}
	response, err := s.client.Post(ctx, "/accounts/"+strconv.FormatUint(accountID, 10)+"/payAmount", map[string]any{
		"amount":     amount,
		"givenScale": givenScale,
	}, token)
	if err != nil {
		return "", err
	}
	if response == nil {
		return "", fmt.Errorf("kakrolot 返回为空")
	}
	if !response.IsSuccess() {
		return "", fmt.Errorf("%s", response.ErrorMessage())
	}
	return response.Message, nil
}
