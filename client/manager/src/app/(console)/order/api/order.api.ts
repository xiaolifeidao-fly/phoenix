"use client";

import { getPage, instance, unwrapApiResponse, type ApiResponse } from "@/utils/axios";

export class OrderRecord {
  id = 0;

  tenantId = 0;

  tenantName = "";

  shopId = 0;

  shopName = "";

  shopCategoryId = 0;

  shopCategoryName = "";

  userId = 0;

  userName = "";

  initNum = 0;

  endNum = 0;

  orderStatus = "";

  orderNum = 0;

  orderAmount = "";

  price = "";

  description = "";

  businessId = "";

  businessKey = "";

  orderHash = "";

  externalOrderId = "";

  tinyUrl = "";

  channel = "";

  orderAssignNum = 0;

  orderSubmitNum = 0;

  assignFinishTimes = 0;

  isAbnormal = false;

  exceptionReason = "";

  createdTime = "";

  updatedTime = "";
}

export class OrderAmountDetail {
  id = 0;

  orderId = 0;

  orderConsumerAmount = "";

  description = "";

  createdTime = "";
}

export interface OrderListQuery extends Record<string, string | number | boolean | undefined> {
  pageIndex?: number;
  pageSize?: number;
  orderId?: number;
  tenantId?: number;
  shopId?: number;
  shopCategoryId?: number;
  /** 多选类目，逗号分隔；为空表示查全部 */
  shopCategoryIds?: string;
  userId?: number;
  userName?: string;
  orderStatus?: string;
  /** 多选状态，逗号分隔 */
  orderStatuses?: string;
  orderHash?: string;
  businessId?: string;
  businessKey?: string;
  externalOrderId?: string;
  channel?: string;
  startTime?: string;
  endTime?: string;
  abnormalOnly?: boolean;
  /** 提交率区间（百分比，0-100） */
  submitRateMin?: number;
  submitRateMax?: number;
  /** 上量率区间（百分比，0-100） */
  growthRateMin?: number;
  growthRateMax?: number;
  /** 分发轮次区间 */
  assignFinishTimesMin?: number;
  assignFinishTimesMax?: number;
}

export const ORDER_STATUS_OPTIONS = [
  { value: "INIT", label: "待接单" },
  { value: "PENDING", label: "进行中" },
  { value: "DONE", label: "已完成" },
  { value: "UN_CHECK", label: "待审核" },
  { value: "CHECKED", label: "审核通过" },
  { value: "CHECK_ERROR", label: "审核失败" },
  { value: "UN_AUTHORIZE", label: "未授权" },
  { value: "DELETE", label: "已删除" },
  { value: "SECRET", label: "私密" },
  { value: "REFUND_PENDING", label: "退款中" },
  { value: "REFUND_HANDING", label: "退款处理中" },
  { value: "REFUND", label: "已退款" },
];

export async function fetchOrders(query: OrderListQuery) {
  return getPage(OrderRecord, "/order-records", query);
}

export async function fetchOrderAmountDetails(orderId: number) {
  return getPage(OrderAmountDetail, `/order-records/${orderId}/amount-details`, {
    pageIndex: 1,
    pageSize: 200,
  });
}

export async function refundOrder(orderId: number) {
  const response = await instance.post<ApiResponse<unknown>>(`/order-records/${orderId}/refund`);
  return unwrapApiResponse(response.data);
}

export async function batchRefundOrders(orderIds: number[]) {
  const response = await instance.post<ApiResponse<OrderActionBatchResult>>(
    "/order-record-refunds/batch",
    { orderIds },
  );
  return unwrapApiResponse(response.data);
}

/** 批量操作结果（批量退单、批量异常打标共用） */
export interface OrderActionBatchResult {
  succeeded: number;
  failed: number;
  failures: { orderId: number; message: string }[];
}

/** 异常打标：kakrolot 打标 + barry 停止分发 */
export async function markOrderException(orderId: number, reason?: string) {
  const response = await instance.post<ApiResponse<unknown>>(`/order-records/${orderId}/exception`, {
    reason: reason?.trim() || undefined,
  });
  return unwrapApiResponse(response.data);
}

export async function batchMarkOrderException(orderIds: number[], reason?: string) {
  const response = await instance.post<ApiResponse<OrderActionBatchResult>>(
    "/order-record-exceptions/batch",
    { orderIds, reason: reason?.trim() || undefined },
  );
  return unwrapApiResponse(response.data);
}

/** 强制完成：barry 停止分发 + assignment/shop 置完成 + 通知 kak */
export async function forceFinishOrders(orderIds: number[]) {
  const response = await instance.post<ApiResponse<OrderActionBatchResult>>(
    "/order-record-force-finish",
    { orderIds },
  );
  return unwrapApiResponse(response.data);
}

/** 订单实时数据：barry 现调第三方平台取当前值 */
export interface OrderRealDetail {
  extOrderId: string;
  shopInletRecordId?: number;
  shopId?: number;
  businessId?: string;
  /** 平台当前值，如当前点赞总数；-1 表示没取到 */
  nowNum: number;
  /** 实际增量 = 当前值 - 起始值；没取到当前值时为空 */
  factNum?: number;
  shopStatus?: string;
  disposeStatus?: string;
  unCheckCount: number;
  checkedCount: number;
  /** barry 调第三方失败时的原因 */
  getNowError?: string;
}

export async function fetchOrderRealDetail(orderId: number) {
  const response = await instance.get<ApiResponse<OrderRealDetail>>("/barry/order-real-detail", {
    params: { orderId },
    timeout: 30_000,
  });
  return unwrapApiResponse(response.data);
}

/** 实时数据是否可用：barry 取不到平台当前值时 nowNum 为 -1 且 factNum 为空 */
export function hasRealFactNum(detail: OrderRealDetail | null): detail is OrderRealDetail & { factNum: number } {
  return Boolean(detail) && typeof detail!.factNum === "number" && detail!.nowNum >= 0;
}

/**
 * 建议补款数量 = min(下单量, 目标增量) - 实际增量，小于 0 取 0。
 * 与老管理端前端、kakrolot RefundBatchTask.calculateBkNum 的算法保持一致。
 */
export function calculateSuggestedBkNum(order: OrderRecord, factNum: number): number {
  const targetAmount = Math.min(order.orderNum, order.endNum - order.initNum);
  const result = targetAmount - factNum;
  return result > 0 ? result : 0;
}

/** 做单人分布：barry order_record 按做单用户聚合 */
export interface OrderManualUserSummary {
  userId: number;
  username: string;
  channel?: string;
  orderNum: number;
  upAccountNum: number;
  /** 未提交数：接了单还没提交审核（PENDING） */
  pendingNum: number;
  unCheckNum: number;
  checkedNum: number;
  checkErrorNum: number;
}

/** 做单明细：barry order_record 一行 */
export interface OrderManualRecord {
  id: number;
  userId: number;
  username: string;
  uid: string;
  uidType?: string;
  channel?: string;
  orderStatus: string;
  orderScore: number;
  startNum: number;
  endNum: number;
  assignmentId?: number;
  tag?: string;
  description?: string;
  expireTime?: string;
  createdTime?: string;
  updatedTime?: string;
}

export interface OrderManualDetailPage {
  orderId: string;
  shopInletRecordId?: number;
  /** barry 商品 ID，为空表示该订单在 barry 还没有进件/商品记录 */
  shopId?: number;
  total: number;
  page: number;
  pageSize: number;
  records: OrderManualRecord[];
}

export interface OrderManualDetailQuery {
  orderId: number;
  userId?: number;
  page?: number;
  pageSize?: number;
}

/** barry order_record 的状态，与订单状态不同 */
export const ORDER_MANUAL_STATUS_LABELS: Record<string, string> = {
  PENDING: "进行中",
  UN_CHECK: "审核中",
  CHECKED: "审核成功",
  CHECK_ERROR: "审核失败",
  DELETE: "账户被封",
  SECRET: "账户设置隐私",
  UN_AUTHORIZE: "账户未授权",
};

export async function fetchOrderManualDetailUsers(orderId: number) {
  const response = await instance.get<ApiResponse<OrderManualUserSummary[]>>(
    "/barry/order-manual-details/users",
    { params: { orderId }, timeout: 30_000 },
  );
  return unwrapApiResponse(response.data) ?? [];
}

export async function fetchOrderManualDetails(query: OrderManualDetailQuery) {
  const response = await instance.get<ApiResponse<OrderManualDetailPage>>("/barry/order-manual-details", {
    params: query,
    timeout: 30_000,
  });
  return unwrapApiResponse(response.data);
}

export async function bkOrder(orderId: number, num: number) {
  const response = await instance.post<ApiResponse<unknown>>(`/order-records/${orderId}/bk`, {
    num,
  });
  return unwrapApiResponse(response.data);
}
