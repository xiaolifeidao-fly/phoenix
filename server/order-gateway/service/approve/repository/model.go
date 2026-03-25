package repository

import "common/middleware/db"

type ApproveUser struct {
	db.BaseEntity
	UserID       uint64 `gorm:"column:user_id;type:bigint unsigned;index:idx_user_id"`
	UnApproveNum uint64 `gorm:"column:un_approve_num;type:bigint unsigned;default:0"`
	Status       string `gorm:"column:status;type:varchar(50)"`
}

func (a *ApproveUser) TableName() string { return "approve_user" }
