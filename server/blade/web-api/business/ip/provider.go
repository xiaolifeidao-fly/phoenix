package ip

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"time"
)

type Lease struct {
	Address    string
	ExpireTime time.Time
}

type Provider interface {
	Fetch(ctx context.Context, config ProviderConfig) ([]Lease, error)
}

type HTTPProvider struct {
	client *http.Client
}

func NewHTTPProvider(timeout time.Duration) *HTTPProvider {
	if timeout <= 0 {
		timeout = defaultHTTPTimeout
	}
	return &HTTPProvider{
		client: &http.Client{Timeout: timeout},
	}
}

type providerResponse struct {
	Code string `json:"code"`
	Msg  string `json:"msg"`
	Data struct {
		ProxyList []struct {
			IP      string `json:"ip"`
			Port    int    `json:"port"`
			Timeout int    `json:"timeout"`
		} `json:"proxy_list"`
	} `json:"data"`
}

func (p *HTTPProvider) Fetch(ctx context.Context, config ProviderConfig) ([]Lease, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, config.RequestURL(), nil)
	if err != nil {
		return nil, err
	}

	resp, err := p.client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var decoded providerResponse
	if err = json.NewDecoder(resp.Body).Decode(&decoded); err != nil {
		return nil, err
	}

	if decoded.Code == "12002" {
		return nil, fmt.Errorf("provider rate limited for scene %s", config.Scene.Name())
	}
	if decoded.Code != "10001" {
		return nil, fmt.Errorf("provider returned code=%s msg=%s", decoded.Code, decoded.Msg)
	}

	now := time.Now()
	leases := make([]Lease, 0, len(decoded.Data.ProxyList))
	for _, item := range decoded.Data.ProxyList {
		if item.IP == "" || item.Port <= 0 || item.Timeout <= 0 {
			continue
		}
		leases = append(leases, Lease{
			Address:    fmt.Sprintf("%s:%d", item.IP, item.Port),
			ExpireTime: now.Add(time.Duration(item.Timeout) * time.Second),
		})
	}

	if len(leases) == 0 {
		return nil, fmt.Errorf("provider returned empty proxy list for scene %s", config.Scene.Name())
	}
	return leases, nil
}
