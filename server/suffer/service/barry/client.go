package barry

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"net/url"
	"reflect"
	"strings"
	"time"

	commonHTTP "common/middleware/http"
	"common/middleware/vipper"
)

const (
	defaultBarryTimeout = 30 * time.Second
)

type Client struct {
	baseURL string
	token   string
	appKey  string
	proxyIP string
	timeout time.Duration
}

func NewClient() *Client {
	timeout := vipper.GetDuration("barry.timeout")
	if timeout <= 0 {
		timeout = defaultBarryTimeout
	}
	return &Client{
		baseURL: strings.TrimRight(vipper.GetString("barry.base-url"), "/"),
		token:   strings.TrimSpace(vipper.GetString("barry.token")),
		appKey:  strings.TrimSpace(vipper.GetString("barry.app-key")),
		proxyIP: strings.TrimSpace(vipper.GetString("barry.proxy-ip")),
		timeout: timeout,
	}
}

func (c *Client) IsConfigured() bool {
	return strings.TrimSpace(c.baseURL) != ""
}

func (c *Client) Get(ctx context.Context, path string, query url.Values, response any) error {
	requestURL, err := c.buildURL(path, query)
	if err != nil {
		return err
	}
	return c.do(ctx, http.MethodGet, requestURL, nil, response)
}

func (c *Client) GetAbsolute(ctx context.Context, requestURL string, query url.Values, response any) error {
	requestURL, err := c.buildAbsoluteURL(requestURL, query)
	if err != nil {
		return err
	}
	return c.do(ctx, http.MethodGet, requestURL, nil, response)
}

func (c *Client) Post(ctx context.Context, path string, requestBody any, response any) error {
	requestURL, err := c.buildURL(path, nil)
	if err != nil {
		return err
	}
	return c.do(ctx, http.MethodPost, requestURL, requestBody, response)
}

func (c *Client) PostAbsolute(ctx context.Context, requestURL string, requestBody any, response any) error {
	requestURL, err := c.buildAbsoluteURL(requestURL, nil)
	if err != nil {
		return err
	}
	return c.do(ctx, http.MethodPost, requestURL, requestBody, response)
}

func (c *Client) buildURL(path string, query url.Values) (string, error) {
	if !c.IsConfigured() {
		return "", fmt.Errorf("barry base url is not configured")
	}
	return c.buildAbsoluteURL(c.baseURL+"/"+strings.TrimLeft(strings.TrimSpace(path), "/"), query)
}

func (c *Client) buildAbsoluteURL(requestURL string, query url.Values) (string, error) {
	trimmedURL := strings.TrimSpace(requestURL)
	if trimmedURL == "" {
		return "", fmt.Errorf("barry request url is empty")
	}
	parsedURL, err := url.Parse(trimmedURL)
	if err != nil {
		return "", err
	}
	encodedQuery := parsedURL.Query()
	if len(query) > 0 {
		for key, values := range query {
			for _, value := range values {
				encodedQuery.Add(key, value)
			}
		}
	}
	parsedURL.RawQuery = encodedQuery.Encode()
	return parsedURL.String(), nil
}

func (c *Client) do(ctx context.Context, method, requestURL string, requestBody any, response any) error {
	var body io.Reader
	var requestPayload string
	if requestBody != nil {
		payload, err := json.Marshal(requestBody)
		if err != nil {
			log.Printf("barry request encode failed: method=%s url=%s err=%v", method, requestURL, err)
			return err
		}
		requestPayload = string(payload)
		body = strings.NewReader(requestPayload)
	}
	request, err := http.NewRequestWithContext(ctx, method, requestURL, body)
	if err != nil {
		log.Printf("barry request build failed: method=%s url=%s err=%v", method, requestURL, err)
		return err
	}
	request.Header.Set("Content-Type", "application/json")
	request.Header.Set("Accept", "application/json")
	if c.token != "" {
		request.Header.Set("Authorization", c.token)
	}
	if c.appKey != "" {
		request.Header.Set("X-App-Key", c.appKey)
	}

	httpClient := commonHTTP.InitHttpClient(c.proxyIP)
	httpClient.Timeout = c.timeout
	resp, err := httpClient.Do(request)
	if err != nil {
		log.Printf("barry request error: method=%s url=%s body=%s err=%v", method, requestURL, requestPayload, err)
		return err
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		log.Printf("barry response read failed: method=%s url=%s err=%v", method, requestURL, err)
		return err
	}
	respBodyString := strings.TrimSpace(string(respBody))
	if resp.StatusCode < http.StatusOK || resp.StatusCode >= http.StatusMultipleChoices {
		log.Printf("barry request failed: method=%s url=%s status=%d body=%s", method, requestURL, resp.StatusCode, respBodyString)
		return fmt.Errorf("barry request failed: status=%d body=%s", resp.StatusCode, respBodyString)
	}
	if response == nil || len(respBody) == 0 {
		return nil
	}
	if err := json.Unmarshal(respBody, response); err != nil {
		log.Printf("barry response decode failed: method=%s url=%s body=%s err=%v", method, requestURL, respBodyString, err)
		return fmt.Errorf("barry response decode failed: %w", err)
	}
	if !isBarryResponseSuccess(response) {
		log.Printf("barry business failed: method=%s url=%s code=%s message=%s body=%s", method, requestURL, extractBarryStringField(response, "Code"), extractBarryStringField(response, "Message"), respBodyString)
	}
	return nil
}

func isBarryResponseSuccess(response any) bool {
	value := reflect.ValueOf(response)
	if !value.IsValid() {
		return true
	}
	if value.Kind() == reflect.Pointer {
		if value.IsNil() {
			return true
		}
		value = value.Elem()
	}
	if value.Kind() != reflect.Struct {
		return true
	}
	successField := value.FieldByName("Success")
	if !successField.IsValid() || successField.Kind() != reflect.Bool {
		return true
	}
	if successField.Bool() {
		return true
	}
	codeField := value.FieldByName("Code")
	if codeField.IsValid() && codeField.Kind() == reflect.String && codeField.String() == "0" {
		return true
	}
	return false
}

func extractBarryStringField(response any, fieldName string) string {
	value := reflect.ValueOf(response)
	if !value.IsValid() {
		return ""
	}
	if value.Kind() == reflect.Pointer {
		if value.IsNil() {
			return ""
		}
		value = value.Elem()
	}
	if value.Kind() != reflect.Struct {
		return ""
	}
	field := value.FieldByName(fieldName)
	if !field.IsValid() || field.Kind() != reflect.String {
		return ""
	}
	return field.String()
}
