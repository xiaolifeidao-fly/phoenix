package repository

import (
	"common/middleware/db"
	"fmt"

	"gorm.io/gorm"
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
	err := r.QueryOneBySQL(&entity, "SELECT * FROM session_record WHERE uid = ? AND active = 1 ORDER BY id ASC LIMIT 1", uid)
	if err != nil {
		return nil, err
	}
	if entity.Id == 0 {
		return nil, gorm.ErrRecordNotFound
	}
	return &entity, nil
}

func (r *SessionRepository) FindActiveSessions() ([]*SessionRecord, error) {
	if r.Db == nil {
		return nil, fmt.Errorf("database is not initialized")
	}
	var entities []*SessionRecord
	err := r.QueryBySQL(&entities, "SELECT * FROM session_record WHERE status = ? AND active = 1 ORDER BY id ASC", "ACTIVE")
	return entities, err
}

func (r *SessionRepository) FindByDeviceID(deviceID string) ([]*SessionRecord, error) {
	if r.Db == nil {
		return nil, fmt.Errorf("database is not initialized")
	}
	var entities []*SessionRecord
	err := r.QueryBySQL(&entities, "SELECT * FROM session_record WHERE device_id = ? AND active = 1 ORDER BY id ASC", deviceID)
	return entities, err
}
