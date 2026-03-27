package service

import (
	dictionaryDTO "blade/service/dictionary/dto"
	dictionaryRepository "blade/service/dictionary/repository"
	"errors"

	"common/middleware/db"
)

type DictionaryService struct {
	repository *dictionaryRepository.DictionaryRepository
}

func NewDictionaryService() *DictionaryService {
	return &DictionaryService{
		repository: db.GetRepository[dictionaryRepository.DictionaryRepository](),
	}
}

func (s *DictionaryService) EnsureTable() error {
	return s.repository.EnsureTable()
}

func (s *DictionaryService) GetByCode(code string) (*dictionaryDTO.DictionaryDTO, error) {
	dict, err := s.repository.GetByCode(code)
	if err != nil {
		return nil, err
	}
	if dict == nil {
		return nil, errors.New("not found")
	}
	return db.ToDTO[dictionaryDTO.DictionaryDTO](dict), nil
}

func (s *DictionaryService) GetByType(typeStr string) ([]dictionaryDTO.DictionaryDTO, error) {
	dicts, err := s.repository.GetByType(typeStr)
	if err != nil {
		return nil, err
	}

	dtoList := db.ToDTOs[dictionaryDTO.DictionaryDTO](dicts)
	result := make([]dictionaryDTO.DictionaryDTO, len(dtoList))
	for i, item := range dtoList {
		result[i] = *item
	}
	return result, nil
}

func (s *DictionaryService) SaveOrUpdate(dictDTO *dictionaryDTO.DictionaryDTO) error {
	dict := db.ToPO[dictionaryRepository.Dictionary](dictDTO)
	_, err := s.repository.SaveOrUpdate(dict)
	return err
}

func (s *DictionaryService) Delete(id int64) error {
	return s.repository.Delete(uint(id))
}
