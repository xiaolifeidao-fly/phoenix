package recon

import (
	"context"
	"fmt"
	"math"
	"sort"
	"strconv"
	"time"

	barryDTO "suffer/service/barry/dto"
	reconDTO "suffer/service/recon/dto"
	reconRepository "suffer/service/recon/repository"
)

const (
	// debtCompareTolerance 差值绝对值不超过它算一致(RMB)
	debtCompareTolerance = 0.01
	// debtCompareMinorRatio 差值比例(相对应收)不超过它算相差较小
	debtCompareMinorRatio = 0.01
	// upstreamSumBatch barry upstream-sums 单次最多 500 个窗口
	upstreamSumBatch = 500
)

// debtCompareInput 一个社区在一个窗口 (previousDate, checkDate] 内核对需要的数据.
// hasPrevious = false 表示往前找不到上一份记账; previous / manual 为 nil 表示上一份 / 当天没记这个社区.
type debtCompareInput struct {
	userID       uint64
	name         string
	username     string
	remark       string
	isTrading    bool
	recharge     float64
	income       float64
	collectFee   float64
	hasPrevious  bool
	previous     *reconDTO.ManualBookDebtDTO
	manual       *reconDTO.ManualBookDebtDTO
	previousDate string
	checkDate    string
}

type debtCommunity struct {
	userID    uint64
	name      string
	username  string
	remark    string
	isTrading bool
}

// DebtCompare 欠款核对: 区间内每一份人工记账和它的上一份之间, 按社区比
// 应收(这段时间的充值) 和 人工对比值(这段时间的入账 + 人工欠款增量). 日期 yyyy-MM-dd, 区间最长 93 天.
func (s *ReconService) DebtCompare(ctx context.Context, startDate, endDate string) (*reconDTO.DebtCompareDTO, error) {
	start, end, err := parseRange(startDate, endDate)
	if err != nil {
		return nil, err
	}
	result := &reconDTO.DebtCompareDTO{
		StartDate: dateKey(start), EndDate: dateKey(end),
		Days: make([]reconDTO.DebtCompareDayDTO, 0), Notices: make([]string, 0),
		Tolerance: debtCompareTolerance, MinorRatio: debtCompareMinorRatio,
	}

	// 往前多取 31 天, 区间内第一份记账也能找到它的上一份
	records, err := s.books.ListBetween(start.AddDate(0, 0, -manualBookLookbackDays), end)
	if err != nil {
		return nil, err
	}
	books, err := s.toManualBookDTOs(nil, records)
	if err != nil {
		return nil, err
	}
	first := len(books)
	for i, book := range books {
		if book.BookDate >= dateKey(start) {
			first = i
			break
		}
	}
	if first == len(books) {
		result.Notices = append(result.Notices, "所选区间内没有人工记账，没有可核对的数据；请先在人工记账里记录社区欠款")
		return result, nil
	}

	communities, err := s.debtCommunities(books[first:])
	if err != nil {
		return nil, err
	}
	userIDs := make([]uint64, 0, len(communities))
	for _, community := range communities {
		userIDs = append(userIDs, community.userID)
	}

	type checkWindow struct {
		book     *reconDTO.ManualBookDTO
		previous *reconDTO.ManualBookDTO
		from, to time.Time
		inputs   []*debtCompareInput
	}
	checks := make([]*checkWindow, 0, len(books)-first)
	pending := make(map[string]*debtCompareInput, (len(books)-first)*len(communities))
	windows := make([]barryDTO.ReconUpstreamSumDTO, 0, len(pending))
	var earliest time.Time
	for i := first; i < len(books); i++ {
		check := &checkWindow{book: books[i]}
		check.to, _ = time.ParseInLocation(dateLayout, books[i].BookDate, time.Local)
		if i > 0 {
			check.previous = books[i-1]
			check.from, _ = time.ParseInLocation(dateLayout, books[i-1].BookDate, time.Local)
			check.from = check.from.AddDate(0, 0, 1)
			if earliest.IsZero() || check.from.Before(earliest) {
				earliest = check.from
			}
		}
		manual := debtsByUser(books[i])
		previous := debtsByUser(check.previous)
		for _, community := range communities {
			input := &debtCompareInput{
				userID: community.userID, name: community.name, username: community.username,
				remark: community.remark, isTrading: community.isTrading,
				hasPrevious: check.previous != nil, checkDate: books[i].BookDate,
			}
			if check.previous != nil {
				input.previousDate = check.previous.BookDate
			}
			if debt, ok := manual[community.userID]; ok {
				input.manual = &debt
			}
			if debt, ok := previous[community.userID]; ok {
				input.previous = &debt
			}
			check.inputs = append(check.inputs, input)
			if check.previous == nil {
				continue
			}
			key := strconv.FormatUint(community.userID, 10) + ":" + books[i].BookDate
			pending[key] = input
			windows = append(windows, barryDTO.ReconUpstreamSumDTO{
				Key: key, UpstreamUserID: strconv.FormatUint(community.userID, 10),
				StartDate: dateKey(check.from), EndDate: dateKey(check.to),
			})
		}
		checks = append(checks, check)
	}
	if first == 0 {
		result.Notices = append(result.Notices, fmt.Sprintf("%s 往前 %d 天内没有人工记账，这一天算不出欠款增量", shortKey(books[first].BookDate), manualBookLookbackDays))
	}

	// 充值: 按用户、按天一次查出, 再按窗口累加
	if !earliest.IsZero() {
		daily, err := s.repository.SumRechargeDaily(userIDs, earliest, end.AddDate(0, 0, 1))
		if err != nil {
			return nil, err
		}
		rechargeByUser := make(map[uint64]map[string]float64, len(communities))
		for _, row := range daily {
			if rechargeByUser[row.UserID] == nil {
				rechargeByUser[row.UserID] = make(map[string]float64)
			}
			rechargeByUser[row.UserID][row.Day] += row.Amount
		}
		for _, check := range checks {
			if check.previous == nil {
				continue
			}
			for _, input := range check.inputs {
				for current := check.from; !current.After(check.to); current = current.AddDate(0, 0, 1) {
					input.recharge += rechargeByUser[input.userID][dateKey(current)]
				}
			}
		}
	}
	for offset := 0; offset < len(windows); offset += upstreamSumBatch {
		sums, err := s.reconciliation.UpstreamSums(ctx, windows[offset:min(offset+upstreamSumBatch, len(windows))])
		if err != nil {
			return nil, fmt.Errorf("查询社区入账失败：%w", err)
		}
		for _, sum := range sums {
			if input, ok := pending[sum.Key]; ok {
				input.income, input.collectFee = sum.IncomeRmb, sum.CollectFeeRmb
			}
		}
	}

	// 最新的一天在前
	for i := len(checks) - 1; i >= 0; i-- {
		check := checks[i]
		day := reconDTO.DebtCompareDayDTO{
			Date: check.book.BookDate, BookID: check.book.ID,
			Rows: make([]reconDTO.DebtCompareRowDTO, 0, len(check.inputs)),
		}
		if check.previous != nil {
			day.PreviousDate = check.previous.BookDate
			day.Days = int(check.to.Sub(check.from).Hours()/24) + 1
		}
		for _, input := range check.inputs {
			row := buildDebtCompareRow(input)
			if row.ManualTotal != nil {
				day.Receivable += row.Receivable
				day.ManualTotal += *row.ManualTotal
			}
			switch row.Status {
			case reconDTO.DebtCompareStatusDiff:
				day.DiffCount++
				day.IssueCount++
			case reconDTO.DebtCompareStatusNoBaseline, reconDTO.DebtCompareStatusNoManual:
				day.IssueCount++
			}
			day.Rows = append(day.Rows, row)
		}
		day.Diff = day.ManualTotal - day.Receivable
		// 有问题的排前面: 有差异 > 缺数据 > 相差较小 > 一致
		sort.SliceStable(day.Rows, func(a, b int) bool {
			return debtStatusOrder(day.Rows[a].Status) < debtStatusOrder(day.Rows[b].Status)
		})
		if day.DiffCount > 0 {
			result.DiffDays++
		}
		result.Receivable += day.Receivable
		result.ManualTotal += day.ManualTotal
		result.Days = append(result.Days, day)
	}
	result.Diff = result.ManualTotal - result.Receivable
	return result, nil
}

func debtsByUser(book *reconDTO.ManualBookDTO) map[uint64]reconDTO.ManualBookDebtDTO {
	result := make(map[uint64]reconDTO.ManualBookDebtDTO)
	if book == nil {
		return result
	}
	for _, debt := range book.Debts {
		result[debt.UpstreamUserID] = debt
	}
	return result
}

// debtCommunities 要核对的社区 = 活跃上游用户 ∪ 区间内人工记账里记过的社区.
func (s *ReconService) debtCommunities(books []*reconDTO.ManualBookDTO) ([]debtCommunity, error) {
	trading, err := s.repository.ListTradingUserBalances()
	if err != nil {
		return nil, err
	}
	result := make([]debtCommunity, 0, len(trading))
	seen := make(map[uint64]bool, len(trading))
	for _, user := range trading {
		result = append(result, debtCommunity{userID: user.UserID, name: user.Name, username: user.Username, remark: user.Remark, isTrading: true})
		seen[user.UserID] = true
	}
	missing := make([]uint64, 0)
	snapshotNames := make(map[uint64]string)
	for _, book := range books {
		for _, debt := range book.Debts {
			if !seen[debt.UpstreamUserID] {
				seen[debt.UpstreamUserID] = true
				missing = append(missing, debt.UpstreamUserID)
				snapshotNames[debt.UpstreamUserID] = debt.UpstreamUserName
			}
		}
	}
	if len(missing) == 0 {
		return result, nil
	}
	sort.Slice(missing, func(i, j int) bool { return missing[i] < missing[j] })
	users, err := s.books.FindUpstreamUsers(nil, missing)
	if err != nil {
		return nil, err
	}
	found := make(map[uint64]reconRepository.UpstreamUserRow, len(users))
	for _, user := range users {
		found[user.ID] = user
	}
	for _, userID := range missing {
		user := found[userID]
		result = append(result, debtCommunity{
			userID: userID, name: firstNonEmpty(user.Name, snapshotNames[userID]), username: user.Username, remark: user.Remark,
		})
	}
	return result, nil
}

// buildDebtCompareRow 算一个社区的应收、人工对比值和差值, 并给出哪里有问题.
func buildDebtCompareRow(input *debtCompareInput) reconDTO.DebtCompareRowDTO {
	row := reconDTO.DebtCompareRowDTO{
		UserID: input.userID, Name: input.name, Username: input.username, Remark: input.remark, IsTrading: input.isTrading,
		Receivable: input.recharge, Income: input.income, CollectFee: input.collectFee,
		IncomeTotal: input.income + input.collectFee, Issues: make([]string, 0),
	}
	if input.manual != nil {
		row.Name = firstNonEmpty(row.Name, input.manual.UpstreamUserName)
		row.ManualCurrency = input.manual.Currency
		row.ManualAmount = floatPtr(input.manual.Amount)
		row.ManualDebt = floatPtr(input.manual.AmountRmb)
	}
	if !input.isTrading {
		row.Issues = append(row.Issues, "不是活跃用户，账户状态里看不到它；需要的话在用户管理里设为活跃")
	}
	if !input.hasPrevious {
		row.Status = reconDTO.DebtCompareStatusNoBaseline
		row.Issues = append(row.Issues, fmt.Sprintf("%s 往前 %d 天内没有人工记账，算不出欠款增量", shortKey(input.checkDate), manualBookLookbackDays))
		return row
	}
	if input.manual == nil {
		row.Status = reconDTO.DebtCompareStatusNoManual
		row.Issues = append(row.Issues, fmt.Sprintf("%s 的人工记账里没有记这个社区的欠款", shortKey(input.checkDate)))
		return row
	}
	previous := 0.0
	if input.previous != nil {
		previous = input.previous.AmountRmb
	} else {
		row.PreviousMissing = true
		row.Issues = append(row.Issues, fmt.Sprintf("上一份（%s）没有记这个社区，欠款按 0 算", shortKey(input.previousDate)))
	}
	row.PreviousDebt = floatPtr(previous)
	row.DebtChange = floatPtr(*row.ManualDebt - previous)
	row.ManualTotal = floatPtr(row.IncomeTotal + *row.DebtChange)

	diff := *row.ManualTotal - row.Receivable
	row.Diff = floatPtr(diff)
	if row.Receivable != 0 {
		row.DiffRatio = floatPtr(diff / math.Abs(row.Receivable))
	}
	switch {
	case math.Abs(diff) <= debtCompareTolerance:
		row.Status = reconDTO.DebtCompareStatusOK
	case row.DiffRatio != nil && math.Abs(*row.DiffRatio) <= debtCompareMinorRatio:
		row.Status = reconDTO.DebtCompareStatusMinor
		row.Issues = append(row.Issues, debtDiffHints(&row, input)...)
	default:
		row.Status = reconDTO.DebtCompareStatusDiff
		row.Issues = append(row.Issues, debtDiffHints(&row, input)...)
	}
	return row
}

// debtDiffHints 差值的可能来源: 能对上某一项金额的直接点出来, 否则给出核对方向.
func debtDiffHints(row *reconDTO.DebtCompareRowDTO, input *debtCompareInput) []string {
	diff := *row.Diff
	matches := func(value float64) bool { return value != 0 && math.Abs(diff-value) <= debtCompareTolerance }
	window := fmt.Sprintf("%s ~ %s", shortKey(nextDayKey(input.previousDate)), shortKey(input.checkDate))
	direction := "入账 + 欠款增量比充值多"
	if diff < 0 {
		direction = "入账 + 欠款增量比充值少"
	}
	hints := []string{fmt.Sprintf("%s %s RMB（充值 %s，入账 %s，欠款增量 %s）", direction,
		amountText(math.Abs(diff), reconRepository.CurrencyRMB), amountText(row.Receivable, reconRepository.CurrencyRMB),
		amountText(row.IncomeTotal, reconRepository.CurrencyRMB), amountText(*row.DebtChange, reconRepository.CurrencyRMB))}
	switch {
	case matches(row.CollectFee):
		hints = append(hints, "差值正好等于代收手续费：人工欠款可能没把手续费算进入账")
	case matches(-row.CollectFee):
		hints = append(hints, "差值正好等于负的代收手续费：人工欠款可能多扣了一次手续费")
	case matches(row.Income) || matches(row.IncomeTotal):
		hints = append(hints, "差值正好等于入账：人工欠款可能没扣这笔入账（欠款多了），或入账在出入账里重复记了")
	case matches(-row.Income) || matches(-row.IncomeTotal):
		hints = append(hints, "差值正好等于负的入账：可能有入账人工已扣、但出入账里漏记")
	case matches(-row.Receivable):
		hints = append(hints, "差值正好等于负的充值：人工欠款可能没把这段时间的充值加进去")
	case matches(row.Receivable):
		hints = append(hints, "差值正好等于充值：人工欠款可能把充值加了两次")
	case row.PreviousMissing:
		hints = append(hints, "上一份没记这个社区，欠款增量按当天全额算；如果上一份时其实已有欠款，差值就来自这里")
	case row.ManualCurrency == reconRepository.CurrencyUSDT || (input.previous != nil && input.previous.Currency == reconRepository.CurrencyUSDT):
		hints = append(hints, "这个社区的欠款按 U 记，两天汇率不同也会产生差值")
	default:
		hints = append(hints, fmt.Sprintf("核对 %s 的充值、社区入账是否有漏记或记错日期，以及两天的人工欠款是否记错", window))
	}
	return hints
}

func debtStatusOrder(status string) int {
	switch status {
	case reconDTO.DebtCompareStatusDiff:
		return 0
	case reconDTO.DebtCompareStatusNoBaseline, reconDTO.DebtCompareStatusNoManual:
		return 1
	case reconDTO.DebtCompareStatusMinor:
		return 2
	default:
		return 3
	}
}

// shortKey yyyy-MM-dd → MM-dd
func shortKey(key string) string {
	if len(key) == len(dateLayout) {
		return key[5:]
	}
	return key
}

func nextDayKey(key string) string {
	day, err := time.ParseInLocation(dateLayout, key, time.Local)
	if err != nil {
		return key
	}
	return dateKey(day.AddDate(0, 0, 1))
}
