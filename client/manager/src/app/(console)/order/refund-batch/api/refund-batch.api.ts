"use client";

import { getPage, instance, unwrapApiResponse, type ApiResponse } from "@/utils/axios";

export class RefundBatchTask {
  id = 0;
  taskName = "";
  totalCount = 0;
  successCount = 0;
  failCount = 0;
  pendingCount = 0;
  taskStatus = "";
  taskStatusDesc = "";
  uploadFileName = "";
  createdAt: string | number | null = null;
  updatedAt: string | number | null = null;
}

export class RefundBatchDetail {
  id = 0;
  taskId = 0;
  tinyUrl = "";
  orderRecordId = 0;
  orderCreateTime: string | number | null = null;
  initNum = 0;
  endNum = 0;
  factEndNum = 0;
  orderNum = 0;
  actualQuantity = 0;
  rgApproveNum = 0;
  rgUnApproveNum = 0;
  bkNum = 0;
  detailStatus = "";
  detailStatusDesc = "";
  errorReason = "";
  processedAt: string | number | null = null;
  createdAt: string | number | null = null;
  updatedAt: string | number | null = null;
}

export interface RefundBatchTaskQuery extends Record<string, string | number | undefined> {
  pageIndex: number;
  pageSize: number;
  taskId?: number;
  taskStatus?: string;
}

export interface RefundBatchDetailQuery extends Record<string, string | number | undefined> {
  pageIndex: number;
  pageSize: number;
  taskId?: number;
  orderRecordId?: number;
  tinyUrl?: string;
}

export function fetchRefundBatchTasks(query: RefundBatchTaskQuery) {
  return getPage(RefundBatchTask, "/refund-batch/tasks", query);
}

export function fetchRefundBatchDetails(query: RefundBatchDetailQuery) {
  return getPage(RefundBatchDetail, "/refund-batch/details", query);
}

export async function importRefundBatch(payload: { taskName?: string; tinyUrls: string }) {
  const response = await instance.post<ApiResponse<{ message: string }>>("/refund-batch/import", payload);
  return unwrapApiResponse(response.data);
}

export async function executeRefundBatchTask(taskId: number) {
  const response = await instance.post<ApiResponse<{ message: string }>>(
    `/refund-batch/tasks/${taskId}/execute`,
  );
  return unwrapApiResponse(response.data);
}
