// Package kakrolot 封装对旧版 kakrolot-web 服务的调用。
package kakrolot

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"strings"
	"time"

	commonHTTP "common/middleware/http"
	"common/middleware/vipper"
)

const defaultKakrolotTimeout = 30 * time.Second

// ResponseDTO kakrolot-web 的统一响应体，code 为 "0" 表示成功。
type ResponseDTO struct {
	Code    string          `json:"code"`
	Data    json.RawMessage `json:"data,omitempty"`
	Message string          `json:"message,omitempty"`
}

func (r *ResponseDTO) IsSuccess() bool {
	return strings.TrimSpace(r.Code) == "0"
}

// ErrorMessage 返回业务失败时可展示的提示。
func (r *ResponseDTO) ErrorMessage() string {
	if message := strings.TrimSpace(r.Message); message != "" {
		return message
	}
	var data string
	if len(r.Data) > 0 && json.Unmarshal(r.Data, &data) == nil && strings.TrimSpace(data) != "" {
		return data
	}
	return "kakrolot 请求失败"
}

type Client struct {
	baseURL string
	proxyIP string
	timeout time.Duration
}

func NewClient() *Client {
	return NewClientWithPrefix("kakrolot")
}

// NewClientWithPrefix 按配置前缀构建客户端，读取 <prefix>.base-url / .timeout / .proxy-ip。
// 用于异常打标这类和主服务不同域名的接口，配置为空时由调用方决定是否回退。
func NewClientWithPrefix(prefix string) *Client {
	timeout := vipper.GetDuration(prefix + ".timeout")
	if timeout <= 0 {
		timeout = defaultKakrolotTimeout
	}
	return &Client{
		baseURL: strings.TrimRight(strings.TrimSpace(vipper.GetString(prefix+".base-url")), "/"),
		proxyIP: strings.TrimSpace(vipper.GetString(prefix + ".proxy-ip")),
		timeout: timeout,
	}
}

func (c *Client) IsConfigured() bool {
	return c.baseURL != ""
}

// Post token 为新管理端登录态，通过 X-Token 头透传给 kakrolot-web。
func (c *Client) Post(ctx context.Context, path string, requestBody any, token string) (*ResponseDTO, error) {
	return c.do(ctx, http.MethodPost, path, requestBody, token)
}

// Get token 为新管理端登录态，通过 X-Token 头透传给 kakrolot-web。
func (c *Client) Get(ctx context.Context, path string, token string) (*ResponseDTO, error) {
	return c.do(ctx, http.MethodGet, path, nil, token)
}

func (c *Client) do(ctx context.Context, method, path string, requestBody any, token string) (*ResponseDTO, error) {
	if !c.IsConfigured() {
		return nil, fmt.Errorf("kakrolot base url is not configured")
	}
	requestURL := c.baseURL + "/" + strings.TrimLeft(strings.TrimSpace(path), "/")

	var body io.Reader
	if requestBody != nil {
		payload, err := json.Marshal(requestBody)
		if err != nil {
			return nil, err
		}
		body = strings.NewReader(string(payload))
	}
	request, err := http.NewRequestWithContext(ctx, method, requestURL, body)
	if err != nil {
		return nil, err
	}
	request.Header.Set("Content-Type", "application/json")
	request.Header.Set("Accept", "application/json")
	if token = strings.TrimSpace(token); token != "" {
		request.Header.Set("X-Token", token)
	}

	httpClient := commonHTTP.InitHttpClient(c.proxyIP)
	httpClient.Timeout = c.timeout
	resp, err := httpClient.Do(request)
	if err != nil {
		log.Printf("kakrolot request error: url=%s err=%v", requestURL, err)
		return nil, err
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}
	respBodyString := strings.TrimSpace(string(respBody))
	if resp.StatusCode < http.StatusOK || resp.StatusCode >= http.StatusMultipleChoices {
		log.Printf("kakrolot request failed: url=%s status=%d body=%s", requestURL, resp.StatusCode, respBodyString)
		return nil, fmt.Errorf("kakrolot request failed: status=%d", resp.StatusCode)
	}
	response := &ResponseDTO{}
	if len(respBody) > 0 {
		if err := json.Unmarshal(respBody, response); err != nil {
			log.Printf("kakrolot response decode failed: url=%s body=%s err=%v", requestURL, respBodyString, err)
			return nil, fmt.Errorf("kakrolot response decode failed: %w", err)
		}
	}
	return response, nil
}
