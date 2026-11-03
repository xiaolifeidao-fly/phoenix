"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { FieldTimeOutlined, ReloadOutlined } from "@ant-design/icons";
import { Button, Empty, Modal, Segmented, Select, Space, Spin, Table, Tag, Tooltip, Typography } from "antd";
import type { ColumnsType } from "antd/es/table";
import {
  fetchFetchSlowMonitor,
  type FetchSlowBucketCount,
  type FetchSlowMonitorSummary,
  type FetchSlowSample,
  type FetchSlowTraceNode,
} from "../api/workbench-dashboard.api";

type HourRow = FetchSlowMonitorSummary["hourList"][number];

interface TraceRow {
  key: string;
  name: string;
  count?: number;
  totalMs: number;
  maxMs?: number;
  offsetMs?: number;
  children?: TraceRow[];
}

const SAMPLE_LIMIT_OPTIONS = [200, 500, 2000];
/** 明细按最低耗时筛选（秒），与 barry 的耗时档位下限一致。 */
const MIN_COST_SECONDS_OPTIONS = [3, 5, 7, 10, 20, 30, 60];

const RESULT_TAGS: Record<string, { color: string; label: string }> = {
  HIT: { color: "success", label: "取到" },
  MISS: { color: "warning", label: "无任务" },
  PRECHECK: { color: "default", label: "前置拦截" },
  ERROR: { color: "error", label: "异常" },
};

const formatCount = (value: number) => Number(value || 0).toLocaleString("zh-CN");
const formatSeconds = (ms: number) => `${(Number(ms || 0) / 1000).toFixed(1)}s`;

function formatLocalDate(date: Date) {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

/** Barry 计数只保留 3 天，所以只提供今天、昨天、前天。 */
function buildDateOptions() {
  const labels = ["今天", "昨天", "前天"];
  return labels.map((label, offset) => {
    const date = new Date();
    date.setDate(date.getDate() - offset);
    return { label, value: formatLocalDate(date) };
  });
}

function toTraceRows(nodes: FetchSlowTraceNode[], parentKey: string): TraceRow[] {
  return nodes.map((node, index) => {
    const key = `${parentKey}-${index}`;
    const children = node.children?.length ? toTraceRows(node.children, key) : undefined;
    return { ...node, key, children };
  });
}

function formatMs(value?: number) {
  return value === undefined ? "-" : `${formatCount(value)}ms`;
}

/** 展开一条慢请求：各环节耗时树。"未归属"是总耗时减去顶层环节之和，偏大说明还有环节没打到点。 */
function FetchSlowTraceTable({ sample }: { sample: FetchSlowSample }) {
  const nodes = sample.traceList ?? [];
  if (nodes.length === 0) {
    return <Empty description="该请求没有链路数据（barry 未开启链路跟踪）" />;
  }
  const trackedMs = nodes.reduce((sum, node) => sum + node.totalMs, 0);
  const rows: TraceRow[] = [
    ...toTraceRows(nodes, "trace"),
    { key: "untracked", name: "未归属", totalMs: Math.max(sample.costMs - trackedMs, 0) },
  ];
  const columns: ColumnsType<TraceRow> = [
    { title: "环节", dataIndex: "name" },
    { title: "次数", dataIndex: "count", width: 70, align: "right" },
    { title: "总耗时", dataIndex: "totalMs", width: 110, align: "right", render: formatMs },
    { title: "最大单次", dataIndex: "maxMs", width: 110, align: "right", render: formatMs },
    { title: "首次开始", dataIndex: "offsetMs", width: 110, align: "right", render: formatMs },
    {
      title: "占总耗时",
      key: "ratio",
      width: 90,
      align: "right",
      render: (_, record) => `${sample.costMs > 0 ? ((record.totalMs / sample.costMs) * 100).toFixed(1) : "0.0"}%`,
    },
  ];
  return (
    <Table<TraceRow>
      size="small"
      pagination={false}
      columns={columns}
      dataSource={rows}
      expandable={{ defaultExpandAllRows: true }}
    />
  );
}

interface FetchSlowMonitorButtonProps {
  /** 当前卡片的品类名，用来把明细里的品类 ID 显示成名称；不在卡片里的品类显示 ID。 */
  categoryNames?: Record<number, string>;
}

/** 取单统计行上的"慢请求"入口：取单接口总耗时超过阈值（默认 3 秒）的分布与明细，统计范围是全部取单接口。 */
export function FetchSlowMonitorButton({ categoryNames }: FetchSlowMonitorButtonProps) {
  const dateOptions = useMemo(buildDateOptions, []);
  const [open, setOpen] = useState(false);
  const [statDate, setStatDate] = useState(dateOptions[0].value);
  const [sampleLimit, setSampleLimit] = useState(SAMPLE_LIMIT_OPTIONS[0]);
  const [codeFilter, setCodeFilter] = useState<string | undefined>();
  const [minCostSeconds, setMinCostSeconds] = useState<number | undefined>();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<FetchSlowMonitorSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    fetchFetchSlowMonitor({ statDate, sampleLimit })
      .then(setData)
      .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "加载失败"))
      .finally(() => setLoading(false));
  }, [statDate, sampleLimit]);

  // 只在打开弹框时拉取，不跟随工作台轮询，避免每 10 秒拉一次明细。
  useEffect(() => {
    if (open) {
      load();
    }
  }, [open, load]);

  const bucketList = data?.bucketList ?? [];
  const hourRows = (data?.hourList ?? []).filter((item) => item.count > 0);
  const samples = useMemo(
    () =>
      (data?.sampleList ?? []).filter(
        (item) =>
          (!codeFilter || item.code === codeFilter) &&
          (minCostSeconds === undefined || item.costMs >= minCostSeconds * 1000),
      ),
    [data, codeFilter, minCostSeconds],
  );
  const codeOptions = useMemo(
    () =>
      Array.from(new Set((data?.sampleList ?? []).map((item) => item.code).filter(Boolean) as string[])).map(
        (code) => ({ label: code, value: code }),
      ),
    [data],
  );

  const bucketColumns: ColumnsType<FetchSlowBucketCount> = [
    { title: "耗时档位", dataIndex: "label" },
    { title: "合计", dataIndex: "count", align: "right", render: formatCount },
    { title: "取到", dataIndex: "hitCount", align: "right", render: formatCount },
    { title: "无任务", dataIndex: "missCount", align: "right", render: formatCount },
  ];

  const hourColumns: ColumnsType<HourRow> = [
    { title: "小时", dataIndex: "hour", width: 90, fixed: "left", render: (hour: number) => `${String(hour).padStart(2, "0")}:00` },
    { title: "合计", dataIndex: "count", align: "right", render: formatCount },
    ...bucketList.map((bucket, index) => ({
      title: bucket.label,
      key: bucket.bucket,
      width: 90,
      align: "right" as const,
      render: (_: unknown, record: HourRow) => formatCount(record.bucketList[index]?.count ?? 0),
    })),
    { title: "无任务", dataIndex: "missCount", align: "right", render: formatCount },
  ];

  const sampleColumns: ColumnsType<FetchSlowSample> = [
    { title: "时间", dataIndex: "time", width: 160 },
    { title: "结束时间", dataIndex: "endTime", width: 160, render: (value?: string) => value || "-" },
    { title: "总耗时", dataIndex: "costMs", width: 80, align: "right", render: formatSeconds },
    {
      title: (
        <Tooltip title="进入取单循环前：查用户/渠道/分组配置、上限校验、加锁">
          <span>前置</span>
        </Tooltip>
      ),
      dataIndex: "preCheckMs",
      width: 70,
      align: "right",
      render: formatSeconds,
    },
    {
      title: (
        <Tooltip title="取单循环：多轮 × 多品类弹单">
          <span>取单</span>
        </Tooltip>
      ),
      dataIndex: "fetchMs",
      width: 70,
      align: "right",
      render: formatSeconds,
    },
    {
      title: "结果",
      dataIndex: "result",
      width: 90,
      render: (result: string) => {
        const tag = RESULT_TAGS[result] ?? { color: "default", label: result };
        return <Tag color={tag.color}>{tag.label}</Tag>;
      },
    },
    { title: "取单商品", dataIndex: "code", width: 140 },
    { title: "机器", dataIndex: "host", width: 140, ellipsis: true, render: (value?: string) => value || "-" },
    { title: "用户", dataIndex: "userId", width: 70 },
    { title: "uid", dataIndex: "uid", width: 160, ellipsis: true },
    {
      title: "各品类耗时（次数）",
      key: "categoryList",
      render: (_, record) =>
        (record.categoryList ?? [])
          .map(
            (item) =>
              `${categoryNames?.[item.shopCategoryId] ?? item.shopCategoryId} ${formatSeconds(item.costMs)}（${item.attempts}）`,
          )
          .join("，") || "-",
    },
  ];

  return (
    <>
      <Tooltip title="全部取单接口中总耗时超过阈值（默认 3 秒）的请求分布与明细">
        <Button
          className="manager-dashboard-card__fetch-miss-reason-button"
          size="small"
          icon={<FieldTimeOutlined />}
          onClick={() => setOpen(true)}
        >
          慢请求
        </Button>
      </Tooltip>
      <Modal
        title="取单慢请求（全部取单接口）"
        open={open}
        onCancel={() => setOpen(false)}
        footer={null}
        width={1200}
        destroyOnHidden
      >
        <Space direction="vertical" size={12} style={{ width: "100%" }}>
          <Space wrap>
            <Segmented options={dateOptions} value={statDate} onChange={(value) => setStatDate(String(value))} />
            <Button icon={<ReloadOutlined />} onClick={load} loading={loading}>
              刷新
            </Button>
          </Space>
          {error ? <Typography.Text type="danger">{error}</Typography.Text> : null}
          <Spin spinning={loading}>
            <Space direction="vertical" size={12} style={{ width: "100%" }}>
              <Typography.Text strong>
                {data?.statDate ?? statDate} 慢请求 {formatCount(data?.totalCount ?? 0)} 次 · 取到{" "}
                {formatCount(data?.hitCount ?? 0)} · 无任务 {formatCount(data?.missCount ?? 0)}
              </Typography.Text>
              <Table<FetchSlowBucketCount>
                rowKey="bucket"
                size="small"
                pagination={false}
                columns={bucketColumns}
                dataSource={bucketList}
              />
              <Typography.Text strong>按小时分布</Typography.Text>
              {hourRows.length > 0 ? (
                <Table<HourRow>
                  rowKey="hour"
                  size="small"
                  pagination={false}
                  columns={hourColumns}
                  dataSource={hourRows}
                  scroll={{ x: 1000, y: 260 }}
                />
              ) : (
                <Empty description="当天还没有慢请求记录（统计从本次上线后开始累计）" />
              )}
              <Space wrap>
                <Typography.Text strong>最近明细</Typography.Text>
                <Select
                  size="small"
                  style={{ width: 140 }}
                  value={sampleLimit}
                  onChange={setSampleLimit}
                  options={SAMPLE_LIMIT_OPTIONS.map((value) => ({ value, label: `最近 ${value} 条` }))}
                />
                <Select
                  size="small"
                  allowClear
                  placeholder="按取单商品筛选"
                  style={{ width: 200 }}
                  value={codeFilter}
                  onChange={setCodeFilter}
                  options={codeOptions}
                />
                <Select
                  size="small"
                  allowClear
                  placeholder="按最低耗时筛选"
                  style={{ width: 150 }}
                  value={minCostSeconds}
                  onChange={setMinCostSeconds}
                  options={MIN_COST_SECONDS_OPTIONS.map((value) => ({ value, label: `${value} 秒以上` }))}
                />
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                  明细不按日期筛选，Redis 只保留最近 2000 条
                </Typography.Text>
              </Space>
              <Table<FetchSlowSample>
                rowKey={(record, index) => `${record.time}-${record.uid}-${index}`}
                size="small"
                columns={sampleColumns}
                dataSource={samples}
                pagination={{ pageSize: 20, showSizeChanger: false }}
                scroll={{ x: 1400 }}
                expandable={{ expandedRowRender: (record) => <FetchSlowTraceTable sample={record} /> }}
              />
            </Space>
          </Spin>
        </Space>
      </Modal>
    </>
  );
}
