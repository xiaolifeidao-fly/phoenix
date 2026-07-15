"use client";

import { instance, unwrapApiResponse, type ApiResponse } from "@/utils/axios";

export interface WorkbenchDashboardStatisticsQuery {
  startDate?: string;
  endDate?: string;
  shopCategoryIds?: string;
}

export interface WorkbenchDashboardCategoryStatistics {
  shopCategoryId: number;
  categoryName: string;
  categoryCode: string;
  totalNum: number;
  pendingNum: number;
  submittedNum: number;
  completedNum: number;
  errorNum: number;
}

interface WorkbenchDashboardMetricResponse {
  startDate: string;
  endDate: string;
  value: number;
  categoryList: Array<{
    shopCategoryId: number;
    categoryName: string;
    categoryCode: string;
    value: number;
  }>;
}

export interface WorkbenchUserOverview {
  userCount: number;
  accountCount: number;
  onlineUserCount: number;
  onlineAccountCount: number;
}

export interface WorkbenchDashboardStatistics {
  startDate: string;
  endDate: string;
  totalNum: number;
  pendingNum: number;
  submittedNum: number;
  completedNum: number;
  errorNum: number;
  categoryList: WorkbenchDashboardCategoryStatistics[];
  yesterdaySubmittedNum?: number;
  submittedChange?: number;
  submittedChangeRate?: number;
}

export interface ConsumeSummary {
  amount: number;
  yesterdayAmount: number;
  amountChange: number;
  amountChangeRate: number;
  detailList: Array<{
    accountId: number;
    userId: number;
    username: string;
    remark: string;
    consumeAmount: number;
    refundAmount: number;
    bkAmount: number;
  }>;
}

export interface RechargeSummary {
  amount: number;
  yesterdayAmount: number;
  amountChange: number;
  amountChangeRate: number;
  detailList: Array<{
    accountId: number;
    userId: number;
    username: string;
    remark: string;
    rechargeAmount: number;
    givenAmount: number;
  }>;
}

export interface SystemBalanceSummary {
  amount: number;
  detailList: Array<{
    accountId: number;
    userId: number;
    username: string;
    remark: string;
    accountAmount: number;
  }>;
}

export interface ActualCompletedSummary {
  count: number;
  yesterdayCount: number;
  countChange: number;
  countChangeRate: number;
  pendingOrderCount: number;
  pendingCount: number;
  totalOrderCount: number;
  totalCount: number;
  completedOrderCount: number;
  categoryList: Array<{
    shopCategoryId: number;
    count: number;
  }>;
}

export interface ManualSubmittedComparison {
  count: number;
  yesterdayCount: number;
  countChange: number;
  countChangeRate: number;
}

// Fields are optional so the dashboard can render each metric independently as its
// own request resolves, instead of holding the whole panel until all four return.
export interface DashboardStatistics {
  todayConsume?: ConsumeSummary;
  todayRecharge?: RechargeSummary;
  systemBalance?: SystemBalanceSummary;
  actualCompleted?: ActualCompletedSummary;
  realActualCompleted?: ActualCompletedSummary;
}

export async function fetchWorkbenchDashboardStatistics(query?: WorkbenchDashboardStatisticsQuery) {
  const [remainingResponse, submittedResponse, completedResponse] = await Promise.all([
    instance.get<ApiResponse<WorkbenchDashboardMetricResponse>>("/barry/workbench-dashboard/task-remaining", { params: query }),
    instance.get<ApiResponse<WorkbenchDashboardMetricResponse>>("/barry/workbench-dashboard/manual-submitted", { params: query }),
    instance.get<ApiResponse<WorkbenchDashboardMetricResponse>>("/barry/workbench-dashboard/actual-completed", { params: query }),
  ]);
  const remaining = unwrapApiResponse(remainingResponse.data);
  const submitted = unwrapApiResponse(submittedResponse.data);
  const completed = unwrapApiResponse(completedResponse.data);
  const categories = new Map<string, WorkbenchDashboardCategoryStatistics>();

  // Seed a category row from whichever metric first mentions it, so a category that
  // only appears in one of the three breakdowns still shows up in the list.
  const ensureCategory = (metric: WorkbenchDashboardMetricResponse["categoryList"][number]) => {
    let category = categories.get(metric.categoryCode);
    if (!category) {
      category = {
        shopCategoryId: metric.shopCategoryId,
        categoryName: metric.categoryName,
        categoryCode: metric.categoryCode,
        totalNum: 0,
        pendingNum: 0,
        submittedNum: 0,
        completedNum: 0,
        errorNum: 0,
      };
      categories.set(metric.categoryCode, category);
    }
    return category;
  };

  for (const metric of remaining.categoryList) {
    ensureCategory(metric).pendingNum = metric.value;
  }
  for (const metric of submitted.categoryList) {
    ensureCategory(metric).submittedNum = metric.value;
  }
  for (const metric of completed.categoryList) {
    ensureCategory(metric).completedNum = metric.value;
  }
  return {
    startDate: remaining.startDate,
    endDate: remaining.endDate,
    totalNum: 0,
    pendingNum: remaining.value,
    submittedNum: submitted.value,
    completedNum: completed.value,
    errorNum: 0,
    categoryList: Array.from(categories.values()),
  } satisfies WorkbenchDashboardStatistics;
}

export async function fetchWorkbenchDashboardStatisticsWithComparison(query?: WorkbenchDashboardStatisticsQuery) {
  const [today, comparison] = await Promise.all([
    fetchWorkbenchDashboardStatistics(query),
    fetchManualSubmittedComparison(query),
  ]);
  return {
    ...today,
    submittedNum: comparison.count,
    yesterdaySubmittedNum: comparison.yesterdayCount,
    submittedChange: comparison.countChange,
    submittedChangeRate: comparison.countChangeRate,
  } satisfies WorkbenchDashboardStatistics;
}

export async function fetchManualSubmittedComparison(query?: Pick<WorkbenchDashboardStatisticsQuery, "shopCategoryIds">) {
  const response = await instance.get<ApiResponse<ManualSubmittedComparison>>(
    "/barry/workbench-dashboard/manual-submitted-comparison",
    { params: query },
  );
  return unwrapApiResponse(response.data);
}

// The four dashboard metrics are intentionally exposed as independent requests so
// the caller can fire and render them separately. A slow endpoint (e.g. today-consume)
// no longer blocks the other cards.
export async function fetchTodayConsume() {
  const response = await instance.get<ApiResponse<ConsumeSummary>>("/dashboard/today-consume");
  return unwrapApiResponse(response.data);
}

export async function fetchTodayRecharge() {
  const response = await instance.get<ApiResponse<RechargeSummary>>("/dashboard/today-recharge");
  return unwrapApiResponse(response.data);
}

export async function fetchSystemBalance() {
  const response = await instance.get<ApiResponse<SystemBalanceSummary>>("/dashboard/system-balance");
  return unwrapApiResponse(response.data);
}

export async function fetchActualCompleted(query?: Pick<WorkbenchDashboardStatisticsQuery, "shopCategoryIds">) {
  const response = await instance.get<ApiResponse<ActualCompletedSummary>>("/dashboard/actual-completed", { params: query });
  return unwrapApiResponse(response.data);
}

export async function fetchWorkbenchUserOverview() {
  const response = await instance.get<ApiResponse<WorkbenchUserOverview>>("/barry/workbench-dashboard/user-overview");
  return unwrapApiResponse(response.data);
}
