package recon

import (
	"time"

	reconRepository "suffer/service/recon/repository"
)

const dateLayout = "2006-01-02"

// dateKey 只比日期, 不受时分秒和时区影响.
func dateKey(t time.Time) string { return t.Format(dateLayout) }

func truncateDay(t time.Time) time.Time {
	return time.Date(t.Year(), t.Month(), t.Day(), 0, 0, 0, 0, time.Local)
}

// openingDebtByUser 每个用户的人工录入欠款(records 已按用户、id 升序); 万一有多条以最后一条为准.
func openingDebtByUser(records []*reconRepository.OpeningDebt) map[uint64]*reconRepository.OpeningDebt {
	result := make(map[uint64]*reconRepository.OpeningDebt, len(records))
	for _, record := range records {
		result[record.UserID] = record
	}
	return result
}
