package repository

import (
	"common/middleware/db"
	"fmt"
)

type ApproveUserRepository struct {
	db.Repository[*ApproveUser]
}

func (r *ApproveUserRepository) EnsureTable() error {
	if r.Db == nil {
		return fmt.Errorf("database is not initialized")
	}
	return r.Db.AutoMigrate(&ApproveUser{})
}

func (r *ApproveUserRepository) FindByUserID(userID uint64) (*ApproveUser, error) {
	if r.Db == nil {
		return nil, fmt.Errorf("database is not initialized")
	}
	var entity ApproveUser
	if err := r.Db.Where("user_id = ? AND active = ?", userID, 1).First(&entity).Error; err != nil {
		return nil, err
	}
	return &entity, nil
}
