"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import dayjs, { type Dayjs } from "dayjs";
import {
  CreditCardOutlined,
  DatabaseOutlined,
  EditOutlined,
  EyeOutlined,
  KeyOutlined,
  PlusOutlined,
  ReloadOutlined,
  SearchOutlined,
  WalletOutlined,
} from "@ant-design/icons";
import {
  Button,
  DatePicker,
  Descriptions,
  Form,
  Input,
  InputNumber,
  Select,
  Space,
  Table,
  Tooltip,
  Typography,
} from "antd";
import { message } from "@/utils/notify";
import type { ColumnsType } from "antd/es/table";
import { WorkspaceDrawer } from "@/components/manager-shell/WorkspaceDrawer";
import { fetchManualChannels, type ManualChannelRecord } from "../../api/channel.api";
import {
  adjustManualUserPoints,
  changeManualUserPassword,
  createManualUser,
  fetchBarryAppUsers,
  fetchManualUserDetail,
  fetchManualUserPaymentMethods,
  fetchManualUserPointsSummary,
  fetchManualUsers,
  type ManualPaymentMethodRecord,
  type ManualUserPointsSummaryRecord,
  type ManualUserRecord,
  updateManualUser,
} from "../../api/user.api";

const { Text } = Typography;

/** barry 的积分是整数，10000 积分 = 1 元（见 ScoreController：100 元 = 1000000 积分）。 */
const POINTS_PER_YUAN = 10000;

/** 「查看所有账号余额」的排除用户偏好，只存在当前浏览器。 */
const EXCLUDED_POINTS_USERS_STORAGE_KEY = "phoenix_manager_manual_user_excluded_points_users_v1";

const SUMMARY_TIME_FORMAT = "YYYY-MM-DD HH:mm:ss";

interface ExcludedPointsUser {
  userId: number;
  username: string;
}

interface AdjustPointsFormValues {
  points: number;
  description: string;
}

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
  const [passwordViewDrawerOpen, setPasswordViewDrawerOpen] = useState(false);
  const [passwordViewUser, setPasswordViewUser] = useState<ManualUserRecord | null>(null);
  const [passwordViewLoading, setPasswordViewLoading] = useState(false);
  const [paymentDrawerOpen, setPaymentDrawerOpen] = useState(false);
  const [paymentUser, setPaymentUser] = useState<ManualUserRecord | null>(null);
  const [paymentMethods, setPaymentMethods] = useState<ManualPaymentMethodRecord[]>([]);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [filters, setFilters] = useState({
    channel: "",
    keyword: "",
  });
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10, total: 0 });

  // 调整积分
  const [adjustPointsForm] = Form.useForm<AdjustPointsFormValues>();
  const [adjustDrawerOpen, setAdjustDrawerOpen] = useState(false);
  const [adjustUser, setAdjustUser] = useState<ManualUserRecord | null>(null);
  const [adjustSubmitting, setAdjustSubmitting] = useState(false);
  const [adjustPointsPreview, setAdjustPointsPreview] = useState<number | null>(null);
  // 弹框打开时生成一次的会话标记。serial = 会话标记 + 实际金额，
  // 这样"同一笔重试"是幂等的，而"改了金额再提交"会被当成新的一笔。
  const adjustSessionRef = useRef<string>("");

  // 查看所有账号余额
  const [summaryDrawerOpen, setSummaryDrawerOpen] = useState(false);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const summaryRequestSeqRef = useRef(0);
  const [summary, setSummary] = useState<ManualUserPointsSummaryRecord | null>(null);
  const [summaryUpdatedTime, setSummaryUpdatedTime] = useState<Dayjs | null>(null);
  const [excludedUsers, setExcludedUsers] = useState<ExcludedPointsUser[]>([]);
  const [excludeOptions, setExcludeOptions] = useState<ExcludedPointsUser[]>([]);
  const [excludeSearching, setExcludeSearching] = useState(false);
  const excludeSearchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // 只认最后一次搜索的结果，避免先发后到的响应把下拉刷回旧关键字
  const excludeSearchSeqRef = useRef(0);

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

  // 排除用户是偏好设置，只落在当前浏览器，不写后端。
  useEffect(() => {
    setExcludedUsers(readExcludedUsers());
  }, []);

  useEffect(
    () => () => {
      if (excludeSearchTimerRef.current) {
        clearTimeout(excludeSearchTimerRef.current);
      }
    },
    [],
  );

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

  const openPasswordViewDrawer = async (record: ManualUserRecord) => {
    setPasswordViewUser(null);
    setPasswordViewDrawerOpen(true);
    setPasswordViewLoading(true);
    try {
      setPasswordViewUser(await fetchManualUserDetail(record.username));
    } catch (error) {
      message.error(error instanceof Error ? error.message : "加载用户密码失败");
      setPasswordViewDrawerOpen(false);
    } finally {
      setPasswordViewLoading(false);
    }
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

  const openAdjustPointsDrawer = (record: ManualUserRecord) => {
    setAdjustUser(record);
    setAdjustPointsPreview(null);
    adjustSessionRef.current = Date.now().toString(36);
    adjustPointsForm.resetFields();
    setAdjustDrawerOpen(true);
  };

  const closeAdjustPointsDrawer = () => {
    setAdjustDrawerOpen(false);
    setAdjustUser(null);
    setAdjustPointsPreview(null);
    adjustPointsForm.resetFields();
  };

  const handleAdjustPointsSubmit = async () => {
    if (!adjustUser) {
      return;
    }
    const values = await adjustPointsForm.validateFields();
    setAdjustSubmitting(true);
    try {
      await adjustManualUserPoints({
        userId: adjustUser.id,
        points: Number(values.points),
        description: values.description.trim(),
        serial: buildAdjustSerial(adjustUser.id, adjustSessionRef.current, Number(values.points)),
      });
      message.success("积分调整成功");
      closeAdjustPointsDrawer();
      await loadUsers(pagination.current);
    } catch (error) {
      message.error(error instanceof Error ? error.message : "积分调整失败");
    } finally {
      setAdjustSubmitting(false);
    }
  };

  const openSummaryDrawer = () => {
    setSummaryDrawerOpen(true);
    void loadSummary();
  };

  const loadSummary = async () => {
    const seq = ++summaryRequestSeqRef.current;
    setSummaryLoading(true);
    try {
      const result = await fetchManualUserPointsSummary({
        updatedTime: summaryUpdatedTime ? summaryUpdatedTime.format(SUMMARY_TIME_FORMAT) : undefined,
        excludedUserIds: excludedUsers.map((item) => item.userId).join(","),
      });
      if (seq === summaryRequestSeqRef.current) setSummary(result);
    } catch (error) {
      if (seq !== summaryRequestSeqRef.current) return;
      message.error(error instanceof Error ? error.message : "统计账号余额失败");
      setSummary(null);
    } finally {
      if (seq === summaryRequestSeqRef.current) setSummaryLoading(false);
    }
  };

  // 排除用户下拉：按用户名模糊搜索 barry app_user，防抖 300ms。
  const searchExcludeCandidates = (keyword: string) => {
    if (excludeSearchTimerRef.current) {
      clearTimeout(excludeSearchTimerRef.current);
    }
    const seq = ++excludeSearchSeqRef.current;
    setExcludeSearching(false);
    const normalized = keyword.trim();
    if (!normalized) {
      setExcludeOptions([]);
      return;
    }
    excludeSearchTimerRef.current = setTimeout(() => {
      setExcludeSearching(true);
      fetchBarryAppUsers({ username: normalized, pageIndex: 1, pageSize: 20 })
        .then((page) => {
          if (seq !== excludeSearchSeqRef.current) {
            return;
          }
          setExcludeOptions(
            (Array.isArray(page.data) ? page.data : [])
              .map((user) => ({ userId: Number(user.userId), username: user.username || String(user.userId) }))
              .filter((user) => Number.isSafeInteger(user.userId) && user.userId > 0),
          );
        })
        .catch((error: unknown) => {
          if (seq !== excludeSearchSeqRef.current) {
            return;
          }
          message.error(error instanceof Error ? error.message : "搜索用户失败");
          setExcludeOptions([]);
        })
        .finally(() => {
          if (seq === excludeSearchSeqRef.current) {
            setExcludeSearching(false);
          }
        });
    }, 300);
  };

  const changeExcludedUsers = (next: ExcludedPointsUser[]) => {
    summaryRequestSeqRef.current += 1;
    setSummaryLoading(false);
    setExcludedUsers(next);
    writeExcludedUsers(next);
    // 条件变了就先清空结果，避免旧数字配新条件被误读
    setSummary(null);
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
      title: "当前余额",
      dataIndex: "activePoints",
      width: 160,
      align: "right",
      render: (value?: number) => <PointsCell value={value} />,
    },
    {
      title: "当前冻结金额",
      dataIndex: "blockPoints",
      width: 160,
      align: "right",
      render: (value?: number) => <PointsCell value={value} />,
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
      // 五个动作带文字要占 550px 左右，表格是 table-layout: fixed，超出的按钮会直接画到固定列外面。
      // 和渠道、商品列表一致改成图标 + Tooltip：34px 按钮 × 5 + 间距 4 × 4 + 单元格左右内边距 32 = 218，
      // 列宽留到 240，缩放或主题调 controlHeight 时也不会顶破。
      width: 240,
      render: (_, record) => (
        <Space size={4} wrap={false}>
          <Tooltip title="编辑">
            <Button type="text" aria-label="编辑" icon={<EditOutlined />} onClick={() => void openEditModal(record)} />
          </Tooltip>
          <Tooltip title="查看密码">
            <Button
              type="text"
              aria-label="查看密码"
              icon={<EyeOutlined />}
              onClick={() => void openPasswordViewDrawer(record)}
            />
          </Tooltip>
          <Tooltip title="修改密码">
            <Button
              type="text"
              aria-label="修改密码"
              icon={<KeyOutlined />}
              onClick={() => openChangePasswordDrawer(record)}
            />
          </Tooltip>
          <Tooltip title="支付信息">
            <Button
              type="text"
              aria-label="支付信息"
              icon={<CreditCardOutlined />}
              onClick={() => void openPaymentDrawer(record)}
            />
          </Tooltip>
          <Tooltip title="调整积分">
            <Button
              type="text"
              aria-label="调整积分"
              icon={<WalletOutlined />}
              onClick={() => openAdjustPointsDrawer(record)}
            />
          </Tooltip>
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

          <Space>
            <Button icon={<DatabaseOutlined />} onClick={openSummaryDrawer}>
              查看所有账号余额
            </Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={openCreateModal}>
              新增人工用户
            </Button>
          </Space>
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
          // 各列宽度合计 1220，和 scroll.x 保持一致，避免列被压缩后内容溢出
          scroll={{ x: 1220 }}
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
          <Form.Item
            name="channel"
            label="渠道"
            rules={editingUser ? undefined : [{ required: true, message: "请选择渠道" }]}
          >
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
        title={passwordViewUser ? `用户密码 · ${passwordViewUser.username}` : "用户密码"}
        open={passwordViewDrawerOpen}
        cancelText="关闭"
        width={480}
        onClose={() => {
          setPasswordViewDrawerOpen(false);
          setPasswordViewUser(null);
        }}
      >
        {passwordViewLoading ? (
          <Text type="secondary">正在加载...</Text>
        ) : (
          <Form className="manager-form-skin" layout="vertical">
            <Form.Item label="密码">
              <Input.Password value={passwordViewUser?.originalPassword || ""} readOnly visibilityToggle />
            </Form.Item>
          </Form>
        )}
      </WorkspaceDrawer>

      <WorkspaceDrawer
        title={adjustUser ? `调整积分 · ${adjustUser.username}` : "调整积分"}
        open={adjustDrawerOpen}
        okText="确认调整"
        submitting={adjustSubmitting}
        width={560}
        onClose={closeAdjustPointsDrawer}
        onSubmit={handleAdjustPointsSubmit}
      >
        {adjustUser ? (
          <>
            <Descriptions size="small" column={1} style={{ marginBottom: 20 }}>
              <Descriptions.Item label="用户名">{adjustUser.username || "-"}</Descriptions.Item>
              <Descriptions.Item label="用户ID">{adjustUser.id || "-"}</Descriptions.Item>
              <Descriptions.Item label="当前余额">
                {`${formatPoints(adjustUser.activePoints)}（${formatPointsAsYuan(adjustUser.activePoints)}）`}
              </Descriptions.Item>
              <Descriptions.Item label="当前冻结金额">
                {`${formatPoints(adjustUser.blockPoints)}（${formatPointsAsYuan(adjustUser.blockPoints)}）`}
              </Descriptions.Item>
            </Descriptions>
            <Form<AdjustPointsFormValues>
              className="manager-form-skin"
              form={adjustPointsForm}
              layout="vertical"
              preserve={false}
              onValuesChange={(changed) => {
                if ("points" in changed) {
                  const next = Number(changed.points);
                  setAdjustPointsPreview(Number.isFinite(next) ? next : null);
                }
              }}
            >
              <Form.Item
                name="points"
                label="调整积分"
                extra={buildAdjustPreview(adjustPointsPreview, adjustUser.activePoints)}
                rules={[
                  { required: true, message: "请输入调整积分" },
                  {
                    validator: (_, value) => {
                      if (value === null || value === undefined || value === "") {
                        // 交给 required 规则报"请输入调整积分"，否则 Number(null) === 0 会误报"不能为 0"
                        return Promise.resolve();
                      }
                      const points = Number(value);
                      if (!Number.isFinite(points) || points === 0) {
                        return Promise.reject(new Error("调整积分不能为 0"));
                      }
                      if (!Number.isSafeInteger(points)) {
                        return Promise.reject(new Error("调整积分必须是整数"));
                      }
                      if (Number(adjustUser.activePoints || 0) + points < 0) {
                        return Promise.reject(new Error("扣减后余额不能为负"));
                      }
                      return Promise.resolve();
                    },
                  },
                ]}
              >
                <InputNumber
                  style={{ width: "100%" }}
                  precision={0}
                  step={POINTS_PER_YUAN}
                  placeholder="正数增加，负数扣减，单位：积分"
                />
              </Form.Item>
              <Form.Item
                name="description"
                label="调整原因"
                rules={[{ required: true, whitespace: true, message: "请输入调整原因" }]}
              >
                <Input.TextArea rows={3} maxLength={200} showCount placeholder="会记录到用户的积分明细里" />
              </Form.Item>
            </Form>
            <Text type="secondary">
              提交后会产生一条积分明细，并同步更新账户余额；冻结金额由提现流程维护，此处不会改动。
            </Text>
          </>
        ) : null}
      </WorkspaceDrawer>

      <WorkspaceDrawer
        title="所有账号余额"
        open={summaryDrawerOpen}
        cancelText="关闭"
        width={760}
        onClose={() => {
          summaryRequestSeqRef.current += 1;
          setSummaryLoading(false);
          setSummaryDrawerOpen(false);
        }}
      >
        <div className="manager-page-stack">
          <section className="manager-data-card manager-toolbar-panel">
            <Space direction="vertical" size={12} style={{ width: "100%" }}>
              <Space wrap size={12} align="start">
                <DatePicker
                  showTime
                  format={SUMMARY_TIME_FORMAT}
                  value={summaryUpdatedTime}
                  placeholder="更新时间 ≥（留空=全部账号）"
                  style={{ width: 260 }}
                  onChange={(value) => {
                    summaryRequestSeqRef.current += 1;
                    setSummaryLoading(false);
                    setSummaryUpdatedTime(value);
                    // 条件变了就先清空结果，避免旧数字配新条件被误读
                    setSummary(null);
                  }}
                />
                <Button type="primary" loading={summaryLoading} onClick={() => void loadSummary()}>
                  统计
                </Button>
                <Button
                  disabled={excludedUsers.length === 0}
                  onClick={() => changeExcludedUsers([])}
                >
                  清空排除
                </Button>
              </Space>
              <Text type="secondary">仅统计该时间之后有积分变动的账号（user_points 更新时间）。</Text>
              <Select<number[]>
                mode="multiple"
                allowClear
                showSearch
                filterOption={false}
                loading={excludeSearching}
                placeholder="排除哪些用户（按用户名搜索，选择结果会保存在本机）"
                style={{ width: "100%" }}
                value={excludedUsers.map((item) => item.userId)}
                options={buildExcludeOptions(excludedUsers, excludeOptions)}
                onSearch={searchExcludeCandidates}
                onChange={(userIds) => {
                  const known = new Map(
                    [...excludedUsers, ...excludeOptions].map((item) => [item.userId, item.username]),
                  );
                  changeExcludedUsers(
                    userIds.map((userId) => ({ userId, username: known.get(userId) || String(userId) })),
                  );
                }}
                onBlur={() => setExcludeOptions([])}
              />
              <Text type="secondary">{`已排除 ${excludedUsers.length} 个用户，排除偏好只保存在当前浏览器。`}</Text>
            </Space>
          </section>

          <section
            className="manager-stats-grid"
            style={{ gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}
          >
            {[
              { label: "剩余总余额（余额 + 冻结）", value: summary?.totalPoints },
              { label: "其中：可用余额", value: summary?.activePoints },
              { label: "其中：冻结余额", value: summary?.blockPoints },
            ].map((item) => (
              <div key={item.label} className="manager-data-card">
                <div className="manager-section-label">{item.label}</div>
                <div className="manager-display-title" style={{ fontSize: 28, marginTop: 12 }}>
                  {summaryLoading ? "统计中..." : summary === null ? "—" : formatPoints(item.value)}
                </div>
                <Text type="secondary">
                  {summaryLoading ? " " : summary === null ? "点击「统计」查看" : formatPointsAsYuan(item.value)}
                </Text>
              </div>
            ))}
            <div className="manager-data-card">
              <div className="manager-section-label">统计账号数</div>
              <div className="manager-display-title" style={{ fontSize: 28, marginTop: 12 }}>
                {summaryLoading ? "统计中..." : summary === null ? "—" : Number(summary.accountNum || 0).toLocaleString("zh-CN")}
              </div>
              <Text type="secondary">{summaryUpdatedTime ? "该时间之后有变动的账号" : "全部账号"}</Text>
            </div>
          </section>
        </div>
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

function formatPoints(value?: number) {
  return `${Number(value || 0).toLocaleString("zh-CN")} 积分`;
}

function formatPointsAsYuan(value?: number) {
  return `≈ ¥${(Number(value || 0) / POINTS_PER_YUAN).toFixed(2)}`;
}

function PointsCell({ value }: { value?: number }) {
  return (
    <Space direction="vertical" size={0} style={{ alignItems: "flex-end" }}>
      <Text style={{ color: "var(--manager-text)", fontWeight: 600 }}>{formatPoints(value)}</Text>
      <Text type="secondary">{formatPointsAsYuan(value)}</Text>
    </Space>
  );
}

function buildAdjustPreview(points: number | null, currentPoints?: number) {
  if (points === null || !Number.isFinite(points) || points === 0) {
    return "正数增加、负数扣减，只作用于可用余额。";
  }
  const direction = points > 0 ? "增加" : "扣减";
  const magnitude = Math.abs(points);
  const nextPoints = Number(currentPoints || 0) + points;
  return `${direction} ${magnitude.toLocaleString("zh-CN")} 积分（${formatPointsAsYuan(magnitude)}），调整后余额 ${formatPoints(nextPoints)}`;
}

/** serial 落库列是 varchar(50)，这里 base36 时间戳 + 金额，长度远小于上限。 */
function buildAdjustSerial(userId: number, session: string, points: number) {
  return `ADJ_${userId}_${session}_${points}`.slice(0, 50);
}

function buildExcludeOptions(selected: ExcludedPointsUser[], candidates: ExcludedPointsUser[]) {
  // 已选项必须始终在 options 里，否则 antd 只显示裸 userId 而不是用户名。
  const merged = new Map(candidates.map((item) => [item.userId, item.username]));
  selected.forEach((item) => merged.set(item.userId, item.username));
  return Array.from(merged.entries()).map(([userId, username]) => ({
    label: `${username}（${userId}）`,
    value: userId,
  }));
}

function readExcludedUsers(): ExcludedPointsUser[] {
  if (typeof window === "undefined") {
    return [];
  }
  try {
    const rawValue = window.localStorage.getItem(EXCLUDED_POINTS_USERS_STORAGE_KEY);
    if (!rawValue) {
      return [];
    }
    const parsed: unknown = JSON.parse(rawValue);
    if (!Array.isArray(parsed)) {
      window.localStorage.removeItem(EXCLUDED_POINTS_USERS_STORAGE_KEY);
      return [];
    }
    return parsed
      .map((item) => item as Partial<ExcludedPointsUser>)
      .filter((item): item is ExcludedPointsUser => Number.isSafeInteger(item?.userId) && Number(item?.userId) > 0)
      .map((item) => ({ userId: item.userId, username: String(item.username ?? item.userId) }));
  } catch {
    // 隐私模式、或存量数据格式变了：直接当作没有偏好
    return [];
  }
}

function writeExcludedUsers(users: ExcludedPointsUser[]) {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage.setItem(EXCLUDED_POINTS_USERS_STORAGE_KEY, JSON.stringify(users));
  } catch {
    // 忽略隐私模式下的写入失败
  }
}

function resolveChannelLabel(channel: string | undefined, channelNameMap: Map<string, string>) {
  if (!channel) {
    return "-";
  }
  return channelNameMap.get(channel) || channel;
}
