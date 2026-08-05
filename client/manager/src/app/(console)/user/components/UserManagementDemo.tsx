"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CheckCircleOutlined,
  EditOutlined,
  FileSearchOutlined,
  LockOutlined,
  PartitionOutlined,
  PlusOutlined,
  ReloadOutlined,
  SearchOutlined,
  StopOutlined,
  TeamOutlined,
  WalletOutlined,
} from "@ant-design/icons";
import { Button, Form, Input, InputNumber, Modal, Select, Space, Table, Tag, Tooltip, Typography } from "antd";
import { message } from "@/utils/notify";
import type { ColumnsType } from "antd/es/table";
import { WorkspaceDrawer } from "@/components/manager-shell/WorkspaceDrawer";
import {
  createAccount,
  fetchRoleOptions,
  fetchTenantOptions,
  rechargeAccount,
  saveUserRoleBindings,
  saveUserTenantBindings,
  updateAccount,
  type RoleOption,
  type TenantOption,
  type UserPayload,
  type UserRecord,
} from "../api/user.api";
import { UserFormModal } from "./UserFormModal";
import { UserRechargeDetailDrawer } from "./UserRechargeDetailDrawer";
import { useUserManagement } from "../hooks/useUserManagement";

const { Text } = Typography;

type UserActionMode = "role" | "remark" | "password" | "tenant" | "recharge";

interface UserActionState {
  mode: UserActionMode;
  record: UserRecord;
}

interface UserActionFormValues {
  roleIds?: number[];
  remark?: string;
  password?: string;
  tenantIds?: number[];
  amount?: number;
  givenScale?: number;
}

const roleColors: Record<string, string> = {
  admin: "rgba(170,192,238,0.18)",
  manager: "rgba(93,125,246,0.1)",
  auditor: "rgba(201,210,236,0.2)",
  member: "rgba(239,244,251,0.98)",
};

const defaultRoleOptions = [
  { label: "管理员", value: "admin" },
  { label: "经理", value: "manager" },
  { label: "审计", value: "auditor" },
  { label: "代理", value: "member" },
];

const statusColors: Record<string, string> = {
  normal: "rgba(95,198,163,0.14)",
  frozen: "rgba(239,107,120,0.14)",
  active: "rgba(95,198,163,0.14)",
  ACTIVE: "rgba(95,198,163,0.14)",
  expire: "rgba(239,107,120,0.14)",
  EXPIRE: "rgba(239,107,120,0.14)",
  inactive: "rgba(170,192,238,0.16)",
  locked: "rgba(239,107,120,0.14)",
  disabled: "rgba(239,107,120,0.14)",
};

export function UserManagementDemo() {
  const {
    users,
    stats,
    total,
    query,
    loading,
    statsLoading,
    submitting,
    refresh,
    saveUser,
    patchUser,
  } = useUserManagement();
  const [searchValue, setSearchValue] = useState(query.search);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserRecord | null>(null);
  const [tenantOptions, setTenantOptions] = useState<TenantOption[]>([]);
  const [roleOptions, setRoleOptions] = useState<RoleOption[]>([]);
  const [actionForm] = Form.useForm<UserActionFormValues>();
  const [actionState, setActionState] = useState<UserActionState | null>(null);
  const [actionSubmitting, setActionSubmitting] = useState(false);
  const [rechargeDetailUser, setRechargeDetailUser] = useState<UserRecord | null>(null);
  const rechargeAmount = Form.useWatch("amount", actionForm);
  const rechargeGivenScale = Form.useWatch("givenScale", actionForm);

  const activeCount = users.filter((item) => resolveUserStatus(item) === "normal").length;
  const boundCount = users.filter((item) => (item.tenants?.length ?? 0) > 0 || Boolean(item.tenantName?.trim())).length;
  const totalBalance = users.reduce((sum, item) => sum + resolveBalance(item), 0);

  const heroStats = useMemo(
    () => [
      { label: "可见用户", value: stats.visibleUsers },
      { label: "活跃用户", value: stats.activeUsers || activeCount },
      { label: "已绑定账号", value: boundCount },
      { label: "钱包总额", value: formatCurrency(totalBalance) },
    ],
    [activeCount, boundCount, stats.activeUsers, stats.visibleUsers, totalBalance],
  );

  useEffect(() => {
    const loadBindingOptions = async () => {
      const [tenantResult, roleResult] = await Promise.allSettled([
        fetchTenantOptions(),
        fetchRoleOptions(),
      ]);
      setTenantOptions(tenantResult.status === "fulfilled" ? tenantResult.value.data : []);
      setRoleOptions(roleResult.status === "fulfilled" ? roleResult.value.data : []);
    };
    void loadBindingOptions();
  }, []);

  const handleCreate = () => {
    setEditingUser(null);
    setModalOpen(true);
  };

  const handleSubmit = async (payload: UserPayload) => {
    try {
      await saveUser(editingUser?.id ?? null, payload);
      message.success(editingUser ? "用户更新成功" : "用户创建成功");
      setModalOpen(false);
      setEditingUser(null);
    } catch (error) {
      message.error(error instanceof Error ? error.message : "保存用户失败");
    }
  };

  const openUserActionDrawer = (mode: UserActionMode, record: UserRecord) => {
    setActionState({ mode, record });
    actionForm.setFieldsValue({
      roleIds: resolveSelectedRoleIds(record, roleOptions),
      remark: record.remark || "",
      password: "",
      tenantIds: resolveSelectedTenantIds(record),
      amount: undefined,
      givenScale: 0,
    });
  };

  const closeUserActionDrawer = () => {
    setActionState(null);
    actionForm.resetFields();
  };

  const handleUserActionSubmit = async () => {
    if (!actionState) {
      return;
    }
    const values = await actionForm.validateFields();
    const { mode, record } = actionState;

    setActionSubmitting(true);
    try {
      if (mode === "role") {
        await saveUserRoleBindings(record.id, values.roleIds ?? []);
        await refresh();
        message.success("角色已更新");
      }
      if (mode === "remark") {
        await patchUser(record.id, { remark: values.remark || "" });
        message.success("备注已更新");
      }
      if (mode === "password") {
        const password = values.password?.trim();
        if (!password) {
          throw new Error("请输入新密码");
        }
        await patchUser(record.id, {
          password,
          originPassword: password,
        });
        message.success("密码已更新");
      }
      if (mode === "tenant") {
        await saveUserTenantBindings(record.id, values.tenantIds ?? []);
        await refresh();
        message.success("租户已更新");
      }
      if (mode === "recharge") {
        const amount = Number(values.amount ?? 0);
        if (amount <= 0) {
          throw new Error("请输入大于 0 的金额");
        }
        if (!record.accountId) {
          throw new Error("该用户尚未开通 Kakrolot 账户，无法充值");
        }
        const givenScale = Number(values.givenScale ?? 0);
        if (!Number.isInteger(givenScale) || givenScale < 0) {
          throw new Error("赠送比例必须是大于等于 0 的整数");
        }
        await rechargeAccount(record.accountId, amount, givenScale);
        await refresh();
        message.success("充值成功");
      }
      closeUserActionDrawer();
    } catch (error) {
      message.error(error instanceof Error ? error.message : "操作失败");
    } finally {
      setActionSubmitting(false);
    }
  };

  const handleToggleFreeze = (record: UserRecord) => {
    const currentStatus = resolveUserStatus(record);
    const nextStatus = currentStatus === "frozen" ? "normal" : "frozen";
    Modal.confirm({
      title: nextStatus === "frozen" ? "冻结账户" : "解冻账户",
      onOk: async () => {
        if (record.accountId) {
          await updateAccount(record.accountId, { accountStatus: nextStatus });
        } else {
          await createAccount({
            userId: record.id,
            accountStatus: nextStatus,
            balanceAmount: resolveBalance(record).toFixed(2),
          });
        }
        await refresh();
        message.success(nextStatus === "frozen" ? "已冻结" : "已解冻");
      },
    });
  };

  const columns: ColumnsType<UserRecord> = [
    {
      title: "ID",
      dataIndex: "id",
      key: "id",
      width: 80,
    },
    {
      title: "用户名",
      dataIndex: "username",
      key: "username",
      width: 160,
    },
    {
      title: "密码",
      key: "password",
      width: 140,
      render: (_, record) => record.originPassword || record.password || "-",
    },
    {
      title: "密钥",
      dataIndex: "secretKey",
      key: "secretKey",
      width: 220,
      render: (value: string) => wrapText(value),
    },
    {
      title: "备注",
      dataIndex: "remark",
      key: "remark",
      width: 140,
      render: (value: string) => value || "-",
    },
    {
      title: "租户信息",
      key: "tenantInfo",
      width: 220,
      render: (_, record) => renderTenantBindings(record),
    },
    {
      title: "角色",
      key: "role",
      width: 190,
      render: (_, record) => renderRoleBindings(record),
    },
    {
      title: "余额",
      key: "balanceAmount",
      width: 140,
      align: "right",
      render: (_, record) => {
        const balance = resolveBalance(record);
        return <Text style={{ color: "var(--manager-text)" }}>{formatNumber(balance)}</Text>;
      },
    },
    {
      title: "状态",
      key: "status",
      width: 110,
      render: (_, record) => {
        const value = resolveDisplayStatus(record);
        return (
          <Tag
            style={{
              color: "var(--manager-text)",
              background: statusColors[value] || "rgba(170,192,238,0.16)",
              border: "none",
            }}
          >
            {formatStatus(value)}
          </Tag>
        );
      },
    },
    {
      title: "操作",
      key: "actions",
      width: 320,
      fixed: "right",
      render: (_, record) => {
        const frozen = resolveUserStatus(record) === "frozen";

        return (
          <Space size={4} wrap>
            <Tooltip title="修改租户">
              <Button
                size="small"
                type="text"
                icon={<PartitionOutlined />}
                onClick={() => openUserActionDrawer("tenant", record)}
              />
            </Tooltip>
            <Tooltip title="修改角色">
              <Button
                size="small"
                type="text"
                icon={<TeamOutlined />}
                onClick={() => openUserActionDrawer("role", record)}
              />
            </Tooltip>
            <Tooltip title="修改备注">
              <Button
                size="small"
                type="text"
                icon={<EditOutlined />}
                onClick={() => openUserActionDrawer("remark", record)}
              />
            </Tooltip>
            <Tooltip title="修改密码">
              <Button
                size="small"
                type="text"
                icon={<LockOutlined />}
                onClick={() => openUserActionDrawer("password", record)}
              />
            </Tooltip>
            <Tooltip title="充值">
              <Button
                size="small"
                type="text"
                icon={<WalletOutlined />}
                onClick={() => openUserActionDrawer("recharge", record)}
              />
            </Tooltip>
            <Tooltip title="充值明细">
              <Button
                size="small"
                type="text"
                icon={<FileSearchOutlined />}
                onClick={() => setRechargeDetailUser(record)}
              />
            </Tooltip>
            <Tooltip title={frozen ? "解冻" : "冻结"}>
              <Button
                size="small"
                type="text"
                danger={!frozen}
                icon={frozen ? <CheckCircleOutlined /> : <StopOutlined />}
                onClick={() => handleToggleFreeze(record)}
              />
            </Tooltip>
          </Space>
        );
      },
    },
  ];

  return (
    <div className="manager-page-stack">
      <section
        className="manager-stats-grid"
        style={{ gridTemplateColumns: "repeat(auto-fit, minmax(150px, 150px))" }}
      >
        {heroStats.map((item) => (
          <div key={item.label} className="manager-metric-chip manager-metric-chip-compact">
            <Text style={{ color: "var(--manager-text-faint)", fontSize: 12 }}>{item.label}</Text>
            <div className="manager-value" style={{ marginTop: 4, fontSize: 22, lineHeight: 1.1 }}>
              {item.value}
            </div>
          </div>
        ))}
      </section>

      <section className="manager-data-card manager-toolbar-panel">
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 16,
            flexWrap: "wrap",
          }}
        >
          <Space wrap size={12}>
            <Input
              className="manager-filter-input"
              prefix={<SearchOutlined style={{ color: "var(--manager-text-faint)" }} />}
              placeholder="搜索姓名、账号或邮箱"
              value={searchValue}
              onChange={(event) => setSearchValue(event.target.value)}
              onPressEnter={() => void refresh({ pageIndex: 1, search: searchValue })}
              style={{ width: 280 }}
            />
            <Select
              className="manager-filter-input"
              value={query.role || undefined}
              allowClear
              placeholder="角色筛选"
              onChange={(value) => void refresh({ pageIndex: 1, role: value ?? "" })}
              style={{ width: 160 }}
              options={resolveRoleFilterOptions(roleOptions)}
            />
            <Select
              className="manager-filter-input"
              value={query.status || undefined}
              allowClear
              placeholder="状态筛选"
              onChange={(value) => void refresh({ pageIndex: 1, status: value ?? "" })}
              style={{ width: 160 }}
              options={[
                { label: "激活", value: "ACTIVE" },
                { label: "冻结", value: "EXPIRE" },
              ]}
            />
            <Button
              icon={<ReloadOutlined />}
              loading={loading || statsLoading}
              onClick={() =>
                void refresh({
                  pageIndex: 1,
                  search: searchValue,
                })
              }
            >
              刷新数据
            </Button>
          </Space>

          <Space wrap>
            <Tag style={{ color: "var(--manager-text-soft)", background: "rgba(170,192,238,0.16)", border: "none" }}>
              共 {total} 条
            </Tag>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={handleCreate}
              style={{
                color: "#ffffff",
                border: "none",
                background: "linear-gradient(135deg, #5d7df6 0%, #6d8cff 100%)",
              }}
            >
              新建用户
            </Button>
          </Space>
        </div>
      </section>

      <section className="manager-data-card manager-table">
        <Table<UserRecord>
          rowKey="id"
          scroll={{ x: 1540 }}
          loading={loading}
          dataSource={users}
          columns={columns}
          pagination={{
            current: query.pageIndex,
            pageSize: query.pageSize,
            total,
            showSizeChanger: false,
            onChange: (page) => void refresh({ pageIndex: page, search: searchValue }),
          }}
        />
      </section>

      <UserFormModal
        open={modalOpen}
        submitting={submitting}
        user={editingUser}
        onCancel={() => {
          setModalOpen(false);
          setEditingUser(null);
        }}
        onSubmit={handleSubmit}
      />

      <WorkspaceDrawer
        open={Boolean(actionState)}
        title={resolveUserActionTitle(actionState?.mode)}
        okText="保存"
        submitting={actionSubmitting}
        width={520}
        onClose={closeUserActionDrawer}
        onSubmit={handleUserActionSubmit}
      >
        {actionState ? (
          <Form<UserActionFormValues> className="manager-form-skin" form={actionForm} layout="vertical" preserve={false}>
            <div className="manager-drawer-record">
              <Text strong>{actionState.record.username || "-"}</Text>
              <Text type="secondary">{`用户ID ${actionState.record.id}`}</Text>
            </div>
            {actionState.mode === "role" ? (
              <Form.Item name="roleIds" label="角色" rules={[{ required: true, message: "请至少选择一个角色" }]}>
                <Select<number[]>
                  mode="multiple"
                  showSearch
                  optionFilterProp="label"
                  maxTagCount="responsive"
                  placeholder="请选择角色"
                  options={roleOptions.map((item) => ({
                    label: item.name || formatRole(item.code),
                    value: item.id,
                  }))}
                />
              </Form.Item>
            ) : null}
            {actionState.mode === "remark" ? (
              <Form.Item name="remark" label="备注">
                <Input.TextArea rows={5} placeholder="请输入备注" />
              </Form.Item>
            ) : null}
            {actionState.mode === "password" ? (
              <Form.Item name="password" label="新密码" rules={[{ required: true, message: "请输入新密码" }]}>
                <Input.Password placeholder="请输入新密码" />
              </Form.Item>
            ) : null}
            {actionState.mode === "tenant" ? (
              <Form.Item name="tenantIds" label="绑定租户">
                <Select<number[]>
                  mode="multiple"
                  showSearch
                  optionFilterProp="label"
                  maxTagCount="responsive"
                  placeholder="请选择租户，清空则解绑全部"
                  options={tenantOptions.map((item) => ({
                    label: item.name || item.code,
                    value: item.id,
                  }))}
                />
              </Form.Item>
            ) : null}
            {actionState.mode === "recharge" ? (
              <>
                <Form.Item name="amount" label="充值金额" rules={[{ required: true, message: "请输入充值金额" }]}>
                  <InputNumber<number>
                    min={0.01}
                    step={1}
                    precision={2}
                    placeholder="请输入充值金额"
                    style={{ width: "100%" }}
                  />
                </Form.Item>
                <Form.Item
                  name="givenScale"
                  label="赠送比例"
                  rules={[
                    { required: true, message: "请输入赠送比例" },
                    {
                      validator: (_, value) =>
                        Number.isInteger(Number(value)) && Number(value) >= 0
                          ? Promise.resolve()
                          : Promise.reject(new Error("请输入大于等于 0 的整数")),
                    },
                  ]}
                >
                  <InputNumber<number>
                    min={0}
                    step={1}
                    precision={0}
                    addonAfter="%"
                    placeholder="0"
                    style={{ width: "100%" }}
                  />
                </Form.Item>
                <div className="manager-drawer-record">
                  <Text type="secondary">赠送金额</Text>
                  <Text strong>{formatCurrency(calculateGivenAmount(rechargeAmount, rechargeGivenScale))}</Text>
                  <Text type="secondary">预计到账</Text>
                  <Text strong>{formatCurrency(calculateRechargeTotal(rechargeAmount, rechargeGivenScale))}</Text>
                </div>
              </>
            ) : null}
          </Form>
        ) : null}
      </WorkspaceDrawer>

      <UserRechargeDetailDrawer
        open={Boolean(rechargeDetailUser)}
        user={rechargeDetailUser}
        onClose={() => setRechargeDetailUser(null)}
      />
    </div>
  );
}

function resolveBalance(record: UserRecord) {
  if (typeof record.tineBalance === "number") {
    return record.tineBalance;
  }
  return Number(record.balanceAmount || 0);
}

interface UserBindingTagItem {
  key: string;
  label: string;
  background?: string;
}

function renderRoleBindings(record: UserRecord) {
  const items: UserBindingTagItem[] = record.roles?.length
    ? record.roles.map((item) => ({
        key: String(item.id || item.roleId),
        label: item.roleName || formatRole(item.roleCode),
        background: roleColors[item.roleCode],
      }))
    : record.role
      ? [{ key: `legacy-${record.role}`, label: formatRole(record.role), background: roleColors[record.role] }]
      : [];
  return <UserBindingTags items={items} />;
}

function renderTenantBindings(record: UserRecord) {
  const items: UserBindingTagItem[] = record.tenants?.length
    ? record.tenants.map((item) => ({
        key: String(item.id || item.tenantId),
        label: item.tenantName || `租户 ${item.tenantId}`,
      }))
    : record.tenantName
      ? [{ key: `legacy-${record.tenantId}`, label: record.tenantName }]
      : [];
  return <UserBindingTags items={items} />;
}

function UserBindingTags({ items }: { items: UserBindingTagItem[] }) {
  if (items.length === 0) {
    return <span>-</span>;
  }
  const visibleItems = items.slice(0, 2);
  const hiddenCount = items.length - visibleItems.length;
  return (
    <Tooltip title={items.map((item) => item.label).join("、")}>
      <div className="user-binding-tags" aria-label={items.map((item) => item.label).join("、")}>
        {visibleItems.map((item) => (
          <Tag
            key={item.key}
            className="user-binding-tag"
            style={{ background: item.background || "var(--manager-panel)", border: "none" }}
          >
            {item.label}
          </Tag>
        ))}
        {hiddenCount > 0 ? <Tag className="user-binding-tag user-binding-tag--more">+{hiddenCount}</Tag> : null}
      </div>
    </Tooltip>
  );
}

function resolveSelectedRoleIds(record: UserRecord, options: RoleOption[]) {
  if (record.roles?.length) {
    return record.roles.map((item) => item.roleId);
  }
  const legacyRole = options.find((item) => item.code === record.role);
  return legacyRole ? [legacyRole.id] : [];
}

function resolveSelectedTenantIds(record: UserRecord) {
  if (record.tenants?.length) {
    return record.tenants.map((item) => item.tenantId);
  }
  return record.tenantId ? [record.tenantId] : [];
}

function resolveRoleFilterOptions(options: RoleOption[]) {
  if (options.length === 0) {
    return defaultRoleOptions;
  }
  return options.map((item) => ({
    label: item.name || formatRole(item.code),
    value: item.code,
  }));
}

function calculateGivenAmount(amount?: number, givenScale?: number) {
  return (Number(amount) || 0) * (Number(givenScale) || 0) / 100;
}

function calculateRechargeTotal(amount?: number, givenScale?: number) {
  return (Number(amount) || 0) + calculateGivenAmount(amount, givenScale);
}

function resolveUserStatus(record: UserRecord) {
  return record.accountStatus || record.status || "normal";
}

function resolveDisplayStatus(record: UserRecord) {
  return record.status || record.accountStatus || "active";
}

function formatRole(value: string) {
  switch (value) {
    case "admin":
      return "管理员";
    case "manager":
      return "经理";
    case "auditor":
      return "审计";
    case "member":
      return "代理";
    default:
      return value || "-";
  }
}

function formatStatus(value: string) {
  switch (value) {
    case "ACTIVE":
    case "normal":
    case "active":
    case "pending":
      return "激活";
    case "expire":
    case "EXPIRE":
    case "frozen":
    case "locked":
    case "inactive":
    case "disabled":
    case "deleted":
      return "冻结";
    default:
      return value ? `未知(${value})` : "-";
  }
}

function resolveUserActionTitle(mode?: UserActionMode) {
  switch (mode) {
    case "role":
      return "修改角色";
    case "remark":
      return "修改备注";
    case "password":
      return "修改密码";
    case "tenant":
      return "修改租户";
    case "recharge":
      return "账户充值";
    default:
      return "用户操作";
  }
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("zh-CN", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 4,
  }).format(value);
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("zh-CN", {
    style: "currency",
    currency: "CNY",
    maximumFractionDigits: 2,
  }).format(value);
}

function wrapText(value?: string) {
  if (!value) {
    return "-";
  }
  return (
    <div style={{ whiteSpace: "normal", wordBreak: "break-all", color: "var(--manager-text)" }}>
      {value}
    </div>
  );
}
