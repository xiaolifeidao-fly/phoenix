package repository

import (
	"common/middleware/db"
	"fmt"
)

type SessionRepository struct {
	db.Repository[*SessionRecord]
}

func (r *SessionRepository) EnsureTable() error {
	if r.Db == nil {
		return fmt.Errorf("database is not initialized")
	}
	return r.Db.AutoMigrate(&SessionRecord{})
}

func (r *SessionRepository) FindByUID(uid string) (*SessionRecord, error) {
	if r.Db == nil {
		return nil, fmt.Errorf("database is not initialized")
	}
	var entity SessionRecord
	err := r.Db.Where("uid = ? AND active = ?", uid, 1).First(&entity).Error
	if err != nil {
		return nil, err
	}
	return &entity, nil
}

func (r *SessionRepository) FindActiveSessions() ([]*SessionRecord, error) {
	if r.Db == nil {
		return nil, fmt.Errorf("database is not initialized")
	}
	var entities []*SessionRecord
	err := r.Db.Where("status = ? AND active = ?", "ACTIVE", 1).
		Order("id ASC").
		Find(&entities).Error
	return entities, err
}

func (r *SessionRepository) FindByDeviceID(deviceID string) ([]*SessionRecord, error) {
	if r.Db == nil {
		return nil, fmt.Errorf("database is not initialized")
	}
	var entities []*SessionRecord
	err := r.Db.Where("device_id = ? AND active = ?", deviceID, 1).
		Order("id ASC").
		Find(&entities).Error
	return entities, err
}
