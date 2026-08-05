"use client";

import { useEffect, useState } from "react";
import {
  batchMarkOrderException,
  batchRefundOrders,
  bkOrder,
  fetchOrders,
  forceFinishOrders,
  markOrderException,
  refundOrder,
  type OrderActionBatchResult,
  type OrderListQuery,
  type OrderRecord,
} from "../api/order.api";

const defaultQuery: Required<Pick<OrderListQuery, "pageIndex" | "pageSize">> & OrderListQuery = {
  pageIndex: 1,
  pageSize: 10,
};

export function useOrderManagement(loadOnMount = true) {
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [total, setTotal] = useState(0);
  const [query, setQuery] = useState<OrderListQuery>(defaultQuery);

  const refresh = async (nextQuery?: Partial<OrderListQuery>) => {
    const mergedQuery = { ...query, ...nextQuery };
    setLoading(true);
    try {
      const result = await fetchOrders(mergedQuery);
      setOrders(result.data);
      setTotal(result.total);
      setQuery(mergedQuery);
    } finally {
      setLoading(false);
    }
  };

  const doRefund = async (orderId: number) => {
    setSubmitting(true);
    try {
      await refundOrder(orderId);
      await refresh();
    } finally {
      setSubmitting(false);
    }
  };

  const doBatchRefund = async (orderIds: number[]): Promise<OrderActionBatchResult> => {
    setSubmitting(true);
    try {
      const result = await batchRefundOrders(orderIds);
      if (result.succeeded > 0) {
        await refresh();
      }
      return result;
    } finally {
      setSubmitting(false);
    }
  };

  const doMarkException = async (orderId: number, reason?: string) => {
    setSubmitting(true);
    try {
      await markOrderException(orderId, reason);
      await refresh();
    } finally {
      setSubmitting(false);
    }
  };

  const doBatchMarkException = async (
    orderIds: number[],
    reason?: string,
  ): Promise<OrderActionBatchResult> => {
    setSubmitting(true);
    try {
      const result = await batchMarkOrderException(orderIds, reason);
      if (result.succeeded > 0) {
        await refresh();
      }
      return result;
    } finally {
      setSubmitting(false);
    }
  };

  const doForceFinish = async (orderIds: number[]): Promise<OrderActionBatchResult> => {
    setSubmitting(true);
    try {
      const result = await forceFinishOrders(orderIds);
      if (result.succeeded > 0) {
        await refresh();
      }
      return result;
    } finally {
      setSubmitting(false);
    }
  };

  const doBk = async (orderId: number, num: number) => {
    setSubmitting(true);
    try {
      await bkOrder(orderId, num);
      await refresh();
    } finally {
      setSubmitting(false);
    }
  };

  const clear = () => {
    setOrders([]);
    setTotal(0);
    setQuery(defaultQuery);
  };

  useEffect(() => {
    if (loadOnMount) {
      void refresh();
    }
  }, [loadOnMount]);

  return {
    orders,
    total,
    query,
    loading,
    submitting,
    refresh,
    clear,
    doRefund,
    doBatchRefund,
    doBk,
    doMarkException,
    doBatchMarkException,
    doForceFinish,
  };
}
