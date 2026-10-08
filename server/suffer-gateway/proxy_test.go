package main

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync/atomic"
	"testing"
)

func testConfig() Config {
	return Config{ConnectTimeoutSeconds: 1, RequestTimeoutSeconds: 2, MaxRequestBytes: 1 << 20, MaxResponseBytes: 1 << 20}
}
func testGateway(t *testing.T, c Config) *httptest.Server {
	t.Helper()
	h, transport, err := newGateway(c, slog.New(slog.NewTextHandler(io.Discard, nil)))
	if err != nil {
		t.Fatal(err)
	}
	s := httptest.NewServer(h)
	t.Cleanup(func() { s.Close(); transport.CloseIdleConnections() })
	return s
}
func forward(t *testing.T, gateway *httptest.Server, input any) (int, ForwardResponse) {
	t.Helper()
	payload, err := json.Marshal(input)
	if err != nil {
		t.Fatal(err)
	}
	res, err := gateway.Client().Post(gateway.URL+"/forward", "application/json", bytes.NewReader(payload))
	if err != nil {
		t.Fatal(err)
	}
	defer res.Body.Close()
	var output ForwardResponse
	if err := json.NewDecoder(res.Body).Decode(&output); err != nil {
		t.Fatal(err)
	}
	return res.StatusCode, output
}

func TestMethodsFormHeadersAndResponse(t *testing.T) {
	gateway := testGateway(t, testConfig())
	for _, method := range []string{"GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS", "UPDATE"} {
		t.Run(method, func(t *testing.T) {
			body := "key=test&action=add&link=https%3A%2F%2Fexample.com%2Fa&quantity=10"
			up := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				got, _ := io.ReadAll(r.Body)
				if r.Method != method || string(got) != body {
					t.Errorf("request changed: %s %q", r.Method, got)
				}
				if r.URL.RequestURI() != "/api/a%2Fb?x=1&x=2&v=a+b&z=%2B" {
					t.Errorf("URI changed: %s", r.URL.RequestURI())
				}
				if r.Header.Get("Authorization") != "Bearer platform-key" || r.Header.Get("Content-Type") != "application/x-www-form-urlencoded" {
					t.Error("platform headers lost")
				}
				if len(r.Header.Values("X-Multi")) != 2 {
					t.Error("multi-valued header lost")
				}
				if r.Header.Get("X-Hop") != "" || r.Host == "spoofed" {
					t.Error("hop header or Host leaked")
				}
				w.Header().Add("Set-Cookie", "a=1")
				w.Header().Add("Set-Cookie", "b=2")
				w.WriteHeader(422)
				io.WriteString(w, `{"error":"platform error"}`)
			}))
			defer up.Close()
			status, output := forward(t, gateway, map[string]any{
				"url": up.URL + "/api/a%2Fb?x=1&x=2&v=a+b&z=%2B", "method": method, "body": body,
				"headers": map[string]any{"Authorization": "Bearer platform-key", "Content-Type": "application/x-www-form-urlencoded", "X-Multi": []string{"a", "b"}, "Connection": "X-Hop", "X-Hop": "secret", "Host": "spoofed", "Content-Length": "9999"},
			})
			if status != 200 || output.StatusCode != 422 || len(output.Headers.Values("Set-Cookie")) != 2 || output.RequestID == "" {
				t.Fatalf("bad response: %d %+v", status, output)
			}
			if method != "HEAD" && output.Body != `{"error":"platform error"}` {
				t.Error(output.Body)
			}
		})
	}
}

func TestJSONAndBinaryBodies(t *testing.T) {
	gateway := testGateway(t, testConfig())
	for _, tc := range []struct{ name, body, encoding, want, contentType string }{
		{"object", `{"count":10,"active":true}`, "", `{"count":10,"active":true}`, "application/json"},
		{"array", `[1,2]`, "", `[1,2]`, "application/json"},
		{"null", `null`, "", `null`, "application/json"},
		{"empty", `""`, "", "", ""},
		{"missing", "", "", "", ""},
		{"binary", `"AP8BDQo="`, "base64", string([]byte{0, 255, 1, 13, 10}), ""},
	} {
		t.Run(tc.name, func(t *testing.T) {
			up := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				data, _ := io.ReadAll(r.Body)
				if string(data) != tc.want || r.Header.Get("Content-Type") != tc.contentType {
					t.Errorf("body/content-type changed: %q %s", data, r.Header.Get("Content-Type"))
				}
				w.Write(data)
			}))
			defer up.Close()
			input := ForwardRequest{URL: up.URL, Method: "POST", Body: json.RawMessage(tc.body), BodyEncoding: tc.encoding}
			// RawMessage(nil) marshals to null; omit body explicitly for this case.
			var value any = input
			if tc.name == "missing" {
				value = map[string]any{"url": up.URL, "method": "POST"}
			}
			status, output := forward(t, gateway, value)
			got := []byte(output.Body)
			if output.BodyEncoding == "base64" {
				var err error
				got, err = base64.StdEncoding.DecodeString(output.Body)
				if err != nil {
					t.Fatal(err)
				}
			}
			if status != 200 || string(got) != tc.want {
				t.Fatalf("%d body %q", status, got)
			}
		})
	}
}

func TestTimeoutNoReplay(t *testing.T) {
	var calls atomic.Int32
	up := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		calls.Add(1)
		io.Copy(io.Discard, r.Body)
		<-r.Context().Done()
	}))
	defer up.Close()
	gateway := testGateway(t, testConfig())
	status, _ := forward(t, gateway, map[string]any{"url": up.URL, "method": "POST", "body": "action=add", "timeout_ms": 30})
	if status != 504 || calls.Load() != 1 {
		t.Fatalf("status=%d calls=%d", status, calls.Load())
	}
}

func TestRedirectNotFollowedAndMultipleDestinations(t *testing.T) {
	var destinationCalls atomic.Int32
	destination := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { destinationCalls.Add(1); io.WriteString(w, "second") }))
	defer destination.Close()
	redirect := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Location", destination.URL)
		w.WriteHeader(307)
	}))
	defer redirect.Close()
	gateway := testGateway(t, testConfig())
	status, output := forward(t, gateway, map[string]any{"url": redirect.URL, "method": "POST", "body": "data"})
	if status != 200 || output.StatusCode != 307 || destinationCalls.Load() != 0 || output.Headers.Get("Location") != destination.URL {
		t.Fatalf("redirect followed/changed: %+v", output)
	}
	status, output = forward(t, gateway, map[string]any{"url": destination.URL, "method": "GET"})
	if status != 200 || output.Body != "second" {
		t.Fatal("dynamic second destination failed")
	}
}

func TestValidationAndLimits(t *testing.T) {
	gateway := testGateway(t, testConfig())
	for _, payload := range []string{
		`{}`, `null`, `{"url":"file:///etc/passwd","method":"GET"}`,
		`{"url":"https://user:password@example.com","method":"GET"}`,
		`{"url":"http://example.com","method":"CONNECT"}`,
		`{"url":"http://example.com","method":"GET\r\nInjected: x"}`,
		`{"url":"http://example.com","method":"GET","headers":{"X-Test":"a\r\nb"}}`,
		`{"url":"http://example.com","method":"GET","headers":{"Bad Name":"a"}}`,
		`{"url":"http://example.com","method":"GET","headers":{"X-Test":null}}`,
		`{"url":"http://example.com","method":"POST","body":"!","body_encoding":"base64"}`,
		`{"url":"http://example.com","method":"POST","body":{},"body_encoding":"base64"}`,
		`{"url":"http://example.com","method":"GET","timeout_ms":-1}`,
		`{"url":"http://example.com","method":"GET","timeout_ms":999999}`,
		`{"url":"http://example.com","method":"GET","unknown":true}`,
		`{"url":"http://example.com","method":"GET"} {}`,
	} {
		res, err := gateway.Client().Post(gateway.URL+"/forward", "application/json", strings.NewReader(payload))
		if err != nil {
			t.Fatal(err)
		}
		res.Body.Close()
		if res.StatusCode != 400 {
			t.Errorf("status %d for %s", res.StatusCode, payload)
		}
	}
	c := testConfig()
	c.MaxRequestBytes = 32
	c.MaxResponseBytes = 3
	limited := testGateway(t, c)
	status, _ := forward(t, limited, map[string]string{"url": "http://example.com/" + strings.Repeat("a", 100), "method": "GET"})
	if status != 413 {
		t.Fatalf("request size status %d", status)
	}
	c.MaxRequestBytes = 1024
	limited = testGateway(t, c)
	up := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { io.WriteString(w, "too long") }))
	defer up.Close()
	status, _ = forward(t, limited, map[string]string{"url": up.URL, "method": "GET"})
	if status != 502 {
		t.Fatalf("response size status %d", status)
	}
	req, err := buildRequest(context.Background(), ForwardRequest{URL: up.URL, Method: "POST", Body: json.RawMessage(`"hello"`)})
	if err != nil || req.GetBody != nil {
		t.Fatal("write request must not expose a replay body")
	}
}
