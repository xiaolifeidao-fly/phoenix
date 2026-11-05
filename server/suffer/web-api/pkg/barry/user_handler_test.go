package barry

import (
	"encoding/json"
	"errors"
	"net/http/httptest"
	"testing"

	barryDTO "suffer/service/barry/dto"

	"github.com/gin-gonic/gin"
)

func runRespondBarryAction(t *testing.T, response *barryDTO.ActionResponseDTO, err error) map[string]any {
	t.Helper()
	gin.SetMode(gin.TestMode)
	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	respondBarryAction(c, response, err, "操作失败")
	var body map[string]any
	if decodeErr := json.Unmarshal(recorder.Body.Bytes(), &body); decodeErr != nil {
		t.Fatalf("decode %q: %v", recorder.Body.String(), decodeErr)
	}
	return body
}

func TestRespondBarryActionSurfacesBusinessFailure(t *testing.T) {
	body := runRespondBarryAction(t, &barryDTO.ActionResponseDTO{Success: false, Code: "1", Message: "上级必须是管理员账号"}, nil)

	if body["success"] != false || body["message"] != "上级必须是管理员账号" {
		t.Fatalf("business failure should be shown as error: %v", body)
	}
}

func TestRespondBarryActionFallsBackWhenBarryGivesNoReason(t *testing.T) {
	body := runRespondBarryAction(t, &barryDTO.ActionResponseDTO{Success: false, Code: "1"}, nil)

	if body["success"] != false || body["message"] != "操作失败" {
		t.Fatalf("fallback message expected: %v", body)
	}
}

func TestRespondBarryActionPassesSuccessData(t *testing.T) {
	body := runRespondBarryAction(t, &barryDTO.ActionResponseDTO{Success: true, Code: "0", Data: json.RawMessage(`"用户已解封"`)}, nil)

	if body["success"] != true || body["data"] != "用户已解封" {
		t.Fatalf("success data expected: %v", body)
	}
}

func TestRespondBarryActionKeepsTransportError(t *testing.T) {
	body := runRespondBarryAction(t, nil, errors.New("barry request failed: status=502"))

	if body["success"] != false || body["error"] != "barry request failed: status=502" {
		t.Fatalf("transport error expected: %v", body)
	}
}

func TestNormalizeParentUserID(t *testing.T) {
	zero, negative, valid := int64(0), int64(-3), int64(21)
	if normalizeParentUserID(nil) != nil || normalizeParentUserID(&zero) != nil || normalizeParentUserID(&negative) != nil {
		t.Fatal("empty parent should be dropped")
	}
	if got := normalizeParentUserID(&valid); got == nil || *got != 21 {
		t.Fatalf("valid parent kept, got %v", got)
	}
}
