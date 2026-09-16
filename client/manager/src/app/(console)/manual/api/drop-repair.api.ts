"use client";

import { instance, unwrapApiResponse, type ApiResponse } from "@/utils/axios";

export interface DropRepairQuery {
  startDate?: string;
  endDate?: string;
  /** 人工商品ID, 逗号分隔; 空=全部 */
  shopCategoryIds?: string;
  oriShopId?: string;
  businessId?: string;
  status?: string;
  pageIndex?: number;
  pageSize?: number;
}

/**
 * 补单数据概览.
 * 成本双口径: planCost 下发即确定, actualCost 随补单完成回填 —— 补单可能完不成也可能超额,
 * 只给一个数必然引起口径争议.
 */
export interface DropRepairSummary {
  /** 发生补单的单数 */
  repairOrderNum: number;
  /** 补单总量 */
  repairTotalNum: number;
  /** 预估成本 */
  planCost: number;
  /** 实付成本 */
  actualCost: number;
  /** 补单实际完成量 */
  finishNum: number;
}

export interface DropRepairDetail {
  id: number;
  shopDropMonitorId: number;
  round: number;
  originShopId: number;
  originOriShopId: string;
  businessId: string;
  shopCategoryId: number;
  shopCategoryName: string;
  shopTypeId: number;
  repairShopId: number;
  repairOriShopId: string;
  dropNum: number;
  repairNum: number;
  unitScore: number;
  planCost: number;
  actualCost: number;
  finishNum: number;
  status: string;
  repairTime: string;
  finishTime: string;
  remark: string;
}

export interface DropRepairDetailPage {
  total: number;
  data: DropRepairDetail[];
}

export async function fetchDropRepairSummary(query: DropRepairQuery) {
  const response = await instance.get<ApiResponse<DropRepairSummary | null>>("/barry/drop-repair-summary", {
    params: query,
  });
  return unwrapApiResponse(response.data);
}

export async function fetchDropRepairDetails(query: DropRepairQuery) {
  const response = await instance.get<ApiResponse<DropRepairDetailPage | null>>("/barry/drop-repair-details", {
    params: query,
  });
  return unwrapApiResponse(response.data);
}

export const DROP_REPAIR_STATUS_OPTIONS = [
  { label: "已建单", value: "INIT" },
  { label: "分发中", value: "ASSIGNING" },
  { label: "已完成", value: "DONE" },
  { label: "失败", value: "FAIL" },
  { label: "已过期", value: "EXPIRE" },
];
