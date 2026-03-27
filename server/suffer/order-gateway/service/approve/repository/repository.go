package repository

import (
	"common/middleware/db"
	"fmt"

	"gorm.io/gorm"
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
	if err := r.QueryOneBySQL(&entity, "SELECT * FROM approve_user WHERE user_id = ? AND active = 1 ORDER BY id ASC LIMIT 1", userID); err != nil {
		return nil, err
	}
	if entity.Id == 0 {
		return nil, gorm.ErrRecordNotFound
	}
	return &entity, nil
}
