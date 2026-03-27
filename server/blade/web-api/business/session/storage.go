package session

import (
	"common/middleware/storage/oss"
	"fmt"
)

type ContentStore interface {
	Save(path string, data []byte) error
	Load(path string) ([]byte, error)
}

type OSSContentStore struct{}

func NewOSSContentStore() *OSSContentStore {
	return &OSSContentStore{}
}

func (s *OSSContentStore) Save(path string, data []byte) error {
	if len(data) == 0 {
		return fmt.Errorf("session content is empty")
	}
	return oss.Put(path, data)
}

func (s *OSSContentStore) Load(path string) ([]byte, error) {
	return oss.Get(path)
}
