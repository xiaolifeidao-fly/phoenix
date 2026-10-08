package main

import (
	"bytes"
	"context"
	"crypto/rand"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"net"
	"net/http"
	"net/url"
	"regexp"
	"strings"
	"time"
	"unicode/utf8"
)

// Accept either a string or an array to preserve repeated headers.
type HeaderValues []string

func (v *HeaderValues) UnmarshalJSON(data []byte) error {
	var single string
	if err := json.Unmarshal(data, &single); err == nil && string(data) != "null" {
		*v = []string{single}
		return nil
	}
	var multiple []string
	if err := json.Unmarshal(data, &multiple); err != nil || multiple == nil {
		return fmt.Errorf("header value must be a string or string array")
	}
	*v = multiple
	return nil
}

type ForwardRequest struct {
	URL          string                  `json:"url"`
	Method       string                  `json:"method"`
	Headers      map[string]HeaderValues `json:"headers"`
	Body         json.RawMessage         `json:"body"`
	BodyEncoding string                  `json:"body_encoding"`
	TimeoutMS    int64                   `json:"timeout_ms"`
}
type ForwardResponse struct {
	RequestID    string      `json:"request_id"`
	StatusCode   int         `json:"status_code"`
	Headers      http.Header `json:"headers"`
	Body         string      `json:"body"`
	BodyEncoding string      `json:"body_encoding"`
}

var httpToken = regexp.MustCompile("^[!#$%&'*+.^_`|~0-9A-Za-z-]+$")

func newGateway(c Config, logger *slog.Logger) (http.Handler, *http.Transport, error) {
	if c.ConnectTimeoutSeconds <= 0 || c.ConnectTimeoutSeconds > 3600 || c.RequestTimeoutSeconds <= 0 || c.RequestTimeoutSeconds > 3600 || c.MaxRequestBytes <= 0 || c.MaxRequestBytes > 1<<30 || c.MaxResponseBytes <= 0 || c.MaxResponseBytes > 1<<30 {
		return nil, nil, fmt.Errorf("timeouts must be within 1..3600 seconds; byte limits within 1..1073741824")
	}
	transport := &http.Transport{
		DialContext:       (&net.Dialer{Timeout: time.Duration(c.ConnectTimeoutSeconds) * time.Second, KeepAlive: 30 * time.Second}).DialContext,
		ForceAttemptHTTP2: true, MaxIdleConns: 100, MaxIdleConnsPerHost: 32,
		IdleConnTimeout: 90 * time.Second, TLSHandshakeTimeout: 10 * time.Second,
		ExpectContinueTimeout: time.Second, DisableCompression: true,
	}
	// Do not follow redirects or inherit machine HTTP_PROXY settings.
	client := &http.Client{Transport: transport, CheckRedirect: func(*http.Request, []*http.Request) error { return http.ErrUseLastResponse }}
	h := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/healthz" {
			if r.Method != "GET" && r.Method != "HEAD" {
				w.Header().Set("Allow", "GET, HEAD")
				w.WriteHeader(405)
				return
			}
			w.Header().Set("Content-Type", "text/plain; charset=utf-8")
			io.WriteString(w, "ok\n")
			return
		}
		if r.URL.Path != "/forward" {
			http.NotFound(w, r)
			return
		}
		if r.Method != "POST" {
			w.Header().Set("Allow", "POST")
			http.Error(w, "use POST /forward", 405)
			return
		}
		var id [16]byte
		if _, err := rand.Read(id[:]); err != nil {
			http.Error(w, "Internal Server Error", 500)
			return
		}
		requestID := hex.EncodeToString(id[:])
		w.Header().Set("X-Suffer-Request-ID", requestID)
		fail := func(status int, code, message string) {
			writeJSON(w, status, map[string]string{"request_id": requestID, "error": code, "message": message})
		}
		r.Body = http.MaxBytesReader(w, r.Body, c.MaxRequestBytes)
		defer r.Body.Close()
		var input ForwardRequest
		decoder := json.NewDecoder(r.Body)
		decoder.DisallowUnknownFields()
		err := decoder.Decode(&input)
		if err == nil {
			err = decoder.Decode(new(any))
			if err == io.EOF {
				err = nil
			} else if err == nil {
				err = fmt.Errorf("multiple JSON values")
			}
		}
		if err != nil {
			var tooLarge *http.MaxBytesError
			if errors.As(err, &tooLarge) {
				fail(413, "request_too_large", "request JSON exceeds configured limit")
			} else {
				fail(400, "invalid_request", "expected one JSON object with valid fields")
			}
			return
		}
		maxTimeout := int64(c.RequestTimeoutSeconds) * 1000
		if input.TimeoutMS < 0 || input.TimeoutMS > maxTimeout {
			fail(400, "invalid_timeout", "timeout_ms exceeds configured limit or is negative")
			return
		}
		if input.TimeoutMS == 0 {
			input.TimeoutMS = maxTimeout
		}
		ctx, cancel := context.WithTimeout(r.Context(), time.Duration(input.TimeoutMS)*time.Millisecond)
		defer cancel()
		out, err := buildRequest(ctx, input)
		if err != nil {
			fail(400, "invalid_request", err.Error())
			return
		}
		up, err := client.Do(out)
		if err != nil {
			status, code := 502, "upstream_error"
			var timeout net.Error
			if errors.Is(err, context.DeadlineExceeded) || (errors.As(err, &timeout) && timeout.Timeout()) {
				status, code = 504, "upstream_timeout"
			}
			logger.Error("forward failed", "request_id", requestID, "method", out.Method, "host", out.URL.Host, "error_code", code)
			fail(status, code, "upstream request failed; acceptance of a write request is unknown")
			return
		}
		defer up.Body.Close()
		data, err := io.ReadAll(io.LimitReader(up.Body, c.MaxResponseBytes+1))
		if err != nil {
			status, code := 502, "upstream_body_error"
			if ctx.Err() == context.DeadlineExceeded {
				status, code = 504, "upstream_timeout"
			}
			logger.Error("response read failed", "request_id", requestID, "error_code", code)
			fail(status, code, "could not read complete upstream response")
			return
		}
		if int64(len(data)) > c.MaxResponseBytes {
			fail(502, "response_too_large", "upstream response exceeds configured limit")
			return
		}
		body, encoding := string(data), "text"
		if !utf8.Valid(data) {
			body, encoding = base64.StdEncoding.EncodeToString(data), "base64"
		}
		headers := up.Header.Clone()
		stripHopHeaders(headers)
		writeJSON(w, 200, ForwardResponse{RequestID: requestID, StatusCode: up.StatusCode, Headers: headers, Body: body, BodyEncoding: encoding})
	})
	return h, transport, nil
}

func buildRequest(ctx context.Context, input ForwardRequest) (*http.Request, error) {
	u, err := url.Parse(input.URL)
	if err != nil || (u.Scheme != "http" && u.Scheme != "https") || u.Hostname() == "" || u.User != nil || u.Fragment != "" || u.Opaque != "" {
		return nil, fmt.Errorf("url must be an absolute HTTP(S) URL without userinfo or fragment")
	}
	method := strings.ToUpper(input.Method)
	if !httpToken.MatchString(method) || method == "CONNECT" {
		return nil, fmt.Errorf("method must be an HTTP method token; CONNECT is not supported")
	}
	body := []byte(input.Body)
	isString := len(body) > 0 && body[0] == '"'
	if isString {
		var value string
		if err := json.Unmarshal(body, &value); err != nil {
			return nil, fmt.Errorf("invalid body string")
		}
		body = []byte(value)
	}
	switch input.BodyEncoding {
	case "", "text":
	case "base64":
		if !isString {
			return nil, fmt.Errorf("base64 body must be a JSON string")
		}
		body, err = base64.StdEncoding.DecodeString(string(body))
		if err != nil {
			return nil, fmt.Errorf("invalid base64 body")
		}
	default:
		return nil, fmt.Errorf("body_encoding must be text or base64")
	}
	out, err := http.NewRequestWithContext(ctx, method, input.URL, bytes.NewReader(body))
	if err != nil {
		return nil, fmt.Errorf("invalid HTTP request URL or method")
	}
	// No replay body: do not automatically resend writes even with idempotency headers.
	out.GetBody = nil
	for name, values := range input.Headers {
		if !httpToken.MatchString(name) {
			return nil, fmt.Errorf("invalid header name")
		}
		for _, value := range values {
			for _, b := range []byte(value) {
				if (b < 32 && b != '\t') || b == 127 {
					return nil, fmt.Errorf("invalid header value")
				}
			}
			out.Header.Add(name, value)
		}
	}
	stripHopHeaders(out.Header)
	out.Header.Del("Host")
	out.Header.Del("Content-Length")
	if out.Header.Get("Content-Type") == "" && len(input.Body) > 0 && !isString {
		out.Header.Set("Content-Type", "application/json")
	}
	return out, nil
}

func stripHopHeaders(headers http.Header) {
	for _, value := range headers.Values("Connection") {
		for _, name := range strings.Split(value, ",") {
			headers.Del(strings.TrimSpace(name))
		}
	}
	for _, name := range []string{"Connection", "Proxy-Connection", "Keep-Alive", "Proxy-Authenticate", "Proxy-Authorization", "TE", "Trailer", "Transfer-Encoding", "Upgrade"} {
		headers.Del(name)
	}
}
func writeJSON(w http.ResponseWriter, status int, value any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(value)
}
