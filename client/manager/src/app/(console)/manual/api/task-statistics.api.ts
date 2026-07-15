"use client";

import { instance, unwrapApiResponse, type ApiResponse } from "@/utils/axios";

export interface ManualTaskStatisticsQuery {
  startDate?: string;
  endDate?: string;
  shopCategoryIds?: string;
  userId?: number;
  page?: number;
  pageSize?: number;
}

export interface ManualShopCategoryOption {
  id: number;
  name: string;
  code?: string;
}

export interface ManualUserOption {
  id: number;
  username: string;
  nickname?: string;
}

export interface ShopCategoryTaskSummary {
  shopCategoryId: number;
  shopCategoryName: string;
  distinctUserCount: number;
  distinctExtUserCount: number;
  totalOrderScore: number;
  totalNum: number;
  pendingNum: number;
  unCheckNum: number;
  checkedNum: number;
  checkErrorNum: number;
  deleteNum: number;
  secretNum: number;
  approvalRate: number;
}

export interface UserTaskSummary extends ShopCategoryTaskSummary {
  userId: number;
  username: string;
  upAccountNum: number;
}

export interface ManualTaskStatisticsOverview {
  startDate: string;
  endDate: string;
  totalNum: number;
  pendingNum: number;
  unCheckNum: number;
  checkedNum: number;
  checkErrorNum: number;
  deleteNum: number;
  secretNum: number;
  distinctUpAccountNum: number;
  shopCategoryOptions: ManualShopCategoryOption[];
  shopCategorySummaryList: ShopCategoryTaskSummary[];
  userSummaryList: UserTaskSummary[];
  userSummaryTotal: number;
  userSummaryPage: number;
  userSummaryPageSize: number;
}

export async function fetchManualTaskStatistics(query?: ManualTaskStatisticsQuery) {
  const response = await instance.get<ApiResponse<ManualTaskStatisticsOverview>>("/barry/manual-task-statistics", {
    params: query,
  });
  return unwrapApiResponse(response.data);
}

export async function fetchManualTaskStatisticUsers(keyword?: string) {
  const response = await instance.get<ApiResponse<ManualUserOption[]>>("/barry/manual-task-statistics/users", {
    params: { keyword: keyword?.trim() || undefined },
  });
  return unwrapApiResponse(response.data);
}
