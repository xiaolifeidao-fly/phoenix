"use client";

import { instance, unwrapApiResponse, type ApiResponse } from "@/utils/axios";

export interface ManualTaskStatisticsQuery {
  startDate?: string;
  endDate?: string;
  shopGroupId?: number;
  keyword?: string;
}

export interface ManualTaskStatisticsGroupOption {
  id: number;
  name: string;
  businessType?: string;
  businessCode?: string;
  dashboardSort?: number;
}

export interface ManualTaskStatisticsDetail {
  shopGroupId: number;
  name: string;
  businessType?: string;
  businessCode?: string;
  totalNum: number;
  pendingNum: number;
  waitNum: number;
  doneNum: number;
  errorNum: number;
  completionRate: number;
  completionCount: number;
}

export interface ManualTaskStatisticsOverview {
  startDate: string;
  endDate: string;
  totalNum: number;
  pendingNum: number;
  waitNum: number;
  doneNum: number;
  errorNum: number;
  groupCount: number;
  detailList: ManualTaskStatisticsDetail[];
  groupOptions: ManualTaskStatisticsGroupOption[];
}

export async function fetchManualTaskStatistics(query?: ManualTaskStatisticsQuery) {
  const response = await instance.get<ApiResponse<ManualTaskStatisticsOverview>>("/barry/manual-task-statistics", {
    params: query,
  });
  return unwrapApiResponse(response.data);
}
