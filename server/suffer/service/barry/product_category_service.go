package barry

import (
	"context"
	"fmt"
	"strings"

	barryDTO "suffer/service/barry/dto"
)

type ProductCategoryService struct {
	client *Client
}

func NewProductCategoryService(client *Client) *ProductCategoryService {
	return &ProductCategoryService{client: client}
}

func (s *ProductCategoryService) List(ctx context.Context, query barryDTO.ProductCategoryQueryDTO) (*barryDTO.ProductCategoryListResponseDTO, error) {
	response := &barryDTO.ProductCategoryListResponseDTO{}
	requestURL := innerServicePath(barryInnerManualListSuffixPath)
	err := s.client.GetAbsolute(ctx, requestURL, buildValues(
		"requestId", query.RequestID,
		"page", query.Page,
		"pageIndex", query.PageIndex,
		"pageSize", query.PageSize,
		"code", query.Code,
		"name", query.Name,
		"status", query.Status,
		"shopGroupId", query.ShopGroupID,
		"shopTypeCode", query.ShopTypeCode,
	), response)
	if err != nil {
		return nil, err
	}
	return response, nil
}

func (s *ProductCategoryService) Save(ctx context.Context, req *barryDTO.SaveProductCategoryDTO) (*barryDTO.ProductCategoryActionResultDTO, error) {
	if req == nil {
		return nil, fmt.Errorf("request is nil")
	}
	productTypes, err := s.fetchSelectedProductTypes(ctx, req.ShopTypeCodeList)
	if err != nil {
		return nil, err
	}
	req.ShopTypeModelList = productTypes
	response := &barryDTO.ProductCategoryActionResultDTO{}
	err = s.client.PostAbsolute(ctx, innerServicePath(barryInnerManualSaveSuffixPath), req, response)
	if err != nil {
		return nil, err
	}
	return response, nil
}

// fetchSelectedProductTypes adapts the manager's lightweight type-code input to
// Barry's legacy save contract, which requires complete shopTypeModelList entries.
func (s *ProductCategoryService) fetchSelectedProductTypes(ctx context.Context, codes []string) ([]*barryDTO.ProductTypeDTO, error) {
	response := &barryDTO.ProductTypeListResponseDTO{}
	err := s.client.GetAbsolute(ctx, innerServicePath(barryInnerShopSuffixPath), buildValues(
		"pageIndex", 1,
		"pageSize", 500,
	), response)
	if err != nil {
		return nil, err
	}
	if !response.Success {
		if message := strings.TrimSpace(response.Message); message != "" {
			return nil, fmt.Errorf("加载商品类型失败: %s", message)
		}
		return nil, fmt.Errorf("加载商品类型失败")
	}

	return resolveSelectedProductTypes(codes, response.Data)
}

func resolveSelectedProductTypes(codes []string, available []*barryDTO.ProductTypeDTO) ([]*barryDTO.ProductTypeDTO, error) {
	selectedCodes := make(map[string]struct{}, len(codes))
	for _, code := range codes {
		if code = strings.TrimSpace(code); code != "" {
			selectedCodes[code] = struct{}{}
		}
	}
	if len(selectedCodes) == 0 {
		return nil, fmt.Errorf("请选择至少一个商品类型")
	}

	productTypes := make([]*barryDTO.ProductTypeDTO, 0, len(selectedCodes))
	for _, productType := range available {
		if productType == nil {
			continue
		}
		if _, ok := selectedCodes[productType.Code]; !ok {
			continue
		}
		productTypes = append(productTypes, productType)
		delete(selectedCodes, productType.Code)
	}
	if len(selectedCodes) != 0 {
		missingCodes := make([]string, 0, len(selectedCodes))
		for code := range selectedCodes {
			missingCodes = append(missingCodes, code)
		}
		return nil, fmt.Errorf("商品类型不存在: %s", strings.Join(missingCodes, ", "))
	}
	return productTypes, nil
}

func (s *ProductCategoryService) Delete(ctx context.Context, req *barryDTO.ProductCategoryOperateDTO) (*barryDTO.ProductCategoryActionResultDTO, error) {
	return s.operate(ctx, innerServicePath(barryInnerManualDeleteSuffixPath), req)
}

func (s *ProductCategoryService) Expire(ctx context.Context, req *barryDTO.ProductCategoryOperateDTO) (*barryDTO.ProductCategoryActionResultDTO, error) {
	return s.operate(ctx, innerServicePath(barryInnerManualExpireSuffixPath), req)
}

func (s *ProductCategoryService) Active(ctx context.Context, req *barryDTO.ProductCategoryOperateDTO) (*barryDTO.ProductCategoryActionResultDTO, error) {
	return s.operate(ctx, innerServicePath(barryInnerManualActiveSuffixPath), req)
}

func (s *ProductCategoryService) operate(ctx context.Context, requestURL string, req *barryDTO.ProductCategoryOperateDTO) (*barryDTO.ProductCategoryActionResultDTO, error) {
	if req == nil {
		return nil, fmt.Errorf("request is nil")
	}
	response := &barryDTO.ProductCategoryActionResultDTO{}
	err := s.client.PostAbsolute(ctx, requestURL, req, response)
	if err != nil {
		return nil, err
	}
	return response, nil
}
