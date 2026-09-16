"use client";

import { useCallback, useEffect, useState } from "react";
import dayjs, { type Dayjs } from "dayjs";
import { ReloadOutlined, SearchOutlined } from "@ant-design/icons";
import { Button, Card, Col, DatePicker, Input, Row, Select, Space, Statistic, Table, Tag, Tooltip, Typography } from "antd";
import type { ColumnsType } from "antd/es/table";
import type { TablePaginationConfig } from "antd/es/table/interface";
import { message } from "@/utils/notify";
import { dateRangePresets } from "@/utils/date-range-presets";
import { fetchManualProducts, type ManualProductRecord } from "../../api/product.api";
import {
  DROP_REPAIR_STATUS_OPTIONS,
  fetchDropRepairDetails,
  fetchDropRepairSummary,
  type DropRepairDetail,
  type DropRepairQuery,
  type DropRepairSummary,
} from "../../api/drop-repair.api";
import { ellipsisCell, formatDateTime } from "./format";

const { RangePicker } = DatePicker;
const { Text } = Typography;

const defaultDateRange: [Dayjs, Dayjs] = [dayjs().startOf("day"), dayjs().startOf("day")];

const statusColor: Record<string, string> = {
  INIT: "default",
  ASSIGNING: "processing",
  DONE: "success",
  FAIL: "error",
  EXPIRE: "warning",
};

const statusLabel: Record<string, string> = {
  INIT: "已建单",
  ASSIGNING: "分发中",
  DONE: "已完成",
  FAIL: "失败",
  EXPIRE: "已过期",
};

export function DropRepairTab() {
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<DropRepairSummary | null>(null);
  const [rows, setRows] = useState<DropRepairDetail[]>([]);
  const [total, setTotal] = useState(0);
  const [products, setProducts] = useState<ManualProductRecord[]>([]);
  const [filters, setFilters] = useState({
    dateRange: defaultDateRange,
    shopCategoryIds: [] as number[],
    oriShopId: "",
    businessId: "",
    status: undefined as string | undefined,
    pageIndex: 1,
    pageSize: 20,
  });

  const buildQuery = (next: typeof filters): DropRepairQuery => {
    const [start, end] = next.dateRange;
    return {
      startDate: start.format("YYYY-MM-DD"),
      // 后端按 [startDate, endDate) 取数, 结束日当天也要算进来
      endDate: end.add(1, "day").format("YYYY-MM-DD"),
      shopCategoryIds: next.shopCategoryIds.length > 0 ? next.shopCategoryIds.join(",") : undefined,
      oriShopId: next.oriShopId.trim() || undefined,
      businessId: next.businessId.trim() || undefined,
      status: next.status,
      pageIndex: next.pageIndex,
      pageSize: next.pageSize,
    };
  };

  const load = useCallback(async (next: typeof filters) => {
    setLoading(true);
    try {
      const query = buildQuery(next);
      const [summaryData, pageData] = await Promise.all([
        fetchDropRepairSummary(query),
        fetchDropRepairDetails(query),
      ]);
      setSummary(summaryData ?? null);
      setRows(pageData?.data ?? []);
      setTotal(pageData?.total ?? 0);
    } catch (error) {
      message.error(error instanceof Error ? error.message : "加载补单数据失败");
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
    // 首屏只加载一次, 后续由查询按钮与分页驱动
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const search = (patch: Partial<typeof filters>) => {
    const next = { ...filters, ...patch };
    setFilters(next);
    void load(next);
  };

  const onTableChange = (pagination: TablePaginationConfig) => {
    search({ pageIndex: pagination.current ?? 1, pageSize: pagination.pageSize ?? 20 });
  };

  const columns: ColumnsType<DropRepairDetail> = [
    { title: "原单号", dataIndex: "originOriShopId", width: 180, ellipsis: { showTitle: false } , render: ellipsisCell },
    { title: "人工商品", dataIndex: "shopCategoryName", width: 140, ellipsis: { showTitle: false } , render: ellipsisCell },
    { title: "链接ID", dataIndex: "businessId", width: 160, ellipsis: { showTitle: false } , render: ellipsisCell },
    { title: "第几次", dataIndex: "round", width: 80 },
    { title: "掉量", dataIndex: "dropNum", width: 90 },
    { title: "补单量", dataIndex: "repairNum", width: 90 },
    { title: "单价", dataIndex: "unitScore", width: 80 },
    {
      title: (
        <Tooltip title="下发即确定 = 补单量 x 单价">
          <span>预估成本</span>
        </Tooltip>
      ),
      dataIndex: "planCost",
      width: 110,
    },
    {
      title: (
        <Tooltip title="补单产生的已审核积分之和, 随补单完成回填">
          <span>实付成本</span>
        </Tooltip>
      ),
      dataIndex: "actualCost",
      width: 110,
    },
    { title: "补单完成量", dataIndex: "finishNum", width: 110 },
    { title: "补单单号", dataIndex: "repairOriShopId", width: 190, ellipsis: { showTitle: false } , render: ellipsisCell },
    {
      title: "状态",
      dataIndex: "status",
      width: 100,
      render: (value: string) => <Tag color={statusColor[value] ?? "default"}>{statusLabel[value] ?? value}</Tag>,
    },
    { title: "补单时间", dataIndex: "repairTime", width: 180, render: (value: string) => formatDateTime(value) },
    { title: "备注", dataIndex: "remark", ellipsis: { showTitle: false } , render: ellipsisCell },
  ];

  return (
    <Space direction="vertical" size="middle" style={{ width: "100%" }}>
      <Text type="secondary">
        已完成的单子在有效期内被检测到掉量后自动补单的记录。成本分预估与实付两个口径：预估在下发时即确定，实付随补单完成回填。
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
            style={{ minWidth: 240 }}
            placeholder="人工商品(默认全部)"
            value={filters.shopCategoryIds}
            onChange={(value) => setFilters({ ...filters, shopCategoryIds: value })}
            options={products.map((item) => ({ label: item.name || item.code, value: item.id }))}
            optionFilterProp="label"
          />
          <Input
            allowClear
            style={{ width: 200 }}
            placeholder="原单号"
            value={filters.oriShopId}
            onChange={(event) => setFilters({ ...filters, oriShopId: event.target.value })}
          />
          <Input
            allowClear
            style={{ width: 200 }}
            placeholder="链接ID"
            value={filters.businessId}
            onChange={(event) => setFilters({ ...filters, businessId: event.target.value })}
          />
          <Select
            allowClear
            style={{ width: 140 }}
            placeholder="补单状态"
            value={filters.status}
            onChange={(value) => setFilters({ ...filters, status: value })}
            options={DROP_REPAIR_STATUS_OPTIONS}
          />
          <Button type="primary" icon={<SearchOutlined />} onClick={() => search({ pageIndex: 1 })}>
            查询
          </Button>
          <Button icon={<ReloadOutlined />} onClick={() => load(filters)} loading={loading}>
            刷新
          </Button>
        </Space>
      </Card>

      <Row gutter={16}>
        <Col span={5}>
          <Card size="small">
            <Statistic title="补单单数" value={summary?.repairOrderNum ?? 0} loading={loading} />
          </Card>
        </Col>
        <Col span={5}>
          <Card size="small">
            <Statistic title="补单总量" value={summary?.repairTotalNum ?? 0} loading={loading} />
          </Card>
        </Col>
        <Col span={5}>
          <Card size="small">
            <Statistic title="预估成本(积分)" value={summary?.planCost ?? 0} loading={loading} />
          </Card>
        </Col>
        <Col span={5}>
          <Card size="small">
            <Statistic title="实付成本(积分)" value={summary?.actualCost ?? 0} loading={loading} />
          </Card>
        </Col>
        <Col span={4}>
          <Card size="small">
            <Statistic title="补单完成量" value={summary?.finishNum ?? 0} loading={loading} />
          </Card>
        </Col>
      </Row>

      <Table<DropRepairDetail>
        rowKey="id"
        size="small"
        loading={loading}
        columns={columns}
        dataSource={rows}
        scroll={{ x: 1800 }}
        pagination={{
          current: filters.pageIndex,
          pageSize: filters.pageSize,
          total,
          showSizeChanger: true,
          showTotal: (value) => `共 ${value} 条`,
        }}
        onChange={onTableChange}
      />
    </Space>
  );
}
