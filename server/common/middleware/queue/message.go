package queue

import (
	"encoding/json"
	"time"
)

type Message struct {
	ID        string            `json:"id,omitempty"`
	Topic     string            `json:"topic,omitempty"`
	Payload   json.RawMessage   `json:"payload,omitempty"`
	Headers   map[string]string `json:"headers,omitempty"`
	Metadata  map[string]string `json:"metadata,omitempty"`
	Retry     int               `json:"retry"`
	MaxRetry  int               `json:"maxRetry,omitempty"`
	LastError string            `json:"lastError,omitempty"`
	CreatedAt time.Time         `json:"createdAt"`
}

func NewMessage(payload interface{}, opts ...PublishOption) (*Message, error) {
	body, err := marshalPayload(payload)
	if err != nil {
		return nil, err
	}

	cfg := defaultPublishOptions()
	for _, opt := range opts {
		opt(&cfg)
	}

	msg := &Message{
		ID:        cfg.messageID,
		Topic:     cfg.topic,
		Payload:   body,
		Headers:   cloneStringMap(cfg.headers),
		Metadata:  cloneStringMap(cfg.metadata),
		MaxRetry:  cfg.maxRetry,
		CreatedAt: time.Now(),
	}
	return msg, nil
}

func (m *Message) Decode(target interface{}) error {
	if len(m.Payload) == 0 || target == nil {
		return nil
	}
	return json.Unmarshal(m.Payload, target)
}

func marshalPayload(payload interface{}) ([]byte, error) {
	if payload == nil {
		return nil, nil
	}
	if raw, ok := payload.([]byte); ok {
		return raw, nil
	}
	if raw, ok := payload.(json.RawMessage); ok {
		return raw, nil
	}
	return json.Marshal(payload)
}

func cloneStringMap(in map[string]string) map[string]string {
	if len(in) == 0 {
		return nil
	}
	out := make(map[string]string, len(in))
	for k, v := range in {
		out[k] = v
	}
	return out
}
