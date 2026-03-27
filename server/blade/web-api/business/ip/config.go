package ip

import (
	dictionaryService "blade/service/dictionary/service"
	"common/middleware/vipper"
	"fmt"
	"log"
	"strconv"
	"strings"
	"time"
)

const (
	defaultRefreshInterval = 10 * time.Second
	defaultHTTPTimeout     = 5 * time.Second
)

type ProviderConfig struct {
	Scene    Scene
	URL      string
	Suffix   string
	API      string
	AKey     string
	Timeout  time.Duration
	Disabled bool
}

func (c ProviderConfig) Signature() string {
	return strings.Join([]string{c.URL, c.Suffix, c.API, c.AKey}, "|")
}

func (c ProviderConfig) RequestURL() string {
	return fmt.Sprintf(c.URL+c.Suffix, c.API, c.AKey)
}

type SceneConfigResolver interface {
	Resolve(scene Scene) (*ProviderConfig, error)
}

type ViperSceneConfigResolver struct{}

func NewViperSceneConfigResolver() *ViperSceneConfigResolver {
	return &ViperSceneConfigResolver{}
}

func (r *ViperSceneConfigResolver) Resolve(scene Scene) (*ProviderConfig, error) {
	url := strings.TrimSpace(r.getConfigValue(scene.ProxyRequestURLKey()))
	suffix := strings.TrimSpace(r.getConfigValue(scene.ProxyRequestSuffixKey()))
	api := strings.TrimSpace(r.getConfigValue(scene.ProxyRequestAPIKey()))
	akey := strings.TrimSpace(r.getConfigValue(scene.ProxyRequestAKey()))
	disabled := r.getConfigBool(scene.ProxyRequestDisabledKey())

	if disabled {
		return &ProviderConfig{Scene: scene, Disabled: true}, nil
	}
	if url == "" || suffix == "" || api == "" || akey == "" {
		return nil, fmt.Errorf("scene %s proxy config is incomplete", scene.Name())
	}

	timeout := vipper.GetDuration("blade.ip.v2.http_timeout")
	if timeout <= 0 {
		timeout = defaultHTTPTimeout
	}

	return &ProviderConfig{
		Scene:   scene,
		URL:     url,
		Suffix:  suffix,
		API:     api,
		AKey:    akey,
		Timeout: timeout,
	}, nil
}

func (r *ViperSceneConfigResolver) getConfigValue(key string) string {
	if value, ok := r.getDictionaryValue(key); ok {
		return value
	}
	return vipper.GetString(key)
}

func (r *ViperSceneConfigResolver) getConfigBool(key string) bool {
	if value, ok := r.getDictionaryValue(key); ok {
		parsed, err := strconv.ParseBool(strings.TrimSpace(value))
		if err != nil {
			log.Printf("ip v2 invalid bool dictionary config %s=%q: %v", key, value, err)
		} else {
			return parsed
		}
	}
	return vipper.GetBool(key)
}

func (r *ViperSceneConfigResolver) getDictionaryValue(key string) (string, bool) {
	service := dictionaryService.NewDictionaryService()
	dict, err := service.GetByCode(key)
	if err != nil || dict == nil {
		return "", false
	}
	return dict.Value, true
}

func GetV2RefreshInterval() time.Duration {
	interval := vipper.GetDuration("blade.ip.v2.refresh_interval")
	if interval <= 0 {
		return defaultRefreshInterval
	}
	return interval
}

func IsV2Enabled() bool {
	return vipper.GetBool("blade.ip.v2.enabled")
}
