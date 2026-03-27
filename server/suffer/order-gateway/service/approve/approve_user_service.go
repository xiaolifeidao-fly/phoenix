package approve

import (
	"common/middleware/db"
	"fmt"
	approveRepository "suffer/order-gateway/service/approve/repository"

	"gorm.io/gorm"
)

type ApproveUserService struct {
	approveUserRepository *approveRepository.ApproveUserRepository
}

func NewApproveUserService() *ApproveUserService {
	return &ApproveUserService{
		approveUserRepository: db.GetRepository[approveRepository.ApproveUserRepository](),
	}
}

func (s *ApproveUserService) EnsureTable() error {
	return s.approveUserRepository.EnsureTable()
}

func (s *ApproveUserService) Save(userID uint64) error {
	if userID == 0 {
		return fmt.Errorf("userId must be positive")
	}
	entity, err := s.approveUserRepository.FindByUserID(userID)
	if err == nil && entity != nil {
		entity.Active = 1
		entity.Status = "ACTIVE"
		_, err = s.approveUserRepository.SaveOrUpdate(entity)
		return err
	}
	if err != nil && err != gorm.ErrRecordNotFound {
		return err
	}
	_, err = s.approveUserRepository.Create(&approveRepository.ApproveUser{
		UserID:       userID,
		UnApproveNum: 0,
		Status:       "ACTIVE",
	})
	return err
}

func (s *ApproveUserService) Remove(userID uint64) error {
	if userID == 0 {
		return fmt.Errorf("userId must be positive")
	}
	entity, err := s.approveUserRepository.FindByUserID(userID)
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil
		}
		return err
	}
	entity.Active = 0
	_, err = s.approveUserRepository.SaveOrUpdate(entity)
	return err
}
