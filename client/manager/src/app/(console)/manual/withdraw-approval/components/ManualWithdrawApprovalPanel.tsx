"use client";

import { useEffect, useMemo, useState } from "react";
import dayjs, { type Dayjs } from "dayjs";
import localeData from "dayjs/plugin/localeData";
import weekday from "dayjs/plugin/weekday";
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  ReloadOutlined,
  SearchOutlined,
  WalletOutlined,
} from "@ant-design/icons";
import { Button, DatePicker, Input, Modal, Select, Space, Table, Tag, Typography } from "antd";
import { message } from "@/utils/notify";
import type { ColumnsType } from "antd/es/table";
import { fetchManualChannels, type ManualChannelRecord } from "../../api/channel.api";
import {
  accountManualWithdraw,
  cancelManualWithdraw,
  fetchManualWithdrawRecords,
  finishManualWithdraw,
  type ManualWithdrawRecord,
} from "../../api/withdraw.api";

const { Text, Title } = Typography;
const { RangePicker } = DatePicker;

dayjs.extend(weekday);
dayjs.extend(localeData);

type DateRangeFilterValue = [Dayjs, Dayjs];

interface ActionState {
  mode: "account" | "finish" | "cancel";
  record: ManualWithdrawRecord;
}

const statusOptions = [
  { label: "全部状态", value: "" },
  { label: "待审核", value: "UN_APPROVE" },
  { label: "审核中", value: "APPROVING" },
  { label: "结算中", value: "ACCOUNTING" },
  { label: "待完成", value: "UN_FINISH" },
  { label: "提现成功", value: "FINISH" },
  { label: "提现失败", value: "ERROR" },
  { label: "取消中", value: "CANCELING" },
  { label: "取消成功", value: "CANCEL" },
];

export function ManualWithdrawApprovalPanel() {
  const [records, setRecords] = useState<ManualWithdrawRecord[]>([]);
  const [channels, setChannels] = useState<ManualChannelRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [channelLoading, setChannelLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [actionState, setActionState] = useState<ActionState | null>(null);
  const [filters, setFilters] = useState({
    username: "",
    channel: "",
    status: "",
    dateRange: createDefaultDateRange(),
  });

  const dateRangeValue = useMemo(() => normalizeDateRange(filters.dateRange), [filters.dateRange]);

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

  const loadRecords = async () => {
    setLoading(true);
    try {
      const [startTime, endTime] = normalizeDateRange(filters.dateRange);
      const result = await fetchManualWithdrawRecords({
        username: filters.username.trim() || undefined,
        channel: filters.channel || undefined,
        status: filters.status || undefined,
        startTime: startTime ? startTime.format("YYYY-MM-DD HH:mm:ss") : undefined,
        endTime: endTime ? endTime.format("YYYY-MM-DD HH:mm:ss") : undefined,
      });
      setRecords(result);
    } catch (error) {
      message.error(error instanceof Error ? error.message : "加载提现记录失败");
      setRecords([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadChannels();
    void loadRecords();
  }, []);

  const channelOptions = useMemo(
    () => [
      { label: "全部渠道", value: "" },
      ...channels.map((item) => ({
        label: item.name ? `${item.name}${item.code ? ` (${item.code})` : ""}` : item.code,
        value: item.code,
      })),
    ],
    [channels],
  );

  const stats = useMemo(() => {
    const totalPoints = records.reduce((sum, item) => sum + Number(item.points || 0), 0);
    return [
      { label: "待审核", value: records.filter((item) => item.status === "UN_APPROVE").length },
      { label: "结算中", value: records.filter((item) => item.status === "ACCOUNTING").length },
      { label: "提现成功", value: records.filter((item) => item.status === "FINISH").length },
      { label: "总积分", value: totalPoints.toLocaleString("zh-CN") },
    ];
  }, [records]);

  const openActionModal = (mode: ActionState["mode"], record: ManualWithdrawRecord) => {
    setActionState({ mode, record });
    setCancelReason(record.description || "");
  };

  const closeActionModal = () => {
    setActionState(null);
    setCancelReason("");
  };

  const handleAction = async () => {
    if (!actionState) {
      return;
    }
    if (actionState.mode === "cancel" && !cancelReason.trim()) {
      message.error("请输入驳回原因");
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        username: actionState.record.username || undefined,
        userPointWithdrawRecordId: actionState.record.id,
        description: actionState.mode === "cancel" ? cancelReason.trim() : undefined,
      };

      if (actionState.mode === "account") {
        await accountManualWithdraw(payload);
        message.success("已发起结算");
      } else if (actionState.mode === "finish") {
        await finishManualWithdraw(payload);
        message.success("已发起核销");
      } else {
        await cancelManualWithdraw(payload);
        message.success("已驳回提现");
      }

      closeActionModal();
      await loadRecords();
    } catch (error) {
      message.error(error instanceof Error ? error.message : "提现审批操作失败");
    } finally {
      setSubmitting(false);
    }
  };

  const columns: ColumnsType<ManualWithdrawRecord> = [
    {
      title: "申请用户",
      dataIndex: "username",
      width: 180,
      render: (value: string, record) => (
        <Space direction="vertical" size={2}>
          <Text style={{ color: "var(--manager-text)", fontWeight: 600 }}>{value || "-"}</Text>
          <Text type="secondary">{record.channel || "未识别渠道"}</Text>
        </Space>
      ),
    },
    {
      title: "提现信息",
      key: "points",
      width: 180,
      render: (_, record) => (
        <Space direction="vertical" size={2}>
          <Text>{`${Number(record.points || 0).toLocaleString("zh-CN")} 积分`}</Text>
          <Text type="secondary">{`记录ID: ${record.id || "-"}`}</Text>
        </Space>
      ),
    },
    {
      title: "支付方式",
      key: "payment",
      width: 220,
      render: (_, record) => (
        <Space direction="vertical" size={2}>
          <Text>{formatPaymentType(record.paymentType)}</Text>
          <Text type="secondary">{record.paymentAccount || record.paymentName || "-"}</Text>
        </Space>
      ),
    },
    {
      title: "状态",
      dataIndex: "status",
      width: 120,
      render: (value: string) => <Tag color={resolveStatusColor(value)}>{resolveStatusText(value)}</Tag>,
    },
    {
      title: "申请 / 审核时间",
      key: "time",
      width: 220,
      render: (_, record) => (
        <Space direction="vertical" size={2}>
          <Text>{record.applyTime || "-"}</Text>
          <Text type="secondary">{record.approveTime || "未审核"}</Text>
        </Space>
      ),
    },
    {
      title: "备注",
      dataIndex: "description",
      render: (value?: string) => value || "-",
    },
    {
      title: "操作",
      key: "actions",
      fixed: "right",
      width: 220,
      render: (_, record) => (
        <Space size={4} wrap>
          <Button
            type="text"
            size="small"
            icon={<WalletOutlined />}
            disabled={!canAccount(record.status)}
            onClick={() => openActionModal("account", record)}
          >
            结算
          </Button>
          <Button
            type="text"
            size="small"
            icon={<CheckCircleOutlined />}
            disabled={!canFinish(record.status)}
            onClick={() => openActionModal("finish", record)}
          >
            核销
          </Button>
          <Button
            danger
            type="text"
            size="small"
            icon={<CloseCircleOutlined />}
            disabled={!canCancel(record.status)}
            onClick={() => openActionModal("cancel", record)}
          >
            驳回
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <div className="manager-page-stack">
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: 16,
        }}
      >
        {stats.map((metric) => (
          <article key={metric.label} className="manager-data-card" style={{ borderRadius: 24, padding: 22 }}>
            <div className="manager-section-label">{metric.label}</div>
            <div
              className="manager-display-title"
              style={{ marginTop: 12, fontSize: 28, color: "var(--manager-text)" }}
            >
              {metric.value}
            </div>
          </article>
        ))}
      </div>

      <section className="manager-shell-card" style={{ borderRadius: 30, padding: 24 }}>
        <Space direction="vertical" size={18} style={{ width: "100%" }}>
          <div>
            <div className="manager-section-label">审批筛选</div>
            <Title level={4} style={{ margin: "10px 0 0" }}>
              用户提现记录
            </Title>
          </div>

          <Space size={[12, 12]} wrap style={{ width: "100%" }}>
            <Input
              allowClear
              placeholder="用户名"
              prefix={<SearchOutlined />}
              style={{ width: 180 }}
              value={filters.username}
              onChange={(event) => setFilters((current) => ({ ...current, username: event.target.value }))}
            />
            <Select
              loading={channelLoading}
              options={channelOptions}
              style={{ width: 220 }}
              value={filters.channel}
              onChange={(value) => setFilters((current) => ({ ...current, channel: value }))}
            />
            <Select
              options={statusOptions}
              style={{ width: 180 }}
              value={filters.status}
              onChange={(value) => setFilters((current) => ({ ...current, status: value }))}
            />
            <RangePicker
              showTime
              value={dateRangeValue}
              onChange={(value) => {
                if (!value || !value[0] || !value[1]) {
                  setFilters((current) => ({ ...current, dateRange: createDefaultDateRange() }));
                  return;
                }
                const [startTime, endTime] = normalizeDateRange(value);
                setFilters((current) => ({
                  ...current,
                  dateRange: [startTime.startOf("second"), endTime.startOf("second")],
                }));
              }}
            />
            <Button type="primary" icon={<SearchOutlined />} onClick={() => void loadRecords()}>
              查询
            </Button>
            <Button icon={<ReloadOutlined />} onClick={() => void loadRecords()}>
              刷新
            </Button>
          </Space>

          <Table<ManualWithdrawRecord>
            rowKey={(record) => String(record.id)}
            loading={loading}
            columns={columns}
            dataSource={records}
            scroll={{ x: 1280 }}
            pagination={{
              pageSize: 20,
              showSizeChanger: false,
            }}
          />
        </Space>
      </section>

      <Modal
        open={Boolean(actionState)}
        title={resolveModalTitle(actionState?.mode)}
        confirmLoading={submitting}
        onOk={() => void handleAction()}
        onCancel={closeActionModal}
        okText="确认"
        cancelText="取消"
      >
        {actionState ? (
          <Space direction="vertical" size={14} style={{ width: "100%" }}>
            <Text>{`用户：${actionState.record.username || "-"}`}</Text>
            <Text>{`积分：${Number(actionState.record.points || 0).toLocaleString("zh-CN")}`}</Text>
            <Text>{`当前状态：${resolveStatusText(actionState.record.status)}`}</Text>
            {actionState.mode === "cancel" ? (
              <Input.TextArea
                rows={4}
                maxLength={200}
                showCount
                placeholder="请输入驳回原因"
                value={cancelReason}
                onChange={(event) => setCancelReason(event.target.value)}
              />
            ) : null}
          </Space>
        ) : null}
      </Modal>
    </div>
  );
}

function createDefaultDateRange(): DateRangeFilterValue {
  return [dayjs().startOf("day"), dayjs().endOf("day")];
}

function normalizeDateRange(value: unknown): DateRangeFilterValue {
  if (!Array.isArray(value)) {
    return createDefaultDateRange();
  }

  const [startValue, endValue] = value;
  const defaultRange = createDefaultDateRange();
  return [normalizeDayjs(startValue, defaultRange[0]), normalizeDayjs(endValue, defaultRange[1])];
}

function normalizeDayjs(value: unknown, fallback: Dayjs) {
  if (dayjs.isDayjs(value)) {
    return value;
  }

  if (typeof value === "string" || value instanceof Date || typeof value === "number") {
    const parsedValue = dayjs(value);
    if (parsedValue.isValid()) {
      return parsedValue;
    }
  }

  return fallback;
}

function resolveModalTitle(mode?: ActionState["mode"]) {
  if (mode === "account") {
    return "确认发起结算";
  }
  if (mode === "finish") {
    return "确认发起核销";
  }
  if (mode === "cancel") {
    return "确认驳回提现";
  }
  return "审批操作";
}

function resolveStatusText(status?: string) {
  switch (status) {
    case "UN_APPROVE":
      return "待审核";
    case "APPROVING":
      return "审核中";
    case "ACCOUNTING":
      return "结算中";
    case "UN_FINISH":
      return "待完成";
    case "FINISH":
      return "提现成功";
    case "ERROR":
      return "提现失败";
    case "CANCELING":
      return "取消中";
    case "CANCEL":
      return "取消成功";
    default:
      return status || "-";
  }
}

function resolveStatusColor(status?: string) {
  switch (status) {
    case "UN_APPROVE":
      return "gold";
    case "APPROVING":
      return "processing";
    case "ACCOUNTING":
      return "blue";
    case "FINISH":
      return "success";
    case "ERROR":
      return "error";
    case "CANCEL":
    case "CANCELING":
      return "default";
    default:
      return "default";
  }
}

function formatPaymentType(value?: string) {
  switch ((value || "").toUpperCase()) {
    case "ALIPAY":
      return "支付宝";
    case "WECHAT":
      return "微信";
    case "WALLET":
      return "钱包";
    default:
      return value || "-";
  }
}

function canAccount(status?: string) {
  return status === "UN_APPROVE" || status === "APPROVING";
}

function canFinish(status?: string) {
  return status === "ACCOUNTING" || status === "UN_FINISH";
}

function canCancel(status?: string) {
  return status === "UN_APPROVE" || status === "APPROVING" || status === "ACCOUNTING";
}
