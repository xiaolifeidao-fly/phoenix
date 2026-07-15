"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AppstoreOutlined,
  ClockCircleOutlined,
  EditOutlined,
  FundOutlined,
  PayCircleOutlined,
  ShopOutlined,
  TeamOutlined,
  WalletOutlined,
} from "@ant-design/icons";
import {
  Button,
  Drawer,
  Empty,
  Form,
  Select,
  Space,
  Spin,
  Switch,
  Table,
  Tag,
  Tooltip,
  Typography,
  message,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import type { ReactNode } from "react";
import { AnimatedNumber } from "./AnimatedNumber";
import { SpeedTrendChart, type SpeedSeriesPoint } from "./SpeedTrendChart";
import {
  fetchProductCategories,
  fetchProducts,
  type ShopCategoryRecord,
  type ShopRecord,
} from "../../product/api/product.api";
import { fetchManualProducts, type ManualProductRecord } from "../../manual/api/product.api";
import { fetchUserStats, fetchUsers, UserStats, type UserRecord } from "../../user/api/user.api";
import {
  fetchActualCompleted,
  fetchSystemBalance,
  fetchTodayConsume,
  fetchTodayRecharge,
  fetchWorkbenchDashboardStatisticsWithComparison,
  fetchWorkbenchUserOverview,
  type DashboardStatistics,
  type WorkbenchDashboardStatistics,
  type WorkbenchUserOverview,
} from "../api/workbench-dashboard.api";

const { Paragraph, Text } = Typography;

type DashboardCardId =
  | "productCount"
  | "todayConsume"
  | "todayRecharge"
  | "systemBalance"
  | "taskRemaining"
  | "manualSubmitted"
  | "actualCompleted"
  | "realManualSubmitted"
  | "realActualCompleted"
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
    value: string;
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
const DASHBOARD_CONFIG_VERSION = 3;
const DASHBOARD_SPEED_STORAGE_KEY = "phoenix_manager_dashboard_speed_history_v1";
const DASHBOARD_DATA_CACHE_KEY = "phoenix_manager_dashboard_data_cache_v1";
const DASHBOARD_SPEED_WINDOW_MS = 48 * 60 * 60 * 1000;
// 速度概览 chart keeps the most recent day of samples, one point per minute.
const DASHBOARD_SPEED_CHART_WINDOW_MS = 24 * 60 * 60 * 1000;
const DASHBOARD_SPEED_REPLACE_THRESHOLD_MS = 60 * 1000;
const DASHBOARD_REFRESH_INTERVAL_MS = 10 * 1000;

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
const DASHBOARD_LEFT_CARD_ID: DashboardCardId = "realActualCompleted";
const DASHBOARD_LAYOUT: DashboardCardId[][] = [
  ["productCount", "todayConsume", "todayRecharge", "systemBalance"],
  ["taskRemaining", "manualSubmitted", "actualCompleted", "realManualSubmitted"],
];

const DASHBOARD_TITLES: Record<DashboardCardId, string> = {
  productCount: "上号情况",
  todayConsume: "今日消费",
  todayRecharge: "今日充值",
  systemBalance: "系统余额",
  taskRemaining: "总任务余量",
  manualSubmitted: "总人工提交数量",
  actualCompleted: "实际完成总量",
  realManualSubmitted: "真人人工提交总量",
  realActualCompleted: "真人实际完成总量",
  averageSpeed: "平均速度",
};

const DASHBOARD_DEFAULT_CONFIG: Record<DashboardCardId, DashboardCardConfig> = {
  productCount: { visible: true, categoryIds: [] },
  todayConsume: { visible: true, categoryIds: [] },
  todayRecharge: { visible: true, categoryIds: [] },
  systemBalance: { visible: true, categoryIds: [] },
  taskRemaining: { visible: true, categoryIds: [] },
  manualSubmitted: { visible: true, categoryIds: [] },
  actualCompleted: { visible: true, categoryIds: [] },
  realManualSubmitted: { visible: true, categoryIds: [2, 18] },
  realActualCompleted: { visible: true, categoryIds: [7, 12] },
  averageSpeed: { visible: true, categoryIds: [] },
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
  const [messageApi, contextHolder] = message.useMessage();
  const [form] = Form.useForm<DashboardCardConfig>();
  const [products, setProducts] = useState<ShopRecord[]>([]);
  const [categories, setCategories] = useState<ShopCategoryRecord[]>([]);
  const [manualProducts, setManualProducts] = useState<ManualProductRecord[]>([]);
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [userStats, setUserStats] = useState<UserStats>(new UserStats());
  const [workbenchStatistics, setWorkbenchStatistics] = useState<WorkbenchDashboardStatistics | null>(null);
  const [realManualSubmittedStatistics, setRealManualSubmittedStatistics] = useState<WorkbenchDashboardStatistics | null>(null);
  const [workbenchUserOverview, setWorkbenchUserOverview] = useState<WorkbenchUserOverview | null>(null);
  const [dashboardStatistics, setDashboardStatistics] = useState<DashboardStatistics | null>(null);
  const [dashboardMetricLoading, setDashboardMetricLoading] = useState<Partial<Record<DashboardMetricId, boolean>>>({});
  const [configMap, setConfigMap] =
    useState<Record<DashboardCardId, DashboardCardConfig>>(DASHBOARD_DEFAULT_CONFIG);
  const [speedHistory, setSpeedHistory] = useState<DashboardSpeedSnapshot[]>([]);
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [skipInitialFetch, setSkipInitialFetch] = useState(false);
  const [detailCardId, setDetailCardId] = useState<DashboardCardId | null>(null);
  const [editingCardId, setEditingCardId] = useState<DashboardCardId | null>(null);

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

  // Each dashboard metric loads on its own request and updates just its
  // slice of state, so a slow endpoint never holds up the other cards.
  const loadDashboardMetric = useCallback(
    (metricId: DashboardMetricId) => {
      setDashboardMetricLoading((current) => ({ ...current, [metricId]: true }));
      DASHBOARD_METRIC_FETCHERS[metricId]()
        .then((value) => {
          setDashboardStatistics((current) => {
            const next = { ...(current ?? {}), [metricId]: value } as DashboardStatistics;
            mergeDashboardCache({ dashboardStatistics: next });
            return next;
          });
        })
        .catch(() => {
          messageApi.warning(`${DASHBOARD_TITLES[metricId]}加载失败`);
        })
        .finally(() => {
          setDashboardMetricLoading((current) => ({ ...current, [metricId]: false }));
        });
    },
    [messageApi],
  );

  const loadDashboardData = useCallback(
    async (silent = false) => {
      if (!silent) {
        setLoading(true);
      }

      // Fire the four dashboard metrics independently — not awaited together.
      DASHBOARD_METRIC_IDS.forEach((metricId) => loadDashboardMetric(metricId));

      const [categoryResult, productResult, manualProductResult, userResult, statsResult, workbenchResult, workbenchUserResult] = await Promise.allSettled([
        fetchProductCategories({ pageIndex: 1, pageSize: 200 }),
        fetchProducts({ pageIndex: 1, pageSize: 200 }),
        fetchManualProducts(),
        fetchUsers({ pageIndex: 1, pageSize: 200 }),
        fetchUserStats(),
        fetchWorkbenchDashboardStatisticsWithComparison(),
        fetchWorkbenchUserOverview(),
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

      setWorkbenchUserOverview(workbenchUserResult.status === "fulfilled" ? workbenchUserResult.value : null);

      // Merge (not overwrite) so the independently-loaded dashboard metrics already
      // written into the cache are preserved.
      mergeDashboardCache({
        categories: categoryResult.status === "fulfilled" ? categoryResult.value.data : [],
        products: productResult.status === "fulfilled" ? productResult.value.data : [],
        manualProducts: manualProductResult.status === "fulfilled" ? manualProductResult.value : [],
        users: userResult.status === "fulfilled" ? userResult.value.data : [],
        userStats: statsResult.status === "fulfilled" ? statsResult.value : new UserStats(),
        workbenchStatistics: workbenchResult.status === "fulfilled" ? workbenchResult.value : undefined,
        workbenchUserOverview: workbenchUserResult.status === "fulfilled" ? workbenchUserResult.value : undefined,
      });

      if (
        categoryResult.status === "rejected" ||
        productResult.status === "rejected" ||
        manualProductResult.status === "rejected" ||
        userResult.status === "rejected" ||
        statsResult.status === "rejected" ||
        workbenchResult.status === "rejected" ||
        workbenchUserResult.status === "rejected"
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

  const realActualCategoryIds = configMap.realActualCompleted?.categoryIds ?? [];
  const realActualCategoryIdsKey = realActualCategoryIds.join(",");

  useEffect(() => {
    if (!ready) {
      return;
    }

    void fetchActualCompleted(
      realActualCategoryIds.length > 0 ? { shopCategoryIds: realActualCategoryIdsKey } : undefined,
    )
      .then((value) => {
        setDashboardStatistics((current) => ({ ...(current ?? {}), realActualCompleted: value }));
      })
      .catch(() => {
        messageApi.warning("真人实际完成加载失败");
      });
  }, [messageApi, ready, realActualCategoryIds.length, realActualCategoryIdsKey]);

  const realManualCategoryIds = configMap.realManualSubmitted?.categoryIds ?? [];
  const realManualCategoryIdsKey = realManualCategoryIds.join(",");

  useEffect(() => {
    if (!ready) {
      return;
    }

    void fetchWorkbenchDashboardStatisticsWithComparison(
      realManualCategoryIds.length > 0 ? { shopCategoryIds: realManualCategoryIdsKey } : undefined,
    )
      .then(setRealManualSubmittedStatistics)
      .catch(() => {
        messageApi.warning("真人人工提交加载失败");
      });
  }, [messageApi, ready, realManualCategoryIds.length, realManualCategoryIdsKey]);

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

  // 速度概览 chart data: per-minute instantaneous speed derived from the cached
  // snapshot history, plus the current aggregate speed for the headline stat tiles.
  const speedSeries = useMemo(() => buildSpeedSeries(speedHistory), [speedHistory]);
  const currentManualSpeedPerSecond = useMemo(
    () => categoryDetailsWithSpeed.reduce((sum, item) => sum + item.manualSpeedPerSecond, 0),
    [categoryDetailsWithSpeed],
  );
  const currentActualSpeedPerSecond = useMemo(
    () => categoryDetailsWithSpeed.reduce((sum, item) => sum + item.actualSpeedPerSecond, 0),
    [categoryDetailsWithSpeed],
  );

  const cardViews = useMemo(
    () =>
      Object.fromEntries(
        (Object.keys(DASHBOARD_TITLES) as DashboardCardId[]).map((cardId) => {
          const config = configMap[cardId] ?? DASHBOARD_DEFAULT_CONFIG[cardId];
          const isManualProduct = isManualProductMetric(cardId);
          const scopedDetails = resolveScopedDetails(
            isManualProduct ? derivedManualProductDetails : categoryDetailsWithSpeed,
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
            workbenchUserOverview,
            dashboardStatistics,
            formatCategoryScopeLabel(
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
    [categories.length, categoryDetailsWithSpeed, configMap, dashboardMetricLoading, dashboardStatistics, derivedManualProductDetails, manualProducts.length, products, realManualSubmittedStatistics, users, userStats, workbenchStatistics, workbenchUserOverview],
  );

  const visibleCardCount = useMemo(
    () =>
      (Object.keys(configMap) as DashboardCardId[]).filter((cardId) => configMap[cardId]?.visible)
        .length,
    [configMap],
  );

  const hiddenCardIds = useMemo(
    () =>
      (Object.keys(configMap) as DashboardCardId[]).filter((cardId) => !configMap[cardId]?.visible),
    [configMap],
  );
  const leftCardVisible = configMap[DASHBOARD_LEFT_CARD_ID]?.visible;
  const visibleRightCardIds = useMemo(
    () => DASHBOARD_LAYOUT.flat().filter((cardId) => configMap[cardId]?.visible),
    [configMap],
  );

  const openEditModal = (cardId: DashboardCardId) => {
    const nextConfig = configMap[cardId] ?? DASHBOARD_DEFAULT_CONFIG[cardId];
    setEditingCardId(cardId);
    form.setFieldsValue({
      visible: nextConfig.visible,
      categoryIds: nextConfig.categoryIds,
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
        visible: Boolean(values.visible),
        categoryIds: values.categoryIds ?? [],
      },
    }));
    setEditingCardId(null);
  };

  const detailCard = detailCardId ? cardViews[detailCardId] : null;
  return (
    <>
      {contextHolder}
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

            {leftCardVisible || visibleRightCardIds.length > 0 ? (
              <section
                className={`manager-stats-grid manager-dashboard-layout${leftCardVisible ? " manager-dashboard-layout--with-left-card" : ""}`}
                style={{ gridTemplateColumns: `repeat(${leftCardVisible ? 5 : Math.min(Math.max(visibleRightCardIds.length, 1), 4)}, minmax(0, 1fr))` }}
              >
                {leftCardVisible ? (
                  <div className="manager-dashboard-layout__left-card">
                    {renderDashboardCard({
                      cardId: DASHBOARD_LEFT_CARD_ID,
                      view: cardViews[DASHBOARD_LEFT_CARD_ID],
                      onEdit: openEditModal,
                      onOpenDetail: setDetailCardId,
                    })}
                  </div>
                ) : null}
                {visibleRightCardIds.map((cardId) =>
                  renderDashboardCard({
                    cardId,
                    view: cardViews[cardId],
                    onEdit: openEditModal,
                    onOpenDetail: setDetailCardId,
                  }),
                )}
              </section>
            ) : (
              <section className="manager-data-card">
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="dashboard 已全部隐藏，可使用恢复按钮重新展示" />
              </section>
            )}

            <SpeedTrendChart
              series={speedSeries}
              currentManualPerSecond={currentManualSpeedPerSecond}
              currentActualPerSecond={currentActualSpeedPerSecond}
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
                  {detailCard.detailMetrics.map((metric) => (
                    <div key={`${metric.label}-${metric.value}`} className="manager-dashboard-card__metric">
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
                scroll={{ x: 760 }}
                dataSource={detailCard.detailRows}
                columns={buildDetailColumns(detailCardId)}
              />
            </section>
          </div>
        ) : null}
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
          <Form.Item label="显示当前 dashboard" name="visible" valuePropName="checked">
            <Switch checkedChildren="显示" unCheckedChildren="隐藏" />
          </Form.Item>

          {editingCardId && !isUpstreamUserMetric(editingCardId) && editingCardId !== "actualCompleted" ? (
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
        visible: config?.visible ?? current[cardId].visible,
        categoryIds: Array.isArray(config?.categoryIds) ? config?.categoryIds : current[cardId].categoryIds,
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
    realManualSubmitted: cards.realManualSubmitted
      ? { ...cards.realManualSubmitted, categoryIds: [2, 18] }
      : undefined,
    realActualCompleted: cards.realActualCompleted
      ? { ...cards.realActualCompleted, categoryIds: [7, 12] }
      : undefined,
  };
}

function renderDashboardCard({
  cardId,
  view,
  onEdit,
  onOpenDetail,
  actions,
  featured = false,
}: {
  cardId: DashboardCardId;
  view: DashboardCardView;
  onEdit: (cardId: DashboardCardId) => void;
  onOpenDetail: (cardId: DashboardCardId) => void;
  actions?: ReactNode;
  featured?: boolean;
}) {
  const clickable = !view.disableDetail;
  const hasTopRow = Boolean(view.scopeLabel) || Boolean(actions) || view.editable !== false;

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
              {view.detailMetrics.map((metric) => (
                <div key={`${metric.label}-${metric.value}`} className="manager-dashboard-card__featured-metric">
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
            {view.detailMetrics.map((metric) => (
              <div key={`${metric.label}-${metric.value}`} className="manager-dashboard-card__metric">
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

function buildDashboardCardView(
  cardId: DashboardCardId,
  detailRows: DerivedCategoryDetail[],
  products: ShopRecord[],
  users: UserRecord[],
  userStats: UserStats,
  workbenchStatistics: WorkbenchDashboardStatistics | null,
  realManualSubmittedStatistics: WorkbenchDashboardStatistics | null,
  workbenchUserOverview: WorkbenchUserOverview | null,
  dashboardStatistics: DashboardStatistics | null,
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
    case "productCount":
      return {
        title: DASHBOARD_TITLES[cardId],
        scopeLabel: "",
        unitLabel: "用户与上号情况",
        icon: <TeamOutlined style={{ fontSize: 22 }} />,
        accent: "#2563eb",
        background: "linear-gradient(135deg, rgba(37,99,235,0.1), rgba(255,255,255,0))",
        value: null,
        detailMetrics: [
          {
            label: "用户个数",
            value: `${formatCount(workbenchUserOverview?.userCount ?? (userStats.visibleUsers || users.length))} 人`,
          },
          {
            label: "当天累计上号",
            value: `${formatCount(workbenchUserOverview?.accountCount ?? userStats.accountCount)} 个`,
          },
          {
            label: "实时用户在线",
            value: `${formatCount(workbenchUserOverview?.onlineUserCount ?? 0)} 人`,
          },
          {
            label: "实时上号数量",
            value: `${formatCount(workbenchUserOverview?.onlineAccountCount ?? 0)} 个`,
          },
        ],
        detailRows: [],
        editable: false,
        compact: true,
        disableDetail: true,
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
    case "taskRemaining":
      return {
        title: DASHBOARD_TITLES[cardId],
        scopeLabel,
        unitLabel: "剩余任务量",
        icon: <ShopOutlined style={{ fontSize: 22 }} />,
        accent: "#4f46e5",
        background: "linear-gradient(135deg, rgba(79,70,229,0.09), rgba(255,255,255,0))",
        value: <AnimatedNumber value={remainingTotal} format={formatCount} />,
        detailMetrics: [],
        detailRows,
        editable: false,
        compact: true,
      };
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
        editable: false,
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
        scopeLabel,
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
        scopeLabel,
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
          { label: "进行中单量", value: formatCount(realActualCompleted?.pendingOrderCount ?? 0) },
          { label: "进行中总量", value: formatCount(realActualCompleted?.pendingCount ?? 0) },
          { label: "总单量", value: formatCount(realActualCompleted?.totalOrderCount ?? 0) },
          { label: "总量", value: formatCount(realActualCompleted?.totalCount ?? 0) },
          { label: "完成单量", value: formatCount(realActualCompleted?.completedOrderCount ?? 0) },
          { label: "完成总量", value: formatCount(realActualCompleted?.count ?? 0) },
        ],
        detailRows: realActualDetailRows,
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
  if (isUpstreamUserMetric(cardId)) {
    return buildUpstreamUserDetailColumns(cardId);
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
  return cardId === "manualSubmitted" || cardId === "realManualSubmitted";
}

// Completion cards are viewed along the 上游商品类目 (upstream product category) dimension.
function isUpstreamCategoryMetric(cardId: DashboardCardId | null): boolean {
  return cardId === "actualCompleted" || cardId === "realActualCompleted";
}

function isDashboardMetricId(cardId: DashboardCardId): cardId is DashboardMetricId {
  return (DASHBOARD_METRIC_IDS as DashboardCardId[]).includes(cardId);
}

function getDetailListDescription(cardId: DashboardCardId | null) {
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
  if (isUpstreamUserMetric(cardId)) {
    return "账户";
  }
  if (isManualProductMetric(cardId)) {
    return "人工商品";
  }
  return "类目";
}

function getEditSelectorConfig(cardId: DashboardCardId | null) {
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
    case "manualSubmitted":
      return "人工提交";
    case "actualCompleted":
      return "实际完成";
    case "realManualSubmitted":
      return "真人人工提交";
    case "realActualCompleted":
      return "真人实际完成";
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
    case "manualSubmitted":
    case "realManualSubmitted":
      return formatCount(record.manualSubmitted);
    case "actualCompleted":
    case "realActualCompleted":
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

function formatPercent(value: number) {
  return `${(value * 100).toFixed(1)}%`;
}

function speedPerMinute(value: number) {
  return value * 60;
}

function averageSpeedPerMinute(value: number) {
  return speedPerMinute(value);
}
