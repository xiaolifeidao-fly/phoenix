package dto

// ConsumeSummaryDTO follows Kakrolot's dashboard response semantics. Details
// are based on upstream account ledgers, never on Barry manual users.
type ConsumeSummaryDTO struct {
	Amount           float64                   `json:"amount"`
	DetailList       []ConsumeSummaryDetailDTO `json:"detailList"`
	YesterdayAmount  float64                   `json:"yesterdayAmount"`
	AmountChange     float64                   `json:"amountChange"`
	AmountChangeRate float64                   `json:"amountChangeRate"`
}

type ConsumeSummaryDetailDTO struct {
	AccountID     uint64  `json:"accountId"`
	UserID        uint64  `json:"userId"`
	Username      string  `json:"username"`
	Remark        string  `json:"remark"`
	ConsumeAmount float64 `json:"consumeAmount"`
	RefundAmount  float64 `json:"refundAmount"`
	BKAmount      float64 `json:"bkAmount"`
}

type RechargeSummaryDTO struct {
	Amount           float64                    `json:"amount"`
	DetailList       []RechargeSummaryDetailDTO `json:"detailList"`
	YesterdayAmount  float64                    `json:"yesterdayAmount"`
	AmountChange     float64                    `json:"amountChange"`
	AmountChangeRate float64                    `json:"amountChangeRate"`
}

type RechargeSummaryDetailDTO struct {
	AccountID      uint64  `json:"accountId"`
	UserID         uint64  `json:"userId"`
	Username       string  `json:"username"`
	Remark         string  `json:"remark"`
	RechargeAmount float64 `json:"rechargeAmount"`
	GivenAmount    float64 `json:"givenAmount"`
}

type SystemBalanceSummaryDTO struct {
	Amount     float64                         `json:"amount"`
	DetailList []SystemBalanceSummaryDetailDTO `json:"detailList"`
}

type SystemBalanceSummaryDetailDTO struct {
	AccountID     uint64  `json:"accountId"`
	UserID        uint64  `json:"userId"`
	Username      string  `json:"username"`
	Remark        string  `json:"remark"`
	AccountAmount float64 `json:"accountAmount"`
}

type ActualCompletedSummaryDTO struct {
	Count                       int64                        `json:"count"`
	YesterdayCount              int64                        `json:"yesterdayCount"`
	CountChange                 int64                        `json:"countChange"`
	CountChangeRate             float64                      `json:"countChangeRate"`
	PendingOrderCount           int64                        `json:"pendingOrderCount"`
	RecentUninitiatedOrderCount int64                        `json:"recentUninitiatedOrderCount"`
	RemainingOrderCount         int64                        `json:"remainingOrderCount"`
	PendingCount                int64                        `json:"pendingCount"`
	YesterdayPendingCount       int64                        `json:"yesterdayPendingCount"`
	TotalPendingCount           int64                        `json:"totalPendingCount"`
	TotalOrderCount             int64                        `json:"totalOrderCount"`
	TotalCount                  int64                        `json:"totalCount"`
	CompletedOrderCount         int64                        `json:"completedOrderCount"`
	CategoryList                []ActualCompletedCategoryDTO `json:"categoryList"`
}

type ActualCompletedCategoryDTO struct {
	ShopCategoryID        uint64 `json:"shopCategoryId"`
	Count                 int64  `json:"count"`
	PendingCount          int64  `json:"pendingCount"`
	YesterdayPendingCount int64  `json:"yesterdayPendingCount"`
	TotalPendingCount     int64  `json:"totalPendingCount"`
}

// UpstreamDimensionDTO 对账工作台 - 上游维度, 金额均为 RMB, 都取绝对值.
//
// 充值 / 赠送 / 消费 / 退款 / 补款取账户流水(account_detail 的 PAY / GIVEN / CONSUMER / REFUND / BK)按流水时间.
// 消费是毛额(不扣退款、补款), 退款、补款单列, 利润公式里分别扣.
// 返点 / 小费 = 下单数量 × 商品类目返点 / 小费单位金额 − 退单数量 × 同样的单位金额(取类目当前配置).
type UpstreamDimensionDTO struct {
	StartDate      string  `json:"startDate"`
	EndDate        string  `json:"endDate"`
	RechargeAmount float64 `json:"rechargeAmount"`
	GivenAmount    float64 `json:"givenAmount"`
	ConsumeAmount  float64 `json:"consumeAmount"`
	RefundAmount   float64 `json:"refundAmount"`
	BkAmount       float64 `json:"bkAmount"`
	RebateAmount   float64 `json:"rebateAmount"`
	TipAmount      float64 `json:"tipAmount"`
	// 以下为返点 / 小费的拆分, 页面悬停展示用
	OrderNum     int64   `json:"orderNum"`
	RefundNum    int64   `json:"refundNum"`
	OrderRebate  float64 `json:"orderRebate"`
	RefundRebate float64 `json:"refundRebate"`
	OrderTip     float64 `json:"orderTip"`
	RefundTip    float64 `json:"refundTip"`
}
