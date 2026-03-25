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
