package repository

import (
	"common/middleware/db"
	"fmt"

	"gorm.io/gorm"
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
	err := r.QueryOneBySQL(&entity, "SELECT * FROM blade_task_record WHERE business_id = ? AND active = 1 ORDER BY id ASC LIMIT 1", businessID)
	if err != nil {
		return nil, err
	}
	if entity.Id == 0 {
		return nil, gorm.ErrRecordNotFound
	}
	return &entity, nil
}
