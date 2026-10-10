package dto

// OpeningBalanceDTO 全局初始余额: 金额是 BalanceDate 这天结束时账上的余额, 人工记账对比以它为基准.
type OpeningBalanceDTO struct {
	ID           int      `json:"id"`
	BalanceDate  string   `json:"balanceDate"`
	Currency     string   `json:"currency"`
	Balance      float64  `json:"balance"`
	ExchangeRate *float64 `json:"exchangeRate"`
	BalanceRmb   float64  `json:"balanceRmb"`
	Remark       string   `json:"remark,omitempty"`
	UpdatedBy    string   `json:"updatedBy,omitempty"`
	UpdatedTime  string   `json:"updatedTime,omitempty"`
}

// SaveOpeningBalanceDTO 录入 / 修改初始余额; Currency 为空按 USDT, 按 U 时 ExchangeRate 必填.
type SaveOpeningBalanceDTO struct {
	BalanceDate  string   `json:"balanceDate"`
	Currency     string   `json:"currency"`
	Balance      *float64 `json:"balance"`
	ExchangeRate *float64 `json:"exchangeRate"`
	Remark       string   `json:"remark"`
}
