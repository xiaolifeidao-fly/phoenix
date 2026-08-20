"use client";

import { useEffect, useRef, useState } from "react";
import { EyeOutlined, ReloadOutlined, SearchOutlined, StopOutlined } from "@ant-design/icons";
import { Button, Empty, Input, InputNumber, Select, Space, Table, Tag, Tooltip, Typography } from "antd";
import type { ColumnsType } from "antd/es/table";
import { message } from "@/utils/notify";
import {
  fetchManualUserMonitorPage,
  type ManualUserMonitorItem,
} from "../../api/user-monitor.api";
import { fetchManualChannels, type ManualChannelRecord } from "../../api/channel.api";

const { Text, Title } = Typography;
const DEFAULT_MONITOR_DURATION_SECONDS = 120;
const MONITOR_REFRESH_INTERVAL_MS = 2_000;

interface UserMonitorFilters {
  channel: string;
  username: string;
}

const initialFilters: UserMonitorFilters = { channel: "", username: "" };

export function ManualUserMonitorPanel() {
  const [filters, setFilters] = useState<UserMonitorFilters>(initialFilters);
  const [users, setUsers] = useState<ManualUserMonitorItem[]>([]);
  const [channels, setChannels] = useState<ManualChannelRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [channelLoading, setChannelLoading] = useState(false);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 });
  const [monitorDurationSeconds, setMonitorDurationSeconds] = useState(DEFAULT_MONITOR_DURATION_SECONDS);
  const [monitoring, setMonitoring] = useState(false);
  const [monitorRemainingSeconds, setMonitorRemainingSeconds] = useState(0);
  const monitorTimerRef = useRef<number | null>(null);
  const monitorSessionRef = useRef(0);
  const monitorRequestInFlightRef = useRef(false);

  const loadUsers = async (
    pageIndex = pagination.current,
    pageSize = pagination.pageSize,
    nextFilters = filters,
  ) => {
    setLoading(true);
    try {
      const result = await fetchManualUserMonitorPage({
        pageIndex,
        pageSize,
        channel: nextFilters.channel,
        username: nextFilters.username,
      });
      setUsers(result.data);
      setPagination((current) => ({ ...current, current: pageIndex, pageSize, total: result.total }));
    } catch (error) {
      message.error(error instanceof Error ? error.message : "加载用户做单监控失败");
      setUsers([]);
      setPagination((current) => ({ ...current, total: 0 }));
    } finally {
      setLoading(false);
    }
  };

  const loadChannels = async () => {
    setChannelLoading(true);
    try {
      setChannels(await fetchManualChannels());
    } catch (error) {
      message.error(error instanceof Error ? error.message : "加载渠道选项失败");
      setChannels([]);
    } finally {
      setChannelLoading(false);
    }
  };

  const stopMonitoring = () => {
    monitorSessionRef.current += 1;
    if (monitorTimerRef.current !== null) {
      window.clearInterval(monitorTimerRef.current);
      monitorTimerRef.current = null;
    }
    monitorRequestInFlightRef.current = false;
    setMonitoring(false);
    setMonitorRemainingSeconds(0);
  };

  useEffect(() => {
    void loadUsers(1, pagination.pageSize);
    void loadChannels();
    return () => {
      if (monitorTimerRef.current !== null) window.clearInterval(monitorTimerRef.current);
    };
  }, []);

  const columns: ColumnsType<ManualUserMonitorItem> = [
    { title: "用户 ID", dataIndex: "userId", width: 120, render: (value) => <Text strong>{value || "-"}</Text> },
    { title: "用户名", dataIndex: "username", width: 160, render: (value) => value || "-" },
    { title: "姓名", dataIndex: "name", width: 140, render: (value) => value || "-" },
    { title: "渠道", dataIndex: "channel", width: 130, render: (value) => value || "-" },
    { title: "状态", dataIndex: "status", width: 110, render: (value) => value ? <Tag color="processing">{value}</Tag> : "-" },
    { title: "取到任务数", dataIndex: ["monitor", "hitNum"], width: 120, sorter: (left, right) => left.monitor.hitNum - right.monitor.hitNum, render: formatCount },
    { title: "无任务数", dataIndex: ["monitor", "missNum"], width: 110, sorter: (left, right) => left.monitor.missNum - right.monitor.missNum, render: formatCount },
    { title: "取单速度", dataIndex: ["monitor", "hitSpeed"], width: 140, sorter: (left, right) => left.monitor.hitSpeed - right.monitor.hitSpeed, render: formatSpeed },
    { title: "无任务速度", dataIndex: ["monitor", "missSpeed"], width: 140, sorter: (left, right) => left.monitor.missSpeed - right.monitor.missSpeed, render: formatSpeed },
    {
      title: "取单成功率",
      dataIndex: ["monitor", "hitRate"],
      width: 130,
      sorter: (left, right) => left.monitor.hitRate - right.monitor.hitRate,
      render: (value, record) => (
        <Tooltip title={`取到任务 ${formatCount(record.monitor.hitNum)} 次 / 总取单 ${formatCount(record.monitor.hitNum + record.monitor.missNum)} 次`}>
          {formatRate(value, record.monitor.hitNum + record.monitor.missNum)}
        </Tooltip>
      ),
    },
    { title: "统计窗口", dataIndex: ["monitor", "windowSeconds"], width: 130, render: formatWindow },
    {
      title: "已持续时间",
      dataIndex: ["monitor", "elapsedSeconds"],
      width: 140,
      render: (value, record) => (
        <Tooltip title={formatRemainingTooltip(record.monitor.hitRemainingSeconds, record.monitor.missRemainingSeconds)}>
          {formatElapsed(value)}
        </Tooltip>
      ),
    },
  ];

  const search = () => {
    stopMonitoring();
    void loadUsers(1, pagination.pageSize);
  };

  const reset = () => {
    stopMonitoring();
    setFilters(initialFilters);
    void loadUsers(1, pagination.pageSize, initialFilters);
  };

  const startMonitoring = () => {
    const durationSeconds = Math.floor(monitorDurationSeconds);
    if (durationSeconds < 2) {
      message.warning("监控时长不能少于 2 秒");
      return;
    }

    stopMonitoring();
    const session = monitorSessionRef.current + 1;
    monitorSessionRef.current = session;
    const monitoredFilters = { ...filters };
    const pageSize = pagination.pageSize;
    const endAt = Date.now() + durationSeconds * 1_000;

    setMonitoring(true);
    setMonitorRemainingSeconds(durationSeconds);

    const refresh = () => {
      if (session !== monitorSessionRef.current) return;
      const remainingSeconds = Math.ceil((endAt - Date.now()) / 1_000);
      if (remainingSeconds <= 0) {
        stopMonitoring();
        return;
      }
      setMonitorRemainingSeconds(remainingSeconds);
      if (monitorRequestInFlightRef.current) return;

      monitorRequestInFlightRef.current = true;
      void loadUsers(1, pageSize, monitoredFilters).finally(() => {
        if (session === monitorSessionRef.current) monitorRequestInFlightRef.current = false;
      });
    };

    refresh();
    monitorTimerRef.current = window.setInterval(refresh, MONITOR_REFRESH_INTERVAL_MS);
  };

  return (
    <div style={{ display: "grid", gap: 20 }}>
      <section className="manager-shell-card" style={{ borderRadius: 28, padding: 24 }}>
        <Space direction="vertical" size={18} style={{ width: "100%" }}>
          <div>
            <div className="manager-section-label">用户做单监控</div>
            <Title level={4} style={{ margin: "10px 0 4px" }}>查看用户取单数量和实时速度</Title>
            <Text type="secondary">统计当前窗口内用户取到任务及无任务的次数和速度。</Text>
          </div>
          <div className="manual-monitor-filter-bar">
            <div className="manual-monitor-filter-field">
              <Text type="secondary">渠道</Text>
              <Select
                allowClear
                loading={channelLoading}
                placeholder="全部渠道"
                style={{ width: "100%", marginTop: 8 }}
                options={[{ label: "全部渠道", value: "" }, ...channels.map((item) => ({ label: item.name ? `${item.name}${item.code ? ` (${item.code})` : ""}` : item.code, value: item.code }))]}
                value={filters.channel}
                onChange={(value) => setFilters((current) => ({ ...current, channel: value ?? "" }))}
              />
            </div>
            <div className="manual-monitor-filter-field">
              <Text type="secondary">用户名</Text>
              <Input allowClear placeholder="输入用户名" style={{ marginTop: 8 }} value={filters.username} onChange={(event) => setFilters((current) => ({ ...current, username: event.target.value }))} onPressEnter={search} />
            </div>
            <div className="manual-monitor-filter-actions">
              <Button type="primary" icon={<SearchOutlined />} loading={loading} onClick={search}>查询</Button>
              <InputNumber className="manual-monitor-duration" min={2} precision={0} addonBefore="时长" addonAfter="秒" value={monitorDurationSeconds} disabled={monitoring} onChange={(value) => setMonitorDurationSeconds(typeof value === "number" ? value : DEFAULT_MONITOR_DURATION_SECONDS)} />
              <Button icon={monitoring ? <StopOutlined /> : <EyeOutlined />} danger={monitoring} onClick={monitoring ? stopMonitoring : startMonitoring} style={{ minWidth: 126 }}>{monitoring ? `停止监控 ${monitorRemainingSeconds}s` : "监控"}</Button>
              <Button icon={<ReloadOutlined />} loading={loading} onClick={() => { stopMonitoring(); void loadUsers(); }}>刷新</Button>
              <Button onClick={reset}>重置</Button>
            </div>
          </div>
        </Space>
      </section>

      <section className="manager-shell-card" style={{ borderRadius: 28, padding: 24 }}>
        <Space direction="vertical" size={18} style={{ width: "100%" }}>
          <div><div className="manager-section-label">监控列表</div><Title level={4} style={{ margin: "10px 0 4px" }}>按用户维度查看取单表现</Title><Text type="secondary">每次加载当前页用户后，统一请求监控接口补充取单统计。</Text></div>
          <Table<ManualUserMonitorItem> rowKey="userId" loading={loading} columns={columns} dataSource={users} scroll={{ x: 1320 }} locale={{ emptyText: <Empty description="当前筛选条件下暂无用户数据" /> }} pagination={{ ...pagination, showSizeChanger: true, showTotal: (total) => `共 ${total} 位用户`, onChange: (page, pageSize) => { stopMonitoring(); void loadUsers(page, pageSize); } }} />
        </Space>
      </section>
    </div>
  );
}

function formatCount(value?: number) {
  return Number(value || 0).toLocaleString("zh-CN");
}

function formatSpeed(value?: number) {
  return `${Number(value || 0).toFixed(2)} 次/分钟`;
}

function formatRate(value?: number, totalNum?: number) {
  if (!totalNum) return "-";
  return `${(Number(value || 0) * 100).toFixed(2)}%`;
}

function formatWindow(value?: number) {
  return Number(value || 0) > 0 ? `${value} 秒` : "-";
}

function formatElapsed(value?: number) {
  const seconds = Math.max(0, Math.floor(Number(value || 0)));
  if (seconds < 60) return `${seconds} 秒`;
  return `${Math.floor(seconds / 60)} 分 ${seconds % 60} 秒`;
}

function formatRemainingTooltip(hitRemainingSeconds?: number, missRemainingSeconds?: number) {
  return (
    <Space direction="vertical" size={2}>
      <span>取单剩余有效期：{formatWindow(hitRemainingSeconds)}</span>
      <span>无任务剩余有效期：{formatWindow(missRemainingSeconds)}</span>
    </Space>
  );
}
