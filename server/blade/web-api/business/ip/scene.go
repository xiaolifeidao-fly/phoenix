package ip

import "fmt"

type Scene string

const (
	SceneCollectDevice Scene = "COLLECT"
	SceneAuditLike     Scene = "AUDIT_LIKE"
	SceneCurrentValue  Scene = "CURRENT"
	SceneAuditFollow   Scene = "AUDIT_FOLLOW"
	SceneTest          Scene = "TEST"
)

func ParseScene(value string) (Scene, error) {
	switch Scene(value) {
	case SceneCollectDevice, SceneAuditLike, SceneCurrentValue, SceneAuditFollow, SceneTest:
		return Scene(value), nil
	default:
		return "", fmt.Errorf("unsupported scene: %s", value)
	}
}

func (s Scene) Name() string {
	return string(s)
}

func DefaultScenes() []Scene {
	return []Scene{
		SceneCollectDevice,
		SceneAuditLike,
		SceneCurrentValue,
		SceneAuditFollow,
	}
}

func (s Scene) ProxyRequestURLKey() string {
	return "PROXY_" + s.Name() + "_REQUEST_URL"
}

func (s Scene) ProxyRequestSuffixKey() string {
	return "PROXY_" + s.Name() + "_REQUEST_SUFFIX"
}

func (s Scene) ProxyRequestAPIKey() string {
	return "PROXY_" + s.Name() + "_REQUEST_API"
}

func (s Scene) ProxyRequestAKey() string {
	return "PROXY_" + s.Name() + "_REQUEST_AKEY"
}

func (s Scene) ProxyRequestDisabledKey() string {
	return "PROXY_" + s.Name() + "_DISABLED"
}
