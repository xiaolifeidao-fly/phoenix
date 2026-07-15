"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import dayjs, { type Dayjs } from "dayjs";
import localeData from "dayjs/plugin/localeData";
import weekday from "dayjs/plugin/weekday";
import { CheckCircleOutlined, ClockCircleOutlined, ReloadOutlined, SearchOutlined, TeamOutlined, WarningOutlined } from "@ant-design/icons";
import { Button, DatePicker, Empty, Select, Space, Table, Tag, Typography, message } from "antd";
import type { ColumnsType } from "antd/es/table";
import type { TablePaginationConfig } from "antd/es/table/interface";
import {
  fetchManualTaskStatisticUsers,
  fetchManualTaskStatistics,
  type ManualTaskStatisticsOverview,
  type ManualUserOption,
  type ShopCategoryTaskSummary,
  type UserTaskSummary,
} from "../../api/task-statistics.api";

const { Text, Title } = Typography;
const { RangePicker } = DatePicker;

dayjs.extend(weekday);
dayjs.extend(localeData);

const defaultDateRange: [Dayjs, Dayjs] = [dayjs().startOf("day"), dayjs().startOf("day")];

export function ManualTaskStatisticsPanel() {
  const [loading, setLoading] = useState(false);
  const [overview, setOverview] = useState<ManualTaskStatisticsOverview | null>(null);
  const [userOptions, setUserOptions] = useState<ManualUserOption[]>([]);
  const userOptionCacheRef = useRef(new Map<number, ManualUserOption>());
  const [filters, setFilters] = useState({ dateRange: defaultDateRange, shopCategoryIds: [] as number[], userId: undefined as number | undefined, page: 1, pageSize: 20 });

  const loadOverview = async (nextFilters = filters) => {
    setLoading(true);
    try {
      const [startDate, endDate] = nextFilters.dateRange;
      setOverview(
        await fetchManualTaskStatistics({
          startDate: startDate.format("YYYY-MM-DD"),
          endDate: endDate.format("YYYY-MM-DD"),
          shopCategoryIds: nextFilters.shopCategoryIds.length ? nextFilters.shopCategoryIds.join(",") : undefined,
          userId: nextFilters.userId,
          page: nextFilters.page,
          pageSize: nextFilters.pageSize,
        }),
      );
    } catch (error) {
      message.error(error instanceof Error ? error.message : "加载人工任务统计失败");
      setOverview(null);
    } finally {
      setLoading(false);
    }
  };

  const searchUsers = async (keyword?: string) => {
    const normalizedKeyword = keyword?.trim().toLowerCase() ?? "";
    const cachedOptions = Array.from(userOptionCacheRef.current.values()).filter((user) =>
      !normalizedKeyword || user.username.toLowerCase().includes(normalizedKeyword) || user.nickname?.toLowerCase().includes(normalizedKeyword),
    );
    if (cachedOptions.length > 0) {
      setUserOptions(cachedOptions);
      return;
    }
    try {
      const fetchedOptions = await fetchManualTaskStatisticUsers(keyword);
      fetchedOptions.forEach((user) => userOptionCacheRef.current.set(user.id, user));
      setUserOptions(fetchedOptions);
    } catch (error) {
      message.error(error instanceof Error ? error.message : "加载人工用户列表失败");
    }
  };

  useEffect(() => {
    void loadOverview();
    void searchUsers();
  }, []);

  const categoryOptions = useMemo(
    () => (overview?.shopCategoryOptions ?? []).map((item) => ({ value: item.id, label: item.code ? `${item.name} (${item.code})` : item.name })),
    [overview],
  );

  const selectedUser = filters.userId ? userOptionCacheRef.current.get(filters.userId) : undefined;
  const resolvedUserOptions = selectedUser && !userOptions.some((user) => user.id === selectedUser.id) ? [selectedUser, ...userOptions] : userOptions;

  const categoryColumns: ColumnsType<ShopCategoryTaskSummary> = [
    { title: "人工商品", dataIndex: "shopCategoryName", width: 180, render: (value) => <Text strong>{value || "-"}</Text> },
    { title: "处理用户", dataIndex: "distinctUserCount", width: 100, render: formatCount },
    { title: "上号数量", dataIndex: "distinctExtUserCount", width: 110, render: formatCount },
    { title: "总任务", dataIndex: "totalNum", width: 100, render: formatCount },
    { title: "处理中", dataIndex: "pendingNum", width: 100, render: (value) => <Tag color="processing">{formatCount(value)}</Tag> },
    { title: "待审核", dataIndex: "unCheckNum", width: 100, render: (value) => <Tag color="gold">{formatCount(value)}</Tag> },
    { title: "审核通过", dataIndex: "checkedNum", width: 110, render: (value) => <Tag color="success">{formatCount(value)}</Tag> },
    { title: "审核异常", dataIndex: "checkErrorNum", width: 110, render: (value) => <Tag color="error">{formatCount(value)}</Tag> },
    { title: "通过率", dataIndex: "approvalRate", width: 100, render: formatPercent },
  ];

  const userColumns: ColumnsType<UserTaskSummary> = [
    { title: "人工用户", dataIndex: "username", width: 160, render: (value) => <Text strong>{value || "-"}</Text> },
    { title: "人工商品", dataIndex: "shopCategoryName", width: 180 },
    { title: "上号数量", dataIndex: "upAccountNum", width: 110, render: formatCount },
    { title: "总任务", dataIndex: "totalNum", width: 100, render: formatCount },
    { title: "处理中", dataIndex: "pendingNum", width: 100, render: (value) => <Tag color="processing">{formatCount(value)}</Tag> },
    { title: "待审核", dataIndex: "unCheckNum", width: 100, render: (value) => <Tag color="gold">{formatCount(value)}</Tag> },
    { title: "审核通过", dataIndex: "checkedNum", width: 110, render: (value) => <Tag color="success">{formatCount(value)}</Tag> },
    { title: "审核异常", dataIndex: "checkErrorNum", width: 110, render: (value) => <Tag color="error">{formatCount(value)}</Tag> },
    { title: "通过率", dataIndex: "approvalRate", width: 100, render: formatPercent },
  ];

  const cards = [
    { label: "任务总量", value: overview?.totalNum, icon: <ClockCircleOutlined />, color: "#316DCA" },
    { label: "总上号数量", value: overview?.distinctUpAccountNum, icon: <TeamOutlined />, color: "#6E43C4" },
    { label: "待审核", value: overview?.unCheckNum, icon: <WarningOutlined />, color: "#B26A16" },
    { label: "审核通过", value: overview?.checkedNum, icon: <CheckCircleOutlined />, color: "#1E8A5A" },
    { label: "审核异常", value: overview?.checkErrorNum, icon: <WarningOutlined />, color: "#BA3C30" },
  ];

  return (
    <div className="manager-page-stack">
      <section className="manager-shell-card" style={{ borderRadius: 28, padding: 24 }}>
        <Space direction="vertical" size={18} style={{ width: "100%" }}>
          <div><div className="manager-section-label">筛选条件</div><Title level={4} style={{ margin: "10px 0 0" }}>定位人工任务处理情况</Title></div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14, alignItems: "end" }}>
            <div><Text type="secondary">日期范围</Text><RangePicker style={{ width: "100%", marginTop: 8 }} value={filters.dateRange} allowClear={false} onChange={(value) => setFilters((current) => ({ ...current, dateRange: value && value[0] && value[1] ? ([value[0].startOf("day"), value[1].startOf("day")] as unknown as [Dayjs, Dayjs]) : defaultDateRange }))} /></div>
            <div><Text type="secondary">人工商品</Text><Select mode="multiple" allowClear maxTagCount="responsive" placeholder="全部人工商品" style={{ width: "100%", marginTop: 8 }} options={categoryOptions} value={filters.shopCategoryIds} onChange={(value) => setFilters((current) => ({ ...current, shopCategoryIds: value }))} /></div>
            <div><Text type="secondary">人工用户</Text><Select allowClear showSearch filterOption={false} placeholder="输入用户名或昵称搜索" style={{ width: "100%", marginTop: 8 }} options={resolvedUserOptions.map((user) => ({ value: user.id, label: user.nickname ? `${user.username} (${user.nickname})` : user.username }))} value={filters.userId} onSearch={(value) => void searchUsers(value)} onChange={(value) => setFilters((current) => ({ ...current, userId: value }))} /></div>
            <Space><Button type="primary" icon={<SearchOutlined />} loading={loading} onClick={() => { const next = { ...filters, page: 1 }; setFilters(next); void loadOverview(next); }}>查询</Button><Button icon={<ReloadOutlined />} onClick={() => { const reset = { dateRange: defaultDateRange, shopCategoryIds: [] as number[], userId: undefined, page: 1, pageSize: 20 }; setFilters(reset); void loadOverview(reset); }}>重置</Button></Space>
          </div>
        </Space>
      </section>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 16 }}>
        {cards.map((card) => <article key={card.label} className="manager-data-card" style={{ borderRadius: 24, padding: 22 }}><Space direction="vertical" size={10}><span style={{ color: card.color, fontSize: 20 }}>{card.icon}</span><div className="manager-section-label">{card.label}</div><div className="manager-display-title" style={{ fontSize: 28 }}>{formatCount(card.value)}</div></Space></article>)}
      </div>

      <StatisticTable title="按人工商品汇总" description="与 Kakrolot 的商品分类任务统计口径一致" loading={loading} columns={categoryColumns} data={overview?.shopCategorySummaryList ?? []} rowKey={(record) => record.shopCategoryId} />
      <StatisticTable title="按人工用户与商品明细" description="展示每位人工用户在各人工商品下的任务处理结果" loading={loading} columns={userColumns} data={overview?.userSummaryList ?? []} rowKey={(record) => `${record.userId}-${record.shopCategoryId}`} pagination={{ current: overview?.userSummaryPage ?? filters.page, pageSize: overview?.userSummaryPageSize ?? filters.pageSize, total: overview?.userSummaryTotal ?? 0, showSizeChanger: true, showTotal: (total) => `共 ${total} 条`, onChange: (page, pageSize) => { const next = { ...filters, page, pageSize }; setFilters(next); void loadOverview(next); } }} />
    </div>
  );
}

function StatisticTable<T extends object>({ title, description, loading, columns, data, rowKey, pagination = false }: { title: string; description: string; loading: boolean; columns: ColumnsType<T>; data: T[]; rowKey: (record: T) => string | number; pagination?: false | TablePaginationConfig }) {
  return <section className="manager-shell-card" style={{ borderRadius: 28, padding: 24 }}><Space direction="vertical" size={18} style={{ width: "100%" }}><div><div className="manager-section-label">统计明细</div><Title level={4} style={{ margin: "10px 0 4px" }}>{title}</Title><Text type="secondary">{description}</Text></div><Table<T> rowKey={rowKey} loading={loading} columns={columns} dataSource={data} pagination={pagination} scroll={{ x: 1080 }} locale={{ emptyText: <Empty description="当前筛选条件下暂无任务数据" /> }} /></Space></section>;
}

function formatCount(value?: number) { return Number(value || 0).toLocaleString("zh-CN"); }
function formatPercent(value?: number) { return `${(Number(value || 0) * 100).toFixed(2)}%`; }
