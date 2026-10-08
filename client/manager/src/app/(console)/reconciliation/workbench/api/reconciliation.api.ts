"use client";

import { getData, getDataList, instance, unwrapApiResponse, type ApiResponse } from "@/utils/axios";

/** 人工维度里的单个人工商品：只有任务数，积分不分商品 */
export interface ReconManualDimensionShopCategory {
  shopCategoryId: number;
  shopCategoryName: string;
  /** 任务数量（order_sum_record.total_num） */
  taskNum: number;
  checkedNum: number;
  /** 待审核数量（order_sum_record.un_check_num） */
  unCheckNum: number;
  userCount: number;
}

/**
 * 人工维度：任务数来自 order_sum_record（按人工商品），
 * 积分来自 user_points_daily（按做单日期，不分商品），所以只有合计有积分。
 */
export class ReconManualDimension {
  startDate = "";

  endDate = "";

  taskNum = 0;

  checkedNum = 0;

  /** 待审核数量合计，和「人工 - 任务统计」的待审核同一口径 */
  unCheckNum = 0;

  /** 积分合计 = taskPoints + childrenPoints */
  points = 0;

  /** 本人做单积分 */
  taskPoints = 0;

  /** 徒弟奖励积分 */
  childrenPoints = 0;

  pointsUserCount = 0;

  shopCategoryList: ReconManualDimensionShopCategory[] = [];
}

/** 日期 yyyy-MM-dd，两端都包含，区间最长 93 天 */
export function fetchManualDimension(startDate: string, endDate: string) {
  return getData(ReconManualDimension, "/barry/reconciliation/manual-dimension", { startDate, endDate });
}

/**
 * 上游维度（金额均为 RMB）：充值 / 赠送 / 消费 / 退款 / 补款取 surfer 账户流水，消费是毛额，退款、补款单列；
 * 返点 / 小费 = 下单数量 × 商品类目单位金额 − 退单数量 × 同样的单位金额。
 */
export class UpstreamDimension {
  startDate = "";

  endDate = "";

  rechargeAmount = 0;

  givenAmount = 0;

  consumeAmount = 0;

  refundAmount = 0;

  bkAmount = 0;

  rebateAmount = 0;

  tipAmount = 0;

  orderNum = 0;

  refundNum = 0;

  orderRebate = 0;

  refundRebate = 0;

  orderTip = 0;

  refundTip = 0;
}

/** 日期 yyyy-MM-dd，两端都包含，区间最长 93 天 */
export function fetchUpstreamDimension(startDate: string, endDate: string) {
  return getData(UpstreamDimension, "/reconciliation/upstream-dimension", { startDate, endDate });
}

/** 人工录入欠款（初始欠款）：按生效日期排成时间线，同一时刻只有一条未结清 */
export interface OpeningDebtRecord {
  id: number;
  userId: number;
  accountId: number;
  amount: number;
  effectiveDate: string;
  /** UNSETTLED 未结清（当前有效）/ SETTLED 已结清（被后一条接替） */
  settleStatus: "UNSETTLED" | "SETTLED";
  settleDate?: string;
  remark?: string;
  createdBy?: string;
  createdTime?: string;
  updatedBy?: string;
  updatedTime?: string;
}

export interface OpeningDebtPayload {
  userId: number;
  amount: number;
  effectiveDate: string;
  remark?: string;
}

/**
 * 账户状态：活跃上游用户一行，金额 RMB。
 * 系统计算欠款（截至 D 日）= 起点金额 + 起点生效日之后到 D 日的（充值 − 社区入账 − 代收手续费）；
 * 起点 = 生效日期 ≤ D 的最近一条人工录入欠款，没有时为 null（未建账）。
 */
export class AccountStatusRow {
  userId = 0;

  name = "";

  username = "";

  /** 用户管理里的备注 */
  remark = "";

  accountId = 0;

  accountStatus = "";

  /** 当前余额，不随日期变化 */
  balanceAmount = 0;

  /** 当前未结清的那条人工录入欠款 */
  currentDebt: OpeningDebtRecord | null = null;

  periodRecharge = 0;

  periodIncome = 0;

  periodCollectFee = 0;

  /** 期初欠款（截至开始日前一天） */
  openingDebt: number | null = null;

  /** 期末欠款（截至结束日），即系统计算欠款 */
  closingDebt: number | null = null;

  closingBaseline: OpeningDebtRecord | null = null;

  closingRecharge = 0;

  closingIncome = 0;

  closingCollectFee = 0;
}

/** 只返回用户管理里标记为「活跃」的上游用户 */
export function fetchAccountStatus(startDate: string, endDate: string) {
  return getDataList(AccountStatusRow, "/reconciliation/account-status", { startDate, endDate });
}

export async function fetchOpeningDebts(userId: number) {
  const response = await instance.get<ApiResponse<OpeningDebtRecord[]>>("/reconciliation/opening-debts", { params: { userId } });
  return unwrapApiResponse(response.data) ?? [];
}

/** 录入新的一条：当前未结清的那条会自动结清 */
export async function createOpeningDebt(payload: OpeningDebtPayload) {
  const response = await instance.post<ApiResponse<OpeningDebtRecord>>("/reconciliation/opening-debts", payload);
  return unwrapApiResponse(response.data);
}

/** 只能改当前未结清的那条 */
export async function updateOpeningDebt(id: number, payload: OpeningDebtPayload) {
  const response = await instance.put<ApiResponse<OpeningDebtRecord>>(`/reconciliation/opening-debts/${id}`, payload);
  return unwrapApiResponse(response.data);
}

/** 撤销当前未结清的那条，上一条恢复未结清 */
export async function revokeOpeningDebt(id: number) {
  const response = await instance.delete<ApiResponse<boolean>>(`/reconciliation/opening-debts/${id}`);
  return unwrapApiResponse(response.data);
}

/** 出入账方向 */
export type LedgerRecordType = "IN" | "OUT";

/** 记账币种，USDT 即按 U */
export type LedgerCurrency = "RMB" | "USDT";

export type LedgerSource = "MANUAL" | "WITHDRAW" | "FEE";

export interface LedgerCategoryOption {
  value: string;
  label: string;
  type: LedgerRecordType;
  /** false 表示只能由系统生成（手续费），不能人工录入；人工出款两者都有，看记录的 source */
  manual: boolean;
}

/** 与 barry ReconLedgerCategory 保持一致，顺序即汇总展示顺序 */
export const LEDGER_CATEGORIES: LedgerCategoryOption[] = [
  { value: "COMMUNITY_IN", label: "社区入账", type: "IN", manual: true },
  { value: "OTHER_IN", label: "其他入账", type: "IN", manual: true },
  { value: "MANUAL_SETTLE", label: "人工出款", type: "OUT", manual: true },
  { value: "PAYOUT_FEE", label: "代付手续费", type: "OUT", manual: false },
  { value: "COLLECT_FEE", label: "代收手续费", type: "OUT", manual: false },
  { value: "SERVER_OUT", label: "服务器出款", type: "OUT", manual: true },
  { value: "OTHER_OUT", label: "其他出账", type: "OUT", manual: true },
];

export const LEDGER_TYPE_LABEL: Record<LedgerRecordType, string> = { IN: "入账", OUT: "出账" };

export const LEDGER_SOURCE_LABEL: Record<LedgerSource, string> = {
  MANUAL: "人工录入",
  WITHDRAW: "提现成功自动生成",
  FEE: "随主记录自动生成",
};

export interface ReconLedgerRecord {
  id: number;
  recordDate: string;
  recordType: LedgerRecordType;
  category: string;
  categoryName: string;
  source: LedgerSource;
  /** 只有人工录入的记录能改、能删 */
  editable: boolean;
  parentId?: number;
  currency: LedgerCurrency;
  /** 恒有值；按 U 记账时为折算值 */
  amountRmb: number;
  /** 按 RMB 记账时为空 */
  amountU?: number;
  exchangeRate?: number;
  feeRate?: number;
  settleChannelId?: number;
  settleChannelName?: string;
  userId?: number;
  username?: string;
  /** 上游社区（suffer 用户 ID）：社区入账必填，代收手续费随主记录带上 */
  upstreamUserId?: string;
  upstreamUserName?: string;
  withdrawRecordId?: number;
  points?: number;
  remark?: string;
  createdBy?: string;
}

export class ReconLedgerPage {
  total = 0;

  data: ReconLedgerRecord[] = [];
}

export interface ReconLedgerSummaryItem {
  recordType: LedgerRecordType;
  category: string;
  categoryName: string;
  count: number;
  /** 其中人工录入的笔数，其余为系统生成 */
  manualCount: number;
  amountRmb: number;
  amountU: number;
}

/** amountRmb 含按 U 记账记录的折算值；amountU 只累计按 U 记账的记录 */
export class ReconLedgerSummary {
  inRmb = 0;

  inU = 0;

  outRmb = 0;

  outU = 0;

  netRmb = 0;

  netU = 0;

  categoryList: ReconLedgerSummaryItem[] = [];
}

/** 明细可排序的列 */
export type LedgerSortField = "date" | "user" | "category";

export interface ReconLedgerQuery {
  startDate: string;
  endDate: string;
  recordType?: LedgerRecordType;
  /** 多选用逗号分隔 */
  category?: string;
  sortField?: LedgerSortField;
  sortOrder?: "asc" | "desc";
  page?: number;
  pageSize?: number;
}

/** 人工录入：amount 的币种由 currency 决定；按 U 时 exchangeRate 为空则取通道汇率 */
export interface ReconLedgerPayload {
  recordDate: string;
  category: string;
  currency: LedgerCurrency;
  amount: number;
  exchangeRate?: number | null;
  settleChannelId?: number | null;
  /** 社区入账必填：上游社区（suffer 用户 ID），名称由服务端按用户表回填 */
  upstreamUserId?: string;
  /** 人工出款必填：下游人工用户（barry 做单用户 ID） */
  userId?: number;
  remark?: string;
}

export function fetchLedgerPage(query: ReconLedgerQuery) {
  return getData(ReconLedgerPage, "/barry/reconciliation/ledgers", { ...query });
}

export function fetchLedgerSummary(startDate: string, endDate: string) {
  return getData(ReconLedgerSummary, "/barry/reconciliation/ledgers/summary", { startDate, endDate });
}

export async function saveLedger(id: number | null, payload: ReconLedgerPayload) {
  const response = id
    ? await instance.put<ApiResponse<ReconLedgerRecord>>(`/barry/reconciliation/ledgers/${id}`, payload)
    : await instance.post<ApiResponse<ReconLedgerRecord>>("/barry/reconciliation/ledgers", payload);
  return unwrapApiResponse(response.data);
}

export async function deleteLedger(id: number) {
  const response = await instance.delete<ApiResponse<boolean>>(`/barry/reconciliation/ledgers/${id}`);
  return unwrapApiResponse(response.data);
}

export interface ReconLedgerSyncResult {
  /** 区间内找到的提现成功记录数 */
  withdrawCount: number;
  /** 新生成的出入账记录条数（人工出款 + 代付手续费） */
  created: number;
  /** 记账失败的提现数 */
  failed: number;
  firstError?: string;
}

/** 补记区间内提现成功但还没记账的记录 */
export async function syncLedgerWithdraw(startDate: string, endDate: string) {
  const response = await instance.post<ApiResponse<ReconLedgerSyncResult>>("/barry/reconciliation/ledgers/sync-withdraw", {
    startDate,
    endDate,
  });
  return unwrapApiResponse(response.data);
}
