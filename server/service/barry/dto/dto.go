package dto

import "encoding/json"

type RequestDTO struct {
	RequestID string `json:"requestId,omitempty"`
}

type PageQueryDTO struct {
	Page      int `json:"page,omitempty" form:"page"`
	PageIndex int `json:"pageIndex,omitempty" form:"pageIndex"`
	PageSize  int `json:"pageSize,omitempty" form:"pageSize"`
}

type ListResponseDTO[T any] struct {
	Success bool   `json:"success"`
	Code    string `json:"code,omitempty"`
	Message string `json:"message,omitempty"`
	Data    []*T   `json:"data,omitempty"`
	Total   int    `json:"total,omitempty"`
}

type DetailResponseDTO[T any] struct {
	Success bool   `json:"success"`
	Code    string `json:"code,omitempty"`
	Message string `json:"message,omitempty"`
	Data    *T     `json:"data,omitempty"`
}

type ActionResponseDTO struct {
	Success bool            `json:"success"`
	Code    string          `json:"code,omitempty"`
	Message string          `json:"message,omitempty"`
	Data    json.RawMessage `json:"data,omitempty"`
}

type barryListData[T any] struct {
	List  []*T `json:"list,omitempty"`
	Data  []*T `json:"data,omitempty"`
	Rows  []*T `json:"rows,omitempty"`
	Total int  `json:"total,omitempty"`
}

func normalizeBarrySuccess(success bool, code string) bool {
	return success || code == "0"
}

func decodeBarryListResponse[T any](payload []byte) (success bool, code, message string, total int, data []*T, err error) {
	var wrapped struct {
		Success bool   `json:"success"`
		Code    string `json:"code,omitempty"`
		Message string `json:"message,omitempty"`
		Data    []*T   `json:"data,omitempty"`
		Total   int    `json:"total,omitempty"`
	}
	if err = json.Unmarshal(payload, &wrapped); err == nil && wrapped.Data != nil {
		return normalizeBarrySuccess(wrapped.Success, wrapped.Code), wrapped.Code, wrapped.Message, wrapped.Total, wrapped.Data, nil
	}

	var list []*T
	if err = json.Unmarshal(payload, &list); err == nil {
		return true, "", "", len(list), list, nil
	}

	var wrappedPage struct {
		Success bool             `json:"success"`
		Code    string           `json:"code,omitempty"`
		Message string           `json:"message,omitempty"`
		Data    barryListData[T] `json:"data"`
		Total   int              `json:"total,omitempty"`
	}
	if err = json.Unmarshal(payload, &wrappedPage); err == nil {
		switch {
		case wrappedPage.Data.List != nil:
			return normalizeBarrySuccess(wrappedPage.Success, wrappedPage.Code), wrappedPage.Code, wrappedPage.Message, wrappedPage.Data.Total, wrappedPage.Data.List, nil
		case wrappedPage.Data.Data != nil:
			return normalizeBarrySuccess(wrappedPage.Success, wrappedPage.Code), wrappedPage.Code, wrappedPage.Message, wrappedPage.Data.Total, wrappedPage.Data.Data, nil
		case wrappedPage.Data.Rows != nil:
			return normalizeBarrySuccess(wrappedPage.Success, wrappedPage.Code), wrappedPage.Code, wrappedPage.Message, wrappedPage.Data.Total, wrappedPage.Data.Rows, nil
		}
		if wrappedPage.Total > 0 {
			total = wrappedPage.Total
		}
	}

	var wrappedWithoutData struct {
		Success bool   `json:"success"`
		Code    string `json:"code,omitempty"`
		Message string `json:"message,omitempty"`
	}
	if err = json.Unmarshal(payload, &wrappedWithoutData); err != nil {
		return false, "", "", 0, nil, err
	}
	return normalizeBarrySuccess(wrappedWithoutData.Success, wrappedWithoutData.Code), wrappedWithoutData.Code, wrappedWithoutData.Message, 0, nil, nil
}

func decodeBarryDetailResponse[T any](payload []byte) (success bool, code, message string, data *T, err error) {
	var wrapped struct {
		Success bool   `json:"success"`
		Code    string `json:"code,omitempty"`
		Message string `json:"message,omitempty"`
		Data    *T     `json:"data,omitempty"`
	}
	if err = json.Unmarshal(payload, &wrapped); err == nil && (wrapped.Data != nil || wrapped.Success || wrapped.Code != "" || wrapped.Message != "") {
		return normalizeBarrySuccess(wrapped.Success, wrapped.Code), wrapped.Code, wrapped.Message, wrapped.Data, nil
	}

	var detail T
	if err = json.Unmarshal(payload, &detail); err == nil {
		return true, "", "", &detail, nil
	}

	var successOnly bool
	if err = json.Unmarshal(payload, &successOnly); err == nil {
		return successOnly, "", "", nil, nil
	}

	var wrappedWithoutData struct {
		Success bool   `json:"success"`
		Code    string `json:"code,omitempty"`
		Message string `json:"message,omitempty"`
	}
	if err = json.Unmarshal(payload, &wrappedWithoutData); err != nil {
		return false, "", "", nil, err
	}
	return normalizeBarrySuccess(wrappedWithoutData.Success, wrappedWithoutData.Code), wrappedWithoutData.Code, wrappedWithoutData.Message, nil, nil
}

func decodeBarryActionResponse(payload []byte) (success bool, code, message string, raw json.RawMessage, err error) {
	var wrapped struct {
		Success bool            `json:"success"`
		Code    string          `json:"code,omitempty"`
		Message string          `json:"message,omitempty"`
		Data    json.RawMessage `json:"data,omitempty"`
	}
	if err = json.Unmarshal(payload, &wrapped); err == nil && (wrapped.Success || wrapped.Code != "" || wrapped.Message != "" || wrapped.Data != nil) {
		return normalizeBarrySuccess(wrapped.Success, wrapped.Code), wrapped.Code, wrapped.Message, wrapped.Data, nil
	}

	var successOnly bool
	if err = json.Unmarshal(payload, &successOnly); err == nil {
		return successOnly, "", "", nil, nil
	}
	return false, "", "", nil, err
}

func (dto *ListResponseDTO[T]) UnmarshalJSON(data []byte) error {
	success, code, message, total, list, err := decodeBarryListResponse[T](data)
	if err != nil {
		return err
	}
	dto.Success = success
	dto.Code = code
	dto.Message = message
	dto.Total = total
	dto.Data = list
	return nil
}

func (dto *DetailResponseDTO[T]) UnmarshalJSON(data []byte) error {
	success, code, message, detail, err := decodeBarryDetailResponse[T](data)
	if err != nil {
		return err
	}
	dto.Success = success
	dto.Code = code
	dto.Message = message
	dto.Data = detail
	return nil
}

func (dto *ActionResponseDTO) UnmarshalJSON(data []byte) error {
	success, code, message, raw, err := decodeBarryActionResponse(data)
	if err != nil {
		return err
	}
	dto.Success = success
	dto.Code = code
	dto.Message = message
	dto.Data = raw
	return nil
}

type BarryBaseDTO struct {
	ID          int     `json:"id"`
	CreatedTime string  `json:"createdTime,omitempty"`
	UpdatedTime string  `json:"updatedTime,omitempty"`
	CreatedBy   *string `json:"createdBy,omitempty"`
	UpdatedBy   *string `json:"updatedBy,omitempty"`
	Active      bool    `json:"active"`
}

type ProductTypeDTO struct {
	BarryBaseDTO
	Name         string `json:"name"`
	Code         string `json:"code"`
	Priority     int    `json:"priority,omitempty"`
	AllowGetData bool   `json:"allowGetData,omitempty"`
	Params       any    `json:"params,omitempty"`
	Status       string `json:"status,omitempty"`
	ShopGroupID  int64  `json:"shopGroupId,omitempty"`
}

type ProductTypeQueryDTO struct {
	PageQueryDTO
	RequestDTO
	Code string `json:"code,omitempty" form:"code"`
	Name string `json:"name,omitempty" form:"name"`
}

type ProductTypeListResponseDTO struct {
	Success bool              `json:"success"`
	Code    string            `json:"code,omitempty"`
	Message string            `json:"message,omitempty"`
	Data    []*ProductTypeDTO `json:"data,omitempty"`
}

func (dto *ProductTypeListResponseDTO) UnmarshalJSON(data []byte) error {
	success, code, message, _, list, err := decodeBarryListResponse[ProductTypeDTO](data)
	if err != nil {
		return err
	}
	dto.Success = success
	dto.Code = code
	dto.Message = message
	dto.Data = list
	return nil
}

type ProductCategoryDTO struct {
	BarryBaseDTO
	ShopGroupID       int64             `json:"shopGroupId"`
	Name              string            `json:"name"`
	Code              string            `json:"code"`
	Score             int64             `json:"score"`
	Status            string            `json:"status"`
	ShopTypeModelList []*ProductTypeDTO `json:"shopTypeModelList,omitempty"`
}

type ProductCategoryQueryDTO struct {
	PageQueryDTO
	RequestDTO
	Code         string `json:"code,omitempty" form:"code"`
	Name         string `json:"name,omitempty" form:"name"`
	Status       string `json:"status,omitempty" form:"status"`
	ShopGroupID  int64  `json:"shopGroupId,omitempty" form:"shopGroupId"`
	ShopTypeCode string `json:"shopTypeCode,omitempty" form:"shopTypeCode"`
}

type ProductCategoryListResponseDTO struct {
	Success bool                  `json:"success"`
	Code    string                `json:"code,omitempty"`
	Message string                `json:"message,omitempty"`
	Data    []*ProductCategoryDTO `json:"data,omitempty"`
}

func (dto *ProductCategoryListResponseDTO) UnmarshalJSON(data []byte) error {
	success, code, message, _, list, err := decodeBarryListResponse[ProductCategoryDTO](data)
	if err != nil {
		return err
	}
	dto.Success = success
	dto.Code = code
	dto.Message = message
	dto.Data = list
	return nil
}

type SaveProductCategoryDTO struct {
	ShopGroupID      int64    `json:"shopGroupId"`
	Name             string   `json:"name"`
	Code             string   `json:"code"`
	Score            int64    `json:"score"`
	Status           string   `json:"status"`
	ShopTypeCodeList []string `json:"shopTypeCodeList,omitempty"`
}

type ProductCategoryOperateDTO struct {
	ID int `json:"id"`
}

type ProductCategoryActionResultDTO struct {
	Success bool                `json:"success"`
	Code    string              `json:"code,omitempty"`
	Message string              `json:"message,omitempty"`
	Data    *ProductCategoryDTO `json:"data,omitempty"`
}

func (dto *ProductCategoryActionResultDTO) UnmarshalJSON(data []byte) error {
	success, code, message, detail, err := decodeBarryDetailResponse[ProductCategoryDTO](data)
	if err != nil {
		return err
	}
	dto.Success = success
	dto.Code = code
	dto.Message = message
	dto.Data = detail
	return nil
}

type ChannelDTO struct {
	Code string `json:"code"`
	Name string `json:"name"`
	Type string `json:"type"`
}

type ChannelDetailDTO struct {
	BarryBaseDTO
	Code                    string   `json:"code"`
	Name                    string   `json:"name"`
	Type                    string   `json:"type"`
	TypeDesc                string   `json:"typeDesc,omitempty"`
	RetailerCommissionScale *float64 `json:"retailerCommissionScale,omitempty"`
	MerchantCommissionScale *float64 `json:"merchantCommissionScale,omitempty"`
	AllowAssign             *bool    `json:"allowAssign,omitempty"`
	AssignLimit             *int     `json:"assignLimit,omitempty"`
	Remark                  string   `json:"remark,omitempty"`
}

type ChannelQueryDTO struct {
	PageQueryDTO
	RequestDTO
	Code string `json:"code,omitempty" form:"code"`
	Name string `json:"name,omitempty" form:"name"`
	Type string `json:"type,omitempty" form:"type"`
}

type SaveChannelDetailDTO struct {
	Code                    string   `json:"code" binding:"required"`
	Name                    string   `json:"name" binding:"required"`
	Type                    string   `json:"type" binding:"required"`
	RetailerCommissionScale *float64 `json:"retailerCommissionScale,omitempty"`
	MerchantCommissionScale *float64 `json:"merchantCommissionScale,omitempty"`
	AllowAssign             *bool    `json:"allowAssign,omitempty"`
	AssignLimit             *int     `json:"assignLimit,omitempty"`
	Remark                  string   `json:"remark,omitempty"`
}

type UpdateChannelDetailDTO struct {
	ID                      int      `json:"id" binding:"required"`
	Code                    string   `json:"code" binding:"required"`
	Name                    string   `json:"name" binding:"required"`
	Type                    string   `json:"type" binding:"required"`
	RetailerCommissionScale *float64 `json:"retailerCommissionScale,omitempty"`
	MerchantCommissionScale *float64 `json:"merchantCommissionScale,omitempty"`
	AllowAssign             *bool    `json:"allowAssign,omitempty"`
	AssignLimit             *int     `json:"assignLimit,omitempty"`
	Remark                  string   `json:"remark,omitempty"`
}

type UserPointDTO struct {
	UserID        string `json:"userId"`
	PointBalance  string `json:"pointBalance"`
	FrozenPoints  string `json:"frozenPoints"`
	AvailableTime string `json:"availableTime,omitempty"`
}

type UserPointQueryDTO struct {
	PageQueryDTO
	RequestDTO
	UserID   string `json:"userId,omitempty" form:"userId"`
	Username string `json:"username,omitempty" form:"username"`
}

type UserDTO struct {
	UserID   string `json:"userId"`
	Username string `json:"username"`
	Name     string `json:"name"`
	Phone    string `json:"phone,omitempty"`
	Status   string `json:"status,omitempty"`
}

type UserQueryDTO struct {
	PageQueryDTO
	RequestDTO
	UserID   string `json:"userId,omitempty" form:"userId"`
	Username string `json:"username,omitempty" form:"username"`
	Name     string `json:"name,omitempty" form:"name"`
	Phone    string `json:"phone,omitempty" form:"phone"`
	Status   string `json:"status,omitempty" form:"status"`
}

type PointWithdrawDTO struct {
	WithdrawID string `json:"withdrawId"`
	UserID     string `json:"userId"`
	Points     string `json:"points"`
	Status     string `json:"status"`
	CreatedAt  string `json:"createdAt,omitempty"`
}

type PointWithdrawQueryDTO struct {
	PageQueryDTO
	RequestDTO
	WithdrawID string `json:"withdrawId,omitempty" form:"withdrawId"`
	UserID     string `json:"userId,omitempty" form:"userId"`
	Status     string `json:"status,omitempty" form:"status"`
}

type EntryDTO struct {
	EntryID    string `json:"entryId"`
	OrderNo    string `json:"orderNo,omitempty"`
	UserID     string `json:"userId,omitempty"`
	Status     string `json:"status,omitempty"`
	OccurredAt string `json:"occurredAt,omitempty"`
}

type EntryQueryDTO struct {
	PageQueryDTO
	RequestDTO
	EntryID  string `json:"entryId,omitempty" form:"entryId"`
	OrderNo  string `json:"orderNo,omitempty" form:"orderNo"`
	UserID   string `json:"userId,omitempty" form:"userId"`
	Status   string `json:"status,omitempty" form:"status"`
	StartAt  string `json:"startAt,omitempty" form:"startAt"`
	EndAt    string `json:"endAt,omitempty" form:"endAt"`
	Channel  string `json:"channel,omitempty" form:"channel"`
	ShopCode string `json:"shopCode,omitempty" form:"shopCode"`
}

type ReturnDTO struct {
	ReturnID   string `json:"returnId"`
	OrderNo    string `json:"orderNo,omitempty"`
	UserID     string `json:"userId,omitempty"`
	Status     string `json:"status,omitempty"`
	OccurredAt string `json:"occurredAt,omitempty"`
}

type ReturnQueryDTO struct {
	PageQueryDTO
	RequestDTO
	ReturnID string `json:"returnId,omitempty" form:"returnId"`
	OrderNo  string `json:"orderNo,omitempty" form:"orderNo"`
	UserID   string `json:"userId,omitempty" form:"userId"`
	Status   string `json:"status,omitempty" form:"status"`
	StartAt  string `json:"startAt,omitempty" form:"startAt"`
	EndAt    string `json:"endAt,omitempty" form:"endAt"`
}

type OrderSummaryDTO struct {
	OrderNo         string `json:"orderNo"`
	UserID          string `json:"userId,omitempty"`
	ProductCode     string `json:"productCode,omitempty"`
	ProductName     string `json:"productName,omitempty"`
	OrderAmount     string `json:"orderAmount,omitempty"`
	OrderStatus     string `json:"orderStatus,omitempty"`
	FinishedAt      string `json:"finishedAt,omitempty"`
	ChannelCode     string `json:"channelCode,omitempty"`
	CategoryCode    string `json:"categoryCode,omitempty"`
	ProductTypeCode string `json:"productTypeCode,omitempty"`
}

type OrderSummaryQueryDTO struct {
	PageQueryDTO
	RequestDTO
	OrderNo         string `json:"orderNo,omitempty" form:"orderNo"`
	UserID          string `json:"userId,omitempty" form:"userId"`
	OrderStatus     string `json:"orderStatus,omitempty" form:"orderStatus"`
	ProductCode     string `json:"productCode,omitempty" form:"productCode"`
	ChannelCode     string `json:"channelCode,omitempty" form:"channelCode"`
	CategoryCode    string `json:"categoryCode,omitempty" form:"categoryCode"`
	ProductTypeCode string `json:"productTypeCode,omitempty" form:"productTypeCode"`
	StartAt         string `json:"startAt,omitempty" form:"startAt"`
	EndAt           string `json:"endAt,omitempty" form:"endAt"`
}
