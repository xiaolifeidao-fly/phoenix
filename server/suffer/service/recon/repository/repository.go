package repository

import (
	"common/middleware/db"
	"fmt"
	"time"

	"gorm.io/gorm"
)

type OpeningDebtRepository struct{ db.Repository[*OpeningDebt] }

func (r *OpeningDebtRepository) EnsureTable() error {
	if r.Db == nil {
		return fmt.Errorf("database is not initialized")
	}
	if err := r.Db.AutoMigrate(&OpeningDebt{}); err != nil {
		return err
	}
	if err := r.relaxLegacyColumns(); err != nil {
		return err
	}
	return r.fillDebtDate()
}

// fillDebtDate 没执行 alter_recon_account_opening_debt_single.sql 的环境兜底补欠款日期:
// 旧版生效日当天的流水算在欠款里, 和欠款日期同义; 开发期的 start_date 录的也是欠款日期.
func (r *OpeningDebtRepository) fillDebtDate() error {
	for _, column := range []string{"start_date", "effective_date"} {
		if !r.Db.Migrator().HasColumn(&OpeningDebt{}, column) {
			continue
		}
		if err := r.Db.Exec("UPDATE `recon_account_opening_debt` SET debt_date = `" + column + "` WHERE debt_date IS NULL AND `" + column + "` IS NOT NULL").Error; err != nil {
			return err
		}
	}
	return nil
}

// relaxLegacyColumns 旧版按生效日期排时间线, effective_date 是 NOT NULL 且没有默认值, 模型去掉它之后新增会失败;
// 没执行 alter_recon_account_opening_debt_single.sql 的环境这里兜底改成可空.
func (r *OpeningDebtRepository) relaxLegacyColumns() error {
	columns, err := r.Db.Migrator().ColumnTypes(&OpeningDebt{})
	if err != nil {
		return err
	}
	for _, column := range columns {
		if column.Name() != "effective_date" {
			continue
		}
		if nullable, ok := column.Nullable(); ok && nullable {
			return nil
		}
		return r.Db.Exec("ALTER TABLE `recon_account_opening_debt` MODIFY `effective_date` date DEFAULT NULL COMMENT '已停用'").Error
	}
	return nil
}

// ListByUsers 这些用户的有效录入, 按用户、id 升序; 正常每个用户最多一条, 有多条时以最后一条为准.
func (r *OpeningDebtRepository) ListByUsers(database *gorm.DB, userIDs []uint64) ([]*OpeningDebt, error) {
	rows := make([]*OpeningDebt, 0)
	if len(userIDs) == 0 {
		return rows, nil
	}
	err := r.orDefault(database).Where("active = 1 AND user_id IN ?", userIDs).
		Order("user_id ASC, id ASC").Find(&rows).Error
	return rows, err
}

// LockUser 在事务里锁住用户行, 同一用户的录入 / 修改 / 清除串行执行, 保证每个用户最多一条.
func (r *OpeningDebtRepository) LockUser(tx *gorm.DB, userID uint64) (bool, error) {
	var ids []uint64
	if err := tx.Raw("SELECT id FROM `user` WHERE id = ? AND active = 1 FOR UPDATE", userID).Scan(&ids).Error; err != nil {
		return false, err
	}
	return len(ids) > 0, nil
}

// LatestAccountID 用户最新一个账户; 没有返回 0.
func (r *OpeningDebtRepository) LatestAccountID(tx *gorm.DB, userID uint64) (uint64, error) {
	var ids []uint64
	err := r.orDefault(tx).Raw("SELECT id FROM account WHERE user_id = ? AND active = 1 ORDER BY id DESC LIMIT 1", userID).Scan(&ids).Error
	if err != nil || len(ids) == 0 {
		return 0, err
	}
	return ids[0], nil
}

// ListTradingUserBalances 活跃(user.is_trading = 1)的上游用户, 带当前账户余额; 多个账户时余额合计、账户取最新.
func (r *OpeningDebtRepository) ListTradingUserBalances() ([]TradingUserBalanceRow, error) {
	if r.Db == nil {
		return nil, fmt.Errorf("database is not initialized")
	}
	rows := make([]TradingUserBalanceRow, 0)
	err := r.Db.Raw("SELECT u.id AS user_id, COALESCE(u.name, '') AS name, COALESCE(u.username, '') AS username,\n" +
		"  COALESCE(u.remark, '') AS remark,\n" +
		"  COALESCE(MAX(a.id), 0) AS account_id,\n" +
		"  COALESCE(SUBSTRING_INDEX(GROUP_CONCAT(a.account_status ORDER BY a.id DESC), ',', 1), '') AS account_status,\n" +
		"  COALESCE(SUM(a.balance_amount), 0) AS balance_amount\n" +
		"FROM `user` u\n" +
		"LEFT JOIN account a ON a.user_id = u.id AND a.active = 1\n" +
		"WHERE u.active = 1 AND u.is_trading = 1\n" +
		"GROUP BY u.id, u.name, u.username, u.remark\n" +
		"ORDER BY u.id").Scan(&rows).Error
	return rows, err
}

// SumRecharge 用户所有账户在 [start, end) 内的充值(account_detail PAY)合计, 取绝对值.
func (r *OpeningDebtRepository) SumRecharge(userID uint64, start, end time.Time) (float64, error) {
	if r.Db == nil {
		return 0, fmt.Errorf("database is not initialized")
	}
	var row struct {
		Amount float64 `gorm:"column:amount"`
	}
	err := r.Db.Raw(`SELECT COALESCE(SUM(ABS(IFNULL(ad.amount, 0))), 0) AS amount
		FROM account_detail ad
		JOIN account a ON a.id = ad.account_id
		WHERE a.user_id = ? AND ad.type = 'PAY' AND ad.created_time >= ? AND ad.created_time < ?`, userID, start, end).Scan(&row).Error
	return row.Amount, err
}

// RechargeDailyRow 某个用户某天的充值合计.
type RechargeDailyRow struct {
	UserID uint64  `gorm:"column:user_id"`
	Day    string  `gorm:"column:day"`
	Amount float64 `gorm:"column:amount"`
}

// SumRechargeDaily 这些用户在 [start, end) 内每天的充值(account_detail PAY)合计, 取绝对值; 没有充值的天不返回.
func (r *OpeningDebtRepository) SumRechargeDaily(userIDs []uint64, start, end time.Time) ([]RechargeDailyRow, error) {
	rows := make([]RechargeDailyRow, 0)
	if len(userIDs) == 0 || !end.After(start) {
		return rows, nil
	}
	if r.Db == nil {
		return nil, fmt.Errorf("database is not initialized")
	}
	err := r.Db.Raw(`SELECT a.user_id AS user_id, DATE_FORMAT(ad.created_time, '%Y-%m-%d') AS day,
		COALESCE(SUM(ABS(IFNULL(ad.amount, 0))), 0) AS amount
		FROM account_detail ad
		JOIN account a ON a.id = ad.account_id
		WHERE a.user_id IN ? AND ad.type = 'PAY' AND ad.created_time >= ? AND ad.created_time < ?
		GROUP BY a.user_id, DATE_FORMAT(ad.created_time, '%Y-%m-%d')`, userIDs, start, end).Scan(&rows).Error
	return rows, err
}

func (r *OpeningDebtRepository) orDefault(database *gorm.DB) *gorm.DB {
	if database != nil {
		return database
	}
	return r.Db
}
