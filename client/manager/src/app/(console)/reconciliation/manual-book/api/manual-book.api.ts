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

/** OK 一致 / DIFF 有差异 / MISSING 当天没记账 / NO_BASELINE 往前找不到上一份，算不出利润 */
export type ManualBookCompareStatus = "OK" | "DIFF" | "MISSING" | "NO_BASELINE";

/**
 * 对比窗口 (baselineDate, date]：人工利润 = 当天剩余金额 − 上一份剩余金额（RMB），出入账利润 = 窗口内入账 − 出账。
 * 中间有天没记账时窗口跨多天（gapDays > 1）。
 */
export interface ManualBookCompareItem {
  date: string;
  status: ManualBookCompareStatus;
  baselineDate?: string;
  gapDays: number;
  bookId?: number;
  currency?: ManualBookCurrency;
  balance: number | null;
  balanceRmb: number | null;
  baselineBalanceRmb: number | null;
  debtTotalRmb: number | null;
  /** 欠款合计相对上一份的增量（RMB），没有上一份时为空 */
  debtChangeRmb: number | null;
  /** 截至当天各社区的欠款及增量 */
  debts?: ManualBookDebtCompare[];
  /** 剩余金额按原币种的变化，只有和上一份同币种时有值 */
  balanceChange: number | null;
  manualProfit: number | null;
  ledgerIn: number;
  ledgerOut: number;
  ledgerProfit: number;
  /** 人工利润 − 出入账利润 */
  diff: number | null;
  /** 差值 ÷ |出入账利润|，出入账利润为 0 时为空 */
  diffRatio: number | null;
}

export class ManualBookCompare {
  startDate = "";

  endDate = "";

  total: ManualBookCompareItem | null = null;

  days: ManualBookCompareItem[] = [];

  /** 区间内的记账（不含往前回看的那份） */
  books: ManualBookRecord[] = [];

  diffDays = 0;

  /** 差值绝对值不超过它算一致（RMB） */
  tolerance = 0.01;
}

/** 日期 yyyy-MM-dd，两端都包含，区间最长 93 天；起点往开始日之前最多找 31 天 */
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

/** OK 一致 / MINOR 相差较小 / DIFF 有差异 / NO_BASELINE 找不到上一份记账 / NO_MANUAL 当天人工记账里没有这个社区 */
export type DebtCompareStatus = "OK" | "MINOR" | "DIFF" | "NO_BASELINE" | "NO_MANUAL";

/**
 * 某个上游社区在 (上一份记账日, 当天] 内的核对（RMB）：
 * 应收 = 入账 + 欠款增量 + 入账代收手续费。
 * 应收 = 这段时间的充值；人工对比值 = 入账（社区入账）+ 欠款增量（当天人工欠款 − 上一份人工欠款）+ 入账代收手续费；
 * 差值 = 人工对比值 − 应收。
 */
export interface DebtCompareRow {
  userId: number;
  name: string;
  username?: string;
  remark?: string;
  isTrading: boolean;
  /** 应收 = 这段时间的充值 */
  receivable: number;
  /** 入账 = 社区入账 */
  income: number;
  /** 入账代收手续费 */
  collectFee: number;
  /** 入账 + 入账代收手续费 */
  incomeTotal: number;
  previousDebt: number | null;
  /** 上一份没记这个社区，欠款按 0 算 */
  previousMissing: boolean;
  manualCurrency?: ManualBookCurrency;
  manualAmount: number | null;
  manualDebt: number | null;
  debtChange: number | null;
  /** 入账 + 欠款增量 + 入账代收手续费 */
  manualTotal: number | null;
  diff: number | null;
  diffRatio: number | null;
  status: DebtCompareStatus;
  /** 哪里有问题：缺数据的原因，或差值的可能来源 */
  issues: string[];
}

/** 某一份人工记账那天的核对，对比窗口 (previousDate, date] */
export interface DebtCompareDay {
  date: string;
  bookId: number;
  /** 上一份人工记账的日期，往前 31 天内找不到时为空 */
  previousDate?: string;
  days: number;
  rows: DebtCompareRow[];
  /** 合计只算两边都有值的社区；manualTotal = income + debtChange + collectFee */
  receivable: number;
  income: number;
  debtChange: number;
  collectFee: number;
  manualTotal: number;
  diff: number;
  diffCount: number;
  /** 有问题的社区数（有差异 + 缺上一份 + 人工未记） */
  issueCount: number;
}

export class DebtCompare {
  startDate = "";

  endDate = "";

  /** 区间内每一份人工记账一天，最新在前 */
  days: DebtCompareDay[] = [];

  /** 整个区间的合计 = 各天合计之和 */
  receivable = 0;

  income = 0;

  debtChange = 0;

  collectFee = 0;

  manualTotal = 0;

  diff = 0;

  diffDays = 0;

  notices: string[] = [];

  tolerance = 0.01;

  minorRatio = 0.01;
}

/** 日期 yyyy-MM-dd，两端都包含，区间最长 93 天 */
export function fetchDebtCompare(startDate: string, endDate: string) {
  return getData(DebtCompare, "/reconciliation/debt-compare", { startDate, endDate });
}
