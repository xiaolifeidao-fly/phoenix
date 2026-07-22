package dto

import (
	"encoding/json"
	"strings"
)

type StringID string

func (id *StringID) UnmarshalJSON(data []byte) error {
	value := strings.TrimSpace(string(data))
	if value == "" || value == "null" {
		*id = ""
		return nil
	}
	if strings.HasPrefix(value, "\"") {
		var text string
		if err := json.Unmarshal(data, &text); err != nil {
			return err
		}
		*id = StringID(text)
		return nil
	}
	var number json.Number
	if err := json.Unmarshal(data, &number); err != nil {
		return err
	}
	*id = StringID(number.String())
	return nil
}

func (id StringID) MarshalJSON() ([]byte, error) {
	return json.Marshal(string(id))
}

func (id StringID) String() string {
	return string(id)
}

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

func barryMessage(message, errorMessage string) string {
	if message != "" {
		return message
	}
	return errorMessage
}

func decodeBarryListResponse[T any](payload []byte) (success bool, code, message string, total int, data []*T, err error) {
	var wrapped struct {
		Success  bool   `json:"success"`
		Code     string `json:"code,omitempty"`
		Message  string `json:"message,omitempty"`
		ErrorMsg string `json:"errorMsg,omitempty"`
		Data     []*T   `json:"data,omitempty"`
		Total    int    `json:"total,omitempty"`
	}
	if err = json.Unmarshal(payload, &wrapped); err == nil && wrapped.Data != nil {
		return normalizeBarrySuccess(wrapped.Success, wrapped.Code), wrapped.Code, barryMessage(wrapped.Message, wrapped.ErrorMsg), wrapped.Total, wrapped.Data, nil
	}

	var list []*T
	if err = json.Unmarshal(payload, &list); err == nil {
		return true, "", "", len(list), list, nil
	}

	var wrappedPage struct {
		Success  bool             `json:"success"`
		Code     string           `json:"code,omitempty"`
		Message  string           `json:"message,omitempty"`
		ErrorMsg string           `json:"errorMsg,omitempty"`
		Data     barryListData[T] `json:"data"`
		Total    int              `json:"total,omitempty"`
	}
	if err = json.Unmarshal(payload, &wrappedPage); err == nil {
		switch {
		case wrappedPage.Data.List != nil:
			return normalizeBarrySuccess(wrappedPage.Success, wrappedPage.Code), wrappedPage.Code, barryMessage(wrappedPage.Message, wrappedPage.ErrorMsg), wrappedPage.Data.Total, wrappedPage.Data.List, nil
		case wrappedPage.Data.Data != nil:
			return normalizeBarrySuccess(wrappedPage.Success, wrappedPage.Code), wrappedPage.Code, barryMessage(wrappedPage.Message, wrappedPage.ErrorMsg), wrappedPage.Data.Total, wrappedPage.Data.Data, nil
		case wrappedPage.Data.Rows != nil:
			return normalizeBarrySuccess(wrappedPage.Success, wrappedPage.Code), wrappedPage.Code, barryMessage(wrappedPage.Message, wrappedPage.ErrorMsg), wrappedPage.Data.Total, wrappedPage.Data.Rows, nil
		}
		if wrappedPage.Total > 0 {
			total = wrappedPage.Total
		}
	}

	var wrappedWithoutData struct {
		Success  bool   `json:"success"`
		Code     string `json:"code,omitempty"`
		Message  string `json:"message,omitempty"`
		ErrorMsg string `json:"errorMsg,omitempty"`
	}
	if err = json.Unmarshal(payload, &wrappedWithoutData); err != nil {
		return false, "", "", 0, nil, err
	}
	return normalizeBarrySuccess(wrappedWithoutData.Success, wrappedWithoutData.Code), wrappedWithoutData.Code, barryMessage(wrappedWithoutData.Message, wrappedWithoutData.ErrorMsg), 0, nil, nil
}

func decodeBarryDetailResponse[T any](payload []byte) (success bool, code, message string, data *T, err error) {
	var wrapped struct {
		Success  bool   `json:"success"`
		Code     string `json:"code,omitempty"`
		Message  string `json:"message,omitempty"`
		ErrorMsg string `json:"errorMsg,omitempty"`
		Data     *T     `json:"data,omitempty"`
	}
	if err = json.Unmarshal(payload, &wrapped); err == nil && (wrapped.Data != nil || wrapped.Success || wrapped.Code != "" || wrapped.Message != "" || wrapped.ErrorMsg != "") {
		return normalizeBarrySuccess(wrapped.Success, wrapped.Code), wrapped.Code, barryMessage(wrapped.Message, wrapped.ErrorMsg), wrapped.Data, nil
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
		Success  bool   `json:"success"`
		Code     string `json:"code,omitempty"`
		Message  string `json:"message,omitempty"`
		ErrorMsg string `json:"errorMsg,omitempty"`
	}
	if err = json.Unmarshal(payload, &wrappedWithoutData); err != nil {
		return false, "", "", nil, err
	}
	return normalizeBarrySuccess(wrappedWithoutData.Success, wrappedWithoutData.Code), wrappedWithoutData.Code, barryMessage(wrappedWithoutData.Message, wrappedWithoutData.ErrorMsg), nil, nil
}

func decodeBarryActionResponse(payload []byte) (success bool, code, message string, raw json.RawMessage, err error) {
	var wrapped struct {
		Success  bool            `json:"success"`
		Code     string          `json:"code,omitempty"`
		Message  string          `json:"message,omitempty"`
		ErrorMsg string          `json:"errorMsg,omitempty"`
		Data     json.RawMessage `json:"data,omitempty"`
	}
	if err = json.Unmarshal(payload, &wrapped); err == nil && (wrapped.Success || wrapped.Code != "" || wrapped.Message != "" || wrapped.ErrorMsg != "" || wrapped.Data != nil) {
		return normalizeBarrySuccess(wrapped.Success, wrapped.Code), wrapped.Code, barryMessage(wrapped.Message, wrapped.ErrorMsg), wrapped.Data, nil
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
	ID                int               `json:"id,omitempty"`
	ShopGroupID       int64             `json:"shopGroupId"`
	Name              string            `json:"name"`
	Code              string            `json:"code"`
	Score             int64             `json:"score"`
	Status            string            `json:"status"`
	ShopTypeCodeList  []string          `json:"shopTypeCodeList,omitempty"`
	ShopTypeModelList []*ProductTypeDTO `json:"shopTypeModelList,omitempty"`
}

type ProductCategoryOperateDTO struct {
	ID int `json:"id"`
}

type ProductCategoryActionResultDTO struct {
	Success bool            `json:"success"`
	Code    string          `json:"code,omitempty"`
	Message string          `json:"message,omitempty"`
	Data    json.RawMessage `json:"data,omitempty"`
}

func (dto *ProductCategoryActionResultDTO) UnmarshalJSON(data []byte) error {
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

type AssignConfigDTO struct {
	BarryBaseDTO
	QueueCode       string   `json:"queueCode"`
	ShopTypeID      int      `json:"shopTypeId"`
	QueueSize       int      `json:"queueSize"`
	LoopNum         int      `json:"loopNum"`
	AssignScale     *float64 `json:"assignScale,omitempty"`
	ExpireTimes     int      `json:"expireTimes"`
	AssignModel     string   `json:"assignModel"`
	StrategyName    string   `json:"strategyName"`
	AssignRiskTimes int      `json:"assignRiskTimes,omitempty"`
	AssignRiskScale *float64 `json:"assignRiskScale,omitempty"`
	AssignType      string   `json:"assignType,omitempty"`
	SpeedByHour     int      `json:"speedByHour,omitempty"`
	AssignNum       int      `json:"assignNum,omitempty"`
	BatchAssignNum  int      `json:"batchAssignNum,omitempty"`
	MonitorOrder    *bool    `json:"monitorOrder,omitempty"`
	CheckNowNum     *bool    `json:"checkNowNum,omitempty"`
	TodayDistinct   *bool    `json:"todayDistinct,omitempty"`
}

type AssignConfigQueryDTO struct {
	RequestDTO
	ShopTypeID int `json:"shopTypeId,omitempty" form:"shopTypeId"`
}

type SaveAssignConfigDTO struct {
	ID              int      `json:"id,omitempty"`
	QueueCode       string   `json:"queueCode"`
	ShopTypeID      int      `json:"shopTypeId"`
	QueueSize       int      `json:"queueSize"`
	LoopNum         int      `json:"loopNum"`
	AssignScale     *float64 `json:"assignScale,omitempty"`
	ExpireTimes     int      `json:"expireTimes"`
	AssignModel     string   `json:"assignModel"`
	StrategyName    string   `json:"strategyName"`
	AssignRiskTimes int      `json:"assignRiskTimes,omitempty"`
	AssignRiskScale *float64 `json:"assignRiskScale,omitempty"`
	AssignType      string   `json:"assignType,omitempty"`
	SpeedByHour     int      `json:"speedByHour,omitempty"`
	AssignNum       int      `json:"assignNum,omitempty"`
	BatchAssignNum  int      `json:"batchAssignNum,omitempty"`
	MonitorOrder    *bool    `json:"monitorOrder,omitempty"`
	CheckNowNum     *bool    `json:"checkNowNum,omitempty"`
	TodayDistinct   *bool    `json:"todayDistinct,omitempty"`
}

type AssignConfigListResponseDTO struct {
	Success bool               `json:"success"`
	Code    string             `json:"code,omitempty"`
	Message string             `json:"message,omitempty"`
	Data    []*AssignConfigDTO `json:"data,omitempty"`
}

func (dto *AssignConfigListResponseDTO) UnmarshalJSON(data []byte) error {
	success, code, message, _, list, err := decodeBarryListResponse[AssignConfigDTO](data)
	if err != nil {
		return err
	}
	dto.Success = success
	dto.Code = code
	dto.Message = message
	dto.Data = list
	return nil
}

type AssignConfigActionResultDTO struct {
	Success bool             `json:"success"`
	Code    string           `json:"code,omitempty"`
	Message string           `json:"message,omitempty"`
	Data    *AssignConfigDTO `json:"data,omitempty"`
}

func (dto *AssignConfigActionResultDTO) UnmarshalJSON(data []byte) error {
	success, code, message, detail, err := decodeBarryDetailResponse[AssignConfigDTO](data)
	if err != nil {
		return err
	}
	dto.Success = success
	dto.Code = code
	dto.Message = message
	dto.Data = detail
	return nil
}

type JudgeConfigDTO struct {
	BarryBaseDTO
	ShopTypeID           int    `json:"shopTypeId"`
	JudgeType            string `json:"judgeType,omitempty"`
	AgainJudgeType       string `json:"againJudgeType,omitempty"`
	AgainJudgeFlag       *bool  `json:"againJudgeFlag,omitempty"`
	AgainJudgeDelayTimes int    `json:"againJudgeDelayTimes"`
	AssignConfigID       int    `json:"assignConfigId,omitempty"`
}

type JudgeConfigQueryDTO struct {
	RequestDTO
	ShopTypeID int `json:"shopTypeId,omitempty" form:"shopTypeId"`
}

type SaveJudgeConfigDTO struct {
	ID                   int    `json:"id,omitempty"`
	ShopTypeID           int    `json:"shopTypeId"`
	JudgeType            string `json:"judgeType"`
	AgainJudgeType       string `json:"againJudgeType,omitempty"`
	AgainJudgeFlag       *bool  `json:"againJudgeFlag"`
	AgainJudgeDelayTimes int    `json:"againJudgeDelayTimes"`
	AssignConfigID       int    `json:"assignConfigId"`
}

type JudgeConfigListResponseDTO struct {
	Success bool              `json:"success"`
	Code    string            `json:"code,omitempty"`
	Message string            `json:"message,omitempty"`
	Data    []*JudgeConfigDTO `json:"data,omitempty"`
}

func (dto *JudgeConfigListResponseDTO) UnmarshalJSON(data []byte) error {
	success, code, message, _, list, err := decodeBarryListResponse[JudgeConfigDTO](data)
	if err != nil {
		return err
	}
	dto.Success = success
	dto.Code = code
	dto.Message = message
	dto.Data = list
	return nil
}

type JudgeConfigActionResultDTO struct {
	Success bool            `json:"success"`
	Code    string          `json:"code,omitempty"`
	Message string          `json:"message,omitempty"`
	Data    *JudgeConfigDTO `json:"data,omitempty"`
}

func (dto *JudgeConfigActionResultDTO) UnmarshalJSON(data []byte) error {
	success, code, message, detail, err := decodeBarryDetailResponse[JudgeConfigDTO](data)
	if err != nil {
		return err
	}
	dto.Success = success
	dto.Code = code
	dto.Message = message
	dto.Data = detail
	return nil
}

// AssignUidRuleDTO 分配策略-uid(投稿账号)维度过滤规则, 按品类(shopCategoryId)维护, user 域.
type AssignUidRuleDTO struct {
	BarryBaseDTO
	ShopCategoryID  int64    `json:"shopCategoryId"`
	Enabled         bool     `json:"enabled"`
	MinFansNum      int64    `json:"minFansNum"`
	MinItemNum      int64    `json:"minItemNum"`
	MinInteractRate *float64 `json:"minInteractRate,omitempty"`
}

type AssignUidRuleQueryDTO struct {
	RequestDTO
	ShopCategoryID int64 `json:"shopCategoryId,omitempty" form:"shopCategoryId"`
}

type SaveAssignUidRuleDTO struct {
	ID              int      `json:"id,omitempty"`
	ShopCategoryID  int64    `json:"shopCategoryId"`
	Enabled         bool     `json:"enabled"`
	MinFansNum      int64    `json:"minFansNum"`
	MinItemNum      int64    `json:"minItemNum"`
	MinInteractRate *float64 `json:"minInteractRate,omitempty"`
}

// AssignVideoRuleDTO 分配策略-视频(候选任务)维度过滤规则, 按品类(shopCategoryId)维护, shop 域.
type AssignVideoRuleDTO struct {
	BarryBaseDTO
	ShopCategoryID     int64  `json:"shopCategoryId"`
	Enabled            bool   `json:"enabled"`
	URLFilterEnabled   bool   `json:"urlFilterEnabled"`
	URLKeywords        string `json:"urlKeywords,omitempty"`
	URLIncludeEnabled  bool   `json:"urlIncludeEnabled"`
	URLIncludeKeywords string `json:"urlIncludeKeywords,omitempty"`
	AdFilterEnabled    bool   `json:"adFilterEnabled"`
}

type AssignVideoRuleQueryDTO struct {
	RequestDTO
	ShopCategoryID int64 `json:"shopCategoryId,omitempty" form:"shopCategoryId"`
}

type SaveAssignVideoRuleDTO struct {
	ID                 int    `json:"id,omitempty"`
	ShopCategoryID     int64  `json:"shopCategoryId"`
	Enabled            bool   `json:"enabled"`
	URLFilterEnabled   bool   `json:"urlFilterEnabled"`
	URLKeywords        string `json:"urlKeywords,omitempty"`
	URLIncludeEnabled  bool   `json:"urlIncludeEnabled"`
	URLIncludeKeywords string `json:"urlIncludeKeywords,omitempty"`
	AdFilterEnabled    bool   `json:"adFilterEnabled"`
}

// AssignRefundRuleDTO 分配策略-退单维度规则(按分发轮次判断退单/异常打标), 按品类(shopCategoryId)维护, shop 域.
type AssignRefundRuleDTO struct {
	BarryBaseDTO
	ShopCategoryID          int64 `json:"shopCategoryId"`
	Enabled                 bool  `json:"enabled"`
	RefundRoundThreshold    int64 `json:"refundRoundThreshold"`
	ExceptionRoundThreshold int64 `json:"exceptionRoundThreshold"`
}

type AssignRefundRuleQueryDTO struct {
	RequestDTO
	ShopCategoryID int64 `json:"shopCategoryId,omitempty" form:"shopCategoryId"`
}

type SaveAssignRefundRuleDTO struct {
	ID                      int   `json:"id,omitempty"`
	ShopCategoryID          int64 `json:"shopCategoryId"`
	Enabled                 bool  `json:"enabled"`
	RefundRoundThreshold    int64 `json:"refundRoundThreshold"`
	ExceptionRoundThreshold int64 `json:"exceptionRoundThreshold"`
}

// AssignVideoUserRuleDTO 分配策略-指定用户的视频维度过滤规则(覆盖品类全局视频规则), 按(shopCategoryId,userId)维护, user 域.
type AssignVideoUserRuleDTO struct {
	BarryBaseDTO
	ShopCategoryID     int64  `json:"shopCategoryId"`
	UserID             int64  `json:"userId"`
	Username           string `json:"username,omitempty"`
	URLFilterEnabled   bool   `json:"urlFilterEnabled"`
	URLKeywords        string `json:"urlKeywords,omitempty"`
	URLIncludeEnabled  bool   `json:"urlIncludeEnabled"`
	URLIncludeKeywords string `json:"urlIncludeKeywords,omitempty"`
	AdFilterEnabled    bool   `json:"adFilterEnabled"`
}

type AssignVideoUserRuleQueryDTO struct {
	RequestDTO
	ShopCategoryID int64 `json:"shopCategoryId,omitempty" form:"shopCategoryId"`
}

type SaveAssignVideoUserRuleDTO struct {
	ID                 int    `json:"id,omitempty"`
	ShopCategoryID     int64  `json:"shopCategoryId"`
	UserID             int64  `json:"userId"`
	URLFilterEnabled   bool   `json:"urlFilterEnabled"`
	URLKeywords        string `json:"urlKeywords,omitempty"`
	URLIncludeEnabled  bool   `json:"urlIncludeEnabled"`
	URLIncludeKeywords string `json:"urlIncludeKeywords,omitempty"`
	AdFilterEnabled    bool   `json:"adFilterEnabled"`
}

type DeleteAssignVideoUserRuleDTO struct {
	ShopCategoryID int64 `json:"shopCategoryId" form:"shopCategoryId"`
	UserID         int64 `json:"userId" form:"userId"`
}

// AssignSwitchQueryDTO 分配策略维度总开关查询(白名单/uid), 按品类.
type AssignSwitchQueryDTO struct {
	RequestDTO
	ShopCategoryID int64 `json:"shopCategoryId,omitempty" form:"shopCategoryId"`
}

// SaveAssignSwitchDTO 开/关某品类的维度总开关. enabled=true 开(插入), false 关(删除).
type SaveAssignSwitchDTO struct {
	ShopCategoryID int64 `json:"shopCategoryId"`
	Enabled        bool  `json:"enabled"`
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
	UserID         StringID `json:"userId"`
	Username       string   `json:"username"`
	Channel        string   `json:"channel,omitempty"`
	Name           string   `json:"name"`
	Phone          string   `json:"phone,omitempty"`
	Status         string   `json:"status,omitempty"`
	Group          string   `json:"group,omitempty"`
	GroupName      string   `json:"groupName,omitempty"`
	ShopCategoryID StringID `json:"shopCategoryId,omitempty"`
}

type UserWhitelistDTO struct {
	BarryBaseDTO
	UserID         StringID `json:"userId"`
	Username       string   `json:"username"`
	Channel        string   `json:"channel,omitempty"`
	Name           string   `json:"name,omitempty"`
	Group          string   `json:"group,omitempty"`
	GroupName      string   `json:"groupName,omitempty"`
	ShopCategoryID StringID `json:"shopCategoryId,omitempty"`
	Status         string   `json:"status,omitempty"`
	Active         *bool    `json:"active,omitempty"`
}

type UserWhitelistQueryDTO struct {
	PageQueryDTO
	RequestDTO
	ShopCategoryID string `json:"shopCategoryId,omitempty" form:"shopCategoryId" binding:"required"`
	Group          string `json:"group,omitempty" form:"group"`
	UserID         string `json:"userId,omitempty" form:"userId"`
	Username       string `json:"username,omitempty" form:"username"`
	Status         string `json:"status,omitempty" form:"status"`
}

type UpdateUserWhitelistStatusDTO struct {
	ID     int64 `json:"id"`
	Active *bool `json:"active" binding:"required"`
}

type UpdateUserWhitelistGroupDTO struct {
	ID    int64  `json:"id"`
	Group string `json:"group" binding:"required"`
}

type SaveUserWhitelistDTO struct {
	UserID         int64  `json:"userId" binding:"required"`
	ShopCategoryID int64  `json:"shopCategoryId" binding:"required"`
	Group          string `json:"group,omitempty"`
}

type PaymentMethodDTO struct {
	BarryBaseDTO
	Type    string `json:"type,omitempty"`
	Name    string `json:"name,omitempty"`
	Account string `json:"account,omitempty"`
}

type UserDetailDTO struct {
	BarryBaseDTO
	Username       string              `json:"username"`
	Channel        string              `json:"channel,omitempty"`
	InventCode     string              `json:"inventCode,omitempty"`
	AlipayName     string              `json:"alipayName,omitempty"`
	AlipayAccount  string              `json:"alipayAccount,omitempty"`
	Role           string              `json:"role,omitempty"`
	PaymentMethods []*PaymentMethodDTO `json:"paymentMethods,omitempty"`
}

type UserDetailQueryDTO struct {
	PageQueryDTO
	RequestDTO
	Username string `json:"username,omitempty" form:"username"`
	Channel  string `json:"channel,omitempty" form:"channel"`
}

type SaveUserDetailDTO struct {
	Username         string `json:"username" binding:"required"`
	Password         string `json:"password,omitempty"`
	OriginalPassword string `json:"originalPassword,omitempty"`
	Channel          string `json:"channel,omitempty"`
	InventCode       string `json:"inventCode,omitempty"`
	AlipayName       string `json:"alipayName,omitempty"`
	AlipayAccount    string `json:"alipayAccount,omitempty"`
	Role             string `json:"role,omitempty"`
}

type UpdateUserDetailDTO struct {
	Username      string `json:"username" binding:"required"`
	Channel       string `json:"channel,omitempty"`
	InventCode    string `json:"inventCode,omitempty"`
	AlipayName    string `json:"alipayName,omitempty"`
	AlipayAccount string `json:"alipayAccount,omitempty"`
	Role          string `json:"role,omitempty"`
}

type ChangeUserDetailPasswordDTO struct {
	Username string `json:"username" binding:"required"`
	Password string `json:"password" binding:"required"`
}

type UserWithdrawRecordDTO struct {
	BarryBaseDTO
	Channel        string `json:"channel,omitempty"`
	Username       string `json:"username,omitempty"`
	Points         int64  `json:"points,omitempty"`
	Status         string `json:"status,omitempty"`
	Description    string `json:"description,omitempty"`
	ApplyTime      string `json:"applyTime,omitempty"`
	ApproveTime    string `json:"approveTime,omitempty"`
	PaymentID      int64  `json:"paymentId,omitempty"`
	PaymentType    string `json:"paymentType,omitempty"`
	PaymentName    string `json:"paymentName,omitempty"`
	PaymentAccount string `json:"paymentAccount,omitempty"`
}

type UserWithdrawRecordQueryDTO struct {
	RequestDTO
	Username  string `json:"username,omitempty" form:"username"`
	Channel   string `json:"channel,omitempty" form:"channel"`
	Status    string `json:"status,omitempty" form:"status"`
	StartTime string `json:"startTime,omitempty" form:"startTime"`
	EndTime   string `json:"endTime,omitempty" form:"endTime"`
}

type UserWithdrawActionDTO struct {
	Username                  string `json:"username,omitempty"`
	UserPointWithdrawRecordID int64  `json:"userPointWithdrawRecordId" binding:"required"`
	Description               string `json:"description,omitempty"`
}

type UserQueryDTO struct {
	PageQueryDTO
	RequestDTO
	UserID         string `json:"userId,omitempty" form:"userId"`
	Username       string `json:"username,omitempty" form:"username"`
	Name           string `json:"name,omitempty" form:"name"`
	Phone          string `json:"phone,omitempty" form:"phone"`
	Status         string `json:"status,omitempty" form:"status"`
	Channel        string `json:"channel,omitempty" form:"channel"`
	Group          string `json:"group,omitempty" form:"group"`
	ShopCategoryID string `json:"shopCategoryId,omitempty" form:"shopCategoryId"`
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

type RecordSummaryDTO struct {
	TotalNum      int64 `json:"totalNum"`
	PendingNum    int64 `json:"pendingNum"`
	UnCheckNum    int64 `json:"unCheckNum"`
	CheckedNum    int64 `json:"checkedNum"`
	CheckErrorNum int64 `json:"checkErrorNum"`
}

type ManualTaskStatisticsQueryDTO struct {
	StartDate       string `json:"startDate,omitempty" form:"startDate"`
	EndDate         string `json:"endDate,omitempty" form:"endDate"`
	ShopCategoryIDs string `json:"shopCategoryIds,omitempty" form:"shopCategoryIds"`
	UserID          int64  `json:"userId,omitempty" form:"userId"`
	Page            int    `json:"page,omitempty" form:"page"`
	PageSize        int    `json:"pageSize,omitempty" form:"pageSize"`
}

type ManualShopCategoryOptionDTO struct {
	ID   int64  `json:"id"`
	Name string `json:"name"`
	Code string `json:"code,omitempty"`
}

type ManualUserOptionDTO struct {
	ID       int64  `json:"id"`
	Username string `json:"username"`
	Nickname string `json:"nickname,omitempty"`
}

type ShopCategoryTaskSummaryDTO struct {
	ShopCategoryID       int64   `json:"shopCategoryId"`
	ShopCategoryName     string  `json:"shopCategoryName"`
	DistinctUserCount    int64   `json:"distinctUserCount"`
	DistinctExtUserCount int64   `json:"distinctExtUserCount"`
	TotalOrderScore      int64   `json:"totalOrderScore"`
	TotalNum             int64   `json:"totalNum"`
	PendingNum           int64   `json:"pendingNum"`
	UnCheckNum           int64   `json:"unCheckNum"`
	CheckedNum           int64   `json:"checkedNum"`
	CheckErrorNum        int64   `json:"checkErrorNum"`
	DeleteNum            int64   `json:"deleteNum"`
	SecretNum            int64   `json:"secretNum"`
	ApprovalRate         float64 `json:"approvalRate"`
}

type UserTaskSummaryDTO struct {
	ShopCategoryTaskSummaryDTO
	UserID       int64  `json:"userId"`
	Username     string `json:"username"`
	UpAccountNum int64  `json:"upAccountNum"`
}

type ManualTaskStatisticsDTO struct {
	StartDate               string                         `json:"startDate"`
	EndDate                 string                         `json:"endDate"`
	TotalNum                int64                          `json:"totalNum"`
	PendingNum              int64                          `json:"pendingNum"`
	UnCheckNum              int64                          `json:"unCheckNum"`
	CheckedNum              int64                          `json:"checkedNum"`
	CheckErrorNum           int64                          `json:"checkErrorNum"`
	DeleteNum               int64                          `json:"deleteNum"`
	SecretNum               int64                          `json:"secretNum"`
	DistinctUpAccountNum    int64                          `json:"distinctUpAccountNum"`
	ShopCategoryOptions     []*ManualShopCategoryOptionDTO `json:"shopCategoryOptions"`
	ShopCategorySummaryList []*ShopCategoryTaskSummaryDTO  `json:"shopCategorySummaryList"`
	UserSummaryList         []*UserTaskSummaryDTO          `json:"userSummaryList"`
	UserSummaryTotal        int64                          `json:"userSummaryTotal"`
	UserSummaryPage         int                            `json:"userSummaryPage"`
	UserSummaryPageSize     int                            `json:"userSummaryPageSize"`
}

type WorkbenchDashboardMetricQueryDTO struct {
	StartDate         string `json:"startDate,omitempty" form:"startDate"`
	EndDate           string `json:"endDate,omitempty" form:"endDate"`
	ShopCategoryIDs   string `json:"shopCategoryIds,omitempty" form:"shopCategoryIds"`
	ShopCategoryCodes string `json:"shopCategoryCodes,omitempty" form:"shopCategoryCodes"`
	WindowSeconds     int    `json:"windowSeconds,omitempty" form:"windowSeconds"`
}

type WorkbenchDashboardCategoryMetricDTO struct {
	ShopCategoryID int64  `json:"shopCategoryId"`
	CategoryName   string `json:"categoryName"`
	CategoryCode   string `json:"categoryCode"`
	Value          int64  `json:"value"`
}

type WorkbenchDashboardMetricDTO struct {
	StartDate    string                                 `json:"startDate"`
	EndDate      string                                 `json:"endDate"`
	Value        int64                                  `json:"value"`
	CategoryList []*WorkbenchDashboardCategoryMetricDTO `json:"categoryList"`
}

type WorkbenchDashboardManualSpeedCategoryDTO struct {
	ShopCategoryID       int64   `json:"shopCategoryId"`
	CategoryName         string  `json:"categoryName"`
	CategoryCode         string  `json:"categoryCode"`
	SubmittedCount       int64   `json:"submittedCount"`
	SubmittedPerSecond   float64 `json:"submittedPerSecond"`
	DistributedCount     int64   `json:"distributedCount"`
	DistributedPerSecond float64 `json:"distributedPerSecond"`
	AccountCount         int64   `json:"accountCount"`
}

type WorkbenchDashboardManualSpeedDTO struct {
	SubmittedCount       int64                                       `json:"submittedCount"`
	SubmittedPerSecond   float64                                     `json:"submittedPerSecond"`
	DistributedCount     int64                                       `json:"distributedCount"`
	DistributedPerSecond float64                                     `json:"distributedPerSecond"`
	AccountCount         int64                                       `json:"accountCount"`
	CategoryList         []*WorkbenchDashboardManualSpeedCategoryDTO `json:"categoryList"`
}

type OrderStatusStatisticDTO struct {
	OrderStatus string `json:"order_status"`
	Count       int64  `json:"count"`
}

type WorkbenchDashboardManualSubmittedComparisonDTO struct {
	Count           int64   `json:"count"`
	YesterdayCount  int64   `json:"yesterdayCount"`
	CountChange     int64   `json:"countChange"`
	CountChangeRate float64 `json:"countChangeRate"`
}

type WorkbenchUserOverviewDTO struct {
	UserCount          int64                           `json:"userCount"`
	AccountCount       int64                           `json:"accountCount"`
	OnlineUserCount    int64                           `json:"onlineUserCount"`
	OnlineAccountCount int64                           `json:"onlineAccountCount"`
	DetailList         []*WorkbenchUserOnlineDetailDTO `json:"detailList"`
}

type WorkbenchUserOnlineDetailDTO struct {
	UserID       int64  `json:"userId"`
	Username     string `json:"username"`
	Channel      string `json:"channel"`
	AccountCount int64  `json:"accountCount"`
}
