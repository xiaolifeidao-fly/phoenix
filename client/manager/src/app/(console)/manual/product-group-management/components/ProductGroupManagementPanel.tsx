"use client";

import { useEffect, useMemo, useState } from "react";
import {
  DeleteOutlined,
  EditOutlined,
  LinkOutlined,
  PlusOutlined,
  ReloadOutlined,
  SearchOutlined,
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
  fetchBridgeTypes,
} from "../api/product-group.api";
import { useBridgeConfigManagement } from "../hooks/useBridgeConfigManagement";
import { useProductGroupManagement } from "../hooks/useProductGroupManagement";

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
  const { groups, loading: groupsLoading, refresh: refreshGroups } = useProductGroupManagement();
  const [keyword, setKeyword] = useState("");
  const [selectedGroup, setSelectedGroup] = useState<ShopGroupRecord | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editingConfig, setEditingConfig] = useState<BridgeConfigRecord | null>(null);
  const [bridgeTypes, setBridgeTypes] = useState<string[]>([]);
  const {
    configs,
    loading: configsLoading,
    submitting,
    refresh: refreshConfigs,
    save,
    remove,
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
      width: 150,
      render: (_, record) => (
        <Button type="link" icon={<LinkOutlined />} onClick={() => setSelectedGroup(record)}>
          管理桥接器
        </Button>
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
      width: 246,
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
                scroll={{ x: 1560 }}
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
      <Descriptions.Item label="成功率">{record.rateOfSuccess ? `${record.rateOfSuccess}%` : "-"}</Descriptions.Item>
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
