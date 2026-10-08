package barry

import (
	"testing"

	barryDTO "suffer/service/barry/dto"
)

func TestSettleValidation(t *testing.T) {
	num := func(f float64) *float64 { return &f }
	ok := &barryDTO.SettleChannelDTO{Name: "A", CollectFeeRate: num(0.045), PayoutFeeRate: num(0),
		CollectFeeRateU: num(0.03), PayoutFeeRateU: num(0.01), ExchangeRate: num(7.2)}
	if msg := validateSettleChannel(ok); msg != "" {
		t.Fatalf("expected valid channel: %s", msg)
	}
	bad := []*barryDTO.SettleChannelDTO{
		{Name: "", CollectFeeRate: num(0), PayoutFeeRate: num(0), CollectFeeRateU: num(0), PayoutFeeRateU: num(0)},
		{Name: "A", CollectFeeRate: nil, PayoutFeeRate: num(0), CollectFeeRateU: num(0), PayoutFeeRateU: num(0)},
		{Name: "A", CollectFeeRate: num(0), PayoutFeeRate: num(1.01), CollectFeeRateU: num(0), PayoutFeeRateU: num(0)},
		{Name: "A", CollectFeeRate: num(-0.01), PayoutFeeRate: num(0), CollectFeeRateU: num(0), PayoutFeeRateU: num(0)},
	}
	bad = append(bad,
		&barryDTO.SettleChannelDTO{Name: "A", CollectFeeRate: num(0), PayoutFeeRate: num(0), CollectFeeRateU: nil, PayoutFeeRateU: num(0)},
		&barryDTO.SettleChannelDTO{Name: "A", CollectFeeRate: num(0), PayoutFeeRate: num(0), CollectFeeRateU: num(0), PayoutFeeRateU: num(1.5)},
		&barryDTO.SettleChannelDTO{Name: "A", CollectFeeRate: num(0), PayoutFeeRate: num(0), CollectFeeRateU: num(0), PayoutFeeRateU: num(0), ExchangeRate: num(0)},
	)
	for i, c := range bad {
		if validateSettleChannel(c) == "" {
			t.Fatalf("case %d should be rejected", i)
		}
	}
	yes, no := true, false
	disabledDefault := &barryDTO.SettleChannelDTO{Name: "A", CollectFeeRate: num(0), PayoutFeeRate: num(0), CollectFeeRateU: num(0), PayoutFeeRateU: num(0), Enabled: &no, DefaultChannel: &yes}
	if validateSettleChannel(disabledDefault) == "" {
		t.Fatal("disabled channel cannot be default")
	}
	noRate := &barryDTO.SettleChannelDTO{Name: "A", CollectFeeRate: num(0), PayoutFeeRate: num(0), CollectFeeRateU: num(0), PayoutFeeRateU: num(0)}
	if msg := validateSettleChannel(noRate); msg != "" {
		t.Fatalf("exchange rate is optional: %s", msg)
	}
	if !isValidSettleCurrency("USDT") || !isValidSettleCurrency("RMB") || isValidSettleCurrency("usdt") || isValidSettleCurrency("") {
		t.Fatal("settle currency validation mismatch")
	}
}

func TestReconLedgerValidation(t *testing.T) {
	num := func(f float64) *float64 { return &f }
	ok := &barryDTO.ReconLedgerDTO{RecordDate: " 2026-10-02 ", Category: "COMMUNITY_IN", Currency: "USDT", Amount: num(100), UpstreamUserID: " 88001 "}
	if msg := validateReconLedger(ok); msg != "" || ok.RecordDate != "2026-10-02" || ok.UpstreamUserID != "88001" {
		t.Fatalf("expected valid ledger: %q %q", msg, ok.RecordDate)
	}
	bad := []*barryDTO.ReconLedgerDTO{
		{RecordDate: "", Category: "OTHER_IN", Currency: "RMB", Amount: num(1)},
		{RecordDate: "2026-10-02", Category: "COMMUNITY_IN", Currency: "RMB", Amount: num(1), UpstreamUserID: "  "},
		{RecordDate: "2026-10-02", Category: "MANUAL_SETTLE", Currency: "RMB", Amount: num(1)},
		{RecordDate: "2026-10-02", Category: "", Currency: "RMB", Amount: num(1)},
		{RecordDate: "2026-10-02", Category: "OTHER_IN", Currency: "usdt", Amount: num(1)},
		{RecordDate: "2026-10-02", Category: "OTHER_IN", Currency: "RMB", Amount: num(0)},
		{RecordDate: "2026-10-02", Category: "OTHER_IN", Currency: "RMB"},
		{RecordDate: "2026-10-02", Category: "OTHER_IN", Currency: "USDT", Amount: num(1), ExchangeRate: num(-1)},
	}
	for i, c := range bad {
		if validateReconLedger(c) == "" {
			t.Fatalf("case %d should be rejected", i)
		}
	}
	userID := int64(7)
	serverOut := &barryDTO.ReconLedgerDTO{RecordDate: "2026-10-02", Category: "SERVER_OUT", Currency: "RMB", Amount: num(1), UserID: &userID}
	if msg := validateReconLedger(serverOut); msg != "" || serverOut.UserID != nil {
		t.Fatalf("manual out needs no downstream user and drops it: %q %+v", msg, serverOut)
	}
	payout := &barryDTO.ReconLedgerDTO{RecordDate: "2026-10-02", Category: "MANUAL_SETTLE", Currency: "RMB", Amount: num(1), UserID: &userID}
	if msg := validateReconLedger(payout); msg != "" || payout.UserID == nil || *payout.UserID != 7 {
		t.Fatalf("manual payout keeps downstream user: %q %+v", msg, payout)
	}
}

func TestFillUpstreamUser(t *testing.T) {
	original := lookupUpstreamUser
	defer func() { lookupUpstreamUser = original }()
	lookupUpstreamUser = func(id uint) (string, error) {
		if id == 12 {
			return "社区A", nil
		}
		return "", errUpstreamUserNotFound
	}

	req := &barryDTO.ReconLedgerDTO{Category: "COMMUNITY_IN", UpstreamUserID: "12", UpstreamUserName: "前端传的名字"}
	if msg, err := fillUpstreamUser(req); msg != "" || err != nil || req.UpstreamUserName != "社区A" {
		t.Fatalf("expected name from suffer user, got %q %v %+v", msg, err, req)
	}
	if msg, _ := fillUpstreamUser(&barryDTO.ReconLedgerDTO{Category: "COMMUNITY_IN", UpstreamUserID: "99"}); msg != "上游社区不存在" {
		t.Fatalf("unknown upstream should be rejected, got %q", msg)
	}
	if msg, _ := fillUpstreamUser(&barryDTO.ReconLedgerDTO{Category: "COMMUNITY_IN", UpstreamUserID: "abc"}); msg != "上游社区不正确" {
		t.Fatalf("non numeric upstream should be rejected, got %q", msg)
	}
	other := &barryDTO.ReconLedgerDTO{Category: "OTHER_IN", UpstreamUserID: "12", UpstreamUserName: "x"}
	if msg, err := fillUpstreamUser(other); msg != "" || err != nil || other.UpstreamUserID != "" || other.UpstreamUserName != "" {
		t.Fatalf("non community category should clear upstream fields: %+v", other)
	}
}
