package repository

import (
	"common/middleware/db"
	"fmt"

	"gorm.io/gorm"
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
	err := r.QueryOneBySQL(&dict, "SELECT * FROM dictionary WHERE code = ? AND active = 1 ORDER BY id ASC LIMIT 1", code)
	if err != nil {
		return nil, err
	}
	if dict.Id == 0 {
		return nil, gorm.ErrRecordNotFound
	}
	return &dict, nil
}

func (r *DictionaryRepository) GetByType(typeStr string) ([]*Dictionary, error) {
	if r.Db == nil {
		return nil, fmt.Errorf("database is not initialized")
	}
	var dicts []*Dictionary
	err := r.QueryBySQL(&dicts, "SELECT * FROM dictionary WHERE type = ? AND active = 1 ORDER BY id ASC", typeStr)
	return dicts, err
}
