package account

import (
	"reflect"
	"testing"
)

func TestSplitAccountDetailTypes(t *testing.T) {
	tests := []struct {
		name  string
		value string
		want  []string
	}{
		{name: "single", value: "PAY", want: []string{"PAY"}},
		{name: "multiple", value: " PAY, given ", want: []string{"PAY", "GIVEN"}},
		{name: "deduplicate", value: "PAY,pay,GIVEN", want: []string{"PAY", "GIVEN"}},
		{name: "empty parts", value: ", ,", want: []string{}},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			if got := splitAccountDetailTypes(test.value); !reflect.DeepEqual(got, test.want) {
				t.Fatalf("splitAccountDetailTypes(%q) = %#v, want %#v", test.value, got, test.want)
			}
		})
	}
}
