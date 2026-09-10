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

  originalPassword = "";

  channel = "";

  inventCode = "";

  alipayName = "";

  alipayAccount = "";

  role = "";

  paymentMethods: ManualPaymentMethodRecord[] = [];

  /** 当前余额（user_points.active_points），单位：积分 */
  activePoints = 0;

  /** 当前冻结金额（user_points.block_points），单位：积分 */
  blockPoints = 0;

  createdTime?: string;

  updatedTime?: string;
}

/** 全部账号积分汇总。 */
export class ManualUserPointsSummaryRecord {
  activePoints = 0;

  blockPoints = 0;

  /** 可用 + 冻结 */
  totalPoints = 0;

  accountNum = 0;
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

  minRecentApprovalRate?: number;

  recentApprovalRateDays?: number;

  dailyAssignTimeRanges = "";

  fetchTaskLoopNum?: number;
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
  userId?: string | number;
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
  group?: string;
  updatePolicy?: boolean;
  minRecentApprovalRate?: number;
  recentApprovalRateDays?: number;
  dailyAssignTimeRanges?: string;
  fetchTaskLoopNum?: number;
}

export interface AdjustManualUserPointsPayload {
  userId: number;
  /** 正数增加、负数扣减，单位：积分。只作用于可用余额。 */
  points: number;
  description: string;
  /** 前端生成，重复提交同一个 serial 服务端只会生效一次。 */
  serial?: string;
}

export interface ManualUserPointsSummaryQuery {
  /** 更新时间下界，格式 YYYY-MM-DD HH:mm:ss；留空表示全部账号。 */
  updatedTime?: string;
  /** 逗号分隔的排除用户ID。 */
  excludedUserIds?: string;
}

export interface CreateManualUserPayload {
  username: string;
  password: string;
  channel?: string;
  inventCode?: string;
  alipayName?: string;
  alipayAccount?: string;
  role?: string;
}

export interface UpdateManualUserPayload {
  username: string;
  channel?: string;
  inventCode?: string;
  alipayName?: string;
  alipayAccount?: string;
  role?: string;
}

export interface ChangeManualUserPasswordPayload {
  username: string;
  password: string;
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
  return getPage(BarryAppUserRecord, "/barry/users", {
    pageIndex: query?.pageIndex ?? 1,
    pageSize: query?.pageSize ?? 20,
    userId: query?.userId,
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

export async function updateBarryUserWhitelistGroup(id: number, group: string) {
  const response = await instance.put<ApiResponse<BarryUserWhitelistRecord | null>>(`/barry/user-whitelists/${id}/group`, { group });
  return unwrapApiResponse(response.data);
}

export async function fetchManualUserDetail(username: string) {
  return getData(ManualUserRecord, "/barry/user-details/detail", { username });
}

export async function createManualUser(payload: CreateManualUserPayload) {
  const response = await instance.post<ApiResponse<string | null>>("/barry/user-details", payload);
  return unwrapApiResponse(response.data);
}

export async function updateManualUser(payload: UpdateManualUserPayload) {
  const response = await instance.put<ApiResponse<string | null>>("/barry/user-details", payload);
  return unwrapApiResponse(response.data);
}

export async function changeManualUserPassword(payload: ChangeManualUserPasswordPayload) {
  const response = await instance.put<ApiResponse<string | null>>("/barry/user-details/password", payload);
  return unwrapApiResponse(response.data);
}

export async function adjustManualUserPoints(payload: AdjustManualUserPointsPayload) {
  const response = await instance.post<ApiResponse<string | null>>("/barry/user-points/adjust", payload);
  return unwrapApiResponse(response.data);
}

export async function fetchManualUserPointsSummary(query?: ManualUserPointsSummaryQuery) {
  return getData(ManualUserPointsSummaryRecord, "/barry/user-points/summary", {
    updatedTime: query?.updatedTime?.trim() || undefined,
    excludedUserIds: query?.excludedUserIds?.trim() || undefined,
  });
}
