package repository

import (
	"common/middleware/db"
	"fmt"
)

type DictionaryRepository struct {
	db.Repository[*Dictionary]
}

func (r *DictionaryRepository) EnsureTable() error {
	if r.Db == nil {
		return fmt.Errorf("database is not initialized")
	}
	return r.Db.AutoMigrate(&Dictionary{})
}

func (r *DictionaryRepository) GetByCode(code string) (*Dictionary, error) {
	if r.Db == nil {
		return nil, fmt.Errorf("database is not initialized")
	}
	var dict Dictionary
	err := r.Db.Where("code = ? AND active = ?", code, 1).First(&dict).Error
	if err != nil {
		return nil, err
	}
	return &dict, nil
}

func (r *DictionaryRepository) GetByType(typeStr string) ([]*Dictionary, error) {
	if r.Db == nil {
		return nil, fmt.Errorf("database is not initialized")
	}
	var dicts []*Dictionary
	err := r.Db.Where("type = ? AND active = ?", typeStr, 1).Order("id ASC").Find(&dicts).Error
	return dicts, err
}
