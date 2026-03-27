package repository

import (
	"common/middleware/db"
	"fmt"
)

type WebDeviceRepository struct {
	db.Repository[*WebDevice]
}

func (r *WebDeviceRepository) EnsureTable() error {
	if r.Db == nil {
		return fmt.Errorf("database is not initialized")
	}
	return r.Db.AutoMigrate(&WebDevice{})
}

func (r *WebDeviceRepository) FindByWebID(webID string) (*WebDevice, error) {
	if r.Db == nil {
		return nil, fmt.Errorf("database is not initialized")
	}
	var entity WebDevice
	err := r.Db.Where("webid = ? AND active = ?", webID, 1).First(&entity).Error
	if err != nil {
		return nil, err
	}
	return &entity, nil
}

func (r *WebDeviceRepository) FindAllActive() ([]*WebDevice, error) {
	if r.Db == nil {
		return nil, fmt.Errorf("database is not initialized")
	}
	var entities []*WebDevice
	err := r.Db.Where("active = ?", 1).Order("id ASC").Find(&entities).Error
	return entities, err
}

func (r *WebDeviceRepository) FindActiveRange(startID, limit int64) ([]*WebDevice, error) {
	if r.Db == nil {
		return nil, fmt.Errorf("database is not initialized")
	}
	var entities []*WebDevice
	err := r.Db.Where("id > ? AND active = ?", startID, 1).
		Order("id ASC").
		Limit(int(limit)).
		Find(&entities).Error
	return entities, err
}

func (r *WebDeviceRepository) FindActiveRangeWithin(startID, limit, maxID int64) ([]*WebDevice, error) {
	if r.Db == nil {
		return nil, fmt.Errorf("database is not initialized")
	}
	var entities []*WebDevice
	err := r.Db.Where("id > ? AND id <= ? AND active = ?", startID, maxID, 1).
		Order("id ASC").
		Limit(int(limit)).
		Find(&entities).Error
	return entities, err
}

func (r *WebDeviceRepository) MinIDGreaterThan(startID int64) (int64, error) {
	if r.Db == nil {
		return 0, fmt.Errorf("database is not initialized")
	}
	var entity WebDevice
	err := r.Db.Where("id > ?", startID).Order("id ASC").First(&entity).Error
	if err != nil {
		return 0, err
	}
	return int64(entity.Id), nil
}

type HQWebDeviceRepository struct {
	db.Repository[*HQWebDevice]
}

func (r *HQWebDeviceRepository) EnsureTable() error {
	if r.Db == nil {
		return fmt.Errorf("database is not initialized")
	}
	return r.Db.AutoMigrate(&HQWebDevice{})
}

func (r *HQWebDeviceRepository) FindByWebID(webID string) (*HQWebDevice, error) {
	if r.Db == nil {
		return nil, fmt.Errorf("database is not initialized")
	}
	var entity HQWebDevice
	err := r.Db.Where("webid = ? AND active = ?", webID, 1).First(&entity).Error
	if err != nil {
		return nil, err
	}
	return &entity, nil
}
