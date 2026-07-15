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
	Count               int64                        `json:"count"`
	YesterdayCount      int64                        `json:"yesterdayCount"`
	CountChange         int64                        `json:"countChange"`
	CountChangeRate     float64                      `json:"countChangeRate"`
	PendingOrderCount   int64                        `json:"pendingOrderCount"`
	PendingCount        int64                        `json:"pendingCount"`
	TotalOrderCount     int64                        `json:"totalOrderCount"`
	TotalCount          int64                        `json:"totalCount"`
	CompletedOrderCount int64                        `json:"completedOrderCount"`
	CategoryList        []ActualCompletedCategoryDTO `json:"categoryList"`
}

type ActualCompletedCategoryDTO struct {
	ShopCategoryID uint64 `json:"shopCategoryId"`
	Count          int64  `json:"count"`
}
