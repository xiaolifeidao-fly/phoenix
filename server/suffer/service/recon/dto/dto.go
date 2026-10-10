package dto

// OpeningDebtDTO 人工录入欠款(初始欠款), 和上游社区一对一.
type OpeningDebtDTO struct {
	ID        int     `json:"id"`
	UserID    uint64  `json:"userId"`
	AccountID uint64  `json:"accountId"`
	Amount    float64 `json:"amount"`
	// DebtDate 欠款日期 yyyy-MM-dd: 金额是这天结束时的欠款, 从次日开始累计; 旧数据可能为空
	DebtDate    string `json:"debtDate,omitempty"`
	Remark      string `json:"remark,omitempty"`
	CreatedBy   string `json:"createdBy,omitempty"`
	CreatedTime string `json:"createdTime,omitempty"`
	UpdatedBy   string `json:"updatedBy,omitempty"`
	UpdatedTime string `json:"updatedTime,omitempty"`
}

// SaveOpeningDebtDTO 录入 / 修改人工录入欠款; 这个社区已有一条时直接改它.
type SaveOpeningDebtDTO struct {
	UserID   uint64   `json:"userId"`
	Amount   *float64 `json:"amount"`
	DebtDate string   `json:"debtDate"`
	Remark   string   `json:"remark"`
}

// AccountStatusRowDTO 对账工作台 - 账户状态: 活跃上游用户一行, 金额均为 RMB.
//
// 截至 D 日的系统欠款 = 人工录入欠款 + 欠款日期次日到 D 日的(充值 − 社区入账 − 代收手续费);
// 没录入、或 D 早于欠款日期时为 null.
type AccountStatusRowDTO struct {
	UserID        uint64  `json:"userId"`
	Name          string  `json:"name"`
	Username      string  `json:"username"`
	Remark        string  `json:"remark,omitempty"`
	AccountID     uint64  `json:"accountId"`
	AccountStatus string  `json:"accountStatus"`
	BalanceAmount float64 `json:"balanceAmount"`

	// CurrentDebt 人工录入欠款; 没录过为 nil.
	CurrentDebt *OpeningDebtDTO `json:"currentDebt"`

	// 本期(所选区间)发生额
	PeriodRecharge   float64 `json:"periodRecharge"`
	PeriodIncome     float64 `json:"periodIncome"`
	PeriodCollectFee float64 `json:"periodCollectFee"`

	// OpeningDebt 期初欠款(截至开始日前一天), ClosingDebt 期末欠款(截至结束日, 即系统计算欠款).
	OpeningDebt *float64 `json:"openingDebt"`
	ClosingDebt *float64 `json:"closingDebt"`

	// 期末用到的欠款日期之后的累计, 页面悬停展示.
	ClosingRecharge   float64 `json:"closingRecharge"`
	ClosingIncome     float64 `json:"closingIncome"`
	ClosingCollectFee float64 `json:"closingCollectFee"`
}
