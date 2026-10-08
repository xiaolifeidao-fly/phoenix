"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Dayjs } from "dayjs";
import { fetchAccountStatus, type AccountStatusRow } from "../api/reconciliation.api";
import { MANUAL_DIMENSION_MAX_DAYS } from "./useManualDimension";

/** 账户状态：期初 / 本期 / 期末欠款随所选日期变化，余额是当前值 */
export function useAccountStatus(range: [Dayjs, Dayjs]) {
  const [rows, setRows] = useState<AccountStatusRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestSeq = useRef(0);

  const startDate = range[0].format("YYYY-MM-DD");
  const endDate = range[1].format("YYYY-MM-DD");
  const days = range[1].startOf("day").diff(range[0].startOf("day"), "day") + 1;

  const refresh = useCallback(async () => {
    const seq = ++requestSeq.current;
    if (days > MANUAL_DIMENSION_MAX_DAYS) {
      setRows([]);
      setLoading(false);
      setError(`账户状态的日期区间最长 ${MANUAL_DIMENSION_MAX_DAYS} 天，请缩小范围`);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await fetchAccountStatus(startDate, endDate);
      if (seq === requestSeq.current) {
        setRows(result);
      }
    } catch (err) {
      if (seq === requestSeq.current) {
        setRows([]);
        setError(err instanceof Error ? err.message : "账户状态加载失败");
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

  return { rows, loading, error, refresh };
}
