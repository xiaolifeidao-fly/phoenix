package manager

import (
	sessionDTO "blade/service/session/dto"
	sessionBusiness "blade/web-api/business/session"
	"context"
	"fmt"
	"sync"
	"time"
)

type SessionManager struct {
	facade      *sessionBusiness.Facade
	mu          sync.RWMutex
	sessions    []*sessionDTO.SessionDTO
	cursor      int
	initialized bool
	ctx         context.Context
	cancel      context.CancelFunc
}

var (
	defaultManager *SessionManager
	managerOnce    sync.Once
)

func GetSessionManager() *SessionManager {
	managerOnce.Do(func() {
		ctx, cancel := context.WithCancel(context.Background())
		defaultManager = &SessionManager{
			facade: sessionBusiness.NewFacade(),
			ctx:    ctx,
			cancel: cancel,
		}
	})
	return defaultManager
}

func ResetInstance() {
	if defaultManager != nil {
		defaultManager.Close()
	}
	defaultManager = nil
	managerOnce = sync.Once{}
}

func (m *SessionManager) GetSession() (*sessionDTO.SessionDTO, error) {
	if err := m.ensureInitialized(); err != nil {
		return nil, err
	}

	m.mu.Lock()
	defer m.mu.Unlock()

	if len(m.sessions) == 0 {
		return nil, fmt.Errorf("no active sessions")
	}

	session := m.sessions[m.cursor%len(m.sessions)]
	m.cursor = (m.cursor + 1) % len(m.sessions)
	return session, nil
}

func (m *SessionManager) GetSessionWithTimeout(timeout time.Duration) (*sessionDTO.SessionDTO, error) {
	timer := time.NewTimer(timeout)
	defer timer.Stop()

	type result struct {
		session *sessionDTO.SessionDTO
		err     error
	}

	ch := make(chan result, 1)
	go func() {
		session, err := m.GetSession()
		ch <- result{session: session, err: err}
	}()

	select {
	case <-m.ctx.Done():
		return nil, m.ctx.Err()
	case <-timer.C:
		return nil, fmt.Errorf("get session timeout")
	case result := <-ch:
		return result.session, result.err
	}
}

func (m *SessionManager) Refresh() error {
	m.mu.Lock()
	defer m.mu.Unlock()

	sessions, err := m.facade.ListActiveSessions()
	if err != nil {
		return err
	}
	m.sessions = sessions
	m.cursor = 0
	m.initialized = true
	return nil
}

func (m *SessionManager) Close() {
	m.cancel()
}

func (m *SessionManager) ensureInitialized() error {
	m.mu.RLock()
	initialized := m.initialized
	m.mu.RUnlock()
	if initialized {
		return nil
	}
	return m.Refresh()
}
