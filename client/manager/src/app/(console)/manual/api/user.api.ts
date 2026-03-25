"use client";

import { getData, getDataList, instance, unwrapApiResponse, type ApiResponse } from "@/utils/axios";

export class ManualPaymentMethodRecord {
  id = 0;

  type = "";

  name = "";

  account = "";
}

export class ManualUserRecord {
  id = 0;

  username = "";

  password = "";

  originalPassword = "";

  channel = "";

  inventCode = "";

  alipayName = "";

  alipayAccount = "";

  role = "";

  paymentMethods: ManualPaymentMethodRecord[] = [];

  createdTime?: string;

  updatedTime?: string;
}

export interface ManualUserListQuery {
  channel?: string;
  username?: string;
}

export interface ManualUserPayload {
  username: string;
  password?: string;
  originalPassword?: string;
  channel?: string;
  inventCode?: string;
  alipayName?: string;
  alipayAccount?: string;
  role?: string;
}

export async function fetchManualUsers(query?: ManualUserListQuery) {
  return getDataList(ManualUserRecord, "/barry/user-details", query as Record<string, string | number | undefined> | undefined);
}

export async function fetchManualUserDetail(username: string) {
  return getData(ManualUserRecord, "/barry/user-details/detail", { username });
}

export async function createManualUser(payload: ManualUserPayload) {
  const response = await instance.post<ApiResponse<string | null>>("/barry/user-details", payload);
  return unwrapApiResponse(response.data);
}

export async function updateManualUser(payload: ManualUserPayload) {
  const response = await instance.put<ApiResponse<string | null>>("/barry/user-details", payload);
  return unwrapApiResponse(response.data);
}
