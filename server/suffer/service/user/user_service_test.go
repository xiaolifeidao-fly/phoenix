package user

import (
	"reflect"
	"testing"
)

func TestUniqueUint64IDs(t *testing.T) {
	got := uniqueUint64IDs([]uint64{3, 0, 2, 3, 1, 2})
	want := []uint64{3, 2, 1}
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("uniqueUint64IDs() = %#v, want %#v", got, want)
	}
}
