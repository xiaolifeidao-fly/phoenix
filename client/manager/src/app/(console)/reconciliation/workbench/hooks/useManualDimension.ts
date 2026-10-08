"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Dayjs } from "dayjs";
import { fetchManualDimension, type ReconManualDimension } from "../api/reconciliation.api";

/** 与 barry 侧校验保持一致，超出时不发请求 */
export const MANUAL_DIMENSION_MAX_DAYS = 93;

export function useManualDimension(range: [Dayjs, Dayjs]) {
  const [data, setData] = useState<ReconManualDimension | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // 快速切换日期时只认最后一次请求，避免旧结果覆盖新结果
  const requestSeq = useRef(0);

  const startDate = range[0].format("YYYY-MM-DD");
  const endDate = range[1].format("YYYY-MM-DD");
  const days = range[1].startOf("day").diff(range[0].startOf("day"), "day") + 1;

  const refresh = useCallback(async () => {
    const seq = ++requestSeq.current;
    if (days > MANUAL_DIMENSION_MAX_DAYS) {
      setData(null);
      setLoading(false);
      setError(`人工维度的日期区间最长 ${MANUAL_DIMENSION_MAX_DAYS} 天，请缩小范围`);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await fetchManualDimension(startDate, endDate);
      if (seq === requestSeq.current) {
        setData(result);
      }
    } catch (err) {
      if (seq === requestSeq.current) {
        setData(null);
        setError(err instanceof Error ? err.message : "人工维度加载失败");
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
