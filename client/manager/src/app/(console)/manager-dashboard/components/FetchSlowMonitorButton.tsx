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
} from "../api/workbench-dashboard.api";

type HourRow = FetchSlowMonitorSummary["hourList"][number];

const SAMPLE_LIMIT_OPTIONS = [200, 500, 2000];

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

interface FetchSlowMonitorButtonProps {
  /** 当前卡片的品类名，用来把明细里的品类 ID 显示成名称；不在卡片里的品类显示 ID。 */
  categoryNames?: Record<number, string>;
}

/** 取单统计行上的"慢请求"入口：取单接口总耗时超过阈值（默认 10 秒）的分布与明细，统计范围是全部取单接口。 */
export function FetchSlowMonitorButton({ categoryNames }: FetchSlowMonitorButtonProps) {
  const dateOptions = useMemo(buildDateOptions, []);
  const [open, setOpen] = useState(false);
  const [statDate, setStatDate] = useState(dateOptions[0].value);
  const [sampleLimit, setSampleLimit] = useState(SAMPLE_LIMIT_OPTIONS[0]);
  const [codeFilter, setCodeFilter] = useState<string | undefined>();
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
    () => (data?.sampleList ?? []).filter((item) => !codeFilter || item.code === codeFilter),
    [data, codeFilter],
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
    { title: "小时", dataIndex: "hour", width: 90, render: (hour: number) => `${String(hour).padStart(2, "0")}:00` },
    { title: "合计", dataIndex: "count", align: "right", render: formatCount },
    ...bucketList.map((bucket, index) => ({
      title: bucket.label,
      key: bucket.bucket,
      align: "right" as const,
      render: (_: unknown, record: HourRow) => formatCount(record.bucketList[index]?.count ?? 0),
    })),
    { title: "无任务", dataIndex: "missCount", align: "right", render: formatCount },
  ];

  const sampleColumns: ColumnsType<FetchSlowSample> = [
    { title: "时间", dataIndex: "time", width: 160 },
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
      <Tooltip title="全部取单接口中总耗时超过阈值（默认 10 秒）的请求分布与明细">
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
        width={1100}
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
                  scroll={{ y: 260 }}
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
                scroll={{ x: 1100 }}
              />
            </Space>
          </Spin>
        </Space>
      </Modal>
    </>
  );
}
