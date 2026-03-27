package repository

import (
	"common/middleware/db"
	"time"
)

type webDeviceFields struct {
	DevicePlatform    string    `gorm:"column:device_platform;type:varchar(32);not null;default:''" orm:"column(device_platform);size(32)"`
	Aid               string    `gorm:"column:aid;type:varchar(32);not null;default:''" orm:"column(aid);size(32)"`
	Channel           string    `gorm:"column:channel;type:varchar(32);not null;default:''" orm:"column(channel);size(32)"`
	Source            string    `gorm:"column:source;type:varchar(32);not null;default:''" orm:"column(source);size(32)"`
	UpdateVersionCode string    `gorm:"column:update_version_code;type:varchar(32);not null;default:''" orm:"column(update_version_code);size(32)"`
	PcClientType      string    `gorm:"column:pc_client_type;type:varchar(32);not null;default:''" orm:"column(pc_client_type);size(32)"`
	VersionCode       string    `gorm:"column:version_code;type:varchar(32);not null;default:''" orm:"column(version_code);size(32)"`
	VersionName       string    `gorm:"column:version_name;type:varchar(32);not null;default:''" orm:"column(version_name);size(32)"`
	CookieEnabled     string    `gorm:"column:cookie_enabled;type:varchar(32);not null;default:''" orm:"column(cookie_enabled);size(32)"`
	ScreenWidth       string    `gorm:"column:screen_width;type:varchar(32);not null;default:''" orm:"column(screen_width);size(32)"`
	ScreenHeight      string    `gorm:"column:screen_height;type:varchar(32);not null;default:''" orm:"column(screen_height);size(32)"`
	BrowserLanguage   string    `gorm:"column:browser_language;type:varchar(32);not null;default:''" orm:"column(browser_language);size(32)"`
	BrowserPlatform   string    `gorm:"column:browser_platform;type:varchar(32);not null;default:''" orm:"column(browser_platform);size(32)"`
	BrowserName       string    `gorm:"column:browser_name;type:varchar(32);not null;default:''" orm:"column(browser_name);size(32)"`
	BrowserVersion    string    `gorm:"column:browser_version;type:varchar(32);not null;default:''" orm:"column(browser_version);size(32)"`
	BrowserOnline     string    `gorm:"column:browser_online;type:varchar(32);not null;default:''" orm:"column(browser_online);size(32)"`
	EngineName        string    `gorm:"column:engine_name;type:varchar(32);not null;default:''" orm:"column(engine_name);size(32)"`
	EngineVersion     string    `gorm:"column:engine_version;type:varchar(32);not null;default:''" orm:"column(engine_version);size(32)"`
	OsName            string    `gorm:"column:os_name;type:varchar(32);not null;default:''" orm:"column(os_name);size(32)"`
	OsVersion         string    `gorm:"column:os_version;type:varchar(32);not null;default:''" orm:"column(os_version);size(32)"`
	CpuCoreNum        string    `gorm:"column:cpu_core_num;type:varchar(32);not null;default:''" orm:"column(cpu_core_num);size(32)"`
	DeviceMemory      string    `gorm:"column:device_memory;type:varchar(32);not null;default:''" orm:"column(device_memory);size(32)"`
	Platform          string    `gorm:"column:platform;type:varchar(32);not null;default:''" orm:"column(platform);size(32)"`
	Downlink          string    `gorm:"column:downlink;type:varchar(32);not null;default:''" orm:"column(downlink);size(32)"`
	EffectiveType     string    `gorm:"column:effective_type;type:varchar(32);not null;default:''" orm:"column(effective_type);size(32)"`
	RoundTripTime     string    `gorm:"column:round_trip_time;type:varchar(32);not null;default:''" orm:"column(round_trip_time);size(32)"`
	Webid             string    `gorm:"column:webid;type:varchar(64);not null;default:'';index:idx_webid" orm:"column(webid);size(64)"`
	Uifid             string    `gorm:"column:uifid;type:varchar(1000);not null;default:''" orm:"column(uifid);size(1000)"`
	VerifyFp          string    `gorm:"column:verify_fp;type:varchar(500);not null;default:''" orm:"column(verify_fp);size(500)"`
	Fp                string    `gorm:"column:fp;type:varchar(500);not null;default:''" orm:"column(fp);size(500)"`
	Ttwid             string    `gorm:"column:ttwid;type:varchar(500);not null;default:''" orm:"column(ttwid);size(500)"`
	OdinTt            string    `gorm:"column:odin_tt;type:varchar(500);not null;default:''" orm:"column(odin_tt);size(500)"`
	UserAgent         string    `gorm:"column:user_agent;type:varchar(500);not null;default:''" orm:"column(user_agent);size(500)"`
	ProxyIp           string    `gorm:"column:proxy_ip;type:varchar(255);not null;default:''" orm:"column(proxy_ip);size(255)"`
	Cookie            string    `gorm:"column:cookie;type:varchar(2000);not null;default:''" orm:"column(cookie);size(2000)"`
	PcLibraDivert     string    `gorm:"column:pc_libra_divert;type:varchar(50);not null;default:''" orm:"column(pc_libra_divert);size(50)"`
	SecChUaPlatform   string    `gorm:"column:sec_ch_ua_platform;type:varchar(50);not null;default:''" orm:"column(sec_ch_ua_platform);size(50)"`
	SecChUa           string    `gorm:"column:sec_ch_ua;type:varchar(128);not null;default:''" orm:"column(sec_ch_ua);size(128)"`
	ExpireTime        time.Time `gorm:"column:expire_time;type:timestamp;default:CURRENT_TIMESTAMP" orm:"column(expire_time)"`
}

type WebDevice struct {
	db.BaseEntity
	webDeviceFields
}

func (d *WebDevice) TableName() string {
	return "web_device"
}

type HQWebDevice struct {
	db.BaseEntity
	webDeviceFields
}

func (d *HQWebDevice) TableName() string {
	return "hq_web_device"
}
