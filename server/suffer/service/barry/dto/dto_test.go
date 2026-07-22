package dto

import (
	"testing"
)

func TestProductCategoryActionResultAcceptsBarryIDResponse(t *testing.T) {
	var response ProductCategoryActionResultDTO
	if err := response.UnmarshalJSON([]byte(`{"code":"0","data":42,"errorMsg":"操作成功"}`)); err != nil {
		t.Fatalf("UnmarshalJSON() error = %v", err)
	}
	if !response.Success || response.Code != "0" || string(response.Data) != "42" {
		t.Fatalf("unexpected response: %+v", response)
	}
}

func TestProductCategoryActionResultReadsBarryErrorMessage(t *testing.T) {
	var response ProductCategoryActionResultDTO
	if err := response.UnmarshalJSON([]byte(`{"code":"1","data":null,"errorMsg":"商品ID或编码不能为空"}`)); err != nil {
		t.Fatalf("UnmarshalJSON() error = %v", err)
	}
	if response.Success || response.Code != "1" || response.Message != "商品ID或编码不能为空" {
		t.Fatalf("unexpected response: %+v", response)
	}
}
