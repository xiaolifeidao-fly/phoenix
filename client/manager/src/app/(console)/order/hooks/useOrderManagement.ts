"use client";

import { useEffect, useState } from "react";
import {
  bkOrder,
  fetchOrders,
  refundOrder,
  type OrderListQuery,
  type OrderRecord,
} from "../api/order.api";

const defaultQuery: Required<Pick<OrderListQuery, "pageIndex" | "pageSize">> & OrderListQuery = {
  pageIndex: 1,
  pageSize: 10,
};

export function useOrderManagement() {
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

  const doBk = async (orderId: number, num: number) => {
    setSubmitting(true);
    try {
      await bkOrder(orderId, num);
      await refresh();
    } finally {
      setSubmitting(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  return {
    orders,
    total,
    query,
    loading,
    submitting,
    refresh,
    doRefund,
    doBk,
  };
}
