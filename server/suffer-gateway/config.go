package main

import (
	"encoding/json"
	"fmt"
	"io"
	"os"
)

type Config struct {
	Listen                string `json:"listen"`
	ConnectTimeoutSeconds int    `json:"connect_timeout_seconds"`
	RequestTimeoutSeconds int    `json:"request_timeout_seconds"`
	MaxRequestBytes       int64  `json:"max_request_bytes"`
	MaxResponseBytes      int64  `json:"max_response_bytes"`
}

func loadConfig(path string) (Config, error) {
	c := Config{Listen: "127.0.0.1:18080", ConnectTimeoutSeconds: 10, RequestTimeoutSeconds: 60, MaxRequestBytes: 16 << 20, MaxResponseBytes: 32 << 20}
	f, err := os.Open(path)
	if err != nil {
		return c, err
	}
	defer f.Close()
	d := json.NewDecoder(f)
	d.DisallowUnknownFields()
	if err := d.Decode(&c); err != nil {
		return c, err
	}
	if err := d.Decode(new(any)); err != io.EOF {
		return c, fmt.Errorf("config must contain one JSON object")
	}
	return c, nil
}
