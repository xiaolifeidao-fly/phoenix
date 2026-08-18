"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AppstoreOutlined,
  ArrowDownOutlined,
  ArrowUpOutlined,
  ClockCircleOutlined,
  DeleteOutlined,
  EditOutlined,
  FundOutlined,
  PayCircleOutlined,
  PlusOutlined,
  ShopOutlined,
  TeamOutlined,
  WarningOutlined,
  WalletOutlined,
} from "@ant-design/icons";
import { App, Button, Drawer, Empty, Form, InputNumber, Select, Space, Spin, Switch, Table, Tag, Tooltip, Typography } from "antd";
import type { ColumnsType } from "antd/es/table";
import type { ReactNode } from "react";
import { AnimatedNumber } from "./AnimatedNumber";
import { SpeedTrendChart, type SpeedOverviewMetrics, type SpeedSeriesPoint } from "./SpeedTrendChart";
import {
  fetchProductCategories,
  fetchProducts,
  type ShopCategoryRecord,
  type ShopRecord,
} from "../../product/api/product.api";
import { fetchManualProducts, type ManualProductRecord } from "../../manual/api/product.api";
import { fetchUserStats, fetchUsers, UserStats, type UserRecord } from "../../user/api/user.api";
import {
  fetchBarryBridgeTypes,
  fetchBarryShopGroups,
  fetchWorkbenchBridgeDailyStatistics,
  fetchActualCompleted,
  fetchDelayAssignmentCount,
  fetchManualSpeed,
  fetchPendingDetectionCount,
  fetchSystemBalance,
  fetchTodayConsume,
  fetchTodayRecharge,
  fetchWorkbenchDashboardStatisticsWithComparison,
  fetchWorkbenchUserOverview,
  type ActualCompletedSummary,
  type BarryShopGroup,
  type BridgeDailyStatisticDetail,
  type BridgeDailyStatisticSummary,
  type DashboardStatistics,
  type DelayAssignmentCountSummary,
  type ManualSpeedSummary,
  type PendingDetectionCountSummary,
  type WorkbenchDashboardStatistics,
  type WorkbenchUserOverview,
} from "../api/workbench-dashboard.api";

const { Paragraph, Text } = Typography;

type DashboardCardId =
  | "productCount"
  | "bridgeDailyStatistic"
  | "pendingDetection"
  | "todayConsume"
  | "todayRecharge"
  | "systemBalance"
  | "taskRemaining"
  | "manualSubmitted"
  | "actualCompleted"
  | "realManualSubmitted"
  | "realActualCompleted"
  | "lowPriceManualSubmitted"
  | "lowPriceActualCompleted"
  | "averageSpeed";

// The dashboard cards backed by their own independent API endpoint.
type DashboardMetricId = "todayConsume" | "todayRecharge" | "systemBalance" | "actualCompleted";

const DASHBOARD_METRIC_FETCHERS: {
  [K in DashboardMetricId]: () => Promise<NonNullable<DashboardStatistics[K]>>;
} = {
  todayConsume: fetchTodayConsume,
  todayRecharge: fetchTodayRecharge,
  systemBalance: fetchSystemBalance,
  actualCompleted: fetchActualCompleted,
};

const DASHBOARD_METRIC_IDS = Object.keys(DASHBOARD_METRIC_FETCHERS) as DashboardMetricId[];

interface DashboardCardConfig {
  visible: boolean;
  categoryIds: number[];
  /** 仅用于升级旧版 localStorage 配置；新配置使用 bridgeStatisticScopes。 */
  shopGroupIds?: number[];
  bridgeStatisticScopes?: BridgeStatisticScope[];
  barryWindowSeconds?: number;
  userOverviewWindowSeconds?: number;
}

interface BridgeStatisticScope {
  shopGroupId: number;
  bridgeType: string;
}

interface DashboardConfigStore {
  version?: number;
  cards: Partial<Record<DashboardCardId, DashboardCardConfig>>;
}

interface DashboardSpeedHistoryStore {
  history: DashboardSpeedSnapshot[];
}

interface DashboardSpeedSnapshot {
  timestamp: number;
  categories: DashboardSpeedSnapshotCategory[];
}

interface DashboardSpeedSnapshotCategory {
  id: number;
  manualSubmitted: number;
  actualCompleted: number;
}

interface DerivedCategoryDetail {
  key: number;
  id: number;
  productName: string;
  categoryName: string;
  status: string;
  price: number;
  lowerLimit: number;
  upperLimit: number;
  todayConsume: number;
  todayRecharge: number;
  taskRemaining: number;
  manualSubmitted: number;
  actualCompleted: number;
  pendingDetectionCount: number;
  finishAssignmentPendingDetectionCount: number;
  delayAssignmentPendingDetectionCount: number;
  userCoverage: number;
  completionRate: number;
  manualSpeedPerSecond: number;
  actualSpeedPerSecond: number;
}

interface DashboardCardView {
  title: string;
  scopeLabel: string;
  unitLabel: string;
  icon: ReactNode;
  accent: string;
  background: string;
  value: ReactNode;
  detailMetrics: Array<{
    label: string;
    value: ReactNode;
    description?: string;
  }>;
  detailRows: DerivedCategoryDetail[];
  comparison?: DashboardComparison;
  editable?: boolean;
  compact?: boolean;
  expanded?: boolean;
  disableDetail?: boolean;
  hideIcon?: boolean;
}

interface DashboardComparison {
  yesterdayLabel: string;
  yesterdayValue: string;
  changeValue: string;
  change: number;
  changeRate: number;
}

const DASHBOARD_STORAGE_KEY = "phoenix_manager_dashboard_config_v1";
const DASHBOARD_CONFIG_VERSION = 14;
const DASHBOARD_SPEED_STORAGE_KEY = "phoenix_manager_dashboard_speed_history_v1";
const DASHBOARD_DATA_CACHE_KEY = "phoenix_manager_dashboard_data_cache_v1";
const DASHBOARD_SPEED_WINDOW_MS = 48 * 60 * 60 * 1000;
// 速度概览 chart keeps the most recent day of samples, one point per minute.
const DASHBOARD_SPEED_CHART_WINDOW_MS = 24 * 60 * 60 * 1000;
const DASHBOARD_SPEED_REPLACE_THRESHOLD_MS = 60 * 1000;
const DASHBOARD_REFRESH_INTERVAL_MS = 10 * 1000;
const DASHBOARD_BRIDGE_STATISTIC_REFRESH_INTERVAL_MS = 60 * 1000;
const MAX_BRIDGE_STATISTIC_REQUEST_CONCURRENCY = 3;
const MIN_BARRY_WINDOW_SECONDS = 1;
const MAX_BARRY_WINDOW_SECONDS = 3600;
// Barry BridgeType 的完整当前枚举。枚举接口暂不可用（例如后端尚未发布）时，
// 配置抽屉仍可展示和选择全部类型；接口返回的新值会在下方一并合并。
const BARRY_BRIDGE_TYPE_FALLBACK = [
  "GET_ITEM_FROM_WEB",
  "GET_ITEM_LIST_FROM_WEB",
  "GET_ITEM",
  "GET_USER_ITEM",
  "USER_FANS",
  "GET_USER_ITEM_FROM_WEB",
  "GET_ITEM_LIST",
  "FOLLOW_LIST",
  "HS_FOLLOW_LIST",
  "CONVERT_UID",
  "CONVERT",
  "CONVERT_UID_BY_URL",
  "CHECK_USER",
] as const;
const DEFAULT_BRIDGE_TYPE = "GET_ITEM_FROM_WEB";
// 待检测数量默认只统计商品分组 #1。
const DEFAULT_PENDING_DETECTION_SHOP_GROUP_IDS = [1];
const BRIDGE_SUCCESS_RATE_ALERT_THRESHOLD = 0.5;
const DEFAULT_BRIDGE_STATISTIC_SCOPES: BridgeStatisticScope[] = [
  { shopGroupId: 1, bridgeType: DEFAULT_BRIDGE_TYPE },
  { shopGroupId: 1, bridgeType: "GET_ITEM_LIST_FROM_WEB" },
];

interface DashboardDataCache {
  products: ShopRecord[];
  categories: ShopCategoryRecord[];
  manualProducts: ManualProductRecord[];
  users: UserRecord[];
  userStats: UserStats;
  workbenchStatistics?: WorkbenchDashboardStatistics;
  workbenchUserOverview?: WorkbenchUserOverview;
  dashboardStatistics?: DashboardStatistics;
}

// `averageSpeed` is intentionally omitted here — 速度概览 renders as a full-width
// trend chart at the very bottom of the dashboard instead of a grid card.
const DASHBOARD_LAYOUT: DashboardCardId[][] = [
  ["productCount", "bridgeDailyStatistic", "todayConsume", "todayRecharge", "systemBalance"],
  ["actualCompleted", "manualSubmitted", "taskRemaining", "pendingDetection"],
];
const DASHBOARD_WORKLOAD_CARD_IDS: DashboardCardId[] = ["realActualCompleted", "lowPriceActualCompleted"];
const LOW_PRICE_MANUAL_PRODUCT_IDS = [15];
const LOW_PRICE_UPSTREAM_CATEGORY_IDS = [8, 10];

const DASHBOARD_TITLES: Record<DashboardCardId, string> = {
  productCount: "上号情况",
  bridgeDailyStatistic: "商品桥接器情况",
  pendingDetection: "待检测数量",
  todayConsume: "今日消费",
  todayRecharge: "今日充值",
  systemBalance: "系统余额",
  taskRemaining: "总任务余额",
  manualSubmitted: "人工提交数量",
  actualCompleted: "实际完成总量",
  realManualSubmitted: "真人人工提交总量",
  realActualCompleted: "真人实际完成总量",
  lowPriceManualSubmitted: "低价提交量",
  lowPriceActualCompleted: "低价实际完成量",
  averageSpeed: "平均速度",
};

const DASHBOARD_DEFAULT_CONFIG: Record<DashboardCardId, DashboardCardConfig> = {
  productCount: { visible: true, categoryIds: [], userOverviewWindowSeconds: 120 },
  bridgeDailyStatistic: { visible: true, categoryIds: [], bridgeStatisticScopes: DEFAULT_BRIDGE_STATISTIC_SCOPES },
  pendingDetection: {
    visible: true,
    categoryIds: [],
    shopGroupIds: DEFAULT_PENDING_DETECTION_SHOP_GROUP_IDS,
  },
  todayConsume: { visible: true, categoryIds: [] },
  todayRecharge: { visible: true, categoryIds: [] },
  systemBalance: { visible: true, categoryIds: [] },
  taskRemaining: { visible: true, categoryIds: [] },
  manualSubmitted: { visible: true, categoryIds: [] },
  actualCompleted: { visible: true, categoryIds: [] },
  realManualSubmitted: { visible: true, categoryIds: [2, 18] },
  realActualCompleted: { visible: true, categoryIds: [7, 12] },
  lowPriceManualSubmitted: { visible: true, categoryIds: LOW_PRICE_MANUAL_PRODUCT_IDS },
  lowPriceActualCompleted: { visible: true, categoryIds: LOW_PRICE_UPSTREAM_CATEGORY_IDS },
  averageSpeed: { visible: true, categoryIds: [], barryWindowSeconds: 30 },
};

const currencyFormatter = new Intl.NumberFormat("zh-CN", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const integerFormatter = new Intl.NumberFormat("zh-CN", {
  maximumFractionDigits: 0,
});

const rateFormatter = new Intl.NumberFormat("zh-CN", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

export function ManagerDashboardPanel() {
  const { message: messageApi } = App.useApp();
  const [form] = Form.useForm<DashboardCardConfig>();
  const [products, setProducts] = useState<ShopRecord[]>([]);
  const [categories, setCategories] = useState<ShopCategoryRecord[]>([]);
  const [manualProducts, setManualProducts] = useState<ManualProductRecord[]>([]);
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [userStats, setUserStats] = useState<UserStats>(new UserStats());
  const [workbenchStatistics, setWorkbenchStatistics] = useState<WorkbenchDashboardStatistics | null>(null);
  const [realManualSubmittedStatistics, setRealManualSubmittedStatistics] = useState<WorkbenchDashboardStatistics | null>(null);
  const [lowPriceManualSubmittedStatistics, setLowPriceManualSubmittedStatistics] = useState<WorkbenchDashboardStatistics | null>(null);
  const [bridgeDailyStatistics, setBridgeDailyStatistics] = useState<Record<string, BridgeDailyStatisticSummary>>({});
  const [shopGroups, setShopGroups] = useState<BarryShopGroup[]>([]);
  const [bridgeTypes, setBridgeTypes] = useState<string[]>([]);
  const [lowPriceActualCompleted, setLowPriceActualCompleted] = useState<ActualCompletedSummary | null>(null);
  const [pendingDetectionCount, setPendingDetectionCount] = useState<PendingDetectionCountSummary | null>(null);
  const [realDelayAssignmentCount, setRealDelayAssignmentCount] = useState<DelayAssignmentCountSummary | null>(null);
  const [lowPriceDelayAssignmentCount, setLowPriceDelayAssignmentCount] = useState<DelayAssignmentCountSummary | null>(null);
  const [manualSpeed, setManualSpeed] = useState<ManualSpeedSummary | null>(null);
  const [realManualSpeed, setRealManualSpeed] = useState<ManualSpeedSummary | null>(null);
  const [actualSpeedPerSecond, setActualSpeedPerSecond] = useState(0);
  const [realActualSpeedPerSecond, setRealActualSpeedPerSecond] = useState(0);
  const [workbenchUserOverview, setWorkbenchUserOverview] = useState<WorkbenchUserOverview | null>(null);
  const [dashboardStatistics, setDashboardStatistics] = useState<DashboardStatistics | null>(null);
  const [dashboardMetricLoading, setDashboardMetricLoading] = useState<Partial<Record<DashboardMetricId, boolean>>>({});
  const [dashboardMetricFailed, setDashboardMetricFailed] = useState<Partial<Record<DashboardMetricId, boolean>>>({});
  const [configMap, setConfigMap] =
    useState<Record<DashboardCardId, DashboardCardConfig>>(DASHBOARD_DEFAULT_CONFIG);
  const [speedHistory, setSpeedHistory] = useState<DashboardSpeedSnapshot[]>([]);
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [skipInitialFetch, setSkipInitialFetch] = useState(false);
  const [detailCardId, setDetailCardId] = useState<DashboardCardId | null>(null);
  const [bridgeStatisticDetailOpen, setBridgeStatisticDetailOpen] = useState(false);
  const [editingCardId, setEditingCardId] = useState<DashboardCardId | null>(null);
  const actualSpeedSampleRef = useRef<Record<"total" | "real", { count: number; timestamp: number } | undefined>>({
    total: undefined,
    real: undefined,
  });

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    try {
      const rawValue = window.localStorage.getItem(DASHBOARD_STORAGE_KEY);
      if (rawValue) {
        const parsed = JSON.parse(rawValue) as DashboardConfigStore;
        setConfigMap((current) =>
          mergeDashboardConfig(
            current,
            parsed.version === DASHBOARD_CONFIG_VERSION
              ? parsed.cards
              : applyDashboardConfigPresets(parsed.cards),
          ),
        );
      }
    } catch {
      window.localStorage.removeItem(DASHBOARD_STORAGE_KEY);
    }

    try {
      const rawValue = window.localStorage.getItem(DASHBOARD_SPEED_STORAGE_KEY);
      if (rawValue) {
        const parsed = JSON.parse(rawValue) as DashboardSpeedHistoryStore;
        setSpeedHistory(pruneSpeedHistory(parsed.history ?? []));
      }
    } catch {
      window.localStorage.removeItem(DASHBOARD_SPEED_STORAGE_KEY);
    }

    try {
      const rawValue = window.sessionStorage.getItem(DASHBOARD_DATA_CACHE_KEY);
      if (rawValue) {
        const parsed = JSON.parse(rawValue) as DashboardDataCache;
        setProducts(parsed.products ?? []);
        setCategories(parsed.categories ?? []);
        setManualProducts(parsed.manualProducts ?? []);
        setUsers(parsed.users ?? []);
        setUserStats(parsed.userStats ?? new UserStats());
        setWorkbenchStatistics(parsed.workbenchStatistics ?? null);
        setWorkbenchUserOverview(parsed.workbenchUserOverview ?? null);
        setDashboardStatistics(parsed.dashboardStatistics ?? null);
        setLoading(false);
        setSkipInitialFetch(Boolean(parsed.workbenchStatistics && parsed.workbenchUserOverview && parsed.dashboardStatistics));
      }
    } catch {
      window.sessionStorage.removeItem(DASHBOARD_DATA_CACHE_KEY);
    }

    setReady(true);
  }, []);

  const recordActualSpeed = useCallback((scope: "total" | "real", count: number) => {
    const timestamp = Date.now();
    const previous = actualSpeedSampleRef.current[scope];
    actualSpeedSampleRef.current[scope] = { count, timestamp };
    if (!previous) {
      return;
    }
    const speed = Math.max(count - previous.count, 0) / Math.max((timestamp - previous.timestamp) / 1000, 1);
    if (scope === "total") {
      setActualSpeedPerSecond(speed);
    } else {
      setRealActualSpeedPerSecond(speed);
    }
  }, []);

  const userOverviewWindowSeconds = clampBarryWindowSeconds(
    configMap.productCount?.userOverviewWindowSeconds,
  );

  // Each dashboard metric loads on its own request and updates just its
  // slice of state, so a slow endpoint never holds up the other cards.
  const loadDashboardMetric = useCallback(
    (metricId: DashboardMetricId) => {
      setDashboardMetricLoading((current) => ({ ...current, [metricId]: true }));
      setDashboardMetricFailed((current) => ({ ...current, [metricId]: false }));
      DASHBOARD_METRIC_FETCHERS[metricId]()
        .then((value) => {
          if (metricId === "actualCompleted") {
            recordActualSpeed("total", (value as NonNullable<DashboardStatistics["actualCompleted"]>).count);
          }
          setDashboardStatistics((current) => {
            const next = { ...(current ?? {}), [metricId]: value } as DashboardStatistics;
            mergeDashboardCache({ dashboardStatistics: next });
            return next;
          });
        })
        .catch(() => {
          // 单个指标失败不再各弹一条提示（六七个接口同时挂会糊满屏幕），
          // 统一由下方 loadDashboardData 汇总成一条，卡片自身展示失败态。
          setDashboardMetricFailed((current) => ({ ...current, [metricId]: true }));
        })
        .finally(() => {
          setDashboardMetricLoading((current) => ({ ...current, [metricId]: false }));
        });
    },
    [recordActualSpeed],
  );

  const loadDashboardData = useCallback(
    async (silent = false) => {
      if (!silent) {
        setLoading(true);
      }

      // Fire the four dashboard metrics independently — not awaited together.
      DASHBOARD_METRIC_IDS.forEach((metricId) => loadDashboardMetric(metricId));

      const [categoryResult, productResult, manualProductResult, userResult, statsResult, workbenchResult] = await Promise.allSettled([
        fetchProductCategories({ pageIndex: 1, pageSize: 500 }),
        fetchProducts({ pageIndex: 1, pageSize: 200 }),
        fetchManualProducts(),
        fetchUsers({ pageIndex: 1, pageSize: 200 }),
        fetchUserStats(),
        fetchWorkbenchDashboardStatisticsWithComparison(),
      ]);

      if (categoryResult.status === "fulfilled") {
        setCategories(categoryResult.value.data);
      } else {
        setCategories([]);
      }

      if (productResult.status === "fulfilled") {
        setProducts(productResult.value.data);
      } else {
        setProducts([]);
      }

      if (manualProductResult.status === "fulfilled") {
        setManualProducts(manualProductResult.value);
      } else {
        setManualProducts([]);
      }

      if (userResult.status === "fulfilled") {
        setUsers(userResult.value.data);
      } else {
        setUsers([]);
      }

      if (statsResult.status === "fulfilled") {
        setUserStats(statsResult.value);
      } else {
        setUserStats(new UserStats());
      }

      if (workbenchResult.status === "fulfilled") {
        setWorkbenchStatistics(workbenchResult.value);
      } else {
        setWorkbenchStatistics(null);
      }

      // Merge (not overwrite) so the independently-loaded dashboard metrics already
      // written into the cache are preserved.
      mergeDashboardCache({
        categories: categoryResult.status === "fulfilled" ? categoryResult.value.data : [],
        products: productResult.status === "fulfilled" ? productResult.value.data : [],
        manualProducts: manualProductResult.status === "fulfilled" ? manualProductResult.value : [],
        users: userResult.status === "fulfilled" ? userResult.value.data : [],
        userStats: statsResult.status === "fulfilled" ? statsResult.value : new UserStats(),
        workbenchStatistics: workbenchResult.status === "fulfilled" ? workbenchResult.value : undefined,
      });

      if (
        categoryResult.status === "rejected" ||
        productResult.status === "rejected" ||
        manualProductResult.status === "rejected" ||
        userResult.status === "rejected" ||
        statsResult.status === "rejected" ||
        workbenchResult.status === "rejected"
      ) {
        messageApi.warning("部分工作台数据加载失败，已回退为可用数据");
      }

      setLoading(false);
    },
    [loadDashboardMetric, messageApi],
  );

  useEffect(() => {
    if (skipInitialFetch) {
      return;
    }
    void loadDashboardData();
  }, [loadDashboardData, skipInitialFetch]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const timer = window.setInterval(() => {
      if (!document.hidden) {
        void loadDashboardData(true);
      }
    }, DASHBOARD_REFRESH_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [loadDashboardData]);

  useEffect(() => {
    if (!ready) {
      return;
    }
    const loadUserOverview = () => {
      void fetchWorkbenchUserOverview({ windowSeconds: userOverviewWindowSeconds })
        .then((value) => {
          setWorkbenchUserOverview(value);
          mergeDashboardCache({ workbenchUserOverview: value });
        })
        .catch(() => {
          // Preserve the last valid online snapshot when Barry is temporarily unavailable.
        });
    };
    loadUserOverview();
    const refreshInterval = userOverviewWindowSeconds < 10 * 60
      ? DASHBOARD_REFRESH_INTERVAL_MS
      : 60 * 1000;
    const timer = window.setInterval(loadUserOverview, refreshInterval);
    return () => window.clearInterval(timer);
  }, [ready, userOverviewWindowSeconds]);

  const realActualCategoryIds = configMap.realActualCompleted?.categoryIds ?? [];
  const realActualCategoryIdsKey = realActualCategoryIds.join(",");
  const realManualCategoryIds = configMap.realManualSubmitted?.categoryIds ?? [];
  const realManualCategoryIdsKey = realManualCategoryIds.join(",");

  useEffect(() => {
    if (!ready) {
      return;
    }

    const loadRealActualCompleted = () => {
      void fetchActualCompleted(
        realActualCategoryIds.length > 0 ? { shopCategoryIds: realActualCategoryIdsKey } : undefined,
      )
        .then((value) => {
          recordActualSpeed("real", value.count);
          setDashboardStatistics((current) => ({ ...(current ?? {}), realActualCompleted: value }));
        })
        .catch(() => {
          // Keep the previous snapshot so a temporary polling failure does not reset the speed.
        });
      void fetchDelayAssignmentCount(
        realActualCategoryIds.length > 0 ? { shopCategoryIds: realActualCategoryIdsKey } : undefined,
      ).then(setRealDelayAssignmentCount).catch(() => setRealDelayAssignmentCount(null));
    };

    loadRealActualCompleted();
    const timer = window.setInterval(loadRealActualCompleted, DASHBOARD_REFRESH_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [
    ready,
    realActualCategoryIds.length,
    realActualCategoryIdsKey,
    recordActualSpeed,
  ]);

  useEffect(() => {
    if (!ready) {
      return;
    }

    const loadRealManualSubmitted = () => {
      void fetchWorkbenchDashboardStatisticsWithComparison(
        realManualCategoryIdsKey ? { shopCategoryIds: realManualCategoryIdsKey } : undefined,
      )
        .then(setRealManualSubmittedStatistics)
        .catch(() => {
          // Retain the last valid selected-product result during a temporary refresh failure.
        });
    };

    loadRealManualSubmitted();
    const timer = window.setInterval(loadRealManualSubmitted, DASHBOARD_REFRESH_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [ready, realManualCategoryIdsKey]);

  const lowPriceManualProductIds = configMap.lowPriceManualSubmitted?.categoryIds ?? LOW_PRICE_MANUAL_PRODUCT_IDS;
  const lowPriceManualProductIdsKey = lowPriceManualProductIds.join(",");
  const lowPriceUpstreamCategoryIds = configMap.lowPriceActualCompleted?.categoryIds ?? LOW_PRICE_UPSTREAM_CATEGORY_IDS;
  const lowPriceUpstreamCategoryIdsKey = lowPriceUpstreamCategoryIds.join(",");
  const pendingDetectionShopGroupIds = configMap.pendingDetection?.shopGroupIds ?? [];
  const pendingDetectionShopGroupIdsKey = pendingDetectionShopGroupIds.join(",");

  useEffect(() => {
    if (!ready) {
      return;
    }

    let disposed = false;
    void Promise.allSettled([fetchBarryShopGroups(), fetchBarryBridgeTypes()])
      .then(([shopGroupResult, bridgeTypeResult]) => {
        if (disposed) {
          return;
        }
        if (shopGroupResult.status === "fulfilled") {
          setShopGroups(shopGroupResult.value);
        }
        if (bridgeTypeResult.status === "fulfilled") {
          setBridgeTypes(bridgeTypeResult.value);
        }
      });
    return () => {
      disposed = true;
    };
  }, [ready]);

  useEffect(() => {
    if (!ready) {
      return;
    }

    const loadPendingDetectionCount = () => {
      void fetchPendingDetectionCount(
        pendingDetectionShopGroupIdsKey ? { shopGroupIds: pendingDetectionShopGroupIdsKey } : undefined,
      )
        .then(setPendingDetectionCount)
        .catch(() => {
          setPendingDetectionCount(null);
        });
    };

    loadPendingDetectionCount();
    const timer = window.setInterval(loadPendingDetectionCount, DASHBOARD_REFRESH_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [pendingDetectionShopGroupIdsKey, ready]);

  useEffect(() => {
    if (!ready) {
      return;
    }

    const loadLowPriceStatistics = () => {
      void fetchWorkbenchDashboardStatisticsWithComparison(
        lowPriceManualProductIdsKey ? { shopCategoryIds: lowPriceManualProductIdsKey } : undefined,
      )
        .then(setLowPriceManualSubmittedStatistics)
        .catch(() => {
          // Keep the most recent low-price submission data while a refresh is unavailable.
        });
      void fetchActualCompleted(
        lowPriceUpstreamCategoryIdsKey ? { shopCategoryIds: lowPriceUpstreamCategoryIdsKey } : undefined,
      )
        .then(setLowPriceActualCompleted)
        .catch(() => {
          // Keep the most recent low-price completion data while a refresh is unavailable.
        });
      void fetchDelayAssignmentCount(
        lowPriceUpstreamCategoryIdsKey ? { shopCategoryIds: lowPriceUpstreamCategoryIdsKey } : undefined,
      ).then(setLowPriceDelayAssignmentCount).catch(() => setLowPriceDelayAssignmentCount(null));
    };

    loadLowPriceStatistics();
    const timer = window.setInterval(loadLowPriceStatistics, DASHBOARD_REFRESH_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [ready, lowPriceManualProductIdsKey, lowPriceUpstreamCategoryIdsKey]);

  const bridgeStatisticScopes = useMemo(
    () => normalizeBridgeStatisticScopes(
      configMap.bridgeDailyStatistic?.bridgeStatisticScopes ?? DEFAULT_BRIDGE_STATISTIC_SCOPES,
    ),
    [configMap.bridgeDailyStatistic?.bridgeStatisticScopes],
  );
  const bridgeDailyStatisticVisible = configMap.bridgeDailyStatistic?.visible ?? true;
  const defaultBridgeStatisticScope = bridgeStatisticScopes[0];
  const defaultBridgeDailyStatistic = defaultBridgeStatisticScope
    ? bridgeDailyStatistics[bridgeStatisticScopeKey(defaultBridgeStatisticScope)] ?? null
    : null;

  useEffect(() => {
    if (!ready || !bridgeDailyStatisticVisible || bridgeStatisticScopes.length === 0) {
      setBridgeDailyStatistics({});
      return;
    }

    let disposed = false;
    let loadingBridgeDailyStatistics = false;
    setBridgeDailyStatistics({});
    const loadBridgeDailyStatistics = () => {
      if (loadingBridgeDailyStatistics) {
        return;
      }
      loadingBridgeDailyStatistics = true;
      void fetchBridgeStatisticScopes(bridgeStatisticScopes)
        .then((results) => {
          if (disposed) {
            return;
          }
          setBridgeDailyStatistics((current) => {
            const next = { ...current };
            results.forEach((statistic, index) => {
              const scope = bridgeStatisticScopes[index];
              if (statistic && scope) {
                next[bridgeStatisticScopeKey(scope)] = statistic;
              }
            });
            return next;
          });
        })
        .finally(() => {
          loadingBridgeDailyStatistics = false;
        });
    };

    loadBridgeDailyStatistics();
    const timer = window.setInterval(loadBridgeDailyStatistics, DASHBOARD_BRIDGE_STATISTIC_REFRESH_INTERVAL_MS);
    return () => {
      disposed = true;
      window.clearInterval(timer);
    };
  }, [bridgeDailyStatisticVisible, bridgeStatisticScopes, ready]);

  const barryWindowSeconds = clampBarryWindowSeconds(
    configMap.averageSpeed?.barryWindowSeconds,
  );

  useEffect(() => {
    if (!ready) {
      return;
    }
    const loadManualSpeed = () => {
      void fetchManualSpeed({ windowSeconds: barryWindowSeconds }).then(setManualSpeed).catch(() => setManualSpeed(null));
      void fetchManualSpeed(
        realManualCategoryIdsKey
          ? { shopCategoryIds: realManualCategoryIdsKey, windowSeconds: barryWindowSeconds }
          : { windowSeconds: barryWindowSeconds },
      ).then(setRealManualSpeed).catch(() => setRealManualSpeed(null));
    };
    loadManualSpeed();
    const timer = window.setInterval(loadManualSpeed, DASHBOARD_REFRESH_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [barryWindowSeconds, ready, realManualCategoryIdsKey]);

  useEffect(() => {
    if (!ready || typeof window === "undefined") {
      return;
    }
    const payload: DashboardConfigStore = { version: DASHBOARD_CONFIG_VERSION, cards: configMap };
    window.localStorage.setItem(DASHBOARD_STORAGE_KEY, JSON.stringify(payload));
  }, [configMap, ready]);

  const productNameMap = useMemo(
    () => new Map(products.map((item) => [item.id, item.name || item.code || `商品#${item.id}`])),
    [products],
  );

  const categoryOptions = useMemo(
    () =>
      categories.map((item) => ({
        label: `${productNameMap.get(item.shopId) || `商品#${item.shopId}`} / ${item.name || `类目#${item.id}`}`,
        value: item.id,
      })),
    [categories, productNameMap],
  );
  // Manual cards must use the same list exposed by 人工商品管理, never the upstream category list.
  const manualProductOptions = useMemo(
    () =>
      manualProducts.map((item) => ({
        label: item.name || item.code || `人工商品#${item.id}`,
        value: item.id,
      })),
    [manualProducts],
  );

  const shopGroupOptions = useMemo(
    () =>
      [...shopGroups]
        .sort((left, right) => left.id - right.id)
        .map((item) => ({
          label: formatShopGroupLabel(item),
          value: item.id,
        })),
    [shopGroups],
  );

  const bridgeTypeOptions = useMemo(
    () => Array.from(new Set([
      ...BARRY_BRIDGE_TYPE_FALLBACK,
      ...bridgeTypes,
      ...bridgeStatisticScopes.map((scope) => scope.bridgeType),
    ]))
      .map((bridgeType) => ({ label: formatBridgeType(bridgeType), value: bridgeType })),
    [bridgeStatisticScopes, bridgeTypes],
  );

  const shopGroupLabelMap = useMemo(
    () => new Map(shopGroups.map((item) => [item.id, formatShopGroupLabel(item)])),
    [shopGroups],
  );

  const categoryLabelMap = useMemo(
    () =>
      new Map(
        categories.map((item) => [
          item.id,
          `${productNameMap.get(item.shopId) || `商品#${item.shopId}`} / ${item.name || `类目#${item.id}`}`,
        ]),
      ),
    [categories, productNameMap],
  );

  const derivedCategoryDetails = useMemo(
    () => buildDerivedCategoryDetails(categories, productNameMap, users, userStats, workbenchStatistics),
    [categories, productNameMap, users, userStats, workbenchStatistics],
  );

  const derivedManualProductDetails = useMemo(
    () => buildDerivedManualProductDetails(manualProducts, workbenchStatistics),
    [manualProducts, workbenchStatistics],
  );
  const lowPriceManualProductDetails = useMemo(
    () => buildDerivedManualProductDetails(manualProducts, lowPriceManualSubmittedStatistics),
    [lowPriceManualSubmittedStatistics, manualProducts],
  );

  useEffect(() => {
    if (!ready || loading || typeof window === "undefined") {
      return;
    }

    setSpeedHistory((current) => {
      const nextHistory = appendSpeedSnapshot(current, derivedCategoryDetails);
      window.localStorage.setItem(
        DASHBOARD_SPEED_STORAGE_KEY,
        JSON.stringify({ history: nextHistory } satisfies DashboardSpeedHistoryStore),
      );
      return nextHistory;
    });
  }, [derivedCategoryDetails, loading, ready]);

  const categoryDetailsWithSpeed = useMemo(
    () => attachSpeedMetrics(derivedCategoryDetails, speedHistory),
    [derivedCategoryDetails, speedHistory],
  );

  // The trend remains useful for context, while its headline figures always come
  // from the dedicated recent-hour/manual and 10-second actual-completion samples.
  const speedSeries = useMemo(() => buildSpeedSeries(speedHistory), [speedHistory]);
  const speedMetrics = useMemo<SpeedOverviewMetrics>(() => ({
    manualSubmittedPerSecond: manualSpeed?.submittedPerSecond ?? 0,
    manualDistributedPerSecond: manualSpeed?.distributedPerSecond ?? 0,
    realManualSubmittedPerSecond: realManualSpeed?.submittedPerSecond ?? 0,
    realManualDistributedPerSecond: realManualSpeed?.distributedPerSecond ?? 0,
    actualCompletedPerSecond: actualSpeedPerSecond,
    realActualCompletedPerSecond: realActualSpeedPerSecond,
  }), [actualSpeedPerSecond, manualSpeed, realActualSpeedPerSecond, realManualSpeed]);
  const realManualProductSpeeds = useMemo(
    () => manualProducts.map((product) => {
      const categorySpeed = realManualSpeed?.categoryList.find((item) => item.shopCategoryId === product.id);
      return {
        key: product.id,
        productName: product.name || product.code || `人工商品#${product.id}`,
        submittedPerSecond: categorySpeed?.submittedPerSecond ?? 0,
        distributedPerSecond: categorySpeed?.distributedPerSecond ?? 0,
        accountCount: categorySpeed?.accountCount ?? 0,
      };
    }).filter((item) => realManualCategoryIds.length === 0 || realManualCategoryIds.includes(item.key)),
    [manualProducts, realManualCategoryIds, realManualSpeed],
  );

  const cardViews = useMemo(
    () =>
      Object.fromEntries(
        (Object.keys(DASHBOARD_TITLES) as DashboardCardId[]).map((cardId) => {
          const config = configMap[cardId] ?? DASHBOARD_DEFAULT_CONFIG[cardId];
          const isManualProduct = isManualProductMetric(cardId);
          const scopedDetails = cardId === "taskRemaining"
            ? categoryDetailsWithSpeed
            : resolveScopedDetails(
              isManualProduct
                ? (cardId === "lowPriceManualSubmitted" ? lowPriceManualProductDetails : derivedManualProductDetails)
                : categoryDetailsWithSpeed,
              config.categoryIds,
            );
          const view = buildDashboardCardView(
            cardId,
            scopedDetails,
            products,
            users,
            userStats,
            workbenchStatistics,
            realManualSubmittedStatistics,
            lowPriceManualSubmittedStatistics,
            workbenchUserOverview,
            dashboardStatistics,
            lowPriceActualCompleted,
            pendingDetectionCount,
            realDelayAssignmentCount,
            lowPriceDelayAssignmentCount,
            cardId === "pendingDetection"
              ? formatShopGroupScopeLabel(config.shopGroupIds ?? [], shopGroups.length)
              : formatCategoryScopeLabel(
                config.categoryIds,
                isManualProduct ? manualProducts.length : categories.length,
                isManualProduct ? "人工商品" : "商品类目",
              ),
          );
          // While an independent metric is still in-flight and has no value yet, show a
          // spinner in place of the default 0 so each card reflects its own load state.
          if (
            isDashboardMetricId(cardId) &&
            dashboardMetricLoading[cardId] &&
            !dashboardStatistics?.[cardId]
          ) {
            return [cardId, { ...view, value: <Spin size="small" /> }];
          }
          return [cardId, view];
        }),
      ) as Record<DashboardCardId, DashboardCardView>,
    [categories.length, categoryDetailsWithSpeed, configMap, dashboardMetricLoading, dashboardStatistics, derivedManualProductDetails, lowPriceActualCompleted, lowPriceDelayAssignmentCount, lowPriceManualProductDetails, lowPriceManualSubmittedStatistics, manualProducts.length, pendingDetectionCount, products, realDelayAssignmentCount, realManualSubmittedStatistics, users, userStats, workbenchStatistics, workbenchUserOverview],
  );

  const hiddenCardIds = useMemo(
    () =>
      (Object.keys(configMap) as DashboardCardId[]).filter(
        (cardId) => !["realManualSubmitted", "lowPriceManualSubmitted", "lowPriceActualCompleted"].includes(cardId) && !configMap[cardId]?.visible,
      ),
    [configMap],
  );
  const visibleTopCardIds = useMemo(
    () => DASHBOARD_LAYOUT.flat().filter((cardId) => configMap[cardId]?.visible),
    [configMap],
  );
  const visibleWorkloadCardIds = useMemo(
    () => DASHBOARD_WORKLOAD_CARD_IDS.filter((cardId) => configMap[cardId]?.visible),
    [configMap],
  );

  const openEditModal = (cardId: DashboardCardId) => {
    const nextConfig = configMap[cardId] ?? DASHBOARD_DEFAULT_CONFIG[cardId];
    setEditingCardId(cardId);
    form.setFieldsValue({
      visible: nextConfig.visible,
      categoryIds: nextConfig.categoryIds,
      shopGroupIds: nextConfig.shopGroupIds ?? [],
      bridgeStatisticScopes: normalizeBridgeStatisticScopes(
        nextConfig.bridgeStatisticScopes ?? DEFAULT_BRIDGE_STATISTIC_SCOPES,
      ),
      barryWindowSeconds: clampBarryWindowSeconds(nextConfig.barryWindowSeconds),
      userOverviewWindowSeconds: clampBarryWindowSeconds(nextConfig.userOverviewWindowSeconds),
    });
  };

  const handleSaveConfig = async () => {
    if (!editingCardId) {
      return;
    }

    const values = await form.validateFields();
    setConfigMap((current) => ({
      ...current,
      [editingCardId]: {
        visible: ["realManualSubmitted", "lowPriceManualSubmitted", "lowPriceActualCompleted"].includes(editingCardId)
          ? true
          : Boolean(values.visible),
        categoryIds: values.categoryIds ?? [],
        shopGroupIds: editingCardId === "pendingDetection"
          ? values.shopGroupIds ?? []
          : current[editingCardId].shopGroupIds,
        bridgeStatisticScopes: editingCardId === "bridgeDailyStatistic"
          ? normalizeBridgeStatisticScopes(values.bridgeStatisticScopes)
          : current[editingCardId].bridgeStatisticScopes,
        barryWindowSeconds: editingCardId === "averageSpeed"
          ? clampBarryWindowSeconds(values.barryWindowSeconds)
          : current[editingCardId].barryWindowSeconds,
        userOverviewWindowSeconds: editingCardId === "productCount"
          ? clampBarryWindowSeconds(values.userOverviewWindowSeconds)
          : current[editingCardId].userOverviewWindowSeconds,
      },
    }));
    setEditingCardId(null);
  };

  const detailCard = detailCardId ? cardViews[detailCardId] : null;
  const bridgeStatisticDetails = bridgeStatisticScopes.map((scope) => ({
    scope,
    statistic: bridgeDailyStatistics[bridgeStatisticScopeKey(scope)] ?? null,
  }));
  return (
    <>
      <div className="manager-page-stack">
        {loading && !ready ? (
          <section className="manager-data-card" style={{ minHeight: 260, display: "grid", placeItems: "center" }}>
            <Spin size="large" />
          </section>
        ) : (
          <>
            {hiddenCardIds.length > 0 ? (
              <section className="manager-data-card" style={{ padding: "14px 18px" }}>
                <Space wrap size={[8, 8]}>
                  <Text style={{ color: "var(--manager-text-soft)" }}>已隐藏卡片：</Text>
                  {hiddenCardIds.map((cardId) => (
                    <Button key={cardId} size="small" onClick={() => openEditModal(cardId)}>
                      恢复 {DASHBOARD_TITLES[cardId]}
                    </Button>
                  ))}
                </Space>
              </section>
            ) : null}

            {visibleTopCardIds.length > 0 || visibleWorkloadCardIds.length > 0 ? (
              <>
                {visibleTopCardIds.length > 0 ? (
                  <section className="manager-stats-grid manager-dashboard-layout">
                    {visibleTopCardIds.map((cardId) =>
                      cardId === "bridgeDailyStatistic"
                        ? renderBridgeDailyStatisticCard({
                          statistic: defaultBridgeDailyStatistic,
                          scope: defaultBridgeStatisticScope,
                          scopeCount: bridgeStatisticScopes.length,
                          shopGroupLabelMap,
                          onEdit: () => openEditModal(cardId),
                          onOpenDetail: () => setBridgeStatisticDetailOpen(true),
                        })
                        : renderDashboardCard({
                          cardId,
                          view: cardViews[cardId],
                          onEdit: openEditModal,
                          onOpenDetail: setDetailCardId,
                        }),
                    )}
                  </section>
                ) : null}

                {visibleWorkloadCardIds.length > 0 ? (
                  <section className="manager-stats-grid manager-dashboard-workload-row">
                    {visibleWorkloadCardIds.map((cardId) =>
                      renderDashboardCard({
                        cardId,
                        view: cardViews[cardId],
                        relatedView: cardViews[cardId === "realActualCompleted" ? "realManualSubmitted" : "lowPriceManualSubmitted"],
                        onEdit: openEditModal,
                        onOpenDetail: setDetailCardId,
                      }),
                    )}
                  </section>
                ) : null}

              </>
            ) : (
              <section className="manager-data-card">
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="dashboard 已全部隐藏，可使用恢复按钮重新展示" />
              </section>
            )}

            <SpeedTrendChart
              series={speedSeries}
              speedMetrics={speedMetrics}
              realManualProductSpeeds={realManualProductSpeeds}
              barryWindowSeconds={barryWindowSeconds}
              onEdit={() => openEditModal("averageSpeed")}
            />
          </>
        )}
      </div>

      <Drawer
        title={detailCard?.title || "Dashboard 详情"}
        placement="right"
        width={560}
        open={Boolean(detailCard)}
        onClose={() => setDetailCardId(null)}
        className="manager-dashboard-drawer"
      >
        {detailCard ? (
          <div className="manager-page-stack">
            <section className="manager-data-card">
              <div className="manager-section-label">{detailCard.scopeLabel}</div>
              <div className="manager-display-title" style={{ marginTop: 14, fontSize: 34 }}>
                {detailCard.value}
              </div>
              <Text style={{ display: "block", marginTop: 10, color: "var(--manager-text-soft)" }}>
                {detailCard.unitLabel}
              </Text>
              {detailCard.detailMetrics.length > 0 ? (
                <div className="manager-dashboard-card__metrics" style={{ marginTop: 18 }}>
                  {detailCard.detailMetrics.map((metric, index) => (
                    <div key={`${metric.label}-${index}`} className="manager-dashboard-card__metric">
                      <div className="manager-dashboard-card__metric-label">{metric.label}</div>
                      <div className="manager-dashboard-card__metric-value">{metric.value}</div>
                      {metric.description ? (
                        <div className="manager-dashboard-card__metric-description">
                          {metric.description}
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              ) : null}
            </section>

            <section className="manager-data-card manager-table">
              <Space
                wrap
                size={10}
                style={{ width: "100%", justifyContent: "space-between", marginBottom: 18 }}
              >
                <Text style={{ color: "var(--manager-text-soft)" }}>
                  {getDetailListDescription(detailCardId)}
                </Text>
                <Tag className="manager-dashboard-tag">
                  {getDetailListUnitLabel(detailCardId)} {detailCard.detailRows.length}
                </Tag>
              </Space>
              <Table<DerivedCategoryDetail>
                rowKey="key"
                pagination={false}
                scroll={detailCardId === "productCount" || detailCardId === "taskRemaining" ? undefined : { x: 760 }}
                tableLayout={detailCardId === "productCount" ? "fixed" : undefined}
                dataSource={detailCard.detailRows}
                columns={buildDetailColumns(detailCardId)}
              />
            </section>
          </div>
        ) : null}
      </Drawer>

      <Drawer
        title="商品桥接器情况"
        placement="right"
        width={860}
        open={bridgeStatisticDetailOpen}
        onClose={() => setBridgeStatisticDetailOpen(false)}
        className="manager-dashboard-drawer"
      >
        {bridgeStatisticDetails.length > 0 ? (
          <div className="manager-page-stack">
            <section className="manager-data-card">
              <div className="manager-section-label">已配置 {bridgeStatisticDetails.length} 个商品分组 + BridgeType 组合</div>
              <Text style={{ display: "block", marginTop: 12, color: "var(--manager-text-soft)" }}>
                首项是卡片默认展示项；可在编辑中通过上下移动调整默认项和展示顺序。
              </Text>
              <Text style={{ display: "block", marginTop: 6, color: "var(--manager-text-soft)" }}>
                按 Bridge 调用完成日期汇总；统计采用 Redis 批量刷库，页面数据可能有约 5 分钟延迟。
              </Text>
            </section>

            {bridgeStatisticDetails.map(({ scope, statistic }, index) => (
              <section key={bridgeStatisticScopeKey(scope)} className="manager-data-card manager-table">
                <Space
                  wrap
                  size={10}
                  style={{ width: "100%", justifyContent: "space-between", marginBottom: 18 }}
                >
                  <Space wrap size={8}>
                    <Tag color={index === 0 ? "blue" : "default"}>{index === 0 ? "默认展示" : `展示项 ${index + 1}`}</Tag>
                    <Text className="manager-value">{formatBridgeStatisticScope(scope, shopGroupLabelMap)}</Text>
                  </Space>
                  {statistic ? (
                    <Tag className="manager-dashboard-tag">Bridge {statistic.bridgeCount}</Tag>
                  ) : null}
                </Space>

                {statistic ? (
                  <>
                    <div className="manager-dashboard-bridge-statistic__drawer-metrics">
                      {buildBridgeDailyStatisticMetrics(statistic, true).map((metric) => (
                        <div key={metric.label} className="manager-dashboard-card__metric">
                          <div className="manager-dashboard-card__metric-label">{metric.label}</div>
                          <div className="manager-dashboard-card__metric-value">{metric.value}</div>
                        </div>
                      ))}
                    </div>
                    <Text style={{ display: "block", marginTop: 14, color: "var(--manager-text-soft)" }}>
                      统计日期：{formatStatisticDateRange(statistic.startDate, statistic.endDate)}
                    </Text>
                    {statistic.unmappedShopGroupIds.length > 0 ? (
                      <Text style={{ display: "block", marginTop: 6, color: "var(--manager-warning)" }}>
                        未关联 Bridge 的商品分组：{formatShopGroupLabels(statistic.unmappedShopGroupIds, shopGroupLabelMap)}
                      </Text>
                    ) : null}
                    <Table<BridgeDailyStatisticDetail>
                      style={{ marginTop: 18 }}
                      rowKey={(record) => `${bridgeStatisticScopeKey(scope)}-${record.statDate}-${record.bridgeId}-${record.bridgeType}`}
                      pagination={false}
                      scroll={{ x: 1060 }}
                      dataSource={statistic.detailList}
                      columns={buildBridgeDailyStatisticColumns(shopGroupLabelMap)}
                      locale={{ emptyText: "当前组合暂未关联可统计的 Bridge" }}
                    />
                  </>
                ) : (
                  <div className="manager-dashboard-bridge-statistic__loading"><Spin size="small" /> 正在加载此组合的统计数据</div>
                )}
              </section>
            ))}
          </div>
        ) : (
          <section className="manager-data-card" style={{ minHeight: 180, display: "grid", placeItems: "center" }}>
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="尚未配置商品分组和 BridgeType 组合" />
          </section>
        )}
      </Drawer>

      <Drawer
        title={editingCardId ? `编辑 ${DASHBOARD_TITLES[editingCardId]}` : "编辑 dashboard"}
        placement="right"
        width={420}
        open={Boolean(editingCardId)}
        onClose={() => setEditingCardId(null)}
        className="manager-dashboard-drawer"
        extra={
          <Space>
            <Button onClick={() => setEditingCardId(null)}>取消</Button>
            <Button type="primary" onClick={() => void handleSaveConfig()}>
              保存
            </Button>
          </Space>
        }
      >
        <Form<DashboardCardConfig> form={form} layout="vertical" initialValues={{ visible: true, categoryIds: [] }}>
          {editingCardId && !["realManualSubmitted", "lowPriceManualSubmitted", "lowPriceActualCompleted"].includes(editingCardId) ? (
            <Form.Item label="显示当前 dashboard" name="visible" valuePropName="checked">
              <Switch checkedChildren="显示" unCheckedChildren="隐藏" />
            </Form.Item>
          ) : null}

          {editingCardId && !isUpstreamUserMetric(editingCardId) && editingCardId !== "actualCompleted" && editingCardId !== "averageSpeed" && editingCardId !== "productCount" && editingCardId !== "bridgeDailyStatistic" && editingCardId !== "pendingDetection" ? (
            <Form.Item
              label={getEditSelectorConfig(editingCardId).label}
              name="categoryIds"
              extra={getEditSelectorConfig(editingCardId).extra}
            >
              <Select
                mode="multiple"
                allowClear
                maxTagCount="responsive"
                placeholder={getEditSelectorConfig(editingCardId).placeholder}
                options={isManualProductMetric(editingCardId) ? manualProductOptions : categoryOptions}
              />
            </Form.Item>
          ) : null}

          {editingCardId === "pendingDetection" ? (
            <Form.Item
              label="商品分组"
              name="shopGroupIds"
              extra="可选择一个或多个商品分组；不选择时统计全部商品分组。"
            >
              <Select
                mode="multiple"
                allowClear
                maxTagCount="responsive"
                placeholder="请选择需要纳入待检测统计的商品分组"
                options={shopGroupOptions}
              />
            </Form.Item>
          ) : null}

          {editingCardId === "bridgeDailyStatistic" ? (
            <Form.List
              name="bridgeStatisticScopes"
              rules={[
                {
                  validator: async (_, scopes: BridgeStatisticScope[] | undefined) => {
                    if (!Array.isArray(scopes) || scopes.length === 0) {
                      throw new Error("请至少配置一个商品分组 + BridgeType 组合");
                    }
                    const keys = scopes.map((scope) => bridgeStatisticScopeKey(scope));
                    if (new Set(keys).size !== keys.length) {
                      throw new Error("商品分组 + BridgeType 组合不能重复");
                    }
                  },
                },
              ]}
            >
              {(fields, { add, move, remove }, { errors }) => (
                <>
                  <Text style={{ display: "block", marginBottom: 8, color: "var(--manager-text)" }}>
                    展示组合
                  </Text>
                  <Text style={{ display: "block", marginBottom: 14, color: "var(--manager-text-soft)" }}>
                    第一项为卡片默认展示项；点击卡片可查看全部组合的每日统计。
                  </Text>
                  {fields.map((field, index) => (
                    <section
                      key={field.key}
                      className="manager-data-card"
                      style={{ padding: 14, marginBottom: 12 }}
                    >
                      <Space style={{ width: "100%", justifyContent: "space-between", marginBottom: 12 }}>
                        <Tag color={index === 0 ? "blue" : "default"}>
                          {index === 0 ? "默认展示" : `展示项 ${index + 1}`}
                        </Tag>
                        <Space size={2}>
                          <Tooltip title="上移，设为默认展示">
                            <Button
                              type="text"
                              size="small"
                              icon={<ArrowUpOutlined />}
                              disabled={index === 0}
                              onClick={() => move(index, index - 1)}
                            />
                          </Tooltip>
                          <Tooltip title="下移">
                            <Button
                              type="text"
                              size="small"
                              icon={<ArrowDownOutlined />}
                              disabled={index === fields.length - 1}
                              onClick={() => move(index, index + 1)}
                            />
                          </Tooltip>
                          <Tooltip title="删除此组合">
                            <Button
                              danger
                              type="text"
                              size="small"
                              icon={<DeleteOutlined />}
                              disabled={fields.length <= 1}
                              onClick={() => remove(field.name)}
                            />
                          </Tooltip>
                        </Space>
                      </Space>
                      <Form.Item
                        {...field}
                        label="商品分组"
                        name={[field.name, "shopGroupId"]}
                        rules={[{ required: true, message: "请选择商品分组" }]}
                      >
                        <Select
                          allowClear
                          placeholder="请选择商品分组"
                          options={shopGroupOptions}
                        />
                      </Form.Item>
                      <Form.Item
                        {...field}
                        label="BridgeType"
                        name={[field.name, "bridgeType"]}
                        rules={[{ required: true, message: "请选择 BridgeType" }]}
                        style={{ marginBottom: 0 }}
                      >
                        <Select
                          allowClear
                          placeholder="请选择 BridgeType"
                          options={bridgeTypeOptions}
                        />
                      </Form.Item>
                    </section>
                  ))}
                  <Button
                    block
                    type="dashed"
                    icon={<PlusOutlined />}
                    onClick={() => add({
                      shopGroupId: shopGroupOptions[0]?.value ?? 1,
                      bridgeType: bridgeTypeOptions[0]?.value ?? DEFAULT_BRIDGE_TYPE,
                    })}
                  >
                    添加商品分组 + BridgeType
                  </Button>
                  <Form.ErrorList errors={errors} />
                </>
              )}
            </Form.List>
          ) : null}

          {editingCardId === "averageSpeed" ? (
            <Form.Item
              label="Barry 统计时间窗口（秒）"
              name="barryWindowSeconds"
              extra="人工速度每 10 秒采集一次；此参数决定 Barry 统计最近多少秒的数据。"
            >
              <InputNumber min={MIN_BARRY_WINDOW_SECONDS} max={MAX_BARRY_WINDOW_SECONDS} precision={0} style={{ width: "100%" }} />
            </Form.Item>
          ) : null}

          {editingCardId === "productCount" ? (
            <Form.Item
              label="实时上号统计时间窗口（秒）"
              name="userOverviewWindowSeconds"
              extra="默认 120 秒，最大 1 小时；小于 10 分钟每 10 秒刷新，否则每分钟刷新。"
            >
              <InputNumber min={MIN_BARRY_WINDOW_SECONDS} max={MAX_BARRY_WINDOW_SECONDS} precision={0} style={{ width: "100%" }} />
            </Form.Item>
          ) : null}

          <section className="manager-data-card" style={{ padding: 18 }}>
            <Space align="start">
              <AppstoreOutlined style={{ color: "var(--manager-primary)", fontSize: 18, marginTop: 3 }} />
              <div>
                <Text style={{ color: "var(--manager-text)", fontWeight: 700 }}>配置说明</Text>
                <Paragraph style={{ marginTop: 8, marginBottom: 0, color: "var(--manager-text-soft)" }}>
                  当前 dashboard 配置保存在浏览器 `localStorage` 中，只影响当前管理端页面展示，不会写入后端。
                </Paragraph>
              </div>
            </Space>
          </section>
        </Form>
      </Drawer>
    </>
  );
}

// Merge a partial payload into the session cache instead of overwriting it, so the
// four independently-loaded dashboard metrics and the bulk data don't clobber each other.
function mergeDashboardCache(partial: Partial<DashboardDataCache>) {
  if (typeof window === "undefined") {
    return;
  }
  try {
    const rawValue = window.sessionStorage.getItem(DASHBOARD_DATA_CACHE_KEY);
    const current = rawValue ? (JSON.parse(rawValue) as Partial<DashboardDataCache>) : {};
    window.sessionStorage.setItem(
      DASHBOARD_DATA_CACHE_KEY,
      JSON.stringify({ ...current, ...partial }),
    );
  } catch {
    // Ignore cache write failures; the UI still works from live state.
  }
}

function mergeDashboardConfig(
  current: Record<DashboardCardId, DashboardCardConfig>,
  incoming?: Partial<Record<DashboardCardId, DashboardCardConfig>>,
) {
  if (!incoming) {
    return current;
  }

  return (Object.keys(DASHBOARD_DEFAULT_CONFIG) as DashboardCardId[]).reduce(
    (accumulator, cardId) => {
      const config = incoming[cardId];
      accumulator[cardId] = {
        visible: ["realManualSubmitted", "lowPriceManualSubmitted", "lowPriceActualCompleted"].includes(cardId)
          ? true
          : (config?.visible ?? current[cardId].visible),
        categoryIds: Array.isArray(config?.categoryIds) ? config?.categoryIds : current[cardId].categoryIds,
        shopGroupIds: cardId === "pendingDetection"
          ? (Array.isArray(config?.shopGroupIds)
            ? normalizeShopGroupIds(config.shopGroupIds)
            : current[cardId].shopGroupIds)
          : current[cardId].shopGroupIds,
        bridgeStatisticScopes: cardId === "bridgeDailyStatistic"
          ? (Array.isArray(config?.bridgeStatisticScopes)
            ? normalizeBridgeStatisticScopes(config.bridgeStatisticScopes)
            : current[cardId].bridgeStatisticScopes)
          : current[cardId].bridgeStatisticScopes,
        barryWindowSeconds: clampBarryWindowSeconds(
          config?.barryWindowSeconds ?? current[cardId].barryWindowSeconds,
        ),
        userOverviewWindowSeconds: clampBarryWindowSeconds(
          config?.userOverviewWindowSeconds ?? current[cardId].userOverviewWindowSeconds,
        ),
      };
      return accumulator;
    },
    { ...current },
  );
}

function applyDashboardConfigPresets(
  cards?: Partial<Record<DashboardCardId, DashboardCardConfig>>,
) {
  if (!cards) {
    return cards;
  }

  return {
    ...cards,
    productCount: cards.productCount
      ? { ...cards.productCount, userOverviewWindowSeconds: 120 }
      : undefined,
    bridgeDailyStatistic: {
      visible: cards.bridgeDailyStatistic?.visible ?? true,
      categoryIds: [],
      bridgeStatisticScopes: resolveBridgeStatisticScopes(cards.bridgeDailyStatistic),
    },
    pendingDetection: {
      visible: cards.pendingDetection?.visible ?? true,
      categoryIds: [],
      shopGroupIds: DEFAULT_PENDING_DETECTION_SHOP_GROUP_IDS,
    },
    realManualSubmitted: cards.realManualSubmitted
      ? { ...cards.realManualSubmitted, categoryIds: [2, 18] }
      : undefined,
    realActualCompleted: cards.realActualCompleted
      ? { ...cards.realActualCompleted, categoryIds: [7, 12] }
      : undefined,
    lowPriceManualSubmitted: { visible: true, categoryIds: LOW_PRICE_MANUAL_PRODUCT_IDS },
    lowPriceActualCompleted: { visible: true, categoryIds: LOW_PRICE_UPSTREAM_CATEGORY_IDS },
  };
}

function renderDashboardCard({
  cardId,
  view,
  relatedView,
  onEdit,
  onOpenDetail,
  actions,
  featured = false,
}: {
  cardId: DashboardCardId;
  view: DashboardCardView;
  relatedView?: DashboardCardView;
  onEdit: (cardId: DashboardCardId) => void;
  onOpenDetail: (cardId: DashboardCardId) => void;
  actions?: ReactNode;
  featured?: boolean;
}) {
  const clickable = !view.disableDetail;
  const hasTopRow = Boolean(view.scopeLabel) || Boolean(actions) || view.editable !== false;
  const isLowPriceWorkload = cardId === "lowPriceActualCompleted";
  const relatedCardId: DashboardCardId = isLowPriceWorkload ? "lowPriceManualSubmitted" : "realManualSubmitted";
  const relatedEditTooltip = isLowPriceWorkload ? "编辑低价点赞" : "编辑真人提交统计";
  const actualEditTooltip = isLowPriceWorkload ? "编辑低价实际完成" : "编辑真人实际完成统计";

  if ((cardId === "realActualCompleted" || cardId === "lowPriceActualCompleted") && relatedView) {
    return (
      <article
        key={cardId}
        className="manager-dashboard-card manager-dashboard-card--expanded manager-dashboard-card--real-workload"
        onClick={() => onOpenDetail(cardId)}
      >
        <div className="manager-dashboard-card__backdrop" style={{ background: view.background }} />
        <div className="manager-dashboard-card__content manager-dashboard-card__content--real-workload">
          <div className="manager-dashboard-card__real-workload-header">
            <div className="manager-section-label manager-dashboard-card__scope">{view.scopeLabel}</div>
          </div>

          <div className="manager-dashboard-card__real-workload-groups">
            <section className="manager-dashboard-card__real-workload-group">
              <div className="manager-dashboard-card__real-workload-group-header">
                <div className="manager-section-label">{relatedView.title}</div>
                {relatedView.editable !== false ? (
                  <Tooltip title={relatedEditTooltip}>
                    <Button
                      type="text"
                      size="small"
                      icon={<EditOutlined />}
                      onClick={(event) => {
                        event.stopPropagation();
                        onEdit(relatedCardId);
                      }}
                    />
                  </Tooltip>
                ) : null}
              </div>
              <div
                className="manager-display-title manager-dashboard-card__real-workload-value"
                onClick={(event) => {
                  event.stopPropagation();
                  onOpenDetail(relatedCardId);
                }}
              >
                {relatedView.value}
              </div>
              {relatedView.comparison ? (
                <div
                  onClick={(event) => {
                    event.stopPropagation();
                    onOpenDetail(relatedCardId);
                  }}
                >
                  <DashboardComparisonSummary comparison={relatedView.comparison} />
                </div>
              ) : null}
            </section>

            <section className="manager-dashboard-card__real-workload-group manager-dashboard-card__real-workload-group--actual">
              <div className="manager-dashboard-card__real-workload-group-header">
                <div className="manager-section-label">{view.title}</div>
                <div className="manager-dashboard-card__real-workload-group-actions">
                  {view.editable !== false ? (
                    <Tooltip title={actualEditTooltip}>
                      <Button
                        type="text"
                        size="small"
                        icon={<EditOutlined />}
                        onClick={(event) => {
                          event.stopPropagation();
                          onEdit(cardId);
                        }}
                      />
                    </Tooltip>
                  ) : null}
                  <div
                    className="manager-dashboard-card__icon"
                    style={{ color: view.accent, background: `${view.accent}16` }}
                  >
                    {view.icon}
                  </div>
                </div>
              </div>
              <div className="manager-display-title manager-dashboard-card__real-workload-value">{view.value}</div>
              {view.comparison ? <DashboardComparisonSummary comparison={view.comparison} /> : null}
            </section>
          </div>

          <div className="manager-dashboard-card__metrics manager-dashboard-card__real-workload-metrics">
            {view.detailMetrics.map((metric, index) => (
              <div key={`${metric.label}-${index}`} className="manager-dashboard-card__metric">
                <div className="manager-dashboard-card__metric-label">{metric.label}</div>
                <div className="manager-dashboard-card__metric-value">{metric.value}</div>
              </div>
            ))}
          </div>
        </div>
      </article>
    );
  }

  if (featured) {
    return (
      <article
        key={cardId}
        className={`manager-dashboard-card manager-dashboard-card--featured manager-dashboard-card--static`}
      >
        <div className="manager-dashboard-card__backdrop" style={{ background: view.background }} />
        <div className="manager-dashboard-card__content manager-dashboard-card__content--featured">
          <div className="manager-dashboard-card__featured-main">
            <div
              className="manager-dashboard-card__icon"
              style={{ color: view.accent, background: `${view.accent}16` }}
            >
              {view.icon}
            </div>
            <div style={{ minWidth: 0 }}>
              <div className="manager-section-label manager-dashboard-card__scope">{view.scopeLabel}</div>
              <Space size={12} wrap style={{ marginTop: 4 }}>
                <Text style={{ color: "var(--manager-text)", fontWeight: 800 }}>{view.title}</Text>
                <div className="manager-display-title manager-dashboard-card__featured-value">
                  {view.value}
                </div>
              </Space>
            </div>
          </div>

          {view.detailMetrics.length > 0 ? (
            <div className="manager-dashboard-card__featured-metrics">
              {view.detailMetrics.map((metric, index) => (
                <div key={`${metric.label}-${index}`} className="manager-dashboard-card__featured-metric">
                  <span>{metric.label}</span>
                  <strong>{metric.value}</strong>
                </div>
              ))}
            </div>
          ) : null}

          {actions || view.editable !== false ? (
            <Space size={8} className="manager-dashboard-card__featured-actions">
              {actions}
              {view.editable !== false ? (
                <Tooltip title="编辑当前 dashboard">
                  <Button
                    type="text"
                    icon={<EditOutlined />}
                    onClick={(event) => {
                      event.stopPropagation();
                      onEdit(cardId);
                    }}
                  />
                </Tooltip>
              ) : null}
            </Space>
          ) : null}
        </div>
      </article>
    );
  }

  if (cardId === "pendingDetection") {
    return (
      <article
        key={cardId}
        className="manager-dashboard-card manager-dashboard-card--compact manager-dashboard-card--pending-detection"
        onClick={() => onOpenDetail(cardId)}
      >
        <div className="manager-dashboard-card__backdrop" style={{ background: view.background }} />
        <div className="manager-dashboard-card__content manager-dashboard-card__content--pending-detection">
          <div className="manager-dashboard-card__pending-detection-header">
            <div className="manager-section-label">{view.title}</div>
            <Space size={4}>
              <div className="manager-section-label manager-dashboard-card__scope">{view.scopeLabel}</div>
              <Tooltip title="编辑当前 dashboard">
                <Button
                  type="text"
                  size="small"
                  icon={<EditOutlined />}
                  onClick={(event) => {
                    event.stopPropagation();
                    onEdit(cardId);
                  }}
                />
              </Tooltip>
            </Space>
          </div>
          <div className="manager-dashboard-card__metrics">
            {view.detailMetrics.map((metric, index) => (
              <div key={`${metric.label}-${index}`} className="manager-dashboard-card__metric">
                <div className="manager-dashboard-card__metric-label">{metric.label}</div>
                <div className="manager-dashboard-card__metric-value">{metric.value}</div>
              </div>
            ))}
          </div>
        </div>
      </article>
    );
  }

  if (cardId === "productCount") {
    return (
      <article
        key={cardId}
        className="manager-dashboard-card manager-dashboard-card--compact manager-dashboard-card--account-status"
        onClick={() => onOpenDetail(cardId)}
      >
        <div className="manager-dashboard-card__backdrop" style={{ background: view.background }} />
        <div className="manager-dashboard-card__content manager-dashboard-card__content--account-status">
          <div className="manager-dashboard-card__account-status-header">
            <div className="manager-section-label">{view.title}</div>
            <Tooltip title="编辑当前 dashboard">
              <Button
                type="text"
                icon={<EditOutlined />}
                onClick={(event) => {
                  event.stopPropagation();
                  onEdit(cardId);
                }}
              />
            </Tooltip>
          </div>
          <div className="manager-dashboard-card__metrics">
            {view.detailMetrics.map((metric, index) => (
              <div key={`${metric.label}-${index}`} className="manager-dashboard-card__metric">
                <div className="manager-dashboard-card__metric-label">{metric.label}</div>
                <div className="manager-dashboard-card__metric-value">{metric.value}</div>
              </div>
            ))}
          </div>
        </div>
      </article>
    );
  }

  return (
    <article
      key={cardId}
      className={`manager-dashboard-card${featured ? " manager-dashboard-card--featured" : ""}${
        view.compact ? " manager-dashboard-card--compact" : ""
      }${view.expanded ? " manager-dashboard-card--expanded" : ""}${
        clickable ? "" : " manager-dashboard-card--static"}`}
      onClick={clickable ? () => onOpenDetail(cardId) : undefined}
    >
      <div className="manager-dashboard-card__backdrop" style={{ background: view.background }} />
      <div className="manager-dashboard-card__content">
        {hasTopRow ? (
          <Space
            size={12}
            style={{ width: "100%", justifyContent: "space-between", alignItems: "flex-start" }}
          >
            <div className="manager-section-label manager-dashboard-card__scope">{view.scopeLabel}</div>

            {actions || view.editable !== false ? (
              <Space size={8}>
                {actions}
                {view.editable !== false ? (
                  <Tooltip title="编辑当前 dashboard">
                    <Button
                      type="text"
                      icon={<EditOutlined />}
                      onClick={(event) => {
                        event.stopPropagation();
                        onEdit(cardId);
                      }}
                    />
                  </Tooltip>
                ) : null}
              </Space>
            ) : null}
          </Space>
        ) : null}

        <Space
          size={14}
          align="start"
          style={{ width: "100%", justifyContent: "space-between", marginTop: hasTopRow ? (featured ? 10 : 8) : 0 }}
        >
          <div>
            <div className="manager-section-label" style={{ letterSpacing: "0.12em" }}>
              {view.title}
            </div>
            {view.value ? (
              <div
                className="manager-display-title"
                style={{ fontSize: featured ? 28 : 24, marginTop: featured ? 8 : 6 }}
              >
                {view.value}
              </div>
            ) : null}
            {view.comparison ? <DashboardComparisonSummary comparison={view.comparison} /> : null}
          </div>

          {!view.hideIcon ? (
            <div
              className="manager-dashboard-card__icon"
              style={{ color: view.accent, background: `${view.accent}16` }}
            >
              {view.icon}
            </div>
          ) : null}
        </Space>

        {view.detailMetrics.length > 0 ? (
          <div className="manager-dashboard-card__metrics">
            {view.detailMetrics.map((metric, index) => (
              <div key={`${metric.label}-${index}`} className="manager-dashboard-card__metric">
                <div className="manager-dashboard-card__metric-label">{metric.label}</div>
                <div className="manager-dashboard-card__metric-value">{metric.value}</div>
                {metric.description ? (
                  <div className="manager-dashboard-card__metric-description">{metric.description}</div>
                ) : null}
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </article>
  );
}

function renderBridgeDailyStatisticCard({
  statistic,
  scope,
  scopeCount,
  shopGroupLabelMap,
  onEdit,
  onOpenDetail,
}: {
  statistic: BridgeDailyStatisticSummary | null;
  scope?: BridgeStatisticScope;
  scopeCount: number;
  shopGroupLabelMap: Map<number, string>;
  onEdit: () => void;
  onOpenDetail: () => void;
}) {
  const hasScope = Boolean(scope);
  const statisticDate = statistic
    ? formatStatisticDateRange(statistic.startDate, statistic.endDate)
    : "今日";
  const requiresManualIntervention = Boolean(statistic && isBridgeDailyStatisticAbnormal(statistic));
  return (
    <article
      key="bridgeDailyStatistic"
      className="manager-dashboard-card manager-dashboard-card--bridge-daily"
      onClick={hasScope ? onOpenDetail : onEdit}
    >
      <div className="manager-dashboard-card__backdrop" style={{ background: "linear-gradient(135deg, rgba(14,116,144,0.1), rgba(255,255,255,0))" }} />
      <div className="manager-dashboard-card__content">
        <div className="manager-dashboard-bridge-statistic__header">
          <div>
            <div className="manager-section-label">
              商品桥接器情况 <Text className="manager-dashboard-bridge-statistic__date">{statisticDate}</Text>
            </div>
          </div>
          <Space size={4}>
            {requiresManualIntervention ? (
              <Tag color="error" icon={<WarningOutlined />}>异常，人工介入</Tag>
            ) : null}
            <Tag className="manager-dashboard-tag">{scopeCount} 个组合</Tag>
            <Tooltip title="编辑展示组合">
              <Button
                type="text"
                size="small"
                icon={<EditOutlined />}
                onClick={(event) => {
                  event.stopPropagation();
                  onEdit();
                }}
              />
            </Tooltip>
          </Space>
        </div>

        {hasScope ? (
          statistic ? (
            <>
              <div className="manager-dashboard-bridge-statistic__metrics">
                {buildBridgeDailyStatisticMetrics(statistic).map((metric) => (
                  <div key={metric.label} className="manager-dashboard-card__metric">
                    <div className="manager-dashboard-card__metric-label">{metric.label}</div>
                    <div className="manager-dashboard-card__metric-value">{metric.value}</div>
                  </div>
                ))}
              </div>
              <div className="manager-dashboard-bridge-statistic__footer">
                Bridge {statistic.bridgeCount} · {scope ? formatBridgeStatisticScope(scope, shopGroupLabelMap) : "-"}
                {statistic.unmappedShopGroupIds.length > 0 ? ` · ${statistic.unmappedShopGroupIds.length} 个未映射` : ""}
              </div>
              {requiresManualIntervention ? (
                <div className="manager-dashboard-bridge-statistic__alert">
                  成功率低于 50%，请人工介入
                </div>
              ) : null}
            </>
          ) : (
            <div className="manager-dashboard-bridge-statistic__loading"><Spin size="small" /> 正在加载商品桥接器情况</div>
          )
        ) : (
          <div className="manager-dashboard-bridge-statistic__loading">尚未配置商品分组和 BridgeType，点击卡片或编辑图标配置</div>
        )}
      </div>
    </article>
  );
}

function buildBridgeDailyStatisticMetrics(statistic: BridgeDailyStatisticSummary, includeDetailMetrics = false) {
  const primaryMetrics = [
    { label: "发送", value: formatCount(statistic.totalNum) },
    { label: "成功", value: formatCount(statistic.successNum) },
    { label: "成功率", value: formatPercent(safeDivide(statistic.successNum, statistic.totalNum)) },
    { label: "失败", value: formatCount(statistic.failNum) },
    { label: "获取不到", value: formatCount(statistic.notGetDataNum) },
    { label: "视频删除", value: formatCount(statistic.deleteNum) },
  ];
  if (!includeDetailMetrics) {
    return primaryMetrics;
  }
  return [
    ...primaryMetrics,
    { label: "异常", value: formatCount(statistic.errorNum) },
    { label: "私密", value: formatCount(statistic.secretNum) },
    { label: "未授权", value: formatCount(statistic.unAuthorizeNum) },
  ];
}

function isBridgeDailyStatisticAbnormal(statistic: BridgeDailyStatisticSummary) {
  return statistic.totalNum > 0
    && safeDivide(statistic.successNum, statistic.totalNum) < BRIDGE_SUCCESS_RATE_ALERT_THRESHOLD;
}

function formatStatisticDateRange(startDate: string, endDate: string) {
  if (!startDate) {
    return "今日";
  }
  return startDate === endDate || !endDate ? startDate : `${startDate} 至 ${endDate}`;
}

function DashboardComparisonSummary({ comparison }: { comparison: DashboardComparison }) {
  const directionClass =
    comparison.change > 0
      ? "manager-dashboard-card__comparison-change--up"
      : comparison.change < 0
        ? "manager-dashboard-card__comparison-change--down"
        : undefined;
  const changePrefix = comparison.change > 0 ? "+" : "";

  return (
    <div className="manager-dashboard-card__comparison">
      <span>{`${comparison.yesterdayLabel} ${comparison.yesterdayValue}`}</span>
      <span className={directionClass}>{`较昨日 ${changePrefix}${comparison.changeValue} (${formatRate(comparison.changeRate)}%)`}</span>
    </div>
  );
}

function renderTotalPendingMetricValue(totalPendingCount: number, yesterdayPendingCount: number): ReactNode {
  return (
    <span>
      {formatCount(totalPendingCount)}
      <Tooltip title="昨日剩余">
        <span className="manager-dashboard-card__metric-note">（{formatCount(yesterdayPendingCount)}）</span>
      </Tooltip>
    </span>
  );
}

function renderUninitiatedOrderMetricValue(totalCount: number, recentCount: number): ReactNode {
  return (
    <span className="manager-dashboard-card__metric-value--pending">
      {formatCount(totalCount)}
      <Tooltip title="括号内为最近 3 分钟创建且当前仍处于未开始状态的订单数量">
        <span className="manager-dashboard-card__metric-value--recent-uninitiated">
          （{formatCount(recentCount)}）
        </span>
      </Tooltip>
    </span>
  );
}

function renderDelayDetectionMetricValue(count: number, rate: number | undefined): ReactNode {
  return (
    <span>
      {formatCount(count)}
      <Tooltip title="检测速度">
        <span className="manager-dashboard-card__metric-note">（{formatDelayDetectionRate(rate)}）</span>
      </Tooltip>
    </span>
  );
}

function buildDashboardComparison(
  yesterdayValue: number,
  changeValue: number,
  changeRate: number,
  formatter: (value: number) => string,
): DashboardComparison {
  return {
    yesterdayLabel: "昨日",
    yesterdayValue: formatter(yesterdayValue),
    changeValue: formatter(changeValue),
    change: changeValue,
    changeRate,
  };
}

function buildDerivedCategoryDetails(
  categories: ShopCategoryRecord[],
  productNameMap: Map<number, string>,
  users: UserRecord[],
  userStats: UserStats,
  workbenchStatistics: WorkbenchDashboardStatistics | null,
) {
  const visibleUsers = userStats.visibleUsers || users.length || 1;
  const activeUsers = userStats.activeUsers || users.filter((item) => resolveUserActive(item)).length || 1;
  const statisticsByCategoryCode = new Map(
    (workbenchStatistics?.categoryList ?? [])
      .filter((item) => item.categoryCode?.trim())
      .map((item) => [item.categoryCode.trim(), item]),
  );

  return categories.map<DerivedCategoryDetail>((item, index) => {
    const price = Number(item.price || 0);
    const lowerLimit = Number(item.lowerLimit || 0);
    const upperLimit = Number(item.upperLimit || 0);
    const active = resolveCategoryActive(item.status);
    const capacity = Math.max(upperLimit - lowerLimit, 0);
    const weight = index + 1;
    const activeFactor = active ? 1 : 0.58;
    const categoryStatistics = item.barryShopCategoryCode.trim()
      ? statisticsByCategoryCode.get(item.barryShopCategoryCode.trim())
      : undefined;
    const todayConsume = roundToCurrency((capacity * 0.34 + lowerLimit * 0.92 + weight * 7.4) * (price + 0.18) * activeFactor);
    const todayRecharge = roundToCurrency(todayConsume * (1.12 + (weight % 4) * 0.03));
    const taskRemaining = categoryStatistics?.pendingNum ?? 0;
    const manualSubmitted = categoryStatistics?.submittedNum ?? 0;
    const actualCompleted = categoryStatistics?.completedNum ?? 0;
    const userCoverage = Math.max(
      1,
      Math.round(visibleUsers / Math.max(categories.length, 1) + (weight % 4) + activeUsers / 12),
    );
    const completionRate = manualSubmitted === 0 ? 0 : Math.min(actualCompleted / manualSubmitted, 1);

    return {
      key: item.id,
      id: item.id,
      productName: productNameMap.get(item.shopId) || `商品#${item.shopId}`,
      categoryName: item.name || `类目#${item.id}`,
      status: resolveCategoryActive(item.status) ? "激活" : "下架",
      price,
      lowerLimit,
      upperLimit,
      todayConsume,
      todayRecharge,
      taskRemaining,
      manualSubmitted,
      actualCompleted,
      pendingDetectionCount: 0,
      finishAssignmentPendingDetectionCount: 0,
      delayAssignmentPendingDetectionCount: 0,
      userCoverage,
      completionRate,
      manualSpeedPerSecond: 0,
      actualSpeedPerSecond: 0,
    };
  });
}

function buildDerivedManualProductDetails(
  manualProducts: ManualProductRecord[],
  workbenchStatistics: WorkbenchDashboardStatistics | null,
) {
  const statisticsByCategoryCode = new Map(
    (workbenchStatistics?.categoryList ?? [])
      .filter((item) => item.categoryCode?.trim())
      .map((item) => [item.categoryCode.trim(), item]),
  );

  return manualProducts.map<DerivedCategoryDetail>((item) => {
    const categoryStatistics = item.code.trim()
      ? statisticsByCategoryCode.get(item.code.trim())
      : undefined;
    const active = resolveManualProductActive(item.status);
    const manualSubmitted = categoryStatistics?.submittedNum ?? 0;
    const actualCompleted = categoryStatistics?.completedNum ?? 0;

    return {
      key: item.id,
      id: item.id,
      productName: item.code || `人工商品#${item.id}`,
      categoryName: item.name || item.code || `人工商品#${item.id}`,
      status: active ? "激活" : "下架",
      price: 0,
      lowerLimit: 0,
      upperLimit: 0,
      todayConsume: 0,
      todayRecharge: 0,
      taskRemaining: categoryStatistics?.pendingNum ?? 0,
      manualSubmitted,
      actualCompleted,
      pendingDetectionCount: 0,
      finishAssignmentPendingDetectionCount: 0,
      delayAssignmentPendingDetectionCount: 0,
      userCoverage: 0,
      completionRate: manualSubmitted === 0 ? 0 : Math.min(actualCompleted / manualSubmitted, 1),
      manualSpeedPerSecond: 0,
      actualSpeedPerSecond: 0,
    };
  });
}

function resolveScopedDetails(details: DerivedCategoryDetail[], categoryIds: number[]) {
  if (categoryIds.length === 0) {
    return details;
  }
  return details.filter((item) => categoryIds.includes(item.id));
}

function toBaseDashboardDetail(key: number, username: string, remark: string): DerivedCategoryDetail {
  return {
    key,
    id: key,
    productName: username,
    categoryName: remark,
    status: "激活",
    price: 0,
    lowerLimit: 0,
    upperLimit: 0,
    todayConsume: 0,
    todayRecharge: 0,
    taskRemaining: 0,
    manualSubmitted: 0,
    actualCompleted: 0,
    pendingDetectionCount: 0,
    finishAssignmentPendingDetectionCount: 0,
    delayAssignmentPendingDetectionCount: 0,
    userCoverage: 0,
    completionRate: 0,
    manualSpeedPerSecond: 0,
    actualSpeedPerSecond: 0,
  };
}

function toConsumeDetailRows(details: NonNullable<DashboardStatistics["todayConsume"]>["detailList"]): DerivedCategoryDetail[] {
  return details.map((detail) => ({
    ...toBaseDashboardDetail(detail.accountId, detail.username, detail.remark),
    todayConsume: detail.consumeAmount,
    todayRecharge: detail.refundAmount,
    userCoverage: detail.bkAmount,
  }));
}

function toRechargeDetailRows(details: NonNullable<DashboardStatistics["todayRecharge"]>["detailList"]): DerivedCategoryDetail[] {
  return details.map((detail) => ({
    ...toBaseDashboardDetail(detail.accountId, detail.username, detail.remark),
    todayRecharge: detail.rechargeAmount,
    todayConsume: detail.givenAmount,
  }));
}

function toBalanceDetailRows(details: NonNullable<DashboardStatistics["systemBalance"]>["detailList"]): DerivedCategoryDetail[] {
  return details.map((detail) => ({
    ...toBaseDashboardDetail(detail.accountId, detail.username, detail.remark),
    todayRecharge: detail.accountAmount,
  }));
}

function toOnlineUserDetailRows(details: WorkbenchUserOverview["detailList"]): DerivedCategoryDetail[] {
  return details.map((detail) => ({
    ...toBaseDashboardDetail(detail.userId, detail.username, detail.channel),
    userCoverage: detail.accountCount,
  }));
}

function buildDashboardCardView(
  cardId: DashboardCardId,
  detailRows: DerivedCategoryDetail[],
  products: ShopRecord[],
  users: UserRecord[],
  userStats: UserStats,
  workbenchStatistics: WorkbenchDashboardStatistics | null,
  realManualSubmittedStatistics: WorkbenchDashboardStatistics | null,
  lowPriceManualSubmittedStatistics: WorkbenchDashboardStatistics | null,
  workbenchUserOverview: WorkbenchUserOverview | null,
  dashboardStatistics: DashboardStatistics | null,
  lowPriceActualCompleted: ActualCompletedSummary | null,
  pendingDetectionCount: PendingDetectionCountSummary | null,
  realDelayAssignmentCount: DelayAssignmentCountSummary | null,
  lowPriceDelayAssignmentCount: DelayAssignmentCountSummary | null,
  scopeLabel: string,
): DashboardCardView {
  const currencyTotal = detailRows.reduce((sum, item) => sum + item.todayConsume, 0);
  const remainingTotal = detailRows.reduce((sum, item) => sum + item.taskRemaining, 0);
  const manualTotal = detailRows.reduce((sum, item) => sum + item.manualSubmitted, 0);
  const actualCompletedTotal = detailRows.reduce((sum, item) => sum + item.actualCompleted, 0);
  const manualSpeedPerSecond = detailRows.reduce((sum, item) => sum + item.manualSpeedPerSecond, 0);
  const actualSpeedPerSecond = detailRows.reduce((sum, item) => sum + item.actualSpeedPerSecond, 0);
  const averageSpeedPerSecond = (manualSpeedPerSecond + actualSpeedPerSecond) / 2;

  switch (cardId) {
    case "pendingDetection": {
      const groupDetails = (pendingDetectionCount?.groupList ?? []).map((item) => ({
        ...toBaseDashboardDetail(item.shopGroupId, item.groupName, item.groupCode),
        pendingDetectionCount: getFinishAssignmentPendingDetectionCount(item),
        finishAssignmentPendingDetectionCount: getFinishAssignmentPendingDetectionCount(item),
        delayAssignmentPendingDetectionCount: getDelayAssignmentPendingDetectionCount(item),
      }));
      const finishAssignmentPendingDetectionCount = getFinishAssignmentPendingDetectionCount(pendingDetectionCount);
      const delayAssignmentPendingDetectionCount = getDelayAssignmentPendingDetectionCount(pendingDetectionCount);
      return {
        title: DASHBOARD_TITLES[cardId],
        scopeLabel,
        unitLabel: "双延迟待检测数量",
        icon: <WarningOutlined style={{ fontSize: 22 }} />,
        accent: "#d97706",
        background: "linear-gradient(135deg, rgba(217,119,6,0.1), rgba(255,255,255,0))",
        value: <AnimatedNumber value={finishAssignmentPendingDetectionCount + delayAssignmentPendingDetectionCount} format={formatCount} />,
        detailMetrics: [
          { label: "分配延迟待检测", value: formatCount(finishAssignmentPendingDetectionCount) },
          { label: "用户分配延迟待处理", value: formatCount(delayAssignmentPendingDetectionCount) },
        ],
        detailRows: groupDetails,
        compact: true,
      };
    }
    case "productCount":
      return {
        title: DASHBOARD_TITLES[cardId],
        scopeLabel: "",
        unitLabel: "实时上号情况",
        icon: <TeamOutlined style={{ fontSize: 22 }} />,
        accent: "#2563eb",
        background: "linear-gradient(135deg, rgba(37,99,235,0.1), rgba(255,255,255,0))",
        value: null,
        detailMetrics: [
          {
            label: "累计用户数",
            value: `${formatCount(workbenchUserOverview?.userCount ?? (userStats.visibleUsers || users.length))} 人`,
          },
          {
            label: "累计上号数量",
            value: `${formatCount(workbenchUserOverview?.accountCount ?? userStats.accountCount)} 个`,
          },
          {
            label: "实时用户数量",
            value: `${formatCount(workbenchUserOverview?.onlineUserCount ?? 0)} 人`,
          },
          {
            label: "实时上号数量",
            value: `${formatCount(workbenchUserOverview?.onlineAccountCount ?? 0)} 个`,
          },
        ],
        detailRows: toOnlineUserDetailRows(workbenchUserOverview?.detailList ?? []),
        compact: true,
        hideIcon: true,
      };
    case "todayConsume":
      return {
        title: DASHBOARD_TITLES[cardId],
        scopeLabel: "",
        unitLabel: "消费金额",
        icon: <PayCircleOutlined style={{ fontSize: 22 }} />,
        accent: "#dc2626",
        background: "linear-gradient(135deg, rgba(220,38,38,0.08), rgba(255,255,255,0))",
        value: <AnimatedNumber value={dashboardStatistics?.todayConsume?.amount ?? 0} format={formatCurrency} />,
        comparison: buildDashboardComparison(
          dashboardStatistics?.todayConsume?.yesterdayAmount ?? 0,
          dashboardStatistics?.todayConsume?.amountChange ?? 0,
          dashboardStatistics?.todayConsume?.amountChangeRate ?? 0,
          formatCurrency,
        ),
        detailMetrics: [],
        detailRows: toConsumeDetailRows(dashboardStatistics?.todayConsume?.detailList ?? []),
        editable: false,
        compact: true,
      };
    case "todayRecharge":
      return {
        title: DASHBOARD_TITLES[cardId],
        scopeLabel: "",
        unitLabel: "充值金额",
        icon: <WalletOutlined style={{ fontSize: 22 }} />,
        accent: "#2563eb",
        background: "linear-gradient(135deg, rgba(37,99,235,0.08), rgba(255,255,255,0))",
        value: <AnimatedNumber value={dashboardStatistics?.todayRecharge?.amount ?? 0} format={formatCurrency} />,
        comparison: buildDashboardComparison(
          dashboardStatistics?.todayRecharge?.yesterdayAmount ?? 0,
          dashboardStatistics?.todayRecharge?.amountChange ?? 0,
          dashboardStatistics?.todayRecharge?.amountChangeRate ?? 0,
          formatCurrency,
        ),
        detailMetrics: [],
        detailRows: toRechargeDetailRows(dashboardStatistics?.todayRecharge?.detailList ?? []),
        editable: false,
        compact: true,
      };
    case "systemBalance":
      return {
        title: DASHBOARD_TITLES[cardId],
        scopeLabel: "",
        unitLabel: "余额金额",
        icon: <FundOutlined style={{ fontSize: 22 }} />,
        accent: "#d97706",
        background: "linear-gradient(135deg, rgba(217,119,6,0.1), rgba(255,255,255,0))",
        value: <AnimatedNumber value={dashboardStatistics?.systemBalance?.amount ?? 0} format={formatCurrency} />,
        detailMetrics: [],
        detailRows: toBalanceDetailRows(dashboardStatistics?.systemBalance?.detailList ?? []),
        editable: false,
        compact: true,
      };
    case "taskRemaining": {
      // The workbench remaining endpoint only covers Barry's manual queue. Use
      // the upstream order backlog so this card matches the real remaining data.
      const pendingByCategory = new Map(
        (dashboardStatistics?.actualCompleted?.categoryList ?? []).map((item) => [
          item.shopCategoryId,
          item.totalPendingCount,
        ]),
      );
      const upstreamTaskDetails = detailRows
        .map((item) => ({
          ...item,
          taskRemaining: pendingByCategory.get(item.id) ?? 0,
        }))
        .filter((item) => item.taskRemaining > 0)
        .sort((left, right) => right.taskRemaining - left.taskRemaining);
      const actualTotalPending = dashboardStatistics?.actualCompleted?.totalPendingCount;
      return {
        title: DASHBOARD_TITLES[cardId],
        scopeLabel: "所有上游商品类目",
        unitLabel: "上游商品类目剩余任务量",
        icon: <ShopOutlined style={{ fontSize: 22 }} />,
        accent: "#4f46e5",
        background: "linear-gradient(135deg, rgba(79,70,229,0.09), rgba(255,255,255,0))",
        value: <AnimatedNumber value={actualTotalPending ?? remainingTotal} format={formatCount} />,
        detailMetrics: [],
        detailRows: upstreamTaskDetails,
        editable: false,
        compact: true,
      };
    }
    case "manualSubmitted":
      return {
        title: DASHBOARD_TITLES[cardId],
        scopeLabel,
        unitLabel: "人工提交量",
        icon: <TeamOutlined style={{ fontSize: 22 }} />,
        accent: "#0f766e",
        background: "linear-gradient(135deg, rgba(15,118,110,0.1), rgba(255,255,255,0))",
        value: <AnimatedNumber value={workbenchStatistics?.submittedNum ?? manualTotal} format={formatCount} />,
        comparison: buildDashboardComparison(
          workbenchStatistics?.yesterdaySubmittedNum ?? 0,
          workbenchStatistics?.submittedChange ?? 0,
          workbenchStatistics?.submittedChangeRate ?? 0,
          formatCount,
        ),
        detailMetrics: [],
        detailRows,
        compact: true,
      };
    case "actualCompleted": {
      const completedByCategory = new Map(
        (dashboardStatistics?.actualCompleted?.categoryList ?? []).map((item) => [item.shopCategoryId, item.count]),
      );
      const actualDetailRows = detailRows.map((item) => ({
        ...item,
        actualCompleted: completedByCategory.get(item.id) ?? 0,
      }));
      return {
        title: DASHBOARD_TITLES[cardId],
        scopeLabel: "",
        unitLabel: "完成数量",
        icon: <AppstoreOutlined style={{ fontSize: 22 }} />,
        accent: "#16a34a",
        background: "linear-gradient(135deg, rgba(22,163,74,0.1), rgba(255,255,255,0))",
        value: <AnimatedNumber value={dashboardStatistics?.actualCompleted?.count ?? 0} format={formatCount} />,
        comparison: buildDashboardComparison(
          dashboardStatistics?.actualCompleted?.yesterdayCount ?? 0,
          dashboardStatistics?.actualCompleted?.countChange ?? 0,
          dashboardStatistics?.actualCompleted?.countChangeRate ?? 0,
          formatCount,
        ),
        detailMetrics: [],
        detailRows: actualDetailRows,
        editable: false,
        compact: true,
      };
    }
    case "realManualSubmitted":
      return {
        title: DASHBOARD_TITLES[cardId],
        scopeLabel: "真人",
        unitLabel: "真人人工提交量",
        icon: <TeamOutlined style={{ fontSize: 22 }} />,
        accent: "#0f766e",
        background: "linear-gradient(135deg, rgba(15,118,110,0.1), rgba(255,255,255,0))",
        value: <AnimatedNumber value={realManualSubmittedStatistics?.submittedNum ?? manualTotal} format={formatCount} />,
        comparison: buildDashboardComparison(
          realManualSubmittedStatistics?.yesterdaySubmittedNum ?? 0,
          realManualSubmittedStatistics?.submittedChange ?? 0,
          realManualSubmittedStatistics?.submittedChangeRate ?? 0,
          formatCount,
        ),
        detailMetrics: [],
        detailRows,
        compact: true,
      };
    case "lowPriceManualSubmitted":
      return {
        title: DASHBOARD_TITLES[cardId],
        scopeLabel: "低价",
        unitLabel: "低价提交量",
        icon: <TeamOutlined style={{ fontSize: 22 }} />,
        accent: "#0f766e",
        background: "linear-gradient(135deg, rgba(15,118,110,0.1), rgba(255,255,255,0))",
        value: <AnimatedNumber value={lowPriceManualSubmittedStatistics?.submittedNum ?? manualTotal} format={formatCount} />,
        comparison: buildDashboardComparison(
          lowPriceManualSubmittedStatistics?.yesterdaySubmittedNum ?? 0,
          lowPriceManualSubmittedStatistics?.submittedChange ?? 0,
          lowPriceManualSubmittedStatistics?.submittedChangeRate ?? 0,
          formatCount,
        ),
        detailMetrics: [],
        detailRows,
        compact: true,
      };
    case "realActualCompleted": {
      const realActualCompleted = dashboardStatistics?.realActualCompleted;
      const completedByCategory = new Map(
        (realActualCompleted?.categoryList ?? []).map((item) => [item.shopCategoryId, item.count]),
      );
      const realActualDetailRows = detailRows.map((item) => ({
        ...item,
        actualCompleted: completedByCategory.get(item.id) ?? 0,
      }));
      return {
        title: DASHBOARD_TITLES[cardId],
        scopeLabel: "真人",
        unitLabel: "真人实际完成量",
        icon: <AppstoreOutlined style={{ fontSize: 22 }} />,
        accent: "#16a34a",
        background: "linear-gradient(135deg, rgba(22,163,74,0.1), rgba(255,255,255,0))",
        value: <AnimatedNumber value={realActualCompleted?.count ?? 0} format={formatCount} />,
        comparison: buildDashboardComparison(
          realActualCompleted?.yesterdayCount ?? 0,
          realActualCompleted?.countChange ?? 0,
          realActualCompleted?.countChangeRate ?? 0,
          formatCount,
        ),
        detailMetrics: [
          {
            label: "未开始",
            value: renderUninitiatedOrderMetricValue(
              realActualCompleted?.pendingOrderCount ?? 0,
              realActualCompleted?.recentUninitiatedOrderCount ?? 0,
            ),
          },
          { label: "剩余总量", value: formatCount(realActualCompleted?.remainingOrderCount ?? 0) },
          {
            label: "总剩余量",
            value: renderTotalPendingMetricValue(
              realActualCompleted?.totalPendingCount ?? ((realActualCompleted?.pendingCount ?? 0) + (realActualCompleted?.yesterdayPendingCount ?? 0)),
              realActualCompleted?.yesterdayPendingCount ?? 0,
            ),
          },
          { label: "今日新增总单量", value: formatCount(realActualCompleted?.totalOrderCount ?? 0) },
          { label: "今日新增总量", value: formatCount(realActualCompleted?.totalCount ?? 0) },
          { label: "完成单量", value: formatCount(realActualCompleted?.completedOrderCount ?? 0) },
          {
            label: "今日分配延迟已检测",
            value: renderDelayDetectionMetricValue(
              getFinishAssignmentDetectedCount(realDelayAssignmentCount),
              getFinishAssignmentDetectionRate(realDelayAssignmentCount),
            ),
          },
          {
            label: "今日用户延迟检测数量",
            value: renderDelayDetectionMetricValue(
              getDelayAssignmentDetectedCount(realDelayAssignmentCount),
              getDelayAssignmentDetectionRate(realDelayAssignmentCount),
            ),
          },
        ],
        detailRows: realActualDetailRows,
        compact: true,
        expanded: true,
      };
    }
    case "lowPriceActualCompleted": {
      const completedByCategory = new Map(
        (lowPriceActualCompleted?.categoryList ?? []).map((item) => [item.shopCategoryId, item.count]),
      );
      const actualDetailRows = detailRows.map((item) => ({
        ...item,
        actualCompleted: completedByCategory.get(item.id) ?? 0,
      }));
      return {
        title: DASHBOARD_TITLES[cardId],
        scopeLabel: "低价",
        unitLabel: "低价实际完成量",
        icon: <AppstoreOutlined style={{ fontSize: 22 }} />,
        accent: "#16a34a",
        background: "linear-gradient(135deg, rgba(22,163,74,0.1), rgba(255,255,255,0))",
        value: <AnimatedNumber value={lowPriceActualCompleted?.count ?? 0} format={formatCount} />,
        comparison: buildDashboardComparison(
          lowPriceActualCompleted?.yesterdayCount ?? 0,
          lowPriceActualCompleted?.countChange ?? 0,
          lowPriceActualCompleted?.countChangeRate ?? 0,
          formatCount,
        ),
        detailMetrics: [
          {
            label: "未开始",
            value: renderUninitiatedOrderMetricValue(
              lowPriceActualCompleted?.pendingOrderCount ?? 0,
              lowPriceActualCompleted?.recentUninitiatedOrderCount ?? 0,
            ),
          },
          { label: "剩余总量", value: formatCount(lowPriceActualCompleted?.remainingOrderCount ?? 0) },
          {
            label: "总剩余量",
            value: renderTotalPendingMetricValue(
              lowPriceActualCompleted?.totalPendingCount ?? ((lowPriceActualCompleted?.pendingCount ?? 0) + (lowPriceActualCompleted?.yesterdayPendingCount ?? 0)),
              lowPriceActualCompleted?.yesterdayPendingCount ?? 0,
            ),
          },
          { label: "今日新增总单量", value: formatCount(lowPriceActualCompleted?.totalOrderCount ?? 0) },
          { label: "今日新增总量", value: formatCount(lowPriceActualCompleted?.totalCount ?? 0) },
          { label: "完成单量", value: formatCount(lowPriceActualCompleted?.completedOrderCount ?? 0) },
          {
            label: "今日分配延迟已检测",
            value: renderDelayDetectionMetricValue(
              getFinishAssignmentDetectedCount(lowPriceDelayAssignmentCount),
              getFinishAssignmentDetectionRate(lowPriceDelayAssignmentCount),
            ),
          },
          {
            label: "今日用户延迟检测数量",
            value: renderDelayDetectionMetricValue(
              getDelayAssignmentDetectedCount(lowPriceDelayAssignmentCount),
              getDelayAssignmentDetectionRate(lowPriceDelayAssignmentCount),
            ),
          },
        ],
        detailRows: actualDetailRows,
        compact: true,
        expanded: true,
      };
    }
    case "averageSpeed":
      return {
        title: DASHBOARD_TITLES[cardId],
        scopeLabel: "速度概览",
        unitLabel: "48 小时平均速度",
        icon: <ClockCircleOutlined style={{ fontSize: 22 }} />,
        accent: "#0f766e",
        background: "linear-gradient(135deg, rgba(15,118,110,0.1), rgba(255,255,255,0))",
        value: (
          <div style={{ display: "grid", gap: 2 }}>
            <div>
              人工 <AnimatedNumber value={manualSpeedPerSecond} format={formatRate} /> /秒
            </div>
            <div style={{ color: "var(--manager-text-soft)", fontSize: 18 }}>
              实际 <AnimatedNumber value={actualSpeedPerSecond} format={formatRate} /> /秒
            </div>
          </div>
        ),
        detailMetrics: [
          {
            label: "人工速度",
            value: `${formatRate(speedPerMinute(manualSpeedPerSecond))} /分`,
          },
          {
            label: "实际速度",
            value: `${formatRate(speedPerMinute(actualSpeedPerSecond))} /分`,
          },
        ],
        detailRows,
        disableDetail: true,
      };
    default:
      return {
        title: DASHBOARD_TITLES.todayConsume,
        scopeLabel,
        unitLabel: "消费金额",
        icon: <PayCircleOutlined style={{ fontSize: 22 }} />,
        accent: "#dc2626",
        background: "linear-gradient(135deg, rgba(220,38,38,0.08), rgba(255,255,255,0))",
        value: formatCurrency(currencyTotal),
        detailMetrics: [],
        detailRows,
      };
  }
}

function buildDetailColumns(cardId: DashboardCardId | null): ColumnsType<DerivedCategoryDetail> {
  if (cardId === "productCount") {
    return [
      {
        title: "人工用户",
        dataIndex: "productName",
        width: 220,
        render: (value: string) => <span className="manager-value">{value || "-"}</span>,
      },
      {
        title: "渠道",
        dataIndex: "categoryName",
        width: 90,
        sorter: (left, right) => String(left.categoryName ?? "").localeCompare(
          String(right.categoryName ?? ""),
          "zh-CN",
        ),
        sortDirections: ["ascend", "descend"],
        render: (value: string) => value || "-",
      },
      {
        title: "实时上号数量",
        dataIndex: "userCoverage",
        width: 120,
        sorter: (left, right) => left.userCoverage - right.userCoverage,
        sortDirections: ["ascend", "descend"],
        render: (value: number) => formatCount(value),
      },
    ];
  }
  if (isUpstreamUserMetric(cardId)) {
    return buildUpstreamUserDetailColumns(cardId);
  }
  if (cardId === "taskRemaining") {
    return buildTaskRemainingDetailColumns();
  }
  if (cardId === "pendingDetection") {
    return [
      {
        title: "商品分组",
        dataIndex: "productName",
        width: 260,
        render: (value: string, record) => (
          <div>
            <div className="manager-value">{value || `商品分组 #${record.id}`}</div>
            {record.categoryName ? (
              <div style={{ color: "var(--manager-text-soft)", marginTop: 4 }}>{record.categoryName}</div>
            ) : null}
          </div>
        ),
      },
      {
        title: "分配延迟待检测数量",
        dataIndex: "finishAssignmentPendingDetectionCount",
        width: 160,
        sorter: (left, right) => left.finishAssignmentPendingDetectionCount - right.finishAssignmentPendingDetectionCount,
        sortDirections: ["ascend", "descend"],
        render: (value: number) => <span className="manager-value">{formatCount(value)}</span>,
      },
      {
        title: "用户延迟待检测数量",
        dataIndex: "delayAssignmentPendingDetectionCount",
        width: 160,
        sorter: (left, right) => left.delayAssignmentPendingDetectionCount - right.delayAssignmentPendingDetectionCount,
        sortDirections: ["ascend", "descend"],
        render: (value: number) => <span className="manager-value">{formatCount(value)}</span>,
      },
    ];
  }
  if (isManualProductMetric(cardId)) {
    return buildManualProductDetailColumns();
  }
  if (isUpstreamCategoryMetric(cardId)) {
    return buildUpstreamCategoryDetailColumns();
  }
  const valueColumnTitle = getDetailValueTitle(cardId);
  return [
    {
      title: "商品 / 类目",
      key: "category",
      width: 200,
      render: (_, record) => (
        <div>
          <div style={{ color: "var(--manager-text)", fontWeight: 700 }}>{record.categoryName}</div>
          <div style={{ color: "var(--manager-text-soft)", marginTop: 4 }}>{record.productName}</div>
        </div>
      ),
    },
    {
      title: valueColumnTitle,
      key: "metricValue",
      width: 150,
      render: (_, record) => (
        <div className="manager-value" style={{ color: "var(--manager-text)" }}>
          {renderMetricValue(record, cardId)}
        </div>
      ),
    },
    {
      title: "状态",
      dataIndex: "status",
      width: 90,
      render: (value: string) => (
        <Tag color={value === "激活" ? "green" : "default"}>{value}</Tag>
      ),
    },
    {
      title: "价格",
      dataIndex: "price",
      width: 90,
      render: (value: number) => formatCurrency(value),
    },
    {
      title: "区间",
      key: "range",
      width: 110,
      render: (_, record) => `${record.lowerLimit} / ${record.upperLimit}`,
    },
    {
      title: "覆盖用户",
      dataIndex: "userCoverage",
      width: 100,
      render: (value: number) => formatCount(value),
    },
    {
      title: "完成率",
      dataIndex: "completionRate",
      width: 100,
      render: (value: number) => formatPercent(value),
    },
  ];
}

function buildTaskRemainingDetailColumns(): ColumnsType<DerivedCategoryDetail> {
  return [
    {
      title: "商品类目",
      dataIndex: "categoryName",
      width: 90,
      sorter: (left, right) => String(left.categoryName ?? "").localeCompare(String(right.categoryName ?? ""), "zh-CN"),
      sortDirections: ["ascend", "descend"],
      render: (value: string) => <span className="manager-value">{value || "-"}</span>,
    },
    {
      title: "剩余量",
      dataIndex: "taskRemaining",
      width: 130,
      defaultSortOrder: "descend",
      sorter: (left, right) => left.taskRemaining - right.taskRemaining,
      sortDirections: ["ascend", "descend"],
      render: (value: number) => <span className="manager-value">{formatCount(value)}</span>,
    },
  ];
}

function buildUpstreamUserDetailColumns(cardId: DashboardCardId | null): ColumnsType<DerivedCategoryDetail> {
  const amountColumns: ColumnsType<DerivedCategoryDetail> = [
    {
      title: "上游用户",
      key: "username",
      width: 170,
      render: (_, record) => <span className="manager-value">{record.productName || "-"}</span>,
    },
    {
      title: "备注",
      dataIndex: "categoryName",
      width: 160,
      render: (value: string) => value || "-",
    },
  ];
  if (cardId === "todayConsume") {
    return [
      ...amountColumns,
      { title: "消费", dataIndex: "todayConsume", render: (value: number) => formatCurrency(value) },
      { title: "退款", dataIndex: "todayRecharge", render: (value: number) => formatCurrency(value) },
      { title: "补款", dataIndex: "userCoverage", render: (value: number) => formatCurrency(value) },
    ];
  }
  if (cardId === "todayRecharge") {
    return [
      ...amountColumns,
      { title: "充值", dataIndex: "todayRecharge", render: (value: number) => formatCurrency(value) },
      { title: "赠送", dataIndex: "todayConsume", render: (value: number) => formatCurrency(value) },
    ];
  }
  return [
    ...amountColumns,
    { title: "账户余额", dataIndex: "todayRecharge", render: (value: number) => formatCurrency(value) },
  ];
}

// 人工商品 (manual product) submission breakdown — 总人工提交 / 真人人工提交 detail.
// Only the manual product is listed; the upstream product is intentionally omitted.
function buildManualProductDetailColumns(): ColumnsType<DerivedCategoryDetail> {
  return [
    {
      title: "人工商品",
      dataIndex: "categoryName",
      width: 220,
      render: (value: string) => (
        <span className="manager-value" style={{ color: "var(--manager-text)" }}>{value || "-"}</span>
      ),
    },
    {
      title: "提交量",
      key: "submitted",
      width: 140,
      render: (_, record) => (
        <span className="manager-value" style={{ color: "var(--manager-text)" }}>
          {formatCount(record.manualSubmitted)}
        </span>
      ),
    },
    {
      title: "状态",
      dataIndex: "status",
      width: 90,
      render: (value: string) => <Tag color={value === "激活" ? "green" : "default"}>{value}</Tag>,
    },
  ];
}

function buildBridgeDailyStatisticColumns(
  shopGroupLabelMap: Map<number, string>,
): ColumnsType<BridgeDailyStatisticDetail> {
  return [
    {
      title: "统计日期",
      dataIndex: "statDate",
      width: 110,
      defaultSortOrder: "descend",
      sorter: (left, right) => String(left.statDate).localeCompare(String(right.statDate)),
      render: (value: string) => <span className="manager-value">{value || "-"}</span>,
    },
    {
      title: "商品分组",
      dataIndex: "shopGroupIds",
      width: 210,
      render: (value: number[]) => formatShopGroupLabels(value, shopGroupLabelMap),
    },
    {
      title: "BridgeType",
      dataIndex: "bridgeType",
      width: 170,
      render: (value: string) => <span className="manager-value">{formatBridgeType(value)}</span>,
    },
    {
      title: "Bridge",
      key: "bridge",
      width: 170,
      render: (_, record) => (
        <div>
          <div className="manager-value">{record.bridgeName || record.bridgeCode || `Bridge#${record.bridgeId}`}</div>
          {record.bridgeCode && record.bridgeName ? (
            <div style={{ color: "var(--manager-text-soft)", marginTop: 3 }}>{record.bridgeCode}</div>
          ) : null}
        </div>
      ),
    },
    { title: "发送", dataIndex: "totalNum", width: 100, render: (value: number) => formatCount(value) },
    { title: "成功", dataIndex: "successNum", width: 100, render: (value: number) => formatCount(value) },
    { title: "失败", dataIndex: "failNum", width: 100, render: (value: number) => formatCount(value) },
    { title: "获取不到", dataIndex: "notGetDataNum", width: 110, render: (value: number) => formatCount(value) },
    { title: "视频删除", dataIndex: "deleteNum", width: 110, render: (value: number) => formatCount(value) },
    { title: "异常", dataIndex: "errorNum", width: 100, render: (value: number) => formatCount(value) },
    { title: "私密", dataIndex: "secretNum", width: 100, render: (value: number) => formatCount(value) },
    { title: "未授权", dataIndex: "unAuthorizeNum", width: 100, render: (value: number) => formatCount(value) },
  ];
}

function formatShopGroupLabel(shopGroup: BarryShopGroup) {
  const name = shopGroup.name || shopGroup.code || `商品分组 #${shopGroup.id}`;
  const codeSuffix = shopGroup.code && shopGroup.code !== name ? ` · ${shopGroup.code}` : "";
  return `${name}${codeSuffix}（商品分组 #${shopGroup.id}）`;
}

function formatShopGroupLabels(shopGroupIds: number[] | undefined, shopGroupLabelMap: Map<number, string>) {
  if (!shopGroupIds || shopGroupIds.length === 0) {
    return "-";
  }
  return shopGroupIds
    .map((shopGroupId) => shopGroupLabelMap.get(shopGroupId) || `商品分组 #${shopGroupId}`)
    .join("、");
}

function normalizeShopGroupIds(value: unknown): number[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return Array.from(
    new Set(
      value
        .map((item) => Number(item))
        .filter((item) => Number.isSafeInteger(item) && item > 0),
    ),
  ).sort((left, right) => left - right);
}

function resolveBridgeStatisticScopes(config?: DashboardCardConfig): BridgeStatisticScope[] {
  const configuredScopes = normalizeBridgeStatisticScopes(config?.bridgeStatisticScopes);
  if (configuredScopes.length > 0 && !isPreviousBridgeStatisticDefault(configuredScopes)) {
    return configuredScopes;
  }
  const legacyShopGroupIds = normalizeShopGroupIds(config?.shopGroupIds);
  if (legacyShopGroupIds.length === 0 || (legacyShopGroupIds.length === 1 && legacyShopGroupIds[0] === 1)) {
    return DEFAULT_BRIDGE_STATISTIC_SCOPES.map((scope) => ({ ...scope }));
  }
  return (legacyShopGroupIds.length > 0 ? legacyShopGroupIds : [1]).map((shopGroupId) => ({
    shopGroupId,
    bridgeType: DEFAULT_BRIDGE_TYPE,
  }));
}

function isPreviousBridgeStatisticDefault(scopes: BridgeStatisticScope[]) {
  return scopes.length === 1
    && scopes[0].shopGroupId === 1
    && scopes[0].bridgeType === "GET_ITEM";
}

function normalizeBridgeStatisticScopes(value: unknown): BridgeStatisticScope[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const scopes: BridgeStatisticScope[] = [];
  const scopeKeys = new Set<string>();
  for (const item of value) {
    if (!item || typeof item !== "object") {
      continue;
    }
    const scope = item as Partial<BridgeStatisticScope>;
    const shopGroupId = Number(scope.shopGroupId);
    const bridgeType = typeof scope.bridgeType === "string" ? scope.bridgeType.trim().toUpperCase() : "";
    if (!Number.isSafeInteger(shopGroupId) || shopGroupId <= 0 || !bridgeType) {
      continue;
    }
    const key = bridgeStatisticScopeKey({ shopGroupId, bridgeType });
    if (scopeKeys.has(key)) {
      continue;
    }
    scopeKeys.add(key);
    scopes.push({ shopGroupId, bridgeType });
  }
  return scopes;
}

function bridgeStatisticScopeKey(scope?: Partial<BridgeStatisticScope>) {
  const shopGroupId = Number(scope?.shopGroupId);
  const bridgeType = typeof scope?.bridgeType === "string" ? scope.bridgeType.trim().toUpperCase() : "";
  return `${Number.isSafeInteger(shopGroupId) && shopGroupId > 0 ? shopGroupId : 0}:${bridgeType}`;
}

function formatBridgeType(bridgeType: string | undefined) {
  return bridgeType?.trim() || "-";
}

function formatBridgeStatisticScope(scope: BridgeStatisticScope, shopGroupLabelMap: Map<number, string>) {
  return `${shopGroupLabelMap.get(scope.shopGroupId) || `商品分组 #${scope.shopGroupId}`} · BridgeType：${formatBridgeType(scope.bridgeType)}`;
}

// A dashboard can show several combinations. Limit its fan-out so adding more
// cards does not create an unbounded burst of requests against Barry/Phoenix.
async function fetchBridgeStatisticScopes(scopes: BridgeStatisticScope[]) {
  const statistics = new Array<BridgeDailyStatisticSummary | null>(scopes.length).fill(null);
  let nextScopeIndex = 0;
  const worker = async () => {
    while (nextScopeIndex < scopes.length) {
      const scopeIndex = nextScopeIndex;
      nextScopeIndex += 1;
      const scope = scopes[scopeIndex];
      try {
        statistics[scopeIndex] = await fetchWorkbenchBridgeDailyStatistics({
          shopGroupIds: String(scope.shopGroupId),
          bridgeType: scope.bridgeType,
        });
      } catch {
        // Keep the previous successful snapshot for this scope on a transient failure.
      }
    }
  };
  await Promise.all(
    Array.from(
      { length: Math.min(MAX_BRIDGE_STATISTIC_REQUEST_CONCURRENCY, scopes.length) },
      () => worker(),
    ),
  );
  return statistics;
}

// 上游商品类目 (upstream product category) completion breakdown — 实际完成总量 / 真人实际完成 detail.
// Only the product category is listed, per requirement.
function buildUpstreamCategoryDetailColumns(): ColumnsType<DerivedCategoryDetail> {
  return [
    {
      title: "商品类目",
      dataIndex: "categoryName",
      width: 220,
      render: (value: string) => (
        <span className="manager-value" style={{ color: "var(--manager-text)" }}>{value || "-"}</span>
      ),
    },
    {
      title: "实际完成",
      key: "completed",
      width: 140,
      render: (_, record) => (
        <span className="manager-value" style={{ color: "var(--manager-text)" }}>
          {formatCount(record.actualCompleted)}
        </span>
      ),
    },
    {
      title: "状态",
      dataIndex: "status",
      width: 90,
      render: (value: string) => <Tag color={value === "激活" ? "green" : "default"}>{value}</Tag>,
    },
  ];
}

function isUpstreamUserMetric(cardId: DashboardCardId | null): boolean {
  return cardId === "todayConsume" || cardId === "todayRecharge" || cardId === "systemBalance";
}

// Submission cards are viewed along the 人工商品 (manual product) dimension.
function isManualProductMetric(cardId: DashboardCardId | null): boolean {
  return cardId === "manualSubmitted" || cardId === "realManualSubmitted" || cardId === "lowPriceManualSubmitted";
}

// Completion cards are viewed along the 上游商品类目 (upstream product category) dimension.
function isUpstreamCategoryMetric(
  cardId: DashboardCardId | null,
): cardId is "actualCompleted" | "realActualCompleted" | "lowPriceActualCompleted" {
  return cardId === "actualCompleted" || cardId === "realActualCompleted" || cardId === "lowPriceActualCompleted";
}

function isDashboardMetricId(cardId: DashboardCardId): cardId is DashboardMetricId {
  return (DASHBOARD_METRIC_IDS as DashboardCardId[]).includes(cardId);
}

function getDetailListDescription(cardId: DashboardCardId | null) {
  if (cardId === "taskRemaining") {
    return "展示当前有剩余任务量的上游商品类目";
  }
  if (cardId === "productCount") {
    return "按人工用户查看当前统计时间窗口内的实时上号情况";
  }
  if (isUpstreamUserMetric(cardId)) {
    return "按上游用户账户查看当前指标明细";
  }
  if (isManualProductMetric(cardId)) {
    return "按人工商品查看提交情况";
  }
  if (isUpstreamCategoryMetric(cardId)) {
    return "按上游商品类目查看实际完成情况";
  }
  return "按商品类目查看当前 dashboard 的明细构成";
}

function getDetailListUnitLabel(cardId: DashboardCardId | null) {
  if (cardId === "taskRemaining") {
    return "上游商品类目";
  }
  if (cardId === "productCount") {
    return "人工用户";
  }
  if (isUpstreamUserMetric(cardId)) {
    return "账户";
  }
  if (isManualProductMetric(cardId)) {
    return "人工商品";
  }
  return "类目";
}

function getEditSelectorConfig(cardId: DashboardCardId | null) {
  if (cardId === "lowPriceManualSubmitted") {
    return {
      label: "低价提交人工商品",
      placeholder: "请选择仅用于低价提交量的人工商品",
      extra: "该配置仅用于低价提交量，不影响真人人工提交量。",
    };
  }
  if (cardId === "lowPriceActualCompleted") {
    return {
      label: "低价完成商品类目",
      placeholder: "请选择仅用于低价实际完成量的上游商品类目",
      extra: "该配置仅用于低价实际完成量，不影响真人实际完成量。",
    };
  }
  if (isManualProductMetric(cardId)) {
    return {
      label: "人工商品列表",
      placeholder: "请选择需要纳入统计的人工商品",
      extra: "不选择时默认统计全部人工商品",
    };
  }
  if (isUpstreamCategoryMetric(cardId)) {
    return {
      label: "上游商品类目",
      placeholder: "请选择需要纳入统计的上游商品类目",
      extra: "不选择时默认统计全部上游商品类目",
    };
  }
  return {
    label: "关联商品类目",
    placeholder: "请选择需要纳入 dashboard 统计的商品类目",
    extra: "不选择时默认使用全部商品类目",
  };
}

function getDetailValueTitle(cardId: DashboardCardId | null) {
  switch (cardId) {
    case "todayConsume":
      return "今日消费";
    case "todayRecharge":
      return "今日充值";
    case "systemBalance":
      return "余额贡献";
    case "taskRemaining":
      return "任务余量";
    case "pendingDetection":
      return "待检测数量";
    case "manualSubmitted":
      return "人工提交";
    case "actualCompleted":
      return "实际完成";
    case "realManualSubmitted":
      return "真人人工提交";
    case "realActualCompleted":
      return "真人实际完成";
    case "lowPriceManualSubmitted":
      return "低价提交";
    case "lowPriceActualCompleted":
      return "低价实际完成";
    case "averageSpeed":
      return "速度";
    default:
      return "数值";
  }
}

function renderMetricValue(record: DerivedCategoryDetail, cardId: DashboardCardId | null) {
  switch (cardId) {
    case "todayConsume":
      return formatCurrency(record.todayConsume);
    case "todayRecharge":
      return formatCurrency(record.todayRecharge);
    case "systemBalance":
      return formatCurrency(record.todayRecharge - record.todayConsume + record.userCoverage * 12.5);
    case "taskRemaining":
      return formatCount(record.taskRemaining);
    case "pendingDetection":
      return formatCount(record.pendingDetectionCount);
    case "manualSubmitted":
    case "realManualSubmitted":
    case "lowPriceManualSubmitted":
      return formatCount(record.manualSubmitted);
    case "actualCompleted":
    case "realActualCompleted":
    case "lowPriceActualCompleted":
      return formatCount(record.actualCompleted);
    case "averageSpeed":
      return (
        <div>
          <div>{`人工 ${formatRate(record.manualSpeedPerSecond)} /秒`}</div>
          <div style={{ marginTop: 4, color: "var(--manager-text-soft)" }}>
            {`实际 ${formatRate(record.actualSpeedPerSecond)} /秒`}
          </div>
        </div>
      );
    default:
      return "-";
  }
}

function resolveCategoryActive(status: string) {
  return status === "ACTIVE" || status === "active";
}

function resolveManualProductActive(status: string) {
  return status.trim().toUpperCase() !== "EXPIRE";
}

function resolveUserActive(user: UserRecord) {
  const status = (user.status || "").toLowerCase();
  return status === "active" || status === "normal";
}

function resolveBalance(user: UserRecord) {
  return Number(user.balanceAmount || 0);
}

function safeDivide(a: number, b: number) {
  if (b === 0) {
    return 0;
  }
  return a / b;
}

function clampBarryWindowSeconds(value?: number) {
  const normalized = Math.round(Number(value));
  if (!Number.isFinite(normalized)) {
    return 30;
  }
  return Math.min(Math.max(normalized, MIN_BARRY_WINDOW_SECONDS), MAX_BARRY_WINDOW_SECONDS);
}

function attachSpeedMetrics(
  details: DerivedCategoryDetail[],
  history: DashboardSpeedSnapshot[],
) {
  return details.map((item) => {
    const speedMetrics = resolveSpeedMetrics(history, [item.id]);
    return {
      ...item,
      manualSpeedPerSecond: speedMetrics.manualPerSecond,
      actualSpeedPerSecond: speedMetrics.actualPerSecond,
    };
  });
}

function appendSpeedSnapshot(history: DashboardSpeedSnapshot[], details: DerivedCategoryDetail[]) {
  const nextSnapshot: DashboardSpeedSnapshot = {
    timestamp: Date.now(),
    categories: details.map((item) => ({
      id: item.id,
      manualSubmitted: item.manualSubmitted,
      actualCompleted: item.actualCompleted,
    })),
  };

  const nextHistory = pruneSpeedHistory(history, nextSnapshot.timestamp);
  const lastSnapshot = nextHistory.at(-1);

  if (
    lastSnapshot &&
    nextSnapshot.timestamp - lastSnapshot.timestamp <= DASHBOARD_SPEED_REPLACE_THRESHOLD_MS
  ) {
    return [...nextHistory.slice(0, -1), nextSnapshot];
  }

  return [...nextHistory, nextSnapshot];
}

function pruneSpeedHistory(history: DashboardSpeedSnapshot[], now = Date.now()) {
  return history
    .filter((item) => typeof item.timestamp === "number" && now - item.timestamp <= DASHBOARD_SPEED_WINDOW_MS)
    .map((item) => ({
      timestamp: item.timestamp,
      categories: Array.isArray(item.categories)
        ? item.categories
            .filter((entry) => typeof entry?.id === "number")
            .map((entry) => ({
              id: entry.id,
              manualSubmitted: Number(entry.manualSubmitted || 0),
              actualCompleted: Number(entry.actualCompleted || 0),
            }))
        : [],
    }))
    .sort((a, b) => a.timestamp - b.timestamp);
}

function resolveSpeedMetrics(history: DashboardSpeedSnapshot[], categoryIds: number[]) {
  const normalizedHistory = pruneSpeedHistory(history);
  if (normalizedHistory.length < 2) {
    return {
      manualPerSecond: 0,
      actualPerSecond: 0,
    };
  }

  const targetIds = categoryIds.length > 0 ? new Set(categoryIds) : null;
  const firstSnapshot = normalizedHistory[0];
  const lastSnapshot = normalizedHistory[normalizedHistory.length - 1];
  const elapsedSeconds = Math.max((lastSnapshot.timestamp - firstSnapshot.timestamp) / 1000, 1);

  const firstTotals = sumSnapshotMetrics(firstSnapshot, targetIds);
  const lastTotals = sumSnapshotMetrics(lastSnapshot, targetIds);

  return {
    manualPerSecond: safeDivide(Math.max(lastTotals.manualSubmitted - firstTotals.manualSubmitted, 0), elapsedSeconds),
    actualPerSecond: safeDivide(Math.max(lastTotals.actualCompleted - firstTotals.actualCompleted, 0), elapsedSeconds),
  };
}

// Turn the cumulative snapshot history into a per-minute instantaneous speed series
// (每秒速度) for the 速度概览 chart, limited to the most recent day.
function buildSpeedSeries(history: DashboardSpeedSnapshot[], now = Date.now()): SpeedSeriesPoint[] {
  const normalizedHistory = pruneSpeedHistory(history, now);
  const points: SpeedSeriesPoint[] = [];

  for (let index = 1; index < normalizedHistory.length; index += 1) {
    const previous = normalizedHistory[index - 1];
    const current = normalizedHistory[index];
    const elapsedSeconds = Math.max((current.timestamp - previous.timestamp) / 1000, 1);
    const previousTotals = sumSnapshotMetrics(previous, null);
    const currentTotals = sumSnapshotMetrics(current, null);

    points.push({
      timestamp: current.timestamp,
      manualPerSecond: safeDivide(
        Math.max(currentTotals.manualSubmitted - previousTotals.manualSubmitted, 0),
        elapsedSeconds,
      ),
      actualPerSecond: safeDivide(
        Math.max(currentTotals.actualCompleted - previousTotals.actualCompleted, 0),
        elapsedSeconds,
      ),
    });
  }

  return points.filter((point) => now - point.timestamp <= DASHBOARD_SPEED_CHART_WINDOW_MS);
}

function sumSnapshotMetrics(snapshot: DashboardSpeedSnapshot, targetIds: Set<number> | null) {
  return snapshot.categories.reduce(
    (accumulator, item) => {
      if (targetIds && !targetIds.has(item.id)) {
        return accumulator;
      }

      accumulator.manualSubmitted += Number(item.manualSubmitted || 0);
      accumulator.actualCompleted += Number(item.actualCompleted || 0);
      return accumulator;
    },
    { manualSubmitted: 0, actualCompleted: 0 },
  );
}

function formatCategoryScopeLabel(categoryIds: number[], totalCategories: number, label = "商品类目") {
  const count = categoryIds.length === 0 ? totalCategories : categoryIds.length;
  return `${label} · ${formatCount(count)} 个`;
}

function formatShopGroupScopeLabel(shopGroupIds: number[], totalGroups: number) {
  const count = shopGroupIds.length === 0 ? totalGroups : shopGroupIds.length;
  return `商品分组 · ${formatCount(count)} 个`;
}

function roundToCurrency(value: number) {
  return Math.round(value * 100) / 100;
}

function formatCurrency(value: number) {
  return currencyFormatter.format(value || 0);
}

function formatCount(value: number) {
  return integerFormatter.format(Math.round(value || 0));
}

function formatRate(value: number) {
  return rateFormatter.format(value || 0);
}

function formatDelayDetectionRate(value: number | undefined) {
  return value === undefined ? "-" : `${formatRate(value)} 条/分`;
}

function getFinishAssignmentPendingDetectionCount(
  value: {
    total?: number;
    pendingDetectionCount?: number;
    finishAssignmentPendingDetectionCount?: number;
  } | null | undefined,
) {
  return value?.finishAssignmentPendingDetectionCount ?? value?.pendingDetectionCount ?? value?.total ?? 0;
}

function getDelayAssignmentPendingDetectionCount(
  value: { delayAssignmentPendingDetectionCount?: number } | null | undefined,
) {
  return value?.delayAssignmentPendingDetectionCount ?? 0;
}

function getFinishAssignmentDetectedCount(value: DelayAssignmentCountSummary | null) {
  return value?.finishAssignmentConsumedCount ?? value?.consumedCount ?? 0;
}

function getFinishAssignmentDetectionRate(value: DelayAssignmentCountSummary | null) {
  return value?.finishAssignmentConsumePerMinute ?? value?.consumePerMinute;
}

function getDelayAssignmentDetectedCount(value: DelayAssignmentCountSummary | null) {
  return value?.delayAssignmentConsumedCount ?? 0;
}

function getDelayAssignmentDetectionRate(value: DelayAssignmentCountSummary | null) {
  return value?.delayAssignmentConsumePerMinute;
}

function formatPercent(value: number) {
  return `${(value * 100).toFixed(1)}%`;
}

function speedPerMinute(value: number) {
  return value * 60;
}

function averageSpeedPerMinute(value: number) {
  return speedPerMinute(value);
}
