package approveuser

import approveService "order-gateway/service/approve"

type Business struct {
	service *approveService.ApproveUserService
}

func NewBusiness() *Business {
	service := approveService.NewApproveUserService()
	_ = service.EnsureTable()
	return &Business{service: service}
}

func (b *Business) Save(userID uint64) error {
	return b.service.Save(userID)
}

func (b *Business) Remove(userID uint64) error {
	return b.service.Remove(userID)
}
