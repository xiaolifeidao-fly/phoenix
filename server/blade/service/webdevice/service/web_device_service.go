package service

import (
	webDeviceDTO "blade/service/webdevice/dto"
	webDeviceRepository "blade/service/webdevice/repository"
	"common/middleware/db"
)

type WebDeviceService struct {
	webDeviceRepository   *webDeviceRepository.WebDeviceRepository
	hqWebDeviceRepository *webDeviceRepository.HQWebDeviceRepository
}

func NewWebDeviceService() *WebDeviceService {
	return &WebDeviceService{
		webDeviceRepository:   db.GetRepository[webDeviceRepository.WebDeviceRepository](),
		hqWebDeviceRepository: db.GetRepository[webDeviceRepository.HQWebDeviceRepository](),
	}
}

func (s *WebDeviceService) EnsureTable() error {
	if err := s.webDeviceRepository.EnsureTable(); err != nil {
		return err
	}
	return s.hqWebDeviceRepository.EnsureTable()
}

func (s *WebDeviceService) FindByWebID(webID string) (*webDeviceDTO.WebDeviceDTO, error) {
	entity, err := s.webDeviceRepository.FindByWebID(webID)
	if err != nil {
		return nil, err
	}
	return db.ToDTO[webDeviceDTO.WebDeviceDTO](entity), nil
}

func (s *WebDeviceService) Save(device *webDeviceDTO.WebDeviceDTO) (*webDeviceDTO.WebDeviceDTO, error) {
	entity := db.ToPO[webDeviceRepository.WebDevice](device)
	saved, err := s.webDeviceRepository.SaveOrUpdate(entity)
	if err != nil {
		return nil, err
	}
	return db.ToDTO[webDeviceDTO.WebDeviceDTO](saved), nil
}

func (s *WebDeviceService) SaveHQ(device *webDeviceDTO.HQWebDeviceDTO) (*webDeviceDTO.HQWebDeviceDTO, error) {
	entity := db.ToPO[webDeviceRepository.HQWebDevice](device)
	saved, err := s.hqWebDeviceRepository.SaveOrUpdate(entity)
	if err != nil {
		return nil, err
	}
	return db.ToDTO[webDeviceDTO.HQWebDeviceDTO](saved), nil
}

func (s *WebDeviceService) FindHQByWebID(webID string) (*webDeviceDTO.HQWebDeviceDTO, error) {
	entity, err := s.hqWebDeviceRepository.FindByWebID(webID)
	if err != nil {
		return nil, err
	}
	return db.ToDTO[webDeviceDTO.HQWebDeviceDTO](entity), nil
}

func (s *WebDeviceService) ListActive() ([]*webDeviceDTO.WebDeviceDTO, error) {
	entities, err := s.webDeviceRepository.FindAllActive()
	if err != nil {
		return nil, err
	}
	return db.ToDTOs[webDeviceDTO.WebDeviceDTO](entities), nil
}

func (s *WebDeviceService) ListActiveRange(startID, limit int64) ([]*webDeviceDTO.WebDeviceDTO, error) {
	entities, err := s.webDeviceRepository.FindActiveRange(startID, limit)
	if err != nil {
		return nil, err
	}
	return db.ToDTOs[webDeviceDTO.WebDeviceDTO](entities), nil
}

func (s *WebDeviceService) ListActiveRangeWithin(startID, limit, maxID int64) ([]*webDeviceDTO.WebDeviceDTO, error) {
	entities, err := s.webDeviceRepository.FindActiveRangeWithin(startID, limit, maxID)
	if err != nil {
		return nil, err
	}
	return db.ToDTOs[webDeviceDTO.WebDeviceDTO](entities), nil
}

func (s *WebDeviceService) MinIDGreaterThan(startID int64) (int64, error) {
	return s.webDeviceRepository.MinIDGreaterThan(startID)
}
