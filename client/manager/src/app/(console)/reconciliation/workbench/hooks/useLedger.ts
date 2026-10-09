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
  /**
   * 卡片内再按日期筛选：只能落在工作台区间之内，汇总和明细都按它查；为空时跟随工作台区间。
   * 工作台换区间时清空。
   */
  dateRange?: [Dayjs, Dayjs];
  recordType?: LedgerRecordType;
  /** 类目多选 */
  categories: string[];
  sortField?: LedgerSortField;
  sortOrder?: "asc" | "desc";
  page: number;
  pageSize: number;
}

const defaultFilters: LedgerFilters = { categories: [], page: 1, pageSize: 20 };

/** 出入账：汇总 + 明细分页。日期默认跟随工作台，卡片内可再缩小（filters.dateRange） */
export function useLedger(range: [Dayjs, Dayjs]) {
  /** 卡片用：按筛选后的日期 */
  const [summary, setSummary] = useState<ReconLedgerSummary | null>(null);
  /** 顶部概览用：始终是工作台整个区间，不受卡片内日期筛选影响 */
  const [overallSummary, setOverallSummary] = useState<ReconLedgerSummary | null>(null);
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
  const filterStart = filters.dateRange?.[0].format("YYYY-MM-DD");
  const filterEnd = filters.dateRange?.[1].format("YYYY-MM-DD");
  /** 卡片内筛选的日期，夹在工作台区间之内；和工作台区间不相交时（刚换完区间）按工作台区间 */
  const clampedStart = filterStart && filterStart > startDate ? filterStart : startDate;
  const clampedEnd = filterEnd && filterEnd < endDate ? filterEnd : endDate;
  const [queryStart, queryEnd] = clampedStart <= clampedEnd ? [clampedStart, clampedEnd] : [startDate, endDate];
  const narrowed = queryStart !== startDate || queryEnd !== endDate;

  const refresh = useCallback(async () => {
    const seq = ++requestSeq.current;
    if (days > MANUAL_DIMENSION_MAX_DAYS) {
      setSummary(null);
      setOverallSummary(null);
      setRows([]);
      setTotal(0);
      setLoading(false);
      setError(`出入账的日期区间最长 ${MANUAL_DIMENSION_MAX_DAYS} 天，请缩小范围`);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [nextSummary, nextOverall, page] = await Promise.all([
        fetchLedgerSummary(queryStart, queryEnd),
        // 没缩小日期时两份汇总是同一个区间，不重复请求
        narrowed ? fetchLedgerSummary(startDate, endDate) : Promise.resolve(null),
        fetchLedgerPage({
          startDate: queryStart,
          endDate: queryEnd,
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
        setOverallSummary(nextOverall ?? nextSummary);
        setRows(page.data ?? []);
        setTotal(page.total ?? 0);
      }
    } catch (err) {
      if (seq === requestSeq.current) {
        setSummary(null);
        setOverallSummary(null);
        setRows([]);
        setTotal(0);
        setError(err instanceof Error ? err.message : "出入账加载失败");
      }
    } finally {
      if (seq === requestSeq.current) {
        setLoading(false);
      }
    }
  }, [startDate, endDate, queryStart, queryEnd, narrowed, days, filters]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // 工作台换日期：清掉卡片内的日期筛选，回到第一页
  useEffect(() => {
    setFilters((current) =>
      current.page === 1 && !current.dateRange ? current : { ...current, dateRange: undefined, page: 1 },
    );
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
    overallSummary,
    /** 当前实际查询的日期（卡片内筛选后） */
    queryStart,
    queryEnd,
    narrowed,
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
