package recon

import (
	"fmt"
	"time"

	reconRepository "suffer/service/recon/repository"
)

const dateLayout = "2006-01-02"

// dateKey 只比日期, 不受时分秒和时区影响.
func dateKey(t time.Time) string { return t.Format(dateLayout) }

// baselineAt 截至 day 的起点: 生效日期 <= day 的最近一条(records 已按生效日期升序), 不论是否已结清.
func baselineAt(records []*reconRepository.OpeningDebt, day time.Time) *reconRepository.OpeningDebt {
	var result *reconRepository.OpeningDebt
	key := dateKey(day)
	for _, record := range records {
		if dateKey(record.EffectiveDate) <= key {
			result = record
		}
	}
	return result
}

// accumulateWindow 起点之后到 day 的累计窗口 [起点生效日 + 1, day]; 生效日当天的流水算在初始欠款里.
// ok=false 表示窗口为空(day 就是生效日).
func accumulateWindow(baseline *reconRepository.OpeningDebt, day time.Time) (time.Time, time.Time, bool) {
	start := truncateDay(baseline.EffectiveDate).AddDate(0, 0, 1)
	end := truncateDay(day)
	return start, end, !end.Before(start)
}

func truncateDay(t time.Time) time.Time {
	return time.Date(t.Year(), t.Month(), t.Day(), 0, 0, 0, 0, time.Local)
}

// currentOf 当前未结清的那条; 时间线正常时最多一条且是最后一条.
func currentOf(records []*reconRepository.OpeningDebt) *reconRepository.OpeningDebt {
	for i := len(records) - 1; i >= 0; i-- {
		if records[i].SettleStatus == reconRepository.SettleStatusUnsettled {
			return records[i]
		}
	}
	return nil
}

// checkCreate 新录入: 生效日期必须晚于最后一条; 返回要被结清的那条(没有为 nil).
func checkCreate(records []*reconRepository.OpeningDebt, effective time.Time) (*reconRepository.OpeningDebt, error) {
	if len(records) > 0 {
		last := records[len(records)-1]
		if dateKey(effective) <= dateKey(last.EffectiveDate) {
			return nil, fmt.Errorf("生效日期需晚于上一条（%s）", dateKey(last.EffectiveDate))
		}
	}
	return currentOf(records), nil
}

// checkUpdate 只能改当前未结清的那条, 新生效日期要晚于上一条; 返回上一条(要同步它的结清日期, 没有为 nil).
func checkUpdate(records []*reconRepository.OpeningDebt, target *reconRepository.OpeningDebt, effective time.Time) (*reconRepository.OpeningDebt, error) {
	if target.SettleStatus != reconRepository.SettleStatusUnsettled {
		return nil, fmt.Errorf("已结清的记录不能修改")
	}
	previous := previousOf(records, target)
	if previous != nil && dateKey(effective) <= dateKey(previous.EffectiveDate) {
		return nil, fmt.Errorf("生效日期需晚于上一条（%s）", dateKey(previous.EffectiveDate))
	}
	return previous, nil
}

// checkRevoke 只能撤销当前未结清的那条; 返回要恢复成未结清的上一条(没有为 nil).
func checkRevoke(records []*reconRepository.OpeningDebt, target *reconRepository.OpeningDebt) (*reconRepository.OpeningDebt, error) {
	if target.SettleStatus != reconRepository.SettleStatusUnsettled {
		return nil, fmt.Errorf("已结清的记录不能撤销，只能撤销当前有效的那条")
	}
	return previousOf(records, target), nil
}

func previousOf(records []*reconRepository.OpeningDebt, target *reconRepository.OpeningDebt) *reconRepository.OpeningDebt {
	var previous *reconRepository.OpeningDebt
	for _, record := range records {
		if record.Id == target.Id {
			return previous
		}
		previous = record
	}
	return previous
}
