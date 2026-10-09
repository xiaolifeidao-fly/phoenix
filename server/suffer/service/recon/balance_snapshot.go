package recon

import (
	"fmt"
	"log"
	"time"

	reconDTO "suffer/service/recon/dto"
	reconRepository "suffer/service/recon/repository"
)

// balanceSnapshotCatchUp 启动时前一天还没打快照, 只在零点后这段时间内补打; 再晚余额已经变了, 补打出来也不是那天的数.
const balanceSnapshotCatchUp = 2 * time.Hour

// StartBalanceSnapshotJob 每天 00:00 给活跃社区打前一天的账户余额快照. 多个实例都会跑, 快照按天 + 社区唯一, 先写入的为准.
func (s *ReconService) StartBalanceSnapshotJob() {
	go func() {
		now := time.Now()
		today := startOfDay(now)
		if now.Sub(today) <= balanceSnapshotCatchUp {
			s.runBalanceSnapshot(today.AddDate(0, 0, -1), true)
		}
		for {
			next := startOfDay(time.Now()).AddDate(0, 0, 1)
			time.Sleep(time.Until(next))
			s.runBalanceSnapshot(next.AddDate(0, 0, -1), false)
		}
	}()
}

// runBalanceSnapshot 打 day 的快照; onlyIfMissing 时这天已经有快照就跳过(启动补打用).
func (s *ReconService) runBalanceSnapshot(day time.Time, onlyIfMissing bool) {
	defer func() {
		if r := recover(); r != nil {
			log.Printf("[recon] 社区余额快照 %s 异常: %v", dateKey(day), r)
		}
	}()
	if onlyIfMissing {
		count, err := s.snapshots.CountByDate(day)
		if err != nil {
			log.Printf("[recon] 查询社区余额快照 %s 失败: %v", dateKey(day), err)
			return
		}
		if count > 0 {
			return
		}
	}
	count, err := s.TakeBalanceSnapshot(day)
	if err != nil {
		log.Printf("[recon] 社区余额快照 %s 失败: %v", dateKey(day), err)
		return
	}
	log.Printf("[recon] 社区余额快照 %s 完成, %d 个社区", dateKey(day), count)
}

// TakeBalanceSnapshot 把这些社区当前的账户余额记为 day 的快照, 已经有的不覆盖; 返回社区数.
func (s *ReconService) TakeBalanceSnapshot(day time.Time) (int, error) {
	userIDs, err := s.snapshots.SnapshotUserIDs()
	if err != nil {
		return 0, err
	}
	balances, err := s.snapshots.CurrentBalances(userIDs)
	if err != nil {
		return 0, err
	}
	now := time.Now()
	rows := make([]*reconRepository.UpstreamBalanceSnapshot, 0, len(balances))
	for _, balance := range balances {
		row := &reconRepository.UpstreamBalanceSnapshot{
			SnapshotDate: startOfDay(day), UserID: balance.UserID,
			Balance: formatAmount(balance.Balance), CapturedTime: now,
		}
		row.Active = 1
		row.CreatedBy, row.UpdatedBy = "system", "system"
		row.CreatedTime, row.UpdatedTime = now, now
		rows = append(rows, row)
	}
	if err := s.snapshots.InsertIgnore(rows); err != nil {
		return 0, fmt.Errorf("写入快照失败：%w", err)
	}
	return len(rows), nil
}

// balanceLookup 按记账日期取社区余额: 有快照用快照; 当天及以后还没到打快照的时候, 用当前余额并标为实时; 更早没快照的为空.
type balanceLookup struct {
	snapshots map[string]map[uint64]*reconRepository.UpstreamBalanceSnapshot
	current   map[uint64]float64
	today     string
}

func (s *ReconService) loadBalanceLookup(dates []time.Time, current map[uint64]float64) (*balanceLookup, error) {
	rows, err := s.snapshots.ListByDates(dates)
	if err != nil {
		return nil, err
	}
	lookup := &balanceLookup{
		snapshots: make(map[string]map[uint64]*reconRepository.UpstreamBalanceSnapshot, len(dates)),
		current:   current, today: dateKey(time.Now()),
	}
	for _, row := range rows {
		key := dateKey(row.SnapshotDate)
		if lookup.snapshots[key] == nil {
			lookup.snapshots[key] = make(map[uint64]*reconRepository.UpstreamBalanceSnapshot)
		}
		lookup.snapshots[key][row.UserID] = row
	}
	return lookup, nil
}

func (l *balanceLookup) fill(date string, debt *reconDTO.ManualBookDebtDTO) {
	if row, ok := l.snapshots[date][debt.UpstreamUserID]; ok {
		debt.UpstreamBalance = floatPtr(parseAmount(row.Balance))
		debt.UpstreamBalanceTime = row.CapturedTime.Format("2006-01-02 15:04:05")
		return
	}
	if date >= l.today {
		debt.UpstreamBalance = floatPtr(l.current[debt.UpstreamUserID])
		debt.UpstreamBalanceLive = true
	}
}

func startOfDay(t time.Time) time.Time {
	return time.Date(t.Year(), t.Month(), t.Day(), 0, 0, 0, 0, time.Local)
}
