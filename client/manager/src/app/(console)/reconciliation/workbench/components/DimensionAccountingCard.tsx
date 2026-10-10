"use client";

import { useMemo, type ReactNode } from "react";
import { Alert, Button, InputNumber, Select, Table, Tag, Tooltip } from "antd";
import type { ColumnsType } from "antd/es/table";
import { settleCurrencyOptions } from "@/app/(console)/manual/api/settle.api";
import type { ReconManualDimension, UpstreamDimension } from "../api/reconciliation.api";
import { estimateFee, useFeeChannel } from "../hooks/useFeeChannel";
import { FormulaGrid, MoneyCell, SectionHead, money, moneyColumn, type AmountTone } from "./shared";

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

/** 人工维度一行：商品行积分取审核通过订单积分，合计行为各商品之和 */
interface ManualDimensionRow {
  key: string;
  name: string;
  /** 提交总量（order_sum_record.total_num） */
  taskNum: number;
  /** 总数量 = 审核通过 + 待审核 + 审核失败 + 私密 + 删除 */
  statusTotalNum: number;
  checkedNum: number;
  unCheckNum: number;
  points: number;
  /** 预计代付手续费（RMB）= 积分 ÷ 10000 × 所选通道代付费率 */
  payoutFee: number;
  total?: boolean;
}

type StatusCounts = Pick<ReconManualDimension, "checkedNum" | "unCheckNum" | "checkErrorNum" | "secretNum" | "deleteNum">;

/** 各审核状态之和；老接口没返回的字段按 0 算 */
const statusTotal = (counts: StatusCounts) =>
  (counts.checkedNum ?? 0) + (counts.unCheckNum ?? 0) + (counts.checkErrorNum ?? 0) + (counts.secretNum ?? 0) + (counts.deleteNum ?? 0);

const manualColumns: ColumnsType<ManualDimensionRow> = [
  { title: "类目", dataIndex: "name", width: 140, fixed: "left", render: (value: string) => <span className="recon-row-name">{value}</span> },
  {
    title: (
      <Tooltip title="审核通过 + 待审核 + 审核失败 + 私密 + 删除">
        <span>总数量</span>
      </Tooltip>
    ),
    dataIndex: "statusTotalNum",
    width: 110,
    align: "right",
    render: (value: number) => <MoneyCell value={value} />,
  },
  moneyColumn<ManualDimensionRow>("提交总量", "taskNum", 110),
  moneyColumn<ManualDimensionRow>("审核成功量", "checkedNum", 110),
  {
    title: "待审核量",
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
    render: (value: number, row) => (
      <Tooltip
        title={
          row.total
            ? "各商品积分之和（审核通过订单的积分，不含徒弟奖励）；和积分日汇总的对照见表格下方"
            : "审核通过订单的积分，不含徒弟奖励"
        }
      >
        <span>
          <MoneyCell value={value} />
        </span>
      </Tooltip>
    ),
  },
  moneyColumn<ManualDimensionRow>("代付手续费（RMB）", "payoutFee", 130, "fee"),
];

/** 上游维度一行：只展示充值 / 赠送 / 消费 / 返点 / 小费，金额为 RMB */
interface UpstreamRow {
  key: string;
  name: string;
  amount: number;
  /** 悬停说明口径和拆分 */
  detail: string;
  tone: AmountTone;
  /** 估算值，类目旁标「估算」 */
  estimated?: boolean;
}

const upstreamColumns: ColumnsType<UpstreamRow> = [
  {
    title: "类目",
    dataIndex: "name",
    width: 120,
    fixed: "left",
    render: (value: string, row) => (
      <span className="recon-row-name">
        {value}
        {row.estimated ? (
          <Tag color="gold" style={{ marginInlineStart: 6, marginInlineEnd: 0 }}>
            估算
          </Tag>
        ) : null}
      </span>
    ),
  },
  {
    title: "金额（RMB）",
    dataIndex: "amount",
    width: 140,
    align: "right",
    render: (value: number, row) => (
      <Tooltip title={row.detail}>
        <span>
          <MoneyCell value={value} tone={row.tone} />
        </span>
      </Tooltip>
    ),
  },
];

const formulas = [
  { label: "返点 / 小费", expression: "下单数量 × 类目单位金额 − 退单数量 × 类目单位金额" },
  { label: "返点为 0 时", expression: "返点 = 消费 × 赠送 ÷ 充值（充值为 0 时仍按 0）" },
  { label: "人工预计结算金额", expression: "预计结算积分 ÷ 10000（预计结算积分 = 各商品积分之和，不含徒弟奖励；待审核任务审核后可能还会增加）" },
  { label: "积分对照差异", expression: "各商品积分之和 − 积分日汇总的做单积分（徒弟奖励不分商品，不参与对照）" },
  { label: "代收手续费（预计）", expression: "实际消费（消费 − 退款 − 补款）× 代收费率（默认取所选通道的配置，按 U 取 U 费率，按 RMB 取 RMB 费率；可在本页改，只影响本页）" },
  { label: "代付手续费（预计）", expression: "积分 ÷ 10000 × 代付费率（默认取所选通道的配置，按 U 取 U 费率，按 RMB 取 RMB 费率；可在本页改，只影响本页）" },
  { label: "利润", expression: "上游净额 − 人工预计结算金额 − 代付手续费；上游净额 = 消费 − 小费 − 返点 − 退款 − 补款 − 代收手续费" },
  { label: "利润率", expression: "利润 ÷ 上游净额（上游净额 ≤ 0 时显示 —）" },
];

/** 10000 积分 = 1 元 */
const POINTS_PER_RMB = 10000;

/** 费率（小数）↔ 输入框里的百分比，百分比最多 4 位小数 */
function rateToPercent(rate: number) {
  return Number((rate * 100).toFixed(4));
}

function percentToRate(percent: number) {
  return Number((percent / 100).toFixed(6));
}

/** 手续费估算用的通道 / 币种 / 费率选择，存 localStorage；费率默认取通道配置，可在本页改 */
function FeeChannelPicker({ label, state }: { label: string; state: ReturnType<typeof useFeeChannel> }) {
  return (
    <span className="recon-fee-picker">
      <span className="recon-subcard-caption">{label}</span>
      <Select
        size="small"
        style={{ width: 140 }}
        placeholder="无可用通道"
        value={state.channel?.id}
        onChange={state.setChannelId}
        options={state.channels.map((item) => ({
          value: item.id,
          label: `${item.name}${item.defaultChannel ? "（默认）" : ""}`,
        }))}
      />
      <Select
        size="small"
        style={{ width: 110 }}
        value={state.currency}
        onChange={state.setCurrency}
        options={settleCurrencyOptions}
      />
      <Tooltip title={state.channel ? `通道配置费率 ${feeRateText(state.channelRate)}，改动只影响本页估算` : undefined}>
        <InputNumber<number>
          size="small"
          style={{ width: 100 }}
          min={0}
          max={100}
          precision={4}
          controls={false}
          suffix="%"
          disabled={!state.channel}
          value={rateToPercent(state.rate)}
          onChange={(value) => state.setRate(value === null ? null : percentToRate(value))}
        />
      </Tooltip>
      {state.rateOverridden ? (
        <Button size="small" type="link" style={{ padding: 0 }} onClick={() => state.setRate(null)}>
          恢复通道费率
        </Button>
      ) : null}
    </span>
  );
}

function feeRateText(rate: number) {
  return `${money(rate * 100)}%`;
}

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
  const collectChannel = useFeeChannel("recon.workbench.upstreamCollectFee", "USDT", "collect");
  const payoutChannel = useFeeChannel("recon.workbench.manualPayoutFee", "RMB", "payout");
  const payoutRate = payoutChannel.rate;

  // 合计行积分取各商品之和，和积分日汇总（user_points_daily）分开对照
  const categoryPoints = useMemo(
    () => (manualDimension?.shopCategoryList ?? []).reduce((sum, item) => sum + (item.points ?? 0), 0),
    [manualDimension],
  );

  const manualRows = useMemo<ManualDimensionRow[]>(() => {
    if (!manualDimension) {
      return [];
    }
    return [
      {
        key: "total",
        name: "合计",
        taskNum: manualDimension.taskNum,
        statusTotalNum: statusTotal(manualDimension),
        checkedNum: manualDimension.checkedNum,
        unCheckNum: manualDimension.unCheckNum,
        points: categoryPoints,
        payoutFee: (categoryPoints / POINTS_PER_RMB) * payoutRate,
        total: true,
      },
      ...manualDimension.shopCategoryList.map((item) => ({
        key: `category-${item.shopCategoryId}`,
        name: item.shopCategoryName,
        taskNum: item.taskNum,
        statusTotalNum: statusTotal(item),
        checkedNum: item.checkedNum,
        unCheckNum: item.unCheckNum,
        points: item.points ?? 0,
        payoutFee: ((item.points ?? 0) / POINTS_PER_RMB) * payoutRate,
      })),
    ];
  }, [manualDimension, categoryPoints, payoutRate]);

  // 返点为 0 时按赠送比例估算：消费 × 赠送 ÷ 充值；充值为 0 时无法估算，仍为 0
  const rebateEstimated = !!upstream && upstream.rebateAmount === 0 && upstream.rechargeAmount > 0;
  const effectiveRebate = rebateEstimated
    ? (upstream.consumeAmount * upstream.givenAmount) / upstream.rechargeAmount
    : (upstream?.rebateAmount ?? 0);

  // 实际消费 = 消费 − 退款 − 补款，代收手续费按它估算
  const actualConsume = (upstream?.consumeAmount ?? 0) - (upstream?.refundAmount ?? 0) - (upstream?.bkAmount ?? 0);
  const collectFee = estimateFee(actualConsume, collectChannel);
  const collectRate = collectChannel.rate;

  const upstreamRows = useMemo<UpstreamRow[]>(() => {
    if (!upstream) {
      return [];
    }
    return [
      { key: "recharge", name: "充值金额", amount: upstream.rechargeAmount, detail: "账户流水「充值」合计", tone: "income" },
      { key: "given", name: "赠送金额", amount: upstream.givenAmount, detail: "账户流水「赠送」合计", tone: "income" },
      { key: "consume", name: "消费金额", amount: upstream.consumeAmount, detail: "账户流水「消费」合计（毛额，不扣退款、补款）", tone: "income" },
      {
        key: "rebate",
        name: "返点金额",
        amount: effectiveRebate,
        tone: "cost",
        estimated: rebateEstimated,
        detail: rebateEstimated
          ? `按类目算出的返点为 0，按赠送比例估算：消费 ${money(upstream.consumeAmount)} × 赠送 ${money(upstream.givenAmount)} ÷ 充值 ${money(upstream.rechargeAmount)}`
          : `下单 ${money(upstream.orderNum)} 个 ${money(upstream.orderRebate)} − 退单 ${money(upstream.refundNum)} 个 ${money(upstream.refundRebate)}`,
      },
      {
        key: "tip",
        name: "小费金额",
        amount: upstream.tipAmount,
        tone: "cost",
        detail: `下单 ${money(upstream.orderNum)} 个 ${money(upstream.orderTip)} − 退单 ${money(upstream.refundNum)} 个 ${money(upstream.refundTip)}`,
      },
      { key: "refund", name: "退款金额", amount: upstream.refundAmount, detail: "账户流水「退货」合计", tone: "cost" },
      { key: "bk", name: "补款金额", amount: upstream.bkAmount, detail: "账户流水「补款」合计", tone: "cost" },
      {
        key: "collectFee",
        name: "代收手续费",
        amount: collectFee.feeRmb,
        tone: "fee",
        estimated: true,
        detail: collectChannel.channel
          ? `实际消费 ${money(actualConsume)} × ${collectChannel.channel.name} ${
              collectChannel.currency === "USDT" ? "U" : "RMB"
            } 代收费率 ${feeRateText(collectRate)}${collectChannel.rateOverridden ? "（本页修改）" : ""}${collectFee.feeU !== null ? `，约 ${money(collectFee.feeU)} U` : ""}`
          : "没有可用的结算通道，按 0 计",
      },
    ];
  }, [upstream, rebateEstimated, effectiveRebate, actualConsume, collectFee.feeRmb, collectRate, collectFee.feeU, collectChannel.channel, collectChannel.currency, collectChannel.rateOverridden]);

  // 利润 = 上游净额 − 人工预计结算金额 − 代付手续费，统一按 RMB；返点取上面的 effectiveRebate
  const upstreamNet =
    (upstream?.consumeAmount ?? 0) -
    (upstream?.tipAmount ?? 0) -
    effectiveRebate -
    (upstream?.refundAmount ?? 0) -
    (upstream?.bkAmount ?? 0) -
    collectFee.feeRmb;
  const manualPoints = categoryPoints;
  const pointsDiff = categoryPoints - (manualDimension?.taskPoints ?? 0);
  const manualSettleRmb = manualPoints / POINTS_PER_RMB;
  const payoutFeeRmb = manualSettleRmb * payoutRate;
  const unCheckNum = manualDimension?.unCheckNum ?? 0;
  const totalProfit = upstreamNet - manualSettleRmb - payoutFeeRmb;
  // 利润率 = 利润 ÷ 上游净额；上游净额 ≤ 0 时无意义，不展示
  const profitRate = upstreamNet > 0 ? totalProfit / upstreamNet : null;
  const systemCalc: {
    label: string;
    value: number;
    unit: string;
    tone: AmountTone;
    sub?: ReactNode;
    note?: string;
    highlight?: boolean;
  }[] = [
    {
      label: "人工预计结算金额",
      value: manualSettleRmb,
      unit: "RMB",
      tone: "settle",
      sub: (
        <>
          {`预计结算积分 ${money(manualPoints)} · 代付手续费 `}
          <MoneyCell value={payoutFeeRmb} tone="fee" />
        </>
      ),
      note: unCheckNum > 0 ? `还有 ${money(unCheckNum)} 个任务未审核` : undefined,
    },
    {
      label: "上游净额",
      value: upstreamNet,
      unit: "RMB",
      tone: "income",
      sub: "消费 − 小费 − 返点 − 退款 − 补款 − 代收手续费",
    },
    {
      label: "总计利润",
      value: totalProfit,
      unit: "RMB",
      tone: "profit",
      sub: `利润率 ${profitRate === null ? "—" : `${(profitRate * 100).toFixed(2)}%`}（利润 ÷ 上游净额）`,
      highlight: true,
    },
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
            <FeeChannelPicker label="代付通道" state={payoutChannel} />
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
            scroll={{ x: 940 }}
            rowClassName={(row) => (row.total ? "recon-row-total" : "")}
          />
          {manualDimension ? (
            <div className="recon-points-compare">
              <span className="recon-points-compare-item">
                <span className="recon-subcard-caption">商品积分之和</span>
                <MoneyCell value={categoryPoints} />
              </span>
              <Tooltip title="user_points_daily 按做单日期汇总，只统计批次入账；上线前的日期没有数据">
                <span className="recon-points-compare-item">
                  <span className="recon-subcard-caption">积分日汇总 · 做单</span>
                  <MoneyCell value={manualDimension.taskPoints} />
                </span>
              </Tooltip>
              <span className="recon-points-compare-item">
                <span className="recon-subcard-caption">差异</span>
                <MoneyCell value={pointsDiff} tone={pointsDiff === 0 ? undefined : "fee"} />
                <Tag color={pointsDiff === 0 ? "green" : "red"} style={{ marginInlineEnd: 0 }}>
                  {pointsDiff === 0 ? "一致" : "有差异"}
                </Tag>
              </span>
              <span className="recon-subcard-caption">
                {`日汇总合计 ${money(manualDimension.points)}（另含徒弟奖励 ${money(manualDimension.childrenPoints)}，不参与对照）`}
              </span>
            </div>
          ) : null}
        </div>

        <div className="recon-subcard">
          <div className="recon-subcard-head">
            <span className="recon-subcard-title">上游维度</span>
            <FeeChannelPicker label="代收通道" state={collectChannel} />
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
              className={`recon-calc-item ${item.highlight ? "recon-calc-item--highlight" : `recon-calc-item--${item.tone}`}`}
              key={item.label}
            >
              <span className="recon-calc-label">
                <span className="recon-calc-label-title">
                  {item.label}
                  {item.note ? (
                    <Tag color="gold" style={{ marginInlineEnd: 0 }}>
                      {item.note}
                    </Tag>
                  ) : null}
                </span>
                {item.sub ? <span className="recon-subcard-caption recon-calc-label-sub">{item.sub}</span> : null}
              </span>
              <span className="recon-calc-value">
                <MoneyCell value={item.value} tone={item.tone} />
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
