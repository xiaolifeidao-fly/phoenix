package queue

import (
	"context"
	"encoding/json"
	"testing"
	"time"

	goredis "github.com/go-redis/redis"
)

type fakeRedisQueueClient struct {
	lists map[string][]string
}

func newFakeRedisQueueClient() *fakeRedisQueueClient {
	return &fakeRedisQueueClient{
		lists: make(map[string][]string),
	}
}

func (f *fakeRedisQueueClient) LPush(key string, values ...interface{}) *goredis.IntCmd {
	items := f.lists[key]
	for _, value := range values {
		items = append([]string{value.(string)}, items...)
	}
	f.lists[key] = items
	return goredis.NewIntResult(int64(len(items)), nil)
}

func (f *fakeRedisQueueClient) RPush(key string, values ...interface{}) *goredis.IntCmd {
	items := f.lists[key]
	for _, value := range values {
		items = append(items, value.(string))
	}
	f.lists[key] = items
	return goredis.NewIntResult(int64(len(items)), nil)
}

func (f *fakeRedisQueueClient) BRPopLPush(source string, destination string, timeout time.Duration) *goredis.StringCmd {
	items := f.lists[source]
	if len(items) == 0 {
		return goredis.NewStringResult("", goredis.Nil)
	}

	last := items[len(items)-1]
	f.lists[source] = items[:len(items)-1]
	f.lists[destination] = append([]string{last}, f.lists[destination]...)
	return goredis.NewStringResult(last, nil)
}

func (f *fakeRedisQueueClient) LRem(key string, count int64, value interface{}) *goredis.IntCmd {
	items := f.lists[key]
	target := value.(string)
	removed := int64(0)

	result := make([]string, 0, len(items))
	for _, item := range items {
		if removed < count && item == target {
			removed++
			continue
		}
		result = append(result, item)
	}
	f.lists[key] = result
	return goredis.NewIntResult(removed, nil)
}

func (f *fakeRedisQueueClient) LPop(key string) *goredis.StringCmd {
	items := f.lists[key]
	if len(items) == 0 {
		return goredis.NewStringResult("", goredis.Nil)
	}

	first := items[0]
	f.lists[key] = items[1:]
	return goredis.NewStringResult(first, nil)
}

func TestRedisQueuePublishAndConsumeAck(t *testing.T) {
	client := newFakeRedisQueueClient()
	q := newRedisQueue(client, WithKeyPrefix("test"))
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	msg, err := NewMessage(map[string]string{"bizID": "123"}, WithMessageID("msg-1"))
	if err != nil {
		t.Fatalf("NewMessage() error = %v", err)
	}

	if err = q.Publish(ctx, "orders", msg); err != nil {
		t.Fatalf("Publish() error = %v", err)
	}

	done := make(chan struct{})
	go func() {
		_ = q.Consume(ctx, "orders", func(ctx context.Context, delivery *Delivery) error {
			defer close(done)

			if delivery.Message.ID != "msg-1" {
				t.Fatalf("unexpected message id: %s", delivery.Message.ID)
			}

			var payload map[string]string
			if err := delivery.Message.Decode(&payload); err != nil {
				t.Fatalf("Decode() error = %v", err)
			}

			if payload["bizID"] != "123" {
				t.Fatalf("unexpected payload: %#v", payload)
			}
			return nil
		}, WithBlockTimeout(10*time.Millisecond))
	}()

	<-done
	cancel()

	if got := len(client.lists["test:orders:processing"]); got != 0 {
		t.Fatalf("processing queue should be empty, got %d", got)
	}
}

func TestRedisQueueNackToDeadLetterWhenRetryExceeded(t *testing.T) {
	client := newFakeRedisQueueClient()
	q := newRedisQueue(client, WithKeyPrefix("test"))

	msg := &Message{
		ID:        "msg-dead",
		Payload:   json.RawMessage(`{"value":"x"}`),
		Retry:     1,
		MaxRetry:  1,
		CreatedAt: time.Now(),
	}
	raw, _ := json.Marshal(msg)
	client.lists["test:jobs:processing"] = []string{string(raw)}

	if err := q.nack("jobs", string(raw), msg, context.DeadlineExceeded); err != nil {
		t.Fatalf("nack() error = %v", err)
	}

	if got := len(client.lists["test:jobs:processing"]); got != 0 {
		t.Fatalf("processing queue should be empty, got %d", got)
	}
	if got := len(client.lists["test:jobs:dead"]); got != 1 {
		t.Fatalf("dead queue size = %d, want 1", got)
	}
}

func TestRedisQueuePop(t *testing.T) {
	client := newFakeRedisQueueClient()
	q := newRedisQueue(client, WithKeyPrefix("test"))

	msg, err := NewMessage(map[string]string{"reply": "hello"})
	if err != nil {
		t.Fatalf("NewMessage() error = %v", err)
	}
	if err = q.Publish(context.Background(), "reply", msg); err != nil {
		t.Fatalf("Publish() error = %v", err)
	}

	got, err := q.Pop(context.Background(), "reply")
	if err != nil {
		t.Fatalf("Pop() error = %v", err)
	}
	if got == nil {
		t.Fatalf("Pop() returned nil message")
	}
	if len(client.lists["test:reply:ready"]) != 0 {
		t.Fatalf("ready queue should be empty after pop")
	}
}
