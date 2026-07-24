"use client";

import { instance, unwrapApiResponse, type ApiResponse } from "@/utils/axios";

export interface ManualOrderDetailQuery {
  startDate?: string;
  endDate?: string;
  userId?: number;
  uid?: string;
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

export async function fetchManualOrderDetails(query?: ManualOrderDetailQuery) {
  const response = await instance.get<ApiResponse<ManualOrderDetailPage>>("/barry/manual-order-details", { params: query });
  return unwrapApiResponse(response.data);
}

export async function fetchManualOrderDetailSecUid(userId: number, uid: string) {
  const response = await instance.get<ApiResponse<string>>("/barry/manual-order-details/sec-uid", { params: { userId, uid } });
  return unwrapApiResponse(response.data);
}
