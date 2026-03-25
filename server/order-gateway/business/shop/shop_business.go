package shop

import (
	"encoding/json"
	"fmt"
	"order-gateway/model"
	"strings"

	shopService "service/shop"
)

type Business struct {
	shopService *shopService.ShopService
}

func NewBusiness() *Business {
	return &Business{
		shopService: shopService.NewShopService(),
	}
}

func (b *Business) GetByID(shopCategoryID uint) (*model.ShopModel, error) {
	shopCategory, err := b.shopService.GetShopCategoryByID(shopCategoryID)
	if err != nil {
		return nil, err
	}
	return &model.ShopModel{
		Price:      toJSONNumber(shopCategory.Price),
		Name:       shopCategory.Name,
		LowerLimit: shopCategory.LowerLimit,
		UpperLimit: shopCategory.UpperLimit,
	}, nil
}

func (b *Business) EnsureTable() error {
	if b.shopService == nil {
		return fmt.Errorf("shop service is nil")
	}
	return b.shopService.EnsureTable()
}

func toJSONNumber(value string) json.Number {
	value = strings.TrimSpace(value)
	if value == "" {
		value = "0"
	}
	return json.Number(value)
}
