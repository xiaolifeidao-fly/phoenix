"use client";

import { useEffect, useMemo, useState } from "react";
import {
  EditOutlined,
  PlusOutlined,
  ReloadOutlined,
  SearchOutlined,
} from "@ant-design/icons";
import { Button, Form, Input, InputNumber, Select, Space, Switch, Table, Tag, Tooltip, Typography, message } from "antd";
import type { ColumnsType } from "antd/es/table";
import { WorkspaceDrawer } from "@/components/manager-shell/WorkspaceDrawer";
import {
  createManualChannel,
  fetchManualChannels,
  type ManualChannelPayload,
  type ManualChannelRecord,
  updateManualChannel,
} from "../../api/channel.api";

const { Text } = Typography;

interface ChannelFormValues {
  code: string;
  name: string;
  type: string;
  retailerCommissionScale?: number | null;
  merchantCommissionScale?: number | null;
  allowAssign: boolean;
  assignLimit?: number | null;
  remark?: string;
}

const channelTypeOptions = [
  { label: "工作室", value: "MERCHANT" },
  { label: "散户", value: "RETAILER" },
];

export function ManualChannelManagementPanel() {
  const [form] = Form.useForm<ChannelFormValues>();
  const [channels, setChannels] = useState<ManualChannelRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingChannel, setEditingChannel] = useState<ManualChannelRecord | null>(null);
  const [filters, setFilters] = useState({
    keyword: "",
    type: "",
    allowAssign: "all",
  });

  const loadChannels = async () => {
    setLoading(true);
    try {
      const result = await fetchManualChannels();
      setChannels(result);
    } catch (error) {
      message.error(error instanceof Error ? error.message : "加载人工渠道失败");
      setChannels([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadChannels();
  }, []);

  const filteredChannels = useMemo(() => {
    const keyword = filters.keyword.trim().toLowerCase();
    return channels.filter((item) => {
      const matchKeyword =
        !keyword ||
        item.name.toLowerCase().includes(keyword) ||
        item.code.toLowerCase().includes(keyword) ||
        (item.remark || "").toLowerCase().includes(keyword);
      const matchType = !filters.type || item.type === filters.type;
      const matchAllowAssign =
        filters.allowAssign === "all" ||
        String(Boolean(item.allowAssign)) === filters.allowAssign;
      return matchKeyword && matchType && matchAllowAssign;
    });
  }, [channels, filters]);

  const openCreateModal = () => {
    setEditingChannel(null);
    form.setFieldsValue({
      code: "",
      name: "",
      type: "MERCHANT",
      retailerCommissionScale: null,
      merchantCommissionScale: null,
      allowAssign: true,
      assignLimit: null,
      remark: "",
    });
    setModalOpen(true);
  };

  const openEditModal = (record: ManualChannelRecord) => {
    setEditingChannel(record);
    form.setFieldsValue({
      code: record.code,
      name: record.name,
      type: record.type,
      retailerCommissionScale: record.retailerCommissionScale ?? null,
      merchantCommissionScale: record.merchantCommissionScale ?? null,
      allowAssign: Boolean(record.allowAssign),
      assignLimit: record.assignLimit ?? null,
      remark: record.remark || "",
    });
    setModalOpen(true);
  };

  const handleSubmit = async () => {
    const values = await form.validateFields();
    const payload: ManualChannelPayload = {
      code: values.code.trim(),
      name: values.name.trim(),
      type: values.type,
      allowAssign: values.allowAssign,
      remark: values.remark?.trim(),
    };

    if (values.retailerCommissionScale != null) {
      payload.retailerCommissionScale = Number(values.retailerCommissionScale);
    }
    if (values.merchantCommissionScale != null) {
      payload.merchantCommissionScale = Number(values.merchantCommissionScale);
    }
    if (values.assignLimit != null) {
      payload.assignLimit = Number(values.assignLimit);
    }

    setSubmitting(true);
    try {
      if (editingChannel) {
        await updateManualChannel({ id: editingChannel.id, ...payload });
      } else {
        await createManualChannel(payload);
      }
      message.success(editingChannel ? "渠道已更新" : "渠道已创建");
      setModalOpen(false);
      setEditingChannel(null);
      await loadChannels();
    } catch (error) {
      message.error(error instanceof Error ? error.message : "保存渠道失败");
    } finally {
      setSubmitting(false);
    }
  };

  const columns: ColumnsType<ManualChannelRecord> = [
    {
      title: "渠道名称",
      dataIndex: "name",
      width: 220,
      render: (value: string, record) => (
        <Space direction="vertical" size={2}>
          <Text style={{ color: "var(--manager-text)", fontWeight: 600 }}>{value || "-"}</Text>
          <Text type="secondary">{record.code || "-"}</Text>
        </Space>
      ),
    },
    {
      title: "类型",
      dataIndex: "type",
      width: 120,
      render: (value: string, record) => (
        <Tag color={value === "MERCHANT" ? "blue" : "gold"}>{record.typeDesc || resolveTypeText(value)}</Tag>
      ),
    },
    {
      title: "允许接单",
      dataIndex: "allowAssign",
      width: 120,
      render: (value?: boolean) => (
        <Tag color={value ? "green" : "default"}>{value ? "允许" : "禁用"}</Tag>
      ),
    },
    {
      title: "散户佣金比例",
      dataIndex: "retailerCommissionScale",
      width: 140,
      render: (value?: number) => formatDecimal(value),
    },
    {
      title: "工作室佣金比例",
      dataIndex: "merchantCommissionScale",
      width: 150,
      render: (value?: number) => formatDecimal(value),
    },
    {
      title: "接单上限",
      dataIndex: "assignLimit",
      width: 120,
      render: (value?: number) => value ?? "-",
    },
    {
      title: "备注",
      dataIndex: "remark",
      render: (value?: string) => value || "-",
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
      width: 56,
      render: (_, record) => (
        <Tooltip title="编辑">
          <Button type="text" aria-label="编辑" icon={<EditOutlined />} onClick={() => openEditModal(record)} />
        </Tooltip>
      ),
    },
  ];

  return (
    <div className="manager-page-stack">
      <section className="manager-data-card manager-toolbar-panel">
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "space-between" }}>
          <Space wrap size={12}>
            <Input
              className="manager-filter-input"
              placeholder="搜索名称、编码或备注"
              prefix={<SearchOutlined />}
              value={filters.keyword}
              onChange={(event) => setFilters((current) => ({ ...current, keyword: event.target.value }))}
              style={{ width: 260, maxWidth: "100%", height: 44 }}
            />
            <Select
              allowClear
              placeholder="筛选渠道类型"
              value={filters.type || undefined}
              onChange={(value) => setFilters((current) => ({ ...current, type: value ?? "" }))}
              options={channelTypeOptions}
              style={{ width: 180 }}
            />
            <Select
              value={filters.allowAssign}
              onChange={(value) => setFilters((current) => ({ ...current, allowAssign: value }))}
              options={[
                { label: "全部接单状态", value: "all" },
                { label: "允许接单", value: "true" },
                { label: "禁用接单", value: "false" },
              ]}
              style={{ width: 180 }}
            />
            <Button icon={<ReloadOutlined />} onClick={() => void loadChannels()}>
              刷新
            </Button>
          </Space>

          <Space wrap>
            <Tag style={{ color: "var(--manager-text-soft)", background: "rgba(170,192,238,0.16)", border: "none" }}>
              命中 {filteredChannels.length} 条
            </Tag>
            <Button type="primary" icon={<PlusOutlined />} onClick={openCreateModal}>
              新建渠道
            </Button>
          </Space>
        </div>
      </section>

      <section className="manager-data-card manager-table">
        <Table<ManualChannelRecord>
          rowKey="id"
          loading={loading}
          dataSource={filteredChannels}
          columns={columns}
          scroll={{ x: 1280 }}
          pagination={{
            pageSize: 10,
            showSizeChanger: false,
          }}
        />
      </section>

      <WorkspaceDrawer
        title={editingChannel ? "编辑人工渠道" : "新建人工渠道"}
        open={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditingChannel(null);
        }}
        onSubmit={handleSubmit}
        submitting={submitting}
        okText={editingChannel ? "保存渠道" : "创建渠道"}
        width={620}
      >
        <Form<ChannelFormValues> className="manager-form-skin" form={form} layout="vertical" preserve={false}>
          <Form.Item name="name" label="渠道名称" rules={[{ required: true, message: "请输入渠道名称" }]}>
            <Input placeholder="例如：火车工作室" />
          </Form.Item>
          <Form.Item name="code" label="渠道编码" rules={[{ required: true, message: "请输入渠道编码" }]}>
            <Input placeholder="例如：HUOCHE" />
          </Form.Item>
          <Form.Item name="type" label="渠道类型" rules={[{ required: true, message: "请选择渠道类型" }]}>
            <Select options={channelTypeOptions} />
          </Form.Item>
          <Space.Compact block>
            <Form.Item name="retailerCommissionScale" label="散户佣金比例" style={{ flex: 1, marginInlineEnd: 12 }}>
              <InputNumber<number> min={0} precision={4} step={0.01} style={{ width: "100%" }} placeholder="例如：0.12" />
            </Form.Item>
            <Form.Item name="merchantCommissionScale" label="工作室佣金比例" style={{ flex: 1 }}>
              <InputNumber<number> min={0} precision={4} step={0.01} style={{ width: "100%" }} placeholder="例如：1.20" />
            </Form.Item>
          </Space.Compact>
          <Space.Compact block>
            <Form.Item name="assignLimit" label="接单上限" style={{ flex: 1, marginInlineEnd: 12 }}>
              <InputNumber<number> min={0} precision={0} style={{ width: "100%" }} placeholder="0 表示不限制时按后端规则处理" />
            </Form.Item>
            <Form.Item name="allowAssign" label="允许接单" valuePropName="checked" style={{ flex: 1 }}>
              <Switch checkedChildren="允许" unCheckedChildren="禁用" />
            </Form.Item>
          </Space.Compact>
          <Form.Item name="remark" label="备注">
            <Input.TextArea rows={4} placeholder="补充这个渠道的投放说明、风控提醒或运营备注" />
          </Form.Item>
        </Form>
      </WorkspaceDrawer>
    </div>
  );
}

function resolveTypeText(type: string) {
  if (type === "MERCHANT") {
    return "工作室";
  }
  if (type === "RETAILER") {
    return "散户";
  }
  return type || "-";
}

function formatDecimal(value?: number) {
  if (value == null) {
    return "-";
  }
  return Number(value).toFixed(4);
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
