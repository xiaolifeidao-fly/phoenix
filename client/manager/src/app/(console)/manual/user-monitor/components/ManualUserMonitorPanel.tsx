"use client";

import { useEffect, useState } from "react";
import { ReloadOutlined, SearchOutlined } from "@ant-design/icons";
import { Button, Empty, Input, Space, Table, Tag, Tooltip, Typography } from "antd";
import type { ColumnsType } from "antd/es/table";
import { message } from "@/utils/notify";
import {
  fetchManualUserMonitorPage,
  type ManualUserMonitorItem,
} from "../../api/user-monitor.api";

const { Text, Title } = Typography;

interface UserMonitorFilters {
  userId: string;
  username: string;
}

const initialFilters: UserMonitorFilters = { userId: "", username: "" };

export function ManualUserMonitorPanel() {
  const [filters, setFilters] = useState<UserMonitorFilters>(initialFilters);
  const [users, setUsers] = useState<ManualUserMonitorItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 });

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
        userId: nextFilters.userId,
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

  useEffect(() => {
    void loadUsers(1, pagination.pageSize);
  }, []);

  const columns: ColumnsType<ManualUserMonitorItem> = [
    { title: "用户 ID", dataIndex: "userId", width: 120, render: (value) => <Text strong>{value || "-"}</Text> },
    { title: "用户名", dataIndex: "username", width: 160, render: (value) => value || "-" },
    { title: "姓名", dataIndex: "name", width: 140, render: (value) => value || "-" },
    { title: "渠道", dataIndex: "channel", width: 130, render: (value) => value || "-" },
    { title: "状态", dataIndex: "status", width: 110, render: (value) => value ? <Tag color="processing">{value}</Tag> : "-" },
    { title: "取到任务数", dataIndex: ["monitor", "hitNum"], width: 120, render: formatCount },
    { title: "无任务数", dataIndex: ["monitor", "missNum"], width: 110, render: formatCount },
    { title: "取单速度", dataIndex: ["monitor", "hitSpeed"], width: 140, render: formatSpeed },
    { title: "无任务速度", dataIndex: ["monitor", "missSpeed"], width: 140, render: formatSpeed },
    {
      title: "取单成功率",
      dataIndex: ["monitor", "hitRate"],
      width: 130,
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
    void loadUsers(1, pagination.pageSize);
  };

  const reset = () => {
    setFilters(initialFilters);
    void loadUsers(1, pagination.pageSize, initialFilters);
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
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14, alignItems: "end" }}>
            <div><Text type="secondary">用户 ID</Text><Input allowClear placeholder="输入用户 ID" style={{ marginTop: 8 }} value={filters.userId} onChange={(event) => setFilters((current) => ({ ...current, userId: event.target.value }))} onPressEnter={search} /></div>
            <div><Text type="secondary">用户名</Text><Input allowClear placeholder="输入用户名" style={{ marginTop: 8 }} value={filters.username} onChange={(event) => setFilters((current) => ({ ...current, username: event.target.value }))} onPressEnter={search} /></div>
            <Space><Button type="primary" icon={<SearchOutlined />} loading={loading} onClick={search}>查询</Button><Button icon={<ReloadOutlined />} loading={loading} onClick={() => void loadUsers()}>刷新</Button><Button onClick={reset}>重置</Button></Space>
          </div>
        </Space>
      </section>

      <section className="manager-shell-card" style={{ borderRadius: 28, padding: 24 }}>
        <Space direction="vertical" size={18} style={{ width: "100%" }}>
          <div><div className="manager-section-label">监控列表</div><Title level={4} style={{ margin: "10px 0 4px" }}>按用户维度查看取单表现</Title><Text type="secondary">每次加载当前页用户后，统一请求监控接口补充取单统计。</Text></div>
          <Table<ManualUserMonitorItem> rowKey="userId" loading={loading} columns={columns} dataSource={users} scroll={{ x: 1320 }} locale={{ emptyText: <Empty description="当前筛选条件下暂无用户数据" /> }} pagination={{ ...pagination, showSizeChanger: true, showTotal: (total) => `共 ${total} 位用户`, onChange: (page, pageSize) => void loadUsers(page, pageSize) }} />
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
