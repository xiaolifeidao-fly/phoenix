"use client";

import { useEffect, useMemo, useState } from "react";
import dayjs, { type Dayjs } from "dayjs";
import localeData from "dayjs/plugin/localeData";
import weekday from "dayjs/plugin/weekday";
import {
  AppstoreOutlined,
  CheckCircleOutlined,
  ClearOutlined,
  ColumnHeightOutlined,
  DollarOutlined,
  DownOutlined,
  ExportOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  ProfileOutlined,
  ReloadOutlined,
  RollbackOutlined,
  SearchOutlined,
  UpOutlined,
  WarningOutlined,
} from "@ant-design/icons";
import {
  Badge,
  Button,
  Checkbox,
  DatePicker,
  Dropdown,
  Empty,
  Input,
  Popconfirm,
  Progress,
  Select,
  Space,
  Table,
  Tag,
  Tooltip,
  Typography,
} from "antd";
import { message } from "@/utils/notify";
import { dateRangePresets } from "@/utils/date-range-presets";
import type { ColumnsType } from "antd/es/table";
import type { TableRowSelection } from "antd/es/table/interface";
import { ORDER_STATUS_OPTIONS, type OrderRecord } from "../api/order.api";
import { useOrderManagement } from "../hooks/useOrderManagement";
import { OrderAmountDetailDrawer } from "./OrderAmountDetailDrawer";
import { OrderBkModal } from "./OrderBkModal";
import { OrderExceptionModal } from "./OrderExceptionModal";
import {
  OrderMetricFilterFields,
  buildMetricQuery,
  emptyMetricFilters,
  validateMetricFilters,
  type OrderMetricFilters,
} from "./OrderMetricFilters";
import { fetchProductCategories, type ShopCategoryRecord } from "../../product/api/product.api";

const { Text } = Typography;
const { RangePicker } = DatePicker;

dayjs.extend(weekday);
dayjs.extend(localeData);

const STATUS_LABELS: Record<string, string> = Object.fromEntries(
  ORDER_STATUS_OPTIONS.map((item) => [item.value, item.label]),
);

/** 状态语义分组，对应 globals.css 中的 order-status-tag--* */
const STATUS_TONE: Record<string, "neutral" | "active" | "success" | "warning" | "danger"> = {
  INIT: "neutral",
  PENDING: "active",
  DONE: "success",
  UN_CHECK: "warning",
  CHECKED: "success",
  CHECK_ERROR: "danger",
  UN_AUTHORIZE: "danger",
  DELETE: "neutral",
  SECRET: "neutral",
  REFUND_PENDING: "warning",
  REFUND_HANDING: "warning",
  REFUND: "danger",
};

const REFUNDABLE_STATUS = new Set(["INIT", "PENDING"]);
const BK_STATUS = new Set(["REFUND", "DONE"]);
/** 未结束的订单才允许强制完成 */
const FORCE_FINISH_STATUS = new Set(["INIT", "PENDING"]);
/** 仅进行中且未标记异常的订单允许打标 */
const canMarkException = (record: OrderRecord) => record.orderStatus === "PENDING" && !record.isAbnormal;

const DENSITY_KEY = "manager.order.density";
const CATEGORY_COLLAPSED_KEY = "manager.order.categoryCollapsed";
const SELECTED_CATEGORY_KEY = "manager.order.categoryScope";

type Density = "default" | "compact";

interface OrderFilters {
  orderId: string;
  userName: string;
  orderStatuses: string[];
  businessId: string;
  businessKey: string;
  externalOrderId: string;
  channel: string;
  range: [Dayjs, Dayjs] | null;
  abnormalOnly: boolean;
}

const emptyFilters: OrderFilters = {
  orderId: "",
  userName: "",
  orderStatuses: [],
  businessId: "",
  businessKey: "",
  externalOrderId: "",
  channel: "",
  range: null,
  abnormalOnly: false,
};

/** 已生效的筛选条件快照，用于渲染条件摘要 */
interface AppliedSnapshot {
  filters: OrderFilters;
  metrics: OrderMetricFilters;
}

interface FilterChip {
  key: string;
  label: string;
  clear: () => { filters: OrderFilters; metrics: OrderMetricFilters };
}

export function OrderManagementPanel() {
  const {
    orders,
    total,
    query,
    loading,
    submitting,
    refresh,
    clear,
    doRefund,
    doBatchRefund,
    doBk,
    doMarkException,
    doBatchMarkException,
    doForceFinish,
  } = useOrderManagement(false);
  const [categories, setCategories] = useState<ShopCategoryRecord[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(false);
  const [categorySearch, setCategorySearch] = useState("");
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<number[]>([]);
  /** 勾选"全部类目"时忽略具体类目，查全量数据 */
  const [allCategories, setAllCategories] = useState(false);
  const [filters, setFilters] = useState<OrderFilters>(emptyFilters);
  const [metricFilters, setMetricFilters] = useState<OrderMetricFilters>(emptyMetricFilters);
  const [applied, setApplied] = useState<AppliedSnapshot | null>(null);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [categoryCollapsed, setCategoryCollapsed] = useState(false);
  const [density, setDensity] = useState<Density>("default");
  const [detailOrder, setDetailOrder] = useState<OrderRecord | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [bkOrder, setBkOrder] = useState<OrderRecord | null>(null);
  const [bkOpen, setBkOpen] = useState(false);
  const [selectedOrderIds, setSelectedOrderIds] = useState<number[]>([]);
  const [exceptionOrder, setExceptionOrder] = useState<OrderRecord | null>(null);
  const [exceptionOpen, setExceptionOpen] = useState(false);
  const [exceptionBatchIds, setExceptionBatchIds] = useState<number[]>([]);

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

  /** restorePrevious=true 时用上次选中的类目自动恢复并查询 */
  const loadCategories = async (restorePrevious = false) => {
    setCategoriesLoading(true);
    try {
      const result = await fetchProductCategories({ pageIndex: 1, pageSize: 200 });
      setCategories(result.data);
      if (restorePrevious) {
        const scope = readCategoryScope();
        if (scope.all) {
          setAllCategories(true);
          runSearch(1, emptyFilters, emptyMetricFilters, true, []);
        } else {
          // 类目可能已被删除或停用，过滤掉列表里不存在的
          const validIds = scope.ids.filter((id) => result.data.some((category) => category.id === id));
          if (validIds.length > 0) {
            setSelectedCategoryIds(validIds);
            runSearch(1, emptyFilters, emptyMetricFilters, false, validIds);
          }
        }
      }
    } catch (error) {
      message.error(error instanceof Error ? error.message : "加载商品类目失败");
    } finally {
      setCategoriesLoading(false);
    }
  };

  useEffect(() => {
    void loadCategories(true);
    setDensity(readStored(DENSITY_KEY) === "compact" ? "compact" : "default");
    setCategoryCollapsed(readStored(CATEGORY_COLLAPSED_KEY) === "1");
  }, []);

  const buildQuery = (
    pageIndex: number,
    scopeAll = allCategories,
    categoryIds = selectedCategoryIds,
    nextFilters = filters,
    nextMetrics = metricFilters,
    pageSize = query.pageSize,
  ) => ({
    pageIndex,
    pageSize,
    // 全部类目时不带类目条件；多选时用逗号分隔的 ID 列表
    shopCategoryId: undefined,
    shopCategoryIds: scopeAll || categoryIds.length === 0 ? undefined : categoryIds.join(","),
    orderId: toPositiveInteger(nextFilters.orderId),
    userName: nextFilters.userName.trim() || undefined,
    orderStatuses: nextFilters.orderStatuses.length > 0 ? nextFilters.orderStatuses.join(",") : undefined,
    businessId: nextFilters.businessId.trim() || undefined,
    businessKey: nextFilters.businessKey.trim() || undefined,
    externalOrderId: nextFilters.externalOrderId.trim() || undefined,
    channel: nextFilters.channel.trim() || undefined,
    abnormalOnly: nextFilters.abnormalOnly || undefined,
    startTime: nextFilters.range?.[0] ? nextFilters.range[0].format("YYYY-MM-DD HH:mm:ss") : undefined,
    endTime: nextFilters.range?.[1] ? nextFilters.range[1].format("YYYY-MM-DD HH:mm:ss") : undefined,
    ...buildMetricQuery(nextMetrics),
  });

  const runSearch = (
    pageIndex: number,
    nextFilters = filters,
    nextMetrics = metricFilters,
    scopeAll = allCategories,
    categoryIds = selectedCategoryIds,
  ) => {
    setSelectedOrderIds([]);
    setApplied({ filters: nextFilters, metrics: nextMetrics });
    void refresh(buildQuery(pageIndex, scopeAll, categoryIds, nextFilters, nextMetrics));
  };

  const handleSearch = () => {
    if (!allCategories && selectedCategoryIds.length === 0) {
      message.info("请先选择商品类目，或勾选「全部类目」");
      return;
    }
    const metricError = validateMetricFilters(metricFilters);
    if (metricError) {
      message.warning(metricError);
      return;
    }
    runSearch(1);
  };

  /** 重置订单筛选，保留当前商品类目范围。 */
  const handleReset = () => {
    setFilters(emptyFilters);
    setMetricFilters(emptyMetricFilters);
    setSelectedOrderIds([]);
    setApplied(null);
    clear();
  };

  /** 只清空筛选条件，保留当前类目并重新查询 */
  const handleClearFilters = () => {
    setFilters(emptyFilters);
    setMetricFilters(emptyMetricFilters);
    if (allCategories || selectedCategoryIds.length > 0) {
      runSearch(1, emptyFilters, emptyMetricFilters);
      return;
    }
    setApplied(null);
  };

  /** 勾选/取消单个类目；当前是"全部"时，点某个类目即切换为只查这一个 */
  const handleCategoryToggle = (categoryId: number) => {
    if (allCategories) {
      applyCategoryScope(false, [categoryId]);
      return;
    }
    const nextIds = selectedCategoryIds.includes(categoryId)
      ? selectedCategoryIds.filter((id) => id !== categoryId)
      : [...selectedCategoryIds, categoryId];
    applyCategoryScope(false, nextIds);
  };

  const handleCategoryScopeChange = (ids: number[]) => applyCategoryScope(false, ids);

  const handleAllCategoriesToggle = (next: boolean) => applyCategoryScope(next, next ? [] : selectedCategoryIds);

  const applyCategoryScope = (scopeAll: boolean, categoryIds: number[]) => {
    setAllCategories(scopeAll);
    setSelectedCategoryIds(categoryIds);
    // 记住范围，下次进入页面直接恢复
    writeCategoryScope(scopeAll, categoryIds);
    if (!scopeAll && categoryIds.length === 0) {
      setSelectedOrderIds([]);
      setApplied(null);
      clear();
      return;
    }
    runSearch(1, filters, metricFilters, scopeAll, categoryIds);
  };

  const handleDensityChange = (next: Density) => {
    setDensity(next);
    writeStored(DENSITY_KEY, next);
  };

  const handleCategoryCollapse = (collapsed: boolean) => {
    setCategoryCollapsed(collapsed);
    writeStored(CATEGORY_COLLAPSED_KEY, collapsed ? "1" : "0");
  };

  /** 已生效条件摘要，点 × 单条移除并重查 */
  const filterChips: FilterChip[] = useMemo(() => {
    if (!applied) {
      return [];
    }
    const { filters: af, metrics: am } = applied;
    const chips: FilterChip[] = [];
    const push = (
      key: string,
      label: string,
      patch: Partial<OrderFilters>,
      metricPatch?: Partial<OrderMetricFilters>,
    ) => {
      chips.push({
        key,
        label,
        clear: () => ({ filters: { ...af, ...patch }, metrics: { ...am, ...metricPatch } }),
      });
    };

    if (af.orderId.trim()) push("orderId", `订单 ID：${af.orderId.trim()}`, { orderId: "" });
    if (af.userName.trim()) push("userName", `下单用户：${af.userName.trim()}`, { userName: "" });
    if (af.orderStatuses.length > 0) {
      push(
        "orderStatus",
        `状态：${af.orderStatuses.map((status) => STATUS_LABELS[status] ?? status).join("、")}`,
        { orderStatuses: [] },
      );
    }
    if (af.channel.trim()) push("channel", `渠道：${af.channel.trim()}`, { channel: "" });
    if (af.range?.[0] && af.range?.[1]) {
      push(
        "range",
        `下单时间：${af.range[0].format("MM-DD HH:mm")} ~ ${af.range[1].format("MM-DD HH:mm")}`,
        { range: null },
      );
    }
    if (af.abnormalOnly) push("abnormalOnly", "仅异常订单", { abnormalOnly: false });
    if (af.businessId.trim()) push("businessId", `下单链接：${af.businessId.trim()}`, { businessId: "" });
    if (af.businessKey.trim()) push("businessKey", `视频 ID：${af.businessKey.trim()}`, { businessKey: "" });
    if (af.externalOrderId.trim()) {
      push("externalOrderId", `外部单号：${af.externalOrderId.trim()}`, { externalOrderId: "" });
    }
    pushRangeChip(chips, af, am, "提交率", "submitRateMin", "submitRateMax", "%");
    pushRangeChip(chips, af, am, "上量率", "growthRateMin", "growthRateMax", "%");
    pushRangeChip(chips, af, am, "分发轮次", "assignFinishTimesMin", "assignFinishTimesMax", "");
    return chips;
  }, [applied]);

  const handleChipClose = (chip: FilterChip) => {
    const next = chip.clear();
    setFilters(next.filters);
    setMetricFilters(next.metrics);
    runSearch(1, next.filters, next.metrics);
  };

  const categoryColumns: ColumnsType<ShopCategoryRecord> = [
    {
      title: "商品类目",
      dataIndex: "name",
      render: (name: string, record) => (
        <div className="order-category-cell">
          <Text strong className="order-category-cell__name">{name || "未命名类目"}</Text>
          <Text className="order-category-cell__code" ellipsis>
            {record.barryShopCategoryCode || `类目 #${record.id}`}
          </Text>
        </div>
      ),
    },
  ];

  const columns: ColumnsType<OrderRecord> = [
    {
      title: "订单 / 业务信息",
      key: "order",
      width: 268,
      fixed: "left",
      render: (_, record) => (
        <div className="order-record-cell">
          <Text
            strong
            className="order-record-cell__primary order-record-cell__id"
            copyable={{ text: String(record.id), tooltips: ["复制订单 ID", "已复制"] }}
          >
            #{record.id}
          </Text>
          <BusinessIdLine value={record.businessId} />
          <Tooltip title={record.businessKey || "无视频 ID"}>
            <Text
              className="order-record-cell__meta"
              ellipsis
              copyable={record.businessKey ? { text: record.businessKey, tooltips: ["复制视频 ID", "已复制"] } : false}
            >
              视频 ID：{record.businessKey || "-"}
            </Text>
          </Tooltip>
          <Tooltip title={record.externalOrderId || "无外部单号"}>
            <Text className="order-record-cell__meta" ellipsis>外部单号：{record.externalOrderId || "-"}</Text>
          </Tooltip>
        </div>
      ),
    },
    {
      title: "商品 / 下单方",
      key: "shopAndUser",
      width: 232,
      render: (_, record) => (
        <div className="order-record-cell">
          <Tooltip title={record.shopName || "无商品名称"}>
            <Text strong className="order-record-cell__primary" ellipsis>{record.shopName || "-"}</Text>
          </Tooltip>
          <Tooltip title={record.shopCategoryName || "无类目"}>
            <Text className="order-record-cell__meta" ellipsis>类目：{record.shopCategoryName || "-"}</Text>
          </Tooltip>
          <Text className="order-record-cell__meta" ellipsis>下单用户：{record.userName || "-"}</Text>
          <Text className="order-record-cell__meta" ellipsis>租户：{record.tenantName || "-"}</Text>
        </div>
      ),
    },
    {
      title: "渠道与时间",
      key: "sourceTime",
      width: 210,
      render: (_, record) => (
        <div className="order-record-cell">
          <Text className="order-record-cell__primary">渠道：{record.channel || "-"}</Text>
          <Text className="order-record-cell__meta">创建：{formatDateTime(record.createdTime)}</Text>
          <Text className="order-record-cell__meta">更新：{formatDateTime(record.updatedTime)}</Text>
        </div>
      ),
    },
    {
      title: "状态",
      dataIndex: "orderStatus",
      width: 118,
      align: "center",
      render: (value: string, record) => (
        <div className="order-record-cell order-record-cell--status order-record-cell--center">
          <span className={`order-status-tag order-status-tag--${STATUS_TONE[value] ?? "neutral"}`}>
            {STATUS_LABELS[value] ?? value ?? "-"}
          </span>
          {record.isAbnormal ? (
            <Tooltip title={record.exceptionReason || "无异常理由"}>
              <span className="order-status-tag order-status-tag--danger order-status-tag--ghost">
                <WarningOutlined /> 异常
              </span>
            </Tooltip>
          ) : null}
        </div>
      ),
    },
    {
      title: "订单数量",
      key: "num",
      width: 186,
      render: (_, record) => {
        const actualNum = getActualNum(record);
        const percent = getProgressPercent(actualNum, record.orderNum);
        return (
          <div className="order-record-cell">
            <div className="order-record-cell__metric-row">
              <span>下单 <b className="order-num">{formatNumber(record.orderNum)}</b></span>
              <span>完成 <b className="order-num">{formatNumber(actualNum)}</b></span>
            </div>
            <Progress
              percent={percent}
              showInfo={false}
              size="small"
              strokeColor={progressColor(percent)}
            />
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
      align: "right",
      render: (_, record) => (
        <div className="order-record-cell order-record-cell--amount">
          <Text strong className="order-record-cell__primary order-num">{record.orderAmount || "0"}</Text>
          <Text className="order-record-cell__meta">单价 {record.price || "0"}</Text>
        </div>
      ),
    },
    {
      title: "分发与提交",
      key: "assign",
      width: 230,
      render: (_, record) => {
        const percent = getProgressPercent(record.orderSubmitNum, record.orderAssignNum);
        return (
          <div className="order-record-cell">
            <div className="order-record-cell__metric-row">
              <span>已分发 <b className="order-num">{formatNumber(record.orderAssignNum)}</b></span>
              <span>已提交 <b className="order-num">{formatNumber(record.orderSubmitNum)}</b></span>
            </div>
            <Progress percent={percent} showInfo={false} size="small" strokeColor={progressColor(percent)} />
            <div className="order-record-cell__rate-row">
              <span className="order-record-cell__rate">
                提交率 {renderRate(record.orderSubmitNum, record.orderAssignNum)}
              </span>
              <span className="order-record-cell__rate">
                上量率 {renderRate(getActualNum(record), record.orderAssignNum)}
              </span>
              <span className="order-record-cell__rate">
                轮次 <b className="order-num">{formatNumber(record.assignFinishTimes)}</b>
              </span>
            </div>
          </div>
        );
      },
    },
    {
      title: "异常理由",
      dataIndex: "exceptionReason",
      width: 200,
      render: (reason: string) => (
        <Tooltip title={reason || "无异常理由"}>
          <Text className="order-record-cell__meta" ellipsis>{reason || "-"}</Text>
        </Tooltip>
      ),
    },
    {
      title: "操作",
      key: "actions",
      width: 212,
      fixed: "right",
      align: "center",
      className: "order-actions-cell",
      render: (_, record) => (
        <Space size={2} className="order-row-actions">
          <Tooltip title="订单明细">
            <Button
              type="text"
              className="order-row-action"
              icon={<ProfileOutlined />}
              aria-label="订单明细"
              onClick={() => {
                setDetailOrder(record);
                setDetailOpen(true);
              }}
            />
          </Tooltip>
          <Tooltip title={FORCE_FINISH_STATUS.has(record.orderStatus) ? "强制完成" : "当前状态不可强制完成"}>
            <Popconfirm
              title="确认强制完成该订单？"
              description="将停止分发、把订单置为完成并通知上游，操作不可撤销。"
              okText="强制完成"
              cancelText="取消"
              disabled={!FORCE_FINISH_STATUS.has(record.orderStatus)}
              onConfirm={() => void handleForceFinish([record.id])}
            >
              <Button
                type="text"
                className="order-row-action order-row-action--success"
                icon={<CheckCircleOutlined />}
                aria-label="强制完成"
                disabled={!FORCE_FINISH_STATUS.has(record.orderStatus)}
              />
            </Popconfirm>
          </Tooltip>
          <Tooltip title={canMarkException(record) ? "标记异常并停止分发" : "仅进行中且未标记异常的订单可打标"}>
            <Button
              type="text"
              className="order-row-action order-row-action--warning"
              icon={<WarningOutlined />}
              aria-label="标记异常"
              disabled={!canMarkException(record)}
              onClick={() => {
                setExceptionOrder(record);
                setExceptionBatchIds([]);
                setExceptionOpen(true);
              }}
            />
          </Tooltip>
          <Tooltip title={REFUNDABLE_STATUS.has(record.orderStatus) ? "退单" : "当前状态不可退单"}>
            <Popconfirm
              title="确认对该订单发起退单？"
              description="退单请求将同步给上游，请确认订单号无误。"
              okText="退单"
              okButtonProps={{ danger: true }}
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
                className="order-row-action order-row-action--danger"
                icon={<RollbackOutlined />}
                aria-label="退单"
                disabled={!REFUNDABLE_STATUS.has(record.orderStatus)}
              />
            </Popconfirm>
          </Tooltip>
          <Tooltip title={BK_STATUS.has(record.orderStatus) ? "补款" : "当前状态不可补款"}>
            <Button
              type="text"
              className="order-row-action"
              icon={<DollarOutlined />}
              aria-label="补款"
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

  const selectedOrders = orders.filter((order) => selectedOrderIds.includes(order.id));
  const refundableSelectedIds = selectedOrders
    .filter((order) => REFUNDABLE_STATUS.has(order.orderStatus))
    .map((order) => order.id);
  const exceptionSelectedIds = selectedOrders.filter(canMarkException).map((order) => order.id);
  const forceFinishSelectedIds = selectedOrders
    .filter((order) => FORCE_FINISH_STATUS.has(order.orderStatus))
    .map((order) => order.id);

  const handleForceFinish = async (orderIds: number[]) => {
    try {
      const result = await doForceFinish(orderIds);
      setSelectedOrderIds([]);
      if (result.failed === 0) {
        message.success(`已强制完成 ${result.succeeded} 笔订单`);
        return;
      }
      const firstFailure = result.failures[0];
      message.warning(
        `已完成 ${result.succeeded} 笔，${result.failed} 笔失败${firstFailure ? `：订单 #${firstFailure.orderId} ${firstFailure.message}` : ""}`,
      );
    } catch (error) {
      message.error(error instanceof Error ? error.message : "强制完成失败");
    }
  };

  const handleBatchException = async (reason: string) => {
    const result = await doBatchMarkException(exceptionBatchIds, reason);
    setExceptionOpen(false);
    setExceptionBatchIds([]);
    setSelectedOrderIds([]);
    if (result.failed === 0) {
      message.success(`已标记 ${result.succeeded} 笔订单异常`);
      return;
    }
    const firstFailure = result.failures[0];
    message.warning(
      `已标记 ${result.succeeded} 笔，${result.failed} 笔失败${firstFailure ? `：订单 #${firstFailure.orderId} ${firstFailure.message}` : ""}`,
    );
  };

  const handleBatchRefund = async () => {
    try {
      const result = await doBatchRefund(refundableSelectedIds);
      setSelectedOrderIds([]);
      if (result.failed === 0) {
        message.success(`已提交 ${result.succeeded} 笔订单的退单请求`);
      } else {
        const firstFailure = result.failures[0];
        message.warning(
          `已提交 ${result.succeeded} 笔退单，${result.failed} 笔未成功${firstFailure ? `：订单 #${firstFailure.orderId} ${firstFailure.message}` : ""}`,
        );
      }
    } catch (error) {
      message.error(error instanceof Error ? error.message : "批量退单失败");
    }
  };

  const rowSelection: TableRowSelection<OrderRecord> = {
    selectedRowKeys: selectedOrderIds,
    onChange: (keys) => setSelectedOrderIds(keys.map((key) => Number(key))),
    columnWidth: 44,
    fixed: "left",
    getCheckboxProps: (record: OrderRecord) => ({
      // 可批量退单或可批量打标的订单都允许勾选，具体可执行的操作由按钮各自判断
      disabled:
        !REFUNDABLE_STATUS.has(record.orderStatus) &&
        !canMarkException(record) &&
        !FORCE_FINISH_STATUS.has(record.orderStatus),
    }),
  };

  const hasSelection = selectedOrderIds.length > 0;

  const hasScope = allCategories || selectedCategoryIds.length > 0;
  const emptyText = !hasScope ? (
    <Empty
      image={Empty.PRESENTED_IMAGE_SIMPLE}
      description={<span className="order-empty__title">先从左侧勾选商品类目，或勾选「全部类目」</span>}
    />
  ) : (
    <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={<span className="order-empty__title">当前条件下没有订单</span>}>
      {filterChips.length > 0 ? (
        <Button size="small" icon={<ClearOutlined />} onClick={handleClearFilters}>
          清空筛选条件
        </Button>
      ) : null}
    </Empty>
  );

  return (
    <div className="manager-page-stack">
      <div className={`order-list-workbench${categoryCollapsed ? " order-list-workbench--category-collapsed" : ""}`}>
        <aside className={`manager-data-card order-category-panel${categoryCollapsed ? " order-category-panel--collapsed" : ""}`}>
          {categoryCollapsed ? (
            <Tooltip title="展开商品类目" placement="right">
              <Button
                type="text"
                className="order-category-panel__collapse-button"
                icon={<MenuUnfoldOutlined />}
                aria-label="展开商品类目"
                onClick={() => handleCategoryCollapse(false)}
              />
            </Tooltip>
          ) : (
            <Space direction="vertical" size={14} style={{ width: "100%" }}>
              <div className="order-category-panel__header">
                <Space size={8}>
                  <span className="order-category-icon"><AppstoreOutlined /></span>
                  <Text strong style={{ color: "var(--manager-text)" }}>商品类目</Text>
                </Space>
                <Space size={2}>
                  <Tooltip title="刷新类目">
                    <Button type="text" size="small" icon={<ReloadOutlined />} aria-label="刷新类目" onClick={() => void loadCategories()} />
                  </Tooltip>
                  <Tooltip title="收起商品类目">
                    <Button
                      type="text"
                      size="small"
                      icon={<MenuFoldOutlined />}
                      aria-label="收起商品类目"
                      onClick={() => handleCategoryCollapse(true)}
                    />
                  </Tooltip>
                </Space>
              </div>
              <Input
                className="manager-filter-input"
                allowClear
                prefix={<SearchOutlined style={{ color: "var(--manager-text-faint)" }} />}
                placeholder="搜索类目名称或编码"
                value={categorySearch}
                onChange={(event) => setCategorySearch(event.target.value)}
              />
              <label className="order-category-all">
                <Checkbox
                  checked={allCategories}
                  onChange={(event) => handleAllCategoriesToggle(event.target.checked)}
                >
                  全部类目
                </Checkbox>
                <span className="order-category-all__hint">查询所有类目的订单</span>
              </label>
              <Table<ShopCategoryRecord>
                rowKey="id"
                size="small"
                showHeader={false}
                loading={categoriesLoading}
                columns={categoryColumns}
                dataSource={visibleCategories}
                pagination={false}
                locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无商品类目" /> }}
                rowSelection={{
                  selectedRowKeys: selectedCategoryIds,
                  onChange: (keys) => handleCategoryScopeChange(keys.map((key) => Number(key))),
                  columnWidth: 36,
                }}
                rowClassName={(record) =>
                  `order-category-row${selectedCategoryIds.includes(record.id) ? " order-category-row--selected" : ""}`
                }
                onRow={(record) => ({
                  onClick: () => handleCategoryToggle(record.id),
                  style: { cursor: "pointer" },
                })}
                scroll={{ y: "calc(100vh - 348px)" }}
              />
            </Space>
          )}
        </aside>

        <div className="order-list-content">
          <section className="manager-data-card order-query-panel">
            <div className="order-query-header">
              <div className="order-query-header__title">
                <Text strong className="order-query-header__heading">订单管理</Text>
                {allCategories ? (
                  <span className="order-scope-tag">全部类目</span>
                ) : selectedCategoryIds.length === 1 ? (
                  <span className="order-scope-tag">
                    {categories.find((category) => category.id === selectedCategoryIds[0])?.name ?? "已选 1 个类目"}
                  </span>
                ) : selectedCategoryIds.length > 1 ? (
                  <Tooltip
                    title={categories
                      .filter((category) => selectedCategoryIds.includes(category.id))
                      .map((category) => category.name)
                      .join("、")}
                  >
                    <span className="order-scope-tag">已选 {selectedCategoryIds.length} 个类目</span>
                  </Tooltip>
                ) : (
                  <span className="order-scope-tag order-scope-tag--muted">未选择类目</span>
                )}
                <span className="order-total-tag">
                  共 <b className="order-num">{total.toLocaleString("zh-CN")}</b> 条
                </span>
              </div>
              <Space size={4}>
                <Tooltip title="刷新数据">
                  <Button
                    type="text"
                    icon={<ReloadOutlined />}
                    aria-label="刷新数据"
                    loading={loading}
                    disabled={!hasScope}
                    onClick={() => void refresh()}
                  />
                </Tooltip>
                <Dropdown
                  trigger={["click"]}
                  menu={{
                    selectable: true,
                    selectedKeys: [density],
                    items: [
                      { key: "default", label: "标准" },
                      { key: "compact", label: "紧凑" },
                    ],
                    onClick: ({ key }) => handleDensityChange(key as Density),
                  }}
                >
                  <Tooltip title="行高">
                    <Button type="text" icon={<ColumnHeightOutlined />} aria-label="行高" />
                  </Tooltip>
                </Dropdown>
              </Space>
            </div>

            <div className="order-query-fields">
              <Field label="订单 ID">
                <Input
                  className="manager-filter-input"
                  allowClear
                  prefix={<SearchOutlined style={{ color: "var(--manager-text-faint)" }} />}
                  placeholder="精确匹配"
                  value={filters.orderId}
                  onChange={(event) => setFilters((current) => ({ ...current, orderId: event.target.value }))}
                  onPressEnter={handleSearch}
                />
              </Field>
              <Field label="下单用户">
                <Input
                  className="manager-filter-input"
                  allowClear
                  placeholder="支持模糊匹配"
                  value={filters.userName}
                  onChange={(event) => setFilters((current) => ({ ...current, userName: event.target.value }))}
                  onPressEnter={handleSearch}
                />
              </Field>
              <Field label="订单状态">
                <Select
                  className="manager-filter-input"
                  mode="multiple"
                  placeholder="全部状态"
                  allowClear
                  maxTagCount="responsive"
                  value={filters.orderStatuses}
                  options={ORDER_STATUS_OPTIONS}
                  onChange={(value) => setFilters((current) => ({ ...current, orderStatuses: value }))}
                />
              </Field>
              <Field label="渠道">
                <Input
                  className="manager-filter-input"
                  allowClear
                  placeholder="全部渠道"
                  value={filters.channel}
                  onChange={(event) => setFilters((current) => ({ ...current, channel: event.target.value }))}
                  onPressEnter={handleSearch}
                />
              </Field>
              <Field label="下单时间">
                <RangePicker
                  className="order-query-range"
                  showTime
                  presets={dateRangePresets}
                  value={filters.range}
                  onChange={(value) => setFilters((current) => ({ ...current, range: value as [Dayjs, Dayjs] | null }))}
                />
              </Field>
            </div>

            {advancedOpen && (
              <div className="order-query-fields order-query-fields--advanced">
                <Field label="下单链接">
                  <Input className="manager-filter-input" allowClear placeholder="支持模糊匹配" value={filters.businessId} onChange={(event) => setFilters((current) => ({ ...current, businessId: event.target.value }))} onPressEnter={handleSearch} />
                </Field>
                <Field label="视频 ID">
                  <Input className="manager-filter-input" allowClear placeholder="精确匹配" value={filters.businessKey} onChange={(event) => setFilters((current) => ({ ...current, businessKey: event.target.value }))} onPressEnter={handleSearch} />
                </Field>
                <Field label="外部订单号">
                  <Input className="manager-filter-input" allowClear placeholder="精确匹配" value={filters.externalOrderId} onChange={(event) => setFilters((current) => ({ ...current, externalOrderId: event.target.value }))} onPressEnter={handleSearch} />
                </Field>
                <OrderMetricFilterFields
                  value={metricFilters}
                  onChange={setMetricFilters}
                  onSubmit={handleSearch}
                />
              </div>
            )}

            <div className="order-query-actions">
              <Space wrap size={8}>
                <Button type="primary" icon={<SearchOutlined />} loading={loading} onClick={handleSearch}>
                  查询
                </Button>
                <Button icon={<ReloadOutlined />} onClick={handleReset}>
                  重置
                </Button>
                <Button type="text" icon={advancedOpen ? <UpOutlined /> : <DownOutlined />} onClick={() => setAdvancedOpen((open) => !open)}>
                  {advancedOpen ? "收起条件" : "更多条件"}
                </Button>
                <Checkbox
                  checked={filters.abnormalOnly}
                  onChange={(event) => setFilters((current) => ({ ...current, abnormalOnly: event.target.checked }))}
                >
                  仅异常订单
                </Checkbox>
              </Space>
            </div>

            {filterChips.length > 0 && (
              <div className="order-filter-summary">
                <span className="order-filter-summary__label">已生效</span>
                <div className="order-filter-summary__chips">
                  {filterChips.map((chip) => (
                    <Tag key={chip.key} closable className="order-filter-chip" onClose={() => handleChipClose(chip)}>
                      {chip.label}
                    </Tag>
                  ))}
                </div>
                <Button type="link" size="small" icon={<ClearOutlined />} onClick={handleClearFilters}>
                  清空
                </Button>
              </div>
            )}
          </section>

          {hasSelection && (
            <section className="order-selection-bar">
              <div className="order-selection-bar__info">
                <Badge
                  count={selectedOrderIds.length}
                  overflowCount={999}
                  style={{ background: "var(--manager-primary)" }}
                />
                <Text className="order-selection-bar__text">
                  已选 {selectedOrderIds.length} 笔 · 可强制完成 {forceFinishSelectedIds.length} 笔 · 可退单 {refundableSelectedIds.length} 笔 · 可打标 {exceptionSelectedIds.length} 笔
                </Text>
              </div>
              <Space wrap size={8}>
                <Popconfirm
                  title={`确认强制完成已选的 ${forceFinishSelectedIds.length} 笔订单？`}
                  description="将逐单停止分发、置为完成并通知上游，操作不可撤销。"
                  okText="强制完成"
                  cancelText="取消"
                  disabled={forceFinishSelectedIds.length === 0}
                  onConfirm={() => void handleForceFinish(forceFinishSelectedIds)}
                >
                  <Tooltip title={forceFinishSelectedIds.length === 0 ? "所选订单中没有可强制完成的订单" : ""}>
                    <Button
                      icon={<CheckCircleOutlined />}
                      disabled={forceFinishSelectedIds.length === 0}
                      loading={submitting}
                    >
                      批量强制完成{forceFinishSelectedIds.length > 0 ? ` (${forceFinishSelectedIds.length})` : ""}
                    </Button>
                  </Tooltip>
                </Popconfirm>
                <Tooltip title={exceptionSelectedIds.length === 0 ? "所选订单中没有可打标的订单" : ""}>
                  <Button
                    icon={<WarningOutlined />}
                    disabled={exceptionSelectedIds.length === 0}
                    loading={submitting}
                    onClick={() => {
                      setExceptionOrder(null);
                      setExceptionBatchIds(exceptionSelectedIds);
                      setExceptionOpen(true);
                    }}
                  >
                    批量打标异常{exceptionSelectedIds.length > 0 ? ` (${exceptionSelectedIds.length})` : ""}
                  </Button>
                </Tooltip>
                <Popconfirm
                  title={`确认对已选的 ${refundableSelectedIds.length} 笔订单发起退单？`}
                  description="退单请求将逐笔同步给上游，失败的订单会单独提示。"
                  okText="批量退单"
                  okButtonProps={{ danger: true }}
                  cancelText="取消"
                  disabled={refundableSelectedIds.length === 0}
                  onConfirm={() => void handleBatchRefund()}
                >
                  <Tooltip title={refundableSelectedIds.length === 0 ? "所选订单中没有可退单的订单" : ""}>
                    <Button
                      danger
                      icon={<RollbackOutlined />}
                      disabled={refundableSelectedIds.length === 0}
                      loading={submitting}
                    >
                      批量退单{refundableSelectedIds.length > 0 ? ` (${refundableSelectedIds.length})` : ""}
                    </Button>
                  </Tooltip>
                </Popconfirm>
                <Button type="text" onClick={() => setSelectedOrderIds([])}>
                  取消选择
                </Button>
              </Space>
            </section>
          )}

          <section className={`manager-data-card manager-table order-records-table${density === "compact" ? " order-records-table--compact" : ""}`}>
            <Table<OrderRecord>
              rowKey="id"
              loading={loading}
              dataSource={orders}
              columns={columns}
              rowSelection={rowSelection}
              size={density === "compact" ? "small" : "middle"}
              tableLayout="fixed"
              sticky={{ offsetHeader: 0 }}
              scroll={{ x: 1900 }}
              locale={{ emptyText }}
              rowClassName={(record) => (record.isAbnormal ? "order-record-row order-record-row--abnormal" : "order-record-row")}
              pagination={{
                current: query.pageIndex,
                pageSize: query.pageSize,
                total,
                showSizeChanger: true,
                showQuickJumper: total > (query.pageSize ?? 10),
                pageSizeOptions: [10, 20, 50, 100],
                showTotal: (count, range) => `第 ${range[0]}-${range[1]} 条 / 共 ${count} 条`,
                onChange: (page, pageSize) => {
                  setSelectedOrderIds([]);
                  void refresh(buildQuery(page, allCategories, selectedCategoryIds, filters, metricFilters, pageSize));
                },
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

      <OrderExceptionModal
        open={exceptionOpen}
        submitting={submitting}
        order={exceptionOrder}
        batchCount={exceptionBatchIds.length}
        onCancel={() => {
          setExceptionOpen(false);
          setExceptionOrder(null);
          setExceptionBatchIds([]);
        }}
        onSubmit={async (reason) => {
          if (exceptionOrder) {
            try {
              await doMarkException(exceptionOrder.id, reason);
              message.success("已标记异常并停止分发");
              setExceptionOpen(false);
              setExceptionOrder(null);
            } catch (error) {
              message.error(error instanceof Error ? error.message : "标记异常失败");
            }
            return;
          }
          try {
            await handleBatchException(reason);
          } catch (error) {
            message.error(error instanceof Error ? error.message : "批量标记异常失败");
          }
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

/** 匹配文本中的 http(s) 链接，允许前后有其他说明文字 */
const URL_PATTERN = /https?:\/\/[^\s"'，,；;、）)】\]]+/i;

/** 下单链接：取出其中的 http 部分渲染成可跳转外链，其余按纯文本展示 */
function BusinessIdLine({ value }: { value: string }) {
  const businessId = (value || "").trim();
  if (!businessId) {
    return (
      <span className="order-link-empty">
        <WarningOutlined /> 下单链接：空链接
      </span>
    );
  }
  const match = businessId.match(URL_PATTERN);
  const url = match?.[0];
  const matchIndex = match?.index ?? 0;
  const prefix = url ? businessId.slice(0, matchIndex) : businessId;
  const suffix = url ? businessId.slice(matchIndex + url.length) : "";
  return (
    <div className="order-link-line">
      <Tooltip title={businessId}>
        <Text
          className="order-record-cell__meta order-link-line__text"
          ellipsis
          copyable={{ text: url ?? businessId, tooltips: [url ? "复制下单链接" : "复制内容", "已复制"] }}
        >
          下单链接：
          {prefix}
          {url ? (
            <a
              className="order-record-cell__link"
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(event) => event.stopPropagation()}
            >
              {url}
            </a>
          ) : null}
          {suffix}
        </Text>
      </Tooltip>
      {url ? (
        <Tooltip title="新标签页打开">
          <a
            className="order-link-open"
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="新标签页打开下单链接"
            onClick={(event) => event.stopPropagation()}
          >
            <ExportOutlined />
          </a>
        </Tooltip>
      ) : null}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="order-field">
      <span className="order-field__label">{label}</span>
      {children}
    </label>
  );
}

function pushRangeChip(
  chips: FilterChip[],
  filters: OrderFilters,
  metrics: OrderMetricFilters,
  label: string,
  minKey: keyof OrderMetricFilters,
  maxKey: keyof OrderMetricFilters,
  unit: string,
) {
  const min = metrics[minKey];
  const max = metrics[maxKey];
  if (min === null && max === null) {
    return;
  }
  const text = `${label}：${min === null ? "不限" : `${min}${unit}`} ~ ${max === null ? "不限" : `${max}${unit}`}`;
  chips.push({
    key: String(minKey),
    label: text,
    clear: () => ({ filters, metrics: { ...metrics, [minKey]: null, [maxKey]: null } }),
  });
}

interface CategoryScope {
  all: boolean;
  ids: number[];
}

function readCategoryScope(): CategoryScope {
  const raw = readStored(SELECTED_CATEGORY_KEY);
  if (!raw) {
    return { all: false, ids: [] };
  }
  try {
    const parsed = JSON.parse(raw) as Partial<CategoryScope>;
    return {
      all: Boolean(parsed.all),
      ids: Array.isArray(parsed.ids) ? parsed.ids.filter((id) => Number.isSafeInteger(id) && id > 0) : [],
    };
  } catch {
    return { all: false, ids: [] };
  }
}

function writeCategoryScope(all: boolean, ids: number[]) {
  writeStored(SELECTED_CATEGORY_KEY, JSON.stringify({ all, ids }));
}

function readStored(key: string): string | null {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStored(key: string, value: string) {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // 忽略隐私模式下的写入失败
  }
}

function getActualNum(record: OrderRecord): number {
  return Math.max(record.endNum - record.initNum, 0);
}

function toPositiveInteger(value: string): number | undefined {
  const parsed = Number(value.trim());
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : undefined;
}

function formatNumber(value: number): string {
  return Number(value || 0).toLocaleString("zh-CN");
}

function formatDateTime(value: string): string {
  const dateTime = dayjs(value);
  return value && dateTime.isValid() ? dateTime.format("YYYY-MM-DD HH:mm:ss") : "-";
}

function renderRate(numerator: number, denominator: number) {
  const rate = denominator > 0 ? (Number(numerator || 0) / denominator) * 100 : 0;
  const tone = rate < 30 ? " order-rate--critical" : rate < 50 ? " order-rate--warning" : "";
  return <span className={`order-rate order-num${tone}`}>{`${rate.toFixed(2)}%`}</span>;
}

function progressColor(percent: number): string {
  if (percent < 30) {
    return "var(--manager-danger)";
  }
  if (percent < 50) {
    return "var(--manager-warning)";
  }
  return "var(--manager-primary)";
}

function getProgressPercent(value: number, total: number): number {
  if (!total || total <= 0) {
    return 0;
  }
  return Math.min(Math.round((Math.max(value, 0) / total) * 100), 100);
}
