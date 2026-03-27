package repository

import (
	"common/middleware/db"
	"fmt"

	"gorm.io/gorm"
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
	err := r.QueryOneBySQL(&entity, "SELECT * FROM web_device WHERE webid = ? AND active = 1 ORDER BY id ASC LIMIT 1", webID)
	if err != nil {
		return nil, err
	}
	if entity.Id == 0 {
		return nil, gorm.ErrRecordNotFound
	}
	return &entity, nil
}

func (r *WebDeviceRepository) FindAllActive() ([]*WebDevice, error) {
	if r.Db == nil {
		return nil, fmt.Errorf("database is not initialized")
	}
	var entities []*WebDevice
	err := r.QueryBySQL(&entities, "SELECT * FROM web_device WHERE active = 1 ORDER BY id ASC")
	return entities, err
}

func (r *WebDeviceRepository) FindActiveRange(startID, limit int64) ([]*WebDevice, error) {
	if r.Db == nil {
		return nil, fmt.Errorf("database is not initialized")
	}
	var entities []*WebDevice
	err := r.QueryBySQL(&entities, "SELECT * FROM web_device WHERE id > ? AND active = 1 ORDER BY id ASC LIMIT ?", startID, limit)
	return entities, err
}

func (r *WebDeviceRepository) FindActiveRangeWithin(startID, limit, maxID int64) ([]*WebDevice, error) {
	if r.Db == nil {
		return nil, fmt.Errorf("database is not initialized")
	}
	var entities []*WebDevice
	err := r.QueryBySQL(&entities, "SELECT * FROM web_device WHERE id > ? AND id <= ? AND active = 1 ORDER BY id ASC LIMIT ?", startID, maxID, limit)
	return entities, err
}

func (r *WebDeviceRepository) MinIDGreaterThan(startID int64) (int64, error) {
	if r.Db == nil {
		return 0, fmt.Errorf("database is not initialized")
	}
	var entity WebDevice
	err := r.QueryOneBySQL(&entity, "SELECT id FROM web_device WHERE id > ? ORDER BY id ASC LIMIT 1", startID)
	if err != nil {
		return 0, err
	}
	if entity.Id == 0 {
		return 0, gorm.ErrRecordNotFound
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
	err := r.QueryOneBySQL(&entity, "SELECT * FROM hq_web_device WHERE webid = ? AND active = 1 ORDER BY id ASC LIMIT 1", webID)
	if err != nil {
		return nil, err
	}
	if entity.Id == 0 {
		return nil, gorm.ErrRecordNotFound
	}
	return &entity, nil
}
