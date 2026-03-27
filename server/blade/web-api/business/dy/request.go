package dy

import (
	webDeviceDTO "blade/service/webdevice/dto"
	sessionManager "blade/web-api/business/session/manager"
	"common/middleware/http"
	"common/utils"
	"fmt"
	"log"
	"math/rand"
	"net/url"
	"strings"
	"time"

	"github.com/spf13/viper"
)

type DyEntity interface {
	Init(Url string)
	GetAbogus(params string, ua string) string
	GetAcSign(Url string, acNonce string, ua string) string
}

type DyBaseEntity struct {
	WebDevice *webDeviceDTO.WebDeviceDTO
	NeedCk    bool
	Ip        string
	Url       string
	Method    string
	Body      map[string]interface{}
}

func (e *DyBaseEntity) GetCookie() map[string]interface{} {
	return map[string]interface{}{
		"odin_tt": e.WebDevice.OdinTt,
		"ttwid":   e.WebDevice.Ttwid,
		"UIFID":   e.WebDevice.Uifid,
	}
}

func (e *DyBaseEntity) GetIp() string {
	return e.Ip
}

func (e *DyBaseEntity) Init(url string) {
	e.Url = url
	e.AppendCommonParams()
}

func (e *DyBaseEntity) GetCookieString() string {
	cookie := e.GetCookie()
	cookieString := ""
	for key, value := range cookie {
		cookieString += fmt.Sprintf("%s=%s;", key, value)
	}
	if e.NeedCk {
		sm := sessionManager.GetSessionManager()
		session, err := sm.GetSession()
		if err != nil {
			return cookieString
		}
		if session != nil {
			sessionId := session.SessionId
			log.Println("sessionId is ", sessionId)
			cookieString += fmt.Sprintf(";sessionid=%s;", sessionId)
		}
	}
	return cookieString
}

func (e *DyBaseEntity) GetMethod() string {
	return e.Method
}

func (e *DyBaseEntity) GetBody() map[string]interface{} {
	return e.Body
}

func (e *DyBaseEntity) GetHeaders() map[string]string {
	/**
	  -H 'bd-ticket-guard-client-data: eyJ0c19zaWduIjoidHMuMS40NTg4MzQ3MTcyYzhhYmJjZWZmZWFhMTBhNTg2YjQwM2QyZTY2OWY3YTQ2MWYwMjc0YjJiZTlmN2Y4MTQwNTNhYzRmYmU4N2QyMzE5Y2YwNTMxODYyNGNlZGExNDkxMWNhNDA2ZGVkYmViZWRkYjJlMzBmY2U4ZDRmYTAyNTc1ZCIsInJlcV9jb250ZW50IjoidGlja2V0LHBhdGgsdGltZXN0YW1wIiwicmVxX3NpZ24iOiJNRVVDSUVwSXVhMmJENWZKc0N0RHZsOVdKZEluQUJGTkdEUTlQS1kxdFZDRld6bGJBaUVBemo2cjF0ZHhBMWZYeThqUitnODlmREhQTC83dEpFbnkwZm1TYmhXVjN1VT0iLCJ0aW1lc3RhbXAiOjE3MzA3NzQ3ODd9' \
	  -H 'bd-ticket-guard-iteration-version: 1' \
	  -H 'bd-ticket-guard-ree-public-key: BDer+v4VrT/2TXp4LxgMhGwh20ikdwblB7luFglJabpT3fz8lshbB4AUiNTNuu1VC1A3Y7p6xQa//5hszKL3LVg=' \
	  -H 'bd-ticket-guard-version: 2' \
	  -H 'bd-ticket-guard-web-version: 1' \
	*/
	headers := map[string]string{
		"accept":             "application/json, text/plain, */*",
		"accept-language":    "zh-CN,zh;q=0.9",
		"origin":             "https://www.douyin.com",
		"priority":           "u=1, i",
		"referer":            "https://www.douyin.com/",
		"sec-ch-ua":          e.WebDevice.SecChUa,
		"sec-ch-ua-mobile":   "?0",
		"sec-ch-ua-platform": e.WebDevice.SecChUaPlatform,
		"sec-fetch-dest":     "empty",
		"sec-fetch-mode":     "cors",
		"sec-fetch-site":     "same-site",
		"host":               "www.douyin.com",
		"uifid":              e.WebDevice.Uifid,
		"user-agent":         e.WebDevice.UserAgent,
	}
	return headers
}

func (e *DyBaseEntity) GetCommonParams() map[string]interface{} {
	return map[string]interface{}{
		"device_platform":     e.WebDevice.DevicePlatform,
		"aid":                 e.WebDevice.Aid,
		"channel":             e.WebDevice.Channel,
		"source":              e.WebDevice.Source,
		"update_version_code": e.WebDevice.UpdateVersionCode,
		"pc_client_type":      e.WebDevice.PcClientType,
		"pc_libra_divert":     e.WebDevice.PcLibraDivert,
		"version_code":        e.WebDevice.VersionCode,
		"version_name":        e.WebDevice.VersionName,
		"cookie_enabled":      e.WebDevice.CookieEnabled,
		"screen_width":        e.WebDevice.ScreenWidth,
		"screen_height":       e.WebDevice.ScreenHeight,
		"browser_language":    e.WebDevice.BrowserLanguage,
		"browser_platform":    e.WebDevice.BrowserPlatform,
		"browser_name":        e.WebDevice.BrowserName,
		"browser_version":     e.WebDevice.BrowserVersion,
		"browser_online":      e.WebDevice.BrowserOnline,
		"engine_name":         e.WebDevice.EngineName,
		"engine_version":      e.WebDevice.EngineVersion,
		"os_name":             url.QueryEscape(e.WebDevice.OsName),
		"os_version":          e.WebDevice.OsVersion,
		"cpu_core_num":        e.WebDevice.CpuCoreNum,
		"device_memory":       e.WebDevice.DeviceMemory,
		"platform":            e.WebDevice.Platform,
		"downlink":            e.WebDevice.Downlink,
		"effective_type":      e.WebDevice.EffectiveType,
		"round_trip_time":     e.WebDevice.RoundTripTime,
		"webid":               e.WebDevice.Webid,
		"uifid":               e.WebDevice.Uifid,
		"verifyFp":            e.WebDevice.VerifyFp,
		"fp":                  e.WebDevice.Fp,
		"msToken":             e.getMsToken(185),
	}
}

func (e *DyBaseEntity) GetParams() string {
	split := strings.Split(e.Url, "?")
	if len(split) > 1 {
		return split[1]
	}
	return ""
}

func (e *DyBaseEntity) AppendCommonParams() {
	params := e.GetCommonParams()
	for key, value := range params {
		e.AppendUrlParams(key, value.(string))
	}
}

func (e *DyBaseEntity) AppendUrlParams(name string, value interface{}) *DyBaseEntity {
	if e.Url[len(e.Url)-1] != '?' {
		e.Url += "&" + name + "=" + utils.InterfaceToString(value)
	} else {
		e.Url += name + "=" + utils.InterfaceToString(value)
	}
	return e
}

func (e *DyBaseEntity) getMsToken(randomLength int) string {
	// 根据传入长度产生随机字符串
	baseStr := "ABCDEFGHIGKLMNOPQRSTUVWXYZabcdefghigklmnopqrstuvwxyz0123456789="
	length := len(baseStr)
	randomStr := make([]byte, randomLength)

	rand.Seed(time.Now().UnixNano())
	for i := 0; i < randomLength; i++ {
		randomStr[i] = baseStr[rand.Intn(length)]
	}

	return string(randomStr)
}

// httpPostWithRetry 带重试机制的HTTP POST请求
func httpPostWithRetry(url string, body map[string]interface{}, maxRetries int, retryDelay time.Duration) (map[string]interface{}, error) {
	var lastErr error

	for attempt := 0; attempt <= maxRetries; attempt++ {
		if attempt > 0 {
			log.Printf("HTTP request retry attempt %d/%d after %v delay", attempt, maxRetries, retryDelay)
			time.Sleep(retryDelay)
		}

		result, err := http.Post(url, body, "", nil, "")
		if err == nil {
			return result, nil
		}

		lastErr = err
		log.Printf("HTTP request attempt %d failed: %v", attempt+1, err)

		// 对于连接重置错误，增加延迟时间
		if strings.Contains(err.Error(), "connection reset by peer") && attempt < maxRetries {
			retryDelay *= 2 // 指数退避
		}
	}

	return nil, lastErr
}

func (e *DyBaseEntity) GetAbogus(params string, ua string) string {
	var singUrl = viper.GetString("plugin.url")

	// 使用重试机制：最多重试3次，初始延迟100ms
	result, err := httpPostWithRetry(singUrl+"/dy/abogus/sign", map[string]interface{}{
		"params": params,
		"ua":     ua,
	}, 3, 100*time.Millisecond)

	// 检查HTTP请求错误
	if err != nil {
		log.Printf("GetAbogus HTTP request failed after retries: %v", err)
		return ""
	}

	// 检查result是否为nil
	if result == nil {
		log.Printf("GetAbogus received nil result")
		return ""
	}

	// 检查aBogus字段是否存在
	aBogusValue, exists := result["aBogus"]
	if !exists {
		log.Printf("GetAbogus response missing 'aBogus' field")
		return ""
	}

	// 安全的类型断言
	aBogusStr, ok := aBogusValue.(string)
	if !ok {
		log.Printf("GetAbogus 'aBogus' field is not a string, got: %T", aBogusValue)
		return ""
	}

	return aBogusStr
}

func (e *DyBaseEntity) GetAcSign(Url string, acNonce string, ua string) string {
	var singUrl = viper.GetString("plugin.url")

	// 使用重试机制：最多重试3次，初始延迟100ms
	result, err := httpPostWithRetry(singUrl+"/dy/ac/sign", map[string]interface{}{
		"Url":     Url,
		"acNonce": acNonce,
		"ua":      ua,
	}, 3, 100*time.Millisecond)

	// 检查HTTP请求错误
	if err != nil {
		log.Printf("GetAcSign HTTP request failed after retries: %v", err)
		return ""
	}

	// 检查result是否为nil
	if result == nil {
		log.Printf("GetAcSign received nil result")
		return ""
	}

	// 检查acSignature字段是否存在
	acSignatureValue, exists := result["acSignature"]
	if !exists {
		log.Printf("GetAcSign response missing 'acSignature' field")
		return ""
	}

	// 安全的类型断言
	acSignatureStr, ok := acSignatureValue.(string)
	if !ok {
		log.Printf("GetAcSign 'acSignature' field is not a string, got: %T", acSignatureValue)
		return ""
	}

	return acSignatureStr
}

func (e *DyBaseEntity) GetUrl() string {
	return e.Url
}

func (e *DyBaseEntity) Sign() {
	abogus := e.GetAbogus(e.GetParams(), e.WebDevice.UserAgent)
	e.AppendUrlParams("a_bogus", abogus)
}

func (r *DyBaseEntity) SetBody(params map[string]interface{}) {
	r.Body = params
}

type RequestEntity interface {
	GetUrl() string
	GetCookieString() string
	GetHeaders() map[string]string
	GetBody() map[string]interface{}
	SetBody(params map[string]interface{})
	GetMethod() string
	Sign()
	GetIp() string
}

type DyRequest[E RequestEntity] struct {
}

func (r *DyRequest[E]) DoGet(e E, ip string) (map[string]interface{}, error) {
	e.Sign()
	result, err := http.Get(e.GetUrl(), e.GetCookieString(), e.GetHeaders(), ip)
	return result, err
}

func (r *DyRequest[E]) DoPost(e E, contentType string, ip string) (map[string]interface{}, error) {
	e.Sign()
	if contentType != "" && contentType == "application/x-www-form-urlencoded; charset=UTF-8" {
		return http.PostForm(e.GetUrl(), e.GetBody(), e.GetCookieString(), e.GetHeaders(), ip)
	}
	return http.Post(e.GetUrl(), e.GetBody(), e.GetCookieString(), e.GetHeaders(), ip)
}

func DoGet(e RequestEntity) (map[string]interface{}, error) {
	requestInstance := &DyRequest[RequestEntity]{}
	return requestInstance.DoGet(e, e.GetIp())
}

func DoPost(e RequestEntity, params map[string]interface{}, contentType string) (map[string]interface{}, error) {
	e.SetBody(params)
	requestInstance := &DyRequest[RequestEntity]{}
	return requestInstance.DoPost(e, contentType, e.GetIp())
}
