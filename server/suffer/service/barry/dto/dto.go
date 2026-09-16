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

// ShopGroupDTO is the product-group record returned by Barry Inner Gateway.
// The management API lists all groups so operators can edit or retire them.
type ShopGroupDTO struct {
	BarryBaseDTO
	Name   string `json:"name"`
	Code   string `json:"code"`
	Status string `json:"status,omitempty"`
}

// WhitelistGroupDTO is a user-defined whitelist group owned by a 商品分组.
// Its Code is the value persisted onto user_zhenren_list.group, so renaming a
// group never rewrites existing whitelist rows.
//
// NOTE: the id is declared here with omitempty instead of embedding BarryBaseDTO.
// Barry decides create-vs-update from whether the id is present, and an embedded
// BarryBaseDTO would serialise `"id": 0` on create, which Barry would read as an
// update of row 0 and reject.
type WhitelistGroupDTO struct {
	ID          int     `json:"id,omitempty"`
	CreatedTime string  `json:"createdTime,omitempty"`
	UpdatedTime string  `json:"updatedTime,omitempty"`
	CreatedBy   *string `json:"createdBy,omitempty"`
	UpdatedBy   *string `json:"updatedBy,omitempty"`
	Active      bool    `json:"active"`
	ShopGroupID int64   `json:"shopGroupId,omitempty"`
	Code        string  `json:"code"`
	Name        string  `json:"name"`
	SortID      int     `json:"sortId"`
	Status      string  `json:"status,omitempty"`
}

// BridgeConfigDTO is a Bridge endpoint configuration. Its bridge category is
// resolved from the selected 商品分组 by Barry, not supplied by the manager.
type BridgeConfigDTO struct {
	BarryBaseDTO
	BridgeCategoryID int64   `json:"bridgeCategoryId,omitempty"`
	Alias            string  `json:"alias,omitempty"`
	MapperURL        string  `json:"mapperUrl"`
	Method           string  `json:"method"`
	Header           string  `json:"header,omitempty"`
	Weight           float64 `json:"weight,omitempty"`
	BridgeType       string  `json:"bridgeType"`
	Status           string  `json:"status,omitempty"`
	LoadBalanceFlag  *bool   `json:"loadBalanceFlag,omitempty"`
	BodyParams       string  `json:"bodyParams,omitempty"`
	AnalysisName     string  `json:"analysisName,omitempty"`
	RateOfSuccess    float64 `json:"rateOfSuccess,omitempty"`
	SuccessNum       int64   `json:"successNum,omitempty"`
	ErrorNum         int64   `json:"errorNum,omitempty"`
	DeleteNum        int64   `json:"deleteNum,omitempty"`
	Source           string  `json:"source,omitempty"`
	ContentType      string  `json:"contentType,omitempty"`
	FetchType        string  `json:"fetchType,omitempty"`
	FetchAnalysis    string  `json:"fetchAnalysis,omitempty"`
	NotGetDataNum    int64   `json:"notGetDataNum,omitempty"`
	FetchProxyURL    string  `json:"fetchProxyUrl,omitempty"`
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
	AllowAssignTime string   `json:"allowAssignTime,omitempty"`
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
	AllowAssignTime string   `json:"allowAssignTime,omitempty"`
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
	ShopCategoryID        int64    `json:"shopCategoryId"`
	Enabled               bool     `json:"enabled"`
	MinFansNum            int64    `json:"minFansNum"`
	MinItemNum            int64    `json:"minItemNum"`
	MinInteractRate       *float64 `json:"minInteractRate,omitempty"`
	SubmitRateEnabled     bool     `json:"submitRateEnabled"`
	SubmitRateURLKeywords string   `json:"submitRateUrlKeywords,omitempty"`
	MinSubmitRate         float64  `json:"minSubmitRate"`
	MinSampleNum          int64    `json:"minSampleNum"`
}

type AssignUidRuleQueryDTO struct {
	RequestDTO
	ShopCategoryID int64 `json:"shopCategoryId,omitempty" form:"shopCategoryId"`
}

type SaveAssignUidRuleDTO struct {
	ID                    int      `json:"id,omitempty"`
	ShopCategoryID        int64    `json:"shopCategoryId"`
	Enabled               bool     `json:"enabled"`
	MinFansNum            int64    `json:"minFansNum"`
	MinItemNum            int64    `json:"minItemNum"`
	MinInteractRate       *float64 `json:"minInteractRate,omitempty"`
	SubmitRateEnabled     bool     `json:"submitRateEnabled"`
	SubmitRateURLKeywords string   `json:"submitRateUrlKeywords,omitempty"`
	MinSubmitRate         float64  `json:"minSubmitRate"`
	MinSampleNum          int64    `json:"minSampleNum"`
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

// AssignApprovalRateRuleDTO 分配策略-审核通过率维度规则，按品类维护。
type AssignApprovalRateRuleDTO struct {
	BarryBaseDTO
	ShopCategoryID           int64   `json:"shopCategoryId"`
	Enabled                  bool    `json:"enabled"`
	MinFansNum               int64   `json:"minFansNum"`
	RecentApprovalRateDays   int     `json:"recentApprovalRateDays"`
	MinRecentApprovalRate    float64 `json:"minRecentApprovalRate"`
	MinDailySubmitNum        int64   `json:"minDailySubmitNum"`
	DailyAssignTimeRanges    string  `json:"dailyAssignTimeRanges,omitempty"`
	WhitelistShopCategoryIDs string  `json:"whitelistShopCategoryIds,omitempty"`
}

type AssignApprovalRateRuleQueryDTO struct {
	RequestDTO
	ShopCategoryID int64 `json:"shopCategoryId,omitempty" form:"shopCategoryId"`
}

type SaveAssignApprovalRateRuleDTO struct {
	ID                       int     `json:"id,omitempty"`
	ShopCategoryID           int64   `json:"shopCategoryId"`
	Enabled                  bool    `json:"enabled"`
	MinFansNum               int64   `json:"minFansNum"`
	RecentApprovalRateDays   int     `json:"recentApprovalRateDays"`
	MinRecentApprovalRate    float64 `json:"minRecentApprovalRate"`
	MinDailySubmitNum        int64   `json:"minDailySubmitNum"`
	DailyAssignTimeRanges    string  `json:"dailyAssignTimeRanges,omitempty"`
	WhitelistShopCategoryIDs string  `json:"whitelistShopCategoryIds,omitempty"`
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

// AssignUidSubmitRateUserRuleDTO 指定用户 uid 提交率规则，存在时整体覆盖品类全局规则。
type AssignUidSubmitRateUserRuleDTO struct {
	BarryBaseDTO
	ShopCategoryID        int64   `json:"shopCategoryId"`
	UserID                int64   `json:"userId"`
	Username              string  `json:"username,omitempty"`
	SubmitRateEnabled     bool    `json:"submitRateEnabled"`
	SubmitRateURLKeywords string  `json:"submitRateUrlKeywords,omitempty"`
	MinSubmitRate         float64 `json:"minSubmitRate"`
	MinSampleNum          int64   `json:"minSampleNum"`
}

type AssignUidSubmitRateUserRuleQueryDTO struct {
	RequestDTO
	ShopCategoryID int64 `json:"shopCategoryId,omitempty" form:"shopCategoryId"`
}

type SaveAssignUidSubmitRateUserRuleDTO struct {
	ID                    int     `json:"id,omitempty"`
	ShopCategoryID        int64   `json:"shopCategoryId"`
	UserID                int64   `json:"userId"`
	SubmitRateEnabled     bool    `json:"submitRateEnabled"`
	SubmitRateURLKeywords string  `json:"submitRateUrlKeywords,omitempty"`
	MinSubmitRate         float64 `json:"minSubmitRate"`
	MinSampleNum          int64   `json:"minSampleNum"`
}

type DeleteAssignUidSubmitRateUserRuleDTO struct {
	ShopCategoryID int64 `json:"shopCategoryId" form:"shopCategoryId"`
	UserID         int64 `json:"userId" form:"userId"`
}

// AssignSwitchQueryDTO 分配策略维度总开关查询(白名单/uid), 按品类.
type AssignSwitchQueryDTO struct {
	RequestDTO
	ShopCategoryID int64 `json:"shopCategoryId,omitempty" form:"shopCategoryId"`
}

type WhitelistApprovalRateRuleDTO struct {
	MinRecentApprovalRate float64 `json:"minRecentApprovalRate"`
	// 通过率上限, nil 表示不限上限。
	MaxRecentApprovalRate  *float64 `json:"maxRecentApprovalRate"`
	RecentApprovalRateDays *int     `json:"recentApprovalRateDays"`
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
	UserID                 StringID `json:"userId"`
	Username               string   `json:"username"`
	Channel                string   `json:"channel,omitempty"`
	Name                   string   `json:"name,omitempty"`
	Group                  string   `json:"group,omitempty"`
	GroupName              string   `json:"groupName,omitempty"`
	ShopCategoryID         StringID `json:"shopCategoryId,omitempty"`
	Status                 string   `json:"status,omitempty"`
	Active                 *bool    `json:"active,omitempty"`
	MinRecentApprovalRate  *float64 `json:"minRecentApprovalRate,omitempty"`
	MaxRecentApprovalRate  *float64 `json:"maxRecentApprovalRate,omitempty"`
	RecentApprovalRateDays *int     `json:"recentApprovalRateDays,omitempty"`
	DailyAssignTimeRanges  string   `json:"dailyAssignTimeRanges,omitempty"`
	FetchTaskLoopNum       *int     `json:"fetchTaskLoopNum,omitempty"`
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
	UserID                 int64    `json:"userId" binding:"required"`
	ShopCategoryID         int64    `json:"shopCategoryId" binding:"required"`
	Group                  string   `json:"group,omitempty"`
	UpdatePolicy           bool     `json:"updatePolicy,omitempty"`
	MinRecentApprovalRate  *float64 `json:"minRecentApprovalRate,omitempty"`
	MaxRecentApprovalRate  *float64 `json:"maxRecentApprovalRate,omitempty"`
	RecentApprovalRateDays *int     `json:"recentApprovalRateDays,omitempty"`
	DailyAssignTimeRanges  *string  `json:"dailyAssignTimeRanges,omitempty"`
	FetchTaskLoopNum       *int     `json:"fetchTaskLoopNum,omitempty"`
}

type PaymentMethodDTO struct {
	BarryBaseDTO
	Type    string `json:"type,omitempty"`
	Name    string `json:"name,omitempty"`
	Account string `json:"account,omitempty"`
}

type UserDetailDTO struct {
	BarryBaseDTO
	Username         string              `json:"username"`
	OriginalPassword string              `json:"originalPassword,omitempty"`
	Channel          string              `json:"channel,omitempty"`
	InventCode       string              `json:"inventCode,omitempty"`
	AlipayName       string              `json:"alipayName,omitempty"`
	AlipayAccount    string              `json:"alipayAccount,omitempty"`
	Role             string              `json:"role,omitempty"`
	PaymentMethods   []*PaymentMethodDTO `json:"paymentMethods,omitempty"`
	// 当前余额 / 当前冻结金额。没有 omitempty，0 也要如实传给前端。
	ActivePoints int64 `json:"activePoints"`
	BlockPoints  int64 `json:"blockPoints"`
}

// AdjustUserPointsDTO is a manual points adjustment issued from the console.
// Points is signed: positive adds, negative deducts. Serial is generated by the
// client so a double submit collapses into one adjustment.
type AdjustUserPointsDTO struct {
	UserID      int64  `json:"userId" binding:"required"`
	Points      int64  `json:"points" binding:"required"`
	Description string `json:"description" binding:"required"`
	Serial      string `json:"serial,omitempty"`
}

// UserPointsSummaryDTO aggregates the balances of every account Barry knows about.
type UserPointsSummaryDTO struct {
	ActivePoints int64 `json:"activePoints"`
	BlockPoints  int64 `json:"blockPoints"`
	TotalPoints  int64 `json:"totalPoints"`
	AccountNum   int64 `json:"accountNum"`
}

type UserPointsSummaryQueryDTO struct {
	RequestDTO
	// 只统计该时间之后有积分变动的账号（user_points.updated_time），留空为全部。
	UpdatedTime string `json:"updatedTime,omitempty" form:"updatedTime"`
	// 逗号分隔的用户ID，来自管理端本地保存的排除偏好。
	ExcludedUserIDs string `json:"excludedUserIds,omitempty" form:"excludedUserIds"`
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
	StartDate             string `json:"startDate,omitempty" form:"startDate"`
	EndDate               string `json:"endDate,omitempty" form:"endDate"`
	ShopCategoryIDs       string `json:"shopCategoryIds,omitempty" form:"shopCategoryIds"`
	Channel               string `json:"channel,omitempty" form:"channel"`
	ExcludeWhitelistUsers bool   `json:"excludeWhitelistUsers,omitempty" form:"excludeWhitelistUsers"`
	UserID                int64  `json:"userId,omitempty" form:"userId"`
	Page                  int    `json:"page,omitempty" form:"page"`
	PageSize              int    `json:"pageSize,omitempty" form:"pageSize"`
}

type OrderFetchMonitorUsersQueryDTO struct {
	UserIDs       string `json:"userIds" form:"userIds" binding:"required"`
	WindowSeconds int    `json:"windowSeconds,omitempty" form:"windowSeconds"`
}

type OrderFetchMonitorUIDsQueryDTO struct {
	OrderFetchMonitorUsersQueryDTO
	UIDs string `json:"uids" form:"uids" binding:"required"`
}

type OrderFetchMonitorDTO struct {
	UserID               int64   `json:"userId"`
	UID                  string  `json:"uid,omitempty"`
	HitNum               int64   `json:"hitNum"`
	MissNum              int64   `json:"missNum"`
	WindowSeconds        int     `json:"windowSeconds"`
	HitRemainingSeconds  int64   `json:"hitRemainingSeconds"`
	MissRemainingSeconds int64   `json:"missRemainingSeconds"`
	HitElapsedSeconds    int     `json:"hitElapsedSeconds"`
	MissElapsedSeconds   int     `json:"missElapsedSeconds"`
	ElapsedSeconds       int     `json:"elapsedSeconds"`
	HitSpeed             float64 `json:"hitSpeed"`
	MissSpeed            float64 `json:"missSpeed"`
	HitRate              float64 `json:"hitRate"`
}

// OrderRealDetailDTO 订单的实时数据，来自 barry /orderRecords/detail。
// barry 会现调第三方平台拿当前值：取不到时 NowNum 为 -1 且 GetNowError 有值，FactNum 为空。
type OrderRealDetailDTO struct {
	ExtOrderID        string `json:"extOrderId"`
	ShopInletRecordID int64  `json:"shopInletRecordId,omitempty"`
	ShopID            int64  `json:"shopId,omitempty"`
	BusinessID        string `json:"businessId,omitempty"`
	// NowNum 平台当前值，如当前点赞总数；-1 表示没取到
	NowNum int64 `json:"nowNum"`
	// FactNum 实际增量 = 当前值 - 起始值；没取到当前值时为空
	FactNum       *int64 `json:"factNum,omitempty"`
	ShopStatus    string `json:"shopStatus,omitempty"`
	DisposeStatus string `json:"disposeStatus,omitempty"`
	UnCheckCount  int64  `json:"unCheckCount"`
	CheckedCount  int64  `json:"checkedCount"`
	GetNowError   string `json:"getNowError,omitempty"`
}

// OrderManualDetailQueryDTO 单个订单的做单明细分页入参。
// OrderID 为 kakrolot 的订单 ID，对应 barry shop_inlet_record.ori_shop_id。
type OrderManualDetailQueryDTO struct {
	OrderID  string `json:"orderId" form:"orderId" binding:"required"`
	UserID   int64  `json:"userId,omitempty" form:"userId"`
	Page     int    `json:"page,omitempty" form:"page"`
	PageSize int    `json:"pageSize,omitempty" form:"pageSize"`
}

// OrderManualUserSummaryDTO 单个订单下某个做单用户的做单量。
type OrderManualUserSummaryDTO struct {
	UserID        int64  `json:"userId"`
	Username      string `json:"username"`
	Channel       string `json:"channel,omitempty"`
	OrderNum      int64  `json:"orderNum"`
	UpAccountNum  int64  `json:"upAccountNum"`
	PendingNum    int64  `json:"pendingNum"`
	UnCheckNum    int64  `json:"unCheckNum"`
	CheckedNum    int64  `json:"checkedNum"`
	CheckErrorNum int64  `json:"checkErrorNum"`
}

// OrderManualRecordDTO 单个订单下的一条做单明细，对应 barry order_record 一行。
type OrderManualRecordDTO struct {
	ID           int64  `json:"id"`
	UserID       int64  `json:"userId"`
	Username     string `json:"username"`
	UID          string `json:"uid"`
	UIDType      string `json:"uidType,omitempty"`
	Channel      string `json:"channel,omitempty"`
	OrderStatus  string `json:"orderStatus"`
	OrderScore   int64  `json:"orderScore"`
	StartNum     int64  `json:"startNum"`
	EndNum       int64  `json:"endNum"`
	AssignmentID int64  `json:"assignmentId,omitempty"`
	Tag          string `json:"tag,omitempty"`
	Description  string `json:"description,omitempty"`
	ExpireTime   string `json:"expireTime,omitempty"`
	CreatedTime  string `json:"createdTime,omitempty"`
	UpdatedTime  string `json:"updatedTime,omitempty"`
}

// OrderManualDetailPageDTO 单个订单的做单明细分页结果，ShopID 为 0 表示 barry 还没有该订单的进件/商品记录。
type OrderManualDetailPageDTO struct {
	OrderID           string                  `json:"orderId"`
	ShopInletRecordID int64                   `json:"shopInletRecordId,omitempty"`
	ShopID            int64                   `json:"shopId,omitempty"`
	Total             int64                   `json:"total"`
	Page              int                     `json:"page"`
	PageSize          int                     `json:"pageSize"`
	Records           []*OrderManualRecordDTO `json:"records"`
}

type UserAssignQueueQueryDTO struct {
	UserID int64  `json:"userId,omitempty" form:"userId"`
	UID    string `json:"uid" form:"uid" binding:"required"`
}

type UserAssignQueueDTO struct {
	UserID           int64  `json:"userId,omitempty"`
	UID              string `json:"uid,omitempty"`
	ShopTypeID       int64  `json:"shopTypeId"`
	ShopTypeName     string `json:"shopTypeName,omitempty"`
	ShopTypeCode     string `json:"shopTypeCode,omitempty"`
	ShopGroupID      int64  `json:"shopGroupId,omitempty"`
	ShopGroupName    string `json:"shopGroupName,omitempty"`
	ShopGroupCode    string `json:"shopGroupCode,omitempty"`
	QueueKey         string `json:"queueKey,omitempty"`
	DelayQueueKey    string `json:"delayQueueKey,omitempty"`
	NormalNum        int64  `json:"normalNum"`
	DelayNum         int64  `json:"delayNum"`
	TotalNum         int64  `json:"totalNum"`
	RemainingSeconds int64  `json:"remainingSeconds"`
}

// UserFetchTaskQueryDTO 管理端代替做单用户按商品分组取一次任务的入参。
type UserFetchTaskQueryDTO struct {
	UserID  int64  `json:"userId" form:"userId" binding:"required"`
	UID     string `json:"uid" form:"uid" binding:"required"`
	Code    string `json:"code" form:"code" binding:"required"`
	UIDType string `json:"uidType,omitempty" form:"uidType"`
	SecUID  string `json:"secUid,omitempty" form:"secUid"`
}

// UserFetchTaskDTO 代取任务的结果，Fetched=false 表示调用成功但当前没有任务可取。
type UserFetchTaskDTO struct {
	Fetched    bool           `json:"fetched"`
	Message    string         `json:"message,omitempty"`
	RequestURL string         `json:"requestUrl,omitempty"`
	UserID     int64          `json:"userId,omitempty"`
	Username   string         `json:"username,omitempty"`
	UID        string         `json:"uid,omitempty"`
	UIDType    string         `json:"uidType,omitempty"`
	SecUID     string         `json:"secUid,omitempty"`
	Code       string         `json:"code,omitempty"`
	OrderID    string         `json:"orderId,omitempty"`
	VideoID    string         `json:"videoId,omitempty"`
	TaskURL    string         `json:"taskUrl,omitempty"`
	ShortURL   string         `json:"shortUrl,omitempty"`
	TaskTag    string         `json:"taskTag,omitempty"`
	AssistID   string         `json:"assistId,omitempty"`
	TotalNum   int64          `json:"totalNum,omitempty"`
	Property   map[string]any `json:"property,omitempty"`
}

type ManualOrderDetailQueryDTO struct {
	StartDate             string `json:"startDate,omitempty" form:"startDate"`
	EndDate               string `json:"endDate,omitempty" form:"endDate"`
	UserID                int64  `json:"userId,omitempty" form:"userId"`
	UID                   string `json:"uid,omitempty" form:"uid"`
	ShopCategoryIDs       string `json:"shopCategoryIds,omitempty" form:"shopCategoryIds"`
	ExcludeWhitelistUsers bool   `json:"excludeWhitelistUsers,omitempty" form:"excludeWhitelistUsers"`
	FansNumOrder          string `json:"fansNumOrder,omitempty" form:"fansNumOrder"`
	FansNumMin            string `json:"fansNumMin,omitempty" form:"fansNumMin"`
	FansNumMax            string `json:"fansNumMax,omitempty" form:"fansNumMax"`
	ApprovalRateMin       string `json:"approvalRateMin,omitempty" form:"approvalRateMin"`
	ApprovalRateMax       string `json:"approvalRateMax,omitempty" form:"approvalRateMax"`
	Page                  int    `json:"page,omitempty" form:"page"`
	PageSize              int    `json:"pageSize,omitempty" form:"pageSize"`
}

type ManualOrderDetailDTO struct {
	UserID         int64   `json:"userId"`
	Username       string  `json:"username"`
	Channel        string  `json:"channel"`
	UID            string  `json:"uid"`
	FansNum        int64   `json:"fansNum"`
	TotalSubmitNum int64   `json:"totalSubmitNum"`
	UnSubmitNum    int64   `json:"unSubmitNum"`
	UnCheckNum     int64   `json:"unCheckNum"`
	CheckedNum     int64   `json:"checkedNum"`
	CheckErrorNum  int64   `json:"checkErrorNum"`
	ApprovalRate   float64 `json:"approvalRate"`
}

type ManualOrderDetailPageDTO struct {
	StartDate string                  `json:"startDate"`
	EndDate   string                  `json:"endDate"`
	Total     int64                   `json:"total"`
	Page      int                     `json:"page"`
	PageSize  int                     `json:"pageSize"`
	Records   []*ManualOrderDetailDTO `json:"records"`
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
	Channel      string `json:"channel"`
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
	ShopGroupIDs      string `json:"shopGroupIds,omitempty" form:"shopGroupIds"`
	ShopCategoryCodes string `json:"shopCategoryCodes,omitempty" form:"shopCategoryCodes"`
	WindowSeconds     int    `json:"windowSeconds,omitempty" form:"windowSeconds"`
	FetchTimeRange    string `json:"fetchTimeRange,omitempty" form:"fetchTimeRange"`
}

type BridgeDailyStatisticQueryDTO struct {
	StartDate    string `json:"startDate,omitempty" form:"startDate"`
	EndDate      string `json:"endDate,omitempty" form:"endDate"`
	ShopGroupIDs string `json:"shopGroupIds,omitempty" form:"shopGroupIds"`
	BridgeType   string `json:"bridgeType,omitempty" form:"bridgeType"`
}

type BridgeDailyStatisticDetailDTO struct {
	StatDate         string  `json:"statDate"`
	BridgeID         int64   `json:"bridgeId"`
	BridgeCode       string  `json:"bridgeCode"`
	BridgeName       string  `json:"bridgeName"`
	BridgeCategoryID int64   `json:"bridgeCategoryId"`
	BridgeType       string  `json:"bridgeType"`
	ShopGroupIDs     []int64 `json:"shopGroupIds"`
	TotalNum         int64   `json:"totalNum"`
	SuccessNum       int64   `json:"successNum"`
	FailNum          int64   `json:"failNum"`
	ErrorNum         int64   `json:"errorNum"`
	NotGetDataNum    int64   `json:"notGetDataNum"`
	DeleteNum        int64   `json:"deleteNum"`
	SecretNum        int64   `json:"secretNum"`
	UnAuthorizeNum   int64   `json:"unAuthorizeNum"`
}

type BridgeDailyStatisticSummaryDTO struct {
	StartDate            string                           `json:"startDate"`
	EndDate              string                           `json:"endDate"`
	TotalNum             int64                            `json:"totalNum"`
	SuccessNum           int64                            `json:"successNum"`
	FailNum              int64                            `json:"failNum"`
	ErrorNum             int64                            `json:"errorNum"`
	NotGetDataNum        int64                            `json:"notGetDataNum"`
	DeleteNum            int64                            `json:"deleteNum"`
	SecretNum            int64                            `json:"secretNum"`
	UnAuthorizeNum       int64                            `json:"unAuthorizeNum"`
	BridgeCount          int                              `json:"bridgeCount"`
	UnmappedShopGroupIDs []int64                          `json:"unmappedShopGroupIds"`
	DetailList           []*BridgeDailyStatisticDetailDTO `json:"detailList"`
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

type WorkbenchDashboardPendingDetectionCountGroupDTO struct {
	ShopGroupID                           int64  `json:"shopGroupId"`
	GroupName                             string `json:"groupName"`
	GroupCode                             string `json:"groupCode"`
	PendingDetectionCount                 int64  `json:"pendingDetectionCount"`
	FinishAssignmentPendingDetectionCount int64  `json:"finishAssignmentPendingDetectionCount"`
	DelayAssignmentPendingDetectionCount  int64  `json:"delayAssignmentPendingDetectionCount"`
}

type WorkbenchDashboardPendingDetectionCountDTO struct {
	Total                                 int64                                              `json:"total"`
	PendingDetectionCount                 int64                                              `json:"pendingDetectionCount"`
	FinishAssignmentPendingDetectionCount int64                                              `json:"finishAssignmentPendingDetectionCount"`
	DelayAssignmentPendingDetectionCount  int64                                              `json:"delayAssignmentPendingDetectionCount"`
	GroupList                             []*WorkbenchDashboardPendingDetectionCountGroupDTO `json:"groupList"`
}

type WorkbenchDashboardFetchAssignmentMonitorCategoryDTO struct {
	ShopCategoryID               int64   `json:"shopCategoryId"`
	CategoryName                 string  `json:"categoryName"`
	CategoryCode                 string  `json:"categoryCode"`
	ShopTypeID                   int64   `json:"shopTypeId"`
	ShopTypeName                 string  `json:"shopTypeName"`
	ShopTypeCode                 string  `json:"shopTypeCode"`
	SingleInitPendingCount       int64   `json:"singleInitPendingCount"`
	BatchInitPendingCount        int64   `json:"batchInitPendingCount"`
	PendingCount                 int64   `json:"pendingCount"`
	EmptyQueueFetchCount         int64   `json:"emptyQueueFetchCount"`
	EmptyQueueUserCount          int64   `json:"emptyQueueUserCount"`
	InitSubmittedCount           int64   `json:"initSubmittedCount"`
	InitSubmittedUserCount       int64   `json:"initSubmittedUserCount"`
	DailyFetchHitCount           int64   `json:"dailyFetchHitCount"`
	DailyFetchMissCount          int64   `json:"dailyFetchMissCount"`
	DailyFetchHitYesterdayCount  int64   `json:"dailyFetchHitYesterdayCount"`
	DailyFetchMissYesterdayCount int64   `json:"dailyFetchMissYesterdayCount"`
	DailyFetchSuccessRate        float64 `json:"dailyFetchSuccessRate"`
}

type WorkbenchDashboardFetchAssignmentMonitorDTO struct {
	SingleInitPendingCount       int64                                                  `json:"singleInitPendingCount"`
	BatchInitPendingCount        int64                                                  `json:"batchInitPendingCount"`
	PendingCount                 int64                                                  `json:"pendingCount"`
	EmptyQueueFetchCount         int64                                                  `json:"emptyQueueFetchCount"`
	EmptyQueueUserCount          int64                                                  `json:"emptyQueueUserCount"`
	InitSubmittedCount           int64                                                  `json:"initSubmittedCount"`
	InitSubmittedUserCount       int64                                                  `json:"initSubmittedUserCount"`
	DailyFetchHitCount           int64                                                  `json:"dailyFetchHitCount"`
	DailyFetchMissCount          int64                                                  `json:"dailyFetchMissCount"`
	DailyFetchHitYesterdayCount  int64                                                  `json:"dailyFetchHitYesterdayCount"`
	DailyFetchMissYesterdayCount int64                                                  `json:"dailyFetchMissYesterdayCount"`
	DailyFetchSuccessRate        float64                                                `json:"dailyFetchSuccessRate"`
	CategoryList                 []*WorkbenchDashboardFetchAssignmentMonitorCategoryDTO `json:"categoryList"`
}

type WorkbenchDashboardDelayAssignmentCountCategoryDTO struct {
	ShopCategoryID                   int64   `json:"shopCategoryId"`
	CategoryName                     string  `json:"categoryName"`
	CategoryCode                     string  `json:"categoryCode"`
	Count                            int64   `json:"count"`
	ConsumedCount                    int64   `json:"consumedCount"`
	ConsumePerMinute                 float64 `json:"consumePerMinute"`
	FinishAssignmentConsumedCount    int64   `json:"finishAssignmentConsumedCount"`
	FinishAssignmentConsumePerMinute float64 `json:"finishAssignmentConsumePerMinute"`
	DelayAssignmentConsumedCount     int64   `json:"delayAssignmentConsumedCount"`
	DelayAssignmentConsumePerMinute  float64 `json:"delayAssignmentConsumePerMinute"`
}

type WorkbenchDashboardDelayAssignmentCountDTO struct {
	Total                            int64                                                `json:"total"`
	ConsumedCount                    int64                                                `json:"consumedCount"`
	ConsumePerMinute                 float64                                              `json:"consumePerMinute"`
	FinishAssignmentConsumedCount    int64                                                `json:"finishAssignmentConsumedCount"`
	FinishAssignmentConsumePerMinute float64                                              `json:"finishAssignmentConsumePerMinute"`
	DelayAssignmentConsumedCount     int64                                                `json:"delayAssignmentConsumedCount"`
	DelayAssignmentConsumePerMinute  float64                                              `json:"delayAssignmentConsumePerMinute"`
	CategoryList                     []*WorkbenchDashboardDelayAssignmentCountCategoryDTO `json:"categoryList"`
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

// WorkbenchPublicUserOverviewDTO is the token-free projection of WorkbenchUserOverviewDTO.
// Only aggregate counters are exposed; per-user details stay behind the authenticated route.
type WorkbenchPublicUserOverviewDTO struct {
	UserCount          int64 `json:"userCount"`
	AccountCount       int64 `json:"accountCount"`
	OnlineUserCount    int64 `json:"onlineUserCount"`
	OnlineAccountCount int64 `json:"onlineAccountCount"`
}

// ShopDropMonitorRuleDTO 已完成单掉量监控配置, 按人工商品(shopCategoryId)维护, shop 域.
type ShopDropMonitorRuleDTO struct {
	BarryBaseDTO
	ShopCategoryID        int64    `json:"shopCategoryId"`
	Enabled               bool     `json:"enabled"`
	ValidMinute           int      `json:"validMinute"`
	IntervalMinute        int      `json:"intervalMinute"`
	IntervalSteps         string   `json:"intervalSteps,omitempty"`
	FirstCheckDelayMinute int      `json:"firstCheckDelayMinute"`
	StableEndTimes        *int     `json:"stableEndTimes,omitempty"`
	DropThresholdNum      *int64   `json:"dropThresholdNum,omitempty"`
	DropThresholdRatio    *float64 `json:"dropThresholdRatio,omitempty"`
	RepairEnabled         bool     `json:"repairEnabled"`
	RepairMaxTimes        int      `json:"repairMaxTimes"`
	RepairMinNum          *int64   `json:"repairMinNum,omitempty"`
	RepairMaxDropRatio    *float64 `json:"repairMaxDropRatio,omitempty"`
	RepairSkipBelowStart  bool     `json:"repairSkipBelowStart"`
	MinTotalNum           *int64   `json:"minTotalNum,omitempty"`
	MaxStartNum           *int64   `json:"maxStartNum,omitempty"`
	Remark                string   `json:"remark,omitempty"`
}

type ShopDropMonitorRuleQueryDTO struct {
	RequestDTO
	ShopCategoryID int64 `json:"shopCategoryId,omitempty" form:"shopCategoryId"`
}

type SaveShopDropMonitorRuleDTO struct {
	ID                    int      `json:"id,omitempty"`
	ShopCategoryID        int64    `json:"shopCategoryId"`
	Enabled               bool     `json:"enabled"`
	ValidMinute           int      `json:"validMinute"`
	IntervalMinute        int      `json:"intervalMinute"`
	IntervalSteps         string   `json:"intervalSteps,omitempty"`
	FirstCheckDelayMinute int      `json:"firstCheckDelayMinute"`
	StableEndTimes        *int     `json:"stableEndTimes,omitempty"`
	DropThresholdNum      *int64   `json:"dropThresholdNum,omitempty"`
	DropThresholdRatio    *float64 `json:"dropThresholdRatio,omitempty"`
	RepairEnabled         bool     `json:"repairEnabled"`
	RepairMaxTimes        int      `json:"repairMaxTimes"`
	RepairMinNum          *int64   `json:"repairMinNum,omitempty"`
	RepairMaxDropRatio    *float64 `json:"repairMaxDropRatio,omitempty"`
	RepairSkipBelowStart  bool     `json:"repairSkipBelowStart"`
	MinTotalNum           *int64   `json:"minTotalNum,omitempty"`
	MaxStartNum           *int64   `json:"maxStartNum,omitempty"`
	Remark                string   `json:"remark,omitempty"`
}

// ShopDropRepairDTO 掉量补单明细.
type ShopDropRepairDTO struct {
	BarryBaseDTO
	ShopDropMonitorID int64  `json:"shopDropMonitorId"`
	Round             int    `json:"round"`
	OriginShopID      int64  `json:"originShopId"`
	OriginOriShopID   string `json:"originOriShopId,omitempty"`
	BusinessID        string `json:"businessId,omitempty"`
	ShopCategoryID    int64  `json:"shopCategoryId"`
	ShopCategoryName  string `json:"shopCategoryName,omitempty"`
	ShopTypeID        int64  `json:"shopTypeId"`
	RepairShopID      int64  `json:"repairShopId"`
	RepairOriShopID   string `json:"repairOriShopId,omitempty"`
	DropNum           int64  `json:"dropNum"`
	RepairNum         int64  `json:"repairNum"`
	UnitScore         int64  `json:"unitScore"`
	PlanCost          int64  `json:"planCost"`
	ActualCost        int64  `json:"actualCost"`
	FinishNum         int64  `json:"finishNum"`
	Status            string `json:"status,omitempty"`
	RepairTime        string `json:"repairTime,omitempty"`
	FinishTime        string `json:"finishTime,omitempty"`
	Remark            string `json:"remark,omitempty"`
}

// ShopDropRepairPageDTO 对应 barry 的 PageModel.
type ShopDropRepairPageDTO struct {
	Total int64                `json:"total"`
	Data  []*ShopDropRepairDTO `json:"data"`
}

// ShopDropRepairSummaryDTO 补单数据概览, 成本双口径: planCost 下发即定, actualCost 随补单完成回填.
type ShopDropRepairSummaryDTO struct {
	RepairOrderNum int64 `json:"repairOrderNum"`
	RepairTotalNum int64 `json:"repairTotalNum"`
	PlanCost       int64 `json:"planCost"`
	ActualCost     int64 `json:"actualCost"`
	FinishNum      int64 `json:"finishNum"`
}

type ShopDropRepairQueryDTO struct {
	RequestDTO
	StartDate       string `json:"startDate,omitempty" form:"startDate"`
	EndDate         string `json:"endDate,omitempty" form:"endDate"`
	ShopCategoryIDs string `json:"shopCategoryIds,omitempty" form:"shopCategoryIds"`
	OriShopID       string `json:"oriShopId,omitempty" form:"oriShopId"`
	BusinessID      string `json:"businessId,omitempty" form:"businessId"`
	Status          string `json:"status,omitempty" form:"status"`
	PageIndex       int    `json:"pageIndex,omitempty" form:"pageIndex"`
	PageSize        int    `json:"pageSize,omitempty" form:"pageSize"`
}

// ShopDropMonitorDTO 掉量监控任务明细, 不开补单也能看.
type ShopDropMonitorDTO struct {
	BarryBaseDTO
	ShopID                int64  `json:"shopId"`
	ShopCategoryID        int64  `json:"shopCategoryId"`
	ShopCategoryName      string `json:"shopCategoryName,omitempty"`
	OriShopID             string `json:"oriShopId,omitempty"`
	BusinessID            string `json:"businessId,omitempty"`
	StartNum              int64  `json:"startNum"`
	TotalNum              int64  `json:"totalNum"`
	BaselineNum           int64  `json:"baselineNum"`
	FinishTime            string `json:"finishTime,omitempty"`
	ExpireTime            string `json:"expireTime,omitempty"`
	NextCheckTime         string `json:"nextCheckTime,omitempty"`
	LastCheckTime         string `json:"lastCheckTime,omitempty"`
	LastNum               int64  `json:"lastNum"`
	MinNum                int64  `json:"minNum"`
	CheckTimes            int    `json:"checkTimes"`
	ContinuousNormalTimes int    `json:"continuousNormalTimes"`
	FailTimes             int    `json:"failTimes"`
	DropTimes             int    `json:"dropTimes"`
	MaxDropNum            int64  `json:"maxDropNum"`
	LastDropNum           int64  `json:"lastDropNum"`
	FirstDropTime         string `json:"firstDropTime,omitempty"`
	RepairTimes           int    `json:"repairTimes"`
	RepairTotalNum        int64  `json:"repairTotalNum"`
	Status                string `json:"status,omitempty"`
	Remark                string `json:"remark,omitempty"`
}

type ShopDropMonitorPageDTO struct {
	Total int64                 `json:"total"`
	Data  []*ShopDropMonitorDTO `json:"data"`
}

// ShopDropMonitorSummaryDTO 掉量监控概览, 灰度期定参数的依据.
type ShopDropMonitorSummaryDTO struct {
	TotalNum           int64   `json:"totalNum"`
	DropOrderNum       int64   `json:"dropOrderNum"`
	DropCheckNum       int64   `json:"dropCheckNum"`
	DropRate           float64 `json:"dropRate"`
	RepairOrderNum     int64   `json:"repairOrderNum"`
	RepairTotalNum     int64   `json:"repairTotalNum"`
	DropNotRepairedNum int64   `json:"dropNotRepairedNum"`
	MonitoringNum      int64   `json:"monitoringNum"`
	StableEndNum       int64   `json:"stableEndNum"`
	SupersededNum      int64   `json:"supersededNum"`
	InvalidNum         int64   `json:"invalidNum"`
	ErrorNum           int64   `json:"errorNum"`
	AvgFirstDropMinute float64 `json:"avgFirstDropMinute"`
	CheckTimesNum      int64   `json:"checkTimesNum"`
}

// ShopDropMonitorRecordDTO 单次检测明细.
type ShopDropMonitorRecordDTO struct {
	BarryBaseDTO
	ShopDropMonitorID int64  `json:"shopDropMonitorId"`
	ShopID            int64  `json:"shopId"`
	OriShopID         string `json:"oriShopId,omitempty"`
	Round             int    `json:"round"`
	CheckTime         string `json:"checkTime,omitempty"`
	BaselineNum       int64  `json:"baselineNum"`
	NowNum            int64  `json:"nowNum"`
	DropNum           int64  `json:"dropNum"`
	CheckResult       string `json:"checkResult,omitempty"`
	CostMs            int64  `json:"costMs"`
	Message           string `json:"message,omitempty"`
}

type ShopDropMonitorQueryDTO struct {
	RequestDTO
	StartDate       string `json:"startDate,omitempty" form:"startDate"`
	EndDate         string `json:"endDate,omitempty" form:"endDate"`
	ShopCategoryIDs string `json:"shopCategoryIds,omitempty" form:"shopCategoryIds"`
	OriShopID       string `json:"oriShopId,omitempty" form:"oriShopId"`
	BusinessID      string `json:"businessId,omitempty" form:"businessId"`
	Status          string `json:"status,omitempty" form:"status"`
	OnlyDropped     bool   `json:"onlyDropped,omitempty" form:"onlyDropped"`
	PageIndex       int    `json:"pageIndex,omitempty" form:"pageIndex"`
	PageSize        int    `json:"pageSize,omitempty" form:"pageSize"`
}

// ShopDropMonitorRuntimeDTO 掉量监控运行健康度: 任务在不在跑、跑不跑得过来、有没有丢消息.
type ShopDropMonitorRuntimeDTO struct {
	BacklogNum              int64                     `json:"backlogNum"`
	StuckQueuedNum          int64                     `json:"stuckQueuedNum"`
	ZombieNum               int64                     `json:"zombieNum"`
	CheckingNum             int64                     `json:"checkingNum"`
	Nodes                   []*ShopDropMonitorNodeDTO `json:"nodes"`
	LastJobRunTime          string                    `json:"lastJobRunTime,omitempty"`
	LastJobNode             string                    `json:"lastJobNode,omitempty"`
	RecentJobRuns           int64                     `json:"recentJobRuns"`
	RecentDispatchSubmitted int64                     `json:"recentDispatchSubmitted"`
	RecentRequeueSubmitted  int64                     `json:"recentRequeueSubmitted"`
	RecentRecycled          int64                     `json:"recentRecycled"`
	RecentJobErrors         int64                     `json:"recentJobErrors"`
}

type ShopDropMonitorNodeDTO struct {
	OwnerNode   string `json:"ownerNode"`
	CheckingNum int64  `json:"checkingNum"`
}

// ShopDropMonitorJobRecordDTO 定时任务每一轮的运行流水.
type ShopDropMonitorJobRecordDTO struct {
	BarryBaseDTO
	Node               string `json:"node,omitempty"`
	RunTime            string `json:"runTime,omitempty"`
	CostMs             int64  `json:"costMs"`
	DispatchFetched    int    `json:"dispatchFetched"`
	DispatchMarked     int    `json:"dispatchMarked"`
	DispatchSubmitted  int    `json:"dispatchSubmitted"`
	RequeueFetched     int    `json:"requeueFetched"`
	RequeueSubmitted   int    `json:"requeueSubmitted"`
	Recycled           int    `json:"recycled"`
	RepairFilled       int    `json:"repairFilled"`
	ErrorMessage       string `json:"errorMessage,omitempty"`
}

type ShopDropMonitorJobRecordPageDTO struct {
	Total int64                          `json:"total"`
	Data  []*ShopDropMonitorJobRecordDTO `json:"data"`
}

type ShopDropMonitorJobRecordQueryDTO struct {
	RequestDTO
	StartDate string `json:"startDate,omitempty" form:"startDate"`
	EndDate   string `json:"endDate,omitempty" form:"endDate"`
	PageIndex int    `json:"pageIndex,omitempty" form:"pageIndex"`
	PageSize  int    `json:"pageSize,omitempty" form:"pageSize"`
}
