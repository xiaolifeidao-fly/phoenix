"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CheckCircleOutlined,
  EditOutlined,
  ReloadOutlined,
  SearchOutlined,
  StopOutlined,
} from "@ant-design/icons";
import {
  Button,
  Form,
  Input,
  Modal,
  Popconfirm,
  Select,
  Space,
  Table,
  Tag,
  Tooltip,
  Typography,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import dayjs from "dayjs";
import { message } from "@/utils/notify";
import {
  disableUpstreamCommunity,
  enableUpstreamCommunity,
  fetchUpstreamCommunities,
  updateUpstreamCommunityPrefixUrl,
  type UpstreamCommunity,
} from "../api/community.api";

const { Text } = Typography;

const activeOptions = [
  { label: "全部状态", value: "" },
  { label: "启用", value: "true" },
  { label: "禁用", value: "false" },
];

interface PrefixFormValues {
  prefixUrl: string;
}

export function UpstreamCommunityPanel() {
  const [items, setItems] = useState<UpstreamCommunity[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [submittingId, setSubmittingId] = useState<number | null>(null);
  const [query, setQuery] = useState({ pageIndex: 1, pageSize: 20, channel: "", active: "" });
  const [editing, setEditing] = useState<UpstreamCommunity | null>(null);
  const [prefixForm] = Form.useForm<PrefixFormValues>();

  const load = async (next = query) => {
    setLoading(true);
    try {
      const result = await fetchUpstreamCommunities({
        pageIndex: next.pageIndex,
        pageSize: next.pageSize,
        channel: next.channel.trim() || undefined,
        active: next.active || undefined,
      });
      setItems(result.data);
      setTotal(result.total);
      setQuery(next);
    } catch (error) {
      message.error(error instanceof Error ? error.message : "加载上游社区失败");
      setItems([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const stats = useMemo(() => {
    const queueDepth = items.find((item) => item.syncQueueDepth !== null)?.syncQueueDepth;
    return [
      { label: "社区总数", value: total },
      { label: "本页启用", value: items.filter((item) => item.active).length },
      { label: "前缀不可达", value: items.filter((item) => item.prefixUrlAvailable === false).length },
      { label: "通知排队深度", value: queueDepth ?? "-" },
    ];
  }, [items, total]);

  const runAction = async (record: UpstreamCommunity, action: () => Promise<{ message: string }>, fallback: string) => {
    setSubmittingId(record.id);
    try {
      const result = await action();
      message.success(result.message || fallback);
      await load();
    } catch (error) {
      message.error(error instanceof Error ? error.message : "操作失败");
    } finally {
      setSubmittingId(null);
    }
  };

  const openEdit = (record: UpstreamCommunity) => {
    setEditing(record);
    prefixForm.setFieldsValue({ prefixUrl: record.prefixUrl });
  };

  const handleSavePrefix = async () => {
    if (!editing) return;
    const values = await prefixForm.validateFields();
    const record = editing;
    setEditing(null);
    await runAction(record, () => updateUpstreamCommunityPrefixUrl(record.id, values.prefixUrl.trim()), "修改成功");
  };

  const columns: ColumnsType<UpstreamCommunity> = [
    { title: "ID", dataIndex: "id", width: 80 },
    {
      title: "社区渠道",
      dataIndex: "channel",
      width: 140,
      render: (value: string) => <Text strong>{value || "-"}</Text>,
    },
    {
      title: "请求前缀地址",
      dataIndex: "prefixUrl",
      width: 300,
      render: (value: string, record) => (
        <Space size={6}>
          {availabilityTag(record.prefixUrlAvailable)}
          <Text copyable={value ? { text: value } : false} ellipsis style={{ maxWidth: 220 }}>{value || "-"}</Text>
        </Space>
      ),
    },
    {
      title: "状态",
      dataIndex: "active",
      width: 90,
      render: (value: boolean) => (value ? <Tag color="success">启用</Tag> : <Tag>禁用</Tag>),
    },
    {
      title: (
        <Tooltip title="上一个完整分钟的同步次数：成功 / 网络失败 / 认证失败 / 业务失败；该分钟无样本时为空">
          上一分钟同步
        </Tooltip>
      ),
      key: "sync",
      width: 220,
      render: (_, record) => {
        if (record.syncOk === null && record.syncFailNet === null && record.syncFailAuth === null && record.syncFailBiz === null) {
          return <Text type="secondary">无样本</Text>;
        }
        return (
          <Space size={4}>
            <Tooltip title="成功"><Tag color="success">{record.syncOk ?? 0}</Tag></Tooltip>
            <Tooltip title="网络失败（超时 / 非 2xx / 解析失败）"><Tag color={record.syncFailNet ? "error" : "default"}>{record.syncFailNet ?? 0}</Tag></Tooltip>
            <Tooltip title="认证失败"><Tag color={record.syncFailAuth ? "error" : "default"}>{record.syncFailAuth ?? 0}</Tag></Tooltip>
            <Tooltip title="业务失败（上游返回错误码）"><Tag color={record.syncFailBiz ? "warning" : "default"}>{record.syncFailBiz ?? 0}</Tag></Tooltip>
          </Space>
        );
      },
    },
    {
      title: (
        <Tooltip title="成功均值 / 失败均值 / 成功 P95 区间。判断慢不慢优先看 P95，均值会掩盖长尾">
          同步耗时
        </Tooltip>
      ),
      key: "latency",
      width: 230,
      render: (_, record) => (
        <Text type={record.syncOkAvgMs === null && record.syncFailAvgMs === null ? "secondary" : undefined}>
          {formatMs(record.syncOkAvgMs)} / {formatMs(record.syncFailAvgMs)} / {record.syncOkP95 || "-"}
        </Text>
      ),
    },
    {
      title: "更新",
      key: "updated",
      width: 200,
      render: (_, record) => (
        <Space direction="vertical" size={0}>
          <Text>{formatTime(record.updatedAt)}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>{record.updateBy || record.createBy || "-"}</Text>
        </Space>
      ),
    },
    {
      title: "操作",
      key: "actions",
      width: 110,
      fixed: "right",
      render: (_, record) => (
        <Space size={4}>
          <Tooltip title="修改前缀地址">
            <Button type="text" size="small" icon={<EditOutlined />} disabled={submittingId !== null} onClick={() => openEdit(record)} />
          </Tooltip>
          {record.active ? (
            <Popconfirm
              title="禁用上游社区"
              description="禁用后会同时逻辑删除该渠道下的商品映射，确认继续？"
              okText="禁用"
              okButtonProps={{ danger: true }}
              cancelText="取消"
              onConfirm={() => runAction(record, () => disableUpstreamCommunity(record.id), "禁用成功")}
            >
              <Tooltip title="禁用">
                <Button type="text" size="small" danger icon={<StopOutlined />} loading={submittingId === record.id} disabled={submittingId !== null} />
              </Tooltip>
            </Popconfirm>
          ) : (
            <Popconfirm
              title="启用上游社区"
              okText="启用"
              cancelText="取消"
              onConfirm={() => runAction(record, () => enableUpstreamCommunity(record.id), "启用成功")}
            >
              <Tooltip title="启用">
                <Button type="text" size="small" icon={<CheckCircleOutlined />} loading={submittingId === record.id} disabled={submittingId !== null} />
              </Tooltip>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div className="manager-page-stack">
      <section className="manager-stats-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(150px, 150px))" }}>
        {stats.map((item) => (
          <div key={item.label} className="manager-metric-chip manager-metric-chip-compact">
            <Text style={{ color: "var(--manager-text-faint)", fontSize: 12 }}>{item.label}</Text>
            <div className="manager-value" style={{ marginTop: 4, fontSize: 22, lineHeight: 1.1 }}>{item.value}</div>
          </div>
        ))}
      </section>

      <section className="manager-data-card manager-toolbar-panel">
        <Space wrap>
          <Input
            prefix={<SearchOutlined />}
            placeholder="社区渠道"
            allowClear
            value={query.channel}
            onChange={(event) => setQuery((current) => ({ ...current, channel: event.target.value }))}
            onPressEnter={() => void load({ ...query, pageIndex: 1 })}
            style={{ width: 200 }}
          />
          <Select
            value={query.active}
            options={activeOptions}
            style={{ width: 140 }}
            onChange={(active) => void load({ ...query, pageIndex: 1, active })}
          />
          <Button type="primary" icon={<SearchOutlined />} onClick={() => void load({ ...query, pageIndex: 1 })}>查询</Button>
          <Button icon={<ReloadOutlined />} loading={loading} onClick={() => void load()}>刷新</Button>
        </Space>
      </section>

      <section className="manager-data-card manager-table">
        <Table<UpstreamCommunity>
          rowKey="id"
          loading={loading}
          dataSource={items}
          columns={columns}
          scroll={{ x: 1370 }}
          pagination={{
            current: query.pageIndex,
            pageSize: query.pageSize,
            total,
            showSizeChanger: true,
            onChange: (pageIndex, pageSize) => void load({ ...query, pageIndex, pageSize }),
          }}
        />
      </section>

      <Modal
        title={editing ? `修改前缀地址 · ${editing.channel}` : "修改前缀地址"}
        open={Boolean(editing)}
        okText="保存"
        cancelText="取消"
        onOk={handleSavePrefix}
        onCancel={() => setEditing(null)}
        destroyOnClose
      >
        <Form<PrefixFormValues> className="manager-form-skin" form={prefixForm} layout="vertical" preserve={false}>
          <Form.Item
            name="prefixUrl"
            label="请求前缀地址"
            rules={[{ required: true, whitespace: true, message: "请输入请求前缀地址" }]}
          >
            <Input placeholder="https://" maxLength={500} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

function availabilityTag(value: boolean | null) {
  if (value === true) return <Tooltip title="前缀地址连通"><Tag color="success">连通</Tag></Tooltip>;
  if (value === false) return <Tooltip title="健康检查访问失败"><Tag color="error">不可达</Tag></Tooltip>;
  return <Tag>未检测</Tag>;
}

function formatMs(value: number | null) {
  return value === null || value === undefined ? "-" : `${value}ms`;
}

function formatTime(value: string | number | null) {
  if (!value) return "-";
  const parsed = dayjs(value);
  return parsed.isValid() ? parsed.format("YYYY-MM-DD HH:mm:ss") : String(value);
}
