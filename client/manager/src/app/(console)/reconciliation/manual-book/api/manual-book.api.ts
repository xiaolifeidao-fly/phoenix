"use client";

import { getData, instance, unwrapApiResponse, type ApiResponse } from "@/utils/axios";

/** 人工记账的币种：剩余金额默认 U，社区欠款默认 RMB */
export type ManualBookCurrency = "USDT" | "RMB";

export interface ManualBookDebt {
  /** 上游社区（suffer user.id） */
  upstreamUserId: number;
  upstreamUserName?: string;
  /** 用户管理里当前的用户名、备注，只用于展示 */
  upstreamUsername?: string;
  upstreamRemark?: string;
  /**
   * 截至记账当天的账户余额（RMB，已充值还没消费），取每天 00:00 打的前一天快照；
   * 当天还没打快照时是当前余额（upstreamBalanceLive），更早的日期没有快照时为空
   */
  upstreamBalance?: number | null;
  upstreamBalanceLive?: boolean;
  /** 快照实际打的时间 */
  upstreamBalanceTime?: string;
  currency: ManualBookCurrency;
  amount: number;
  amountRmb: number;
}

/** 人工记账：每天一份，剩余金额 + 各上游社区欠款 */
export interface ManualBookRecord {
  id: number;
  bookDate: string;
  currency: ManualBookCurrency;
  balance: number;
  /** 1U = ? RMB；全是 RMB 时为空 */
  exchangeRate: number | null;
  balanceRmb: number;
  debtTotalRmb: number;
  debts: ManualBookDebt[];
  remark?: string;
  createdBy?: string;
  updatedBy?: string;
  updatedTime?: string;
}

export interface ManualBookPayload {
  bookDate: string;
  currency: ManualBookCurrency;
  balance: number;
  exchangeRate?: number | null;
  remark?: string;
  debts: { upstreamUserId: number; currency: ManualBookCurrency; amount: number }[];
}

/** 某个社区截至当天的欠款，以及相对上一份记账的增量；上一份里没有这个社区时按 0 算，isNew = true */
export interface ManualBookDebtCompare {
  upstreamUserId: number;
  upstreamUserName?: string;
  upstreamUsername?: string;
  upstreamRemark?: string;
  /**
   * 截至记账当天的账户余额（RMB，已充值还没消费），取每天 00:00 打的前一天快照；
   * 当天还没打快照时是当前余额（upstreamBalanceLive），更早的日期没有快照时为空
   */
  upstreamBalance?: number | null;
  upstreamBalanceLive?: boolean;
  /** 快照实际打的时间 */
  upstreamBalanceTime?: string;
  currency: ManualBookCurrency;
  amount: number;
  amountRmb: number;
  /** 按原币种的增量，换了币种时为空 */
  change: number | null;
  changeRmb: number | null;
  isNew: boolean;
}

/** 全局初始余额：金额是 balanceDate 这天结束时账上的余额，人工记账对比以它为基准 */
export interface OpeningBalanceRecord {
  id: number;
  balanceDate: string;
  currency: ManualBookCurrency;
  balance: number;
  exchangeRate: number | null;
  balanceRmb: number;
  remark?: string;
  updatedBy?: string;
  updatedTime?: string;
}

export interface OpeningBalancePayload {
  balanceDate: string;
  currency: ManualBookCurrency;
  balance: number;
  /** 按 U 时必填 */
  exchangeRate?: number | null;
  remark?: string;
}

/** 没录过为 null */
export async function fetchOpeningBalance() {
  const response = await instance.get<ApiResponse<OpeningBalanceRecord | null>>("/reconciliation/opening-balance");
  return unwrapApiResponse(response.data) ?? null;
}

/** 只有一条，已有就改它 */
export async function saveOpeningBalance(payload: OpeningBalancePayload) {
  const response = await instance.post<ApiResponse<OpeningBalanceRecord>>("/reconciliation/opening-balance", payload);
  return unwrapApiResponse(response.data);
}

export async function clearOpeningBalance() {
  const response = await instance.delete<ApiResponse<boolean>>("/reconciliation/opening-balance");
  return unwrapApiResponse(response.data);
}

/**
 * OK 一致 / DIFF 有差异 / MISSING 当天没记账 / NO_BASELINE 还没设初始余额 / BEFORE_START 早于初始余额日期
 */
export type ManualBookCompareStatus = "OK" | "DIFF" | "MISSING" | "NO_BASELINE" | "BEFORE_START";

/**
 * 以初始余额为基准：系统应有余额 = 初始余额 + 初始余额日期次日到当天的（入账 − 出账），差值 = 人工余额 − 系统应有余额（累计）。
 * 当天窗口 (baselineDate, date]：上一份 = 初始余额日期之后最近一份人工记账，没有时就是初始余额（baselineIsOpening）；
 * 人工利润 = 当天余额 − 上一份余额，系统利润 = 入账 − 出账，两者之差 = 当天新增差值 dayDiff。中间有天没记账时窗口跨多天（gapDays > 1）。
 */
export interface ManualBookCompareItem {
  date: string;
  status: ManualBookCompareStatus;
  baselineDate?: string;
  baselineIsOpening?: boolean;
  gapDays: number;
  bookId?: number;
  currency?: ManualBookCurrency;
  balance: number | null;
  balanceRmb: number | null;
  /** 上一份人工余额（或初始余额） */
  baselineBalanceRmb: number | null;
  /** 截至上一份日期的系统应有余额 */
  baselineSystemBalanceRmb: number | null;
  debtTotalRmb: number | null;
  /** 欠款合计相对上一份人工记账的增量（RMB），没有上一份时为空；欠款不参与余额对比 */
  debtBaselineDate?: string;
  debtChangeRmb: number | null;
  /** 截至当天各社区的欠款及增量 */
  debts?: ManualBookDebtCompare[];
  /** 剩余金额按原币种的变化，只有和上一份同币种时有值 */
  balanceChange: number | null;
  manualProfit: number | null;
  ledgerIn: number;
  /** 出账，含各类手续费 */
  ledgerOut: number;
  ledgerProfit: number;
  /** 窗口内出入账按类目拆开 */
  ledgerCategories?: ManualBookLedgerCategory[];
  /** 用到的初始余额日期 / 金额（RMB），以及之后到当天的累计入账、出账 */
  openingDate?: string;
  openingBalanceRmb: number | null;
  sinceIn: number;
  sinceOut: number;
  /** 系统应有余额 = 初始余额 + 累计入账 − 累计出账（RMB）；没设初始余额或早于它时为空 */
  systemBalanceRmb: number | null;
  /** 初始余额和当天都按 U 记、汇率不同时，汇率变化带来的差（RMB） */
  fxEffect: number | null;
  /** 同上，相对上一份 */
  dayFxEffect: number | null;
  /** 人工余额 − 系统应有余额（累计差） */
  diff: number | null;
  /** 差值 ÷ |系统应有余额| */
  diffRatio: number | null;
  /** 人工利润 − 系统利润 = 当天新增的差值 */
  dayDiff: number | null;
  /** 有差异时，差值可能来自哪里；每条挂在对应的那一列 */
  issues?: ManualBookIssue[];
}

/** 窗口内某个出入账类目的合计（RMB） */
export interface ManualBookLedgerCategory {
  category: string;
  categoryName: string;
  recordType: "IN" | "OUT";
  count: number;
  amountRmb: number;
}

export type ManualBookIssueColumn = "balance" | "profit" | "in" | "out" | "diff";

/** balance 累计差 / split 新增与之前累计 / fx 汇率 / carry 之前带过来 / ledger 等于某类出入账 / neighbor 和相邻那天抵消 / check 待核对 */
export type ManualBookIssueKind = "balance" | "split" | "fx" | "carry" | "ledger" | "neighbor" | "check";

/** 差值的一条可能来源：label 放在格子里，text 是完整说明 */
export interface ManualBookIssue {
  column: ManualBookIssueColumn;
  kind: ManualBookIssueKind;
  label: string;
  text: string;
}

export class ManualBookCompare {
  startDate = "";

  endDate = "";

  /** 对比基准，没设为 null */
  openingBalance: OpeningBalanceRecord | null = null;

  total: ManualBookCompareItem | null = null;

  days: ManualBookCompareItem[] = [];

  /** 区间内的记账（不含往前回看的那份） */
  books: ManualBookRecord[] = [];

  diffDays = 0;

  /** 差值绝对值不超过它算一致（RMB） */
  tolerance = 0.01;
}

/** 日期 yyyy-MM-dd，两端都包含，区间最长 93 天；以初始余额为基准 */
export function fetchManualBookCompare(startDate: string, endDate: string) {
  return getData(ManualBookCompare, "/reconciliation/manual-books/compare", { startDate, endDate });
}

/** 某天的记账（没有为 null）+ 之前最近一份（用来预填） */
export async function fetchManualBookDetail(date: string) {
  const response = await instance.get<ApiResponse<{ book: ManualBookRecord | null; previous: ManualBookRecord | null }>>(
    "/reconciliation/manual-books/detail",
    { params: { date } },
  );
  return unwrapApiResponse(response.data) ?? { book: null, previous: null };
}

/** id 为空新增（当天已有记账会被拒绝），否则修改；记账日期不能改 */
export async function saveManualBook(id: number | null, payload: ManualBookPayload) {
  const response = id
    ? await instance.put<ApiResponse<ManualBookRecord>>(`/reconciliation/manual-books/${id}`, payload)
    : await instance.post<ApiResponse<ManualBookRecord>>("/reconciliation/manual-books", payload);
  return unwrapApiResponse(response.data);
}

export type ManualBookLogAction = "CREATE" | "UPDATE" | "DELETE";

/** 一次修改里的一项变化：新增的项 before 为空，删除的项 after 为空；金额已带币种格式化好 */
export interface ManualBookChange {
  field: "balance" | "exchangeRate" | "remark" | "debt";
  label: string;
  before?: string;
  after?: string;
}

export interface ManualBookLog {
  id: number;
  bookId: number;
  bookDate: string;
  action: ManualBookLogAction;
  operator?: string;
  time: string;
  changes: ManualBookChange[];
}

/** 修改记录，按时间倒序；查一天时两个日期传同一天，区间最长 93 天 */
export async function fetchManualBookLogs(startDate: string, endDate: string) {
  const response = await instance.get<ApiResponse<ManualBookLog[]>>("/reconciliation/manual-books/logs", {
    params: { startDate, endDate },
  });
  return unwrapApiResponse(response.data) ?? [];
}

export async function deleteManualBook(id: number) {
  const response = await instance.delete<ApiResponse<boolean>>(`/reconciliation/manual-books/${id}`);
  return unwrapApiResponse(response.data);
}

/** OK 一致 / MINOR 相差较小 / DIFF 有差异 / NO_MANUAL 当天人工记账里没有这个社区 / BEFORE_START 记账日早于欠款日期 */
export type DebtCompareStatus = "OK" | "MINOR" | "DIFF" | "NO_MANUAL" | "BEFORE_START";

/**
 * 某个上游社区在某个记账日的核对（RMB），每个指标人工、系统各一个值。
 * 当天窗口 = [dayStart, 记账日]，dayStart = 上一份欠款日期的次日；充值 / 入账 / 手续费只算当天窗口。
 * 上一份欠款：人工 = 上一份人工记账（没有时为初始欠款），系统 = 截至上一份日期的系统欠款。
 * 当天增量：人工 = 当天人工欠款 − 上一份人工欠款，系统 = 充值 − 入账 − 代收手续费。
 * 当天欠款：人工 = 当天人工记账，系统 = 初始欠款 + 欠款日期次日到当天的累计增量。
 * 应收：人工 = 人工增量 + 入账 + 代收手续费，系统 = 当天充值；两者之差 = 当天新增差值。
 * 差值 = 人工欠款 − 系统欠款（累计）；当天新增差值 = 人工增量 − 系统增量。
 */
export interface DebtCompareRow {
  userId: number;
  name: string;
  username?: string;
  remark?: string;
  isTrading: boolean;
  /** 初始欠款（人工录入欠款），openingDate 是它的欠款日期 */
  openingDebt: number;
  openingDate?: string;
  openingMissing: boolean;
  /** 上一份欠款的日期；prevIsOpening = 上一份就是初始欠款 */
  prevDate?: string;
  prevIsOpening: boolean;
  /** 当天窗口从哪天开始（早于欠款日期时为空） */
  dayStart?: string;
  recharge: number;
  income: number;
  collectFee: number;
  prevManualDebt: number;
  prevSystemDebt: number;
  manualDebtChange: number | null;
  debtChange: number;
  manualCurrency?: ManualBookCurrency;
  manualAmount: number | null;
  manualDebt: number | null;
  systemDebt: number;
  manualReceivable: number | null;
  systemReceivable: number;
  /** 累计差值 = 人工欠款 − 系统欠款 */
  diff: number | null;
  /** 当天新增差值 = 人工增量 − 系统增量 */
  dayDiff: number | null;
  diffRatio: number | null;
  status: DebtCompareStatus;
  /** 哪里有问题：缺数据的原因，或差值的可能来源 */
  issues: string[];
}

/** 合计只算算出了差值的社区 */
export interface DebtCompareTotals {
  recharge: number;
  income: number;
  collectFee: number;
  prevManualDebt: number;
  prevSystemDebt: number;
  manualDebtChange: number;
  debtChange: number;
  manualDebt: number;
  systemDebt: number;
  manualReceivable: number;
  systemReceivable: number;
  diff: number;
  dayDiff: number;
}

/** 某一份人工记账那天的核对 */
export interface DebtCompareDay extends DebtCompareTotals {
  date: string;
  bookId: number;
  rows: DebtCompareRow[];
  diffCount: number;
  /** 有问题的社区数（有差异 + 人工未记 + 早于欠款日期） */
  issueCount: number;
}

export class DebtCompare {
  startDate = "";

  endDate = "";

  /** 区间内每一份人工记账一天，最新在前 */
  days: DebtCompareDay[] = [];

  diffDays = 0;

  notices: string[] = [];

  tolerance = 0.01;

  minorRatio = 0.01;
}

/** 日期 yyyy-MM-dd，两端都包含，区间最长 93 天 */
export function fetchDebtCompare(startDate: string, endDate: string) {
  return getData(DebtCompare, "/reconciliation/debt-compare", { startDate, endDate });
}
