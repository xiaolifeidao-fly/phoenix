"use client";

import { useEffect, useMemo, useState } from "react";
import dayjs, { type Dayjs } from "dayjs";
import localeData from "dayjs/plugin/localeData";
import weekday from "dayjs/plugin/weekday";
import {
  AppstoreOutlined,
  DollarOutlined,
  ProfileOutlined,
  ReloadOutlined,
  RollbackOutlined,
  SearchOutlined,
} from "@ant-design/icons";
import { Button, DatePicker, Empty, Input, Popconfirm, Progress, Select, Space, Table, Tag, Tooltip, Typography } from "antd";
import { message } from "@/utils/notify";
import type { ColumnsType } from "antd/es/table";
import { ORDER_STATUS_OPTIONS, type OrderRecord } from "../api/order.api";
import { useOrderManagement } from "../hooks/useOrderManagement";
import { OrderAmountDetailDrawer } from "./OrderAmountDetailDrawer";
import { OrderBkModal } from "./OrderBkModal";
import { fetchProductCategories, type ShopCategoryRecord } from "../../product/api/product.api";

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
  const { orders, total, query, loading, submitting, refresh, clear, doRefund, doBk } =
    useOrderManagement(false);
  const [categories, setCategories] = useState<ShopCategoryRecord[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(false);
  const [categorySearch, setCategorySearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<ShopCategoryRecord | null>(null);
  const [filters, setFilters] = useState<OrderFilters>(emptyFilters);
  const [detailOrder, setDetailOrder] = useState<OrderRecord | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [bkOrder, setBkOrder] = useState<OrderRecord | null>(null);
  const [bkOpen, setBkOpen] = useState(false);

  const visibleCategories = useMemo(() => {
    const keyword = categorySearch.trim().toLowerCase();
    if (!keyword) {
      return categories;
    }
    return categories.filter((category) =>
      [category.name, category.barryShopCategoryCode]
        .some((value) => value.toLowerCase().includes(keyword)),
    );
  }, [categories, categorySearch]);

  const loadCategories = async () => {
    setCategoriesLoading(true);
    try {
      const result = await fetchProductCategories({ pageIndex: 1, pageSize: 200 });
      setCategories(result.data);
    } catch (error) {
      message.error(error instanceof Error ? error.message : "加载商品类目失败");
    } finally {
      setCategoriesLoading(false);
    }
  };

  useEffect(() => {
    void loadCategories();
  }, []);

  const buildQuery = (pageIndex: number, shopCategoryId = selectedCategory?.id) => ({
    pageIndex,
    shopCategoryId,
    userName: filters.userName.trim() || undefined,
    orderStatus: filters.orderStatus || undefined,
    businessId: filters.businessId.trim() || undefined,
    channel: filters.channel.trim() || undefined,
    startTime: filters.range?.[0] ? filters.range[0].format("YYYY-MM-DD HH:mm:ss") : undefined,
    endTime: filters.range?.[1] ? filters.range[1].format("YYYY-MM-DD HH:mm:ss") : undefined,
  });

  const handleSearch = () => {
    if (!selectedCategory) {
      message.info("请先选择商品类目");
      return;
    }
    void refresh(buildQuery(1));
  };

  const handleReset = () => {
    setFilters(emptyFilters);
    setSelectedCategory(null);
    clear();
  };

  const handleCategorySelect = (category: ShopCategoryRecord) => {
    const nextCategory = category.id === selectedCategory?.id ? null : category;
    setSelectedCategory(nextCategory);
    void refresh(buildQuery(1, nextCategory?.id));
  };

  const categoryColumns: ColumnsType<ShopCategoryRecord> = [
    {
      title: "商品类目",
      dataIndex: "name",
      render: (name: string, record) => (
        <Space direction="vertical" size={1}>
          <Text strong style={{ color: "var(--manager-text)" }}>{name || "未命名类目"}</Text>
          <Text className="manager-value" ellipsis style={{ width: 190 }}>
            {record.barryShopCategoryCode || `类目 #${record.id}`}
          </Text>
        </Space>
      ),
    },
  ];

  const columns: ColumnsType<OrderRecord> = [
    {
      title: "订单",
      key: "order",
      width: 160,
      fixed: "left",
      render: (_, record) => (
        <div className="order-record-cell">
          <Text strong className="order-record-cell__primary">订单 #{record.id}</Text>
          <Tooltip title={record.orderHash || "无订单哈希"}>
            <Text className="order-record-cell__meta" ellipsis>订单哈希：{record.orderHash || "-"}</Text>
          </Tooltip>
        </div>
      ),
    },
    {
      title: "下单方",
      key: "user",
      width: 164,
      render: (_, record) => (
        <div className="order-record-cell">
          <Text strong className="order-record-cell__primary">{record.userName || "-"}</Text>
          <Text className="order-record-cell__meta" ellipsis>租户：{record.tenantName || "-"}</Text>
        </div>
      ),
    },
    {
      title: "商品信息",
      key: "shop",
      width: 210,
      render: (_, record) => (
        <div className="order-record-cell">
          <Text strong className="order-record-cell__primary">{record.shopName || "-"}</Text>
          <Text className="order-record-cell__meta" ellipsis>类目：{record.shopCategoryName || "-"}</Text>
        </div>
      ),
    },
    {
      title: "状态",
      dataIndex: "orderStatus",
      width: 110,
      render: (value: string) => (
        <Tag color={STATUS_COLORS[value] ?? "default"}>{STATUS_LABELS[value] ?? value ?? "-"}</Tag>
      ),
    },
    {
      title: "订单数量",
      key: "num",
      width: 178,
      render: (_, record) => {
        const actualNum = getActualNum(record);
        return (
          <div className="order-record-cell">
            <div className="order-record-cell__metric-row">
              <span>下单 {formatNumber(record.orderNum)}</span>
              <span>完成 {formatNumber(actualNum)}</span>
            </div>
            <Progress percent={getProgressPercent(actualNum, record.orderNum)} showInfo={false} size="small" />
            <Text className="order-record-cell__meta">
              起始 {formatNumber(record.initNum)}，当前 {formatNumber(record.endNum)}
            </Text>
          </div>
        );
      },
    },
    {
      title: "订单金额",
      key: "amount",
      width: 140,
      render: (_, record) => (
        <div className="order-record-cell">
          <Text strong className="order-record-cell__primary">{record.orderAmount || "0"}</Text>
          <Text className="order-record-cell__meta">单价：{record.price || "0"}</Text>
        </div>
      ),
    },
    {
      title: "分发与提交",
      key: "assign",
      width: 184,
      render: (_, record) => (
        <div className="order-record-cell">
          <div className="order-record-cell__metric-row">
            <span>已分发 {formatNumber(record.orderAssignNum)}</span>
            <span>已提交 {formatNumber(record.orderSubmitNum)}</span>
          </div>
          <Progress
            percent={getProgressPercent(record.orderSubmitNum, record.orderAssignNum)}
            showInfo={false}
            size="small"
            strokeColor="var(--manager-accent)"
          />
          <Text className="order-record-cell__meta">
            提交率 {formatRate(record.orderSubmitNum, record.orderAssignNum)}
          </Text>
        </div>
      ),
    },
    {
      title: "业务信息",
      key: "business",
      width: 210,
      render: (_, record) => (
        <div className="order-record-cell">
          <Tooltip title={record.businessId}>
            <Text className="order-record-cell__primary" ellipsis>业务 ID：{record.businessId || "-"}</Text>
          </Tooltip>
          <Tooltip title={record.businessKey}>
            <Text className="order-record-cell__meta" ellipsis>视频 ID：{record.businessKey || "-"}</Text>
          </Tooltip>
        </div>
      ),
    },
    {
      title: "来源与时间",
      key: "sourceTime",
      width: 210,
      render: (_, record) => (
        <div className="order-record-cell">
          <Text className="order-record-cell__primary">渠道：{record.channel || "-"}</Text>
          <Text className="order-record-cell__meta">创建：{record.createdTime || "-"}</Text>
          <Text className="order-record-cell__meta">更新：{record.updatedTime || "-"}</Text>
        </div>
      ),
    },
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
      <div className="order-list-workbench">
        <aside className="manager-data-card order-category-panel">
          <Space direction="vertical" size={14} style={{ width: "100%" }}>
            <div className="order-category-panel__header">
              <Space size={8}>
                <span className="order-category-icon"><AppstoreOutlined /></span>
                <Text strong style={{ color: "var(--manager-text)" }}>商品类目</Text>
              </Space>
              <Button type="text" size="small" icon={<ReloadOutlined />} onClick={() => void loadCategories()} />
            </div>
            <Input
              className="manager-filter-input"
              allowClear
              prefix={<SearchOutlined style={{ color: "var(--manager-text-faint)" }} />}
              placeholder="搜索类目名称或编码"
              value={categorySearch}
              onChange={(event) => setCategorySearch(event.target.value)}
            />
            <Table<ShopCategoryRecord>
              rowKey="id"
              size="small"
              loading={categoriesLoading}
              columns={categoryColumns}
              dataSource={visibleCategories}
              pagination={false}
              locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无商品类目" /> }}
              rowClassName={(record) => `order-category-row${record.id === selectedCategory?.id ? " order-category-row--selected" : ""}`}
              onRow={(record) => ({ onClick: () => handleCategorySelect(record), style: { cursor: "pointer" } })}
              scroll={{ y: "calc(100vh - 310px)" }}
            />
          </Space>
        </aside>

        <div className="order-list-content">
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
                {selectedCategory ? <Tag color="blue">{selectedCategory.name}</Tag> : <Tag>全部类目</Tag>}
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

          <section className="manager-data-card manager-table order-records-table">
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
        </div>
      </div>

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

function getActualNum(record: OrderRecord): number {
  return Math.max(record.endNum - record.initNum, 0);
}

function formatNumber(value: number): string {
  return Number(value || 0).toLocaleString("zh-CN");
}

function formatRate(numerator: number, denominator: number): string {
  if (!denominator || denominator <= 0) {
    return "0.00%";
  }
  return `${((Number(numerator || 0) / denominator) * 100).toFixed(2)}%`;
}

function getProgressPercent(value: number, total: number): number {
  if (!total || total <= 0) {
    return 0;
  }
  return Math.min(Math.round((Math.max(value, 0) / total) * 100), 100);
}
