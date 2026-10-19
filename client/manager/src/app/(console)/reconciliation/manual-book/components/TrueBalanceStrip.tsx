"use client";

import { useEffect, useRef, useState } from "react";
import { ReloadOutlined } from "@ant-design/icons";
import { Alert, Button, DatePicker, InputNumber, Popover, Table, Tooltip } from "antd";
import type { ColumnsType } from "antd/es/table";
import dayjs, { type Dayjs } from "dayjs";
import {
  fetchManualUserPointsSummary,
  ManualUserPointsSummaryRecord,
} from "@/app/(console)/manual/api/user.api";
import { readExcludedUsers } from "@/app/(console)/manual/user-management/excluded-points-users";
import {
  fetchManualPendingEstimate,
  type ManualPendingEstimate,
  type ManualPendingEstimateShopCategory,
} from "../api/manual-book.api";
import { MoneyCell, money } from "../../workbench/components/shared";

/** barry 的积分是整数，10000 积分 = 1 元 */
const POINTS_PER_YUAN = 10000;

/** 起始日期默认 15 天前 */
const DEFAULT_LOOKBACK_DAYS = 15;

/** 审核成功率默认 95%，页面上可改 */
const DEFAULT_APPROVAL_RATE = 95;

/** 待审核估算的区间最长 93 天（同人工维度） */
const MAX_LOOKBACK_DAYS = 93;

interface TrueBalanceStripProps {
  /** 所选区间最后一份人工记账的余额（RMB），没有为 null */
  manualBalance: number | null;
  /** 那份记账的日期 */
  manualBalanceDate?: string;
}

/**
 * 真实结余 = 人工余额 − 用户余额 − 待审核预估。
 * 用户余额：起始日期之后积分有变动的做单用户的可用 + 冻结，按「做单用户」页的排除名单排除；
 * 待审核预估：起始日期 ~ 今天各人工商品的待审核积分之和 × 审核成功率（默认 95%）。
 */
export function TrueBalanceStrip({ manualBalance, manualBalanceDate }: TrueBalanceStripProps) {
  const [startDate, setStartDate] = useState<Dayjs>(() =>
    dayjs().subtract(DEFAULT_LOOKBACK_DAYS, "day").startOf("day"),
  );
  const [points, setPoints] = useState<ManualUserPointsSummaryRecord | null>(null);
  const [excludedCount, setExcludedCount] = useState(0);
  const [estimate, setEstimate] = useState<ManualPendingEstimate | null>(null);
  const [approvalRate, setApprovalRate] = useState(DEFAULT_APPROVAL_RATE);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const seqRef = useRef(0);

  const load = async (start: Dayjs) => {
    const seq = ++seqRef.current;
    setLoading(true);
    setError(null);
    const excluded = readExcludedUsers();
    setExcludedCount(excluded.length);
    try {
      const [summary, pending] = await Promise.all([
        fetchManualUserPointsSummary({
          updatedTime: start.format("YYYY-MM-DD HH:mm:ss"),
          excludedUserIds: excluded.map((item) => item.userId).join(","),
        }),
        fetchManualPendingEstimate(start.format("YYYY-MM-DD")),
      ]);
      if (seq !== seqRef.current) return;
      setPoints(summary);
      setEstimate(pending);
    } catch (err) {
      if (seq !== seqRef.current) return;
      setPoints(null);
      setEstimate(null);
      setError(err instanceof Error ? err.message : "加载真实结余失败");
    } finally {
      if (seq === seqRef.current) setLoading(false);
    }
  };

  useEffect(() => {
    void load(startDate);
    // 只在起始日期变化时重新拉
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startDate]);

  const userBalance = points ? points.totalPoints / POINTS_PER_YUAN : null;
  const pendingTotal = estimate ? estimate.estimatePoints / POINTS_PER_YUAN : null;
  const pendingAmount = pendingTotal == null ? null : (pendingTotal * approvalRate) / 100;
  const trueBalance =
    manualBalance != null && userBalance != null && pendingAmount != null
      ? manualBalance - userBalance - pendingAmount
      : null;

  return (
    <div className="recon-calc-strip">
      <div className="recon-calc-strip-title">
        真实结余
        <div className="recon-subcard-caption" style={{ fontWeight: 400 }}>
          人工余额 − 用户余额 − 待审核预估
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 6, alignItems: "center" }}>
          <Tooltip title="用户余额只统计这天之后积分有变动的账号；待审核取这天到今天">
            <DatePicker
              size="small"
              allowClear={false}
              value={startDate}
              disabledDate={(current) =>
                current.isAfter(dayjs().endOf("day")) ||
                current.isBefore(dayjs().subtract(MAX_LOOKBACK_DAYS - 1, "day").startOf("day"))
              }
              onChange={(value) => value && setStartDate(value.startOf("day"))}
            />
          </Tooltip>
          <Tooltip title="审核成功率：待审核积分里预计最终审核通过、要付给做单用户的比例">
            <InputNumber
              size="small"
              min={0}
              max={100}
              step={1}
              precision={2}
              value={approvalRate}
              addonBefore="成功率"
              addonAfter="%"
              style={{ width: 170 }}
              onChange={(value) => setApprovalRate(value == null ? DEFAULT_APPROVAL_RATE : Number(value))}
            />
          </Tooltip>
          <Tooltip title="刷新">
            <Button
              size="small"
              icon={<ReloadOutlined />}
              loading={loading}
              aria-label="刷新真实结余"
              onClick={() => void load(startDate)}
            />
          </Tooltip>
        </div>
      </div>
      <div className="recon-calc-grid">
        <div className="recon-calc-item">
          <span className="recon-calc-label">人工余额</span>
          <div className="recon-calc-stack">
            <span className="recon-calc-value">
              {manualBalance == null ? <Dash /> : <MoneyCell value={manualBalance} />}
              <em className="recon-calc-unit">RMB</em>
            </span>
            <div className="recon-subcard-caption recon-calc-brief">
              {manualBalance == null ? "所选日期还没有记账" : `${manualBalanceDate ?? ""} 的记账`}
            </div>
          </div>
        </div>
        <div className="recon-calc-item">
          <span className="recon-calc-label">用户余额</span>
          <Tooltip
            title={
              <div>
                <div>
                  {startDate.format("YYYY-MM-DD")} 之后积分有变动的账号
                  {excludedCount > 0 ? `，已排除 ${excludedCount} 个用户（做单用户页的排除名单）` : ""}
                </div>
                {points ? (
                  <div>
                    可用 {money(points.activePoints / POINTS_PER_YUAN)} + 冻结 {money(points.blockPoints / POINTS_PER_YUAN)}
                    （提现中）；{points.accountNum} 个账号
                  </div>
                ) : null}
              </div>
            }
          >
            <div className="recon-calc-stack">
              <span className="recon-calc-value">
                {userBalance == null ? <Dash /> : <MoneyCell value={userBalance} />}
                <em className="recon-calc-unit">RMB</em>
              </span>
              <div className="recon-subcard-caption recon-calc-brief">
                {startDate.format("MM-DD")} 后有变动
                {excludedCount > 0 ? `，排除 ${excludedCount} 人` : ""}
              </div>
            </div>
          </Tooltip>
        </div>
        <div className="recon-calc-item">
          <span className="recon-calc-label">待审核预估</span>
          <Popover
            placement="bottom"
            title={`待审核预估 · ${estimate?.startDate ?? ""} ~ ${estimate?.endDate ?? ""}`}
            content={<PendingEstimateTable rows={estimate?.shopCategoryList ?? []} approvalRate={approvalRate} />}
          >
            <div className="recon-calc-stack" style={{ cursor: "pointer" }}>
              <span className="recon-calc-value">
                {pendingAmount == null ? <Dash /> : <MoneyCell value={pendingAmount} />}
                <em className="recon-calc-unit">RMB</em>
              </span>
              <div className="recon-subcard-caption recon-calc-brief">
                {estimate && pendingTotal != null
                  ? `${estimate.unCheckNum.toLocaleString("zh-CN")} 单 · 全部 ${money(pendingTotal)} × ${approvalRate}%`
                  : ""}
              </div>
            </div>
          </Popover>
        </div>
        <div className="recon-calc-item recon-calc-item--highlight">
          <span className="recon-calc-label">真实结余</span>
          <span className="recon-calc-value">
            {trueBalance == null ? <Dash /> : <MoneyCell value={trueBalance} tone="profit" />}
            <em className="recon-calc-unit">RMB</em>
          </span>
        </div>
      </div>
      {error ? <Alert type="error" showIcon message={error} style={{ marginTop: 8 }} /> : null}
    </div>
  );
}

function Dash() {
  return <span className="recon-subcard-caption">—</span>;
}

function PendingEstimateTable({
  rows,
  approvalRate,
}: {
  rows: ManualPendingEstimateShopCategory[];
  approvalRate: number;
}) {
  const columns: ColumnsType<ManualPendingEstimateShopCategory> = [
    { title: "人工商品", dataIndex: "shopCategoryName", width: 160 },
    {
      title: "待审核单数",
      dataIndex: "unCheckNum",
      width: 110,
      align: "right",
      render: (value: number, row) => (
        <Tooltip
          title={
            row.unpricedNum > 0
              ? `按同一用户同一天的审核成功单价换算 ${row.pricedNum.toLocaleString("zh-CN")} 单；${row.unpricedNum.toLocaleString("zh-CN")} 单当天没有审核成功的单，按当前积分 ${row.currentScore ?? "—"} 算`
              : "全部按同一用户同一天的审核成功单价换算"
          }
        >
          <span>{value.toLocaleString("zh-CN")}</span>
        </Tooltip>
      ),
    },
    {
      title: "平均积分",
      dataIndex: "avgScore",
      width: 100,
      align: "right",
      render: (value: number | null, row) => (
        <Tooltip title={row.currentScore != null ? `当前积分 ${row.currentScore}` : undefined}>
          <span>{value == null ? "—" : money(value)}</span>
        </Tooltip>
      ),
    },
    {
      title: "待审核金额",
      dataIndex: "estimatePoints",
      width: 120,
      align: "right",
      render: (value: number) => <MoneyCell value={value / POINTS_PER_YUAN} />,
    },
    {
      title: `× ${approvalRate}%`,
      key: "approved",
      width: 120,
      align: "right",
      render: (_, row) => <MoneyCell value={(row.estimatePoints / POINTS_PER_YUAN) * approvalRate / 100} />,
    },
  ];
  return (
    <div style={{ maxWidth: 720 }}>
      <Table<ManualPendingEstimateShopCategory>
        size="small"
        rowKey="shopCategoryId"
        dataSource={rows}
        columns={columns}
        pagination={false}
        scroll={{ y: 360 }}
        locale={{ emptyText: "区间内没有待审核的单" }}
      />
      <div className="recon-subcard-caption" style={{ marginTop: 6 }}>
        取 order_sum_record（用户 × 天 × 商品）的待审核单数；order_score 只记审核成功的单，所以每行按「审核成功积分 ÷ 审核成功单数」的实际单价（含渠道加价）换算，当天没有审核成功单的行按商品当前积分算；最后乘审核成功率。
      </div>
    </div>
  );
}
