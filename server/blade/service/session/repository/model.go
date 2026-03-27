package repository

import "common/middleware/db"

type SessionRecord struct {
	db.BaseEntity
	SessionId   string `gorm:"column:session_id;type:varchar(100);not null;default:'';index:idx_session_id" orm:"column(session_id);size(100)"`
	Status      string `gorm:"column:status;type:varchar(50);not null;default:'';index:idx_status" orm:"column(status);size(50)"`
	EncryptData string `gorm:"column:encrypt_data;type:text" orm:"column(encrypt_data);type(text)"`
	Uid         string `gorm:"column:uid;type:varchar(128);not null;default:'';uniqueIndex:uk_uid" orm:"column(uid);size(128)"`
	SecUid      string `gorm:"column:sec_uid;type:varchar(128);not null;default:''" orm:"column(sec_uid);size(128)"`
	Token       string `gorm:"column:token;type:text" orm:"column(token);type(text)"`
	CkPath      string `gorm:"column:ck_path;type:varchar(255);not null;default:''" orm:"column(ck_path);size(255)"`
	DeviceId    string `gorm:"column:device_id;type:varchar(128);not null;default:'';index:idx_device_id" orm:"column(device_id);size(128)"`
	WebDeviceId int    `gorm:"column:web_device_id;not null;default:0" orm:"column(web_device_id)"`
}

func (s *SessionRecord) TableName() string {
	return "session_record"
}
