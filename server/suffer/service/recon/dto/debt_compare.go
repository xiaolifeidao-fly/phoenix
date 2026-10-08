package dto

// 欠款核对状态
const (
	DebtCompareStatusOK         = "OK"          // 一致
	DebtCompareStatusMinor      = "MINOR"       // 相差较小(差值比例在阈值内)
	DebtCompareStatusDiff       = "DIFF"        // 有差异
	DebtCompareStatusNoBaseline = "NO_BASELINE" // 往前找不到上一份人工记账, 算不出欠款增量
	DebtCompareStatusNoManual   = "NO_MANUAL"   // 当天人工记账里没有这个社区
)

// DebtCompareRowDTO 某个上游社区在 (上一份记账日, 当天] 内的核对, 金额均为 RMB.
//
// 应收 = 这段时间的充值;
// 人工对比值 = 这段时间的入账(社区入账 + 代收手续费) + 人工欠款增量(当天人工欠款 − 上一份人工欠款);
// 差值 = 人工对比值 − 应收.
type DebtCompareRowDTO struct {
	UserID    uint64 `json:"userId"`
	Name      string `json:"name"`
	Username  string `json:"username,omitempty"`
	Remark    string `json:"remark,omitempty"`
	IsTrading bool   `json:"isTrading"`

	// Receivable 应收 = 这段时间的充值
	Receivable float64 `json:"receivable"`
	Income     float64 `json:"income"`
	CollectFee float64 `json:"collectFee"`
	// IncomeTotal 入账合计 = 社区入账 + 代收手续费
	IncomeTotal float64 `json:"incomeTotal"`

	// 上一份 / 当天人工记的欠款(RMB, U 已按各自当天汇率折算); 上一份没记这个社区时按 0 算, PreviousMissing = true.
	PreviousDebt    *float64 `json:"previousDebt"`
	PreviousMissing bool     `json:"previousMissing"`
	ManualCurrency  string   `json:"manualCurrency,omitempty"`
	ManualAmount    *float64 `json:"manualAmount"`
	ManualDebt      *float64 `json:"manualDebt"`
	DebtChange      *float64 `json:"debtChange"`
	// ManualTotal 人工对比值 = 入账 + 欠款增量
	ManualTotal *float64 `json:"manualTotal"`

	Diff      *float64 `json:"diff"`
	DiffRatio *float64 `json:"diffRatio"`
	Status    string   `json:"status"`
	// Issues 哪里有问题: 缺数据的原因, 或差值的可能来源
	Issues []string `json:"issues"`
}

// DebtCompareDayDTO 某一份人工记账那天的核对, 对比窗口 (PreviousDate, Date].
type DebtCompareDayDTO struct {
	Date   string `json:"date"`
	BookID int    `json:"bookId"`
	// PreviousDate 上一份人工记账的日期, 往前 31 天内找不到时为空
	PreviousDate string              `json:"previousDate,omitempty"`
	Days         int                 `json:"days"`
	Rows         []DebtCompareRowDTO `json:"rows"`
	// 合计只算两边都有值的社区
	Receivable  float64 `json:"receivable"`
	ManualTotal float64 `json:"manualTotal"`
	Diff        float64 `json:"diff"`
	DiffCount   int     `json:"diffCount"`
	// IssueCount 有问题的社区数(有差异 + 缺上一份 + 人工未记)
	IssueCount int `json:"issueCount"`
}

// DebtCompareDTO 欠款核对: 所选区间内每一份人工记账都核对一次, 按日期倒序(最新在前).
type DebtCompareDTO struct {
	StartDate string              `json:"startDate"`
	EndDate   string              `json:"endDate"`
	Days      []DebtCompareDayDTO `json:"days"`
	// 整个区间的合计 = 各天合计之和
	Receivable  float64 `json:"receivable"`
	ManualTotal float64 `json:"manualTotal"`
	Diff        float64 `json:"diff"`
	// DiffDays 有差异的天数
	DiffDays int `json:"diffDays"`
	// Notices 整体层面的提示(比如区间内没有人工记账)
	Notices []string `json:"notices"`
	// Tolerance 差值绝对值不超过它算一致(RMB); MinorRatio 差值比例不超过它算相差较小.
	Tolerance  float64 `json:"tolerance"`
	MinorRatio float64 `json:"minorRatio"`
}
