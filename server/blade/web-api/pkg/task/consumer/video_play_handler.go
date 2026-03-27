package consumer

import (
	webDeviceDTO "blade/service/webdevice/dto"
	webDeviceService "blade/service/webdevice/service"
	dy "blade/web-api/business/dy"
	dyDTO "blade/web-api/business/dy/dto"
	ipBusiness "blade/web-api/business/ip"
	"context"
	"fmt"
	"log"
	"strings"
	"sync/atomic"
)

const (
	TaskTypeVideoPlay = "video_play"
)

var videoPlayWebDeviceCursor uint64

type VideoPlayTaskUnitHandler struct {
	webDeviceService *webDeviceService.WebDeviceService
	ipManager        *ipBusiness.V2Manager
}

func NewVideoPlayTaskUnitHandler() *VideoPlayTaskUnitHandler {
	return &VideoPlayTaskUnitHandler{
		webDeviceService: webDeviceService.NewWebDeviceService(),
		ipManager:        ipBusiness.GetDefaultV2Manager(),
	}
}

func (h *VideoPlayTaskUnitHandler) Handle(ctx context.Context, unit *TaskUnit) error {
	if unit == nil || unit.Task == nil {
		return fmt.Errorf("task unit is nil")
	}
	if err := ctx.Err(); err != nil {
		return err
	}

	videoID := strings.TrimSpace(unit.Task.BusinessID)
	if videoID == "" {
		return fmt.Errorf("businessId is empty")
	}

	device, err := h.pickWebDevice()
	if err != nil {
		return err
	}

	ipAddress, err := h.pickIP(device.ProxyIp)
	if err != nil {
		return err
	}

	videoInfo := &dy.VideoInfo{
		DyBaseEntity: dyDTO.NewDyBaseEntity(device, ipAddress, false),
		VideoId:      videoID,
	}

	result, err := dy.PlayerVideo(videoInfo)
	if err != nil {
		return err
	}

	if err = validateVideoPlayResult(result); err != nil {
		return err
	}

	log.Printf(
		"video play task processed, businessId=%s worker=%d index=%d webDeviceId=%d ip=%s",
		videoID,
		unit.WorkerID,
		unit.Index,
		device.Id,
		ipAddress,
	)
	return nil
}

func (h *VideoPlayTaskUnitHandler) pickWebDevice() (*webDeviceDTO.WebDeviceDTO, error) {
	devices, err := h.webDeviceService.ListActive()
	if err != nil {
		return nil, err
	}
	if len(devices) == 0 {
		return nil, fmt.Errorf("no active web device available")
	}

	index := int(atomic.AddUint64(&videoPlayWebDeviceCursor, 1)-1) % len(devices)
	device := devices[index]
	if device == nil {
		return nil, fmt.Errorf("selected web device is nil")
	}
	return device, nil
}

func (h *VideoPlayTaskUnitHandler) pickIP(deviceProxyIP string) (string, error) {
	if ipBusiness.IsV2Enabled() {
		item, err := h.ipManager.GetByScene(ipBusiness.SceneCurrentValue)
		if err == nil && item != nil && strings.TrimSpace(item.Ip) != "" {
			return strings.TrimSpace(item.Ip), nil
		}
		if err != nil {
			log.Printf("video play task fallback to device proxy ip after ip manager error: %v", err)
		}
	}

	if strings.TrimSpace(deviceProxyIP) != "" {
		return strings.TrimSpace(deviceProxyIP), nil
	}
	return "", fmt.Errorf("no available proxy ip")
}

func validateVideoPlayResult(result map[string]any) error {
	if len(result) == 0 {
		return fmt.Errorf("play video response is empty")
	}

	statusCode, ok := result["status_code"]
	if !ok {
		return nil
	}

	switch value := statusCode.(type) {
	case float64:
		if value != 0 {
			return fmt.Errorf("play video status_code=%v", value)
		}
	case int:
		if value != 0 {
			return fmt.Errorf("play video status_code=%v", value)
		}
	case int32:
		if value != 0 {
			return fmt.Errorf("play video status_code=%v", value)
		}
	case int64:
		if value != 0 {
			return fmt.Errorf("play video status_code=%v", value)
		}
	}

	return nil
}
