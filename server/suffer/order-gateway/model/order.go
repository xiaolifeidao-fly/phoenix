package model

import "encoding/json"

type OrderRequestModel struct {
	OrderNo       string                 `json:"orderNo" form:"orderNo"`
	StartNum      int64                  `json:"startNum" form:"startNum"`
	EndNum        int64                  `json:"endNum" form:"endNum"`
	TotalNum      int64                  `json:"totalNum" form:"totalNum"`
	Status        string                 `json:"status" form:"status"`
	BusinessKey   string                 `json:"businessKey" form:"businessKey"`
	EncryptionKey string                 `json:"encryptionKey" form:"encryptionKey"`
	ShopKey       string                 `json:"shopKey" form:"shopKey"`
	UserName      string                 `json:"userName" form:"userName"`
	Params        map[string]interface{} `json:"params" form:"-"`
}

type OrderResponseModel struct {
	OrderNo     string      `json:"orderNo"`
	BusinessKey string      `json:"businessKey"`
	TotalNum    int64       `json:"totalNum"`
	StartNum    int64       `json:"startNum"`
	EndNum      int64       `json:"endNum"`
	OrderAmt    json.Number `json:"orderAmt"`
	RefundAmt   json.Number `json:"refundAmt,omitempty"`
	Status      string      `json:"status"`
	StatusDesc  string      `json:"statusDesc"`
	Params      interface{} `json:"params,omitempty"`
}

type OrderRefundResponseModel struct {
	OrderNo       string      `json:"orderNo"`
	Status        string      `json:"status"`
	RefundAmt     json.Number `json:"refundAmt"`
	OrderRefundNo string      `json:"orderRefundNo"`
}

type ShopModel struct {
	Price      json.Number `json:"price"`
	Name       string      `json:"name"`
	LowerLimit int64       `json:"lowerLimit"`
	UpperLimit int64       `json:"upperLimit"`
}
