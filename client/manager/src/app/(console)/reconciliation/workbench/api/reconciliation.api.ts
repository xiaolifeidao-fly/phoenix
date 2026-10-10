"use client";

import { getData, getDataList, instance, unwrapApiResponse, type ApiResponse } from "@/utils/axios";

/** 人工维度里的单个人工商品 */
export interface ReconManualDimensionShopCategory {
  shopCategoryId: number;
  shopCategoryName: string;
  /** 任务数量（order_sum_record.total_num） */
  taskNum: number;
  checkedNum: number;
  /** 待审核数量（order_sum_record.un_check_num） */
  unCheckNum: number;
  checkErrorNum: number;
  secretNum: number;
  deleteNum: number;
  /** 审核通过订单的积分（order_sum_record.order_score），不含徒弟奖励 */
  points: number;
  userCount: number;
}

/**
 * 人工维度：任务数来自 order_sum_record（按人工商品），
 * 合计积分来自 user_points_daily（按做单日期，不分商品）；商品行积分取 order_sum_record.order_score，口径不同。
 */
export class ReconManualDimension {
  startDate = "";

  endDate = "";

  taskNum = 0;

  checkedNum = 0;

  /** 待审核数量合计，和「人工 - 任务统计」的待审核同一口径 */
  unCheckNum = 0;

  checkErrorNum = 0;

  secretNum = 0;

  deleteNum = 0;

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

/** 人工录入欠款（初始欠款）：和上游社区一对一；金额是欠款日期那天结束时的欠款，从次日开始累计 */
export interface OpeningDebtRecord {
  id: number;
  userId: number;
  accountId: number;
  amount: number;
  /** 欠款日期：金额是这天结束时的欠款；旧数据可能为空 */
  debtDate?: string;
  remark?: string;
  createdBy?: string;
  createdTime?: string;
  updatedBy?: string;
  updatedTime?: string;
}

export interface OpeningDebtPayload {
  userId: number;
  amount: number;
  debtDate: string;
  remark?: string;
}

/**
 * 账户状态：活跃上游用户一行，金额 RMB。
 * 截至 D 日的系统欠款 = 人工录入欠款 + 欠款日期次日到 D 日的（充值 − 社区入账 − 代收手续费）；
 * 没录入、或 D 早于欠款日期时为 null。
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

  /** 人工录入欠款，没录过为 null */
  currentDebt: OpeningDebtRecord | null = null;

  periodRecharge = 0;

  periodIncome = 0;

  periodCollectFee = 0;

  /** 期初欠款（截至开始日前一天） */
  openingDebt: number | null = null;

  /** 期末欠款（截至结束日），即系统计算欠款 */
  closingDebt: number | null = null;

  /** 欠款日期次日到结束日的累计，悬停展示 */
  closingRecharge = 0;

  closingIncome = 0;

  closingCollectFee = 0;
}

/** 只返回用户管理里标记为「活跃」的上游用户 */
export function fetchAccountStatus(startDate: string, endDate: string) {
  return getDataList(AccountStatusRow, "/reconciliation/account-status", { startDate, endDate });
}

/** 录入人工录入欠款：这个社区已有一条时直接改它 */
export async function saveOpeningDebt(payload: OpeningDebtPayload) {
  const response = await instance.post<ApiResponse<OpeningDebtRecord>>("/reconciliation/opening-debts", payload);
  return unwrapApiResponse(response.data);
}

/** 清除人工录入欠款，这个社区回到未建账 */
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
  /** 被人工修改的次数，大于 0 时可查看快照 */
  modifyCount?: number;
}

/** ORIGINAL 首次被改前的原始内容；RESTORE 手续费随主记录恢复；DELETE 的内容是删除前的样子 */
export type LedgerSnapshotAction = "ORIGINAL" | "CREATE" | "UPDATE" | "RESTORE" | "DELETE";

/** 出入账的一版快照：人工改动后这条记录的完整内容，字段同 ReconLedgerRecord */
export interface ReconLedgerSnapshot {
  id: number;
  ledgerId: number;
  version: number;
  action: LedgerSnapshotAction;
  /** 这一版记录是否有效，删除那一版为 false */
  ledgerActive: boolean;
  operator?: string;
  /** yyyy-MM-dd HH:mm:ss */
  snapshotTime?: string;
  recordDate: string;
  recordType: LedgerRecordType;
  category: string;
  categoryName: string;
  source: LedgerSource;
  currency: LedgerCurrency;
  amountRmb: number;
  amountU?: number;
  exchangeRate?: number;
  feeRate?: number;
  settleChannelId?: number;
  settleChannelName?: string;
  userId?: number;
  username?: string;
  upstreamUserId?: string;
  upstreamUserName?: string;
  points?: number;
  remark?: string;
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

export interface ReconLedgerFeeGivenResult {
  ledgerId: number;
  upstreamUserId: string;
  upstreamUserName?: string;
  /** 赠送金额（RMB），即该入账的代收手续费 */
  amount: number;
  /** false：这条入账之前已赠送过，本次没有加款 */
  given: boolean;
}

/** 入账赠送：把社区入账的代收手续费加到该上游社区的余额；金额以服务端记的手续费为准，每条入账只赠送一次 */
export async function giveLedgerFee(id: number, recordDate: string) {
  const response = await instance.post<ApiResponse<ReconLedgerFeeGivenResult>>(
    `/barry/reconciliation/ledgers/${id}/fee-given`,
    { recordDate },
  );
  return unwrapApiResponse(response.data);
}

/** 某条出入账的快照，按版本升序；没被人工改过的为空 */
export async function fetchLedgerSnapshots(id: number) {
  const response = await instance.get<ApiResponse<ReconLedgerSnapshot[]>>(`/barry/reconciliation/ledgers/${id}/snapshots`);
  return unwrapApiResponse(response.data) ?? [];
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
