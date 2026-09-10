"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ClearOutlined,
  DeleteOutlined,
  EditOutlined,
  LinkOutlined,
  PlusOutlined,
  ReloadOutlined,
  SearchOutlined,
  TeamOutlined,
} from "@ant-design/icons";
import {
  Button,
  Descriptions,
  Form,
  Input,
  InputNumber,
  Popconfirm,
  Select,
  Space,
  Switch,
  Table,
  Tag,
  Tooltip,
  Typography,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import { WorkspaceDrawer } from "@/components/manager-shell/WorkspaceDrawer";
import { message } from "@/utils/notify";
import {
  type BridgeConfigPayload,
  type BridgeConfigRecord,
  type ShopGroupRecord,
  type WhitelistGroupPayload,
  type WhitelistGroupRecord,
  fetchBridgeTypes,
} from "../api/product-group.api";
import { useBridgeConfigManagement } from "../hooks/useBridgeConfigManagement";
import { useProductGroupManagement } from "../hooks/useProductGroupManagement";
import { useWhitelistGroupManagement } from "../hooks/useWhitelistGroupManagement";

const { Text } = Typography;

const fallbackBridgeTypes = [
  "GET_ITEM",
  "GET_USER_ITEM",
  "USER_FANS",
  "GET_USER_ITEM_FROM_WEB",
  "GET_ITEM_LIST",
  "FOLLOW_LIST",
  "HS_FOLLOW_LIST",
  "GET_ITEM_LIST_FROM_WEB",
  "GET_ITEM_FROM_WEB",
  "CONVERT_UID",
  "CONVERT",
  "CONVERT_UID_BY_URL",
  "CHECK_USER",
];

interface BridgeConfigFormValues {
  alias: string;
  mapperUrl: string;
  method: string;
  header: string;
  weight: number;
  bridgeType: string;
  loadBalanceFlag: boolean;
  bodyParams: string;
  analysisName: string;
  source: string;
  contentType: string;
  fetchType: string;
  fetchAnalysis: string;
  fetchProxyUrl: string;
}

/** 服务端把这两个值当作哨兵（未分组 / 全部分组），不能被建成真实分组。 */
const RESERVED_WHITELIST_GROUP_CODES = ["UNGROUPED", "ALL"];

interface WhitelistGroupFormValues {
  code: string;
  name: string;
  sortId: number;
}

const emptyWhitelistGroupForm: WhitelistGroupFormValues = {
  code: "",
  name: "",
  sortId: 0,
};

const emptyBridgeConfigForm: BridgeConfigFormValues = {
  alias: "",
  mapperUrl: "",
  method: "GET",
  header: "",
  weight: 1,
  bridgeType: "",
  loadBalanceFlag: true,
  bodyParams: "",
  analysisName: "",
  source: "",
  contentType: "application/json",
  fetchType: "",
  fetchAnalysis: "",
  fetchProxyUrl: "",
};

export function ProductGroupManagementPanel() {
  const [bridgeForm] = Form.useForm<BridgeConfigFormValues>();
  const [whitelistGroupForm] = Form.useForm<WhitelistGroupFormValues>();
  const { groups, loading: groupsLoading, refresh: refreshGroups } = useProductGroupManagement();
  const [keyword, setKeyword] = useState("");
  const [selectedGroup, setSelectedGroup] = useState<ShopGroupRecord | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editingConfig, setEditingConfig] = useState<BridgeConfigRecord | null>(null);
  const [bridgeTypes, setBridgeTypes] = useState<string[]>([]);
  const [whitelistGroupTarget, setWhitelistGroupTarget] = useState<ShopGroupRecord | null>(null);
  const [whitelistGroupFormOpen, setWhitelistGroupFormOpen] = useState(false);
  const [editingWhitelistGroup, setEditingWhitelistGroup] = useState<WhitelistGroupRecord | null>(null);
  const {
    whitelistGroups,
    loading: whitelistGroupsLoading,
    submitting: whitelistGroupSubmitting,
    refresh: refreshWhitelistGroups,
    save: saveWhitelistGroup,
    remove: removeWhitelistGroup,
  } = useWhitelistGroupManagement(whitelistGroupTarget?.id ?? null);
  const {
    configs,
    loading: configsLoading,
    submitting,
    refresh: refreshConfigs,
    save,
    remove,
    resetStatistics,
    setActive,
  } = useBridgeConfigManagement(selectedGroup?.id ?? null);

  useEffect(() => {
    void fetchBridgeTypes().then(setBridgeTypes).catch(() => undefined);
  }, []);

  const orderedBridgeTypes = useMemo(
    () => Array.from(new Set([...bridgeTypes, ...fallbackBridgeTypes]
      .map(normalizeBridgeType)
      .filter((value) => value !== ""))),
    [bridgeTypes],
  );

  const bridgeTypeRankByValue = useMemo(
    () => new Map(orderedBridgeTypes.map((bridgeType, index) => [bridgeType, index])),
    [orderedBridgeTypes],
  );

  const bridgeTypeOptions = useMemo(
    () => Array.from(new Set([...orderedBridgeTypes, normalizeBridgeType(editingConfig?.bridgeType ?? "")]))
      .filter((value) => value !== "")
      .map((value) => ({ label: value, value })),
    [orderedBridgeTypes, editingConfig],
  );

  const filteredGroups = useMemo(() => {
    const normalized = keyword.trim().toLowerCase();
    if (!normalized) {
      return groups;
    }
    return groups.filter((group) =>
      [group.name, group.code, String(group.id)].some((value) => value.toLowerCase().includes(normalized)),
    );
  }, [groups, keyword]);

  const sortedConfigs = useMemo(
    () => [...configs].sort((left, right) => {
      const leftRank = bridgeTypeRankByValue.get(normalizeBridgeType(left.bridgeType)) ?? Number.MAX_SAFE_INTEGER;
      const rightRank = bridgeTypeRankByValue.get(normalizeBridgeType(right.bridgeType)) ?? Number.MAX_SAFE_INTEGER;
      return leftRank === rightRank ? left.id - right.id : leftRank - rightRank;
    }),
    [bridgeTypeRankByValue, configs],
  );

  const openCreateForm = () => {
    setEditingConfig(null);
    bridgeForm.setFieldsValue(emptyBridgeConfigForm);
    setFormOpen(true);
  };

  const openEditForm = (record: BridgeConfigRecord) => {
    setEditingConfig(record);
    bridgeForm.setFieldsValue({
      alias: record.alias,
      mapperUrl: record.mapperUrl,
      method: record.method || "GET",
      header: record.header,
      weight: record.weight || 1,
      bridgeType: record.bridgeType,
      loadBalanceFlag: record.loadBalanceFlag,
      bodyParams: record.bodyParams,
      analysisName: record.analysisName,
      source: record.source,
      contentType: record.contentType || "application/json",
      fetchType: record.fetchType,
      fetchAnalysis: record.fetchAnalysis,
      fetchProxyUrl: record.fetchProxyUrl,
    });
    setFormOpen(true);
  };

  const submitConfig = async () => {
    const values = await bridgeForm.validateFields();
    const payload: BridgeConfigPayload = {
      alias: values.alias.trim(),
      mapperUrl: values.mapperUrl.trim(),
      method: values.method.trim().toUpperCase(),
      header: values.header.trim(),
      weight: Number(values.weight),
      bridgeType: values.bridgeType.trim(),
      loadBalanceFlag: values.loadBalanceFlag,
      bodyParams: values.bodyParams.trim(),
      analysisName: values.analysisName.trim(),
      source: values.source.trim(),
      contentType: values.contentType.trim(),
      fetchType: values.fetchType.trim(),
      fetchAnalysis: values.fetchAnalysis.trim(),
      fetchProxyUrl: values.fetchProxyUrl.trim(),
    };
    try {
      await save(editingConfig?.id ?? null, payload);
      message.success(editingConfig ? "桥接器配置已更新" : "桥接器配置已创建");
      setFormOpen(false);
      setEditingConfig(null);
    } catch (error) {
      message.error(error instanceof Error ? error.message : "保存桥接器配置失败");
    }
  };

  const openCreateWhitelistGroupForm = () => {
    setEditingWhitelistGroup(null);
    whitelistGroupForm.setFieldsValue(emptyWhitelistGroupForm);
    setWhitelistGroupFormOpen(true);
  };

  const openEditWhitelistGroupForm = (record: WhitelistGroupRecord) => {
    setEditingWhitelistGroup(record);
    whitelistGroupForm.setFieldsValue({
      code: record.code,
      name: record.name,
      sortId: record.sortId ?? 0,
    });
    setWhitelistGroupFormOpen(true);
  };

  const submitWhitelistGroup = async () => {
    const values = await whitelistGroupForm.validateFields();
    const payload: WhitelistGroupPayload = {
      // 分配策略存的就是这个 code，统一大写去空格，避免出现只差大小写的两个"同一个"分组。
      code: values.code.trim().toUpperCase(),
      name: values.name.trim(),
      sortId: Number(values.sortId ?? 0),
    };
    try {
      await saveWhitelistGroup(editingWhitelistGroup?.id ?? null, payload);
      message.success(editingWhitelistGroup ? "白名单分组已更新" : "白名单分组已创建");
      setWhitelistGroupFormOpen(false);
      setEditingWhitelistGroup(null);
    } catch (error) {
      message.error(getErrorMessage(error, "保存白名单分组失败"));
    }
  };

  const whitelistGroupColumns: ColumnsType<WhitelistGroupRecord> = [
    { title: "ID", dataIndex: "id", width: 82 },
    {
      title: "分组编码",
      dataIndex: "code",
      width: 200,
      render: (value: string) => <span className="manager-value">{value || "-"}</span>,
    },
    {
      title: "分组名称",
      dataIndex: "name",
      render: (value: string) => <Text style={{ color: "var(--manager-text)", fontWeight: 600 }}>{value || "-"}</Text>,
    },
    { title: "排序", dataIndex: "sortId", width: 90, render: (value?: number) => value ?? 0 },
    {
      title: "更新时间",
      dataIndex: "updatedTime",
      width: 180,
      render: (value?: string) => formatDateTime(value),
    },
    {
      title: "操作",
      key: "actions",
      width: 140,
      render: (_, record) => (
        <Space size={2}>
          <Tooltip title="编辑分组">
            <Button
              type="text"
              icon={<EditOutlined />}
              onClick={() => openEditWhitelistGroupForm(record)}
              disabled={whitelistGroupSubmitting}
            />
          </Tooltip>
          <Popconfirm
            title="确认删除这个白名单分组吗？"
            description="已经放进该分组的白名单用户不会被清空，但分组下拉里不再出现这个选项。"
            okText="删除"
            cancelText="取消"
            okButtonProps={{ danger: true }}
            onConfirm={async () => {
              try {
                await removeWhitelistGroup(record.id);
                message.success("白名单分组已删除");
              } catch (error) {
                message.error(getErrorMessage(error, "删除白名单分组失败"));
              }
            }}
          >
            <Tooltip title="删除分组">
              <Button danger type="text" icon={<DeleteOutlined />} disabled={whitelistGroupSubmitting} />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const groupColumns: ColumnsType<ShopGroupRecord> = [
    { title: "分组 ID", dataIndex: "id", width: 110 },
    {
      title: "商品分组",
      dataIndex: "name",
      render: (value: string) => <Text style={{ color: "var(--manager-text)", fontWeight: 600 }}>{value || "-"}</Text>,
    },
    {
      title: "分组编码",
      dataIndex: "code",
      render: (value: string) => <span className="manager-value">{value || "-"}</span>,
    },
    {
      title: "状态",
      dataIndex: "status",
      width: 120,
      render: (status: string, record) => {
        const active = status.trim().toUpperCase() === "ACTIVE";
        return <Tag color={active ? "green" : "default"}>{active ? "可用" : record.active ? (status || "未启用") : "已删除"}</Tag>;
      },
    },
    {
      title: "更新时间",
      dataIndex: "updatedTime",
      width: 190,
      render: (value?: string) => formatDateTime(value),
    },
    {
      title: "操作",
      key: "actions",
      width: 260,
      render: (_, record) => (
        <Space size={2}>
          <Button type="link" icon={<LinkOutlined />} onClick={() => setSelectedGroup(record)}>
            管理桥接器
          </Button>
          <Button type="link" icon={<TeamOutlined />} onClick={() => setWhitelistGroupTarget(record)}>
            白名单分组
          </Button>
        </Space>
      ),
    },
  ];

  const bridgeColumns: ColumnsType<BridgeConfigRecord> = [
    { title: "ID", dataIndex: "id", width: 82 },
    {
      title: "桥接类型",
      dataIndex: "bridgeType",
      width: 150,
      render: (value: string) => <span className="manager-value">{value || "-"}</span>,
    },
    {
      title: "别名",
      dataIndex: "alias",
      width: 180,
      render: (value: string, record) => (
        <Space size={6} wrap>
          <span>{value || "-"}</span>
          {isBridgeConfigDegraded(record.mapperUrl) ? <Tag color="volcano">已降级</Tag> : null}
        </Space>
      ),
    },
    { title: "来源", dataIndex: "source", width: 130, render: (value: string) => value || "-" },
    { title: "请求方式", dataIndex: "method", width: 108, render: (value: string) => value || "-" },
    {
      title: "状态",
      dataIndex: "status",
      width: 104,
      render: (value: string) => <Tag color={isBridgeConfigActive(value) ? "green" : "default"}>{isBridgeConfigActive(value) ? "已上线" : "未上线"}</Tag>,
    },
    {
      title: "负载均衡",
      dataIndex: "loadBalanceFlag",
      width: 110,
      render: (value: boolean) => <Tag color={value ? "cyan" : "default"}>{value ? "开启" : "关闭"}</Tag>,
    },
    { title: "权重", dataIndex: "weight", width: 90, render: (value: number) => value || "-" },
    {
      title: "接口地址",
      dataIndex: "mapperUrl",
      width: 320,
      ellipsis: true,
      render: (value: string) => <Tooltip title={value}><span className="manager-value">{value || "-"}</span></Tooltip>,
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
      width: 294,
      render: (_, record) => {
        const active = isBridgeConfigActive(record.status);
        const degraded = isBridgeConfigDegraded(record.mapperUrl);
        return (
          <Space size={2}>
            <Tooltip title="编辑配置">
              <Button type="text" icon={<EditOutlined />} onClick={() => openEditForm(record)} disabled={submitting} />
            </Tooltip>
            <Popconfirm
              title={`确认${degraded ? "恢复" : "降级"}这个桥接器配置吗？`}
              okText="确认"
              cancelText="取消"
              onConfirm={async () => {
                try {
                  await save(record.id, toBridgeConfigPayload(record, setBridgeConfigDegraded(record.mapperUrl, !degraded)));
                  message.success(degraded ? "桥接器配置已恢复" : "桥接器配置已降级");
                } catch (error) {
                  message.error(error instanceof Error ? error.message : "更新桥接器降级状态失败");
                }
              }}
            >
              <Button type="link" danger={!degraded} disabled={submitting}>{degraded ? "恢复" : "降级"}</Button>
            </Popconfirm>
            <Popconfirm
              title={`确认${active ? "下线" : "上线"}这个桥接器配置吗？`}
              okText="确认"
              cancelText="取消"
              onConfirm={async () => {
                try {
                  await setActive(record.id, !active);
                  message.success(active ? "桥接器配置已下线" : "桥接器配置已上线");
                } catch (error) {
                  message.error(error instanceof Error ? error.message : "更新桥接器状态失败");
                }
              }}
            >
              <Button type="link" danger={active} disabled={submitting}>{active ? "下线" : "上线"}</Button>
            </Popconfirm>
            <Popconfirm
              title="确认重置桥接器统计吗？"
              description="将清空桥接器配置中的实时数量，以及今天的成功、失败等统计数据。"
              okText="重置"
              cancelText="取消"
              okButtonProps={{ danger: true }}
              onConfirm={async () => {
                try {
                  await resetStatistics(record.id);
                  message.success("桥接器当天统计已重置");
                } catch (error) {
                  message.error(error instanceof Error ? error.message : "重置桥接器统计失败");
                }
              }}
            >
              <Tooltip title="重置当天统计">
                <Button type="text" danger icon={<ClearOutlined />} disabled={submitting} />
              </Tooltip>
            </Popconfirm>
            <Popconfirm
              title="确认删除这个桥接器配置吗？"
              description="删除后不可恢复。"
              okText="删除"
              cancelText="取消"
              onConfirm={async () => {
                try {
                  await remove(record.id);
                  message.success("桥接器配置已删除");
                } catch (error) {
                  message.error(error instanceof Error ? error.message : "删除桥接器配置失败");
                }
              }}
            >
              <Tooltip title="删除配置">
                <Button danger type="text" icon={<DeleteOutlined />} disabled={submitting} />
              </Tooltip>
            </Popconfirm>
          </Space>
        );
      },
    },
  ];

  return (
    <div className="manager-page-stack">
      <section className="manager-stats-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
        <div className="manager-data-card">
          <div className="manager-section-label">商品分组</div>
          <div className="manager-display-title" style={{ fontSize: 32, marginTop: 12 }}>{groups.length}</div>
        </div>
        <div className="manager-data-card">
          <div className="manager-section-label">当前筛选</div>
          <div className="manager-display-title" style={{ fontSize: 32, marginTop: 12 }}>{filteredGroups.length}</div>
        </div>
      </section>

      <section className="manager-data-card manager-toolbar-panel">
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "space-between" }}>
          <Space wrap size={12}>
            <Input
              className="manager-filter-input"
              placeholder="搜索分组名称、编码或 ID"
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
              onPressEnter={() => setKeyword((value) => value.trim())}
              style={{ width: 300, maxWidth: "100%", height: 44 }}
              prefix={<SearchOutlined />}
            />
            <Button
              icon={<ReloadOutlined />}
              onClick={() => void refreshGroups().catch((error: unknown) => message.error(getErrorMessage(error, "刷新商品分组失败")))}
            >
              刷新
            </Button>
          </Space>
          <Tag style={{ color: "var(--manager-text-soft)", background: "rgba(170,192,238,0.16)", border: "none" }}>
            数据来自 Barry
          </Tag>
        </div>
      </section>

      <section className="manager-data-card manager-table">
        <Table<ShopGroupRecord>
          rowKey="id"
          loading={groupsLoading}
          dataSource={filteredGroups}
          columns={groupColumns}
          pagination={false}
          scroll={{ x: 900 }}
        />
      </section>

      <WorkspaceDrawer
        title={
          whitelistGroupTarget
            ? `白名单分组 · ${whitelistGroupTarget.name || whitelistGroupTarget.code || whitelistGroupTarget.id}`
            : "白名单分组"
        }
        open={whitelistGroupTarget !== null}
        width={860}
        cancelText="关闭"
        onClose={() => {
          setWhitelistGroupTarget(null);
          setWhitelistGroupFormOpen(false);
          setEditingWhitelistGroup(null);
        }}
      >
        {whitelistGroupTarget ? (
          <div className="manager-page-stack">
            <section className="manager-data-card" style={{ padding: "16px 20px" }}>
              <Descriptions size="small" column={{ xs: 1, sm: 2, lg: 4 }}>
                <Descriptions.Item label="商品分组">{whitelistGroupTarget.name || "-"}</Descriptions.Item>
                <Descriptions.Item label="分组编码">
                  <span className="manager-value">{whitelistGroupTarget.code || "-"}</span>
                </Descriptions.Item>
                <Descriptions.Item label="分组 ID">{whitelistGroupTarget.id}</Descriptions.Item>
                <Descriptions.Item label="白名单分组数">{whitelistGroups.length}</Descriptions.Item>
              </Descriptions>
            </section>

            <section className="manager-data-card manager-toolbar-panel">
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "space-between" }}>
                <Text style={{ color: "var(--manager-text-soft)" }}>
                  这里维护的分组会成为「人工商品 · 分配策略 · 白名单维度」的分组候选项。白名单里存的是分组编码，改名不影响已配置数据。
                </Text>
                <Space>
                  <Button
                    icon={<ReloadOutlined />}
                    onClick={() =>
                      void refreshWhitelistGroups().catch((error: unknown) =>
                        message.error(getErrorMessage(error, "刷新白名单分组失败")),
                      )
                    }
                  >
                    刷新
                  </Button>
                  <Button
                    type="primary"
                    icon={<PlusOutlined />}
                    onClick={openCreateWhitelistGroupForm}
                    disabled={whitelistGroupSubmitting}
                  >
                    新建白名单分组
                  </Button>
                </Space>
              </div>
            </section>

            <section className="manager-data-card manager-table">
              <Table<WhitelistGroupRecord>
                rowKey="id"
                loading={whitelistGroupsLoading}
                dataSource={whitelistGroups}
                columns={whitelistGroupColumns}
                pagination={false}
                scroll={{ x: 900 }}
              />
            </section>
          </div>
        ) : null}
      </WorkspaceDrawer>

      <WorkspaceDrawer
        title={editingWhitelistGroup ? "编辑白名单分组" : "新建白名单分组"}
        open={whitelistGroupFormOpen}
        width={520}
        submitting={whitelistGroupSubmitting}
        okText={editingWhitelistGroup ? "保存分组" : "创建分组"}
        onClose={() => {
          setWhitelistGroupFormOpen(false);
          setEditingWhitelistGroup(null);
        }}
        onSubmit={submitWhitelistGroup}
      >
        <Form<WhitelistGroupFormValues>
          className="manager-form-skin"
          form={whitelistGroupForm}
          layout="vertical"
          preserve={false}
        >
          <Form.Item
            name="code"
            label="分组编码"
            extra={
              editingWhitelistGroup
                ? "白名单存的就是这个编码，创建后不可修改；需要改口径请新建一个分组。"
                : "白名单实际存储的值，创建后不可修改，请谨慎填写。"
            }
            rules={[
              { required: true, message: "请输入分组编码" },
              {
                pattern: /^[A-Za-z0-9_]+$/,
                message: "只能使用字母、数字和下划线",
              },
              {
                validator: (_, value?: string) =>
                  RESERVED_WHITELIST_GROUP_CODES.includes((value || "").trim().toUpperCase())
                    ? Promise.reject(new Error(`${(value || "").trim().toUpperCase()} 是系统保留编码，请换一个`))
                    : Promise.resolve(),
              },
            ]}
          >
            <Input maxLength={64} placeholder="例如：BIG_CUSTOMER" disabled={Boolean(editingWhitelistGroup)} />
          </Form.Item>
          <Form.Item name="name" label="分组名称" rules={[{ required: true, whitespace: true, message: "请输入分组名称" }]}>
            <Input maxLength={64} placeholder="例如：大户" />
          </Form.Item>
          <Form.Item name="sortId" label="排序" extra="数字越小越靠前，用于分组下拉的展示顺序。">
            <InputNumber min={0} precision={0} style={{ width: "100%" }} />
          </Form.Item>
        </Form>
      </WorkspaceDrawer>

      <WorkspaceDrawer
        title={selectedGroup ? `桥接器配置 · ${selectedGroup.name || selectedGroup.code || selectedGroup.id}` : "桥接器配置"}
        open={selectedGroup !== null}
        width={1260}
        cancelText="关闭"
        onClose={() => {
          setSelectedGroup(null);
          setFormOpen(false);
          setEditingConfig(null);
        }}
      >
        {selectedGroup ? (
          <div className="manager-page-stack">
            <section className="manager-data-card" style={{ padding: "16px 20px" }}>
              <Descriptions size="small" column={{ xs: 1, sm: 2, lg: 4 }}>
                <Descriptions.Item label="商品分组">{selectedGroup.name || "-"}</Descriptions.Item>
                <Descriptions.Item label="分组编码"><span className="manager-value">{selectedGroup.code || "-"}</span></Descriptions.Item>
                <Descriptions.Item label="分组 ID">{selectedGroup.id}</Descriptions.Item>
                <Descriptions.Item label="桥接器配置数">{configs.length}</Descriptions.Item>
              </Descriptions>
            </section>

            <section className="manager-data-card manager-toolbar-panel">
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "space-between" }}>
                <Text style={{ color: "var(--manager-text-soft)" }}>配置归属由 Barry 根据商品分组自动确定。</Text>
                <Space>
                  <Button
                    icon={<ReloadOutlined />}
                    onClick={() => void refreshConfigs().catch((error: unknown) => message.error(getErrorMessage(error, "刷新桥接器配置失败")))}
                  >
                    刷新
                  </Button>
                  <Button type="primary" icon={<PlusOutlined />} onClick={openCreateForm} disabled={submitting}>
                    新建桥接器配置
                  </Button>
                </Space>
              </div>
            </section>

            <section className="manager-data-card manager-table">
              <Table<BridgeConfigRecord>
                rowKey="id"
                loading={configsLoading}
                dataSource={sortedConfigs}
                columns={bridgeColumns}
                pagination={false}
                scroll={{ x: 1610 }}
                expandable={{
                  expandedRowRender: (record) => <BridgeConfigDetails record={record} />,
                  rowExpandable: (record) => record.id > 0,
                }}
              />
            </section>
          </div>
        ) : null}
      </WorkspaceDrawer>

      <WorkspaceDrawer
        title={editingConfig ? "编辑桥接器配置" : "新建桥接器配置"}
        open={formOpen}
        width={680}
        submitting={submitting}
        okText={editingConfig ? "保存配置" : "创建配置"}
        onClose={() => {
          setFormOpen(false);
          setEditingConfig(null);
        }}
        onSubmit={submitConfig}
      >
        <Form<BridgeConfigFormValues> className="manager-form-skin" form={bridgeForm} layout="vertical" preserve={false}>
          <Form.Item name="alias" label="别名">
            <Input placeholder="用于识别该桥接器配置" />
          </Form.Item>
          <Form.Item name="mapperUrl" label="接口地址" rules={[{ required: true, message: "请输入桥接器接口地址" }]}>
            <Input placeholder="https://example.com/api" />
          </Form.Item>
          <Space size={12} style={{ display: "flex" }} align="start">
            <Form.Item name="method" label="请求方式" rules={[{ required: true, message: "请选择请求方式" }]} style={{ flex: 1 }}>
              <Select options={["GET", "POST", "PUT", "DELETE"].map((value) => ({ label: value, value }))} />
            </Form.Item>
            <Form.Item name="bridgeType" label="桥接类型" rules={[{ required: true, message: "请选择桥接类型" }]} style={{ flex: 1 }}>
              <Select
                showSearch
                optionFilterProp="label"
                placeholder="请选择桥接类型"
                options={bridgeTypeOptions}
              />
            </Form.Item>
          </Space>
          <Space size={12} style={{ display: "flex" }} align="start">
            <Form.Item name="source" label="来源" style={{ flex: 1 }}>
              <Input placeholder="例如：supplier-a" />
            </Form.Item>
            <Form.Item name="contentType" label="内容类型" style={{ flex: 1 }}>
              <Input placeholder="application/json" />
            </Form.Item>
          </Space>
          <Space size={12} style={{ display: "flex" }} align="start">
            <Form.Item name="weight" label="负载权重" rules={[{ required: true, message: "请输入负载权重" }]} style={{ flex: 1 }}>
              <InputNumber min={0.01} step={0.1} style={{ width: "100%" }} />
            </Form.Item>
            <Form.Item name="loadBalanceFlag" label="加入负载均衡" valuePropName="checked" style={{ flex: 1 }}>
              <Switch checkedChildren="开启" unCheckedChildren="关闭" />
            </Form.Item>
          </Space>
          <Form.Item name="header" label="请求头">
            <Input.TextArea rows={3} placeholder='JSON，例如：{"Authorization":"Bearer ..."}' />
          </Form.Item>
          <Form.Item name="bodyParams" label="请求参数">
            <Input.TextArea rows={3} placeholder='JSON，例如：{"uid":"${uid}"}' />
          </Form.Item>
          <Form.Item name="analysisName" label="解析器名称">
            <Input placeholder="Barry 中注册的响应解析器" />
          </Form.Item>
          <Space size={12} style={{ display: "flex" }} align="start">
            <Form.Item name="fetchType" label="拉取类型" style={{ flex: 1 }}>
              <Input />
            </Form.Item>
            <Form.Item name="fetchAnalysis" label="拉取解析方式" style={{ flex: 1 }}>
              <Input />
            </Form.Item>
          </Space>
          <Form.Item name="fetchProxyUrl" label="拉取代理地址">
            <Input placeholder="可选" />
          </Form.Item>
        </Form>
      </WorkspaceDrawer>
    </div>
  );
}

function BridgeConfigDetails({ record }: { record: BridgeConfigRecord }) {
  return (
    <Descriptions size="small" bordered column={{ xs: 1, lg: 2 }}>
      <Descriptions.Item label="Bridge 分类 ID">{record.bridgeCategoryId || "-"}</Descriptions.Item>
      <Descriptions.Item label="成功率">{formatBridgeConfigRate(record.rateOfSuccess)}</Descriptions.Item>
      <Descriptions.Item label="成功次数">{record.successNum || 0}</Descriptions.Item>
      <Descriptions.Item label="错误次数">{record.errorNum || 0}</Descriptions.Item>
      <Descriptions.Item label="删除 / 无数据次数">{`${record.deleteNum || 0} / ${record.notGetDataNum || 0}`}</Descriptions.Item>
      <Descriptions.Item label="创建时间">{formatDateTime(record.createdTime)}</Descriptions.Item>
      <Descriptions.Item label="请求头" span={2}><JsonValue value={record.header} /></Descriptions.Item>
      <Descriptions.Item label="请求参数" span={2}><JsonValue value={record.bodyParams} /></Descriptions.Item>
      <Descriptions.Item label="解析器名称">{record.analysisName || "-"}</Descriptions.Item>
      <Descriptions.Item label="拉取类型">{record.fetchType || "-"}</Descriptions.Item>
      <Descriptions.Item label="拉取解析方式">{record.fetchAnalysis || "-"}</Descriptions.Item>
      <Descriptions.Item label="拉取代理地址">{record.fetchProxyUrl || "-"}</Descriptions.Item>
    </Descriptions>
  );
}

function formatBridgeConfigRate(value: number) {
  const rate = Number(value);
  return Number.isFinite(rate) && rate >= 0 ? `${(rate * 100).toFixed(2).replace(/\.00$/, "")}%` : "-";
}

function JsonValue({ value }: { value: string }) {
  return value ? <span style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }} className="manager-value">{value}</span> : "-";
}

function isBridgeConfigActive(status: string) {
  return status.trim().toUpperCase() === "ACTIVE";
}

function normalizeBridgeType(bridgeType: string) {
  return bridgeType.trim().toUpperCase();
}

function isBridgeConfigDegraded(mapperUrl: string) {
  const { query } = splitMapperUrl(mapperUrl);
  if (query === "") {
    return false;
  }
  return query.split("&").some(isDegradeParameter);
}

function setBridgeConfigDegraded(mapperUrl: string, degraded: boolean) {
  const { path, query, fragment } = splitMapperUrl(mapperUrl);
  const parameters: string[] = [];
  for (const parameter of query.split("&")) {
    if (parameter === "") {
      continue;
    }
    if (isDegradeParameter(parameter)) {
      restoreTemplateFromLegacyDegradeParameter(parameters, parameter);
      continue;
    }
    parameters.push(parameter);
  }

  if (degraded) {
    parameters.push("degrade=true");
  }

  return `${path}${parameters.length > 0 ? `?${parameters.join("&")}` : ""}${fragment}`;
}

function splitMapperUrl(mapperUrl: string) {
  // Barry mapper URLs can contain template variables such as #{businessId}.
  // Only a # that is not the start of a template variable denotes a URL fragment.
  const fragmentStart = mapperUrl.search(/#(?!\{)/);
  const urlWithoutFragment = fragmentStart >= 0 ? mapperUrl.slice(0, fragmentStart) : mapperUrl;
  const fragment = fragmentStart >= 0 ? mapperUrl.slice(fragmentStart) : "";
  const queryStart = urlWithoutFragment.indexOf("?");
  return {
    path: queryStart >= 0 ? urlWithoutFragment.slice(0, queryStart) : urlWithoutFragment,
    query: queryStart >= 0 ? urlWithoutFragment.slice(queryStart + 1) : "",
    fragment,
  };
}

function isDegradeParameter(parameter: string) {
  const [key, value = ""] = parameter.split("=", 2);
  const normalizedValue = value.trim();
  return key.trim().toLowerCase() === "degrade"
    && (normalizedValue.toLowerCase() === "true" || /^true#\{[^}]+\}$/i.test(normalizedValue));
}

// Restore an address previously affected by the old implementation, which
// interpreted #{placeholder} as a URL fragment and moved it after degrade=true.
function restoreTemplateFromLegacyDegradeParameter(parameters: string[], parameter: string) {
  const [, value = ""] = parameter.split("=", 2);
  const matched = value.trim().match(/^true(#\{[^}]+\})$/i);
  if (!matched || parameters.length === 0) {
    return;
  }
  const previousIndex = parameters.length - 1;
  if (parameters[previousIndex].endsWith("=")) {
    parameters[previousIndex] += matched[1];
  }
}

function toBridgeConfigPayload(record: BridgeConfigRecord, mapperUrl: string): BridgeConfigPayload {
  return {
    alias: record.alias,
    mapperUrl,
    method: record.method,
    header: record.header,
    weight: record.weight,
    bridgeType: record.bridgeType,
    loadBalanceFlag: record.loadBalanceFlag,
    bodyParams: record.bodyParams,
    analysisName: record.analysisName,
    source: record.source,
    contentType: record.contentType,
    fetchType: record.fetchType,
    fetchAnalysis: record.fetchAnalysis,
    fetchProxyUrl: record.fetchProxyUrl,
  };
}

function formatDateTime(value?: string) {
  if (!value) {
    return "-";
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return parsed.toLocaleString("zh-CN", { hour12: false });
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}
