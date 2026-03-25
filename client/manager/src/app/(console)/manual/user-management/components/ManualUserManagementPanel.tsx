"use client";

import { useEffect, useMemo, useState } from "react";
import {
  EditOutlined,
  PlusOutlined,
  ReloadOutlined,
  SearchOutlined,
} from "@ant-design/icons";
import {
  Button,
  Form,
  Input,
  Modal,
  Select,
  Space,
  Table,
  Tag,
  Typography,
  message,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import { fetchManualChannels, type ManualChannelRecord } from "../../api/channel.api";
import {
  createManualUser,
  fetchManualUserDetail,
  fetchManualUsers,
  type ManualUserPayload,
  type ManualUserRecord,
  updateManualUser,
} from "../../api/user.api";

const { Paragraph, Text, Title } = Typography;

interface UserFormValues {
  username: string;
  password?: string;
  originalPassword?: string;
  channel?: string;
  inventCode?: string;
  alipayName?: string;
  alipayAccount?: string;
  role?: string;
}

export function ManualUserManagementPanel() {
  const [form] = Form.useForm<UserFormValues>();
  const [users, setUsers] = useState<ManualUserRecord[]>([]);
  const [channels, setChannels] = useState<ManualChannelRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [channelLoading, setChannelLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<ManualUserRecord | null>(null);
  const [filters, setFilters] = useState({
    channel: "",
    keyword: "",
  });

  const loadUsers = async () => {
    setLoading(true);
    try {
      const result = await fetchManualUsers({
        channel: filters.channel.trim() || undefined,
        username: filters.keyword.trim() || undefined,
      });
      setUsers(result);
    } catch (error) {
      message.error(error instanceof Error ? error.message : "加载人工用户失败");
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  const loadChannels = async () => {
    setChannelLoading(true);
    try {
      const result = await fetchManualChannels();
      setChannels(result);
    } catch (error) {
      message.error(error instanceof Error ? error.message : "加载渠道选项失败");
      setChannels([]);
    } finally {
      setChannelLoading(false);
    }
  };

  useEffect(() => {
    void loadUsers();
    void loadChannels();
  }, []);

  const channelOptions = useMemo(
    () =>
      channels.map((item) => ({
        label: item.name ? `${item.name}${item.code ? ` (${item.code})` : ""}` : item.code,
        value: item.code,
      })),
    [channels],
  );

  const channelNameMap = useMemo(
    () =>
      new Map(
        channels.map((item) => [
          item.code,
          item.name ? `${item.name}${item.code ? ` (${item.code})` : ""}` : item.code,
        ]),
      ),
    [channels],
  );

  const stats = useMemo(
    () => [
      { label: "人工用户总数", value: users.length },
      { label: "已绑定支付宝", value: users.filter((item) => Boolean(item.alipayAccount)).length },
      { label: "已配置支付方式", value: users.filter((item) => (item.paymentMethods ?? []).length > 0).length },
      { label: "渠道数", value: new Set(users.map((item) => item.channel).filter(Boolean)).size },
    ],
    [users],
  );

  const filteredUsers = useMemo(() => {
    const channel = filters.channel.trim().toLowerCase();
    const keyword = filters.keyword.trim().toLowerCase();
    return users.filter((item) => {
      const matchChannel = !channel || (item.channel || "").toLowerCase() === channel;
      const matchKeyword =
        !keyword ||
        (item.username || "").toLowerCase().includes(keyword) ||
        (item.role || "").toLowerCase().includes(keyword) ||
        (item.inventCode || "").toLowerCase().includes(keyword) ||
        (item.alipayAccount || "").toLowerCase().includes(keyword);
      return matchChannel && matchKeyword;
    });
  }, [filters, users]);

  const openCreateModal = () => {
    setEditingUser(null);
    form.setFieldsValue({
      username: "",
      password: "",
      originalPassword: "",
      channel: "",
      inventCode: "",
      alipayName: "",
      alipayAccount: "",
      role: "",
    });
    setModalOpen(true);
  };

  const openEditModal = async (record: ManualUserRecord) => {
    setSubmitting(true);
    try {
      const detail = await fetchManualUserDetail(record.username);
      setEditingUser(detail);
      form.setFieldsValue(toFormValues(detail));
      setModalOpen(true);
    } catch (error) {
      message.error(error instanceof Error ? error.message : "加载用户详情失败");
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = async () => {
    const values = await form.validateFields();
    const payload: ManualUserPayload = {
      username: values.username.trim(),
      password: values.password?.trim() || undefined,
      originalPassword: values.originalPassword?.trim() || undefined,
      channel: values.channel?.trim() || undefined,
      inventCode: values.inventCode?.trim() || undefined,
      alipayName: values.alipayName?.trim() || undefined,
      alipayAccount: values.alipayAccount?.trim() || undefined,
      role: values.role?.trim() || undefined,
    };

    setSubmitting(true);
    try {
      if (editingUser) {
        await updateManualUser(payload);
      } else {
        await createManualUser(payload);
      }
      message.success(editingUser ? "人工用户已更新" : "人工用户已创建");
      setModalOpen(false);
      setEditingUser(null);
      await loadUsers();
    } catch (error) {
      message.error(error instanceof Error ? error.message : "保存人工用户失败");
    } finally {
      setSubmitting(false);
    }
  };

  const columns: ColumnsType<ManualUserRecord> = [
    {
      title: "用户名",
      dataIndex: "username",
      width: 180,
      render: (value: string, record) => (
        <Space direction="vertical" size={2}>
          <Text style={{ color: "var(--manager-text)", fontWeight: 600 }}>{value || "-"}</Text>
          <Text type="secondary">{record.role || "未设置角色"}</Text>
        </Space>
      ),
    },
    {
      title: "渠道 / 邀请码",
      key: "channel",
      width: 180,
      render: (_, record) => (
        <Space direction="vertical" size={2}>
          <Text>{resolveChannelLabel(record.channel, channelNameMap)}</Text>
          <Text type="secondary">{record.inventCode || "无邀请码"}</Text>
        </Space>
      ),
    },
    {
      title: "支付宝信息",
      key: "alipay",
      width: 220,
      render: (_, record) => (
        <Space direction="vertical" size={2}>
          <Text>{record.alipayName || "-"}</Text>
          <Text type="secondary">{record.alipayAccount || "未绑定"}</Text>
        </Space>
      ),
    },
    {
      title: "支付方式",
      dataIndex: "paymentMethods",
      render: (value?: ManualUserRecord["paymentMethods"]) =>
        value && value.length > 0 ? (
          <Space size={[6, 6]} wrap>
            {value.map((item, index) => (
              <Tag key={`${item.type}-${item.account}-${index}`} color="blue">
                {`${item.type || "PAY"}:${item.account || item.name || "-"}`}
              </Tag>
            ))}
          </Space>
        ) : (
          "-"
        ),
    },
    {
      title: "更新时间",
      dataIndex: "updatedTime",
      width: 180,
      render: (value?: string) => formatDateTime(value),
    },
    {
      title: "操作",
      key: "actions",
      fixed: "right",
      width: 80,
      render: (_, record) => (
        <Button type="text" icon={<EditOutlined />} onClick={() => void openEditModal(record)}>
          编辑
        </Button>
      ),
    },
  ];

  return (
    <div className="manager-page-stack">
      <section className="manager-shell-card manager-grid-bg" style={{ borderRadius: 30, padding: 28 }}>
        <Space direction="vertical" size={14} style={{ width: "100%" }}>
          <Tag
            bordered={false}
            style={{
              width: "fit-content",
              margin: 0,
              borderRadius: 999,
              paddingInline: 12,
              paddingBlock: 6,
              fontWeight: 700,
              color: "var(--manager-primary-strong)",
              background: "rgba(93, 125, 246, 0.12)",
            }}
          >
            用户管理
          </Tag>
          <div>
            <div className="manager-brand-kicker">Manual Console</div>
            <Title level={2} className="manager-display-title" style={{ margin: "14px 0 10px" }}>
              人工用户管理
            </Title>
            <Paragraph style={{ maxWidth: 760, margin: 0, color: "var(--manager-text-soft)" }}>
              迁移旧版 `UserDetailController` 的 Barry 用户详情能力，支持按渠道筛选、查看支付方式，并在控制台内直接新增或更新人工账号。
            </Paragraph>
          </div>
        </Space>
      </section>

      <section className="manager-stats-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
        {stats.map((item) => (
          <div key={item.label} className="manager-data-card">
            <div className="manager-section-label">{item.label}</div>
            <div className="manager-display-title" style={{ fontSize: 32, marginTop: 12 }}>
              {item.value}
            </div>
          </div>
        ))}
      </section>

      <section className="manager-data-card">
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "space-between" }}>
          <Space wrap size={12}>
            <Select
              allowClear
              showSearch
              optionFilterProp="label"
              className="manager-filter-input"
              placeholder="选择渠道"
              value={filters.channel}
              options={channelOptions}
              loading={channelLoading}
              onChange={(value) => setFilters((current) => ({ ...current, channel: value ?? "" }))}
              style={{ width: 200, maxWidth: "100%", height: 44 }}
            />
            <Input
              className="manager-filter-input"
              placeholder="搜索用户名、角色、邀请码或支付宝账号"
              prefix={<SearchOutlined />}
              value={filters.keyword}
              onChange={(event) => setFilters((current) => ({ ...current, keyword: event.target.value }))}
              style={{ width: 320, maxWidth: "100%", height: 44 }}
            />
            <Button type="primary" onClick={() => void loadUsers()}>
              查询
            </Button>
            <Button icon={<ReloadOutlined />} onClick={() => void loadUsers()}>
              刷新
            </Button>
          </Space>

          <Button type="primary" icon={<PlusOutlined />} onClick={openCreateModal}>
            新增人工用户
          </Button>
        </div>

        <Table
          rowKey={(record) => `${record.id || 0}-${record.username}`}
          loading={loading}
          dataSource={filteredUsers}
          columns={columns}
          pagination={{ pageSize: 10, showSizeChanger: false }}
          scroll={{ x: 1100 }}
          style={{ marginTop: 20 }}
        />
      </section>

      <Modal
        title={editingUser ? "编辑人工用户" : "新增人工用户"}
        open={modalOpen}
        onCancel={() => {
          setModalOpen(false);
          setEditingUser(null);
        }}
        onOk={() => void handleSubmit()}
        okText={editingUser ? "保存更新" : "创建用户"}
        confirmLoading={submitting}
        destroyOnHidden
      >
        <Form form={form} layout="vertical" initialValues={{ role: "" }}>
          <Form.Item name="username" label="用户名" rules={[{ required: true, message: "请输入用户名" }]}>
            <Input placeholder="请输入 Barry 用户名" disabled={Boolean(editingUser)} />
          </Form.Item>
          <Form.Item name="password" label="密码">
            <Input.Password placeholder="请输入密码" />
          </Form.Item>
          <Form.Item name="originalPassword" label="原始密码">
            <Input.Password placeholder="请输入原始密码" />
          </Form.Item>
          <Form.Item name="channel" label="渠道">
            <Select
              allowClear
              showSearch
              optionFilterProp="label"
              placeholder="请选择渠道"
              options={channelOptions}
              loading={channelLoading}
            />
          </Form.Item>
          <Form.Item name="inventCode" label="邀请码">
            <Input placeholder="请输入邀请码" />
          </Form.Item>
          <Form.Item name="alipayName" label="支付宝姓名">
            <Input placeholder="请输入支付宝实名" />
          </Form.Item>
          <Form.Item name="alipayAccount" label="支付宝账号">
            <Input placeholder="请输入支付宝账号" />
          </Form.Item>
          <Form.Item name="role" label="角色">
            <Input placeholder="请输入角色标识" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

function toFormValues(record: ManualUserRecord): UserFormValues {
  return {
    username: record.username,
    password: record.password || "",
    originalPassword: record.originalPassword || "",
    channel: record.channel || "",
    inventCode: record.inventCode || "",
    alipayName: record.alipayName || "",
    alipayAccount: record.alipayAccount || "",
    role: record.role || "",
  };
}

function formatDateTime(value?: string) {
  if (!value) {
    return "-";
  }
  return value.replace("T", " ").replace("Z", "");
}

function resolveChannelLabel(channel: string | undefined, channelNameMap: Map<string, string>) {
  if (!channel) {
    return "-";
  }
  return channelNameMap.get(channel) || channel;
}
