package recon

import (
	"testing"

	reconDTO "suffer/service/recon/dto"
)

func TestDiffManualBook(t *testing.T) {
	rate := 7.2
	newRate := 7.1
	before := &manualBookSnapshot{
		Currency: "USDT", Balance: 86166.04, ExchangeRate: &rate,
		Debts: []reconDTO.ManualBookDebtDTO{
			{UpstreamUserID: 1, UpstreamUserName: "火车头", Currency: "RMB", Amount: 3900},
			{UpstreamUserID: 2, UpstreamUserName: "十年", Currency: "RMB", Amount: 1000},
			{UpstreamUserID: 3, UpstreamUserName: "全季真人", Currency: "RMB", Amount: -1961},
		},
	}
	after := &manualBookSnapshot{
		Currency: "USDT", Balance: 86200, ExchangeRate: &newRate, Remark: "补录",
		Debts: []reconDTO.ManualBookDebtDTO{
			{UpstreamUserID: 1, UpstreamUserName: "火车头", Currency: "RMB", Amount: 4100},
			{UpstreamUserID: 3, UpstreamUserName: "全季真人", Currency: "RMB", Amount: -1961},
			{UpstreamUserID: 4, UpstreamUserName: "乌拉", Currency: "USDT", Amount: 1438},
		},
	}
	changes := diffManualBook(before, after)
	want := []reconDTO.ManualBookChangeDTO{
		{Field: "balance", Label: "截至当天余额", Before: "86,166.04 U", After: "86,200 U"},
		{Field: "exchangeRate", Label: "汇率", Before: "1U = 7.2 RMB", After: "1U = 7.1 RMB"},
		{Field: "debt", Label: "欠款 · 火车头", Before: "3,900 RMB", After: "4,100 RMB"},
		{Field: "debt", Label: "欠款 · 十年", Before: "1,000 RMB"},
		{Field: "debt", Label: "欠款 · 乌拉", After: "1,438 U"},
		{Field: "remark", Label: "备注", After: "补录"},
	}
	if len(changes) != len(want) {
		t.Fatalf("changes = %+v", changes)
	}
	for i := range want {
		if changes[i] != want[i] {
			t.Errorf("change[%d] = %+v, want %+v", i, changes[i], want[i])
		}
	}

	if got := diffManualBook(before, before); len(got) != 0 {
		t.Fatalf("没改动不应有变化: %+v", got)
	}
	// 新增列出全部内容, 删除列出删除前的全部内容
	if created := diffManualBook(nil, before); len(created) != 5 || created[0].Before != "" || created[0].After != "86,166.04 U" {
		t.Fatalf("created = %+v", created)
	}
	if deleted := diffManualBook(before, nil); len(deleted) != 5 || deleted[4].Label != "欠款 · 全季真人" || deleted[4].Before != "-1,961 RMB" || deleted[4].After != "" {
		t.Fatalf("deleted = %+v", deleted)
	}
}
