package repository

import (
	"common/middleware/db"
	"fmt"
	"time"

	"gorm.io/gorm/clause"
)

// UpstreamBalanceSnapshot 上游社区每天的账户余额快照: 每天 00:00 给活跃社区打前一天的,
// 比如 10-09 00:00 打的是 10-08 的(snapshot_date = 2026-10-08), 人工记账里按记账日期取, 大家看到的都是那天的数.
// (snapshot_date, user_id) 唯一, 多个实例同时打时先写入的为准, 打过的不再覆盖.
type UpstreamBalanceSnapshot struct {
	db.BaseEntity
	SnapshotDate time.Time `gorm:"column:snapshot_date;type:date;not null;uniqueIndex:uk_recon_upstream_balance_snapshot,priority:1" description:"余额所属日期(截至这天结束)"`
	UserID       uint64    `gorm:"column:user_id;type:bigint unsigned;not null;uniqueIndex:uk_recon_upstream_balance_snapshot,priority:2" description:"上游社区(user.id)"`
	Balance      string    `gorm:"column:balance;type:decimal(38,8);not null;default:0.00000000" description:"账户余额 RMB(该用户所有有效账户合计)"`
	CapturedTime time.Time `gorm:"column:captured_time;type:datetime;not null" description:"实际打快照的时间"`
}

func (m *UpstreamBalanceSnapshot) TableName() string { return "recon_upstream_balance_snapshot" }

// UserBalanceRow 某个用户当前的账户余额.
type UserBalanceRow struct {
	UserID  uint64  `gorm:"column:user_id"`
	Balance float64 `gorm:"column:balance"`
}

type BalanceSnapshotRepository struct {
	db.Repository[*UpstreamBalanceSnapshot]
}

func (r *BalanceSnapshotRepository) EnsureTable() error {
	if r.Db == nil {
		return fmt.Errorf("database is not initialized")
	}
	return r.Db.AutoMigrate(&UpstreamBalanceSnapshot{})
}

// SnapshotUserIDs 要打快照的社区 = 活跃上游用户(is_trading = 1) ∪ 最近一份人工记账里记过欠款的社区,
// 后者保证人工记账里列出的社区都有快照, 即使它已经不是活跃用户.
func (r *BalanceSnapshotRepository) SnapshotUserIDs() ([]uint64, error) {
	if r.Db == nil {
		return nil, fmt.Errorf("database is not initialized")
	}
	ids := make([]uint64, 0)
	err := r.Db.Raw("SELECT u.id FROM `user` u WHERE u.active = 1 AND (u.is_trading = 1 OR u.id IN (\n" +
		"  SELECT d.upstream_user_id FROM recon_manual_book_debt d WHERE d.active = 1 AND d.book_id = (\n" +
		"    SELECT b.id FROM recon_manual_book b WHERE b.active = 1 ORDER BY b.book_date DESC LIMIT 1)))\n" +
		"ORDER BY u.id").Scan(&ids).Error
	return ids, err
}

// CurrentBalances 这些用户当前的账户余额(所有有效账户合计); 没有账户的按 0.
func (r *BalanceSnapshotRepository) CurrentBalances(userIDs []uint64) ([]UserBalanceRow, error) {
	rows := make([]UserBalanceRow, 0)
	if len(userIDs) == 0 {
		return rows, nil
	}
	err := r.Db.Raw("SELECT u.id AS user_id, COALESCE(SUM(a.balance_amount), 0) AS balance\n"+
		"FROM `user` u LEFT JOIN account a ON a.user_id = u.id AND a.active = 1\n"+
		"WHERE u.id IN ? GROUP BY u.id", userIDs).Scan(&rows).Error
	return rows, err
}

// InsertIgnore 写入快照, 同一天同一社区已经有的跳过.
func (r *BalanceSnapshotRepository) InsertIgnore(rows []*UpstreamBalanceSnapshot) error {
	if len(rows) == 0 {
		return nil
	}
	return r.Db.Clauses(clause.OnConflict{DoNothing: true}).CreateInBatches(rows, 200).Error
}

// CountByDate 某天已有的快照条数, 用来判断这天打过没有.
func (r *BalanceSnapshotRepository) CountByDate(day time.Time) (int64, error) {
	var count int64
	err := r.Db.Model(&UpstreamBalanceSnapshot{}).Where("active = 1 AND snapshot_date = ?", day).Count(&count).Error
	return count, err
}

// ListByDates 这些日期的快照.
func (r *BalanceSnapshotRepository) ListByDates(days []time.Time) ([]*UpstreamBalanceSnapshot, error) {
	rows := make([]*UpstreamBalanceSnapshot, 0)
	if len(days) == 0 {
		return rows, nil
	}
	if r.Db == nil {
		return nil, fmt.Errorf("database is not initialized")
	}
	err := r.Db.Where("active = 1 AND snapshot_date IN ?", days).Find(&rows).Error
	return rows, err
}
