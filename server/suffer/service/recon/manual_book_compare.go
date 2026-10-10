package recon

import (
	"fmt"
	"math"
	"sort"
	"time"

	barryDTO "suffer/service/barry/dto"
	reconDTO "suffer/service/recon/dto"
	reconRepository "suffer/service/recon/repository"
)

const (
	// manualBookLookbackDays 往开始日之前找上一份记账(算社区欠款增量)的天数
	manualBookLookbackDays = 31
	// manualBookTolerance 差异绝对值不超过它算一致(RMB), 吸收 U 折算的舍入
	manualBookTolerance = 0.01
)

type ledgerDay struct {
	in         float64
	out        float64
	categories []barryDTO.ReconLedgerDailyCategoryDTO
}

func toLedgerDays(rows []barryDTO.ReconLedgerDailyDTO) map[string]ledgerDay {
	result := make(map[string]ledgerDay, len(rows))
	for _, row := range rows {
		current := result[row.Date]
		current.in += row.InRmb
		current.out += row.OutRmb
		current.categories = append(current.categories, row.CategoryList...)
		result[row.Date] = current
	}
	return result
}

// ledgerCategoryOrder 出入账类目的展示顺序, 和 barry ReconLedgerCategory 枚举一致.
var ledgerCategoryOrder = map[string]int{
	"COMMUNITY_IN": 0, "OTHER_IN": 1, "MANUAL_SETTLE": 2, "PAYOUT_FEE": 3, "COLLECT_FEE": 4, "SERVER_OUT": 5, "OTHER_OUT": 6,
}

// addLedgerDay 把一天的出入账累加到窗口里, 类目合并.
func addLedgerDay(item *reconDTO.ManualBookCompareItemDTO, day ledgerDay) {
	item.LedgerIn += day.in
	item.LedgerOut += day.out
	for _, category := range day.categories {
		found := false
		for i := range item.LedgerCategories {
			if item.LedgerCategories[i].Category == category.Category {
				item.LedgerCategories[i].AmountRmb += category.AmountRmb
				item.LedgerCategories[i].Count += category.Count
				found = true
				break
			}
		}
		if !found {
			item.LedgerCategories = append(item.LedgerCategories, reconDTO.ManualBookLedgerCategoryDTO{
				Category: category.Category, CategoryName: category.CategoryName, RecordType: category.RecordType,
				Count: category.Count, AmountRmb: category.AmountRmb,
			})
		}
	}
	sort.SliceStable(item.LedgerCategories, func(a, b int) bool {
		return categoryRank(item.LedgerCategories[a].Category) < categoryRank(item.LedgerCategories[b].Category)
	})
}

func categoryRank(code string) int {
	if rank, ok := ledgerCategoryOrder[code]; ok {
		return rank
	}
	return len(ledgerCategoryOrder)
}

// balanceAnchor 余额对比的起点: 上一份人工记账, 或初始余额.
type balanceAnchor struct {
	date       string
	isOpening  bool
	currency   string
	balance    float64
	rate       *float64
	balanceRmb float64
}

func bookAnchor(book *reconDTO.ManualBookDTO) balanceAnchor {
	return balanceAnchor{date: book.BookDate, currency: book.Currency, balance: book.Balance, rate: book.ExchangeRate, balanceRmb: book.BalanceRmb}
}

func openingAnchor(opening *reconDTO.OpeningBalanceDTO) balanceAnchor {
	return balanceAnchor{
		date: opening.BalanceDate, isOpening: true, currency: opening.Currency, balance: opening.Balance,
		rate: opening.ExchangeRate, balanceRmb: opening.BalanceRmb,
	}
}

// fxEffect 两边都按 U 记且汇率不同时, 汇率变化带来的余额变化 = 起点 U 余额 × (当天汇率 − 起点汇率).
func fxEffect(from balanceAnchor, book *reconDTO.ManualBookDTO) *float64 {
	if from.currency != reconRepository.CurrencyUSDT || book.Currency != reconRepository.CurrencyUSDT ||
		from.rate == nil || book.ExchangeRate == nil || *from.rate == *book.ExchangeRate {
		return nil
	}
	return floatPtr(from.balance * (*book.ExchangeRate - *from.rate))
}

// manualBookComparer 以初始余额为基准的人工 / 系统余额对照.
// 系统应有余额(截至 D) = 初始余额 + 初始余额日期次日到 D 的(入账 − 出账), 不拿人工记的余额当起点;
// 上一份人工记账只用来算人工自己的当天利润和当天新增差值.
type manualBookComparer struct {
	books   []reconDTO.ManualBookDTO
	byDate  map[string]int
	opening *reconDTO.OpeningBalanceDTO
	ledger  map[string]ledgerDay
	// since 初始余额日期次日到某天(含)的累计出入账
	sinceIn, sinceOut map[string]float64
}

func newManualBookComparer(books []reconDTO.ManualBookDTO, opening *reconDTO.OpeningBalanceDTO, ledger map[string]ledgerDay, end time.Time) *manualBookComparer {
	c := &manualBookComparer{
		books: books, byDate: make(map[string]int, len(books)), opening: opening, ledger: ledger,
		sinceIn: map[string]float64{}, sinceOut: map[string]float64{},
	}
	for i := range books {
		c.byDate[books[i].BookDate] = i
	}
	if opening == nil {
		return c
	}
	from, err := time.ParseInLocation(dateLayout, opening.BalanceDate, time.Local)
	if err != nil {
		return c
	}
	var in, out float64
	c.sinceIn[opening.BalanceDate], c.sinceOut[opening.BalanceDate] = 0, 0
	for current := from.AddDate(0, 0, 1); !current.After(end); current = current.AddDate(0, 0, 1) {
		key := dateKey(current)
		in += ledger[key].in
		out += ledger[key].out
		c.sinceIn[key], c.sinceOut[key] = in, out
	}
	return c
}

// systemBalance 截至 key 的系统应有余额; 没有初始余额或早于初始余额日期时为 nil.
func (c *manualBookComparer) systemBalance(key string) *float64 {
	if c.opening == nil || key < c.opening.BalanceDate {
		return nil
	}
	return floatPtr(c.opening.BalanceRmb + c.sinceIn[key] - c.sinceOut[key])
}

// anchorBefore key 之前(不含)最近的起点: 初始余额日期之后(含)最近一份人工记账, 没有就是初始余额.
func (c *manualBookComparer) anchorBefore(key string) balanceAnchor {
	for i := len(c.books) - 1; i >= 0; i-- {
		date := c.books[i].BookDate
		if date < key && date >= c.opening.BalanceDate {
			return bookAnchor(&c.books[i])
		}
	}
	return openingAnchor(c.opening)
}

// debtBaseline key 之前最近一份人工记账, 只用来算社区欠款的增量(欠款不参与余额对比).
func (c *manualBookComparer) debtBaseline(key string) *reconDTO.ManualBookDTO {
	for i := len(c.books) - 1; i >= 0; i-- {
		if c.books[i].BookDate < key {
			return &c.books[i]
		}
	}
	return nil
}

func buildManualBookCompare(books []reconDTO.ManualBookDTO, opening *reconDTO.OpeningBalanceDTO, ledger map[string]ledgerDay, start, end time.Time) reconDTO.ManualBookCompareDTO {
	startKey, endKey := dateKey(start), dateKey(end)
	result := reconDTO.ManualBookCompareDTO{
		StartDate: startKey, EndDate: endKey, Tolerance: manualBookTolerance, OpeningBalance: opening,
		Days: make([]reconDTO.ManualBookCompareItemDTO, 0), Books: make([]reconDTO.ManualBookDTO, 0),
	}
	c := newManualBookComparer(books, opening, ledger, end)
	lastInRange := -1
	for i := range books {
		if books[i].BookDate >= startKey && books[i].BookDate <= endKey {
			result.Books = append(result.Books, books[i])
			lastInRange = i
		}
	}

	for current := truncateDay(start); !current.After(end); current = current.AddDate(0, 0, 1) {
		item := c.day(dateKey(current))
		if item.Status == reconDTO.CompareStatusDiff {
			result.DiffDays++
		}
		result.Days = append(result.Days, item)
	}
	for i := range result.Days {
		if result.Days[i].Status == reconDTO.CompareStatusDiff {
			result.Days[i].Issues = manualBookDiffHints(&result.Days[i], result.Days[:i], result.Days[i+1:])
		}
	}

	switch {
	case opening == nil:
		result.Total = reconDTO.ManualBookCompareItemDTO{Date: endKey, Status: reconDTO.CompareStatusNoBaseline}
	case lastInRange < 0 || books[lastInRange].BookDate < opening.BalanceDate:
		// 区间内没有可对比的记账: 只给出截至结束日的系统应有余额
		result.Total = reconDTO.ManualBookCompareItemDTO{Date: endKey, Status: reconDTO.CompareStatusMissing, SystemBalanceRmb: c.systemBalance(endKey)}
	default:
		// 起点 = 开始日之前最近一份(初始余额日期之后), 没有就是初始余额; 当天新增差值即区间新增
		anchor := openingAnchor(opening)
		if startKey > nextDayKey(opening.BalanceDate) {
			anchor = c.anchorBefore(startKey)
		}
		result.Total = c.compare(&books[lastInRange], anchor)
		if result.Total.Status == reconDTO.CompareStatusDiff {
			result.Total.Issues = manualBookDiffHints(&result.Total, nil, nil)
		}
	}
	return result
}

func (c *manualBookComparer) day(key string) reconDTO.ManualBookCompareItemDTO {
	index, ok := c.byDate[key]
	switch {
	case c.opening == nil:
		item := singleDayItem(key, c.ledger, reconDTO.CompareStatusMissing)
		if ok {
			item.Status = reconDTO.CompareStatusNoBaseline
			fillBook(&item, &c.books[index], c.debtBaseline(key))
		}
		return item
	case key < c.opening.BalanceDate:
		item := singleDayItem(key, c.ledger, reconDTO.CompareStatusBeforeStart)
		if ok {
			fillBook(&item, &c.books[index], c.debtBaseline(key))
		}
		return item
	case !ok:
		item := singleDayItem(key, c.ledger, reconDTO.CompareStatusMissing)
		item.SystemBalanceRmb = c.systemBalance(key)
		return item
	default:
		return c.compare(&c.books[index], c.anchorBefore(key))
	}
}

// compare 截至 book 那天: 差值 = 人工余额 − 系统应有余额(以初始余额为基准的累计差);
// 当天(from, book] 的人工利润 = 当天余额 − 上一份余额, 系统利润 = 入账 − 出账, 两者之差是当天新增差值.
func (c *manualBookComparer) compare(book *reconDTO.ManualBookDTO, from balanceAnchor) reconDTO.ManualBookCompareItemDTO {
	item := reconDTO.ManualBookCompareItemDTO{
		Date: book.BookDate, BaselineDate: from.date, BaselineIsOpening: from.isOpening,
		LedgerCategories: make([]reconDTO.ManualBookLedgerCategoryDTO, 0),
	}
	fromDay, _ := time.ParseInLocation(dateLayout, from.date, time.Local)
	toDay, _ := time.ParseInLocation(dateLayout, book.BookDate, time.Local)
	for current := fromDay.AddDate(0, 0, 1); !current.After(toDay); current = current.AddDate(0, 0, 1) {
		addLedgerDay(&item, c.ledger[dateKey(current)])
		item.GapDays++
	}
	item.LedgerProfit = item.LedgerIn - item.LedgerOut
	fillBook(&item, book, c.debtBaseline(book.BookDate))

	item.OpeningDate = c.opening.BalanceDate
	item.OpeningBalanceRmb = floatPtr(c.opening.BalanceRmb)
	item.SinceIn, item.SinceOut = c.sinceIn[book.BookDate], c.sinceOut[book.BookDate]
	system := *c.systemBalance(book.BookDate)
	item.SystemBalanceRmb = floatPtr(system)
	item.BaselineBalance = floatPtr(from.balanceRmb)
	item.BaselineSystemBalance = c.systemBalance(from.date)
	if from.currency == book.Currency {
		item.BalanceChange = floatPtr(book.Balance - from.balance)
	}
	item.FxEffect = fxEffect(openingAnchor(c.opening), book)
	item.DayFxEffect = fxEffect(from, book)

	profit := book.BalanceRmb - from.balanceRmb
	diff := book.BalanceRmb - system
	item.ManualProfit, item.Diff = floatPtr(profit), floatPtr(diff)
	item.DayDiff = floatPtr(profit - item.LedgerProfit)
	if system != 0 {
		item.DiffRatio = floatPtr(diff / math.Abs(system))
	}
	item.Status = reconDTO.CompareStatusOK
	if math.Abs(diff) > manualBookTolerance {
		item.Status = reconDTO.CompareStatusDiff
	}
	return item
}

func singleDayItem(key string, ledger map[string]ledgerDay, status string) reconDTO.ManualBookCompareItemDTO {
	item := reconDTO.ManualBookCompareItemDTO{
		Date: key, Status: status, GapDays: 1, LedgerCategories: make([]reconDTO.ManualBookLedgerCategoryDTO, 0),
	}
	addLedgerDay(&item, ledger[key])
	item.LedgerProfit = item.LedgerIn - item.LedgerOut
	return item
}

// manualBookDiffHints 差值 = 人工余额 − 系统应有余额(初始余额 + 之后入账 − 出账), 找它可能来自哪里:
// 先看整体是不是汇率变化; 再看当天有没有新增差值, 没有就指出差异最早出现在哪天;
// 有新增就扣掉当天的汇率变化, 看剩下的是不是正好等于某一类出入账, 或和相邻那天的新增差值互相抵消(记错了日期).
// before / after 为同一区间里这一天之前 / 之后的各天(日期升序), 合计行传 nil.
func manualBookDiffHints(item *reconDTO.ManualBookCompareItemDTO, before, after []reconDTO.ManualBookCompareItemDTO) []reconDTO.ManualBookIssueDTO {
	diff := *item.Diff
	rmb := func(value float64) string { return amountText(value, reconRepository.CurrencyRMB) }
	near := func(a, b float64) bool { return math.Abs(a-b) <= manualBookTolerance }
	direction := func(value float64) string {
		if value < 0 {
			return "少"
		}
		return "多"
	}
	issue := func(column, kind, label, text string) reconDTO.ManualBookIssueDTO {
		return reconDTO.ManualBookIssueDTO{Column: column, Kind: kind, Label: label, Text: text}
	}
	hints := []reconDTO.ManualBookIssueDTO{issue(reconDTO.IssueColumnBalance, reconDTO.IssueKindBalance,
		fmt.Sprintf("人工%s %s", direction(diff), rmb(math.Abs(diff))),
		fmt.Sprintf("截至 %s 人工余额比系统应有余额%s %s（人工 %s；系统 = %s 初始余额 %s + 之后入账 %s − 出账 %s = %s）",
			shortKey(item.Date), direction(diff), rmb(math.Abs(diff)), rmb(*item.BalanceRmb), shortKey(item.OpeningDate),
			rmb(*item.OpeningBalanceRmb), rmb(item.SinceIn), rmb(item.SinceOut), rmb(*item.SystemBalanceRmb)))}

	if item.FxEffect != nil && math.Abs(*item.FxEffect) > manualBookTolerance && near(diff, *item.FxEffect) {
		return append(hints, issue(reconDTO.IssueColumnProfit, reconDTO.IssueKindFx, "全是汇率差 "+rmb(*item.FxEffect),
			fmt.Sprintf("差值正好是汇率变化：初始余额和当天都按 U 记，汇率不同带来 %s；按同一个汇率记就没有这个差", rmb(*item.FxEffect))))
	}

	dayDiff := *item.DayDiff
	window := shortKey(item.Date)
	if item.GapDays > 1 {
		window = shortKey(nextDayKey(item.BaselineDate)) + " ~ " + shortKey(item.Date)
	}
	baseline := "上一份 " + shortKey(item.BaselineDate)
	if item.BaselineIsOpening {
		baseline = "初始余额 " + shortKey(item.BaselineDate)
	}
	if near(dayDiff, 0) {
		for i := len(before) - 1; i >= 0; i-- {
			if before[i].DayDiff != nil && !near(*before[i].DayDiff, 0) {
				return append(hints, issue(reconDTO.IssueColumnDiff, reconDTO.IssueKindCarry, "差异从 "+shortKey(before[i].Date)+" 开始",
					fmt.Sprintf("%s 没有新增差异，和%s差的一样；差异从 %s 开始出现，去看那天", window, baseline, shortKey(before[i].Date))))
			}
		}
		return append(hints, issue(reconDTO.IssueColumnDiff, reconDTO.IssueKindCarry, "开始日之前就有差异",
			fmt.Sprintf("%s 没有新增差异，和%s差的一样；差异在所选开始日之前就有了，往前选日期找第一次出现的那天", window, baseline)))
	}

	residual := dayDiff
	if item.GapDays > 0 || item.BaselineDate != item.Date {
		hints = append(hints, issue(reconDTO.IssueColumnDiff, reconDTO.IssueKindSplit, "之前累计 "+rmb(diff-dayDiff),
			fmt.Sprintf("其中 %s 新增 %s（人工利润 %s，入账 − 出账 %s），之前累计 %s",
				window, rmb(dayDiff), rmb(*item.ManualProfit), rmb(item.LedgerProfit), rmb(diff-dayDiff))))
	}
	if item.DayFxEffect != nil && math.Abs(*item.DayFxEffect) > manualBookTolerance {
		if near(dayDiff, *item.DayFxEffect) {
			return append(hints, issue(reconDTO.IssueColumnProfit, reconDTO.IssueKindFx, "新增全是汇率差 "+rmb(*item.DayFxEffect),
				fmt.Sprintf("新增的正好是汇率变化：和%s都按 U 记，汇率不同带来 %s；填同一个汇率就没有这个差", baseline, rmb(*item.DayFxEffect))))
		}
		residual = dayDiff - *item.DayFxEffect
		hints = append(hints, issue(reconDTO.IssueColumnProfit, reconDTO.IssueKindFx, "汇率差 "+rmb(*item.DayFxEffect)+"，扣后差 "+rmb(residual),
			fmt.Sprintf("新增里汇率变化带来 %s，扣掉后还差 %s", rmb(*item.DayFxEffect), rmb(residual))))
	}

	for _, category := range item.LedgerCategories {
		amount := category.AmountRmb
		if math.Abs(amount) <= manualBookTolerance {
			continue
		}
		name := "「" + category.CategoryName + "」"
		switch {
		case category.RecordType == "OUT" && near(residual, amount):
			return append(hints, issue(reconDTO.IssueColumnOut, reconDTO.IssueKindLedger, "= "+name+" "+rmb(amount),
				fmt.Sprintf("新增的正好等于 %s %s %s：余额里可能还没扣这笔（比如审核通过了但钱第二天才出），或出入账里多记 / 重复记了", window, name, rmb(amount))))
		case category.RecordType == "OUT" && near(residual, -amount):
			return append(hints, issue(reconDTO.IssueColumnOut, reconDTO.IssueKindLedger, "= −"+name+" "+rmb(amount),
				fmt.Sprintf("新增的正好等于负的 %s %s %s：余额里多扣了一笔同样金额的出账，出入账里可能漏记了（或记到了别的日期）", window, name, rmb(amount))))
		case category.RecordType == "IN" && near(residual, -amount):
			return append(hints, issue(reconDTO.IssueColumnIn, reconDTO.IssueKindLedger, "= −"+name+" "+rmb(amount),
				fmt.Sprintf("新增的正好等于负的 %s %s %s：这笔入账可能还没到账，或出入账里多记 / 重复记了", window, name, rmb(amount))))
		case category.RecordType == "IN" && near(residual, amount):
			return append(hints, issue(reconDTO.IssueColumnIn, reconDTO.IssueKindLedger, "= "+name+" "+rmb(amount),
				fmt.Sprintf("新增的正好等于 %s %s %s：余额里多了一笔同样金额的入账，出入账里可能漏记了", window, name, rmb(amount))))
		}
	}
	switch {
	case near(residual, item.LedgerOut) && item.LedgerOut != 0:
		return append(hints, issue(reconDTO.IssueColumnOut, reconDTO.IssueKindLedger, "= 全部出账",
			fmt.Sprintf("新增的正好等于 %s 全部出账 %s：余额里可能一笔出账都还没扣", window, rmb(item.LedgerOut))))
	case near(residual, -item.LedgerIn) && item.LedgerIn != 0:
		return append(hints, issue(reconDTO.IssueColumnIn, reconDTO.IssueKindLedger, "= −全部入账",
			fmt.Sprintf("新增的正好等于负的 %s 全部入账 %s：入账可能都还没到账", window, rmb(item.LedgerIn))))
	}
	for _, neighbor := range adjacentBooked(before, after) {
		if neighbor.DayDiff != nil && !near(*neighbor.DayDiff, 0) && near(dayDiff, -*neighbor.DayDiff) {
			return append(hints, issue(reconDTO.IssueColumnDiff, reconDTO.IssueKindNeighbor, "和 "+shortKey(neighbor.Date)+" 抵消",
				fmt.Sprintf("和 %s 新增的差值正好抵消：多半是有一笔出入账记到了相邻的那一天（比如出款审核和实际付款不在同一天），两天合起来是对的", shortKey(neighbor.Date))))
		}
	}
	return append(hints, issue(reconDTO.IssueColumnDiff, reconDTO.IssueKindCheck, "核对漏记 / 余额填错",
		fmt.Sprintf("核对 %s 有没有漏记的出入账（服务器出款、其他出账等），以及余额有没有填错", window)))
}

// adjacentBooked 前后最近一份有对比结果的记账.
func adjacentBooked(before, after []reconDTO.ManualBookCompareItemDTO) []*reconDTO.ManualBookCompareItemDTO {
	result := make([]*reconDTO.ManualBookCompareItemDTO, 0, 2)
	for i := len(before) - 1; i >= 0; i-- {
		if before[i].DayDiff != nil {
			result = append(result, &before[i])
			break
		}
	}
	for i := range after {
		if after[i].DayDiff != nil {
			result = append(result, &after[i])
			break
		}
	}
	return result
}

// fillBook 当天记的余额和各社区欠款; 欠款增量相对 debtBase(上一份人工记账, 没有为 nil), 欠款不参与余额对比.
func fillBook(item *reconDTO.ManualBookCompareItemDTO, book *reconDTO.ManualBookDTO, debtBase *reconDTO.ManualBookDTO) {
	item.BookID = book.ID
	item.Currency = book.Currency
	item.Balance = floatPtr(book.Balance)
	item.BalanceRmb = floatPtr(book.BalanceRmb)
	item.DebtTotalRmb = floatPtr(book.DebtTotalRmb)
	item.Debts = make([]reconDTO.ManualBookDebtCompareDTO, 0, len(book.Debts))
	for _, debt := range book.Debts {
		item.Debts = append(item.Debts, reconDTO.ManualBookDebtCompareDTO{
			UpstreamUserID: debt.UpstreamUserID, UpstreamUserName: debt.UpstreamUserName,
			UpstreamUsername: debt.UpstreamUsername, UpstreamRemark: debt.UpstreamRemark, UpstreamBalance: debt.UpstreamBalance,
			UpstreamBalanceLive: debt.UpstreamBalanceLive, UpstreamBalanceTime: debt.UpstreamBalanceTime,
			Currency: debt.Currency, Amount: debt.Amount, AmountRmb: debt.AmountRmb,
		})
	}
	if debtBase == nil {
		return
	}
	item.DebtBaselineDate = debtBase.BookDate
	item.DebtChangeRmb = floatPtr(book.DebtTotalRmb - debtBase.DebtTotalRmb)
	previous := make(map[uint64]reconDTO.ManualBookDebtDTO, len(debtBase.Debts))
	for _, debt := range debtBase.Debts {
		previous[debt.UpstreamUserID] = debt
	}
	for i := range item.Debts {
		debt := &item.Debts[i]
		last, ok := previous[debt.UpstreamUserID]
		if !ok {
			debt.IsNew = true
			debt.Change, debt.ChangeRmb = floatPtr(debt.Amount), floatPtr(debt.AmountRmb)
			continue
		}
		debt.ChangeRmb = floatPtr(debt.AmountRmb - last.AmountRmb)
		if last.Currency == debt.Currency {
			debt.Change = floatPtr(debt.Amount - last.Amount)
		}
	}
}

func floatPtr(value float64) *float64 { return &value }
