"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CreditCardOutlined,
  EditOutlined,
  KeyOutlined,
  PlusOutlined,
  ReloadOutlined,
  SearchOutlined,
} from "@ant-design/icons";
import { Button, Form, Input, Select, Space, Table, Typography } from "antd";
import { message } from "@/utils/notify";
import type { ColumnsType } from "antd/es/table";
import { WorkspaceDrawer } from "@/components/manager-shell/WorkspaceDrawer";
import { fetchManualChannels, type ManualChannelRecord } from "../../api/channel.api";
import {
  changeManualUserPassword,
  createManualUser,
  fetchManualUserDetail,
  fetchManualUserPaymentMethods,
  fetchManualUsers,
  type ManualPaymentMethodRecord,
  type ManualUserRecord,
  updateManualUser,
} from "../../api/user.api";

const { Text } = Typography;

interface UserFormValues {
  username: string;
  password?: string;
  channel?: string;
  inventCode?: string;
  alipayName?: string;
  alipayAccount?: string;
  role?: string;
}

interface PasswordFormValues {
  password: string;
  confirmPassword: string;
}

export function ManualUserManagementPanel() {
  const [form] = Form.useForm<UserFormValues>();
  const [passwordForm] = Form.useForm<PasswordFormValues>();
  const [users, setUsers] = useState<ManualUserRecord[]>([]);
  const [channels, setChannels] = useState<ManualChannelRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [channelLoading, setChannelLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<ManualUserRecord | null>(null);
  const [passwordDrawerOpen, setPasswordDrawerOpen] = useState(false);
  const [passwordUser, setPasswordUser] = useState<ManualUserRecord | null>(null);
  const [passwordSubmitting, setPasswordSubmitting] = useState(false);
  const [paymentDrawerOpen, setPaymentDrawerOpen] = useState(false);
  const [paymentUser, setPaymentUser] = useState<ManualUserRecord | null>(null);
  const [paymentMethods, setPaymentMethods] = useState<ManualPaymentMethodRecord[]>([]);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [filters, setFilters] = useState({
    channel: "",
    keyword: "",
  });
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10, total: 0 });

  const loadUsers = async (pageIndex = pagination.current, pageSize = pagination.pageSize) => {
    setLoading(true);
    try {
      const result = await fetchManualUsers({
        channel: filters.channel.trim() || undefined,
        username: filters.keyword.trim() || undefined,
        pageIndex,
        pageSize,
      });
      setUsers(result.data);
      setPagination((current) => ({ ...current, current: pageIndex, pageSize, total: result.total }));
    } catch (error) {
      message.error(error instanceof Error ? error.message : "加载人工用户失败");
      setUsers([]);
      setPagination((current) => ({ ...current, total: 0 }));
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
      { label: "人工用户总数", value: pagination.total },
      { label: "当前页数量", value: users.length },
    ],
    [pagination.total, users],
  );

  const openCreateModal = () => {
    setEditingUser(null);
    form.setFieldsValue({
      username: "",
      password: "",
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
    const payload = {
      username: values.username.trim(),
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
        await createManualUser({ ...payload, password: values.password!.trim() });
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

  const openChangePasswordDrawer = (record: ManualUserRecord) => {
    setPasswordUser(record);
    passwordForm.resetFields();
    setPasswordDrawerOpen(true);
  };

  const handlePasswordSubmit = async () => {
    if (!passwordUser) {
      return;
    }
    const values = await passwordForm.validateFields();
    setPasswordSubmitting(true);
    try {
      await changeManualUserPassword({
        username: passwordUser.username,
        password: values.password.trim(),
      });
      message.success("密码已修改");
      setPasswordDrawerOpen(false);
      setPasswordUser(null);
      passwordForm.resetFields();
    } catch (error) {
      message.error(error instanceof Error ? error.message : "修改密码失败");
    } finally {
      setPasswordSubmitting(false);
    }
  };

  const openPaymentDrawer = async (record: ManualUserRecord) => {
    setPaymentUser(record);
    setPaymentMethods([]);
    setPaymentDrawerOpen(true);
    setPaymentLoading(true);
    try {
      const result = await fetchManualUserPaymentMethods({
        username: record.username,
        channel: record.channel || undefined,
      });
      setPaymentMethods(result);
    } catch (error) {
      message.error(error instanceof Error ? error.message : "加载支付信息失败");
    } finally {
      setPaymentLoading(false);
    }
  };

  const paymentColumns: ColumnsType<ManualPaymentMethodRecord> = [
    {
      title: "类型",
      dataIndex: "type",
      width: 120,
      render: (value?: string) => value || "-",
    },
    {
      title: "名称",
      dataIndex: "name",
      width: 160,
      render: (value?: string) => value || "-",
    },
    {
      title: "账号",
      dataIndex: "account",
      render: (value?: string) => value || "-",
    },
  ];

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
      title: "用户ID",
      dataIndex: "id",
      width: 120,
      render: (value: number) => value || "-",
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
      title: "更新时间",
      dataIndex: "updatedTime",
      width: 180,
      render: (value?: string) => formatDateTime(value),
    },
    {
      title: "操作",
      key: "actions",
      fixed: "right",
      width: 260,
      render: (_, record) => (
        <Space size={4}>
          <Button type="text" icon={<EditOutlined />} onClick={() => void openEditModal(record)}>
            编辑
          </Button>
          <Button type="text" icon={<KeyOutlined />} onClick={() => openChangePasswordDrawer(record)}>
            修改密码
          </Button>
          <Button type="text" icon={<CreditCardOutlined />} onClick={() => void openPaymentDrawer(record)}>
            支付信息
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <div className="manager-page-stack">
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

      <section className="manager-data-card manager-toolbar-panel">
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
              placeholder="搜索用户名、角色或邀请码"
              prefix={<SearchOutlined />}
              value={filters.keyword}
              onChange={(event) => setFilters((current) => ({ ...current, keyword: event.target.value }))}
              style={{ width: 320, maxWidth: "100%", height: 44 }}
            />
            <Button type="primary" onClick={() => void loadUsers(1)}>
              查询
            </Button>
            <Button icon={<ReloadOutlined />} onClick={() => void loadUsers(1)}>
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
          dataSource={users}
          columns={columns}
          pagination={{
            current: pagination.current,
            pageSize: pagination.pageSize,
            total: pagination.total,
            showSizeChanger: false,
            onChange: (page, pageSize) => void loadUsers(page, pageSize),
          }}
          scroll={{ x: 920 }}
          style={{ marginTop: 20 }}
        />
      </section>

      <WorkspaceDrawer
        title={editingUser ? "编辑人工用户" : "新增人工用户"}
        open={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditingUser(null);
        }}
        okText={editingUser ? "保存更新" : "创建用户"}
        submitting={submitting}
        width={600}
        onSubmit={handleSubmit}
      >
        <Form className="manager-form-skin" form={form} layout="vertical" initialValues={{ role: "" }} preserve={false}>
          <Form.Item name="username" label="用户名" rules={[{ required: true, message: "请输入用户名" }]}>
            <Input placeholder="请输入 Barry 用户名" disabled={Boolean(editingUser)} />
          </Form.Item>
          {!editingUser && (
            <Form.Item name="password" label="密码" rules={[{ required: true, message: "请输入密码" }]}>
              <Input.Password placeholder="请输入密码" />
            </Form.Item>
          )}
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
      </WorkspaceDrawer>

      <WorkspaceDrawer
        title={passwordUser ? `修改密码 · ${passwordUser.username}` : "修改密码"}
        open={passwordDrawerOpen}
        onClose={() => {
          setPasswordDrawerOpen(false);
          setPasswordUser(null);
          passwordForm.resetFields();
        }}
        okText="确认修改"
        submitting={passwordSubmitting}
        width={480}
        onSubmit={handlePasswordSubmit}
      >
        <Form className="manager-form-skin" form={passwordForm} layout="vertical" preserve={false}>
          <Form.Item name="password" label="新密码" rules={[{ required: true, message: "请输入新密码" }]}>
            <Input.Password placeholder="请输入新密码" autoComplete="new-password" />
          </Form.Item>
          <Form.Item
            name="confirmPassword"
            label="确认新密码"
            dependencies={["password"]}
            rules={[
              { required: true, message: "请再次输入新密码" },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  return !value || getFieldValue("password") === value
                    ? Promise.resolve()
                    : Promise.reject(new Error("两次输入的密码不一致"));
                },
              }),
            ]}
          >
            <Input.Password placeholder="请再次输入新密码" autoComplete="new-password" />
          </Form.Item>
        </Form>
      </WorkspaceDrawer>

      <WorkspaceDrawer
        title={paymentUser ? `支付信息 · ${paymentUser.username}` : "支付信息"}
        open={paymentDrawerOpen}
        cancelText="关闭"
        width={620}
        onClose={() => {
          setPaymentDrawerOpen(false);
          setPaymentUser(null);
          setPaymentMethods([]);
        }}
      >
        <Table<ManualPaymentMethodRecord>
          rowKey={(record) => `${record.id || 0}-${record.type}-${record.account}`}
          loading={paymentLoading}
          dataSource={paymentMethods}
          columns={paymentColumns}
          pagination={false}
        />
      </WorkspaceDrawer>
    </div>
  );
}

function toFormValues(record: ManualUserRecord): UserFormValues {
  return {
    username: record.username,
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
