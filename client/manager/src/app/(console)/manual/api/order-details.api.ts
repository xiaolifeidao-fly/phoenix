"use client";

import { instance, unwrapApiResponse, type ApiResponse } from "@/utils/axios";

export interface ManualOrderDetailQuery {
  startDate?: string;
  endDate?: string;
  userId?: number;
  uid?: string;
  shopCategoryIds?: string;
  excludeWhitelistUsers?: boolean;
  fansNumOrder?: "ASC" | "DESC";
  fansNumMin?: number;
  fansNumMax?: number;
  approvalRateMin?: number;
  approvalRateMax?: number;
  page?: number;
  pageSize?: number;
}

export interface ManualOrderDetail {
  userId: number;
  username: string;
  channel: string;
  uid: string;
  fansNum: number;
  totalSubmitNum: number;
  unSubmitNum: number;
  unCheckNum: number;
  checkedNum: number;
  checkErrorNum: number;
  approvalRate: number;
}

export interface ManualOrderDetailPage {
  startDate: string;
  endDate: string;
  total: number;
  page: number;
  pageSize: number;
  records: ManualOrderDetail[];
}

export interface ManualOrderFetchMonitorUIDsQuery {
  userIds: string;
  uids: string;
  windowSeconds?: number;
}

export interface ManualOrderFetchMonitor {
  userId: number;
  uid: string;
  hitNum: number;
  missNum: number;
  windowSeconds: number;
  hitRemainingSeconds: number;
  missRemainingSeconds: number;
  hitElapsedSeconds: number;
  missElapsedSeconds: number;
  elapsedSeconds: number;
  hitSpeed: number;
  missSpeed: number;
}

export async function fetchManualOrderDetails(query?: ManualOrderDetailQuery) {
  const response = await instance.get<ApiResponse<ManualOrderDetailPage>>("/barry/manual-order-details", {
    params: query,
    timeout: 30_000,
  });
  return unwrapApiResponse(response.data);
}

export async function fetchManualOrderDetailSecUid(userId: number, uid: string) {
  const response = await instance.get<ApiResponse<string>>("/barry/manual-order-details/sec-uid", { params: { userId, uid } });
  return unwrapApiResponse(response.data);
}

export async function fetchManualOrderFetchMonitorUIDs(query: ManualOrderFetchMonitorUIDsQuery) {
  const response = await instance.get<ApiResponse<ManualOrderFetchMonitor[]>>("/barry/order-fetch-monitor/uids", {
    params: query,
    timeout: 30_000,
  });
  return unwrapApiResponse(response.data);
}

export interface UserAssignQueue {
  userId: number;
  uid: string;
  shopTypeId: number;
  shopTypeName: string;
  shopTypeCode: string;
  shopGroupId: number;
  queueKey: string;
  delayQueueKey: string;
  normalNum: number;
  delayNum: number;
  totalNum: number;
  remainingSeconds: number;
}

export async function fetchUserAssignQueues(uid: string, userId?: number) {
  const response = await instance.get<ApiResponse<UserAssignQueue[]>>("/barry/assign-queue/uid", {
    params: { uid, userId },
    timeout: 30_000,
  });
  return unwrapApiResponse(response.data) ?? [];
}
