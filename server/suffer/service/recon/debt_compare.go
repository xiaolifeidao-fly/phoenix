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
	// debtCompareMinorRatio 差值比例(相对系统应收)不超过它算相差较小
	debtCompareMinorRatio = 0.01
	// upstreamSumBatch barry upstream-sums 单次最多 500 个窗口
	upstreamSumBatch = 500
)

// flowSum 一段日期内的充值 / 入账 / 代收手续费.
type flowSum struct {
	recharge, income, collectFee float64
}

// change 这段时间系统算出来的欠款变化 = 充值 − 入账 − 代收手续费.
func (f flowSum) change() float64 { return f.recharge - f.income - f.collectFee }

// debtCompareInput 一个社区在一个记账日核对需要的数据.
type debtCompareInput struct {
	userID    uint64
	name      string
	username  string
	remark    string
	isTrading bool

	// opening 初始欠款(没录时为 nil, 按 0 算); openingDate 它的欠款日期(旧数据可能为空)
	opening     *float64
	openingDate string
	// base 系统欠款的起点日期: 欠款日期; 没录初始欠款或没填欠款日期时为所选开始日前一天
	base string

	// prevDate 上一份欠款的日期: 这个社区上一份有记欠款的人工记账(晚于 base), 没有时为 base(初始欠款)
	prevDate   string
	prevManual *reconDTO.ManualBookDebtDTO
	manual     *reconDTO.ManualBookDebtDTO
	checkDate  string

	// day 当天窗口 [prevDate 次日, checkDate]; total 累计窗口 [base 次日, checkDate]
	day   flowSum
	total flowSum
}

type debtCommunity struct {
	userID    uint64
	name      string
	username  string
	remark    string
	isTrading bool
}

// DebtCompare 欠款核对: 所选区间内每一份人工记账, 按社区比人工和系统.
// 系统欠款(截至记账日) = 初始欠款 + 欠款日期次日到记账日的(充值 − 入账 − 代收手续费);
// 人工欠款 = 当天人工记账里的欠款. 明细里的充值 / 入账 / 手续费 / 增量只算当天(上一份次日 ~ 记账日).
// 日期 yyyy-MM-dd, 区间最长 93 天.
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

	books, err := s.manualBooksBetween(start, end)
	if err != nil {
		return nil, err
	}
	if len(books) == 0 {
		result.Notices = append(result.Notices, "所选区间内没有人工记账，没有可核对的数据；请先在人工记账里记录社区欠款")
		return result, nil
	}
	communities, err := s.debtCommunities(books)
	if err != nil {
		return nil, err
	}
	userIDs := make([]uint64, 0, len(communities))
	for _, community := range communities {
		userIDs = append(userIDs, community.userID)
	}
	openingRecords, err := s.repository.ListByUsers(nil, userIDs)
	if err != nil {
		return nil, err
	}
	openings := openingDebtByUser(openingRecords)

	// 每个社区系统欠款的起点; 最早的起点决定往前要取多少份人工记账(找上一份)和多少天的充值
	fallbackBase := start.AddDate(0, 0, -1)
	bases := make(map[uint64]time.Time, len(communities))
	earliest := fallbackBase
	missingOpening, missingDate := 0, 0
	for _, community := range communities {
		base := fallbackBase
		switch opening := openings[community.userID]; {
		case opening == nil:
			missingOpening++
		case opening.DebtDate == nil || opening.DebtDate.IsZero():
			missingDate++
		default:
			base = truncateDay(*opening.DebtDate)
		}
		bases[community.userID] = base
		if base.Before(earliest) {
			earliest = base
		}
	}
	if missingOpening > 0 {
		result.Notices = append(result.Notices, fmt.Sprintf("%d 个社区没有人工录入欠款，初始欠款按 0 算、当作 %s 的欠款；可在对账工作台「账户状态」里录入", missingOpening, shortKey(dateKey(fallbackBase))))
	}
	if missingDate > 0 {
		result.Notices = append(result.Notices, fmt.Sprintf("%d 个社区的人工录入欠款没填欠款日期，当作 %s 的欠款；请在「账户状态」里补上", missingDate, shortKey(dateKey(fallbackBase))))
	}
	allBooks := books
	if earliest.Before(start) {
		earlier, err := s.manualBooksBetween(earliest, start.AddDate(0, 0, -1))
		if err != nil {
			return nil, err
		}
		allBooks = append(earlier, books...)
	}

	// 每个社区每份记账一个输入; 当天窗口和累计窗口各查一次入账
	type checkDay struct {
		book   *reconDTO.ManualBookDTO
		inputs []*debtCompareInput
	}
	checks := make([]*checkDay, 0, len(books))
	pending := make(map[string]*flowSum, len(books)*len(communities)*2)
	windows := make([]barryDTO.ReconUpstreamSumDTO, 0, len(books)*len(communities)*2)
	addWindow := func(key string, userID uint64, from, to string, target *flowSum) {
		if from > to {
			return
		}
		pending[key] = target
		windows = append(windows, barryDTO.ReconUpstreamSumDTO{
			Key: key, UpstreamUserID: strconv.FormatUint(userID, 10), StartDate: from, EndDate: to,
		})
	}
	for _, book := range books {
		check := &checkDay{book: book}
		manual := debtsByUser(book)
		for _, community := range communities {
			base := dateKey(bases[community.userID])
			input := &debtCompareInput{
				userID: community.userID, name: community.name, username: community.username,
				remark: community.remark, isTrading: community.isTrading,
				base: base, prevDate: base, checkDate: book.BookDate,
			}
			if opening := openings[community.userID]; opening != nil {
				input.opening = floatPtr(parseAmount(opening.Amount))
				if opening.DebtDate != nil && !opening.DebtDate.IsZero() {
					input.openingDate = dateKey(*opening.DebtDate)
				}
			}
			if debt, ok := manual[community.userID]; ok {
				input.manual = &debt
			}
			input.prevDate, input.prevManual = previousManualDebt(allBooks, community.userID, base, book.BookDate)
			check.inputs = append(check.inputs, input)
			if book.BookDate < base {
				continue
			}
			key := strconv.FormatUint(community.userID, 10) + ":" + book.BookDate
			addWindow(key+":day", community.userID, nextDayKey(input.prevDate), book.BookDate, &input.day)
			addWindow(key+":total", community.userID, nextDayKey(base), book.BookDate, &input.total)
		}
		checks = append(checks, check)
	}

	// 充值: 按用户、按天一次查出, 再按窗口累加
	daily, err := s.repository.SumRechargeDaily(userIDs, earliest.AddDate(0, 0, 1), end.AddDate(0, 0, 1))
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
	sumRecharge := func(userID uint64, from, to string) float64 {
		total := 0.0
		for day, amount := range rechargeByUser[userID] {
			if day >= from && day <= to {
				total += amount
			}
		}
		return total
	}
	for _, check := range checks {
		for _, input := range check.inputs {
			if input.checkDate < input.base {
				continue
			}
			input.day.recharge = sumRecharge(input.userID, nextDayKey(input.prevDate), input.checkDate)
			input.total.recharge = sumRecharge(input.userID, nextDayKey(input.base), input.checkDate)
		}
	}
	for offset := 0; offset < len(windows); offset += upstreamSumBatch {
		sums, err := s.reconciliation.UpstreamSums(ctx, windows[offset:min(offset+upstreamSumBatch, len(windows))])
		if err != nil {
			return nil, fmt.Errorf("查询社区入账失败：%w", err)
		}
		for _, sum := range sums {
			if target, ok := pending[sum.Key]; ok {
				target.income, target.collectFee = sum.IncomeRmb, sum.CollectFeeRmb
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
		for _, input := range check.inputs {
			row := buildDebtCompareRow(input)
			if row.Diff != nil {
				addDebtTotals(&day.DebtCompareTotals, &row)
			}
			switch row.Status {
			case reconDTO.DebtCompareStatusDiff:
				day.DiffCount++
				day.IssueCount++
			case reconDTO.DebtCompareStatusNoManual, reconDTO.DebtCompareStatusBeforeStart:
				day.IssueCount++
			}
			day.Rows = append(day.Rows, row)
		}
		// 有问题的排前面: 有差异 > 缺数据 > 相差较小 > 一致
		sort.SliceStable(day.Rows, func(a, b int) bool {
			return debtStatusOrder(day.Rows[a].Status) < debtStatusOrder(day.Rows[b].Status)
		})
		if day.DiffCount > 0 {
			result.DiffDays++
		}
		result.Days = append(result.Days, day)
	}
	return result, nil
}

// manualBooksBetween [start, end] 内的人工记账, 按日期升序.
func (s *ReconService) manualBooksBetween(start, end time.Time) ([]*reconDTO.ManualBookDTO, error) {
	records, err := s.books.ListBetween(start, end)
	if err != nil {
		return nil, err
	}
	return s.toManualBookDTOs(nil, records)
}

// previousManualDebt 这个社区在 checkDate 之前、晚于 base 的最近一份人工记账欠款; 没有时返回 (base, nil), 即以初始欠款为上一份.
func previousManualDebt(books []*reconDTO.ManualBookDTO, userID uint64, base, checkDate string) (string, *reconDTO.ManualBookDebtDTO) {
	for i := len(books) - 1; i >= 0; i-- {
		date := books[i].BookDate
		if date >= checkDate {
			continue
		}
		if date <= base {
			break
		}
		for _, debt := range books[i].Debts {
			if debt.UpstreamUserID == userID {
				found := debt
				return date, &found
			}
		}
	}
	return base, nil
}

func addDebtTotals(totals *reconDTO.DebtCompareTotals, row *reconDTO.DebtCompareRowDTO) {
	totals.Recharge += row.Recharge
	totals.Income += row.Income
	totals.CollectFee += row.CollectFee
	totals.PrevManualDebt += row.PrevManualDebt
	totals.PrevSystemDebt += row.PrevSystemDebt
	totals.ManualDebtChange += *row.ManualDebtChange
	totals.DebtChange += row.DebtChange
	totals.ManualDebt += *row.ManualDebt
	totals.SystemDebt += row.SystemDebt
	totals.ManualReceivable += *row.ManualReceivable
	totals.SystemReceivable += row.SystemReceivable
	totals.Diff += *row.Diff
	totals.DayDiff += *row.DayDiff
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

// buildDebtCompareRow 算一个社区的系统欠款、人工欠款和两边的应收, 并给出哪里有问题.
// buildDebtCompareRow 算一个社区当天的人工 / 系统两套数, 并给出哪里有问题.
func buildDebtCompareRow(input *debtCompareInput) reconDTO.DebtCompareRowDTO {
	row := reconDTO.DebtCompareRowDTO{
		UserID: input.userID, Name: input.name, Username: input.username, Remark: input.remark, IsTrading: input.isTrading,
		OpeningDate: input.openingDate, PrevDate: input.prevDate, Issues: make([]string, 0),
	}
	if input.opening != nil {
		row.OpeningDebt = *input.opening
	} else {
		row.OpeningMissing = true
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
	if row.OpeningMissing {
		row.Issues = append(row.Issues, fmt.Sprintf("没有人工录入欠款，初始欠款按 0 算、当作 %s 的欠款", shortKey(input.base)))
	} else if row.OpeningDate == "" {
		row.Issues = append(row.Issues, fmt.Sprintf("人工录入欠款没填欠款日期，当作 %s 的欠款；请在账户状态里补上", shortKey(input.base)))
	}
	if input.checkDate < input.base {
		row.Status = reconDTO.DebtCompareStatusBeforeStart
		row.Issues = append(row.Issues, fmt.Sprintf("%s 早于初始欠款的欠款日期 %s，这天没法核对", shortKey(input.checkDate), shortKey(input.base)))
		return row
	}

	row.DayStart = nextDayKey(input.prevDate)
	row.Recharge, row.Income, row.CollectFee = input.day.recharge, input.day.income, input.day.collectFee
	row.DebtChange = input.day.change()
	row.SystemDebt = row.OpeningDebt + input.total.change()
	row.PrevSystemDebt = row.SystemDebt - row.DebtChange
	// 系统应收 = 当天充值(= 系统增量 + 入账 + 手续费)
	row.SystemReceivable = row.Recharge
	if input.prevManual != nil {
		row.PrevManualDebt = input.prevManual.AmountRmb
	} else {
		row.PrevManualDebt, row.PrevIsOpening = row.OpeningDebt, true
	}
	if input.manual == nil {
		row.Status = reconDTO.DebtCompareStatusNoManual
		row.Issues = append(row.Issues, fmt.Sprintf("%s 的人工记账里没有记这个社区的欠款", shortKey(input.checkDate)))
		return row
	}
	row.ManualDebtChange = floatPtr(*row.ManualDebt - row.PrevManualDebt)
	// 人工应收 = 人工增量 + 入账 + 手续费; 和系统应收的差 = 当天新增差值
	row.ManualReceivable = floatPtr(*row.ManualDebtChange + row.Income + row.CollectFee)
	row.Diff = floatPtr(*row.ManualDebt - row.SystemDebt)
	row.DayDiff = floatPtr(*row.ManualDebtChange - row.DebtChange)
	// 比例按截至当天的规模算(系统欠款 + 当天入账 + 手续费), 当天充值可能为 0
	if scale := row.SystemDebt + row.Income + row.CollectFee; scale != 0 {
		row.DiffRatio = floatPtr(*row.Diff / math.Abs(scale))
	}
	switch {
	case math.Abs(*row.Diff) <= debtCompareTolerance:
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

// debtDiffHints 先说累计差多少, 再看当天有没有新增差异: 有就拿当天的流水去对, 没有就说明差异是之前就有的.
func debtDiffHints(row *reconDTO.DebtCompareRowDTO, input *debtCompareInput) []string {
	rmb := func(value float64) string { return amountText(value, reconRepository.CurrencyRMB) }
	direction := "多"
	if *row.Diff < 0 {
		direction = "少"
	}
	hints := []string{fmt.Sprintf("截至 %s 人工欠款比系统欠款%s %s（人工 %s，系统 %s）",
		shortKey(input.checkDate), direction, rmb(math.Abs(*row.Diff)), rmb(*row.ManualDebt), rmb(row.SystemDebt))}

	dayDiff := *row.DayDiff
	if math.Abs(dayDiff) <= debtCompareTolerance {
		if row.PrevIsOpening {
			hints = append(hints, "当天没有新增差异；差异来自初始欠款，核对录入的金额和欠款日期")
		} else {
			hints = append(hints, fmt.Sprintf("当天没有新增差异，%s 之前就已经差了；往前看是哪天开始出现的", shortKey(input.prevDate)))
		}
	} else {
		hints = append(hints, fmt.Sprintf("%s 新增差异 %s：人工增量 %s，系统增量 %s（充值 %s − 入账 %s − 手续费 %s）",
			dayRangeText(row.DayStart, input.checkDate), rmb(dayDiff), rmb(*row.ManualDebtChange), rmb(row.DebtChange),
			rmb(row.Recharge), rmb(row.Income), rmb(row.CollectFee)))
		matches := func(value float64) bool { return value != 0 && math.Abs(dayDiff-value) <= debtCompareTolerance }
		switch {
		case matches(row.CollectFee):
			hints = append(hints, "新增差异正好等于当天代收手续费：人工欠款可能只按到账金额冲减，没扣代收手续费")
		case matches(-row.CollectFee):
			hints = append(hints, "新增差异正好等于负的当天代收手续费：人工欠款可能多扣了一次手续费")
		case matches(row.Income) || matches(row.Income+row.CollectFee):
			hints = append(hints, "新增差异正好等于当天入账：人工欠款可能没扣这笔入账，或入账在出入账里重复记了")
		case matches(-row.Income) || matches(-row.Income-row.CollectFee):
			hints = append(hints, "新增差异正好等于负的当天入账：可能有入账人工已扣、但出入账里漏记，或记错了日期")
		case matches(-row.Recharge):
			hints = append(hints, "新增差异正好等于负的当天充值：人工欠款可能没把当天的充值加进去")
		case matches(row.Recharge):
			hints = append(hints, "新增差异正好等于当天充值：人工欠款可能把充值加了两次")
		default:
			hints = append(hints, "核对当天的充值、社区入账有没有漏记或记错日期，以及两天的人工欠款有没有记错")
		}
	}
	if row.ManualCurrency == reconRepository.CurrencyUSDT {
		hints = append(hints, "这个社区当天的欠款按 U 记，按当天汇率折算 RMB，汇率变化也会产生差值")
	}
	return hints
}

func debtStatusOrder(status string) int {
	switch status {
	case reconDTO.DebtCompareStatusDiff:
		return 0
	case reconDTO.DebtCompareStatusNoManual, reconDTO.DebtCompareStatusBeforeStart:
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

// dayRangeText 当天窗口: 只有一天时写 MM-DD, 跨几天时写 MM-DD ~ MM-DD.
func dayRangeText(from, to string) string {
	if from == to {
		return shortKey(to)
	}
	return shortKey(from) + " ~ " + shortKey(to)
}
