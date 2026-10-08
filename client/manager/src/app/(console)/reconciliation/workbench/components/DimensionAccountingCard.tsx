"use client";

import { useMemo } from "react";
import { Alert, Button, Table, Tag, Tooltip } from "antd";
import type { ColumnsType } from "antd/es/table";
import type { ReconManualDimension, UpstreamDimension } from "../api/reconciliation.api";
import { FormulaGrid, MoneyCell, SectionHead, money, moneyColumn } from "./shared";

interface DimensionAccountingCardProps {
  manualDimension: ReconManualDimension | null;
  manualLoading: boolean;
  manualError: string | null;
  onManualRetry: () => void;
  upstream: UpstreamDimension | null;
  upstreamLoading: boolean;
  upstreamError: string | null;
  onUpstreamRetry: () => void;
}

/** 人工维度一行：合计行带积分，商品行积分为空（积分日汇总不分商品） */
interface ManualDimensionRow {
  key: string;
  name: string;
  taskNum: number;
  unCheckNum: number;
  points: number | null;
  total?: boolean;
}

const manualColumns: ColumnsType<ManualDimensionRow> = [
  { title: "类目", dataIndex: "name", width: 140, fixed: "left", render: (value: string) => <span className="recon-row-name">{value}</span> },
  moneyColumn<ManualDimensionRow>("任务数量", "taskNum", 110),
  {
    title: "待审核数量",
    dataIndex: "unCheckNum",
    width: 110,
    align: "right",
    render: (value: number) =>
      value > 0 ? (
        <Tag color="gold" style={{ marginInlineEnd: 0 }}>
          {money(value)}
        </Tag>
      ) : (
        <MoneyCell value={value} />
      ),
  },
  {
    title: "积分数量",
    dataIndex: "points",
    width: 120,
    align: "right",
    render: (value: number | null) =>
      value === null ? (
        <Tooltip title="积分日汇总按用户和做单日期统计，不分人工商品">
          <span className="recon-subcard-caption">—</span>
        </Tooltip>
      ) : (
        <MoneyCell value={value} />
      ),
  },
];

/** 上游维度一行：只展示充值 / 赠送 / 消费 / 返点 / 小费，金额为 RMB */
interface UpstreamRow {
  key: string;
  name: string;
  amount: number;
  /** 悬停说明口径和拆分 */
  detail: string;
}

const upstreamColumns: ColumnsType<UpstreamRow> = [
  { title: "类目", dataIndex: "name", width: 120, fixed: "left", render: (value: string) => <span className="recon-row-name">{value}</span> },
  {
    title: "金额（RMB）",
    dataIndex: "amount",
    width: 140,
    align: "right",
    render: (value: number, row) => (
      <Tooltip title={row.detail}>
        <span>
          <MoneyCell value={value} />
        </span>
      </Tooltip>
    ),
  },
];

const formulas = [
  { label: "返点 / 小费", expression: "下单数量 × 类目单位金额 − 退单数量 × 类目单位金额" },
  { label: "人工预计结算金额", expression: "预计结算积分 ÷ 10000（本人做单积分 + 徒弟奖励积分；待审核任务审核后可能还会增加）" },
  { label: "利润", expression: "上游消费 − 小费 − 返点 − 退款 − 补款 − 人工预计结算金额" },
];

/** 10000 积分 = 1 元 */
const POINTS_PER_RMB = 10000;

export function DimensionAccountingCard({
  manualDimension,
  manualLoading,
  manualError,
  onManualRetry,
  upstream,
  upstreamLoading,
  upstreamError,
  onUpstreamRetry,
}: DimensionAccountingCardProps) {
  const manualRows = useMemo<ManualDimensionRow[]>(() => {
    if (!manualDimension) {
      return [];
    }
    return [
      {
        key: "total",
        name: "合计",
        taskNum: manualDimension.taskNum,
        unCheckNum: manualDimension.unCheckNum,
        points: manualDimension.points,
        total: true,
      },
      ...manualDimension.shopCategoryList.map((item) => ({
        key: `category-${item.shopCategoryId}`,
        name: item.shopCategoryName,
        taskNum: item.taskNum,
        unCheckNum: item.unCheckNum,
        points: null,
      })),
    ];
  }, [manualDimension]);

  const upstreamRows = useMemo<UpstreamRow[]>(() => {
    if (!upstream) {
      return [];
    }
    return [
      { key: "recharge", name: "充值金额", amount: upstream.rechargeAmount, detail: "账户流水「充值」合计" },
      { key: "given", name: "赠送金额", amount: upstream.givenAmount, detail: "账户流水「赠送」合计" },
      { key: "consume", name: "消费金额", amount: upstream.consumeAmount, detail: "账户流水「消费」合计（毛额，不扣退款、补款）" },
      {
        key: "rebate",
        name: "返点金额",
        amount: upstream.rebateAmount,
        detail: `下单 ${money(upstream.orderNum)} 个 ${money(upstream.orderRebate)} − 退单 ${money(upstream.refundNum)} 个 ${money(upstream.refundRebate)}`,
      },
      {
        key: "tip",
        name: "小费金额",
        amount: upstream.tipAmount,
        detail: `下单 ${money(upstream.orderNum)} 个 ${money(upstream.orderTip)} − 退单 ${money(upstream.refundNum)} 个 ${money(upstream.refundTip)}`,
      },
      { key: "refund", name: "退款金额", amount: upstream.refundAmount, detail: "账户流水「退货」合计" },
      { key: "bk", name: "补款金额", amount: upstream.bkAmount, detail: "账户流水「补款」合计" },
    ];
  }, [upstream]);

  // 利润 = 上游消费 − 小费 − 返点 − 退款 − 补款 − 人工预计结算金额，统一按 RMB
  const upstreamNet =
    (upstream?.consumeAmount ?? 0) -
    (upstream?.tipAmount ?? 0) -
    (upstream?.rebateAmount ?? 0) -
    (upstream?.refundAmount ?? 0) -
    (upstream?.bkAmount ?? 0);
  const manualPoints = manualDimension?.points ?? 0;
  const manualSettleRmb = manualPoints / POINTS_PER_RMB;
  const unCheckNum = manualDimension?.unCheckNum ?? 0;
  const systemCalc: { label: string; value: number; unit: string; sub?: string; note?: string; highlight?: boolean }[] = [
    {
      label: "人工预计结算金额",
      value: manualSettleRmb,
      unit: "RMB",
      sub: `预计结算积分 ${money(manualPoints)}`,
      note: unCheckNum > 0 ? `还有 ${money(unCheckNum)} 个任务未审核` : undefined,
    },
    {
      label: "上游净额",
      value: upstreamNet,
      unit: "RMB",
      sub: "消费 − 小费 − 返点 − 退款 − 补款",
    },
    { label: "总计利润", value: upstreamNet - manualSettleRmb, unit: "RMB", highlight: true },
  ];

  return (
    <section className="manager-data-card recon-card">
      <SectionHead
        title="维度核算"
        caption="人工维度与上游维度合并展示，做单维度利润在两个维度下方统一呈现"
        extra={<Tag className="recon-readonly-tag">只读</Tag>}
      />

      <div className="recon-dimension-grid">
        <div className="recon-subcard">
          <div className="recon-subcard-head">
            <span className="recon-subcard-title">人工维度</span>
            <span className="recon-subcard-caption">
              {manualDimension
                ? `做单积分 ${money(manualDimension.taskPoints)} · 徒弟奖励 ${money(manualDimension.childrenPoints)}`
                : "任务数量按人工商品拆分，积分只有合计"}
            </span>
          </div>
          {manualError ? (
            <Alert
              type="error"
              showIcon
              message={manualError}
              action={
                <Button size="small" onClick={onManualRetry}>
                  重试
                </Button>
              }
            />
          ) : null}
          <Table<ManualDimensionRow>
            className="recon-table"
            rowKey="key"
            size="small"
            loading={manualLoading}
            columns={manualColumns}
            dataSource={manualRows}
            pagination={false}
            scroll={{ x: 480 }}
            rowClassName={(row) => (row.total ? "recon-row-total" : "")}
          />
        </div>

        <div className="recon-subcard">
          <div className="recon-subcard-head">
            <span className="recon-subcard-title">上游维度</span>
            <span className="recon-subcard-caption">金额为 RMB，悬停金额看拆分</span>
          </div>
          {upstreamError ? (
            <Alert
              type="error"
              showIcon
              message={upstreamError}
              action={
                <Button size="small" onClick={onUpstreamRetry}>
                  重试
                </Button>
              }
            />
          ) : null}
          <Table<UpstreamRow>
            className="recon-table"
            rowKey="key"
            size="small"
            loading={upstreamLoading}
            columns={upstreamColumns}
            dataSource={upstreamRows}
            pagination={false}
            scroll={{ x: 260 }}
          />
        </div>
      </div>

      <div className="recon-calc-strip">
        <div className="recon-calc-strip-title">做单维度利润</div>
        <div className="recon-calc-grid">
          {systemCalc.map((item) => (
            <div
              className={item.highlight ? "recon-calc-item recon-calc-item--highlight" : "recon-calc-item"}
              key={item.label}
            >
              <span className="recon-calc-label">
                {item.label}
                {item.sub ? <span className="recon-subcard-caption" style={{ marginInlineStart: 8 }}>{item.sub}</span> : null}
                {item.note ? (
                  <Tag color="gold" style={{ marginInlineStart: 8 }}>
                    {item.note}
                  </Tag>
                ) : null}
              </span>
              <span className="recon-calc-value">
                <MoneyCell value={item.value} />
                <em className="recon-calc-unit">{item.unit}</em>
              </span>
            </div>
          ))}
        </div>
      </div>

      <FormulaGrid items={formulas} />
    </section>
  );
}
