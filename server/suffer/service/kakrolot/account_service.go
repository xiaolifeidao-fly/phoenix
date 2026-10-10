package kakrolot

import (
	"context"
	"encoding/json"
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

// IncomeGiven 入账赠送: 把一条社区入账的代收手续费加到上游用户余额, Kakrolot 按入账 ID 幂等.
// 返回 true 本次已加款, false 之前已赠送过、本次未加款.
func (s *AccountService) IncomeGiven(ctx context.Context, userID uint64, ledgerID int64, amount float64, token string) (bool, error) {
	if userID == 0 || ledgerID <= 0 {
		return false, fmt.Errorf("userId 和 ledgerId 不能为空")
	}
	if amount <= 0 {
		return false, fmt.Errorf("赠送金额需大于 0")
	}
	response, err := s.client.Post(ctx, "/accounts/incomeGiven", map[string]any{
		"userId":   userID,
		"ledgerId": ledgerID,
		"amount":   amount,
	}, token)
	if err != nil {
		return false, err
	}
	if response == nil {
		return false, fmt.Errorf("kakrolot 返回为空")
	}
	if !response.IsSuccess() {
		return false, fmt.Errorf("%s", response.ErrorMessage())
	}
	var data struct {
		Given bool `json:"given"`
	}
	if err := json.Unmarshal(response.Data, &data); err != nil {
		return false, fmt.Errorf("kakrolot 入账赠送返回解析失败: %w", err)
	}
	return data.Given, nil
}
