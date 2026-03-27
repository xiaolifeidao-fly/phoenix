package repository

import "common/middleware/db"

type Dictionary struct {
	db.BaseEntity
	Code        string `gorm:"column:code;type:varchar(256);default:'';index:idx_dictionary_code" orm:"column(code);size(256);null" description:"编码"`
	Value       string `gorm:"column:value;type:varchar(256);default:''" orm:"column(value);size(256);null" description:"值"`
	Description string `gorm:"column:description;type:varchar(256);default:''" orm:"column(description);size(256);null" description:"描述"`
	Type        string `gorm:"column:type;type:varchar(256);default:'';index:idx_dictionary_type" orm:"column(type);size(256);null" description:"类型"`
}

func (d *Dictionary) TableName() string {
	return "dictionary"
}
