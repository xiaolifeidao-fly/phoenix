"use client";

import { getData, getDataList, getPage, instance, unwrapApiResponse, type ApiResponse } from "@/utils/axios";

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

export class BarryAppUserRecord {
  userId = "";

  username = "";

  channel = "";

  name = "";

  phone = "";

  status = "";

  group = "";

  groupName = "";

  shopCategoryId = "";
}

export class BarryUserWhitelistRecord {
  id = 0;

  userId = "";

  username = "";

  channel = "";

  name = "";

  group = "";

  groupName = "";

  shopCategoryId = "";

  status = "";

  active = true;
}

export interface ManualUserListQuery {
  channel?: string;
  username?: string;
  pageIndex?: number;
  pageSize?: number;
}

export interface BarryAppUserListQuery {
  pageIndex?: number;
  pageSize?: number;
  username?: string;
  name?: string;
  phone?: string;
  status?: string;
  channel?: string;
  group?: string;
  shopCategoryId?: string | number;
}

export interface BarryUserWhitelistQuery {
  pageIndex?: number;
  pageSize?: number;
  shopCategoryId: string | number;
  group?: string;
  userId?: string;
  username?: string;
  status?: string;
}

export interface BarryUserWhitelistPayload {
  userId: number;
  shopCategoryId: number;
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
  return getPage(ManualUserRecord, "/barry/user-details", query as Record<string, string | number | undefined> | undefined);
}

export async function fetchManualUserPaymentMethods(query: ManualUserListQuery) {
  return getDataList(ManualPaymentMethodRecord, "/barry/user-details/payment-methods", {
    channel: query.channel?.trim() || undefined,
    username: query.username?.trim(),
  });
}

export async function fetchBarryAppUsers(query?: BarryAppUserListQuery) {
  return getDataList(BarryAppUserRecord, "/barry/users", {
    pageIndex: query?.pageIndex ?? 1,
    pageSize: query?.pageSize ?? 20,
    username: query?.username,
    name: query?.name,
    phone: query?.phone,
    status: query?.status,
    channel: query?.channel?.trim() || undefined,
    group: query?.group?.trim() || undefined,
    shopCategoryId: query?.shopCategoryId,
  });
}

export async function fetchBarryUserWhitelists(query: BarryUserWhitelistQuery) {
  return getPage(BarryUserWhitelistRecord, "/barry/user-whitelists", {
    pageIndex: query.pageIndex ?? 1,
    pageSize: query.pageSize ?? 10,
    shopCategoryId: query.shopCategoryId,
    group: query.group?.trim() || undefined,
    userId: query.userId?.trim() || undefined,
    username: query.username?.trim() || undefined,
    status: query.status?.trim() || undefined,
  });
}

export async function saveBarryUserWhitelist(payload: BarryUserWhitelistPayload) {
  const response = await instance.post<ApiResponse<BarryUserWhitelistRecord | null>>("/barry/user-whitelists", payload);
  return unwrapApiResponse(response.data);
}

export async function updateBarryUserWhitelistStatus(id: number, active: boolean) {
  const response = await instance.put<ApiResponse<BarryUserWhitelistRecord | null>>(`/barry/user-whitelists/${id}/status`, {
    active,
  });
  return unwrapApiResponse(response.data);
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
