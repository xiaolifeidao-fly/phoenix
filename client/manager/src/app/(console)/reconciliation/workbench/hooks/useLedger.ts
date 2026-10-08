"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Dayjs } from "dayjs";
import {
  deleteLedger,
  fetchLedgerPage,
  fetchLedgerSummary,
  saveLedger,
  syncLedgerWithdraw,
  type LedgerRecordType,
  type LedgerSortField,
  type ReconLedgerPayload,
  type ReconLedgerRecord,
  type ReconLedgerSummary,
} from "../api/reconciliation.api";
import { MANUAL_DIMENSION_MAX_DAYS } from "./useManualDimension";

export interface LedgerFilters {
  recordType?: LedgerRecordType;
  /** 类目多选 */
  categories: string[];
  sortField?: LedgerSortField;
  sortOrder?: "asc" | "desc";
  page: number;
  pageSize: number;
}

const defaultFilters: LedgerFilters = { categories: [], page: 1, pageSize: 20 };

/** 出入账：汇总 + 明细分页，日期区间与工作台一致 */
export function useLedger(range: [Dayjs, Dayjs]) {
  const [summary, setSummary] = useState<ReconLedgerSummary | null>(null);
  const [rows, setRows] = useState<ReconLedgerRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [filters, setFilters] = useState<LedgerFilters>(defaultFilters);
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
      setSummary(null);
      setRows([]);
      setTotal(0);
      setLoading(false);
      setError(`出入账的日期区间最长 ${MANUAL_DIMENSION_MAX_DAYS} 天，请缩小范围`);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [nextSummary, page] = await Promise.all([
        fetchLedgerSummary(startDate, endDate),
        fetchLedgerPage({
          startDate,
          endDate,
          recordType: filters.recordType,
          category: filters.categories.length ? filters.categories.join(",") : undefined,
          sortField: filters.sortField,
          sortOrder: filters.sortOrder,
          page: filters.page,
          pageSize: filters.pageSize,
        }),
      ]);
      if (seq === requestSeq.current) {
        setSummary(nextSummary);
        setRows(page.data ?? []);
        setTotal(page.total ?? 0);
      }
    } catch (err) {
      if (seq === requestSeq.current) {
        setSummary(null);
        setRows([]);
        setTotal(0);
        setError(err instanceof Error ? err.message : "出入账加载失败");
      }
    } finally {
      if (seq === requestSeq.current) {
        setLoading(false);
      }
    }
  }, [startDate, endDate, days, filters]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // 换日期回到第一页
  useEffect(() => {
    setFilters((current) => (current.page === 1 ? current : { ...current, page: 1 }));
  }, [startDate, endDate]);

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
    summary,
    rows,
    total,
    filters,
    setFilters,
    loading,
    submitting,
    error,
    refresh,
    save: (id: number | null, payload: ReconLedgerPayload) => runMutation(() => saveLedger(id, payload)),
    remove: (id: number) => runMutation(() => deleteLedger(id)),
    syncWithdraw: () => runMutation(() => syncLedgerWithdraw(startDate, endDate)),
  };
}

export type LedgerState = ReturnType<typeof useLedger>;
