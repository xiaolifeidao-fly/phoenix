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

export interface OrderListQuery extends Record<string, string | number | undefined> {
  pageIndex?: number;
  pageSize?: number;
  orderId?: number;
  tenantId?: number;
  shopId?: number;
  shopCategoryId?: number;
  userId?: number;
  userName?: string;
  orderStatus?: string;
  orderHash?: string;
  businessId?: string;
  businessKey?: string;
  externalOrderId?: string;
  channel?: string;
  startTime?: string;
  endTime?: string;
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

export async function bkOrder(orderId: number, num: number) {
  const response = await instance.post<ApiResponse<unknown>>(`/order-records/${orderId}/bk`, {
    num,
  });
  return unwrapApiResponse(response.data);
}
