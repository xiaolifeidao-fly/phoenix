"use client";

import { useMemo, useState } from "react";
import { PieChartOutlined } from "@ant-design/icons";
import { Button, Empty, Modal, Progress, Select, Space, Table, Tooltip, Typography } from "antd";
import type { ColumnsType } from "antd/es/table";
import type { FetchAssignmentMonitorSummary, FetchMissReasonCount } from "../api/workbench-dashboard.api";

type MonitorCategory = FetchAssignmentMonitorSummary["categoryList"][number];

/** 原因代码与 barry FetchMissReason 一一对应，这里只补充弹框里的解释。 */
const MISS_REASON_DESCRIPTIONS: Record<string, string> = {
  LIMIT_LOCKED: "单子已达分发上限，正在等待完成检测，本次被延迟送回",
  OVER_LIMIT_DROPPED: "并发抢同一单时超过上限，没分到也没有延迟送回",
  DONE_TODAY: "该号当天已做过同一业务",
  NOT_PENDING: "单子已完成或已停止，不再分发",
  NOT_IN_ASSIGN_TIME: "单子不在允许分发的时间内",
  EMPTY_QUEUE: "个人队列为空，已触发或正在等待建池",
  OTHER: "未命中以上判断，如批量分发链路、处理器缺失或取单异常",
};

const formatCount = (value: number) => Number(value || 0).toLocaleString("zh-CN");
const formatPercent = (value: number) => `${(value * 100).toFixed(1)}%`;

interface FetchMissReasonButtonProps {
  monitor: FetchAssignmentMonitorSummary | null | undefined;
  timeRangeLabel?: string;
}

/** 取单统计行上的"无任务分布"入口：按单个商品看本时段无任务的主因占比。 */
export function FetchMissReasonButton({ monitor, timeRangeLabel }: FetchMissReasonButtonProps) {
  const [open, setOpen] = useState(false);
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
  const categories = useMemo(() => monitor?.categoryList ?? [], [monitor]);

  // 默认选无任务最多的商品；所选商品不在当前卡片里时也回落到它。
  const defaultCategory = useMemo(
    () =>
      categories.reduce<MonitorCategory | null>(
        (top, item) => (!top || item.dailyFetchMissCount > top.dailyFetchMissCount ? item : top),
        null,
      ),
    [categories],
  );
  const category =
    categories.find((item) => item.shopCategoryId === selectedCategoryId) ?? defaultCategory;

  if (!monitor || categories.length === 0) {
    return null;
  }

  const reasons = category?.missReasonList ?? [];
  const reasonTotal = reasons.reduce((sum, item) => sum + (item.count || 0), 0);
  const columns: ColumnsType<FetchMissReasonCount> = [
    {
      title: "原因",
      dataIndex: "label",
      width: 140,
      render: (label: string, record) => (
        <Tooltip title={MISS_REASON_DESCRIPTIONS[record.reason]}>
          <span>{label}</span>
        </Tooltip>
      ),
    },
    {
      title: "次数",
      dataIndex: "count",
      width: 110,
      align: "right",
      render: (count: number) => formatCount(count),
    },
    {
      title: "占比",
      key: "ratio",
      render: (_, record) => (
        <Progress
          percent={reasonTotal > 0 ? Number(((record.count / reasonTotal) * 100).toFixed(1)) : 0}
          size="small"
          status="normal"
        />
      ),
    },
  ];

  return (
    <>
      <Tooltip title="按商品查看本时段无任务的原因分布">
        <Button
          className="manager-dashboard-card__fetch-miss-reason-button"
          size="small"
          icon={<PieChartOutlined />}
          onClick={() => setOpen(true)}
        >
          无任务分布
        </Button>
      </Tooltip>
      <Modal
        title={`无任务原因分布${timeRangeLabel ? ` · ${timeRangeLabel}` : ""}`}
        open={open}
        onCancel={() => setOpen(false)}
        footer={null}
        width={640}
        destroyOnHidden
      >
        <Space direction="vertical" size={12} style={{ width: "100%" }}>
          <Select
            showSearch
            optionFilterProp="label"
            style={{ width: "100%" }}
            value={category?.shopCategoryId}
            onChange={(value: number) => setSelectedCategoryId(value)}
            options={categories.map((item) => ({
              value: item.shopCategoryId,
              label: `${item.categoryName || item.categoryCode || item.shopCategoryId}（无任务 ${formatCount(item.dailyFetchMissCount)}）`,
            }))}
          />
          {category ? (
            <Typography.Text type="secondary">
              取到 {formatCount(category.dailyFetchHitCount)} · 无任务 {formatCount(category.dailyFetchMissCount)} · 成功率{" "}
              {formatPercent(category.dailyFetchSuccessRate || 0)}
            </Typography.Text>
          ) : null}
          {reasonTotal > 0 ? (
            <Table<FetchMissReasonCount>
              rowKey="reason"
              size="small"
              pagination={false}
              columns={columns}
              dataSource={reasons}
            />
          ) : (
            <Empty description="本时段该商品暂无无任务原因记录（原因统计从本次上线后开始累计）" />
          )}
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            一次取单在该商品上可能连续碰到多种情况，只按"已达分发上限 → 超额未分到 → 当日已做 → 单子已结束 →
            不在分发时间 → 队列为空"的顺序记一个主因。不同商品会重复计同一次请求，请按单个商品查看，不要相加。
          </Typography.Text>
        </Space>
      </Modal>
    </>
  );
}
