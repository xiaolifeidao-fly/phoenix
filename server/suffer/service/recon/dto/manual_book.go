package dto

// ManualBookDebtDTO 人工记账里某个上游社区当天的欠款.
type ManualBookDebtDTO struct {
	UpstreamUserID   uint64 `json:"upstreamUserId"`
	UpstreamUserName string `json:"upstreamUserName,omitempty"`
	// UpstreamUsername / UpstreamRemark 用户管理里当前的用户名和备注, 只用于展示, 不进修改记录快照.
	UpstreamUsername string `json:"upstreamUsername,omitempty"`
	UpstreamRemark   string `json:"upstreamRemark,omitempty"`
	// UpstreamBalance 这个社区截至记账当天的账户余额(RMB, 已充值还没消费), 取每天 00:00 打的前一天快照, 只用于展示;
	// 当天还没打快照时是当前余额(UpstreamBalanceLive = true), 更早的日期没有快照时为 nil.
	UpstreamBalance     *float64 `json:"upstreamBalance"`
	UpstreamBalanceLive bool     `json:"upstreamBalanceLive,omitempty"`
	// UpstreamBalanceTime 快照实际打的时间
	UpstreamBalanceTime string  `json:"upstreamBalanceTime,omitempty"`
	Currency            string  `json:"currency"`
	Amount              float64 `json:"amount"`
	AmountRmb           float64 `json:"amountRmb"`
}

// ManualBookDTO 人工记账: 某天的剩余金额 + 各上游社区欠款.
type ManualBookDTO struct {
	ID           int                 `json:"id"`
	BookDate     string              `json:"bookDate"`
	Currency     string              `json:"currency"`
	Balance      float64             `json:"balance"`
	ExchangeRate *float64            `json:"exchangeRate"`
	BalanceRmb   float64             `json:"balanceRmb"`
	DebtTotalRmb float64             `json:"debtTotalRmb"`
	Debts        []ManualBookDebtDTO `json:"debts"`
	Remark       string              `json:"remark,omitempty"`
	CreatedBy    string              `json:"createdBy,omitempty"`
	UpdatedBy    string              `json:"updatedBy,omitempty"`
	UpdatedTime  string              `json:"updatedTime,omitempty"`
}

// SaveManualBookDebtDTO 记账时填的一条社区欠款; Currency 为空按 RMB.
type SaveManualBookDebtDTO struct {
	UpstreamUserID uint64   `json:"upstreamUserId"`
	Currency       string   `json:"currency"`
	Amount         *float64 `json:"amount"`
}

// SaveManualBookDTO 新增 / 修改人工记账. Currency 为空按 USDT; 剩余金额或欠款里有 U 时 ExchangeRate 必填.
type SaveManualBookDTO struct {
	BookDate     string                  `json:"bookDate"`
	Currency     string                  `json:"currency"`
	Balance      *float64                `json:"balance"`
	ExchangeRate *float64                `json:"exchangeRate"`
	Remark       string                  `json:"remark"`
	Debts        []SaveManualBookDebtDTO `json:"debts"`
}

// ManualBookDetailDTO 某天的记账(没有为 nil) + 之前最近一天的记账(用来预填, 没有为 nil).
type ManualBookDetailDTO struct {
	Book     *ManualBookDTO `json:"book"`
	Previous *ManualBookDTO `json:"previous"`
}

// 对比状态
const (
	CompareStatusOK         = "OK"          // 一致
	CompareStatusDiff       = "DIFF"        // 有差异
	CompareStatusMissing    = "MISSING"     // 当天没记账
	CompareStatusNoBaseline = "NO_BASELINE" // 当天记了账, 但往前找不到上一份, 算不出利润
)

// ManualBookDebtCompareDTO 某个社区截至当天的欠款, 以及相对上一份记账的增量.
// 上一份里没有这个社区时按 0 算增量, IsNew = true.
type ManualBookDebtCompareDTO struct {
	UpstreamUserID   uint64 `json:"upstreamUserId"`
	UpstreamUserName string `json:"upstreamUserName,omitempty"`
	UpstreamUsername string `json:"upstreamUsername,omitempty"`
	UpstreamRemark   string `json:"upstreamRemark,omitempty"`
	// UpstreamBalance 同 ManualBookDebtDTO: 截至当天的余额快照
	UpstreamBalance     *float64 `json:"upstreamBalance"`
	UpstreamBalanceLive bool     `json:"upstreamBalanceLive,omitempty"`
	UpstreamBalanceTime string   `json:"upstreamBalanceTime,omitempty"`
	Currency            string   `json:"currency"`
	Amount              float64  `json:"amount"`
	AmountRmb           float64  `json:"amountRmb"`
	// Change 按原币种的增量, 只有和上一份同币种(或上一份没有)时有值; ChangeRmb 按 RMB 的增量.
	Change    *float64 `json:"change"`
	ChangeRmb *float64 `json:"changeRmb"`
	IsNew     bool     `json:"isNew"`
}

// ManualBookCompareItemDTO 人工记账利润 vs 出入账利润, 对比窗口为 (BaselineDate, BookDate].
// 人工利润 = 当天剩余金额 − 上一份剩余金额(RMB); 出入账利润 = 窗口内入账 − 出账(RMB).
// 上一份不是前一天时(中间有天没记账), 窗口跨多天, GapDays > 1.
type ManualBookCompareItemDTO struct {
	Date         string `json:"date"`
	Status       string `json:"status"`
	BaselineDate string `json:"baselineDate,omitempty"`
	// GapDays 窗口天数
	GapDays int `json:"gapDays"`

	BookID          int      `json:"bookId,omitempty"`
	Currency        string   `json:"currency,omitempty"`
	Balance         *float64 `json:"balance"`
	BalanceRmb      *float64 `json:"balanceRmb"`
	BaselineBalance *float64 `json:"baselineBalanceRmb"`
	DebtTotalRmb    *float64 `json:"debtTotalRmb"`
	// DebtChangeRmb 欠款合计相对上一份的增量(RMB), 没有上一份时为 nil.
	DebtChangeRmb *float64 `json:"debtChangeRmb"`
	// Debts 截至当天各社区的欠款及增量.
	Debts []ManualBookDebtCompareDTO `json:"debts"`
	// BalanceChange 剩余金额按原币种的变化, 只有和上一份同币种时有值.
	BalanceChange *float64 `json:"balanceChange"`

	ManualProfit *float64 `json:"manualProfit"`
	LedgerIn     float64  `json:"ledgerIn"`
	LedgerOut    float64  `json:"ledgerOut"`
	LedgerProfit float64  `json:"ledgerProfit"`
	// Diff = 人工利润 − 出入账利润; DiffRatio = Diff / |出入账利润|, 出入账利润为 0 时为 nil.
	Diff      *float64 `json:"diff"`
	DiffRatio *float64 `json:"diffRatio"`
}

// ManualBookCompareDTO 所选区间的总对比 + 每天的对比(区间内每天一行, 日期升序).
// 总对比: 起点 = 开始日之前最近一份(往前最多找 31 天), 没有时取区间内第一份; 终点 = 区间内最后一份.
type ManualBookCompareDTO struct {
	StartDate string                     `json:"startDate"`
	EndDate   string                     `json:"endDate"`
	Total     ManualBookCompareItemDTO   `json:"total"`
	Days      []ManualBookCompareItemDTO `json:"days"`
	Books     []ManualBookDTO            `json:"books"`
	DiffDays  int                        `json:"diffDays"`
	// Tolerance 差异绝对值不超过它算一致(RMB), 用来吸收折算的舍入.
	Tolerance float64 `json:"tolerance"`
}

// ManualBookChangeDTO 一次修改里的一项变化; 新增的项 Before 为空, 删除的项 After 为空.
type ManualBookChangeDTO struct {
	// Field balance 剩余金额 / exchangeRate 汇率 / remark 备注 / debt 社区欠款
	Field  string `json:"field"`
	Label  string `json:"label"`
	Before string `json:"before,omitempty"`
	After  string `json:"after,omitempty"`
}

// ManualBookLogDTO 人工记账的一条修改记录.
type ManualBookLogDTO struct {
	ID       int    `json:"id"`
	BookID   int    `json:"bookId"`
	BookDate string `json:"bookDate"`
	// Action CREATE 新增 / UPDATE 修改 / DELETE 删除
	Action   string                `json:"action"`
	Operator string                `json:"operator,omitempty"`
	Time     string                `json:"time"`
	Changes  []ManualBookChangeDTO `json:"changes"`
}
