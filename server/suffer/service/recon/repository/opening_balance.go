package repository

import (
	"common/middleware/db"
	"fmt"
	"time"

	"gorm.io/gorm"
)

// OpeningBalanceScopeGlobal 全局只有一条初始余额, 用 scope 唯一保证.
const OpeningBalanceScopeGlobal = "GLOBAL"

// OpeningBalance 对账工作台 - 账户状态里的全局初始余额: 金额是 BalanceDate 这天结束时账上的余额(和人工记账口径一样).
// 人工记账对比以它为基准: 系统应有余额 = 初始余额 + 初始余额日期次日到当天的(入账 − 出账), 不再拿上一份人工记账当起点.
// 清除只置 active = 0, 再录入复用这一行.
type OpeningBalance struct {
	db.BaseEntity
	Scope        string    `gorm:"column:scope;type:varchar(16);not null;default:GLOBAL;uniqueIndex:uk_recon_opening_balance_scope" description:"固定 GLOBAL"`
	BalanceDate  time.Time `gorm:"column:balance_date;type:date;not null" description:"初始余额日期"`
	Currency     string    `gorm:"column:currency;type:varchar(8);not null;default:USDT" description:"币种 USDT / RMB"`
	Balance      string    `gorm:"column:balance;type:decimal(38,8);not null;default:0.00000000" description:"初始余额(按 currency)"`
	ExchangeRate *string   `gorm:"column:exchange_rate;type:decimal(20,8)" description:"1U = ? RMB, 按 U 时必填"`
	BalanceRmb   string    `gorm:"column:balance_rmb;type:decimal(38,8);not null;default:0.00000000" description:"初始余额折算 RMB"`
	Remark       string    `gorm:"column:remark;type:varchar(255)" description:"备注"`
}

func (o *OpeningBalance) TableName() string { return "recon_opening_balance" }

type OpeningBalanceRepository struct{ db.Repository[*OpeningBalance] }

func (r *OpeningBalanceRepository) EnsureTable() error {
	if r.Db == nil {
		return fmt.Errorf("database is not initialized")
	}
	return r.Db.AutoMigrate(&OpeningBalance{})
}

// Find 当前有效的初始余额, 没有返回 nil.
func (r *OpeningBalanceRepository) Find() (*OpeningBalance, error) {
	if r.Db == nil {
		return nil, fmt.Errorf("database is not initialized")
	}
	rows := make([]*OpeningBalance, 0, 1)
	err := r.Db.Where("scope = ? AND active = 1", OpeningBalanceScopeGlobal).Limit(1).Find(&rows).Error
	if err != nil || len(rows) == 0 {
		return nil, err
	}
	return rows[0], nil
}

// Lock 事务里锁住这一行(含已清除的), 没有返回 nil.
func (r *OpeningBalanceRepository) Lock(tx *gorm.DB) (*OpeningBalance, error) {
	rows := make([]*OpeningBalance, 0, 1)
	err := tx.Raw("SELECT * FROM recon_opening_balance WHERE scope = ? LIMIT 1 FOR UPDATE", OpeningBalanceScopeGlobal).Scan(&rows).Error
	if err != nil || len(rows) == 0 {
		return nil, err
	}
	return rows[0], nil
}
