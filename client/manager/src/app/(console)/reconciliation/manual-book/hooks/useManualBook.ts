"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Dayjs } from "dayjs";
import {
  deleteManualBook,
  fetchManualBookCompare,
  saveManualBook,
  type ManualBookCompare,
  type ManualBookPayload,
} from "../api/manual-book.api";
import { MANUAL_DIMENSION_MAX_DAYS } from "../../workbench/hooks/useManualDimension";

/** 人工记账：区间内每天的记账，以及和出入账的利润对比（总的 + 每天） */
export function useManualBook(range: [Dayjs, Dayjs]) {
  const [data, setData] = useState<ManualBookCompare | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestSeq = useRef(0);

  const startDate = range[0].format("YYYY-MM-DD");
  const endDate = range[1].format("YYYY-MM-DD");
  const days = range[1].startOf("day").diff(range[0].startOf("day"), "day") + 1;

  const refresh = useCallback(async () => {
    const seq = ++requestSeq.current;
    if (days > MANUAL_DIMENSION_MAX_DAYS) {
      setData(null);
      setLoading(false);
      setError(`人工记账的日期区间最长 ${MANUAL_DIMENSION_MAX_DAYS} 天，请缩小范围`);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await fetchManualBookCompare(startDate, endDate);
      if (seq === requestSeq.current) {
        setData(result);
      }
    } catch (err) {
      if (seq === requestSeq.current) {
        setData(null);
        setError(err instanceof Error ? err.message : "人工记账加载失败");
      }
    } finally {
      if (seq === requestSeq.current) {
        setLoading(false);
      }
    }
  }, [startDate, endDate, days]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const runMutation = async <T,>(action: () => Promise<T>) => {
    setSubmitting(true);
    try {
      const result = await action();
      await refresh();
      return result;
    } finally {
      setSubmitting(false);
    }
  };

  return {
    data,
    loading,
    submitting,
    error,
    refresh,
    save: (id: number | null, payload: ManualBookPayload) => runMutation(() => saveManualBook(id, payload)),
    remove: (id: number) => runMutation(() => deleteManualBook(id)),
  };
}

export type ManualBookState = ReturnType<typeof useManualBook>;
