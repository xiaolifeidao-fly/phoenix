package barry

import (
	"testing"

	barryDTO "suffer/service/barry/dto"
)

func TestResolveSelectedProductTypes(t *testing.T) {
	available := []*barryDTO.ProductTypeDTO{
		{BarryBaseDTO: barryDTO.BarryBaseDTO{ID: 1}, Code: "MI_FOLLOW"},
		{BarryBaseDTO: barryDTO.BarryBaseDTO{ID: 2}, Code: "TK_FOLLOW"},
	}
	selected, err := resolveSelectedProductTypes([]string{" MI_FOLLOW ", "MI_FOLLOW", "TK_FOLLOW"}, available)
	if err != nil {
		t.Fatalf("resolveSelectedProductTypes() error = %v", err)
	}
	if len(selected) != 2 || selected[0].ID != 1 || selected[1].ID != 2 {
		t.Fatalf("resolveSelectedProductTypes() = %#v, want both selected product types in their source order", selected)
	}
}

func TestResolveSelectedProductTypesRejectsMissingAndEmptySelections(t *testing.T) {
	available := []*barryDTO.ProductTypeDTO{{Code: "MI_FOLLOW"}}
	if _, err := resolveSelectedProductTypes(nil, available); err == nil {
		t.Fatal("resolveSelectedProductTypes() error = nil, want an empty-selection error")
	}
	if _, err := resolveSelectedProductTypes([]string{"UNKNOWN"}, available); err == nil {
		t.Fatal("resolveSelectedProductTypes() error = nil, want a missing-type error")
	}
}
