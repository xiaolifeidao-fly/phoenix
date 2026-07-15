"use client";

import { useState } from "react";
import dayjs, { type Dayjs } from "dayjs";
import localeData from "dayjs/plugin/localeData";
import weekday from "dayjs/plugin/weekday";
import {
  DollarOutlined,
  ProfileOutlined,
  ReloadOutlined,
  RollbackOutlined,
  SearchOutlined,
} from "@ant-design/icons";
import {
  Button,
  DatePicker,
  Input,
  Popconfirm,
  Select,
  Space,
  Table,
  Tag,
  Tooltip,
  Typography,
  message,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import { ORDER_STATUS_OPTIONS, type OrderRecord } from "../api/order.api";
import { useOrderManagement } from "../hooks/useOrderManagement";
import { OrderAmountDetailDrawer } from "./OrderAmountDetailDrawer";
import { OrderBkModal } from "./OrderBkModal";

const { Text } = Typography;
const { RangePicker } = DatePicker;

dayjs.extend(weekday);
dayjs.extend(localeData);

const STATUS_LABELS: Record<string, string> = Object.fromEntries(
  ORDER_STATUS_OPTIONS.map((item) => [item.value, item.label]),
);

const STATUS_COLORS: Record<string, string> = {
  INIT: "default",
  PENDING: "processing",
  DONE: "success",
  REFUND_PENDING: "warning",
  REFUND_HANDING: "warning",
  REFUND: "error",
};

const REFUNDABLE_STATUS = new Set(["INIT", "PENDING"]);
const BK_STATUS = new Set(["REFUND", "DONE"]);

interface OrderFilters {
  userName: string;
  orderStatus?: string;
  businessId: string;
  channel: string;
  range: [Dayjs, Dayjs] | null;
}

const emptyFilters: OrderFilters = {
  userName: "",
  orderStatus: undefined,
  businessId: "",
  channel: "",
  range: null,
};

export function OrderManagementPanel() {
  const { orders, total, query, loading, submitting, refresh, doRefund, doBk } =
    useOrderManagement();
  const [filters, setFilters] = useState<OrderFilters>(emptyFilters);
  const [detailOrder, setDetailOrder] = useState<OrderRecord | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [bkOrder, setBkOrder] = useState<OrderRecord | null>(null);
  const [bkOpen, setBkOpen] = useState(false);

  const buildQuery = (pageIndex: number) => ({
    pageIndex,
    userName: filters.userName.trim() || undefined,
    orderStatus: filters.orderStatus || undefined,
    businessId: filters.businessId.trim() || undefined,
    channel: filters.channel.trim() || undefined,
    startTime: filters.range?.[0] ? filters.range[0].format("YYYY-MM-DD HH:mm:ss") : undefined,
    endTime: filters.range?.[1] ? filters.range[1].format("YYYY-MM-DD HH:mm:ss") : undefined,
  });

  const handleSearch = () => void refresh(buildQuery(1));

  const handleReset = () => {
    setFilters(emptyFilters);
    void refresh({
      pageIndex: 1,
      userName: undefined,
      orderStatus: undefined,
      businessId: undefined,
      channel: undefined,
      startTime: undefined,
      endTime: undefined,
    });
  };

  const columns: ColumnsType<OrderRecord> = [
    { title: "订单ID", dataIndex: "id", width: 90, fixed: "left" },
    {
      title: "租户",
      dataIndex: "tenantName",
      width: 140,
      render: (value: string) => value || "-",
    },
    {
      title: "商品 / 类目",
      key: "shop",
      width: 200,
      render: (_, record) => (
        <div>
          <Text style={{ color: "var(--manager-text)", fontWeight: 600 }}>
            {record.shopName || "-"}
          </Text>
          <div style={{ color: "var(--manager-text-faint)", fontSize: 12 }}>
            {record.shopCategoryName || "-"}
          </div>
        </div>
      ),
    },
    { title: "下单用户", dataIndex: "userName", width: 120, render: (v: string) => v || "-" },
    {
      title: "状态",
      dataIndex: "orderStatus",
      width: 110,
      render: (value: string) => (
        <Tag color={STATUS_COLORS[value] ?? "default"}>{STATUS_LABELS[value] ?? value ?? "-"}</Tag>
      ),
    },
    {
      title: "数量(起/止/总)",
      key: "num",
      width: 150,
      render: (_, record) => (
        <span className="manager-value">
          {record.initNum} / {record.endNum} / {record.orderNum}
        </span>
      ),
    },
    { title: "单价", dataIndex: "price", width: 110, render: (v: string) => v || "-" },
    { title: "订单金额", dataIndex: "orderAmount", width: 120, render: (v: string) => v || "-" },
    {
      title: "分发 / 提交",
      key: "assign",
      width: 120,
      render: (_, record) => (
        <span className="manager-value">
          {record.orderAssignNum} / {record.orderSubmitNum}
        </span>
      ),
    },
    {
      title: "业务ID",
      dataIndex: "businessId",
      width: 180,
      ellipsis: true,
      render: (value: string) => (
        <Tooltip title={value}>
          <span className="manager-value">{value || "-"}</span>
        </Tooltip>
      ),
    },
    { title: "渠道", dataIndex: "channel", width: 100, render: (v: string) => v || "-" },
    { title: "创建时间", dataIndex: "createdTime", width: 180, render: (v: string) => v || "-" },
    {
      title: "操作",
      key: "actions",
      width: 180,
      fixed: "right",
      render: (_, record) => (
        <Space size={4}>
          <Tooltip title="订单明细">
            <Button
              type="text"
              icon={<ProfileOutlined />}
              onClick={() => {
                setDetailOrder(record);
                setDetailOpen(true);
              }}
            />
          </Tooltip>
          <Tooltip title={REFUNDABLE_STATUS.has(record.orderStatus) ? "退单" : "当前状态不可退单"}>
            <Popconfirm
              title="确认对该订单发起退单？"
              okText="退单"
              cancelText="取消"
              disabled={!REFUNDABLE_STATUS.has(record.orderStatus)}
              onConfirm={async () => {
                try {
                  await doRefund(record.id);
                  message.success("退单请求已发送");
                } catch (error) {
                  message.error(error instanceof Error ? error.message : "退单失败");
                }
              }}
            >
              <Button
                type="text"
                icon={<RollbackOutlined />}
                disabled={!REFUNDABLE_STATUS.has(record.orderStatus)}
              />
            </Popconfirm>
          </Tooltip>
          <Tooltip title={BK_STATUS.has(record.orderStatus) ? "补款" : "当前状态不可补款"}>
            <Button
              type="text"
              icon={<DollarOutlined />}
              disabled={!BK_STATUS.has(record.orderStatus)}
              onClick={() => {
                setBkOrder(record);
                setBkOpen(true);
              }}
            />
          </Tooltip>
        </Space>
      ),
    },
  ];

  return (
    <div className="manager-page-stack">
      <section className="manager-data-card manager-toolbar-panel">
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "space-between" }}>
          <Space wrap size={12}>
            <Input
              className="manager-filter-input"
              prefix={<SearchOutlined style={{ color: "var(--manager-text-faint)" }} />}
              placeholder="下单用户"
              value={filters.userName}
              onChange={(event) =>
                setFilters((current) => ({ ...current, userName: event.target.value }))
              }
              onPressEnter={handleSearch}
              style={{ width: 180, maxWidth: "100%" }}
            />
            <Select
              className="manager-filter-input"
              placeholder="订单状态"
              allowClear
              value={filters.orderStatus}
              options={ORDER_STATUS_OPTIONS}
              onChange={(value) => setFilters((current) => ({ ...current, orderStatus: value }))}
              style={{ width: 160 }}
            />
            <Input
              className="manager-filter-input"
              placeholder="业务ID"
              value={filters.businessId}
              onChange={(event) =>
                setFilters((current) => ({ ...current, businessId: event.target.value }))
              }
              onPressEnter={handleSearch}
              style={{ width: 200, maxWidth: "100%" }}
            />
            <Input
              className="manager-filter-input"
              placeholder="渠道"
              value={filters.channel}
              onChange={(event) =>
                setFilters((current) => ({ ...current, channel: event.target.value }))
              }
              onPressEnter={handleSearch}
              style={{ width: 140, maxWidth: "100%" }}
            />
            <RangePicker
              showTime
              value={filters.range}
              onChange={(value) =>
                setFilters((current) => ({
                  ...current,
                  range: value as [Dayjs, Dayjs] | null,
                }))
              }
            />
            <Button type="primary" icon={<SearchOutlined />} onClick={handleSearch}>
              查询
            </Button>
            <Button icon={<ReloadOutlined />} onClick={handleReset}>
              重置
            </Button>
          </Space>

          <Space wrap>
            <Tag
              style={{
                color: "var(--manager-text-soft)",
                background: "rgba(170,192,238,0.16)",
                border: "none",
              }}
            >
              共 {total} 条
            </Tag>
          </Space>
        </div>
      </section>

      <section className="manager-data-card manager-table">
        <Table<OrderRecord>
          rowKey="id"
          loading={loading}
          dataSource={orders}
          columns={columns}
          scroll={{ x: 1720 }}
          pagination={{
            current: query.pageIndex,
            pageSize: query.pageSize,
            total,
            showSizeChanger: false,
            onChange: (page) => void refresh(buildQuery(page)),
          }}
        />
      </section>

      <OrderAmountDetailDrawer
        open={detailOpen}
        order={detailOrder}
        onClose={() => {
          setDetailOpen(false);
          setDetailOrder(null);
        }}
      />

      <OrderBkModal
        open={bkOpen}
        submitting={submitting}
        order={bkOrder}
        onCancel={() => {
          setBkOpen(false);
          setBkOrder(null);
        }}
        onSubmit={async (num) => {
          try {
            await doBk(bkOrder!.id, num);
            message.success("补款成功");
            setBkOpen(false);
            setBkOrder(null);
          } catch (error) {
            message.error(error instanceof Error ? error.message : "补款失败");
          }
        }}
      />
    </div>
  );
}
