package ip

import (
	"context"
	"testing"
	"time"
)

type fakeResolver map[Scene]*ProviderConfig

func (r fakeResolver) Resolve(scene Scene) (*ProviderConfig, error) {
	if config, ok := r[scene]; ok {
		return config, nil
	}
	return nil, context.DeadlineExceeded
}

type fakeProvider struct {
	calls int
	data  map[string][]Lease
}

func (p *fakeProvider) Fetch(ctx context.Context, config ProviderConfig) ([]Lease, error) {
	p.calls++
	return p.data[config.Signature()], nil
}

func TestV2ManagerGroupsScenesByConfig(t *testing.T) {
	scenes := []Scene{SceneCollectDevice, SceneAuditLike}
	config := &ProviderConfig{Scene: SceneCollectDevice, URL: "u", Suffix: "s=%s&k=%s", API: "a", AKey: "k"}
	resolver := fakeResolver{
		SceneCollectDevice: config,
		SceneAuditLike:     {Scene: SceneAuditLike, URL: "u", Suffix: "s=%s&k=%s", API: "a", AKey: "k"},
	}
	provider := &fakeProvider{
		data: map[string][]Lease{
			config.Signature(): {{Address: "1.1.1.1:80", ExpireTime: time.Now().Add(time.Minute)}},
		},
	}

	manager := NewV2Manager(resolver, provider, scenes)
	if err := manager.Refresh(context.Background()); err != nil {
		t.Fatalf("refresh failed: %v", err)
	}
	if provider.calls != 1 {
		t.Fatalf("expected 1 provider call, got %d", provider.calls)
	}
	if manager.GetIpCount(SceneCollectDevice) != 1 || manager.GetIpCount(SceneAuditLike) != 1 {
		t.Fatalf("expected both scenes to share leases")
	}
}

func TestV2ManagerKeepsPreviousSnapshotOnFailure(t *testing.T) {
	scene := SceneCollectDevice
	manager := NewV2Manager(fakeResolver{
		scene: {Scene: scene, URL: "u", Suffix: "s=%s&k=%s", API: "a", AKey: "k"},
	}, &fakeProvider{
		data: map[string][]Lease{
			"u|s=%s&k=%s|a|k": {{Address: "1.1.1.1:80", ExpireTime: time.Now().Add(time.Minute)}},
		},
	}, []Scene{scene})

	if err := manager.Refresh(context.Background()); err != nil {
		t.Fatalf("first refresh failed: %v", err)
	}

	manager.provider = providerFunc(func(ctx context.Context, config ProviderConfig) ([]Lease, error) {
		return nil, context.DeadlineExceeded
	})

	if err := manager.Refresh(context.Background()); err != nil {
		t.Fatalf("second refresh should keep previous snapshot, got: %v", err)
	}

	item, err := manager.GetByScene(scene)
	if err != nil || item == nil {
		t.Fatalf("expected previous snapshot to remain available")
	}
}

func TestBuildDTOsCopiesScenes(t *testing.T) {
	leases := []Lease{{Address: "1.1.1.1:80", ExpireTime: time.Now().Add(time.Minute)}}
	result := buildDTOs([]Scene{SceneCollectDevice, SceneAuditLike}, leases)
	if result[SceneCollectDevice][0].Type != SceneCollectDevice.Name() {
		t.Fatalf("unexpected type")
	}
	if result[SceneAuditLike][0].Type != SceneAuditLike.Name() {
		t.Fatalf("unexpected type")
	}
}

type providerFunc func(ctx context.Context, config ProviderConfig) ([]Lease, error)

func (f providerFunc) Fetch(ctx context.Context, config ProviderConfig) ([]Lease, error) {
	return f(ctx, config)
}
