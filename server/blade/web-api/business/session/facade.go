package session

import (
	sessionService "blade/service/session"
	sessionDTO "blade/service/session/dto"
	webDeviceDTO "blade/service/webdevice/dto"
	webDeviceService "blade/service/webdevice/service"
	"errors"
	"fmt"
	"path"

	"gorm.io/gorm"
)

type Facade struct {
	sessionService   *sessionService.SessionService
	webDeviceService *webDeviceService.WebDeviceService
	store            ContentStore
}

func NewFacade() *Facade {
	return &Facade{
		sessionService:   sessionService.NewSessionService(),
		webDeviceService: webDeviceService.NewWebDeviceService(),
		store:            NewOSSContentStore(),
	}
}

func (f *Facade) EnsureTable() error {
	if err := f.sessionService.EnsureTable(); err != nil {
		return err
	}
	return f.webDeviceService.EnsureTable()
}

func (f *Facade) ListActiveSessions() ([]*sessionDTO.SessionDTO, error) {
	return f.sessionService.GetAllActiveSession()
}

func (f *Facade) SaveWebSession(payload *sessionDTO.WebSessionDTO) (*sessionDTO.WebSessionDTO, error) {
	if payload == nil {
		return nil, fmt.Errorf("web session payload is nil")
	}
	if payload.WebDevice == nil {
		return nil, fmt.Errorf("webDevice is required")
	}

	ckPath := buildCKPath(payload.DeviceId, payload.Uid)
	if err := f.store.Save(ckPath, []byte(payload.CKData)); err != nil {
		return nil, err
	}

	hqDeviceID, err := f.ensureHQWebDevice(payload.WebDevice)
	if err != nil {
		return nil, err
	}

	existing, err := f.sessionService.FindByUID(payload.Uid)
	if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, err
	}

	record := &sessionDTO.SessionDTO{
		SessionId:   payload.SessionId,
		Status:      sessionDTO.SessionStatusActive,
		EncryptData: payload.EncryptData,
		Uid:         payload.Uid,
		SecUid:      payload.SecUid,
		Token:       payload.Token,
		CkPath:      ckPath,
		DeviceId:    payload.DeviceId,
		WebDeviceId: hqDeviceID,
	}

	if existing == nil {
		_, err = f.sessionService.Create(record)
		return payload, err
	}

	record.BaseDTO = existing.BaseDTO
	_, err = f.sessionService.Save(record)
	return payload, err
}

func (f *Facade) DownloadByDeviceID(deviceID string) ([]byte, error) {
	sessions, err := f.sessionService.FindByDeviceID(deviceID)
	if err != nil {
		return nil, err
	}

	files := make(map[string]string)
	for _, item := range sessions {
		if item == nil || item.CkPath == "" || item.Uid == "" {
			continue
		}
		content, loadErr := f.store.Load(item.CkPath)
		if loadErr != nil {
			continue
		}
		files[item.Uid+".json"] = string(content)
	}

	if len(files) == 0 {
		return nil, fmt.Errorf("no valid session data found for deviceId %s", deviceID)
	}
	return BuildArchive(files)
}

func (f *Facade) ensureHQWebDevice(device *webDeviceDTO.HQWebDeviceDTO) (int, error) {
	if device == nil {
		return 0, nil
	}

	existing, err := f.webDeviceService.FindHQByWebID(device.Webid)
	if err == nil && existing != nil {
		return existing.Id, nil
	}
	if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
		return 0, err
	}

	saved, err := f.webDeviceService.SaveHQ(device)
	if err != nil {
		return 0, err
	}
	if saved == nil {
		return 0, nil
	}
	return saved.Id, nil
}

func buildCKPath(deviceID string, uid string) string {
	return path.Join(deviceID, uid+".json")
}
