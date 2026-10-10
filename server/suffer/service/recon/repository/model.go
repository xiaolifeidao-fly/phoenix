package repository

import (
	"common/middleware/db"
	"time"
)

// OpeningDebt 上游社区的人工录入欠款(初始欠款), 和社区一对一: 每个社区最多一条有效记录.
// DebtDate 欠款日期: 金额是这天结束时的欠款(和人工记账的口径一样), 从次日开始累计充值 / 入账 / 手续费.
// 旧数据没填欠款日期时, 核对和账户状态从所选开始日累计.
// 表里旧的 effective_date / settle_status / settle_date 列已停用(见 alter_recon_account_opening_debt_single.sql).
type OpeningDebt struct {
	db.BaseEntity
	UserID    uint64     `gorm:"column:user_id;type:bigint unsigned;not null;index:idx_opening_debt_user_date,priority:1" description:"上游用户(user.id)"`
	AccountID uint64     `gorm:"column:account_id;type:bigint unsigned" description:"账户(account.id), 录入时快照"`
	Amount    string     `gorm:"column:amount;type:decimal(38,8);not null;default:0.00000000" description:"欠款金额 RMB, 可为负"`
	DebtDate  *time.Time `gorm:"column:debt_date;type:date" description:"欠款日期"`
	Remark    string     `gorm:"column:remark;type:varchar(255)" description:"备注"`
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
