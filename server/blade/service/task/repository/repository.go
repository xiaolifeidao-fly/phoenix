package repository

import (
	"common/middleware/db"
	"fmt"
)

type TaskRepository struct {
	db.Repository[*TaskRecord]
}

func (r *TaskRepository) EnsureTable() error {
	if r.Db == nil {
		return fmt.Errorf("database is not initialized")
	}
	return r.Db.AutoMigrate(&TaskRecord{})
}

func (r *TaskRepository) FindByBusinessID(businessID string) (*TaskRecord, error) {
	if r.Db == nil {
		return nil, fmt.Errorf("database is not initialized")
	}

	var entity TaskRecord
	err := r.Db.Where("business_id = ? AND active = ?", businessID, 1).First(&entity).Error
	if err != nil {
		return nil, err
	}
	return &entity, nil
}
