package dto

import baseDTO "common/base/dto"

import "time"

type OrderAmountDetailDTO struct {
	baseDTO.BaseDTO
	OrderID             uint64 `json:"orderId"`
	OrderConsumerAmount string `json:"orderConsumerAmount"`
	Description         string `json:"description"`
}

type CreateOrderAmountDetailDTO = OrderAmountDetailDTO
type UpdateOrderAmountDetailDTO struct {
	OrderID             *uint64 `json:"orderId,omitempty"`
	OrderConsumerAmount *string `json:"orderConsumerAmount,omitempty"`
	Description         *string `json:"description,omitempty"`
}

type OrderAmountDetailQueryDTO struct {
	Page      int    `form:"page"`
	PageIndex int    `form:"pageIndex"`
	PageSize  int    `form:"pageSize"`
	OrderID   uint64 `form:"orderId"`
}

type OrderBkRecordDTO struct {
	baseDTO.BaseDTO
	TenantID       uint64 `json:"tenantId"`
	OrderID        uint64 `json:"orderId"`
	Amount         string `json:"amount"`
	Num            uint64 `json:"num"`
	ShopCategoryID uint64 `json:"shopCategoryId"`
	ShopID         uint64 `json:"shopId"`
}

type CreateOrderBkRecordDTO = OrderBkRecordDTO
type UpdateOrderBkRecordDTO struct {
	TenantID       *uint64 `json:"tenantId,omitempty"`
	OrderID        *uint64 `json:"orderId,omitempty"`
	Amount         *string `json:"amount,omitempty"`
	Num            *uint64 `json:"num,omitempty"`
	ShopCategoryID *uint64 `json:"shopCategoryId,omitempty"`
	ShopID         *uint64 `json:"shopId,omitempty"`
}

type OrderBkRecordQueryDTO struct {
	Page      int    `form:"page"`
	PageIndex int    `form:"pageIndex"`
	PageSize  int    `form:"pageSize"`
	TenantID  uint64 `form:"tenantId"`
	OrderID   uint64 `form:"orderId"`
}

type OrderRecordDTO struct {
	baseDTO.BaseDTO
	TenantID              uint64 `json:"tenantId"`
	ShopID                uint64 `json:"shopId"`
	ShopName              string `json:"shopName"`
	ShopCategoryID        uint64 `json:"shopCategoryId"`
	ShopCategoryName      string `json:"shopCategoryName"`
	InitNum               uint64 `json:"initNum"`
	EndNum                uint64 `json:"endNum"`
	OrderStatus           string `json:"orderStatus"`
	OrderNum              int64  `json:"orderNum"`
	OrderAmount           string `json:"orderAmount"`
	UserID                uint64 `json:"userId"`
	Price                 string `json:"price"`
	Description           string `json:"description"`
	BusinessID            string `json:"businessId"`
	TenantName            string `json:"tenantName"`
	UserName              string `json:"userName"`
	TinyURL               string `json:"tinyUrl"`
	OrderHash             string `json:"orderHash"`
	Channel               string `json:"channel"`
	ExternalOrderRecordID uint64 `json:"externalOrderRecordId"`
	ExternalOrderID       string `json:"externalOrderId"`
	ExternalOrderPrice    string `json:"externalOrderPrice"`
	ExternalOrderAmount   string `json:"externalOrderAmount"`
	OrderAssignNum        int    `json:"orderAssignNum"`
	OrderSubmitNum        int    `json:"orderSubmitNum"`
	BusinessKey           string `json:"businessKey"`
	AssignFinishTimes     int    `json:"assignFinishTimes"`
	IsAbnormal            bool   `json:"isAbnormal"`
	ExceptionReason       string `json:"exceptionReason"`
}

type CreateOrderRecordDTO = OrderRecordDTO
type UpdateOrderRecordDTO struct {
	TenantID              *uint64 `json:"tenantId,omitempty"`
	ShopID                *uint64 `json:"shopId,omitempty"`
	ShopName              *string `json:"shopName,omitempty"`
	ShopCategoryID        *uint64 `json:"shopCategoryId,omitempty"`
	ShopCategoryName      *string `json:"shopCategoryName,omitempty"`
	InitNum               *uint64 `json:"initNum,omitempty"`
	EndNum                *uint64 `json:"endNum,omitempty"`
	OrderStatus           *string `json:"orderStatus,omitempty"`
	OrderNum              *int64  `json:"orderNum,omitempty"`
	OrderAmount           *string `json:"orderAmount,omitempty"`
	UserID                *uint64 `json:"userId,omitempty"`
	Price                 *string `json:"price,omitempty"`
	Description           *string `json:"description,omitempty"`
	BusinessID            *string `json:"businessId,omitempty"`
	TenantName            *string `json:"tenantName,omitempty"`
	UserName              *string `json:"userName,omitempty"`
	TinyURL               *string `json:"tinyUrl,omitempty"`
	OrderHash             *string `json:"orderHash,omitempty"`
	Channel               *string `json:"channel,omitempty"`
	ExternalOrderRecordID *uint64 `json:"externalOrderRecordId,omitempty"`
	ExternalOrderID       *string `json:"externalOrderId,omitempty"`
	ExternalOrderPrice    *string `json:"externalOrderPrice,omitempty"`
	ExternalOrderAmount   *string `json:"externalOrderAmount,omitempty"`
	OrderAssignNum        *int    `json:"orderAssignNum,omitempty"`
	OrderSubmitNum        *int    `json:"orderSubmitNum,omitempty"`
	BusinessKey           *string `json:"businessKey,omitempty"`
	AssignFinishTimes     *int    `json:"assignFinishTimes,omitempty"`
}

type OrderRecordQueryDTO struct {
	Page           int    `form:"page"`
	PageIndex      int    `form:"pageIndex"`
	PageSize       int    `form:"pageSize"`
	OrderID        uint64 `form:"orderId"`
	TenantID       uint64 `form:"tenantId"`
	ShopID         uint64 `form:"shopId"`
	ShopCategoryID uint64 `form:"shopCategoryId"`
	// 多选类目，逗号分隔；为空时回退到 ShopCategoryID，两者都为空表示查全部
	ShopCategoryIDs string `form:"shopCategoryIds"`
	UserID          uint64 `form:"userId"`
	OrderStatus     string `form:"orderStatus"`
	// 多选状态，逗号分隔；为空时回退到 OrderStatus
	OrderStatuses   string `form:"orderStatuses"`
	OrderHash       string `form:"orderHash"`
	BusinessID      string `form:"businessId"`
	BusinessKey     string `form:"businessKey"`
	ExternalOrderID string `form:"externalOrderId"`
	UserName        string `form:"userName"`
	Channel         string `form:"channel"`
	StartTime       string `form:"startTime"`
	EndTime         string `form:"endTime"`
	AbnormalOnly    bool   `form:"abnormalOnly"`
	// 提交率（%）区间：order_submit_num / order_assign_num
	SubmitRateMin *float64 `form:"submitRateMin"`
	SubmitRateMax *float64 `form:"submitRateMax"`
	// 上量率（%）区间：(end_num - init_num) / order_assign_num
	GrowthRateMin *float64 `form:"growthRateMin"`
	GrowthRateMax *float64 `form:"growthRateMax"`
	// 分发轮次区间：assign_finish_times
	AssignFinishTimesMin *int `form:"assignFinishTimesMin"`
	AssignFinishTimesMax *int `form:"assignFinishTimesMax"`
}

// MarkOrderExceptionDTO 订单异常打标请求，reason 为空时由 kakrolot 生成默认原因
type MarkOrderExceptionDTO struct {
	Reason string `json:"reason"`
}

// BatchMarkOrderExceptionDTO 批量异常打标请求
type BatchMarkOrderExceptionDTO struct {
	OrderIDs []uint `json:"orderIds"`
	Reason   string `json:"reason"`
}

// BatchRefundOrderDTO 批量退单请求
type BatchRefundOrderDTO struct {
	OrderIDs []uint `json:"orderIds"`
}

// ForceFinishOrderDTO 强制完成请求（单笔与批量共用）
type ForceFinishOrderDTO struct {
	OrderIDs []uint `json:"orderIds"`
}

// OrderActionFailureDTO 批量操作中单笔订单的失败原因
type OrderActionFailureDTO struct {
	OrderID uint64 `json:"orderId"`
	Message string `json:"message"`
}

// OrderActionBatchResultDTO 批量操作结果（批量退单、批量异常打标共用）
type OrderActionBatchResultDTO struct {
	Succeeded int                     `json:"succeeded"`
	Failed    int                     `json:"failed"`
	Failures  []OrderActionFailureDTO `json:"failures"`
}

type RefundBatchTaskDTO struct {
	ID             uint64    `json:"id"`
	TaskName       string    `json:"taskName"`
	TotalCount     int       `json:"totalCount"`
	SuccessCount   int       `json:"successCount"`
	FailCount      int       `json:"failCount"`
	PendingCount   int       `json:"pendingCount"`
	TaskStatus     string    `json:"taskStatus"`
	TaskStatusDesc string    `json:"taskStatusDesc"`
	UploadFileName string    `json:"uploadFileName"`
	CreatedAt      time.Time `json:"createdAt"`
	UpdatedAt      time.Time `json:"updatedAt"`
}

type RefundBatchDetailDTO struct {
	ID               uint64     `json:"id"`
	TaskID           uint64     `json:"taskId"`
	TinyURL          string     `json:"tinyUrl"`
	OrderRecordID    uint64     `json:"orderRecordId"`
	OrderCreateTime  *time.Time `json:"orderCreateTime"`
	InitNum          uint64     `json:"initNum"`
	EndNum           uint64     `json:"endNum"`
	FactEndNum       uint64     `json:"factEndNum"`
	OrderNum         int64      `json:"orderNum"`
	ActualQuantity   uint64     `json:"actualQuantity"`
	RGApproveNum     uint64     `json:"rgApproveNum"`
	RGUnApproveNum   uint64     `json:"rgUnApproveNum"`
	BkNum            uint64     `json:"bkNum"`
	DetailStatus     string     `json:"detailStatus"`
	DetailStatusDesc string     `json:"detailStatusDesc"`
	ErrorReason      string     `json:"errorReason"`
	ProcessedAt      *time.Time `json:"processedAt"`
	CreatedAt        time.Time  `json:"createdAt"`
	UpdatedAt        time.Time  `json:"updatedAt"`
}

type RefundBatchTaskQueryDTO struct {
	PageIndex  int    `form:"pageIndex"`
	PageSize   int    `form:"pageSize"`
	TaskID     uint64 `form:"taskId"`
	TaskStatus string `form:"taskStatus"`
}

type RefundBatchDetailQueryDTO struct {
	PageIndex     int    `form:"pageIndex"`
	PageSize      int    `form:"pageSize"`
	TaskID        uint64 `form:"taskId"`
	OrderRecordID uint64 `form:"orderRecordId"`
	TinyURL       string `form:"tinyUrl"`
}

type CreateRefundBatchDTO struct {
	TaskName string `json:"taskName"`
	TinyURLs string `json:"tinyUrls"`
}

// BkOrderRequestDTO 订单补款请求
type BkOrderRequestDTO struct {
	Num uint64 `json:"num"`
}

type OrderRefundRecordDTO struct {
	baseDTO.BaseDTO
	TenantID          uint64 `json:"tenantId"`
	OrderID           uint64 `json:"orderId"`
	RefundAmount      string `json:"refundAmount"`
	ShopCategoryID    uint64 `json:"shopCategoryId"`
	RefundNum         uint64 `json:"refundNum"`
	OrderRefundStatus string `json:"orderRefundStatus"`
}

type CreateOrderRefundRecordDTO = OrderRefundRecordDTO
type UpdateOrderRefundRecordDTO struct {
	TenantID          *uint64 `json:"tenantId,omitempty"`
	OrderID           *uint64 `json:"orderId,omitempty"`
	RefundAmount      *string `json:"refundAmount,omitempty"`
	ShopCategoryID    *uint64 `json:"shopCategoryId,omitempty"`
	RefundNum         *uint64 `json:"refundNum,omitempty"`
	OrderRefundStatus *string `json:"orderRefundStatus,omitempty"`
}

type OrderRefundRecordQueryDTO struct {
	Page              int    `form:"page"`
	PageIndex         int    `form:"pageIndex"`
	PageSize          int    `form:"pageSize"`
	TenantID          uint64 `form:"tenantId"`
	OrderID           uint64 `form:"orderId"`
	OrderRefundStatus string `form:"orderRefundStatus"`
}
