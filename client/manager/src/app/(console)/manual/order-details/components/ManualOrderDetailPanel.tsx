"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import dayjs, { type Dayjs } from "dayjs";
import { EyeOutlined, ReloadOutlined, SearchOutlined, StopOutlined, ThunderboltOutlined } from "@ant-design/icons";
import { Alert, Button, Collapse, DatePicker, Descriptions, Empty, Input, InputNumber, Modal, Select, Space, Switch, Table, Tag, Tooltip, Typography } from "antd";
import type { TableProps } from "antd";
import type { ColumnsType } from "antd/es/table";
import type { TablePaginationConfig } from "antd/es/table/interface";
import { message } from "@/utils/notify";
import { dateRangePresets } from "@/utils/date-range-presets";
import { fetchManualTaskStatisticUsers, fetchManualTaskStatistics, type ManualShopCategoryOption, type ManualUserOption } from "../../api/task-statistics.api";
import {
  fetchManualOrderDetailSecUid,
  fetchManualOrderDetails,
  fetchManualOrderFetchMonitorUIDs,
  fetchUserAssignQueues,
  fetchUserTask,
  type ManualOrderDetail,
  type ManualOrderDetailPage,
  type ManualOrderFetchMonitor,
  type ManualUserFetchTask,
  type UserAssignQueue,
} from "../../api/order-details.api";

const { RangePicker } = DatePicker;
const { Text, Title } = Typography;
const defaultDateRange: [Dayjs, Dayjs] = [dayjs().startOf("day"), dayjs().startOf("day")];
const getOrderFetchMonitorKey = (userId: number, uid: string) => `${userId}:${uid}`;
const getAssignQueueGroupKey = (row: UserAssignQueue) => row.shopGroupCode || `group-${row.shopGroupId ?? 0}`;
const DEFAULT_ASSIGN_QUEUE_MONITOR_DURATION_SECONDS = 120;
const ASSIGN_QUEUE_MONITOR_REFRESH_INTERVAL_MS = 2_000;

interface AssignQueueGroup {
  groupKey: string;
  shopGroupId: number;
  shopGroupName: string;
  shopGroupCode: string;
  rows: UserAssignQueue[];
  normalNum: number;
  delayNum: number;
  totalNum: number;
}

export function ManualOrderDetailPanel() {
  const [loading, setLoading] = useState(false);
  const [details, setDetails] = useState<ManualOrderDetailPage | null>(null);
  const [approvalRateOrder, setApprovalRateOrder] = useState<"ascend" | "descend" | null>(null);
  const [userOptions, setUserOptions] = useState<ManualUserOption[]>([]);
  const [shopCategoryOptions, setShopCategoryOptions] = useState<ManualShopCategoryOption[]>([]);
  const [orderFetchMonitors, setOrderFetchMonitors] = useState<Map<string, ManualOrderFetchMonitor>>(new Map());
  const [assignQueueRecord, setAssignQueueRecord] = useState<ManualOrderDetail | null>(null);
  const [assignQueueLoading, setAssignQueueLoading] = useState(false);
  const [assignQueues, setAssignQueues] = useState<UserAssignQueue[]>([]);
  const [assignQueueMonitor, setAssignQueueMonitor] = useState<ManualOrderFetchMonitor | null>(null);
  const [fetchTaskResults, setFetchTaskResults] = useState<Map<string, ManualUserFetchTask>>(new Map());
  const [fetchingGroupKey, setFetchingGroupKey] = useState<string | null>(null);
  const [assignQueueMonitorDurationSeconds, setAssignQueueMonitorDurationSeconds] = useState(DEFAULT_ASSIGN_QUEUE_MONITOR_DURATION_SECONDS);
  const [assignQueueMonitoring, setAssignQueueMonitoring] = useState(false);
  const [assignQueueMonitorRemainingSeconds, setAssignQueueMonitorRemainingSeconds] = useState(0);
  const userOptionCacheRef = useRef(new Map<number, ManualUserOption>());
  const monitorRequestIdRef = useRef(0);
  const assignQueueMonitorTimerRef = useRef<number | null>(null);
  const assignQueueMonitorSessionRef = useRef(0);
  const assignQueueMonitorRequestInFlightRef = useRef(false);
  const [filters, setFilters] = useState({
    dateRange: defaultDateRange,
    userId: undefined as number | undefined,
    uid: "",
    shopCategoryIds: [] as number[],
    excludeWhitelistUsers: false,
    fansNumOrder: undefined as "ASC" | "DESC" | undefined,
    fansNumMin: undefined as number | undefined,
    fansNumMax: undefined as number | undefined,
    approvalRateMin: undefined as number | undefined,
    approvalRateMax: undefined as number | undefined,
    page: 1,
    pageSize: 20,
  });

  const loadDetails = async (nextFilters = filters) => {
    const monitorRequestId = ++monitorRequestIdRef.current;
    setLoading(true);
    try {
      const [startDate, endDate] = nextFilters.dateRange;
      const detailPage = await fetchManualOrderDetails({
        startDate: startDate.format("YYYY-MM-DD"),
        endDate: endDate.format("YYYY-MM-DD"),
        userId: nextFilters.userId,
        uid: nextFilters.uid.trim() || undefined,
        shopCategoryIds: nextFilters.shopCategoryIds.length ? nextFilters.shopCategoryIds.join(",") : undefined,
        excludeWhitelistUsers: nextFilters.excludeWhitelistUsers && nextFilters.shopCategoryIds.length > 0 ? true : undefined,
        fansNumOrder: nextFilters.fansNumOrder,
        fansNumMin: nextFilters.fansNumMin,
        fansNumMax: nextFilters.fansNumMax,
        approvalRateMin: nextFilters.approvalRateMin === undefined ? undefined : nextFilters.approvalRateMin / 100,
        approvalRateMax: nextFilters.approvalRateMax === undefined ? undefined : nextFilters.approvalRateMax / 100,
        page: nextFilters.page,
        pageSize: nextFilters.pageSize,
      });
      setDetails(detailPage);
      setOrderFetchMonitors(new Map());

      const monitorRecords = Array.from(new Map(
        detailPage.records
          .filter((record) => Boolean(record.uid))
          .map((record) => [getOrderFetchMonitorKey(record.userId, record.uid), record]),
      ).values());
      if (monitorRecords.length === 0) return;

      try {
        const monitors = await fetchManualOrderFetchMonitorUIDs({
          userIds: monitorRecords.map((record) => record.userId).join(","),
          uids: monitorRecords.map((record) => record.uid).join(","),
        });
        if (monitorRequestId !== monitorRequestIdRef.current) return;
        setOrderFetchMonitors(new Map(monitors.map((monitor) => [getOrderFetchMonitorKey(monitor.userId, monitor.uid), monitor])));
      } catch (error) {
        if (monitorRequestId === monitorRequestIdRef.current) {
          message.error(error instanceof Error ? error.message : "加载取单速度失败");
        }
      }
    } catch (error) {
      message.error(error instanceof Error ? error.message : "加载人工做单明细失败");
      setDetails(null);
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

  const loadShopCategories = async () => {
    try {
      const overview = await fetchManualTaskStatistics({ pageSize: 1 });
      setShopCategoryOptions(overview.shopCategoryOptions);
    } catch (error) {
      message.error(error instanceof Error ? error.message : "加载人工商品列表失败");
    }
  };

  useEffect(() => {
    void loadDetails();
    void searchUsers();
    void loadShopCategories();
    return () => {
      assignQueueMonitorSessionRef.current += 1;
      if (assignQueueMonitorTimerRef.current !== null) window.clearInterval(assignQueueMonitorTimerRef.current);
    };
  }, []);

  const selectedUser = filters.userId ? userOptionCacheRef.current.get(filters.userId) : undefined;
  const resolvedUserOptions = selectedUser && !userOptions.some((user) => user.id === selectedUser.id) ? [selectedUser, ...userOptions] : userOptions;
  const displayedRecords = useMemo(() => {
    const records = details?.records ?? [];
    if (!approvalRateOrder) return records;
    const direction = approvalRateOrder === "ascend" ? 1 : -1;
    return [...records].sort((left, right) => direction * (Number(left.approvalRate || 0) - Number(right.approvalRate || 0)));
  }, [details, approvalRateOrder]);
  const assignQueueTotals = useMemo(() => assignQueues.reduce(
    (totals, row) => ({
      normalNum: totals.normalNum + row.normalNum,
      delayNum: totals.delayNum + row.delayNum,
      totalNum: totals.totalNum + row.totalNum,
    }),
    { normalNum: 0, delayNum: 0, totalNum: 0 },
  ), [assignQueues]);
  const assignQueueGroups = useMemo<AssignQueueGroup[]>(() => {
    const groups = new Map<string, AssignQueueGroup>();
    assignQueues.forEach((row) => {
      const groupKey = getAssignQueueGroupKey(row);
      const group = groups.get(groupKey) ?? {
        groupKey,
        shopGroupId: row.shopGroupId,
        shopGroupName: row.shopGroupName || row.shopGroupCode || "未归组商品",
        shopGroupCode: row.shopGroupCode || "",
        rows: [],
        normalNum: 0,
        delayNum: 0,
        totalNum: 0,
      };
      group.rows.push(row);
      group.normalNum += row.normalNum;
      group.delayNum += row.delayNum;
      group.totalNum += row.totalNum;
      groups.set(groupKey, group);
    });
    return Array.from(groups.values()).sort((left, right) => right.totalNum - left.totalNum || left.shopGroupId - right.shopGroupId);
  }, [assignQueues]);

  const stopAssignQueueMonitoring = () => {
    assignQueueMonitorSessionRef.current += 1;
    if (assignQueueMonitorTimerRef.current !== null) {
      window.clearInterval(assignQueueMonitorTimerRef.current);
      assignQueueMonitorTimerRef.current = null;
    }
    assignQueueMonitorRequestInFlightRef.current = false;
    setAssignQueueMonitoring(false);
    setAssignQueueMonitorRemainingSeconds(0);
  };

  // 队列积压与取单速度一起刷新，保证弹窗顶部的速度指标与队列数量是同一时刻的快照。
  const loadAssignQueues = async (record: ManualOrderDetail) => {
    setAssignQueueLoading(true);
    try {
      const [queues, monitors] = await Promise.all([
        fetchUserAssignQueues(record.uid, record.userId),
        fetchManualOrderFetchMonitorUIDs({ userIds: String(record.userId), uids: record.uid }).catch((error) => {
          message.error(error instanceof Error ? error.message : "加载取单速度失败");
          return [] as ManualOrderFetchMonitor[];
        }),
      ]);
      setAssignQueues(queues);
      const monitor = monitors.find((item) => item.userId === record.userId && item.uid === record.uid) ?? monitors[0] ?? null;
      setAssignQueueMonitor(monitor);
      if (monitor) {
        setOrderFetchMonitors((current) => {
          const next = new Map(current);
          next.set(getOrderFetchMonitorKey(record.userId, record.uid), monitor);
          return next;
        });
      }
    } catch (error) {
      setAssignQueues([]);
      setAssignQueueMonitor(null);
      message.error(error instanceof Error ? error.message : "加载任务队列详情失败");
    } finally {
      setAssignQueueLoading(false);
    }
  };

  const openAssignQueueDetail = (record: ManualOrderDetail) => {
    stopAssignQueueMonitoring();
    setAssignQueueRecord(record);
    setAssignQueues([]);
    setAssignQueueMonitor(null);
    setFetchTaskResults(new Map());
    setAssignQueueMonitorDurationSeconds(DEFAULT_ASSIGN_QUEUE_MONITOR_DURATION_SECONDS);
    void loadAssignQueues(record);
  };

  const closeAssignQueueDetail = () => {
    stopAssignQueueMonitoring();
    setAssignQueueRecord(null);
    setAssignQueues([]);
    setAssignQueueMonitor(null);
    setFetchTaskResults(new Map());
  };

  const startAssignQueueMonitoring = () => {
    if (!assignQueueRecord) return;
    const durationSeconds = Math.floor(assignQueueMonitorDurationSeconds);
    if (durationSeconds < 2) {
      message.warning("监控时长不能少于 2 秒");
      return;
    }

    stopAssignQueueMonitoring();
    const session = assignQueueMonitorSessionRef.current + 1;
    assignQueueMonitorSessionRef.current = session;
    const record = assignQueueRecord;
    const endAt = Date.now() + durationSeconds * 1_000;

    setAssignQueueMonitoring(true);
    setAssignQueueMonitorRemainingSeconds(durationSeconds);

    const refresh = () => {
      if (session !== assignQueueMonitorSessionRef.current) return;
      const remainingSeconds = Math.ceil((endAt - Date.now()) / 1_000);
      if (remainingSeconds <= 0) {
        stopAssignQueueMonitoring();
        return;
      }
      setAssignQueueMonitorRemainingSeconds(remainingSeconds);
      if (assignQueueMonitorRequestInFlightRef.current) return;

      assignQueueMonitorRequestInFlightRef.current = true;
      void loadAssignQueues(record).finally(() => {
        if (session === assignQueueMonitorSessionRef.current) assignQueueMonitorRequestInFlightRef.current = false;
      });
    };

    refresh();
    assignQueueMonitorTimerRef.current = window.setInterval(refresh, ASSIGN_QUEUE_MONITOR_REFRESH_INTERVAL_MS);
  };

  // 代替该用户按商品分组取一次任务，取完立即刷新队列，保证队列数量是取单后的最新值。
  const handleFetchTask = async (record: ManualOrderDetail, group: AssignQueueGroup) => {
    if (!group.shopGroupCode) {
      message.warning("该商品分组没有配置 code，无法获取任务");
      return;
    }
    setFetchingGroupKey(group.groupKey);
    try {
      const task = await fetchUserTask({ userId: record.userId, uid: record.uid, code: group.shopGroupCode });
      setFetchTaskResults((current) => {
        const next = new Map(current);
        next.set(group.groupKey, task);
        return next;
      });
      if (task.fetched) {
        message.success(`「${group.shopGroupName}」取到任务 ${task.orderId ?? ""}`);
      } else {
        message.info(task.message || `「${group.shopGroupName}」当前没有取到任务`);
      }
    } catch (error) {
      message.error(error instanceof Error ? error.message : "获取任务失败");
    } finally {
      setFetchingGroupKey(null);
      await loadAssignQueues(record);
    }
  };

  const openDouyinProfile = async (record: ManualOrderDetail) => {
    const profileWindow = window.open("", "_blank");
    try {
      const secUid = await fetchManualOrderDetailSecUid(record.userId, record.uid);
      if (!secUid) {
        profileWindow?.close();
        message.warning("未找到该 UID 的抖音主页信息");
        return;
      }
      if (profileWindow) {
        profileWindow.opener = null;
        profileWindow.location.href = `https://www.douyin.com/user/${encodeURIComponent(secUid)}`;
      }
    } catch (error) {
      profileWindow?.close();
      message.error(error instanceof Error ? error.message : "获取抖音主页信息失败");
    }
  };

  const getMonitorMetric = (
    record: ManualOrderDetail,
    metric: "hitNum" | "missNum" | "hitSpeed" | "missSpeed" | "hitRate",
  ) => Number(orderFetchMonitors.get(getOrderFetchMonitorKey(record.userId, record.uid))?.[metric] ?? 0);

  const columns: ColumnsType<ManualOrderDetail> = [
    { title: "用户名", dataIndex: "username", width: 150, render: (value) => <Text strong>{value || "-"}</Text> },
    { title: "渠道", dataIndex: "channel", width: 130, render: (value) => value || "-" },
    {
      title: "UID",
      dataIndex: "uid",
      width: 190,
      render: (uid, record) => uid
        ? <a href="#" onClick={(event) => { event.preventDefault(); void openDouyinProfile(record); }}>{uid}</a>
        : <Text>-</Text>,
    },
    {
      title: "任务队列",
      key: "assignQueue",
      width: 120,
      render: (_, record) => record.uid
        ? <Button size="small" onClick={() => openAssignQueueDetail(record)}>查看详情</Button>
        : <Text>-</Text>,
    },
    {
      title: "取到任务数",
      key: "hitNum",
      width: 120,
      sorter: (left, right) => getMonitorMetric(left, "hitNum") - getMonitorMetric(right, "hitNum"),
      render: (_, record) => formatMonitorCount(orderFetchMonitors.get(getOrderFetchMonitorKey(record.userId, record.uid))?.hitNum),
    },
    {
      title: "无任务数",
      key: "missNum",
      width: 110,
      sorter: (left, right) => getMonitorMetric(left, "missNum") - getMonitorMetric(right, "missNum"),
      render: (_, record) => formatMonitorCount(orderFetchMonitors.get(getOrderFetchMonitorKey(record.userId, record.uid))?.missNum),
    },
    {
      title: "取单速度",
      key: "hitSpeed",
      width: 140,
      sorter: (left, right) => getMonitorMetric(left, "hitSpeed") - getMonitorMetric(right, "hitSpeed"),
      render: (_, record) => formatMonitorSpeed(orderFetchMonitors.get(getOrderFetchMonitorKey(record.userId, record.uid))?.hitSpeed),
    },
    {
      title: "无任务速度",
      key: "missSpeed",
      width: 140,
      sorter: (left, right) => getMonitorMetric(left, "missSpeed") - getMonitorMetric(right, "missSpeed"),
      render: (_, record) => formatMonitorSpeed(orderFetchMonitors.get(getOrderFetchMonitorKey(record.userId, record.uid))?.missSpeed),
    },
    {
      title: "取单成功率",
      key: "hitRate",
      width: 130,
      sorter: (left, right) => getMonitorMetric(left, "hitRate") - getMonitorMetric(right, "hitRate"),
      render: (_, record) => {
        const monitor = orderFetchMonitors.get(getOrderFetchMonitorKey(record.userId, record.uid));
        if (!monitor) return "-";
        return (
          <Tooltip title={`取到任务 ${formatCount(monitor.hitNum)} 次 / 总取单 ${formatCount(monitor.hitNum + monitor.missNum)} 次`}>
            {formatMonitorRate(monitor.hitRate, monitor.hitNum + monitor.missNum)}
          </Tooltip>
        );
      },
    },
    {
      title: "统计窗口",
      key: "windowSeconds",
      width: 110,
      render: (_, record) => formatMonitorWindow(orderFetchMonitors.get(getOrderFetchMonitorKey(record.userId, record.uid))?.windowSeconds),
    },
    {
      title: "已持续时间",
      key: "elapsedSeconds",
      width: 140,
      render: (_, record) => {
        const monitor = orderFetchMonitors.get(getOrderFetchMonitorKey(record.userId, record.uid));
        return (
          <Tooltip title={formatRemainingTooltip(monitor?.hitRemainingSeconds, monitor?.missRemainingSeconds)}>
            {formatMonitorElapsed(monitor?.elapsedSeconds)}
          </Tooltip>
        );
      },
    },
    {
      title: "粉丝数",
      dataIndex: "fansNum",
      key: "fansNum",
      width: 110,
      sorter: true,
      sortDirections: ["descend", "ascend"],
      sortOrder: approvalRateOrder ? null : filters.fansNumOrder === "ASC" ? "ascend" : filters.fansNumOrder === "DESC" ? "descend" : null,
      render: formatCount,
    },
    { title: "总提交数量", dataIndex: "totalSubmitNum", width: 120, render: formatCount },
    { title: "未提交数量", dataIndex: "unSubmitNum", width: 120, render: (value) => <Tag color="gold">{formatCount(value)}</Tag> },
    { title: "待审核数量", dataIndex: "unCheckNum", width: 120, render: (value) => <Tag color="processing">{formatCount(value)}</Tag> },
    { title: "审核成功数量", dataIndex: "checkedNum", width: 130, render: (value) => <Tag color="success">{formatCount(value)}</Tag> },
    { title: "审核失败数量", dataIndex: "checkErrorNum", width: 130, render: (value) => <Tag color="error">{formatCount(value)}</Tag> },
    {
      title: "审核成功率",
      dataIndex: "approvalRate",
      key: "approvalRate",
      width: 120,
      sorter: true,
      sortDirections: ["descend", "ascend"],
      sortOrder: approvalRateOrder,
      render: formatPercent,
    },
  ];

  const pagination: TablePaginationConfig = {
    current: details?.page ?? filters.page,
    pageSize: details?.pageSize ?? filters.pageSize,
    total: details?.total ?? 0,
    showSizeChanger: true,
    showTotal: (total) => `共 ${total} 条`,
  };

  const handleTableChange: TableProps<ManualOrderDetail>["onChange"] = (pagination, _, sorter, extra) => {
    if (extra.action === "sort") {
      if (Array.isArray(sorter)) return;
      if (sorter.field === "approvalRate") {
        setApprovalRateOrder(sorter.order === "ascend" || sorter.order === "descend" ? sorter.order : null);
        return;
      }
      if (sorter.field !== "fansNum") return;
    }
    const fansNumOrder = !Array.isArray(sorter) && sorter.field === "fansNum"
      ? sorter.order === "ascend" ? "ASC" : sorter.order === "descend" ? "DESC" : undefined
      : filters.fansNumOrder;
    const page = extra.action === "sort" ? 1 : pagination.current ?? filters.page;
    const pageSize = pagination.pageSize ?? filters.pageSize;
    const next = { ...filters, fansNumOrder, page, pageSize };
    setApprovalRateOrder(null);
    setFilters(next);
    void loadDetails(next);
  };

  return (
    <div className="manager-page-stack">
      <section className="manager-shell-card" style={{ borderRadius: 28, padding: 24 }}>
        <Space direction="vertical" size={18} style={{ width: "100%" }}>
          <div><div className="manager-section-label">筛选条件</div><Title level={4} style={{ margin: "10px 0 0" }}>查看人工用户做单明细</Title></div>
          <div className="manual-order-detail-filter-bar">
            <div className="manual-order-detail-filter-field">
              <Text type="secondary">做单日期区间</Text>
              <RangePicker
                allowClear={false}
                presets={dateRangePresets}
                style={{ width: "100%", marginTop: 8 }}
                value={filters.dateRange}
                onChange={(value) => {
                  if (!value?.[0] || !value?.[1]) return;
                  const nextRange: [Dayjs, Dayjs] = [value[0].startOf("day"), value[1].startOf("day")];
                  setFilters((current) => ({ ...current, dateRange: nextRange }));
                }}
              />
            </div>
            <div className="manual-order-detail-filter-field">
              <Text type="secondary">用户名</Text>
              <Select
                allowClear
                showSearch
                filterOption={false}
                placeholder="输入用户名或昵称搜索"
                style={{ width: "100%", marginTop: 8 }}
                options={resolvedUserOptions.map((user) => ({ value: user.id, label: user.nickname ? `${user.username} (${user.nickname})` : user.username }))}
                value={filters.userId}
                onSearch={(value) => void searchUsers(value)}
                onChange={(value) => setFilters((current) => ({ ...current, userId: value }))}
              />
            </div>
            <div className="manual-order-detail-filter-field"><Text type="secondary">UID</Text><Input allowClear placeholder="输入 UID" value={filters.uid} onChange={(event) => setFilters((current) => ({ ...current, uid: event.target.value }))} onPressEnter={() => { const next = { ...filters, page: 1 }; setFilters(next); void loadDetails(next); }} style={{ marginTop: 8 }} /></div>
            <div className="manual-order-detail-filter-field"><Text type="secondary">人工商品</Text><Select mode="multiple" allowClear maxTagCount="responsive" placeholder="全部人工商品" style={{ width: "100%", marginTop: 8 }} options={shopCategoryOptions.map((item) => ({ value: item.id, label: item.code ? `${item.name} (${item.code})` : item.name }))} value={filters.shopCategoryIds} onChange={(value) => setFilters((current) => ({ ...current, shopCategoryIds: value, excludeWhitelistUsers: value.length > 0 ? current.excludeWhitelistUsers : false }))} /></div>
            <div className="manual-order-detail-filter-field">
              <Text type="secondary">粉丝量区间</Text>
              <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", alignItems: "center", gap: 8, marginTop: 8 }}>
                <InputNumber min={0} precision={0} placeholder="最小值" style={{ width: "100%" }} value={filters.fansNumMin} onChange={(value) => setFilters((current) => ({ ...current, fansNumMin: typeof value === "number" ? value : undefined }))} />
                <Text type="secondary">至</Text>
                <InputNumber min={0} precision={0} placeholder="最大值" style={{ width: "100%" }} value={filters.fansNumMax} onChange={(value) => setFilters((current) => ({ ...current, fansNumMax: typeof value === "number" ? value : undefined }))} />
              </div>
            </div>
            <div className="manual-order-detail-filter-field">
              <Text type="secondary">审核通过率区间</Text>
              <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", alignItems: "center", gap: 8, marginTop: 8 }}>
                <InputNumber min={0} max={100} precision={2} placeholder="最小值" addonAfter="%" style={{ width: "100%" }} value={filters.approvalRateMin} onChange={(value) => setFilters((current) => ({ ...current, approvalRateMin: typeof value === "number" ? value : undefined }))} />
                <Text type="secondary">至</Text>
                <InputNumber min={0} max={100} precision={2} placeholder="最大值" addonAfter="%" style={{ width: "100%" }} value={filters.approvalRateMax} onChange={(value) => setFilters((current) => ({ ...current, approvalRateMax: typeof value === "number" ? value : undefined }))} />
              </div>
            </div>
            <div className="manual-order-detail-filter-field">
              <Text type="secondary">是否过滤人工商品白名单用户</Text>
              <div style={{ marginTop: 12 }}>
                <Switch
                  checked={filters.excludeWhitelistUsers}
                  disabled={filters.shopCategoryIds.length === 0}
                  checkedChildren="过滤"
                  unCheckedChildren="不过滤"
                  onChange={(value) => setFilters((current) => ({ ...current, excludeWhitelistUsers: value }))}
                />
              </div>
            </div>
            <div className="manual-order-detail-filter-actions"><Button type="primary" icon={<SearchOutlined />} loading={loading} onClick={() => { const next = { ...filters, page: 1 }; setFilters(next); void loadDetails(next); }}>查询</Button><Button icon={<ReloadOutlined />} onClick={() => { const reset = { dateRange: defaultDateRange, userId: undefined, uid: "", shopCategoryIds: [] as number[], excludeWhitelistUsers: false, fansNumOrder: undefined, fansNumMin: undefined, fansNumMax: undefined, approvalRateMin: undefined, approvalRateMax: undefined, page: 1, pageSize: 20 }; setFilters(reset); void loadDetails(reset); }}>重置</Button></div>
          </div>
        </Space>
      </section>

      <section className="manager-shell-card" style={{ borderRadius: 28, padding: 24 }}>
        <Space direction="vertical" size={18} style={{ width: "100%" }}>
          <div><div className="manager-section-label">做单数据</div><Title level={4} style={{ margin: "10px 0 4px" }}>按用户与 UID 汇总</Title><Text type="secondary">UID 可打开最新做单记录对应的抖音主页</Text></div>
          <Table<ManualOrderDetail> rowKey={(record) => `${record.userId}-${record.uid}`} loading={loading} columns={columns} dataSource={displayedRecords} pagination={pagination} onChange={handleTableChange} scroll={{ x: 1970 }} locale={{ emptyText: <Empty description="当前筛选条件下暂无做单数据" /> }} />
        </Space>
      </section>

      <Modal
        open={Boolean(assignQueueRecord)}
        onCancel={closeAssignQueueDetail}
        title="任务队列详情"
        width={880}
        destroyOnClose
        footer={[
          <Button key="close" type="primary" onClick={closeAssignQueueDetail}>关闭</Button>,
        ]}
      >
        <Space direction="vertical" size={14} style={{ width: "100%" }}>
          <div className="manual-assign-queue-header">
            <div className="manual-assign-queue-summary">
              <Text type="secondary">用户名：<Text strong>{assignQueueRecord?.username || "-"}</Text></Text>
              <Text type="secondary">UID：<Text strong>{assignQueueRecord?.uid || "-"}</Text></Text>
              <Text type="secondary">合计待取任务：<Text strong>{formatCount(assignQueueTotals.totalNum)}</Text></Text>
            </div>
            <div className="manual-assign-queue-actions">
              <Button
                size="small"
                icon={<ReloadOutlined />}
                loading={assignQueueLoading}
                onClick={() => {
                  stopAssignQueueMonitoring();
                  if (assignQueueRecord) void loadAssignQueues(assignQueueRecord);
                }}
              >
                刷新
              </Button>
              <InputNumber className="manual-monitor-duration" min={2} precision={0} addonBefore="时长" addonAfter="秒" value={assignQueueMonitorDurationSeconds} disabled={assignQueueMonitoring} onChange={(value) => setAssignQueueMonitorDurationSeconds(typeof value === "number" ? value : DEFAULT_ASSIGN_QUEUE_MONITOR_DURATION_SECONDS)} />
              <Button icon={assignQueueMonitoring ? <StopOutlined /> : <EyeOutlined />} danger={assignQueueMonitoring} onClick={assignQueueMonitoring ? stopAssignQueueMonitoring : startAssignQueueMonitoring} style={{ minWidth: 126 }}>{assignQueueMonitoring ? `停止监控 ${assignQueueMonitorRemainingSeconds}s` : "监控"}</Button>
            </div>
          </div>
          <Descriptions size="small" bordered column={{ xs: 1, sm: 2, md: 3 }} title="该 UID 的取单情况">
            <Descriptions.Item label="取到任务数">{formatMonitorCount(assignQueueMonitor?.hitNum)}</Descriptions.Item>
            <Descriptions.Item label="无任务数">{formatMonitorCount(assignQueueMonitor?.missNum)}</Descriptions.Item>
            <Descriptions.Item label="取单速度">{formatMonitorSpeed(assignQueueMonitor?.hitSpeed)}</Descriptions.Item>
            <Descriptions.Item label="无任务速度">{formatMonitorSpeed(assignQueueMonitor?.missSpeed)}</Descriptions.Item>
            <Descriptions.Item label="取单成功率">
              <Tooltip title={assignQueueMonitor ? `取到任务 ${formatCount(assignQueueMonitor.hitNum)} 次 / 总取单 ${formatCount(assignQueueMonitor.hitNum + assignQueueMonitor.missNum)} 次` : undefined}>
                {assignQueueMonitor ? formatMonitorRate(assignQueueMonitor.hitRate, assignQueueMonitor.hitNum + assignQueueMonitor.missNum) : "-"}
              </Tooltip>
            </Descriptions.Item>
            <Descriptions.Item label="统计窗口">{formatMonitorWindow(assignQueueMonitor?.windowSeconds)}</Descriptions.Item>
            <Descriptions.Item label="已持续时间">
              <Tooltip title={formatRemainingTooltip(assignQueueMonitor?.hitRemainingSeconds, assignQueueMonitor?.missRemainingSeconds)}>
                {formatMonitorElapsed(assignQueueMonitor?.elapsedSeconds)}
              </Tooltip>
            </Descriptions.Item>
          </Descriptions>
          <Text type="secondary">取单速度单位为次/分钟，与做单明细列表口径一致。下方按商品分组归类 Redis 取单队列的积压数量，展开可看到分组下各商品类型的正常队列与延迟队列。点击「获取任务」会用该用户的身份按分组取一次任务，取完自动刷新队列数量与上方取单情况。</Text>
          {assignQueueGroups.length === 0
            ? <Empty description={assignQueueLoading ? "正在加载队列数据" : "该 UID 当前没有任何商品类型的队列数据"} />
            : (
              <Collapse
                defaultActiveKey={assignQueueGroups.length > 0 ? [assignQueueGroups[0].groupKey] : []}
                items={assignQueueGroups.map((group) => ({
                  key: group.groupKey,
                  label: (
                    <Space size={12} wrap>
                      <Text strong>{group.shopGroupName}</Text>
                      {group.shopGroupCode ? <Tag>{group.shopGroupCode}</Tag> : <Tag color="warning">无分组 code</Tag>}
                      <Text type="secondary">合计 {formatCount(group.totalNum)}</Text>
                      <Text type="secondary">正常 {formatCount(group.normalNum)}</Text>
                      <Text type="secondary">延迟 {formatCount(group.delayNum)}</Text>
                    </Space>
                  ),
                  extra: (
                    <Button
                      size="small"
                      type="primary"
                      icon={<ThunderboltOutlined />}
                      disabled={!group.shopGroupCode || !assignQueueRecord}
                      loading={fetchingGroupKey === group.groupKey}
                      onClick={(event) => {
                        event.stopPropagation();
                        if (assignQueueRecord) void handleFetchTask(assignQueueRecord, group);
                      }}
                    >
                      获取任务
                    </Button>
                  ),
                  children: (
                    <Space direction="vertical" size={12} style={{ width: "100%" }}>
                      {renderFetchTaskResult(fetchTaskResults.get(group.groupKey))}
                      <Table<UserAssignQueue>
                        rowKey={(row) => row.shopTypeId}
                        size="small"
                        loading={assignQueueLoading}
                        dataSource={group.rows}
                        pagination={false}
                        columns={assignQueueColumns}
                        locale={{ emptyText: <Empty description="该分组下没有商品类型队列数据" /> }}
                      />
                    </Space>
                  ),
                }))}
              />
            )}
        </Space>
      </Modal>
    </div>
  );
}

const assignQueueColumns: ColumnsType<UserAssignQueue> = [
  {
    title: "商品类型",
    dataIndex: "shopTypeName",
    render: (value, row) => <Tooltip title={row.queueKey}>{value || row.shopTypeCode || "-"}</Tooltip>,
  },
  { title: "商品类型ID", dataIndex: "shopTypeId", width: 110 },
  { title: "正常队列数量", dataIndex: "normalNum", width: 130, sorter: (left, right) => left.normalNum - right.normalNum, render: formatCount },
  { title: "延迟队列数量", dataIndex: "delayNum", width: 130, sorter: (left, right) => left.delayNum - right.delayNum, render: (value) => <Tag color={value > 0 ? "gold" : undefined}>{formatCount(value)}</Tag> },
  { title: "合计", dataIndex: "totalNum", width: 100, defaultSortOrder: "descend", sorter: (left, right) => left.totalNum - right.totalNum, render: formatCount },
  { title: "队列剩余有效期", dataIndex: "remainingSeconds", width: 140, render: formatMonitorWindow },
];

function renderFetchTaskResult(task?: ManualUserFetchTask) {
  if (!task) return null;
  if (!task.fetched) {
    return <Alert type="info" showIcon message={task.message || "当前没有取到任务"} description={task.requestUrl ? <Text type="secondary" copyable={{ text: task.requestUrl }}>{task.requestUrl}</Text> : undefined} />;
  }
  return (
    <Alert
      type="success"
      showIcon
      message={`取到任务${task.orderId ? `（订单号 ${task.orderId}）` : ""}`}
      description={(
        <Descriptions size="small" column={2} style={{ marginTop: 8 }}>
          <Descriptions.Item label="订单号">{task.orderId || "-"}</Descriptions.Item>
          <Descriptions.Item label="视频ID">{task.videoId || "-"}</Descriptions.Item>
          <Descriptions.Item label="任务量">{task.totalNum === undefined ? "-" : formatCount(task.totalNum)}</Descriptions.Item>
          <Descriptions.Item label="任务标记">{task.taskTag || "-"}</Descriptions.Item>
          <Descriptions.Item label="协助ID">{task.assistId || "-"}</Descriptions.Item>
          <Descriptions.Item label="secUid">{task.secUid || "-"}</Descriptions.Item>
          <Descriptions.Item label="任务链接" span={2}>
            {task.taskUrl ? <a href={task.taskUrl} target="_blank" rel="noreferrer noopener">{task.taskUrl}</a> : "-"}
          </Descriptions.Item>
          <Descriptions.Item label="短链" span={2}>
            {task.shortUrl ? <a href={task.shortUrl} target="_blank" rel="noreferrer noopener">{task.shortUrl}</a> : "-"}
          </Descriptions.Item>
        </Descriptions>
      )}
    />
  );
}

function formatCount(value?: number) { return Number(value || 0).toLocaleString("zh-CN"); }
function formatPercent(value?: number) { return `${(Number(value || 0) * 100).toFixed(2)}%`; }
function formatMonitorCount(value?: number) { return value === undefined ? "-" : formatCount(value); }
function formatMonitorSpeed(value?: number) { return value === undefined ? "-" : Number(value).toFixed(2); }
function formatMonitorRate(value?: number, totalNum?: number) {
  if (!totalNum) return "-";
  return `${(Number(value || 0) * 100).toFixed(2)}%`;
}
function formatMonitorWindow(value?: number) { return value === undefined ? "-" : `${value} 秒`; }
function formatMonitorElapsed(value?: number) {
  if (value === undefined) return "-";
  const seconds = Math.max(0, Math.floor(value));
  if (seconds < 60) return `${seconds} 秒`;
  return `${Math.floor(seconds / 60)} 分 ${seconds % 60} 秒`;
}
function formatRemainingTooltip(hitRemainingSeconds?: number, missRemainingSeconds?: number) {
  return (
    <Space direction="vertical" size={2}>
      <span>取单剩余有效期：{formatMonitorWindow(hitRemainingSeconds)}</span>
      <span>无任务剩余有效期：{formatMonitorWindow(missRemainingSeconds)}</span>
    </Space>
  );
}
