"use client";

import { useEffect, useMemo, useState } from "react";
import { EditOutlined, PlusOutlined, ReloadOutlined, SearchOutlined } from "@ant-design/icons";
import { Button, Form, Input, InputNumber, Select, Space, Switch, Table, Tag, Tooltip, Typography } from "antd";
import { message } from "@/utils/notify";
import type { ColumnsType } from "antd/es/table";
import { WorkspaceDrawer } from "@/components/manager-shell/WorkspaceDrawer";
import {
  createSettleChannel,
  fetchSettleChannels,
  type SettleChannelPayload,
  type SettleChannelRecord,
  updateSettleChannel,
} from "../../api/settle.api";

const { Text } = Typography;

/** 表单里费率按百分比填写，提交时换算为 0~1。 */
interface SettleChannelFormValues {
  name: string;
  collectFeePercent: number | null;
  payoutFeePercent: number | null;
  collectFeePercentU: number | null;
  payoutFeePercentU: number | null;
  exchangeRate: number | null;
  enabled: boolean;
  defaultChannel: boolean;
  remark?: string;
}

export function SettleChannelManagementPanel() {
  const [form] = Form.useForm<SettleChannelFormValues>();
  const [channels, setChannels] = useState<SettleChannelRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingChannel, setEditingChannel] = useState<SettleChannelRecord | null>(null);
  const [filters, setFilters] = useState({ keyword: "", enabled: "all" });

  const loadChannels = async () => {
    setLoading(true);
    try {
      setChannels(await fetchSettleChannels());
    } catch (error) {
      message.error(error instanceof Error ? error.message : "加载结算通道失败");
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
        !keyword || item.name.toLowerCase().includes(keyword) || (item.remark || "").toLowerCase().includes(keyword);
      const matchEnabled = filters.enabled === "all" || String(Boolean(item.enabled)) === filters.enabled;
      return matchKeyword && matchEnabled;
    });
  }, [channels, filters]);

  const openDrawer = (record: SettleChannelRecord | null) => {
    setEditingChannel(record);
    form.setFieldsValue({
      name: record?.name ?? "",
      collectFeePercent: record ? toPercent(record.collectFeeRate) : null,
      payoutFeePercent: record ? toPercent(record.payoutFeeRate) : null,
      collectFeePercentU: record ? toPercent(record.collectFeeRateU) : null,
      payoutFeePercentU: record ? toPercent(record.payoutFeeRateU) : null,
      exchangeRate: record?.exchangeRate ?? null,
      enabled: record ? Boolean(record.enabled) : true,
      defaultChannel: record ? Boolean(record.defaultChannel) : false,
      remark: record?.remark ?? "",
    });
    setDrawerOpen(true);
  };

  const closeDrawer = () => {
    setDrawerOpen(false);
    setEditingChannel(null);
  };

  const handleSubmit = async () => {
    const values = await form.validateFields();
    const payload: SettleChannelPayload = {
      name: values.name.trim(),
      collectFeeRate: fromPercent(values.collectFeePercent ?? 0),
      payoutFeeRate: fromPercent(values.payoutFeePercent ?? 0),
      collectFeeRateU: fromPercent(values.collectFeePercentU ?? 0),
      payoutFeeRateU: fromPercent(values.payoutFeePercentU ?? 0),
      exchangeRate: values.exchangeRate ?? null,
      enabled: values.enabled,
      defaultChannel: values.enabled && values.defaultChannel,
      remark: values.remark?.trim() || undefined,
    };
    setSubmitting(true);
    try {
      if (editingChannel) {
        await updateSettleChannel(editingChannel.id, payload);
      } else {
        await createSettleChannel(payload);
      }
      message.success(editingChannel ? "结算通道已更新" : "结算通道已创建");
      closeDrawer();
      await loadChannels();
    } catch (error) {
      message.error(error instanceof Error ? error.message : "保存结算通道失败");
    } finally {
      setSubmitting(false);
    }
  };

  const columns: ColumnsType<SettleChannelRecord> = [
    {
      title: "通道名称",
      dataIndex: "name",
      width: 220,
      render: (value: string, record) => (
        <Space size={6}>
          <Text style={{ color: "var(--manager-text)", fontWeight: 600 }}>{value || "-"}</Text>
          {record.defaultChannel ? (
            <Tooltip title="用户没绑定结算通道时，提现记账按这个通道算代付手续费、取汇率">
              <Tag color="gold">默认</Tag>
            </Tooltip>
          ) : null}
        </Space>
      ),
    },
    {
      title: "代收手续费（RMB / U）",
      key: "collectFee",
      width: 170,
      render: (_, record) => `${formatPercent(record.collectFeeRate)} / ${formatPercent(record.collectFeeRateU)}`,
    },
    {
      title: "代付手续费（RMB / U）",
      key: "payoutFee",
      width: 170,
      render: (_, record) => `${formatPercent(record.payoutFeeRate)} / ${formatPercent(record.payoutFeeRateU)}`,
    },
    {
      title: "汇率（1U = ? RMB）",
      dataIndex: "exchangeRate",
      width: 150,
      render: (value?: number | null) => (value ? value : <Text type="secondary">未配置</Text>),
    },
    {
      title: "状态",
      dataIndex: "enabled",
      width: 100,
      render: (value?: boolean) => <Tag color={value ? "green" : "default"}>{value ? "启用" : "停用"}</Tag>,
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
          <Button type="text" aria-label="编辑" icon={<EditOutlined />} onClick={() => openDrawer(record)} />
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
              placeholder="搜索通道名称或备注"
              prefix={<SearchOutlined />}
              value={filters.keyword}
              onChange={(event) => setFilters((current) => ({ ...current, keyword: event.target.value }))}
              style={{ width: 260, maxWidth: "100%", height: 44 }}
            />
            <Select
              value={filters.enabled}
              onChange={(value) => setFilters((current) => ({ ...current, enabled: value }))}
              options={[
                { label: "全部状态", value: "all" },
                { label: "启用", value: "true" },
                { label: "停用", value: "false" },
              ]}
              style={{ width: 160 }}
            />
            <Button icon={<ReloadOutlined />} onClick={() => void loadChannels()}>
              刷新
            </Button>
          </Space>

          <Space wrap>
            <Tag style={{ color: "var(--manager-text-soft)", background: "rgba(170,192,238,0.16)", border: "none" }}>
              命中 {filteredChannels.length} 条
            </Tag>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => openDrawer(null)}>
              新建结算通道
            </Button>
          </Space>
        </div>
      </section>

      <section className="manager-data-card manager-table">
        <Table<SettleChannelRecord>
          rowKey="id"
          loading={loading}
          dataSource={filteredChannels}
          columns={columns}
          scroll={{ x: 1200 }}
          pagination={{ pageSize: 10, showSizeChanger: false }}
        />
      </section>

      <WorkspaceDrawer
        title={editingChannel ? "编辑结算通道" : "新建结算通道"}
        open={drawerOpen}
        onClose={closeDrawer}
        onSubmit={handleSubmit}
        submitting={submitting}
        okText={editingChannel ? "保存通道" : "创建通道"}
        width={560}
      >
        <Form<SettleChannelFormValues> className="manager-form-skin" form={form} layout="vertical" preserve={false}>
          <Form.Item
            name="name"
            label="通道名称"
            rules={[
              { required: true, whitespace: true, message: "请输入通道名称" },
              { max: 64, message: "通道名称不能超过 64 个字符" },
            ]}
          >
            <Input placeholder="例如：XX 支付" />
          </Form.Item>
          <Space.Compact block>
            <Form.Item
              name="collectFeePercent"
              label="RMB 代收手续费（%）"
              rules={[{ required: true, message: "请输入 RMB 代收手续费" }]}
              style={{ flex: 1, marginInlineEnd: 12 }}
            >
              <InputNumber<number> min={0} max={100} precision={4} step={0.1} style={{ width: "100%" }} placeholder="例如：4.5" />
            </Form.Item>
            <Form.Item
              name="payoutFeePercent"
              label="RMB 代付手续费（%）"
              rules={[{ required: true, message: "请输入 RMB 代付手续费" }]}
              style={{ flex: 1 }}
            >
              <InputNumber<number> min={0} max={100} precision={4} step={0.1} style={{ width: "100%" }} placeholder="例如：2.5" />
            </Form.Item>
          </Space.Compact>
          <Space.Compact block>
            <Form.Item
              name="collectFeePercentU"
              label="U 代收手续费（%）"
              rules={[{ required: true, message: "请输入 U 代收手续费" }]}
              style={{ flex: 1, marginInlineEnd: 12 }}
            >
              <InputNumber<number> min={0} max={100} precision={4} step={0.1} style={{ width: "100%" }} placeholder="例如：3" />
            </Form.Item>
            <Form.Item
              name="payoutFeePercentU"
              label="U 代付手续费（%）"
              rules={[{ required: true, message: "请输入 U 代付手续费" }]}
              style={{ flex: 1 }}
            >
              <InputNumber<number> min={0} max={100} precision={4} step={0.1} style={{ width: "100%" }} placeholder="例如：1" />
            </Form.Item>
          </Space.Compact>
          <Form.Item
            name="exchangeRate"
            label="汇率（1U = ? RMB）"
            extra="按 U 结算的提现记账时，用这里的汇率折算 RMB 并存进记录；不填则按 RMB 记账。"
          >
            <InputNumber<number> min={0.0001} precision={6} step={0.01} style={{ width: "100%" }} placeholder="例如：7.2" />
          </Form.Item>
          <Form.Item
            name="enabled"
            label="启用"
            valuePropName="checked"
            extra="停用后做单用户不能再选这个通道，已绑定的用户保持不变。"
          >
            <Switch checkedChildren="启用" unCheckedChildren="停用" />
          </Form.Item>
          <Form.Item noStyle dependencies={["enabled"]}>
            {({ getFieldValue }) => (
              <Form.Item
                name="defaultChannel"
                label="默认通道"
                valuePropName="checked"
                extra={
                  getFieldValue("enabled")
                    ? "用户没绑定结算通道时，提现记账按这个通道算代付手续费、取汇率。设为默认会取消其他通道的默认。"
                    : "停用的通道不能设为默认通道。"
                }
              >
                <Switch checkedChildren="默认" unCheckedChildren="否" disabled={!getFieldValue("enabled")} />
              </Form.Item>
            )}
          </Form.Item>
          <Form.Item name="remark" label="备注" rules={[{ max: 255, message: "备注不能超过 255 个字符" }]}>
            <Input.TextArea rows={3} placeholder="补充通道的结算周期、对接人等说明" />
          </Form.Item>
        </Form>
      </WorkspaceDrawer>
    </div>
  );
}

/** 0.045 → 4.5，规避浮点误差。 */
function toPercent(rate?: number) {
  return rate == null ? null : Number((Number(rate) * 100).toFixed(4));
}

/** 4.5 → 0.045，保留到后端精度（6 位小数）。 */
function fromPercent(percent: number) {
  return Number((Number(percent) / 100).toFixed(6));
}

function formatPercent(rate?: number) {
  const percent = toPercent(rate);
  return percent == null ? "-" : `${percent}%`;
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
