package tenant

import (
	baseDTO "common/base/dto"
	"common/middleware/db"
	"fmt"
	shopRepository "service/shop/repository"
	tenantDTO "service/tenant/dto"
	tenantRepository "service/tenant/repository"
	"strings"

	"gorm.io/gorm"
)

type TenantService struct {
	tenantRepository             *tenantRepository.TenantRepository
	shopCategoryRepository       *shopRepository.ShopCategoryRepository
	tenantShopCategoryRepository *shopRepository.TenantShopCategoryRepository
}

func NewTenantService() *TenantService {
	return &TenantService{
		tenantRepository:             db.GetRepository[tenantRepository.TenantRepository](),
		shopCategoryRepository:       db.GetRepository[shopRepository.ShopCategoryRepository](),
		tenantShopCategoryRepository: db.GetRepository[shopRepository.TenantShopCategoryRepository](),
	}
}

func (s *TenantService) EnsureTable() error {
	return s.tenantRepository.EnsureTable()
}

func (s *TenantService) ListTenants(query tenantDTO.TenantQueryDTO) (*baseDTO.PageDTO[tenantDTO.TenantDTO], error) {
	if s.tenantRepository.Db == nil {
		return nil, fmt.Errorf("database is not initialized")
	}
	pageIndex, pageSize := normalizeTenantPage(query.Page, query.PageIndex, query.PageSize)

	dbQuery := s.tenantRepository.Db.Model(&tenantRepository.Tenant{}).Where("active = ?", 1)
	if code := strings.TrimSpace(query.Code); code != "" {
		dbQuery = dbQuery.Where("code LIKE ?", "%"+code+"%")
	}
	if name := strings.TrimSpace(query.Name); name != "" {
		dbQuery = dbQuery.Where("name LIKE ?", "%"+name+"%")
	}

	var total int64
	if err := dbQuery.Count(&total).Error; err != nil {
		return nil, err
	}
	var entities []*tenantRepository.Tenant
	if err := dbQuery.Order("id DESC").Offset((pageIndex - 1) * pageSize).Limit(pageSize).Find(&entities).Error; err != nil {
		return nil, err
	}

	dtos := db.ToDTOs[tenantDTO.TenantDTO](entities)
	if len(dtos) == 0 {
		return baseDTO.BuildPage(int(total), dtos), nil
	}

	categoryMap, err := s.listTenantCategoryMap(dtos)
	if err != nil {
		return nil, err
	}
	for _, item := range dtos {
		item.CurrentCategories = categoryMap[uint64(item.Id)]
	}
	return baseDTO.BuildPage(int(total), dtos), nil
}

func (s *TenantService) GetTenantByID(id uint) (*tenantDTO.TenantDTO, error) {
	entity, err := s.tenantRepository.FindById(id)
	if err != nil {
		return nil, err
	}
	if entity.Active == 0 {
		return nil, gorm.ErrRecordNotFound
	}
	return db.ToDTO[tenantDTO.TenantDTO](entity), nil
}

func (s *TenantService) CreateTenant(req *tenantDTO.CreateTenantDTO) (*tenantDTO.TenantDTO, error) {
	if s.tenantRepository.Db == nil {
		return nil, fmt.Errorf("database is not initialized")
	}
	if req == nil {
		return nil, fmt.Errorf("request is nil")
	}
	code := strings.TrimSpace(req.Code)
	name := strings.TrimSpace(req.Name)
	if code == "" {
		return nil, fmt.Errorf("tenant code is required")
	}
	if name == "" {
		return nil, fmt.Errorf("tenant name is required")
	}
	if exists, err := s.tenantCodeExists(code, 0); err != nil {
		return nil, err
	} else if exists {
		return nil, fmt.Errorf("tenant code already exists")
	}
	created, err := s.tenantRepository.Create(&tenantRepository.Tenant{
		Code: code,
		Name: name,
	})
	if err != nil {
		return nil, err
	}
	return db.ToDTO[tenantDTO.TenantDTO](created), nil
}

func (s *TenantService) UpdateTenant(id uint, req *tenantDTO.UpdateTenantDTO) (*tenantDTO.TenantDTO, error) {
	if req == nil {
		return nil, fmt.Errorf("request is nil")
	}
	entity, err := s.tenantRepository.FindById(id)
	if err != nil {
		return nil, err
	}
	if entity.Active == 0 {
		return nil, gorm.ErrRecordNotFound
	}
	if req.Code != nil {
		code := strings.TrimSpace(*req.Code)
		if code == "" {
			return nil, fmt.Errorf("tenant code is required")
		}
		if exists, err := s.tenantCodeExists(code, uint(id)); err != nil {
			return nil, err
		} else if exists {
			return nil, fmt.Errorf("tenant code already exists")
		}
		entity.Code = code
	}
	if req.Name != nil {
		name := strings.TrimSpace(*req.Name)
		if name == "" {
			return nil, fmt.Errorf("tenant name is required")
		}
		entity.Name = name
	}
	saved, err := s.tenantRepository.SaveOrUpdate(entity)
	if err != nil {
		return nil, err
	}
	return db.ToDTO[tenantDTO.TenantDTO](saved), nil
}

func (s *TenantService) DeleteTenant(id uint) error {
	entity, err := s.tenantRepository.FindById(id)
	if err != nil {
		return err
	}
	if entity.Active == 0 {
		return gorm.ErrRecordNotFound
	}
	entity.Active = 0
	_, err = s.tenantRepository.SaveOrUpdate(entity)
	return err
}

func (s *TenantService) ListTenantCategoryBindings(tenantID uint) ([]tenantDTO.TenantCategoryBindingDTO, error) {
	if s.tenantShopCategoryRepository.Db == nil {
		return nil, fmt.Errorf("database is not initialized")
	}
	if _, err := s.GetTenantByID(tenantID); err != nil {
		return nil, err
	}
	return s.queryTenantCategoryBindings([]uint64{uint64(tenantID)})
}

func (s *TenantService) SaveTenantCategoryBindings(tenantID uint, req *tenantDTO.SaveTenantCategoryBindingsDTO) ([]tenantDTO.TenantCategoryBindingDTO, error) {
	if s.tenantShopCategoryRepository.Db == nil {
		return nil, fmt.Errorf("database is not initialized")
	}
	if req == nil {
		return nil, fmt.Errorf("request is nil")
	}
	if _, err := s.GetTenantByID(tenantID); err != nil {
		return nil, err
	}

	categoryIDs := uniqueUint64s(req.ShopCategoryIDs)
	if err := s.validateShopCategoryIDs(categoryIDs); err != nil {
		return nil, err
	}

	tx := s.tenantShopCategoryRepository.Db.Begin()
	if tx.Error != nil {
		return nil, tx.Error
	}

	if err := tx.Model(&shopRepository.TenantShopCategory{}).
		Where("tenant_id = ? AND active = ?", tenantID, 1).
		Update("active", 0).Error; err != nil {
		tx.Rollback()
		return nil, err
	}

	for _, categoryID := range categoryIDs {
		entity := &shopRepository.TenantShopCategory{
			TenantID:       uint64(tenantID),
			ShopCategoryID: categoryID,
		}
		entity.Init()
		if err := tx.Create(entity).Error; err != nil {
			tx.Rollback()
			return nil, err
		}
	}

	if err := tx.Commit().Error; err != nil {
		return nil, err
	}

	return s.queryTenantCategoryBindings([]uint64{uint64(tenantID)})
}

func (s *TenantService) tenantCodeExists(code string, excludeID uint) (bool, error) {
	var count int64
	query := s.tenantRepository.Db.Model(&tenantRepository.Tenant{}).
		Where("active = ? AND code = ?", 1, code)
	if excludeID > 0 {
		query = query.Where("id <> ?", excludeID)
	}
	if err := query.Count(&count).Error; err != nil {
		return false, err
	}
	return count > 0, nil
}

func (s *TenantService) validateShopCategoryIDs(categoryIDs []uint64) error {
	if len(categoryIDs) == 0 {
		return nil
	}
	var count int64
	if err := s.shopCategoryRepository.Db.Model(&shopRepository.ShopCategory{}).
		Where("active = ? AND id IN ?", 1, categoryIDs).
		Count(&count).Error; err != nil {
		return err
	}
	if count != int64(len(categoryIDs)) {
		return fmt.Errorf("some shop categories were not found")
	}
	return nil
}

func (s *TenantService) listTenantCategoryMap(tenants []*tenantDTO.TenantDTO) (map[uint64][]tenantDTO.TenantCategoryBindingDTO, error) {
	tenantIDs := make([]uint64, 0, len(tenants))
	for _, item := range tenants {
		tenantIDs = append(tenantIDs, uint64(item.Id))
	}
	rows, err := s.queryTenantCategoryBindings(tenantIDs)
	if err != nil {
		return nil, err
	}

	result := make(map[uint64][]tenantDTO.TenantCategoryBindingDTO, len(tenantIDs))
	for _, row := range rows {
		result[row.TenantID] = append(result[row.TenantID], row)
	}
	return result, nil
}

func (s *TenantService) queryTenantCategoryBindings(tenantIDs []uint64) ([]tenantDTO.TenantCategoryBindingDTO, error) {
	if len(tenantIDs) == 0 {
		return []tenantDTO.TenantCategoryBindingDTO{}, nil
	}

	type tenantCategoryBindingRow struct {
		ID               uint64 `gorm:"column:id"`
		TenantID         uint64 `gorm:"column:tenant_id"`
		ShopID           int64  `gorm:"column:shop_id"`
		ShopName         string `gorm:"column:shop_name"`
		ShopCategoryID   uint64 `gorm:"column:shop_category_id"`
		ShopCategoryName string `gorm:"column:shop_category_name"`
		Status           string `gorm:"column:status"`
	}

	var rows []tenantCategoryBindingRow
	err := s.tenantShopCategoryRepository.Db.
		Table("tenant_shop_category tsc").
		Select(`
			tsc.id,
			tsc.tenant_id,
			sc.shop_id,
			s.name AS shop_name,
			tsc.shop_category_id,
			sc.name AS shop_category_name,
			sc.status
		`).
		Joins("LEFT JOIN shop_category sc ON sc.id = tsc.shop_category_id AND sc.active = 1").
		Joins("LEFT JOIN shop s ON s.id = sc.shop_id AND s.active = 1").
		Where("tsc.active = ? AND tsc.tenant_id IN ?", 1, tenantIDs).
		Order("tsc.id DESC").
		Scan(&rows).Error
	if err != nil {
		return nil, err
	}

	result := make([]tenantDTO.TenantCategoryBindingDTO, 0, len(rows))
	for _, row := range rows {
		result = append(result, tenantDTO.TenantCategoryBindingDTO{
			ID:               row.ID,
			TenantID:         row.TenantID,
			ShopID:           row.ShopID,
			ShopName:         row.ShopName,
			ShopCategoryID:   row.ShopCategoryID,
			ShopCategoryName: row.ShopCategoryName,
			Status:           row.Status,
		})
	}
	return result, nil
}

func uniqueUint64s(values []uint64) []uint64 {
	if len(values) == 0 {
		return []uint64{}
	}
	result := make([]uint64, 0, len(values))
	seen := make(map[uint64]struct{}, len(values))
	for _, value := range values {
		if value == 0 {
			continue
		}
		if _, exists := seen[value]; exists {
			continue
		}
		seen[value] = struct{}{}
		result = append(result, value)
	}
	return result
}

func normalizeTenantPage(page, pageIndex, pageSize int) (int, int) {
	if pageIndex <= 0 {
		pageIndex = page
	}
	if pageIndex <= 0 {
		pageIndex = 1
	}
	if pageSize <= 0 {
		pageSize = 20
	}
	if pageSize > 200 {
		pageSize = 200
	}
	return pageIndex, pageSize
}
