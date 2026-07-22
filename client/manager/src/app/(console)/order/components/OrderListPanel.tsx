"use client";

import { useEffect, useMemo, useState } from "react";
import dayjs, { type Dayjs } from "dayjs";
import {
  AppstoreOutlined,
  DownOutlined,
  ReloadOutlined,
  SearchOutlined,
  UpOutlined,
} from "@ant-design/icons";
import { Button, DatePicker, Empty, Input, Progress, Select, Space, Table, Tag, Tooltip, Typography } from "antd";
import { message } from "@/utils/notify";
import type { ColumnsType } from "antd/es/table";
import {
  ORDER_STATUS_OPTIONS,
  fetchOrders,
  type OrderListQuery,
  type OrderRecord,
} from "../api/order.api";
import { fetchProductCategories, type ShopCategoryRecord } from "../../product/api/product.api";

const { RangePicker } = DatePicker;
const { Text } = Typography;

const STATUS_LABELS: Record<string, string> = Object.fromEntries(
  ORDER_STATUS_OPTIONS.map((item) => [item.value, item.label]),
);

const STATUS_COLORS: Record<string, string> = {
  INIT: "default",
  PENDING: "processing",
  DONE: "success",
  UN_CHECK: "warning",
  CHECKED: "success",
  CHECK_ERROR: "error",
  UN_AUTHORIZE: "error",
  DELETE: "default",
  SECRET: "purple",
  REFUND_PENDING: "warning",
  REFUND_HANDING: "warning",
  REFUND: "error",
};

interface Filters {
  orderId: string;
  shopCategoryId?: number;
  userName: string;
  orderStatus?: string;
  channel: string;
  businessId: string;
  orderHash: string;
  businessKey: string;
  externalOrderId: string;
  range: [Dayjs, Dayjs] | null;
}

const emptyFilters: Filters = {
  orderId: "",
  shopCategoryId: undefined,
  userName: "",
  orderStatus: undefined,
  channel: "",
  businessId: "",
  orderHash: "",
  businessKey: "",
  externalOrderId: "",
  range: null,
};

export function OrderListPanel() {
  const [categories, setCategories] = useState<ShopCategoryRecord[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(false);
  const [categorySearch, setCategorySearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<ShopCategoryRecord | null>(null);
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [orderTotal, setOrderTotal] = useState(0);
  const [pageIndex, setPageIndex] = useState(1);
  const [filters, setFilters] = useState<Filters>(emptyFilters);
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const visibleCategories = useMemo(
    () => {
      const keyword = categorySearch.trim().toLowerCase();
      if (!keyword) {
        return categories;
      }
      return categories.filter((category) =>
        [category.name, category.barryShopCategoryCode]
          .some((value) => value.toLowerCase().includes(keyword)),
      );
    },
    [categories, categorySearch],
  );

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

  const buildOrderQuery = (nextPageIndex: number, nextFilters: Filters): OrderListQuery => ({
    pageIndex: nextPageIndex,
    pageSize: 20,
    orderId: toPositiveInteger(nextFilters.orderId),
    shopCategoryId: nextFilters.shopCategoryId,
    userName: nextFilters.userName.trim() || undefined,
    orderStatus: nextFilters.orderStatus || undefined,
    channel: nextFilters.channel.trim() || undefined,
    businessId: nextFilters.businessId.trim() || undefined,
    orderHash: nextFilters.orderHash.trim() || undefined,
    businessKey: nextFilters.businessKey.trim() || undefined,
    externalOrderId: nextFilters.externalOrderId.trim() || undefined,
    startTime: nextFilters.range?.[0]?.format("YYYY-MM-DD HH:mm:ss"),
    endTime: nextFilters.range?.[1]?.format("YYYY-MM-DD HH:mm:ss"),
  });

  const loadOrders = async (nextPageIndex = pageIndex, nextFilters = filters) => {
    setOrdersLoading(true);
    try {
      const result = await fetchOrders(buildOrderQuery(nextPageIndex, nextFilters));
      setOrders(result.data);
      setOrderTotal(result.total);
      setPageIndex(nextPageIndex);
    } catch (error) {
      message.error(error instanceof Error ? error.message : "加载订单失败");
      setOrders([]);
      setOrderTotal(0);
    } finally {
      setOrdersLoading(false);
    }
  };

  useEffect(() => {
    void loadCategories();
  }, []);

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

  const columns: ColumnsType<OrderRecord> = useMemo(
    () => [
      {
        title: "订单信息",
        key: "orderInfo",
        children: [
          {
            title: "订单",
            key: "order",
            width: 172,
            fixed: "left",
            render: (_, record) => (
              <div className="order-record-cell">
                <Text strong className="order-record-cell__order-number">订单 #{record.id}</Text>
                <Tooltip title={record.orderHash || "无订单哈希"}>
                  <Text className="order-record-cell__meta" ellipsis>哈希：{record.orderHash || "-"}</Text>
                </Tooltip>
              </div>
            ),
          },
          {
            title: "商品与下单方",
            key: "orderContext",
            width: 242,
            render: (_, record) => (
              <div className="order-record-cell">
                <Text strong className="order-record-cell__primary" ellipsis>{record.shopName || "-"}</Text>
                <Text className="order-record-cell__meta" ellipsis>类目：{record.shopCategoryName || "-"}</Text>
                <Text className="order-record-cell__meta" ellipsis>下单方：{record.userName || "-"} · {record.tenantName || "-"}</Text>
              </div>
            ),
          },
        ],
      },
      {
        title: "履约进度",
        key: "fulfillment",
        children: [
          {
            title: "状态",
            dataIndex: "orderStatus",
            width: 108,
            render: (value: string) => (
              <Tag className="order-record-status" color={STATUS_COLORS[value] ?? "default"}>
                {STATUS_LABELS[value] ?? value ?? "-"}
              </Tag>
            ),
          },
          {
            title: "订单数量",
            key: "quantity",
            width: 182,
            render: (_, record) => {
              const actualNum = getActualNum(record);
              return (
                <div className="order-record-cell">
                  <div className="order-record-cell__metric-row">
                    <span>下单 {formatNumber(record.orderNum)}</span>
                    <span>完成 {formatNumber(actualNum)}</span>
                  </div>
                  <Progress percent={getProgressPercent(actualNum, record.orderNum)} showInfo={false} size="small" />
                  <Text className="order-record-cell__meta">起始 {formatNumber(record.initNum)}，当前 {formatNumber(record.endNum)}</Text>
                </div>
              );
            },
          },
          {
            title: "分发与提交",
            key: "progress",
            width: 194,
            render: (_, record) => {
              const actualNum = getActualNum(record);
              return (
                <div className="order-record-cell">
                  <div className="order-record-cell__metric-row">
                    <span>已分发 {formatNumber(record.orderAssignNum)}</span>
                    <span>已提交 {formatNumber(record.orderSubmitNum)}</span>
                  </div>
                  <Progress percent={getProgressPercent(record.orderSubmitNum, record.orderAssignNum)} showInfo={false} size="small" />
                  <Text className="order-record-cell__meta">提交率 {formatRate(record.orderSubmitNum, record.orderAssignNum)} · 上量率 {formatRate(actualNum, record.orderAssignNum)}</Text>
                </div>
              );
            },
          },
        ],
      },
      {
        title: "金额与关联",
        key: "financeAndReference",
        children: [
          {
            title: "订单金额",
            key: "amount",
            width: 154,
            render: (_, record) => (
              <div className="order-record-cell">
                <Text strong className="order-record-cell__amount">{record.orderAmount || "0"}</Text>
                <Text className="order-record-cell__meta">单价：{record.price || "0"}</Text>
              </div>
            ),
          },
          {
            title: "业务信息",
            key: "business",
            width: 220,
            render: (_, record) => (
              <div className="order-record-cell">
                <Tooltip title={record.businessId}>
                  <Text className="order-record-cell__primary" ellipsis>业务 ID：{record.businessId || "-"}</Text>
                </Tooltip>
                <Tooltip title={record.businessKey}>
                  <Text className="order-record-cell__meta" ellipsis>视频 ID：{record.businessKey || "-"}</Text>
                </Tooltip>
                <Tooltip title={record.externalOrderId}>
                  <Text className="order-record-cell__meta" ellipsis>外部单号：{record.externalOrderId || "-"}</Text>
                </Tooltip>
              </div>
            ),
          },
          {
            title: "来源与时间",
            key: "sourceTime",
            width: 238,
            render: (_, record) => (
              <div className="order-record-cell">
                <Text className="order-record-cell__primary">渠道：{record.channel || "-"}</Text>
                <Tooltip title={record.tinyUrl}>
                  <Text className="order-record-cell__meta" ellipsis>短链：{record.tinyUrl || "-"}</Text>
                </Tooltip>
                <Text className="order-record-cell__meta">创建：{record.createdTime || "-"}</Text>
                <Text className="order-record-cell__meta">更新：{record.updatedTime || "-"}</Text>
              </div>
            ),
          },
        ],
      },
    ],
    [],
  );

  const handleSearch = () => {
    if (!filters.shopCategoryId) {
      message.info("请先选择商品类目");
      return;
    }
    void loadOrders(1, filters);
  };

  const handleReset = () => {
    setFilters(emptyFilters);
    setSelectedCategory(null);
    setOrders([]);
    setOrderTotal(0);
    setPageIndex(1);
  };

  const handleCategorySelect = (category: ShopCategoryRecord) => {
    const nextCategory = category.id === selectedCategory?.id ? null : category;
    const nextFilters = { ...filters, shopCategoryId: nextCategory?.id };
    setSelectedCategory(nextCategory);
    setFilters(nextFilters);
    void loadOrders(1, nextFilters);
  };

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
          <section className="manager-data-card order-query-panel">
            <div className="order-query-fields">
              <Input
                className="manager-filter-input"
                prefix={<SearchOutlined style={{ color: "var(--manager-text-faint)" }} />}
                placeholder="订单 ID"
                value={filters.orderId}
                onChange={(event) => setFilters((current) => ({ ...current, orderId: event.target.value }))}
                onPressEnter={handleSearch}
              />
              <Input
                className="manager-filter-input"
                placeholder="下单用户"
                value={filters.userName}
                onChange={(event) => setFilters((current) => ({ ...current, userName: event.target.value }))}
                onPressEnter={handleSearch}
              />
              <Select
                className="manager-filter-input"
                allowClear
                placeholder="订单状态"
                value={filters.orderStatus}
                options={ORDER_STATUS_OPTIONS}
                onChange={(value) => setFilters((current) => ({ ...current, orderStatus: value }))}
              />
              <Input
                className="manager-filter-input"
                placeholder="渠道"
                value={filters.channel}
                onChange={(event) => setFilters((current) => ({ ...current, channel: event.target.value }))}
                onPressEnter={handleSearch}
              />
              <RangePicker
                className="order-query-range"
                showTime
                value={filters.range}
                onChange={(value) => setFilters((current) => ({ ...current, range: value as [Dayjs, Dayjs] | null }))}
              />
            </div>

            {advancedOpen && (
              <div className="order-query-fields order-query-fields--advanced">
                <Input className="manager-filter-input" placeholder="业务 ID" value={filters.businessId} onChange={(event) => setFilters((current) => ({ ...current, businessId: event.target.value }))} onPressEnter={handleSearch} />
                <Input className="manager-filter-input" placeholder="订单哈希" value={filters.orderHash} onChange={(event) => setFilters((current) => ({ ...current, orderHash: event.target.value }))} onPressEnter={handleSearch} />
                <Input className="manager-filter-input" placeholder="视频 ID" value={filters.businessKey} onChange={(event) => setFilters((current) => ({ ...current, businessKey: event.target.value }))} onPressEnter={handleSearch} />
                <Input className="manager-filter-input" placeholder="外部订单号" value={filters.externalOrderId} onChange={(event) => setFilters((current) => ({ ...current, externalOrderId: event.target.value }))} onPressEnter={handleSearch} />
              </div>
            )}

            <div className="order-query-actions">
              <Space wrap size={8}>
                <Button type="primary" icon={<SearchOutlined />} loading={ordersLoading} onClick={handleSearch}>查询</Button>
                <Button icon={<ReloadOutlined />} onClick={handleReset}>重置</Button>
                <Button type="text" icon={advancedOpen ? <UpOutlined /> : <DownOutlined />} onClick={() => setAdvancedOpen((open) => !open)}>
                  {advancedOpen ? "收起条件" : "更多条件"}
                </Button>
              </Space>
              <Space size={8}>
                {selectedCategory ? <Tag color="blue">{selectedCategory.name}</Tag> : <Tag>全部类目</Tag>}
                <Tag className="order-query-total">共 {orderTotal} 条</Tag>
              </Space>
            </div>
          </section>

          <section className="manager-data-card manager-table order-records-table order-list-records-table">
            <Table<OrderRecord>
              rowKey="id"
              loading={ordersLoading}
              columns={columns}
              dataSource={orders}
              scroll={{ x: 1598 }}
              locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="当前筛选条件下暂无订单" /> }}
              pagination={{
                current: pageIndex,
                pageSize: 20,
                total: orderTotal,
                showSizeChanger: false,
                showTotal: (total) => `共 ${total} 条`,
                onChange: (nextPage) => void loadOrders(nextPage, filters),
              }}
            />
          </section>
        </div>
      </div>
    </div>
  );
}

function toPositiveInteger(value: string): number | undefined {
  const parsed = Number(value.trim());
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : undefined;
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
