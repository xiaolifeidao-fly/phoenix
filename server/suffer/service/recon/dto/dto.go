package dto

// OpeningDebtDTO 人工录入欠款(初始欠款)的一条记录.
type OpeningDebtDTO struct {
	ID            int     `json:"id"`
	UserID        uint64  `json:"userId"`
	AccountID     uint64  `json:"accountId"`
	Amount        float64 `json:"amount"`
	EffectiveDate string  `json:"effectiveDate"`
	// SettleStatus UNSETTLED 未结清(当前有效) / SETTLED 已结清(被后一条接替).
	SettleStatus string `json:"settleStatus"`
	SettleDate   string `json:"settleDate,omitempty"`
	Remark       string `json:"remark,omitempty"`
	CreatedBy    string `json:"createdBy,omitempty"`
	CreatedTime  string `json:"createdTime,omitempty"`
	UpdatedBy    string `json:"updatedBy,omitempty"`
	UpdatedTime  string `json:"updatedTime,omitempty"`
}

// SaveOpeningDebtDTO 新增 / 修改人工录入欠款.
type SaveOpeningDebtDTO struct {
	UserID        uint64   `json:"userId"`
	Amount        *float64 `json:"amount"`
	EffectiveDate string   `json:"effectiveDate"`
	Remark        string   `json:"remark"`
}

// AccountStatusRowDTO 对账工作台 - 账户状态: 活跃上游用户一行, 金额均为 RMB.
//
// 系统计算欠款(截至 D 日) = 起点金额 + 起点生效日之后到 D 日的(充值 − 社区入账 − 代收手续费);
// 起点 = 生效日期 <= D 的最近一条人工录入欠款; 没有起点时为 null(未建账).
type AccountStatusRowDTO struct {
	UserID        uint64  `json:"userId"`
	Name          string  `json:"name"`
	Username      string  `json:"username"`
	Remark        string  `json:"remark,omitempty"`
	AccountID     uint64  `json:"accountId"`
	AccountStatus string  `json:"accountStatus"`
	BalanceAmount float64 `json:"balanceAmount"`

	// CurrentDebt 当前未结清的那条人工录入欠款; 没录过为 nil.
	CurrentDebt *OpeningDebtDTO `json:"currentDebt"`

	// 本期(所选区间)发生额
	PeriodRecharge   float64 `json:"periodRecharge"`
	PeriodIncome     float64 `json:"periodIncome"`
	PeriodCollectFee float64 `json:"periodCollectFee"`

	// OpeningDebt 期初欠款(截至开始日前一天), ClosingDebt 期末欠款(截至结束日, 即系统计算欠款).
	OpeningDebt *float64 `json:"openingDebt"`
	ClosingDebt *float64 `json:"closingDebt"`

	// 期末用到的起点和起点之后的累计, 页面悬停展示.
	ClosingBaseline   *OpeningDebtDTO `json:"closingBaseline"`
	ClosingRecharge   float64         `json:"closingRecharge"`
	ClosingIncome     float64         `json:"closingIncome"`
	ClosingCollectFee float64         `json:"closingCollectFee"`
}
