"use client";

import { useEffect, useState } from "react";
import { ReloadOutlined } from "@ant-design/icons";
import { Button, Drawer, Select, Space, Table, Tag, Typography } from "antd";
import type { ColumnsType } from "antd/es/table";
import { message } from "@/utils/notify";
import {
  fetchProductCategories,
  fetchShopCategoryChangeHistory,
  type ShopCategoryChangeRecord,
  type ShopCategoryRecord,
  type ShopRecord,
} from "../../api/product.api";

const { Text } = Typography;

const DEFAULT_PAGE_SIZE = 20;

interface HistoryFilters {
  shopId: number;
  shopCategoryId: number;
}

interface CategoryPriceHistoryDrawerProps {
  open: boolean;
  onClose: () => void;
  products: ShopRecord[];
}

/** 全部商品类目的调价历史：按时间倒序、服务端分页，可按商品 / 类目筛选 */
export function CategoryPriceHistoryDrawer({ open, onClose, products }: CategoryPriceHistoryDrawerProps) {
  const [records, setRecords] = useState<ShopCategoryChangeRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [pageIndex, setPageIndex] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [filters, setFilters] = useState<HistoryFilters>({ shopId: 0, shopCategoryId: 0 });
  const [shopCategories, setShopCategories] = useState<ShopCategoryRecord[]>([]);

  const productNameMap = new Map(products.map((item) => [item.id, item.name || item.code || `商品#${item.id}`]));

  const load = async (nextPageIndex: number, nextPageSize: number, nextFilters: HistoryFilters) => {
    setLoading(true);
    try {
      const result = await fetchShopCategoryChangeHistory({
        pageIndex: nextPageIndex,
        pageSize: nextPageSize,
        shopId: nextFilters.shopId || undefined,
        shopCategoryId: nextFilters.shopCategoryId || undefined,
      });
      setRecords(result.data);
      setTotal(result.total);
      setPageIndex(nextPageIndex);
      setPageSize(nextPageSize);
    } catch (error) {
      message.error(error instanceof Error ? error.message : "加载调价历史失败");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      void load(1, pageSize, filters);
    }
    // 只在打开时拉第一页，筛选和翻页各自触发
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // 选了商品后，类目下拉只列该商品下的类目
  useEffect(() => {
    if (!filters.shopId) {
      setShopCategories([]);
      return;
    }
    let cancelled = false;
    fetchProductCategories({ pageIndex: 1, pageSize: 200, shopId: filters.shopId })
      .then((result) => {
        if (!cancelled) {
          setShopCategories(result.data);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setShopCategories([]);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [filters.shopId]);

  const applyFilters = (nextFilters: HistoryFilters) => {
    setFilters(nextFilters);
    void load(1, pageSize, nextFilters);
  };

  const columns: ColumnsType<ShopCategoryChangeRecord> = [
    {
      title: "时间",
      dataIndex: "createdTime",
      width: 180,
      render: (value?: string) => formatDateTime(value),
    },
    {
      title: "商品",
      dataIndex: "shopId",
      width: 150,
      render: (value: number) => productNameMap.get(value) || `商品#${value}`,
    },
    {
      title: "类目",
      dataIndex: "shopCategoryName",
      width: 180,
      render: (value: string, record) => (
        <span>
          <Text style={{ color: "var(--manager-text)", fontWeight: 600 }}>{value || "-"}</Text>
          <div style={{ fontSize: 12, color: "var(--manager-text-soft)" }}>ID {record.shopCategoryId}</div>
        </span>
      ),
    },
    {
      title: "旧价格",
      dataIndex: "oldPrice",
      width: 120,
      render: (value: string) => `￥${trimAmount(value) || "0"}`,
    },
    {
      title: "新价格",
      dataIndex: "newPrice",
      width: 120,
      render: (value: string) => <span style={{ fontWeight: 600 }}>￥{trimAmount(value) || "0"}</span>,
    },
    {
      title: "变动",
      key: "priceDelta",
      width: 120,
      render: (_, record) => <PriceDeltaTag oldPrice={record.oldPrice} newPrice={record.newPrice} />,
    },
    {
      title: "旧区间",
      key: "oldRange",
      width: 120,
      render: (_, record) => `${record.oldLowerLimit} / ${record.oldUpperLimit}`,
    },
    {
      title: "新区间",
      key: "newRange",
      width: 120,
      render: (_, record) => `${record.newLowerLimit} / ${record.newUpperLimit}`,
    },
  ];

  return (
    <Drawer
      className="manager-workspace-drawer"
      title="调价历史 · 全部类目"
      open={open}
      width={1080}
      footer={null}
      onClose={onClose}
    >
      <Space wrap size={12} style={{ marginBottom: 16 }}>
        <Select
          allowClear
          showSearch
          optionFilterProp="label"
          placeholder="按商品筛选"
          value={filters.shopId || undefined}
          onChange={(value) => applyFilters({ shopId: Number(value ?? 0), shopCategoryId: 0 })}
          style={{ width: 220 }}
          options={products.map((item) => ({ label: item.name || item.code, value: item.id }))}
        />
        <Select
          allowClear
          showSearch
          optionFilterProp="label"
          placeholder={filters.shopId ? "按类目筛选" : "先选择商品"}
          disabled={!filters.shopId}
          value={filters.shopCategoryId || undefined}
          onChange={(value) => applyFilters({ ...filters, shopCategoryId: Number(value ?? 0) })}
          style={{ width: 220 }}
          options={shopCategories.map((item) => ({ label: item.name || `类目#${item.id}`, value: item.id }))}
        />
        <Button icon={<ReloadOutlined />} onClick={() => void load(pageIndex, pageSize, filters)}>
          刷新
        </Button>
        <Tag style={{ color: "var(--manager-text-soft)", background: "rgba(170,192,238,0.16)", border: "none" }}>
          共 {total} 条
        </Tag>
      </Space>
      <Table<ShopCategoryChangeRecord>
        rowKey="id"
        loading={loading}
        dataSource={records}
        columns={columns}
        scroll={{ x: 1030 }}
        locale={{ emptyText: "暂无调价记录" }}
        pagination={{
          current: pageIndex,
          pageSize,
          total,
          showSizeChanger: true,
          pageSizeOptions: [20, 50, 100],
          showTotal: (value) => `共 ${value} 条`,
          onChange: (page, size) => void load(size !== pageSize ? 1 : page, size, filters),
        }}
      />
    </Drawer>
  );
}

function PriceDeltaTag({ oldPrice, newPrice }: { oldPrice: string; newPrice: string }) {
  const oldValue = Number(oldPrice);
  const newValue = Number(newPrice);
  if (!Number.isFinite(oldValue) || !Number.isFinite(newValue) || oldValue === newValue) {
    return <Tag>价格未变</Tag>;
  }
  const up = newValue > oldValue;
  // 小数价格直接相减会有浮点尾巴，按后端 8 位精度截断再去尾零
  const delta = trimAmount(Math.abs(newValue - oldValue).toFixed(8));
  return <Tag color={up ? "red" : "green"}>{up ? "↑" : "↓"} ￥{delta}</Tag>;
}

/** "1.50000000" → "1.5"，去掉 decimal(38,8) 补的尾零。 */
function trimAmount(value?: string) {
  if (!value) {
    return "";
  }
  return value.includes(".") ? value.replace(/\.?0+$/, "") : value;
}

function formatDateTime(value?: string) {
  if (!value) {
    return "-";
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return parsed.toLocaleString("zh-CN", { hour12: false });
}
