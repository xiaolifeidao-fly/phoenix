package repository

import (
	"common/middleware/db"
	"time"
)

const (
	SettleStatusUnsettled = "UNSETTLED"
	SettleStatusSettled   = "SETTLED"
)

// OpeningDebt 上游用户账户的人工录入欠款(初始欠款), 按生效日期排成一条时间线:
// 同一用户同一时刻只有一条未结清; 录入新的一条时, 上一条自动结清, 结清日期 = 新记录的生效日期.
// 算某天的系统欠款时, 取生效日期 <= 该天的最近一条作为起点(不论是否已结清).
type OpeningDebt struct {
	db.BaseEntity
	UserID        uint64     `gorm:"column:user_id;type:bigint unsigned;not null;index:idx_opening_debt_user_date,priority:1" description:"上游用户(user.id)"`
	AccountID     uint64     `gorm:"column:account_id;type:bigint unsigned" description:"账户(account.id), 录入时快照"`
	Amount        string     `gorm:"column:amount;type:decimal(38,8);not null;default:0.00000000" description:"欠款金额 RMB, 可为负"`
	EffectiveDate time.Time  `gorm:"column:effective_date;type:date;not null;index:idx_opening_debt_user_date,priority:2" description:"生效日期"`
	SettleStatus  string     `gorm:"column:settle_status;type:varchar(16);not null;default:UNSETTLED" description:"UNSETTLED 未结清 / SETTLED 已结清"`
	SettleDate    *time.Time `gorm:"column:settle_date;type:date" description:"结清日期"`
	Remark        string     `gorm:"column:remark;type:varchar(255)" description:"备注"`
}

func (o *OpeningDebt) TableName() string { return "recon_account_opening_debt" }

// TradingUserBalanceRow 活跃上游用户及其当前账户余额.
type TradingUserBalanceRow struct {
	UserID        uint64  `gorm:"column:user_id"`
	Name          string  `gorm:"column:name"`
	Username      string  `gorm:"column:username"`
	Remark        string  `gorm:"column:remark"`
	AccountID     uint64  `gorm:"column:account_id"`
	AccountStatus string  `gorm:"column:account_status"`
	BalanceAmount float64 `gorm:"column:balance_amount"`
}
