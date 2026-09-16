"use client";

import { useCallback, useEffect, useState } from "react";
import dayjs, { type Dayjs } from "dayjs";
import { ReloadOutlined, SearchOutlined } from "@ant-design/icons";
import { Button, Card, Col, DatePicker, Input, Modal, Row, Select, Space, Statistic, Switch, Table, Tag, Tooltip, Typography } from "antd";
import type { ColumnsType } from "antd/es/table";
import type { TablePaginationConfig } from "antd/es/table/interface";
import { message } from "@/utils/notify";
import { dateRangePresets } from "@/utils/date-range-presets";
import { fetchManualProducts, type ManualProductRecord } from "../../api/product.api";
import {
  DROP_CHECK_RESULT_LABEL,
  DROP_MONITOR_STATUS_OPTIONS,
  fetchDropMonitorDetails,
  fetchDropMonitorRecords,
  fetchDropMonitorSummary,
  type DropMonitorDetail,
  type DropMonitorQuery,
  type DropMonitorRecord,
  type DropMonitorSummary,
} from "../../api/drop-monitor.api";
import { ellipsisCell, formatDateTime } from "./format";

const { RangePicker } = DatePicker;
const { Text } = Typography;

const defaultDateRange: [Dayjs, Dayjs] = [dayjs().startOf("day"), dayjs().startOf("day")];

const statusLabel: Record<string, string> = Object.fromEntries(
  DROP_MONITOR_STATUS_OPTIONS.map((item) => [item.value, item.label]),
);

const statusColor: Record<string, string> = {
  WAITING: "processing",
  QUEUED: "processing",
  CHECKING: "processing",
  EXPIRE: "default",
  DROP_END: "orange",
  STABLE_END: "success",
  INVALID: "warning",
  ERROR: "error",
  SUPERSEDED: "default",
  CLOSED: "default",
};

const resultColor: Record<string, string> = {
  NORMAL: "success",
  DROP: "error",
  SUSPECT: "warning",
  FAIL: "default",
  TIMEOUT: "default",
  INVALID: "warning",
};

/** 分钟转小时，和配置弹窗一个口径 */
const toHourText = (minute?: number | null) => {
  const value = Number(minute);
  if (!Number.isFinite(value) || value <= 0) {
    return "—";
  }
  if (value < 60) {
    return `${Number(value.toFixed(1))} 分钟`;
  }
  return `${Number((value / 60).toFixed(1))} 小时`;
};

export function DropMonitorTab() {
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<DropMonitorSummary | null>(null);
  const [rows, setRows] = useState<DropMonitorDetail[]>([]);
  const [total, setTotal] = useState(0);
  const [products, setProducts] = useState<ManualProductRecord[]>([]);
  const [recordRow, setRecordRow] = useState<DropMonitorDetail | null>(null);
  const [records, setRecords] = useState<DropMonitorRecord[]>([]);
  const [recordLoading, setRecordLoading] = useState(false);
  const [filters, setFilters] = useState({
    dateRange: defaultDateRange,
    shopCategoryIds: [] as number[],
    oriShopId: "",
    businessId: "",
    status: undefined as string | undefined,
    onlyDropped: false,
    pageIndex: 1,
    pageSize: 20,
  });

  const buildQuery = (next: typeof filters): DropMonitorQuery => {
    const [start, end] = next.dateRange;
    return {
      startDate: start.format("YYYY-MM-DD"),
      endDate: end.add(1, "day").format("YYYY-MM-DD"),
      shopCategoryIds: next.shopCategoryIds.length > 0 ? next.shopCategoryIds.join(",") : undefined,
      oriShopId: next.oriShopId.trim() || undefined,
      businessId: next.businessId.trim() || undefined,
      status: next.status,
      onlyDropped: next.onlyDropped || undefined,
      pageIndex: next.pageIndex,
      pageSize: next.pageSize,
    };
  };

  const load = useCallback(async (next: typeof filters) => {
    setLoading(true);
    try {
      const query = buildQuery(next);
      const [summaryData, pageData] = await Promise.all([
        fetchDropMonitorSummary(query),
        fetchDropMonitorDetails(query),
      ]);
      setSummary(summaryData ?? null);
      setRows(pageData?.data ?? []);
      setTotal(pageData?.total ?? 0);
    } catch (error) {
      message.error(error instanceof Error ? error.message : "加载掉量监控数据失败");
      setSummary(null);
      setRows([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(filters);
    fetchManualProducts()
      .then((list) => setProducts(list ?? []))
      .catch(() => setProducts([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const search = (patch: Partial<typeof filters>) => {
    const next = { ...filters, ...patch };
    setFilters(next);
    void load(next);
  };

  const openRecords = async (row: DropMonitorDetail) => {
    setRecordRow(row);
    setRecordLoading(true);
    try {
      setRecords(await fetchDropMonitorRecords(row.id));
    } catch (error) {
      message.error(error instanceof Error ? error.message : "加载检测明细失败");
      setRecords([]);
    } finally {
      setRecordLoading(false);
    }
  };

  const columns: ColumnsType<DropMonitorDetail> = [
    { title: "原单号", dataIndex: "oriShopId", width: 170, ellipsis: { showTitle: false } , render: ellipsisCell },
    { title: "人工商品", dataIndex: "shopCategoryName", width: 130, ellipsis: { showTitle: false } , render: ellipsisCell },
    { title: "链接ID", dataIndex: "businessId", width: 150, ellipsis: { showTitle: false } , render: ellipsisCell },
    { title: "完成时间", dataIndex: "finishTime", width: 170, render: (value: string) => formatDateTime(value) },
    {
      title: (
        <Tooltip title="完成那一刻的结束值，所有掉量都跟它比">
          <span>基线值</span>
        </Tooltip>
      ),
      dataIndex: "baselineNum",
      width: 100,
    },
    { title: "最新值", dataIndex: "lastNum", width: 100 },
    { title: "窗口最低值", dataIndex: "minNum", width: 110 },
    {
      title: "最大掉量",
      dataIndex: "maxDropNum",
      width: 100,
      render: (value: number) => (value > 0 ? <Text type="danger">{value}</Text> : value),
    },
    { title: "掉量次数", dataIndex: "dropTimes", width: 90 },
    { title: "检测次数", dataIndex: "checkTimes", width: 90 },
    { title: "首次掉量", dataIndex: "firstDropTime", width: 170, render: (value: string) => formatDateTime(value) },
    { title: "已补单", dataIndex: "repairTimes", width: 80 },
    {
      title: "状态",
      dataIndex: "status",
      width: 120,
      render: (value: string) => <Tag color={statusColor[value] ?? "default"}>{statusLabel[value] ?? value}</Tag>,
    },
    { title: "下次检测", dataIndex: "nextCheckTime", width: 170, render: (value: string) => formatDateTime(value) },
    { title: "备注", dataIndex: "remark", width: 160, ellipsis: { showTitle: false } , render: ellipsisCell },
    {
      title: "操作",
      key: "actions",
      fixed: "right",
      width: 100,
      render: (_, row) => (
        <Button type="link" size="small" onClick={() => openRecords(row)}>
          检测明细
        </Button>
      ),
    },
  ];

  const recordColumns: ColumnsType<DropMonitorRecord> = [
    { title: "第几次", dataIndex: "round", width: 80 },
    { title: "检测时间", dataIndex: "checkTime", width: 180, render: (value: string) => formatDateTime(value) },
    { title: "基线值", dataIndex: "baselineNum", width: 100 },
    { title: "采到的值", dataIndex: "nowNum", width: 100 },
    { title: "掉量", dataIndex: "dropNum", width: 90 },
    {
      title: "结果",
      dataIndex: "checkResult",
      width: 100,
      render: (value: string) => (
        <Tag color={resultColor[value] ?? "default"}>{DROP_CHECK_RESULT_LABEL[value] ?? value}</Tag>
      ),
    },
    { title: "耗时(ms)", dataIndex: "costMs", width: 100 },
    { title: "说明", dataIndex: "message", ellipsis: { showTitle: false } , render: ellipsisCell },
  ];

  return (
    <Space direction="vertical" size="middle" style={{ width: "100%" }}>
      <Text type="secondary">
        按完成时间统计。<Text strong>不开自动补单也有数据</Text> —— 掉量率和首次掉量时长分布就是用来决定首检延迟、连续无掉量收档次数和补单阈值的依据。
      </Text>

      <Card size="small">
        <Space wrap size="middle">
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
          <Select
            mode="multiple"
            allowClear
            style={{ minWidth: 220 }}
            placeholder="人工商品(默认全部)"
            value={filters.shopCategoryIds}
            onChange={(value) => setFilters({ ...filters, shopCategoryIds: value })}
            options={products.map((item) => ({ label: item.name || item.code, value: item.id }))}
            optionFilterProp="label"
          />
          <Input
            allowClear
            style={{ width: 180 }}
            placeholder="原单号"
            value={filters.oriShopId}
            onChange={(event) => setFilters({ ...filters, oriShopId: event.target.value })}
          />
          <Input
            allowClear
            style={{ width: 180 }}
            placeholder="链接ID"
            value={filters.businessId}
            onChange={(event) => setFilters({ ...filters, businessId: event.target.value })}
          />
          <Select
            allowClear
            style={{ width: 150 }}
            placeholder="状态"
            value={filters.status}
            onChange={(value) => setFilters({ ...filters, status: value })}
            options={DROP_MONITOR_STATUS_OPTIONS}
          />
          <Space size={6}>
            <Text>只看掉量</Text>
            <Switch
              checked={filters.onlyDropped}
              onChange={(checked) => search({ onlyDropped: checked, pageIndex: 1 })}
            />
          </Space>
          <Button type="primary" icon={<SearchOutlined />} onClick={() => search({ pageIndex: 1 })}>
            查询
          </Button>
          <Button icon={<ReloadOutlined />} onClick={() => load(filters)} loading={loading}>
            刷新
          </Button>
        </Space>
      </Card>

      <Row gutter={16}>
        <Col span={4}>
          <Card size="small">
            <Statistic title="建档单数" value={summary?.totalNum ?? 0} loading={loading} />
          </Card>
        </Col>
        <Col span={4}>
          <Card size="small">
            <Statistic title="掉量单数" value={summary?.dropOrderNum ?? 0} loading={loading} />
          </Card>
        </Col>
        <Col span={4}>
          <Card size="small">
            <Statistic title="掉量率" value={summary?.dropRate ?? 0} suffix="%" loading={loading} />
          </Card>
        </Col>
        <Col span={4}>
          <Card size="small">
            <Statistic title="掉了未补" value={summary?.dropNotRepairedNum ?? 0} loading={loading} />
          </Card>
        </Col>
        <Col span={4}>
          <Card size="small">
            <Statistic
              title="首次掉量平均距完成"
              value={toHourText(summary?.avgFirstDropMinute)}
              loading={loading}
            />
          </Card>
        </Col>
        <Col span={4}>
          <Card size="small">
            <Statistic title="检测次数(采集量)" value={summary?.checkTimesNum ?? 0} loading={loading} />
          </Card>
        </Col>
      </Row>

      <Card size="small">
        <Space size={16} wrap>
          <Text type="secondary">状态分布：</Text>
          <Tag color="processing">监控中 {summary?.monitoringNum ?? 0}</Tag>
          <Tag color="success">稳定提前收档 {summary?.stableEndNum ?? 0}</Tag>
          <Tag>续单取代 {summary?.supersededNum ?? 0}</Tag>
          <Tag color="warning">链接失效 {summary?.invalidNum ?? 0}</Tag>
          <Tag color="error">采集异常 {summary?.errorNum ?? 0}</Tag>
          <Text type="secondary">已补单 {summary?.repairOrderNum ?? 0} 单 / 补量 {summary?.repairTotalNum ?? 0}</Text>
        </Space>
      </Card>

      <Table<DropMonitorDetail>
        rowKey="id"
        size="small"
        loading={loading}
        columns={columns}
        dataSource={rows}
        scroll={{ x: 2000 }}
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

      <Modal
        title={`检测明细 - ${recordRow?.oriShopId ?? ""}`}
        open={recordRow !== null}
        onCancel={() => setRecordRow(null)}
        footer={null}
        width={1000}
        destroyOnClose
      >
        <Text type="secondary">
          基线值 {recordRow?.baselineNum ?? "—"}（完成时的结束值），起始值 {recordRow?.startNum ?? "—"}，本单总量{" "}
          {recordRow?.totalNum ?? "—"}。默认只落非“正常”的检测，全量留痕需要打开 record.all。
        </Text>
        <Table<DropMonitorRecord>
          rowKey="id"
          size="small"
          style={{ marginTop: 12 }}
          loading={recordLoading}
          columns={recordColumns}
          dataSource={records}
          pagination={false}
          scroll={{ x: 900, y: 420 }}
        />
      </Modal>
    </Space>
  );
}
