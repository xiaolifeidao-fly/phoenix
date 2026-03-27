package session

import (
	sessionDTO "blade/service/session/dto"
	sessionRepository "blade/service/session/repository"
	"common/middleware/db"
)

type SessionService struct {
	repository *sessionRepository.SessionRepository
}

func NewSessionService() *SessionService {
	return &SessionService{
		repository: db.GetRepository[sessionRepository.SessionRepository](),
	}
}

func (s *SessionService) EnsureTable() error {
	return s.repository.EnsureTable()
}

func (s *SessionService) GetAllActiveSession() ([]*sessionDTO.SessionDTO, error) {
	entities, err := s.repository.FindActiveSessions()
	if err != nil {
		return nil, err
	}
	return db.ToDTOs[sessionDTO.SessionDTO](entities), nil
}

func (s *SessionService) FindByUID(uid string) (*sessionDTO.SessionDTO, error) {
	entity, err := s.repository.FindByUID(uid)
	if err != nil {
		return nil, err
	}
	return db.ToDTO[sessionDTO.SessionDTO](entity), nil
}

func (s *SessionService) FindByDeviceID(deviceID string) ([]*sessionDTO.SessionDTO, error) {
	entities, err := s.repository.FindByDeviceID(deviceID)
	if err != nil {
		return nil, err
	}
	return db.ToDTOs[sessionDTO.SessionDTO](entities), nil
}

func (s *SessionService) Create(session *sessionDTO.SessionDTO) (*sessionDTO.SessionDTO, error) {
	entity := db.ToPO[sessionRepository.SessionRecord](session)
	created, err := s.repository.Create(entity)
	if err != nil {
		return nil, err
	}
	return db.ToDTO[sessionDTO.SessionDTO](created), nil
}

func (s *SessionService) Save(session *sessionDTO.SessionDTO) (*sessionDTO.SessionDTO, error) {
	entity := db.ToPO[sessionRepository.SessionRecord](session)
	saved, err := s.repository.SaveOrUpdate(entity)
	if err != nil {
		return nil, err
	}
	return db.ToDTO[sessionDTO.SessionDTO](saved), nil
}
