"use client";

import { useCallback, useEffect, useState } from "react";
import dayjs, { type Dayjs } from "dayjs";
import { ReloadOutlined } from "@ant-design/icons";
import { Alert, Button, Card, Col, DatePicker, Row, Space, Statistic, Table, Tag, Tooltip, Typography } from "antd";
import type { ColumnsType } from "antd/es/table";
import type { TablePaginationConfig } from "antd/es/table/interface";
import { message } from "@/utils/notify";
import { dateRangePresets } from "@/utils/date-range-presets";
import {
  fetchDropMonitorJobRecords,
  fetchDropMonitorRuntime,
  type DropMonitorJobRecord,
  type DropMonitorRuntime,
} from "../../api/drop-monitor.api";
import { ellipsisCell, formatDateTime } from "./format";

const { RangePicker } = DatePicker;
const { Text } = Typography;

const defaultDateRange: [Dayjs, Dayjs] = [dayjs().startOf("day"), dayjs().startOf("day")];

export function JobRunTab() {
  const [loading, setLoading] = useState(false);
  const [runtime, setRuntime] = useState<DropMonitorRuntime | null>(null);
  const [rows, setRows] = useState<DropMonitorJobRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [filters, setFilters] = useState({
    dateRange: defaultDateRange,
    pageIndex: 1,
    pageSize: 20,
  });

  const load = useCallback(async (next: typeof filters) => {
    setLoading(true);
    try {
      const [start, end] = next.dateRange;
      const [runtimeData, pageData] = await Promise.all([
        fetchDropMonitorRuntime(),
        fetchDropMonitorJobRecords({
          startDate: start.format("YYYY-MM-DD"),
          endDate: end.add(1, "day").format("YYYY-MM-DD"),
          pageIndex: next.pageIndex,
          pageSize: next.pageSize,
        }),
      ]);
      setRuntime(runtimeData ?? null);
      setRows(pageData?.data ?? []);
      setTotal(pageData?.total ?? 0);
    } catch (error) {
      message.error(error instanceof Error ? error.message : "加载任务运行数据失败");
      setRuntime(null);
      setRows([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(filters);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const search = (patch: Partial<typeof filters>) => {
    const next = { ...filters, ...patch };
    setFilters(next);
    void load(next);
  };

  /** 最近一次运行超过 5 分钟就认为任务停了 */
  const lastRunStale = (() => {
    if (!runtime?.lastJobRunTime) {
      return true;
    }
    return dayjs().diff(dayjs(runtime.lastJobRunTime), "minute") >= 5;
  })();

  const columns: ColumnsType<DropMonitorJobRecord> = [
    { title: "运行时刻", dataIndex: "runTime", width: 180, render: (value: string) => formatDateTime(value) },
    { title: "副本", dataIndex: "node", width: 200, ellipsis: { showTitle: false } , render: ellipsisCell },
    { title: "耗时(ms)", dataIndex: "costMs", width: 100 },
    { title: "扫到", dataIndex: "dispatchFetched", width: 80 },
    { title: "置队列", dataIndex: "dispatchMarked", width: 90 },
    { title: "已投递", dataIndex: "dispatchSubmitted", width: 90 },
    { title: "卡住", dataIndex: "requeueFetched", width: 80 },
    {
      title: (
        <Tooltip title="兜底重投数。持续大于 0 说明队列在丢消息">
          <span>重投</span>
        </Tooltip>
      ),
      dataIndex: "requeueSubmitted",
      width: 90,
      render: (value: number) => (value > 0 ? <Text type="warning">{value}</Text> : value),
    },
    {
      title: (
        <Tooltip title="租约过期被回收的任务数。正常应为 0，不为 0 说明有副本猝死">
          <span>回收</span>
        </Tooltip>
      ),
      dataIndex: "recycled",
      width: 90,
      render: (value: number) => (value > 0 ? <Text type="warning">{value}</Text> : value),
    },
    { title: "回填成本", dataIndex: "repairFilled", width: 100 },
    {
      title: "异常",
      dataIndex: "errorMessage",
      ellipsis: { showTitle: false },
      render: (value: string) =>
        value ? (
          <Tooltip placement="topLeft" title={value}>
            <Text type="danger">{value}</Text>
          </Tooltip>
        ) : (
          "—"
        ),
    },
  ];

  return (
    <Space direction="vertical" size="middle" style={{ width: "100%" }}>
      <Text type="secondary">
        定时任务每分钟跑一轮，做四件事：扫表投递 → 兜底重投 → 租约回收 → 补单成本回填。
        <Text strong>空轮次也会落一行</Text>，否则没法区分「没活干」和「没跑」。流水保留 7 天。
      </Text>

      {lastRunStale ? (
        <Alert
          type="warning"
          showIcon
          message={
            runtime?.lastJobRunTime
              ? `定时任务最近一次运行是 ${formatDateTime(runtime.lastJobRunTime)}，已超过 5 分钟没有新记录 —— 检查 dispatch.flag 是否打开、抢锁副本是否存活`
              : "还没有任何运行记录 —— 检查 shop.drop.monitor.dispatch.flag 是否打开"
          }
        />
      ) : (
        <Alert
          type="success"
          showIcon
          message={`定时任务运行正常，最近一次 ${formatDateTime(runtime?.lastJobRunTime)}（副本 ${runtime?.lastJobNode || "—"}），近 1 小时跑了 ${runtime?.recentJobRuns ?? 0} 轮`}
        />
      )}

      <Row gutter={16}>
        <Col span={5}>
          <Card size="small">
            <Statistic
              title={<Tooltip title="WAITING 且已到检测时间。持续大于每轮 fetch.num 说明产能不够">待检测积压</Tooltip>}
              value={runtime?.backlogNum ?? 0}
              loading={loading}
            />
          </Card>
        </Col>
        <Col span={5}>
          <Card size="small">
            <Statistic
              title={<Tooltip title="已投队列超过 5 分钟还没被消费。持续大于 0 说明消费跟不上或消息在丢">已投未消费</Tooltip>}
              value={runtime?.stuckQueuedNum ?? 0}
              valueStyle={(runtime?.stuckQueuedNum ?? 0) > 0 ? { color: "#d46b08" } : undefined}
              loading={loading}
            />
          </Card>
        </Col>
        <Col span={5}>
          <Card size="small">
            <Statistic
              title={<Tooltip title="CHECKING 且租约已过期还没被回收。正常恒为 0">僵尸任务</Tooltip>}
              value={runtime?.zombieNum ?? 0}
              valueStyle={(runtime?.zombieNum ?? 0) > 0 ? { color: "#cf1322" } : undefined}
              loading={loading}
            />
          </Card>
        </Col>
        <Col span={5}>
          <Card size="small">
            <Statistic title="正在检测中" value={runtime?.checkingNum ?? 0} loading={loading} />
          </Card>
        </Col>
        <Col span={4}>
          <Card size="small">
            <Statistic
              title="近 1 小时异常轮次"
              value={runtime?.recentJobErrors ?? 0}
              valueStyle={(runtime?.recentJobErrors ?? 0) > 0 ? { color: "#cf1322" } : undefined}
              loading={loading}
            />
          </Card>
        </Col>
      </Row>

      <Card size="small">
        <Space size={16} wrap>
          <Text type="secondary">近 1 小时累计：</Text>
          <Tag color="processing">投递 {runtime?.recentDispatchSubmitted ?? 0}</Tag>
          <Tag color={(runtime?.recentRequeueSubmitted ?? 0) > 0 ? "warning" : "default"}>
            兜底重投 {runtime?.recentRequeueSubmitted ?? 0}
          </Tag>
          <Tag color={(runtime?.recentRecycled ?? 0) > 0 ? "warning" : "default"}>
            租约回收 {runtime?.recentRecycled ?? 0}
          </Tag>
          <Text type="secondary" style={{ marginLeft: 16 }}>各副本在处理：</Text>
          {runtime?.nodes?.length ? (
            runtime.nodes.map((node) => (
              <Tag key={node.ownerNode}>
                {node.ownerNode} : {node.checkingNum}
              </Tag>
            ))
          ) : (
            <Text type="secondary">当前没有检测中的任务</Text>
          )}
        </Space>
      </Card>

      <Space>
        <RangePicker
          allowClear={false}
          presets={dateRangePresets}
          value={filters.dateRange}
          onChange={(value) => {
            if (value && value[0] && value[1]) {
              search({ dateRange: [value[0], value[1]], pageIndex: 1 });
            }
          }}
        />
        <Button icon={<ReloadOutlined />} onClick={() => load(filters)} loading={loading}>
          刷新
        </Button>
      </Space>

      <Table<DropMonitorJobRecord>
        rowKey="id"
        size="small"
        loading={loading}
        columns={columns}
        dataSource={rows}
        scroll={{ x: 1300 }}
        pagination={{
          current: filters.pageIndex,
          pageSize: filters.pageSize,
          total,
          showSizeChanger: true,
          showTotal: (value) => `共 ${value} 条`,
        }}
        onChange={(pagination: TablePaginationConfig) =>
          search({ pageIndex: pagination.current ?? 1, pageSize: pagination.pageSize ?? 20 })
        }
      />
    </Space>
  );
}
