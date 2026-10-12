"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  fetchManualDimensionDaily,
  fetchUpstreamDimensionDaily,
  type ManualDimensionDaily,
  type UpstreamDimension,
} from "../../workbench/api/reconciliation.api";

/** 10000 积分 = 1 元 */
const POINTS_PER_RMB = 10000;

/** 一天（或合计）的做单维度利润，金额均为 RMB，口径同对账工作台「维度核算」 */
export interface DimensionProfit {
  points: number;
  unCheckNum: number;
  /** 人工预计结算 = 积分 ÷ 10000 */
  settle: number;
  payoutFee: number;
  consume: number;
  tip: number;
  /** 返点为 0 时按赠送比例估算后的值 */
  rebate: number;
  rebateEstimated: boolean;
  refund: number;
  bk: number;
  collectFee: number;
  /** 消费 − 小费 − 返点 − 退款 − 补款 − 代收手续费 */
  upstreamNet: number;
  /** 上游净额 − 人工预计结算 − 代付手续费 */
  profit: number;
  /** 利润 ÷ 上游净额，上游净额 ≤ 0 时为空 */
  profitRate: number | null;
}

/** 按天算：返点为 0 且有充值时按「消费 × 赠送 ÷ 充值」估算；代收按实际消费（消费 − 退款 − 补款）× 代收费率，代付按结算金额 × 代付费率 */
function dayProfit(manual: ManualDimensionDaily | undefined, upstream: UpstreamDimension | undefined, collectRate: number, payoutRate: number) {
  const points = manual?.points ?? 0;
  const settle = points / POINTS_PER_RMB;
  const payoutFee = settle * payoutRate;
  const consume = upstream?.consumeAmount ?? 0;
  const refund = upstream?.refundAmount ?? 0;
  const bk = upstream?.bkAmount ?? 0;
  const tip = upstream?.tipAmount ?? 0;
  const rebateEstimated = !!upstream && upstream.rebateAmount === 0 && upstream.rechargeAmount > 0;
  const rebate = rebateEstimated ? (consume * upstream.givenAmount) / upstream.rechargeAmount : (upstream?.rebateAmount ?? 0);
  const collectFee = (consume - refund - bk) * collectRate;
  const upstreamNet = consume - tip - rebate - refund - bk - collectFee;
  return withProfit({
    points,
    unCheckNum: manual?.unCheckNum ?? 0,
    settle,
    payoutFee,
    consume,
    tip,
    rebate,
    rebateEstimated,
    refund,
    bk,
    collectFee,
    upstreamNet,
  });
}

function withProfit(item: Omit<DimensionProfit, "profit" | "profitRate">): DimensionProfit {
  const profit = item.upstreamNet - item.settle - item.payoutFee;
  return { ...item, profit, profitRate: item.upstreamNet > 0 ? profit / item.upstreamNet : null };
}

/** 合计 = 各天之和（返点估算也按天各自估再相加） */
function sumProfits(items: DimensionProfit[]): DimensionProfit {
  const sum = (pick: (item: DimensionProfit) => number) => items.reduce((total, item) => total + pick(item), 0);
  return withProfit({
    points: sum((item) => item.points),
    unCheckNum: sum((item) => item.unCheckNum),
    settle: sum((item) => item.settle),
    payoutFee: sum((item) => item.payoutFee),
    consume: sum((item) => item.consume),
    tip: sum((item) => item.tip),
    rebate: sum((item) => item.rebate),
    rebateEstimated: items.some((item) => item.rebateEstimated),
    refund: sum((item) => item.refund),
    bk: sum((item) => item.bk),
    collectFee: sum((item) => item.collectFee),
    upstreamNet: sum((item) => item.upstreamNet),
  });
}

/** 人工记账里按日历日展示做单维度利润：人工维度、上游维度各取一次按天数据 */
export function useDimensionDaily(startDate: string | undefined, endDate: string | undefined, collectRate: number, payoutRate: number) {
  const [manual, setManual] = useState<ManualDimensionDaily[]>([]);
  const [upstream, setUpstream] = useState<UpstreamDimension[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestSeq = useRef(0);

  const refresh = useCallback(async () => {
    const seq = ++requestSeq.current;
    if (!startDate || !endDate) {
      setManual([]);
      setUpstream([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [manualDays, upstreamDays] = await Promise.all([
        fetchManualDimensionDaily(startDate, endDate),
        fetchUpstreamDimensionDaily(startDate, endDate),
      ]);
      if (seq === requestSeq.current) {
        setManual(manualDays);
        setUpstream(upstreamDays);
      }
    } catch (err) {
      if (seq === requestSeq.current) {
        setManual([]);
        setUpstream([]);
        setError(err instanceof Error ? err.message : "做单维度加载失败");
      }
    } finally {
      if (seq === requestSeq.current) {
        setLoading(false);
      }
    }
  }, [startDate, endDate]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const { byDate, total } = useMemo(() => {
    const manualByDate = new Map(manual.map((item) => [item.date, item]));
    const upstreamByDate = new Map(upstream.map((item) => [item.startDate, item]));
    const dates = Array.from(new Set([...manual.map((item) => item.date), ...upstream.map((item) => item.startDate)]));
    const result = new Map<string, DimensionProfit>();
    const items = dates.map((date) => {
      const item = dayProfit(manualByDate.get(date), upstreamByDate.get(date), collectRate, payoutRate);
      result.set(date, item);
      return item;
    });
    return { byDate: result, total: items.length ? sumProfits(items) : null };
  }, [manual, upstream, collectRate, payoutRate]);

  return { byDate, total, loading, error, refresh };
}
