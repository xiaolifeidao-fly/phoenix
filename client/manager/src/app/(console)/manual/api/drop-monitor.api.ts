"use client";

import { instance, unwrapApiResponse, type ApiResponse } from "@/utils/axios";

export interface DropMonitorQuery {
  startDate?: string;
  endDate?: string;
  shopCategoryIds?: string;
  oriShopId?: string;
  businessId?: string;
  status?: string;
  /** 只看发生过掉量的 */
  onlyDropped?: boolean;
  pageIndex?: number;
  pageSize?: number;
}

/** 掉量监控概览。不开自动补单也有数据 —— 灰度期就靠它定首检延迟与收档次数。 */
export interface DropMonitorSummary {
  totalNum: number;
  dropOrderNum: number;
  dropCheckNum: number;
  /** 掉量率，百分比 */
  dropRate: number;
  repairOrderNum: number;
  repairTotalNum: number;
  /** 掉了但没补（未开补单或被守卫拦下） */
  dropNotRepairedNum: number;
  monitoringNum: number;
  stableEndNum: number;
  supersededNum: number;
  invalidNum: number;
  errorNum: number;
  /** 首次掉量距完成的平均时长（分钟） */
  avgFirstDropMinute: number;
  checkTimesNum: number;
}

export interface DropMonitorDetail {
  id: number;
  shopId: number;
  shopCategoryId: number;
  shopCategoryName: string;
  oriShopId: string;
  businessId: string;
  startNum: number;
  totalNum: number;
  baselineNum: number;
  finishTime: string;
  expireTime: string;
  nextCheckTime: string;
  lastCheckTime: string;
  lastNum: number;
  minNum: number;
  checkTimes: number;
  continuousNormalTimes: number;
  failTimes: number;
  dropTimes: number;
  maxDropNum: number;
  lastDropNum: number;
  firstDropTime: string;
  repairTimes: number;
  repairTotalNum: number;
  status: string;
  remark: string;
}

export interface DropMonitorDetailPage {
  total: number;
  data: DropMonitorDetail[];
}

export interface DropMonitorRecord {
  id: number;
  shopDropMonitorId: number;
  round: number;
  checkTime: string;
  baselineNum: number;
  nowNum: number;
  dropNum: number;
  checkResult: string;
  costMs: number;
  message: string;
}

export async function fetchDropMonitorSummary(query: DropMonitorQuery) {
  const response = await instance.get<ApiResponse<DropMonitorSummary | null>>("/barry/drop-monitor-summary", {
    params: query,
  });
  return unwrapApiResponse(response.data);
}

export async function fetchDropMonitorDetails(query: DropMonitorQuery) {
  const response = await instance.get<ApiResponse<DropMonitorDetailPage | null>>("/barry/drop-monitor-details", {
    params: query,
  });
  return unwrapApiResponse(response.data);
}

export async function fetchDropMonitorRecords(monitorId: number) {
  const response = await instance.get<ApiResponse<DropMonitorRecord[] | null>>("/barry/drop-monitor-records", {
    params: { monitorId },
  });
  return unwrapApiResponse(response.data) ?? [];
}

export const DROP_MONITOR_STATUS_OPTIONS = [
  { label: "等待检测", value: "WAITING" },
  { label: "已投队列", value: "QUEUED" },
  { label: "检测中", value: "CHECKING" },
  { label: "有效期结束", value: "EXPIRE" },
  { label: "掉量后结束", value: "DROP_END" },
  { label: "稳定提前收档", value: "STABLE_END" },
  { label: "链接失效", value: "INVALID" },
  { label: "采集异常", value: "ERROR" },
  { label: "续单取代", value: "SUPERSEDED" },
  { label: "人工关档", value: "CLOSED" },
];

export const DROP_CHECK_RESULT_LABEL: Record<string, string> = {
  NORMAL: "正常",
  DROP: "掉量",
  SUSPECT: "可疑",
  FAIL: "采集失败",
  TIMEOUT: "采集超时",
  INVALID: "链接失效",
};

/** 运行健康度：任务在不在跑、跑不跑得过来、有没有丢消息 */
export interface DropMonitorRuntime {
  /** 待检测积压，持续大于每轮 fetch.num 说明产能不够 */
  backlogNum: number;
  /** 已投队列却迟迟没被消费，持续大于 0 说明消费跟不上或消息在丢 */
  stuckQueuedNum: number;
  /** 租约已过期还没被回收，正常恒为 0 */
  zombieNum: number;
  checkingNum: number;
  nodes: { ownerNode: string; checkingNum: number }[];
  /** 定时任务最近一次跑的时刻 —— "在不在跑"最直接的信号 */
  lastJobRunTime: string;
  lastJobNode: string;
  recentJobRuns: number;
  recentDispatchSubmitted: number;
  recentRequeueSubmitted: number;
  recentRecycled: number;
  recentJobErrors: number;
}

export interface DropMonitorJobRecord {
  id: number;
  node: string;
  runTime: string;
  costMs: number;
  dispatchFetched: number;
  dispatchMarked: number;
  dispatchSubmitted: number;
  requeueFetched: number;
  requeueSubmitted: number;
  recycled: number;
  repairFilled: number;
  errorMessage: string;
}

export interface DropMonitorJobRecordPage {
  total: number;
  data: DropMonitorJobRecord[];
}

export async function fetchDropMonitorRuntime() {
  const response = await instance.get<ApiResponse<DropMonitorRuntime | null>>("/barry/drop-monitor-runtime");
  return unwrapApiResponse(response.data);
}

export async function fetchDropMonitorJobRecords(query: {
  startDate?: string;
  endDate?: string;
  pageIndex?: number;
  pageSize?: number;
}) {
  const response = await instance.get<ApiResponse<DropMonitorJobRecordPage | null>>("/barry/drop-monitor-job-records", {
    params: query,
  });
  return unwrapApiResponse(response.data);
}
