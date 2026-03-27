package dto

import (
	baseDTO "common/base/dto"
	"time"
)

type WebDeviceDTO struct {
	baseDTO.BaseDTO
	DevicePlatform    string    `json:"device_platform"`
	Aid               string    `json:"aid"`
	Channel           string    `json:"channel"`
	Source            string    `json:"source"`
	UpdateVersionCode string    `json:"update_version_code"`
	PcClientType      string    `json:"pc_client_type"`
	VersionCode       string    `json:"version_code"`
	VersionName       string    `json:"version_name"`
	CookieEnabled     string    `json:"cookie_enabled"`
	ScreenWidth       string    `json:"screen_width"`
	ScreenHeight      string    `json:"screen_height"`
	BrowserLanguage   string    `json:"browser_language"`
	BrowserPlatform   string    `json:"browser_platform"`
	BrowserName       string    `json:"browser_name"`
	BrowserVersion    string    `json:"browser_version"`
	BrowserOnline     string    `json:"browser_online"`
	EngineName        string    `json:"engine_name"`
	EngineVersion     string    `json:"engine_version"`
	OsName            string    `json:"os_name"`
	OsVersion         string    `json:"os_version"`
	CpuCoreNum        string    `json:"cpu_core_num"`
	DeviceMemory      string    `json:"device_memory"`
	Platform          string    `json:"platform"`
	Downlink          string    `json:"downlink"`
	EffectiveType     string    `json:"effective_type"`
	RoundTripTime     string    `json:"round_trip_time"`
	Webid             string    `json:"webid"`
	Uifid             string    `json:"uifid"`
	VerifyFp          string    `json:"verify_fp"`
	Fp                string    `json:"fp"`
	Ttwid             string    `json:"ttwid"`
	OdinTt            string    `json:"odin_tt"`
	UserAgent         string    `json:"user_agent"`
	ProxyIp           string    `json:"proxy_ip"`
	Cookie            string    `json:"cookie"`
	PcLibraDivert     string    `json:"pc_libra_divert"`
	SecChUaPlatform   string    `json:"sec_ch_ua_platform"`
	SecChUa           string    `json:"sec_ch_ua"`
	ExpireTime        time.Time `json:"expire_time"`
}

type HQWebDeviceDTO struct {
	baseDTO.BaseDTO
	DevicePlatform    string    `json:"devicePlatform"`
	Aid               string    `json:"aid"`
	Channel           string    `json:"channel"`
	Source            string    `json:"source"`
	UpdateVersionCode string    `json:"updateVersionCode"`
	PcClientType      string    `json:"pcClientType"`
	VersionCode       string    `json:"versionCode"`
	VersionName       string    `json:"versionName"`
	CookieEnabled     string    `json:"cookieEnabled"`
	ScreenWidth       string    `json:"screenWidth"`
	ScreenHeight      string    `json:"screenHeight"`
	BrowserLanguage   string    `json:"browserLanguage"`
	BrowserPlatform   string    `json:"browserPlatform"`
	BrowserName       string    `json:"browserName"`
	BrowserVersion    string    `json:"browserVersion"`
	BrowserOnline     string    `json:"browserOnline"`
	EngineName        string    `json:"engineName"`
	EngineVersion     string    `json:"engineVersion"`
	OsName            string    `json:"osName"`
	OsVersion         string    `json:"osVersion"`
	CpuCoreNum        string    `json:"cpuCoreNum"`
	DeviceMemory      string    `json:"deviceMemory"`
	Platform          string    `json:"platform"`
	Downlink          string    `json:"downlink"`
	EffectiveType     string    `json:"effectiveType"`
	RoundTripTime     string    `json:"roundTripTime"`
	Webid             string    `json:"webid"`
	Uifid             string    `json:"uifid"`
	VerifyFp          string    `json:"verifyFp"`
	Fp                string    `json:"fp"`
	Ttwid             string    `json:"ttwid"`
	OdinTt            string    `json:"odinTt"`
	UserAgent         string    `json:"userAgent"`
	ProxyIp           string    `json:"proxyIp"`
	Cookie            string    `json:"cookie"`
	PcLibraDivert     string    `json:"pcLibraDivert"`
	SecChUaPlatform   string    `json:"secChUaPlatform"`
	SecChUa           string    `json:"secChUa"`
	ExpireTime        time.Time `json:"expireTime"`
}

type EncryptedRequest struct {
	EncryptData string `json:"encryptData" binding:"required"`
}
