"use client";

import { useEffect, useMemo, useState } from "react";
import dayjs, { type Dayjs } from "dayjs";
import {
  AppstoreOutlined,
  ReloadOutlined,
  SearchOutlined,
} from "@ant-design/icons";
import {
  Button,
  DatePicker,
  Empty,
  Input,
  Select,
  Space,
  Table,
  Tag,
  Tooltip,
  Typography,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import {
  ORDER_STATUS_OPTIONS,
  fetchOrders,
  type OrderListQuery,
  type OrderRecord,
} from "../api/order.api";
import { fetchProducts, type ShopRecord } from "../../product/api/product.api";

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
  userName: string;
  orderStatus?: string;
  businessId: string;
  range: [Dayjs, Dayjs] | null;
}

const emptyFilters: Filters = {
  userName: "",
  orderStatus: undefined,
  businessId: "",
  range: null,
};

export function OrderListPanel() {
  const [products, setProducts] = useState<ShopRecord[]>([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [productSearch, setProductSearch] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<ShopRecord | null>(null);
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [orderTotal, setOrderTotal] = useState(0);
  const [pageIndex, setPageIndex] = useState(1);
  const [filters, setFilters] = useState<Filters>(emptyFilters);

  const loadProducts = async () => {
    setProductsLoading(true);
    try {
      const result = await fetchProducts({ pageIndex: 1, pageSize: 200, name: productSearch.trim() || undefined });
      setProducts(result.data);
    } finally {
      setProductsLoading(false);
    }
  };

  const buildOrderQuery = (nextPageIndex: number): OrderListQuery => ({
    pageIndex: nextPageIndex,
    pageSize: 10,
    shopId: selectedProduct?.id,
    userName: filters.userName.trim() || undefined,
    orderStatus: filters.orderStatus || undefined,
    businessId: filters.businessId.trim() || undefined,
    startTime: filters.range?.[0]?.format("YYYY-MM-DD HH:mm:ss"),
    endTime: filters.range?.[1]?.format("YYYY-MM-DD HH:mm:ss"),
  });

  const loadOrders = async (nextPageIndex = pageIndex) => {
    setOrdersLoading(true);
    try {
      const result = await fetchOrders(buildOrderQuery(nextPageIndex));
      setOrders(result.data);
      setOrderTotal(result.total);
      setPageIndex(nextPageIndex);
    } finally {
      setOrdersLoading(false);
    }
  };

  useEffect(() => {
    void loadProducts();
  }, []);

  useEffect(() => {
    void loadOrders(1);
  }, [selectedProduct]);

  const productColumns: ColumnsType<ShopRecord> = [
    {
      title: "上游商品",
      dataIndex: "name",
      render: (name: string, record) => (
        <div>
          <Text style={{ color: "var(--manager-text)", fontWeight: 600 }}>{name || "未命名商品"}</Text>
          <div className="manager-value" style={{ fontSize: 12, marginTop: 2 }}>
            {record.code || "-"}
          </div>
        </div>
      ),
    },
  ];

  const orderColumns: ColumnsType<OrderRecord> = useMemo(
    () => [
      { title: "订单ID", dataIndex: "id", width: 88, fixed: "left" },
      {
        title: "商品 / 类目",
        key: "shop",
        width: 180,
        render: (_, record) => (
          <div>
            <Text style={{ color: "var(--manager-text)", fontWeight: 600 }}>{record.shopName || "-"}</Text>
            <div className="manager-value" style={{ fontSize: 12 }}>{record.shopCategoryName || "-"}</div>
          </div>
        ),
      },
      { title: "下单用户", dataIndex: "userName", width: 110, render: (value: string) => value || "-" },
      {
        title: "状态",
        dataIndex: "orderStatus",
        width: 108,
        render: (value: string) => (
          <Tag color={STATUS_COLORS[value] ?? "default"}>{STATUS_LABELS[value] ?? value ?? "-"}</Tag>
        ),
      },
      {
        title: "数量(起 / 止 / 实际)",
        key: "numbers",
        width: 166,
        render: (_, record) => (
          <span className="manager-value">
            {record.initNum} / {record.endNum} / {Math.max(record.endNum - record.initNum, 0)}
          </span>
        ),
      },
      { title: "下单数", dataIndex: "orderNum", width: 88 },
      { title: "金额", dataIndex: "orderAmount", width: 100, render: (value: string) => value || "-" },
      {
        title: "分发 / 提交",
        key: "assign",
        width: 118,
        render: (_, record) => (
          <span className="manager-value">{record.orderAssignNum} / {record.orderSubmitNum}</span>
        ),
      },
      {
        title: "业务ID",
        dataIndex: "businessId",
        width: 160,
        ellipsis: true,
        render: (value: string) => (
          <Tooltip title={value}>
            <span className="manager-value">{value || "-"}</span>
          </Tooltip>
        ),
      },
      { title: "创建时间", dataIndex: "createdTime", width: 170, render: (value: string) => value || "-" },
    ],
    [],
  );

  const handleProductSearch = () => void loadProducts();

  const handleOrderSearch = () => void loadOrders(1);

  const resetOrders = () => {
    setFilters(emptyFilters);
    setSelectedProduct(null);
  };

  return (
    <div className="manager-page-stack">
      <div
        className="order-list-workbench"
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(260px, 320px) minmax(0, 1fr)",
          gap: 16,
          alignItems: "start",
        }}
      >
        <section className="manager-data-card order-upstream-panel" style={{ padding: 16, minWidth: 0 }}>
          <Space direction="vertical" size={14} style={{ width: "100%" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <Space size={8}>
                <span className="order-upstream-icon">
                  <AppstoreOutlined />
                </span>
                <Text style={{ color: "var(--manager-text)", fontWeight: 600 }}>上游商品列表</Text>
              </Space>
              <Button type="text" size="small" icon={<ReloadOutlined />} onClick={() => void loadProducts()} />
            </div>
            <Input
              className="manager-filter-input"
              allowClear
              prefix={<SearchOutlined style={{ color: "var(--manager-text-faint)" }} />}
              placeholder="搜索商品名称"
              value={productSearch}
              onChange={(event) => setProductSearch(event.target.value)}
              onPressEnter={handleProductSearch}
              onClear={() => {
                setProductSearch("");
                void fetchProducts({ pageIndex: 1, pageSize: 200 }).then((result) => setProducts(result.data));
              }}
            />
            <Table<ShopRecord>
              rowKey="id"
              size="small"
              loading={productsLoading}
              columns={productColumns}
              dataSource={products}
              pagination={false}
              locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无上游商品" /> }}
              rowClassName={(record) =>
                `order-upstream-product-row${record.id === selectedProduct?.id ? " order-upstream-product-row--selected" : ""}`
              }
              onRow={(record) => ({
                onClick: () => setSelectedProduct(record.id === selectedProduct?.id ? null : record),
                style: { cursor: "pointer" },
              })}
              scroll={{ y: "calc(100vh - 310px)" }}
            />
          </Space>
        </section>

        <section className="manager-data-card manager-table" style={{ minWidth: 0 }}>
          <Space direction="vertical" size={16} style={{ width: "100%" }}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 12, justifyContent: "space-between" }}>
              <Space wrap size={12}>
                <Input
                  className="manager-filter-input"
                  prefix={<SearchOutlined style={{ color: "var(--manager-text-faint)" }} />}
                  placeholder="下单用户"
                  value={filters.userName}
                  onChange={(event) => setFilters((current) => ({ ...current, userName: event.target.value }))}
                  onPressEnter={handleOrderSearch}
                  style={{ width: 150 }}
                />
                <Select
                  className="manager-filter-input"
                  allowClear
                  placeholder="订单状态"
                  value={filters.orderStatus}
                  options={ORDER_STATUS_OPTIONS}
                  onChange={(value) => setFilters((current) => ({ ...current, orderStatus: value }))}
                  style={{ width: 140 }}
                />
                <Input
                  className="manager-filter-input"
                  placeholder="业务ID"
                  value={filters.businessId}
                  onChange={(event) => setFilters((current) => ({ ...current, businessId: event.target.value }))}
                  onPressEnter={handleOrderSearch}
                  style={{ width: 170 }}
                />
                <RangePicker
                  showTime
                  value={filters.range}
                  onChange={(value) => setFilters((current) => ({ ...current, range: value as [Dayjs, Dayjs] | null }))}
                />
                <Button type="primary" icon={<SearchOutlined />} onClick={handleOrderSearch}>查询</Button>
                <Button icon={<ReloadOutlined />} onClick={resetOrders}>重置</Button>
              </Space>
              <Space size={8}>
                {selectedProduct ? <Tag color="blue">{selectedProduct.name}</Tag> : <Tag>全部商品</Tag>}
                <Tag style={{ color: "var(--manager-text-soft)", background: "rgba(170,192,238,0.16)", border: "none" }}>
                  共 {orderTotal} 条
                </Tag>
              </Space>
            </div>
            <Table<OrderRecord>
              rowKey="id"
              loading={ordersLoading}
              columns={orderColumns}
              dataSource={orders}
              scroll={{ x: 1410 }}
              pagination={{
                current: pageIndex,
                pageSize: 10,
                total: orderTotal,
                showSizeChanger: false,
                onChange: (nextPage) => void loadOrders(nextPage),
              }}
            />
          </Space>
        </section>
      </div>
    </div>
  );
}
