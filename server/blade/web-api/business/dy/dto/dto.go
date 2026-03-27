package dto

import (
	"blade/service/webdevice/dto"
	dy "blade/web-api/business/dy"
)

func NewDyBaseEntity(webDevice *dto.WebDeviceDTO, ip string, needCk bool) *dy.DyBaseEntity {
	dyBaseEntity := &dy.DyBaseEntity{
		NeedCk:    needCk,
		WebDevice: webDevice,
		Ip:        ip,
	}
	return dyBaseEntity
}
