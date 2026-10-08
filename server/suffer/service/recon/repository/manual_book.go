package repository

import (
	"common/middleware/db"
	"fmt"
	"time"

	"gorm.io/gorm"
)

const (
	CurrencyRMB  = "RMB"
	CurrencyUSDT = "USDT"
)

// ManualBook 人工记账: 每天一份, 记当天的剩余金额(默认按 U), 用余额的变化算人工利润, 和出入账利润对比.
// book_date 唯一, 删除只置 active = 0, 同一天再记账时复用这一行.
type ManualBook struct {
	db.BaseEntity
	BookDate     time.Time `gorm:"column:book_date;type:date;not null;uniqueIndex:uk_recon_manual_book_date" description:"记账日期"`
	Currency     string    `gorm:"column:currency;type:varchar(8);not null;default:USDT" description:"剩余金额币种 USDT / RMB"`
	Balance      string    `gorm:"column:balance;type:decimal(38,8);not null;default:0.00000000" description:"剩余金额(按 currency)"`
	ExchangeRate *string   `gorm:"column:exchange_rate;type:decimal(20,8)" description:"1U = ? RMB, 有 U 金额时必填"`
	BalanceRmb   string    `gorm:"column:balance_rmb;type:decimal(38,8);not null;default:0.00000000" description:"剩余金额折算 RMB"`
	Remark       string    `gorm:"column:remark;type:varchar(255)" description:"备注"`
}

func (m *ManualBook) TableName() string { return "recon_manual_book" }

// ManualBookDebt 人工记账当天各上游社区的欠款, 每个社区一条(默认 RMB). 修改时旧的置 active = 0 再重新写入.
type ManualBookDebt struct {
	db.BaseEntity
	BookID           int    `gorm:"column:book_id;not null;index:idx_recon_manual_book_debt_book" description:"recon_manual_book.id"`
	UpstreamUserID   uint64 `gorm:"column:upstream_user_id;type:bigint unsigned;not null" description:"上游社区(user.id)"`
	UpstreamUserName string `gorm:"column:upstream_user_name;type:varchar(128)" description:"上游社区名称快照"`
	Currency         string `gorm:"column:currency;type:varchar(8);not null;default:RMB" description:"币种 RMB / USDT"`
	Amount           string `gorm:"column:amount;type:decimal(38,8);not null;default:0.00000000" description:"欠款金额(按 currency), 可为负"`
	AmountRmb        string `gorm:"column:amount_rmb;type:decimal(38,8);not null;default:0.00000000" description:"欠款折算 RMB"`
}

func (m *ManualBookDebt) TableName() string { return "recon_manual_book_debt" }

const (
	ManualBookActionCreate = "CREATE"
	ManualBookActionUpdate = "UPDATE"
	ManualBookActionDelete = "DELETE"
)

// ManualBookLog 人工记账的修改记录: 每次新增 / 修改 / 删除一条, 存改动前后的完整快照(JSON), 只增不改.
// 按 book_date 查, 某天删了又重新记账也能看到完整经过.
type ManualBookLog struct {
	db.BaseEntity
	BookID   int       `gorm:"column:book_id;not null" description:"recon_manual_book.id"`
	BookDate time.Time `gorm:"column:book_date;type:date;not null;index:idx_recon_manual_book_log_date" description:"记账日期"`
	Action   string    `gorm:"column:action;type:varchar(16);not null" description:"CREATE 新增 / UPDATE 修改 / DELETE 删除"`
	Before   *string   `gorm:"column:before_snapshot;type:text" description:"改动前快照, 新增时为空"`
	After    *string   `gorm:"column:after_snapshot;type:text" description:"改动后快照, 删除时为空"`
}

func (m *ManualBookLog) TableName() string { return "recon_manual_book_log" }

// UpstreamUserRow 上游社区名称, 用来校验和做快照.
type UpstreamUserRow struct {
	ID       uint64 `gorm:"column:id"`
	Name     string `gorm:"column:name"`
	Username string `gorm:"column:username"`
	Remark   string `gorm:"column:remark"`
	// Balance 当前账户余额(该用户所有有效账户合计), 已充值还没消费的部分
	Balance float64 `gorm:"column:balance"`
}

type ManualBookRepository struct{ db.Repository[*ManualBook] }

func (r *ManualBookRepository) EnsureTable() error {
	if r.Db == nil {
		return fmt.Errorf("database is not initialized")
	}
	return r.Db.AutoMigrate(&ManualBook{}, &ManualBookDebt{}, &ManualBookLog{})
}

// ListBetween [start, end] 内的有效记账, 日期升序.
func (r *ManualBookRepository) ListBetween(start, end time.Time) ([]*ManualBook, error) {
	if r.Db == nil {
		return nil, fmt.Errorf("database is not initialized")
	}
	rows := make([]*ManualBook, 0)
	err := r.Db.Where("active = 1 AND book_date BETWEEN ? AND ?", start, end).Order("book_date ASC").Find(&rows).Error
	return rows, err
}

// FindByDate 某天的有效记账, 没有返回 nil.
func (r *ManualBookRepository) FindByDate(day time.Time) (*ManualBook, error) {
	return r.findOne(r.Db.Where("active = 1 AND book_date = ?", day))
}

// FindLatestBefore day 之前最近一天的有效记账, 新记账时用它预填; 没有返回 nil.
func (r *ManualBookRepository) FindLatestBefore(day time.Time) (*ManualBook, error) {
	return r.findOne(r.Db.Where("active = 1 AND book_date < ?", day).Order("book_date DESC"))
}

// LockByDate 事务里锁住某天的记账行(含已删除的), 没有返回 nil.
func (r *ManualBookRepository) LockByDate(tx *gorm.DB, day time.Time) (*ManualBook, error) {
	return r.rawOne(tx.Raw("SELECT * FROM recon_manual_book WHERE book_date = ? LIMIT 1 FOR UPDATE", day))
}

// LockByID 事务里锁住一条有效记账, 没有返回 nil.
func (r *ManualBookRepository) LockByID(tx *gorm.DB, id uint) (*ManualBook, error) {
	return r.rawOne(tx.Raw("SELECT * FROM recon_manual_book WHERE id = ? AND active = 1 LIMIT 1 FOR UPDATE", id))
}

// ListDebts 这些记账的有效欠款, 按记账、ID 升序; database 为空用默认连接.
func (r *ManualBookRepository) ListDebts(database *gorm.DB, bookIDs []int) ([]*ManualBookDebt, error) {
	rows := make([]*ManualBookDebt, 0)
	if len(bookIDs) == 0 {
		return rows, nil
	}
	if database == nil {
		database = r.Db
	}
	err := database.Where("active = 1 AND book_id IN ?", bookIDs).Order("book_id ASC, id ASC").Find(&rows).Error
	return rows, err
}

// ListLogs [start, end] 内各天的修改记录, 按时间倒序, 最多 limit 条.
func (r *ManualBookRepository) ListLogs(start, end time.Time, limit int) ([]*ManualBookLog, error) {
	rows := make([]*ManualBookLog, 0)
	err := r.Db.Where("active = 1 AND book_date BETWEEN ? AND ?", start, end).
		Order("id DESC").Limit(limit).Find(&rows).Error
	return rows, err
}

// FindUpstreamUsers 有效的上游用户, 用来校验社区存在、取名称和当前的用户名 / 备注; database 为空用默认连接.
func (r *ManualBookRepository) FindUpstreamUsers(database *gorm.DB, ids []uint64) ([]UpstreamUserRow, error) {
	rows := make([]UpstreamUserRow, 0)
	if len(ids) == 0 {
		return rows, nil
	}
	if database == nil {
		database = r.Db
	}
	err := database.Raw("SELECT u.id, COALESCE(u.name, '') AS name, COALESCE(u.username, '') AS username, COALESCE(u.remark, '') AS remark,\n"+
		"  COALESCE((SELECT SUM(a.balance_amount) FROM account a WHERE a.user_id = u.id AND a.active = 1), 0) AS balance\n"+
		"FROM `user` u WHERE u.active = 1 AND u.id IN ?", ids).
		Scan(&rows).Error
	return rows, err
}

func (r *ManualBookRepository) findOne(query *gorm.DB) (*ManualBook, error) {
	rows := make([]*ManualBook, 0, 1)
	if err := query.Limit(1).Find(&rows).Error; err != nil {
		return nil, err
	}
	if len(rows) == 0 {
		return nil, nil
	}
	return rows[0], nil
}

func (r *ManualBookRepository) rawOne(query *gorm.DB) (*ManualBook, error) {
	rows := make([]*ManualBook, 0, 1)
	if err := query.Scan(&rows).Error; err != nil {
		return nil, err
	}
	if len(rows) == 0 {
		return nil, nil
	}
	return rows[0], nil
}
