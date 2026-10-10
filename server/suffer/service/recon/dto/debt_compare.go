package dto

// 欠款核对状态
const (
	DebtCompareStatusOK       = "OK"        // 一致
	DebtCompareStatusMinor    = "MINOR"     // 相差较小(差值比例在阈值内)
	DebtCompareStatusDiff     = "DIFF"      // 有差异
	DebtCompareStatusNoManual = "NO_MANUAL" // 当天人工记账里没有这个社区
	// DebtCompareStatusBeforeStart 记账日早于初始欠款的欠款日期, 没法核对
	DebtCompareStatusBeforeStart = "BEFORE_START"
)

// DebtCompareRowDTO 某个上游社区在某个记账日的核对, 金额均为 RMB. 每个指标都有人工和系统两个值.
//
// 当天窗口 = [PrevDate 次日, 记账日]: PrevDate 是这个社区上一份有记欠款的人工记账日, 没有时为初始欠款的欠款日期;
// 充值 / 入账 / 手续费只算当天窗口.
//
// 上一份欠款: 人工 = 上一份人工记账里的欠款(没有时为初始欠款); 系统 = 截至 PrevDate 的系统欠款.
// 当天增量: 人工 = 当天人工欠款 − 上一份人工欠款; 系统 = 充值 − 入账 − 代收手续费.
// 当天欠款: 人工 = 当天人工记账里的欠款; 系统 = 初始欠款 + 欠款日期次日到记账日的累计增量.
// 应收: 人工 = 人工增量 + 入账 + 代收手续费; 系统 = 当天充值. 两者之差 = 当天新增差值.
// 差值 = 人工欠款 − 系统欠款(截至当天的累计); 当天新增差值 = 人工增量 − 系统增量.
type DebtCompareRowDTO struct {
	UserID    uint64 `json:"userId"`
	Name      string `json:"name"`
	Username  string `json:"username,omitempty"`
	Remark    string `json:"remark,omitempty"`
	IsTrading bool   `json:"isTrading"`

	// OpeningDebt 初始欠款(人工录入欠款), OpeningDate 它的欠款日期; 没录时按 0 算, OpeningMissing = true.
	OpeningDebt    float64 `json:"openingDebt"`
	OpeningDate    string  `json:"openingDate,omitempty"`
	OpeningMissing bool    `json:"openingMissing"`

	// PrevDate 上一份欠款的日期; PrevIsOpening = true 表示上一份就是初始欠款; DayStart 当天窗口从哪天开始
	PrevDate      string `json:"prevDate,omitempty"`
	PrevIsOpening bool   `json:"prevIsOpening"`
	DayStart      string `json:"dayStart,omitempty"`

	// 当天窗口的充值 / 入账(社区入账) / 入账代收手续费
	Recharge   float64 `json:"recharge"`
	Income     float64 `json:"income"`
	CollectFee float64 `json:"collectFee"`

	PrevManualDebt float64 `json:"prevManualDebt"`
	PrevSystemDebt float64 `json:"prevSystemDebt"`

	// ManualDebtChange 人工增量(当天没记时为 nil); DebtChange 系统增量
	ManualDebtChange *float64 `json:"manualDebtChange"`
	DebtChange       float64  `json:"debtChange"`

	// ManualDebt 当天人工记账里的欠款(RMB, U 已按当天汇率折算), 没记时为 nil; SystemDebt 截至当天的系统欠款
	ManualCurrency string   `json:"manualCurrency,omitempty"`
	ManualAmount   *float64 `json:"manualAmount"`
	ManualDebt     *float64 `json:"manualDebt"`
	SystemDebt     float64  `json:"systemDebt"`

	ManualReceivable *float64 `json:"manualReceivable"`
	SystemReceivable float64  `json:"systemReceivable"`

	// Diff 累计差值 = 人工欠款 − 系统欠款; DayDiff 当天新增差值 = 人工增量 − 系统增量;
	// DiffRatio = Diff ÷ |系统欠款 + 当天入账 + 手续费|
	Diff      *float64 `json:"diff"`
	DayDiff   *float64 `json:"dayDiff"`
	DiffRatio *float64 `json:"diffRatio"`
	Status    string   `json:"status"`
	// Issues 哪里有问题: 缺数据的原因, 或差值的可能来源
	Issues []string `json:"issues"`
}

// DebtCompareTotals 合计, 只算算出了差值的社区(当天记了欠款、且记账日不早于欠款日期).
type DebtCompareTotals struct {
	Recharge         float64 `json:"recharge"`
	Income           float64 `json:"income"`
	CollectFee       float64 `json:"collectFee"`
	PrevManualDebt   float64 `json:"prevManualDebt"`
	PrevSystemDebt   float64 `json:"prevSystemDebt"`
	ManualDebtChange float64 `json:"manualDebtChange"`
	DebtChange       float64 `json:"debtChange"`
	ManualDebt       float64 `json:"manualDebt"`
	SystemDebt       float64 `json:"systemDebt"`
	ManualReceivable float64 `json:"manualReceivable"`
	SystemReceivable float64 `json:"systemReceivable"`
	Diff             float64 `json:"diff"`
	DayDiff          float64 `json:"dayDiff"`
}

// DebtCompareDayDTO 某一份人工记账那天的核对.
type DebtCompareDayDTO struct {
	Date   string              `json:"date"`
	BookID int                 `json:"bookId"`
	Rows   []DebtCompareRowDTO `json:"rows"`
	DebtCompareTotals
	DiffCount int `json:"diffCount"`
	// IssueCount 有问题的社区数(有差异 + 人工未记 + 早于欠款日期)
	IssueCount int `json:"issueCount"`
}

// DebtCompareDTO 欠款核对: 所选区间内每一份人工记账都核对一次, 按日期倒序(最新在前).
type DebtCompareDTO struct {
	StartDate string              `json:"startDate"`
	EndDate   string              `json:"endDate"`
	Days      []DebtCompareDayDTO `json:"days"`
	// DiffDays 有差异的天数
	DiffDays int `json:"diffDays"`
	// Notices 整体层面的提示(比如区间内没有人工记账)
	Notices []string `json:"notices"`
	// Tolerance 差值绝对值不超过它算一致(RMB); MinorRatio 差值比例不超过它算相差较小.
	Tolerance  float64 `json:"tolerance"`
	MinorRatio float64 `json:"minorRatio"`
}
