"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Dayjs } from "dayjs";
import { fetchDebtCompare, type DebtCompare } from "../api/manual-book.api";
import { MANUAL_DIMENSION_MAX_DAYS } from "../../workbench/hooks/useManualDimension";

/** 欠款核对：每个上游社区的系统应收 vs 人工应收 */
export function useDebtCompare(range: [Dayjs, Dayjs]) {
  const [data, setData] = useState<DebtCompare | null>(null);
  const [loading, setLoading] = useState(false);
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
      setError(`欠款核对的日期区间最长 ${MANUAL_DIMENSION_MAX_DAYS} 天，请缩小范围`);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await fetchDebtCompare(startDate, endDate);
      if (seq === requestSeq.current) {
        setData(result);
      }
    } catch (err) {
      if (seq === requestSeq.current) {
        setData(null);
        setError(err instanceof Error ? err.message : "欠款核对加载失败");
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

  return { data, loading, error, refresh };
}

export type DebtCompareState = ReturnType<typeof useDebtCompare>;
