package ip

import "time"

type ProxyIP struct {
	Type       string    `json:"type"`
	Ip         string    `json:"ip"`
	ExpireTime time.Time `json:"expireTime"`
}
