"use client";

import { getDataList, instance, unwrapApiResponse, type ApiResponse } from "@/utils/axios";

export class ManualWithdrawRecord {
  id = 0;

  channel = "";

  username = "";

  points = 0;

  status = "";

  description = "";

  applyTime?: string;

  approveTime?: string;

  paymentId = 0;

  paymentType = "";

  paymentName = "";

  paymentAccount = "";

  createdTime?: string;

  updatedTime?: string;
}

export interface ManualWithdrawQuery {
  username?: string;
  channel?: string;
  status?: string;
  startTime?: string;
  endTime?: string;
  /** 审核时间区间，yyyy-MM-dd HH:mm:ss；传了之后未审核的记录不会出现 */
  approveStartTime?: string;
  approveEndTime?: string;
}

export interface ManualWithdrawActionPayload {
  username?: string;
  userPointWithdrawRecordId: number;
  description?: string;
}

export async function fetchManualWithdrawRecords(query?: ManualWithdrawQuery) {
  return getDataList(
    ManualWithdrawRecord,
    "/barry/user-withdraw-records",
    query as Record<string, string | number | undefined> | undefined,
  );
}

export async function accountManualWithdraw(payload: ManualWithdrawActionPayload) {
  const response = await instance.post<ApiResponse<string>>("/barry/user-withdraws/account", payload);
  return unwrapApiResponse(response.data);
}

export async function finishManualWithdraw(payload: ManualWithdrawActionPayload) {
  const response = await instance.post<ApiResponse<string>>("/barry/user-withdraws/finish", payload);
  return unwrapApiResponse(response.data);
}

export async function cancelManualWithdraw(payload: ManualWithdrawActionPayload) {
  const response = await instance.post<ApiResponse<string>>("/barry/user-withdraws/cancel", payload);
  return unwrapApiResponse(response.data);
}

/** 提现汇总：一个渠道一天一行（状态归类同老管理端） */
export class ManualWithdrawSummary {
  date = "";

  channel = "";

  approvingNum = 0;

  approvingPoints = 0;

  accountingNum = 0;

  accountingPoints = 0;

  finishNum = 0;

  finishPoints = 0;

  errorNum = 0;

  errorPoints = 0;
}

/** 日期为 YYYY-MM-DD 闭区间，渠道必填 */
export interface ManualWithdrawSummaryQuery {
  channel: string;
  startDate: string;
  endDate: string;
}

export async function fetchManualWithdrawSummaries(query: ManualWithdrawSummaryQuery) {
  return getDataList(
    ManualWithdrawSummary,
    "/barry/withdraw-summaries",
    query as unknown as Record<string, string>,
  );
}

/** 批量发起结算：区间内「审核中」的提现推进到「结算中」，后台异步处理 */
export async function accountManualWithdrawSummary(payload: ManualWithdrawSummaryQuery) {
  const response = await instance.post<ApiResponse<string>>("/barry/withdraw-summaries/account", payload);
  return unwrapApiResponse(response.data);
}

/** 批量发起核销：区间内「结算中」的提现推进到「提现成功」，后台异步处理 */
export async function finishManualWithdrawSummary(payload: ManualWithdrawSummaryQuery) {
  const response = await instance.post<ApiResponse<string>>("/barry/withdraw-summaries/finish", payload);
  return unwrapApiResponse(response.data);
}
