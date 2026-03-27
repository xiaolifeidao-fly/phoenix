package dto

import (
	webDeviceDTO "blade/service/webdevice/dto"
	baseDTO "common/base/dto"
)

const (
	SessionStatusActive   = "ACTIVE"
	SessionStatusInactive = "INACTIVE"
)

type SessionDTO struct {
	baseDTO.BaseDTO
	SessionId   string `json:"session_id"`
	Status      string `json:"status"`
	EncryptData string `json:"encryptData"`
	Uid         string `json:"uid"`
	SecUid      string `json:"secUid"`
	Token       string `json:"token"`
	CkPath      string `json:"ckPath"`
	DeviceId    string `json:"deviceId"`
	WebDeviceId int    `json:"webDeviceId"`
}

type WebSessionDTO struct {
	DeviceId    string                       `json:"deviceId" binding:"required"`
	EncryptData string                       `json:"encryptData"`
	SessionId   string                       `json:"sessionId" binding:"required"`
	Uid         string                       `json:"uid" binding:"required"`
	SecUid      string                       `json:"secUid"`
	Token       string                       `json:"token"`
	WebDevice   *webDeviceDTO.HQWebDeviceDTO `json:"webDevice"`
	CKData      string                       `json:"ckData" binding:"required"`
}
