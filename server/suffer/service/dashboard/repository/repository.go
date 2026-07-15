package repository

import (
	"common/middleware/db"
	"fmt"
	"time"

	"gorm.io/gorm"
)

// DashboardRepository owns the SQL used by manager dashboard statistics. It
// intentionally reads the existing upstream account/order tables and does not
// create a parallel dashboard data store.
type DashboardRepository struct {
	Db *gorm.DB
}

func (r *DashboardRepository) SetDb(database *gorm.DB) {
	r.Db = database
}

type LedgerAmountRow struct {
	Amount float64 `gorm:"column:amount"`
}

type ConsumeDetailRow struct {
	AccountID     uint64  `gorm:"column:account_id"`
	UserID        uint64  `gorm:"column:user_id"`
	Username      string  `gorm:"column:username"`
	Remark        string  `gorm:"column:remark"`
	ConsumeAmount float64 `gorm:"column:consume_amount"`
	RefundAmount  float64 `gorm:"column:refund_amount"`
	BKAmount      float64 `gorm:"column:bk_amount"`
}

type RechargeDetailRow struct {
	AccountID uint64  `gorm:"column:account_id"`
	UserID    uint64  `gorm:"column:user_id"`
	Username  string  `gorm:"column:username"`
	Remark    string  `gorm:"column:remark"`
	Amount    float64 `gorm:"column:amount"`
}

type BalanceDetailRow struct {
	AccountID     uint64  `gorm:"column:account_id"`
	UserID        uint64  `gorm:"column:user_id"`
	Username      string  `gorm:"column:username"`
	Remark        string  `gorm:"column:remark"`
	BalanceAmount float64 `gorm:"column:balance_amount"`
}

type ActualCompletedRow struct {
	Count int64 `gorm:"column:count"`
}

type ActualCompletedCategoryRow struct {
	ShopCategoryID uint64 `gorm:"column:shop_category_id"`
	Count          int64  `gorm:"column:count"`
}

type ActualCompletedPeriodCategoryRow struct {
	ShopCategoryID        uint64 `gorm:"column:shop_category_id"`
	TodayCount            int64  `gorm:"column:today_count"`
	YesterdayCurrentCount int64  `gorm:"column:yesterday_current_count"`
	YesterdaySameCount    int64  `gorm:"column:yesterday_same_count"`
	PendingOrderCount     int64  `gorm:"column:pending_order_count"`
	PendingCount          int64  `gorm:"column:pending_count"`
	TotalOrderCount       int64  `gorm:"column:total_order_count"`
	TotalCount            int64  `gorm:"column:total_count"`
	CompletedOrderCount   int64  `gorm:"column:completed_order_count"`
}

func NewDashboardRepository() *DashboardRepository {
	return db.GetRepository[DashboardRepository]()
}

func (r *DashboardRepository) SumLedgerAmount(types []string, start, end time.Time) (float64, error) {
	if r.Db == nil {
		return 0, fmt.Errorf("database is not initialized")
	}
	var row LedgerAmountRow
	err := r.Db.Raw(`SELECT COALESCE(SUM(IFNULL(amount, 0)), 0) AS amount
		FROM account_detail
		WHERE type IN ? AND created_time >= ? AND created_time < ?`, types, start, end).Scan(&row).Error
	return row.Amount, err
}

// ListConsumeDetails aggregates today's CONSUMER/REFUND/BK amounts per account in
// a single pass over account_detail. Conditional SUM replaces the previous three
// self-joined subqueries so the (type, created_time) range is scanned only once.
// Refund/BK-only accounts are also returned (consume_amount = 0); the service keeps
// the total accurate from these rows and filters the detail list back to consumers.
func (r *DashboardRepository) ListConsumeDetails(start, end time.Time) ([]ConsumeDetailRow, error) {
	if r.Db == nil {
		return nil, fmt.Errorf("database is not initialized")
	}
	rows := make([]ConsumeDetailRow, 0)
	err := r.Db.Raw(`SELECT
		ad.account_id,
		COALESCE(acc.user_id, 0) AS user_id,
		COALESCE(u.username, '') AS username,
		COALESCE(u.remark, '') AS remark,
		SUM(CASE WHEN ad.type = 'CONSUMER' THEN IFNULL(ad.amount, 0) ELSE 0 END) AS consume_amount,
		SUM(CASE WHEN ad.type = 'REFUND'   THEN IFNULL(ad.amount, 0) ELSE 0 END) AS refund_amount,
		SUM(CASE WHEN ad.type = 'BK'       THEN IFNULL(ad.amount, 0) ELSE 0 END) AS bk_amount
	FROM account_detail ad
	LEFT JOIN account acc ON acc.id = ad.account_id
	LEFT JOIN user u ON u.id = acc.user_id
	WHERE ad.type IN ('CONSUMER', 'REFUND', 'BK')
	  AND ad.created_time >= ? AND ad.created_time < ?
	GROUP BY ad.account_id, acc.user_id, u.username, u.remark
	ORDER BY consume_amount DESC`, start, end).Scan(&rows).Error
	return rows, err
}

func (r *DashboardRepository) ListRechargeDetails(amountType string, start, end time.Time) ([]RechargeDetailRow, error) {
	if r.Db == nil {
		return nil, fmt.Errorf("database is not initialized")
	}
	rows := make([]RechargeDetailRow, 0)
	err := r.Db.Raw(`SELECT ad.account_id, COALESCE(acc.user_id, 0) AS user_id,
		COALESCE(u.username, '') AS username, COALESCE(u.remark, '') AS remark,
		SUM(IFNULL(ad.amount, 0)) AS amount
	FROM account_detail ad
	LEFT JOIN account acc ON acc.id = ad.account_id
	LEFT JOIN user u ON u.id = acc.user_id
	WHERE ad.type = ? AND ad.created_time >= ? AND ad.created_time < ?
	GROUP BY ad.account_id, acc.user_id, u.username, u.remark
	ORDER BY amount DESC`, amountType, start, end).Scan(&rows).Error
	return rows, err
}

func (r *DashboardRepository) ListSystemBalanceDetails() ([]BalanceDetailRow, error) {
	if r.Db == nil {
		return nil, fmt.Errorf("database is not initialized")
	}
	rows := make([]BalanceDetailRow, 0)
	err := r.Db.Raw(`SELECT acc.id AS account_id, COALESCE(acc.user_id, 0) AS user_id,
		COALESCE(u.username, '') AS username, COALESCE(u.remark, '') AS remark, acc.balance_amount
	FROM account acc
	LEFT JOIN user u ON u.id = acc.user_id
	WHERE acc.account_status = 'ACTIVE'
	ORDER BY acc.balance_amount DESC`).Scan(&rows).Error
	return rows, err
}

func (r *DashboardRepository) ActualCompletedByOrderCreatedAt(start, end time.Time, shopCategoryIDs []uint64) (int64, error) {
	if r.Db == nil {
		return 0, fmt.Errorf("database is not initialized")
	}
	var row ActualCompletedRow
	query := `SELECT COALESCE(SUM(CASE
		WHEN order_status = 'DONE' THEN IFNULL(order_num, 0)
		WHEN order_status IN ('PENDING', 'REFUND') THEN IFNULL(end_num, 0) - IFNULL(init_num, 0)
		ELSE 0
	END), 0) AS count
	FROM order_record
	WHERE created_time >= ? AND created_time < ?`
	args := []interface{}{start, end}
	if len(shopCategoryIDs) > 0 {
		query += " AND shop_category_id IN ?"
		args = append(args, shopCategoryIDs)
	}
	err := r.Db.Raw(query, args...).Scan(&row).Error
	return row.Count, err
}

func (r *DashboardRepository) ActualCompletedSnapshot(sumDate string, shopCategoryIDs []uint64) (int64, bool, error) {
	if r.Db == nil {
		return 0, false, fmt.Errorf("database is not initialized")
	}
	var row struct {
		Count        int64 `gorm:"column:count"`
		SnapshotRows int64 `gorm:"column:snapshot_rows"`
	}
	query := `SELECT
		COUNT(1) AS snapshot_rows,
		COALESCE(SUM(CASE
			WHEN order_status = 'DONE' THEN IFNULL(order_num, 0)
			WHEN order_status IN ('PENDING', 'REFUND') THEN IFNULL(done_num, 0)
			ELSE 0
		END), 0) AS count
	FROM order_record_snapshot_daily
	WHERE sum_date = ?`
	args := []interface{}{sumDate}
	if len(shopCategoryIDs) > 0 {
		query += " AND shop_category_id IN ?"
		args = append(args, shopCategoryIDs)
	}
	err := r.Db.Raw(query, args...).Scan(&row).Error
	return row.Count, row.SnapshotRows > 0, err
}

func (r *DashboardRepository) ActualCompletedByCategory(start, end time.Time, shopCategoryIDs []uint64) ([]ActualCompletedCategoryRow, error) {
	if r.Db == nil {
		return nil, fmt.Errorf("database is not initialized")
	}
	rows := make([]ActualCompletedCategoryRow, 0)
	query := `SELECT shop_category_id, COALESCE(SUM(CASE
		WHEN order_status = 'DONE' THEN IFNULL(order_num, 0)
		WHEN order_status IN ('PENDING', 'REFUND') THEN IFNULL(end_num, 0) - IFNULL(init_num, 0)
		ELSE 0
	END), 0) AS count
	FROM order_record
	WHERE created_time >= ? AND created_time < ?`
	args := []interface{}{start, end}
	if len(shopCategoryIDs) > 0 {
		query += " AND shop_category_id IN ?"
		args = append(args, shopCategoryIDs)
	}
	query += " GROUP BY shop_category_id"
	err := r.Db.Raw(query, args...).Scan(&rows).Error
	return rows, err
}

func (r *DashboardRepository) ActualCompletedSnapshotByCategory(sumDate string, shopCategoryIDs []uint64) ([]ActualCompletedCategoryRow, error) {
	if r.Db == nil {
		return nil, fmt.Errorf("database is not initialized")
	}
	rows := make([]ActualCompletedCategoryRow, 0)
	query := `SELECT shop_category_id, COALESCE(SUM(CASE
		WHEN order_status = 'DONE' THEN IFNULL(order_num, 0)
		WHEN order_status IN ('PENDING', 'REFUND') THEN IFNULL(done_num, 0)
		ELSE 0
	END), 0) AS count
	FROM order_record_snapshot_daily
	WHERE sum_date = ?`
	args := []interface{}{sumDate}
	if len(shopCategoryIDs) > 0 {
		query += " AND shop_category_id IN ?"
		args = append(args, shopCategoryIDs)
	}
	query += " GROUP BY shop_category_id"
	err := r.Db.Raw(query, args...).Scan(&rows).Error
	return rows, err
}

// ActualCompletedPeriodsByCategory scans the last two days once and derives all
// three running totals needed by the dashboard from conditional aggregation.
func (r *DashboardRepository) ActualCompletedPeriodsByCategory(todayStart, tomorrowStart, yesterdaySameEnd time.Time, shopCategoryIDs []uint64) ([]ActualCompletedPeriodCategoryRow, error) {
	if r.Db == nil {
		return nil, fmt.Errorf("database is not initialized")
	}
	yesterdayStart := todayStart.AddDate(0, 0, -1)
	rows := make([]ActualCompletedPeriodCategoryRow, 0)
	query := `SELECT shop_category_id,
		COALESCE(SUM(CASE WHEN created_time >= ? AND created_time < ? THEN CASE
			WHEN order_status = 'DONE' THEN IFNULL(order_num, 0)
			WHEN order_status IN ('PENDING', 'REFUND') THEN IFNULL(end_num, 0) - IFNULL(init_num, 0)
			ELSE 0 END ELSE 0 END), 0) AS today_count,
		COALESCE(SUM(CASE WHEN created_time >= ? AND created_time < ? THEN CASE
			WHEN order_status = 'DONE' THEN IFNULL(order_num, 0)
			WHEN order_status IN ('PENDING', 'REFUND') THEN IFNULL(end_num, 0) - IFNULL(init_num, 0)
			ELSE 0 END ELSE 0 END), 0) AS yesterday_current_count,
		COALESCE(SUM(CASE WHEN created_time >= ? AND created_time < ? THEN CASE
			WHEN order_status = 'DONE' THEN IFNULL(order_num, 0)
			WHEN order_status IN ('PENDING', 'REFUND') THEN IFNULL(end_num, 0) - IFNULL(init_num, 0)
			ELSE 0 END ELSE 0 END), 0) AS yesterday_same_count,
		COALESCE(SUM(CASE WHEN created_time >= ? AND created_time < ? AND order_status = 'PENDING' THEN 1 ELSE 0 END), 0) AS pending_order_count,
		COALESCE(SUM(CASE WHEN created_time >= ? AND created_time < ? AND order_status = 'PENDING' THEN IFNULL(order_num, 0) ELSE 0 END), 0) AS pending_count,
		COALESCE(SUM(CASE WHEN created_time >= ? AND created_time < ? THEN 1 ELSE 0 END), 0) AS total_order_count,
		COALESCE(SUM(CASE WHEN created_time >= ? AND created_time < ? THEN IFNULL(order_num, 0) ELSE 0 END), 0) AS total_count,
		COALESCE(SUM(CASE WHEN created_time >= ? AND created_time < ? AND order_status = 'DONE' THEN 1 ELSE 0 END), 0) AS completed_order_count
	FROM order_record
	WHERE created_time >= ? AND created_time < ?`
	args := []interface{}{
		todayStart, tomorrowStart,
		yesterdayStart, todayStart,
		yesterdayStart, yesterdaySameEnd,
		todayStart, tomorrowStart,
		todayStart, tomorrowStart,
		todayStart, tomorrowStart,
		todayStart, tomorrowStart,
		todayStart, tomorrowStart,
		yesterdayStart, tomorrowStart,
	}
	if len(shopCategoryIDs) > 0 {
		query += " AND shop_category_id IN ?"
		args = append(args, shopCategoryIDs)
	}
	query += " GROUP BY shop_category_id"
	err := r.Db.Raw(query, args...).Scan(&rows).Error
	return rows, err
}
