package webdevice

import (
	sessionDTO "blade/service/session/dto"
	webDeviceDTO "blade/service/webdevice/dto"
	webDeviceService "blade/service/webdevice/service"
	sessionBusiness "blade/web-api/business/session"
	"common/utils"
	"encoding/json"
	"errors"

	"gorm.io/gorm"
)

type Facade struct {
	webDeviceService *webDeviceService.WebDeviceService
	sessionFacade    *sessionBusiness.Facade
}

func NewFacade() *Facade {
	return &Facade{
		webDeviceService: webDeviceService.NewWebDeviceService(),
		sessionFacade:    sessionBusiness.NewFacade(),
	}
}

func (f *Facade) EnsureTable() error {
	if err := f.webDeviceService.EnsureTable(); err != nil {
		return err
	}
	return f.sessionFacade.EnsureTable()
}

func (f *Facade) Save(device *webDeviceDTO.WebDeviceDTO) (*webDeviceDTO.WebDeviceDTO, error) {
	existing, err := f.webDeviceService.FindByWebID(device.Webid)
	if err == nil && existing != nil {
		return existing, nil
	}
	if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, err
	}
	return f.webDeviceService.Save(device)
}

func (f *Facade) List() ([]*webDeviceDTO.WebDeviceDTO, error) {
	return f.webDeviceService.ListActive()
}

func (f *Facade) SaveEncryptedSessionLog(encryptData string) (*sessionDTO.WebSessionDTO, error) {
	payload, err := DecryptWebSession(encryptData)
	if err != nil {
		return nil, err
	}
	return f.sessionFacade.SaveWebSession(payload)
}

func (f *Facade) DownloadSessionArchive(deviceID string) ([]byte, error) {
	return f.sessionFacade.DownloadByDeviceID(deviceID)
}

func DecryptWebSession(encryptData string) (*sessionDTO.WebSessionDTO, error) {
	plaintext, err := utils.DecryptContent(encryptData)
	if err != nil {
		return nil, err
	}

	var payload sessionDTO.WebSessionDTO
	if err = json.Unmarshal([]byte(plaintext), &payload); err != nil {
		return nil, err
	}
	return &payload, nil
}
