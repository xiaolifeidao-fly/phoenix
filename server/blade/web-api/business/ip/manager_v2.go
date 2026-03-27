package ip

import (
	"context"
	"fmt"
	"log"
	"math/rand"
	"sort"
	"sync"
	"time"
)

type groupRefreshInput struct {
	Config ProviderConfig
	Scenes []Scene
}

type snapshot struct {
	SceneItems map[Scene][]*ProxyIP
}

type V2Manager struct {
	resolver SceneConfigResolver
	provider Provider
	scenes   []Scene

	mu       sync.RWMutex
	current  *snapshot
	started  bool
	stopCh   chan struct{}
	readyCh  chan struct{}
	stopOnce sync.Once
}

var (
	defaultV2Manager     *V2Manager
	defaultV2ManagerOnce sync.Once
)

func NewV2Manager(resolver SceneConfigResolver, provider Provider, scenes []Scene) *V2Manager {
	if len(scenes) == 0 {
		scenes = DefaultScenes()
	}
	return &V2Manager{
		resolver: resolver,
		provider: provider,
		scenes:   append([]Scene(nil), scenes...),
		current: &snapshot{
			SceneItems: make(map[Scene][]*ProxyIP),
		},
		stopCh:  make(chan struct{}),
		readyCh: make(chan struct{}),
	}
}

func GetDefaultV2Manager() *V2Manager {
	defaultV2ManagerOnce.Do(func() {
		defaultV2Manager = NewV2Manager(
			NewViperSceneConfigResolver(),
			NewHTTPProvider(vipperHTTPTimeout()),
			DefaultScenes(),
		)
	})
	return defaultV2Manager
}

func InitDefaultV2Manager() error {
	manager := GetDefaultV2Manager()
	manager.Start()
	return manager.WaitUntilReady(30 * time.Second)
}

func (m *V2Manager) Start() {
	m.mu.Lock()
	if m.started {
		m.mu.Unlock()
		return
	}
	m.started = true
	m.mu.Unlock()

	go func() {
		if err := m.Refresh(context.Background()); err != nil {
			log.Printf("ip v2 initial refresh failed: %v", err)
		} else {
			m.signalReady()
		}

		ticker := time.NewTicker(GetV2RefreshInterval())
		defer ticker.Stop()

		for {
			select {
			case <-ticker.C:
				if err := m.Refresh(context.Background()); err != nil {
					log.Printf("ip v2 refresh failed: %v", err)
				}
			case <-m.stopCh:
				return
			}
		}
	}()
}

func (m *V2Manager) Stop() {
	m.stopOnce.Do(func() {
		close(m.stopCh)
	})
}

func (m *V2Manager) WaitUntilReady(timeout time.Duration) error {
	if timeout <= 0 {
		timeout = 30 * time.Second
	}

	if m.HasAnyAvailableIP() {
		return nil
	}

	timer := time.NewTimer(timeout)
	defer timer.Stop()

	select {
	case <-m.readyCh:
		if m.HasAnyAvailableIP() {
			return nil
		}
		return fmt.Errorf("ip v2 ready signal received without available ip")
	case <-timer.C:
		return fmt.Errorf("ip v2 ready timeout after %s", timeout)
	}
}

func (m *V2Manager) Refresh(ctx context.Context) error {
	groups, err := m.buildRefreshGroups()
	if err != nil {
		return err
	}
	if len(groups) == 0 {
		return fmt.Errorf("ip v2 has no valid scene config")
	}

	current := m.getSnapshot()
	nextItems := cloneSceneItems(current.SceneItems)
	successCount := 0

	for _, group := range groups {
		leases, fetchErr := m.provider.Fetch(ctx, group.Config)
		if fetchErr != nil {
			log.Printf("ip v2 fetch failed for scenes=%v: %v", group.Scenes, fetchErr)
			continue
		}

		items := buildDTOs(group.Scenes, leases)
		for scene, sceneItems := range items {
			nextItems[scene] = sceneItems
		}
		successCount++
	}

	if successCount == 0 && !hasAvailableItems(nextItems) {
		return fmt.Errorf("ip v2 refresh failed for all groups")
	}

	m.mu.Lock()
	m.current = &snapshot{SceneItems: nextItems}
	m.mu.Unlock()

	if hasAvailableItems(nextItems) {
		m.signalReady()
	}
	return nil
}

func (m *V2Manager) GetByScene(scene Scene) (*ProxyIP, error) {
	items := m.getAvailableSceneItems(scene)
	if len(items) == 0 {
		return nil, fmt.Errorf("scene %s has no available ip in v2 pool", scene.Name())
	}
	return items[rand.Intn(len(items))], nil
}

func (m *V2Manager) GetAddressByScene(scene Scene) (string, error) {
	item, err := m.GetByScene(scene)
	if err != nil {
		return "", err
	}
	return item.Ip, nil
}

func (m *V2Manager) GetIpCount(scene Scene) int {
	return len(m.getAvailableSceneItems(scene))
}

func (m *V2Manager) GetAllSceneIpCounts() map[string]int {
	result := make(map[string]int, len(m.scenes))
	for _, scene := range m.scenes {
		result[scene.Name()] = len(m.getAvailableSceneItems(scene))
	}
	return result
}

func (m *V2Manager) HasAnyAvailableIP() bool {
	return hasAvailableItems(m.getSnapshot().SceneItems)
}

func (m *V2Manager) buildRefreshGroups() ([]groupRefreshInput, error) {
	groupMap := make(map[string]*groupRefreshInput)
	var firstErr error

	for _, scene := range m.scenes {
		config, err := m.resolver.Resolve(scene)
		if err != nil {
			if firstErr == nil {
				firstErr = err
			}
			log.Printf("ip v2 skip scene %s: %v", scene.Name(), err)
			continue
		}
		if config == nil || config.Disabled {
			continue
		}

		key := config.Signature()
		group, exists := groupMap[key]
		if !exists {
			group = &groupRefreshInput{
				Config: *config,
				Scenes: make([]Scene, 0, 1),
			}
			groupMap[key] = group
		}
		group.Scenes = append(group.Scenes, scene)
	}

	keys := make([]string, 0, len(groupMap))
	for key := range groupMap {
		keys = append(keys, key)
	}
	sort.Strings(keys)

	groups := make([]groupRefreshInput, 0, len(keys))
	for _, key := range keys {
		groups = append(groups, *groupMap[key])
	}

	if len(groups) == 0 && firstErr != nil {
		return nil, firstErr
	}
	return groups, nil
}

func (m *V2Manager) getSnapshot() *snapshot {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return m.current
}

func (m *V2Manager) getAvailableSceneItems(scene Scene) []*ProxyIP {
	now := time.Now()
	source := m.getSnapshot().SceneItems[scene]
	if len(source) == 0 {
		return nil
	}

	items := make([]*ProxyIP, 0, len(source))
	for _, item := range source {
		if item == nil {
			continue
		}
		if !item.ExpireTime.IsZero() && !item.ExpireTime.After(now) {
			continue
		}
		items = append(items, item)
	}
	return items
}

func (m *V2Manager) signalReady() {
	select {
	case <-m.readyCh:
		return
	default:
		close(m.readyCh)
	}
}

func buildDTOs(scenes []Scene, leases []Lease) map[Scene][]*ProxyIP {
	result := make(map[Scene][]*ProxyIP, len(scenes))
	for _, scene := range scenes {
		items := make([]*ProxyIP, 0, len(leases))
		for _, lease := range leases {
			items = append(items, &ProxyIP{
				Type:       scene.Name(),
				Ip:         lease.Address,
				ExpireTime: lease.ExpireTime,
			})
		}
		result[scene] = items
	}
	return result
}

func cloneSceneItems(source map[Scene][]*ProxyIP) map[Scene][]*ProxyIP {
	result := make(map[Scene][]*ProxyIP, len(source))
	for scene, items := range source {
		result[scene] = append([]*ProxyIP(nil), items...)
	}
	return result
}

func hasAvailableItems(sceneItems map[Scene][]*ProxyIP) bool {
	now := time.Now()
	for _, items := range sceneItems {
		for _, item := range items {
			if item != nil && (item.ExpireTime.IsZero() || item.ExpireTime.After(now)) {
				return true
			}
		}
	}
	return false
}

func vipperHTTPTimeout() time.Duration {
	timeout := GetV2RefreshInterval()
	if timeout <= 0 {
		return defaultHTTPTimeout
	}
	if timeout > defaultHTTPTimeout {
		return defaultHTTPTimeout
	}
	return timeout
}
