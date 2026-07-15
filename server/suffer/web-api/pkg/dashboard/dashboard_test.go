package dashboard

import (
	"reflect"
	"testing"
)

func TestParseShopCategoryIDs(t *testing.T) {
	tests := []struct {
		name    string
		value   string
		want    []uint64
		wantErr bool
	}{
		{name: "empty uses all categories", value: "", want: nil},
		{name: "normal ids", value: "12,34", want: []uint64{12, 34}},
		{name: "trims and deduplicates", value: " 12, 34,12 ", want: []uint64{12, 34}},
		{name: "rejects zero", value: "0", wantErr: true},
		{name: "rejects malformed id", value: "12,abc", wantErr: true},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			got, err := parseShopCategoryIDs(test.value)
			if (err != nil) != test.wantErr {
				t.Fatalf("parseShopCategoryIDs(%q) error = %v, wantErr %v", test.value, err, test.wantErr)
			}
			if !test.wantErr && !reflect.DeepEqual(got, test.want) {
				t.Fatalf("parseShopCategoryIDs(%q) = %v, want %v", test.value, got, test.want)
			}
		})
	}
}
