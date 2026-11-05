package barry

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	barryDTO "suffer/service/barry/dto"

	"github.com/spf13/viper"
)

type capturedRequest struct {
	method string
	path   string
	query  string
	body   string
}

func newUserDetailTestService(t *testing.T, reply string) (*UserDetailService, *[]capturedRequest) {
	t.Helper()
	requests := &[]capturedRequest{}
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		body, _ := io.ReadAll(r.Body)
		*requests = append(*requests, capturedRequest{method: r.Method, path: r.URL.Path, query: r.URL.RawQuery, body: string(body)})
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(reply))
	}))
	t.Cleanup(func() {
		server.Close()
		viper.Reset()
	})
	viper.Set(barryInnerPrefixPath, server.URL)
	viper.Set(barryInnerUserDetailSavePath, "/user/detail/save")
	viper.Set(barryInnerUserDetailUnbanPath, "/user/detail/unban")
	viper.Set(barryInnerUserDetailUnlockPath, "/user/detail/unlock")
	viper.Set(barryInnerUserDetailParentsPath, "/user/detail/parents")
	return NewUserDetailService(&Client{timeout: time.Second}), requests
}

func TestUserDetailUnbanAndUnlockPostUserID(t *testing.T) {
	service, requests := newUserDetailTestService(t, `{"code":"0","data":"用户已解封","errorMsg":"操作成功"}`)

	unban, err := service.Unban(context.Background(), &barryDTO.UnbanUserDetailDTO{UserID: 1843})
	if err != nil || !unban.Success {
		t.Fatalf("Unban() = %+v, %v", unban, err)
	}
	unlock, err := service.Unlock(context.Background(), &barryDTO.UnlockUserDetailDTO{UserID: 1828})
	if err != nil || !unlock.Success {
		t.Fatalf("Unlock() = %+v, %v", unlock, err)
	}

	want := []capturedRequest{
		{method: http.MethodPost, path: "/user/detail/unban", body: `{"userId":1843}`},
		{method: http.MethodPost, path: "/user/detail/unlock", body: `{"userId":1828}`},
	}
	if len(*requests) != len(want) {
		t.Fatalf("requests = %+v", *requests)
	}
	for i, got := range *requests {
		if got != want[i] {
			t.Fatalf("request %d = %+v, want %+v", i, got, want[i])
		}
	}
}

func TestUserDetailBusinessFailureKeepsBarryMessage(t *testing.T) {
	service, _ := newUserDetailTestService(t, `{"code":"1","errorMsg":"解封用户失败: 该用户未封禁"}`)

	response, err := service.Unban(context.Background(), &barryDTO.UnbanUserDetailDTO{UserID: 1535})

	if err != nil {
		t.Fatalf("Unban() error = %v", err)
	}
	if response.Success || response.Message != "解封用户失败: 该用户未封禁" {
		t.Fatalf("business failure lost: %+v", response)
	}
}

func TestUserDetailParentOptionsPassesTrimmedChannel(t *testing.T) {
	service, requests := newUserDetailTestService(t, `{"code":"0","data":[{"id":21,"username":"zm","channel":"ZM"}]}`)

	response, err := service.ParentOptions(context.Background(), " ZM ")

	if err != nil || !response.Success {
		t.Fatalf("ParentOptions() = %+v, %v", response, err)
	}
	if len(*requests) != 1 || (*requests)[0].method != http.MethodGet || (*requests)[0].path != "/user/detail/parents" ||
		(*requests)[0].query != "channel=ZM" {
		t.Fatalf("requests = %+v", *requests)
	}
	if len(response.Data) != 1 || response.Data[0].ID != 21 || response.Data[0].Username != "zm" || response.Data[0].Channel != "ZM" {
		t.Fatalf("data = %+v", response.Data)
	}
}

func TestUserDetailSaveForwardsOptionalParent(t *testing.T) {
	service, requests := newUserDetailTestService(t, `{"code":"0","data":"添加成功"}`)
	parent := int64(21)

	if _, err := service.Save(context.Background(), &barryDTO.SaveUserDetailDTO{Username: "newbie", Password: "pw", Channel: "ZM", ParentUserID: &parent}); err != nil {
		t.Fatalf("Save() error = %v", err)
	}
	if _, err := service.Save(context.Background(), &barryDTO.SaveUserDetailDTO{Username: "solo", Password: "pw", Channel: "ZM"}); err != nil {
		t.Fatalf("Save() error = %v", err)
	}

	var withParent, withoutParent map[string]any
	if err := json.Unmarshal([]byte((*requests)[0].body), &withParent); err != nil {
		t.Fatal(err)
	}
	if err := json.Unmarshal([]byte((*requests)[1].body), &withoutParent); err != nil {
		t.Fatal(err)
	}
	if withParent["parentUserId"] != float64(21) {
		t.Fatalf("parentUserId not forwarded: %v", withParent)
	}
	if _, ok := withoutParent["parentUserId"]; ok {
		t.Fatalf("parentUserId should be omitted: %v", withoutParent)
	}
}
