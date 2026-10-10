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
	CompareStatusOK          = "OK"           // 一致
	CompareStatusDiff        = "DIFF"         // 有差异
	CompareStatusMissing     = "MISSING"      // 当天没记账
	CompareStatusNoBaseline  = "NO_BASELINE"  // 还没设初始余额, 算不出系统应有余额
	CompareStatusBeforeStart = "BEFORE_START" // 早于初始余额日期, 不对比
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

// ManualBookCompareItemDTO 某天人工余额 vs 系统应有余额, 基准是账户状态里的初始余额.
// 系统应有余额 = 初始余额 + 初始余额日期次日到当天的(入账 − 出账); 差值 = 人工余额 − 系统应有余额(累计差).
// 当天窗口 (BaselineDate, Date]: BaselineDate = 初始余额日期之后上一份人工记账, 没有时就是初始余额(BaselineIsOpening);
// 人工利润 = 当天余额 − 上一份余额, 系统利润 = 窗口内入账 − 出账, 两者之差 = 当天新增差值 DayDiff.
// 窗口跨多天(中间有天没记账)时 GapDays > 1.
type ManualBookCompareItemDTO struct {
	Date              string `json:"date"`
	Status            string `json:"status"`
	BaselineDate      string `json:"baselineDate,omitempty"`
	BaselineIsOpening bool   `json:"baselineIsOpening,omitempty"`
	// GapDays 窗口天数
	GapDays int `json:"gapDays"`

	BookID     int      `json:"bookId,omitempty"`
	Currency   string   `json:"currency,omitempty"`
	Balance    *float64 `json:"balance"`
	BalanceRmb *float64 `json:"balanceRmb"`
	// BaselineBalance 上一份人工余额(或初始余额); BaselineSystemBalance 截至上一份日期的系统应有余额.
	BaselineBalance       *float64 `json:"baselineBalanceRmb"`
	BaselineSystemBalance *float64 `json:"baselineSystemBalanceRmb"`
	DebtTotalRmb          *float64 `json:"debtTotalRmb"`
	// DebtBaselineDate / DebtChangeRmb 欠款合计相对上一份人工记账的增量(RMB), 没有上一份时为空; 欠款不参与余额对比.
	DebtBaselineDate string   `json:"debtBaselineDate,omitempty"`
	DebtChangeRmb    *float64 `json:"debtChangeRmb"`
	// Debts 截至当天各社区的欠款及增量.
	Debts []ManualBookDebtCompareDTO `json:"debts"`
	// BalanceChange 剩余金额按原币种的变化, 只有和上一份同币种时有值.
	BalanceChange *float64 `json:"balanceChange"`

	ManualProfit *float64 `json:"manualProfit"`
	LedgerIn     float64  `json:"ledgerIn"`
	LedgerOut    float64  `json:"ledgerOut"`
	LedgerProfit float64  `json:"ledgerProfit"`
	// LedgerCategories 窗口内出入账按类目拆开(按类目枚举顺序), 出账含各类手续费.
	LedgerCategories []ManualBookLedgerCategoryDTO `json:"ledgerCategories"`

	// OpeningDate / OpeningBalanceRmb 用到的初始余额; SinceIn / SinceOut 初始余额日期次日到当天的累计入账 / 出账.
	OpeningDate       string   `json:"openingDate,omitempty"`
	OpeningBalanceRmb *float64 `json:"openingBalanceRmb"`
	SinceIn           float64  `json:"sinceIn"`
	SinceOut          float64  `json:"sinceOut"`
	// SystemBalanceRmb 系统应有余额 = 初始余额 + 累计入账 − 累计出账; 没设初始余额或早于初始余额日期时为 nil.
	SystemBalanceRmb *float64 `json:"systemBalanceRmb"`
	// FxEffect 初始余额和当天都按 U 记、汇率不同时, 汇率变化带来的差 = 初始 U 余额 × (当天汇率 − 初始汇率);
	// DayFxEffect 同理, 相对上一份.
	FxEffect    *float64 `json:"fxEffect"`
	DayFxEffect *float64 `json:"dayFxEffect"`
	// Diff = 人工余额 − 系统应有余额(累计差); DiffRatio = Diff / |系统应有余额|, 系统应有余额为 0 时为 nil.
	// DayDiff = 人工利润 − 系统利润 = 当天新增的差值.
	Diff      *float64 `json:"diff"`
	DiffRatio *float64 `json:"diffRatio"`
	DayDiff   *float64 `json:"dayDiff"`
	// Issues 有差异时, 差值可能来自哪里; 每条挂在它对应的那一列
	Issues []ManualBookIssueDTO `json:"issues"`
}

// 差值来源挂在哪一列.
const (
	IssueColumnBalance = "balance"
	IssueColumnProfit  = "profit"
	IssueColumnIn      = "in"
	IssueColumnOut     = "out"
	IssueColumnDiff    = "diff"
)

// 差值来源的类别, 前端按它上色.
const (
	IssueKindBalance  = "balance"  // 累计差: 人工余额比系统应有余额多 / 少多少
	IssueKindSplit    = "split"    // 这段日期新增多少、之前累计多少
	IssueKindFx       = "fx"       // 汇率变化
	IssueKindCarry    = "carry"    // 没有新增, 差异是之前带过来的
	IssueKindLedger   = "ledger"   // 正好等于某一类出入账
	IssueKindNeighbor = "neighbor" // 和相邻那天互相抵消, 记错了日期
	IssueKindCheck    = "check"    // 找不到明确来源, 需要人工核对
)

// ManualBookIssueDTO 差值的一条可能来源; Label 是放在格子里的短标签, Text 是完整说明(悬浮显示).
type ManualBookIssueDTO struct {
	Column string `json:"column"`
	Kind   string `json:"kind"`
	Label  string `json:"label"`
	Text   string `json:"text"`
}

// ManualBookLedgerCategoryDTO 窗口内某个出入账类目的合计(RMB).
type ManualBookLedgerCategoryDTO struct {
	Category     string `json:"category"`
	CategoryName string `json:"categoryName"`
	// RecordType IN 入账 / OUT 出账
	RecordType string  `json:"recordType"`
	Count      int64   `json:"count"`
	AmountRmb  float64 `json:"amountRmb"`
}

// ManualBookCompareDTO 所选区间的总对比 + 每天的对比(区间内每天一行, 日期升序).
// 总对比: 终点 = 区间内最后一份记账, 差值同样以初始余额为基准; 区间利润的起点 = 开始日之前(初始余额日期之后)最近一份, 没有就是初始余额.
type ManualBookCompareDTO struct {
	StartDate string `json:"startDate"`
	EndDate   string `json:"endDate"`
	// OpeningBalance 对比基准(账户状态里的初始余额), 没设为 nil.
	OpeningBalance *OpeningBalanceDTO         `json:"openingBalance"`
	Total          ManualBookCompareItemDTO   `json:"total"`
	Days           []ManualBookCompareItemDTO `json:"days"`
	Books          []ManualBookDTO            `json:"books"`
	DiffDays       int                        `json:"diffDays"`
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
