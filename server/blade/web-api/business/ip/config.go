package ip

import (
	"common/middleware/vipper"
	"fmt"
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
	url := strings.TrimSpace(vipper.GetString(scene.ProxyRequestURLKey()))
	suffix := strings.TrimSpace(vipper.GetString(scene.ProxyRequestSuffixKey()))
	api := strings.TrimSpace(vipper.GetString(scene.ProxyRequestAPIKey()))
	akey := strings.TrimSpace(vipper.GetString(scene.ProxyRequestAKey()))
	disabled := vipper.GetBool(scene.ProxyRequestDisabledKey())

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
