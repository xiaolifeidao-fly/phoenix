package barry

import (
	"encoding/json"
	"testing"

	barryDTO "suffer/service/barry/dto"
)

func TestToPublicWorkbenchUserOverview(t *testing.T) {
	if got := toPublicWorkbenchUserOverview(nil); got != nil {
		t.Fatalf("toPublicWorkbenchUserOverview(nil) = %v, want nil", got)
	}

	overview := &barryDTO.WorkbenchUserOverviewDTO{
		UserCount:          10,
		AccountCount:       20,
		OnlineUserCount:    3,
		OnlineAccountCount: 7,
		DetailList: []*barryDTO.WorkbenchUserOnlineDetailDTO{
			{UserID: 1, Username: "alice", Channel: "tiktok", AccountCount: 2},
		},
	}

	got := toPublicWorkbenchUserOverview(overview)
	want := &barryDTO.WorkbenchPublicUserOverviewDTO{
		UserCount:          10,
		AccountCount:       20,
		OnlineUserCount:    3,
		OnlineAccountCount: 7,
	}
	if *got != *want {
		t.Fatalf("toPublicWorkbenchUserOverview() = %+v, want %+v", *got, *want)
	}

	payload, err := json.Marshal(got)
	if err != nil {
		t.Fatalf("marshal public overview: %v", err)
	}
	for _, forbidden := range []string{"detailList", "userId", "username", "channel"} {
		if bytesContains(payload, forbidden) {
			t.Fatalf("public overview payload %s leaks field %q", payload, forbidden)
		}
	}
}

func bytesContains(payload []byte, field string) bool {
	var decoded map[string]json.RawMessage
	if err := json.Unmarshal(payload, &decoded); err != nil {
		return false
	}
	_, ok := decoded[field]
	return ok
}
