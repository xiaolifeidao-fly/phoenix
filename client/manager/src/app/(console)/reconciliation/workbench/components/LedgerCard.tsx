"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarOutlined, DeleteOutlined, EditOutlined, HistoryOutlined, PlusOutlined, SyncOutlined } from "@ant-design/icons";
import {
  Alert,
  App,
  Button,
  Checkbox,
  DatePicker,
  Empty,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Segmented,
  Select,
  Table,
  Tag,
  Tooltip,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import dayjs, { type Dayjs } from "dayjs";
import { message } from "@/utils/notify";
import { fetchSettleChannels, type SettleChannelRecord } from "@/app/(console)/manual/api/settle.api";
import { fetchManualUsers } from "@/app/(console)/manual/api/user.api";
import { fetchUsers } from "@/app/(console)/user/api/user.api";
import {
  LEDGER_CATEGORIES,
  LEDGER_SOURCE_LABEL,
  LEDGER_TYPE_LABEL,
  giveLedgerFee,
  type LedgerCurrency,
  type LedgerRecordType,
  type LedgerSortField,
  type ReconLedgerRecord,
  type ReconLedgerSummaryItem,
} from "../api/reconciliation.api";
import type { LedgerState } from "../hooks/useLedger";
import { LedgerSnapshotModal } from "./LedgerSnapshotModal";
import { RemoteSearchSelect, type RemoteOption } from "./RemoteSearchSelect";
import { MoneyCell, SectionHead, money, moneyColumn } from "./shared";

interface LedgerCardProps {
  ledger: LedgerState;
  /** 页面顶部的日期区间：服务端按它查；卡片内的日期筛选只能在它之内再缩小 */
  range: [Dayjs, Dayjs];
}

type LedgerView = "summary" | "detail";

interface LedgerFormValues {
  recordDate: Dayjs;
  category: string;
  currency: LedgerCurrency;
  amount: number | null;
  settleChannelId?: number | null;
  exchangeRate?: number | null;
  upstreamUserId?: string | null;
  userId?: number | null;
  remark?: string;
  /** 社区入账：保存后把代收手续费赠送到该上游社区余额 */
  giveFee?: boolean;
}

/** 上游社区：suffer「用户管理」列表，按名称 / 账号 / 邮箱 / 手机模糊搜索 */
async function searchUpstreamUsers(keyword: string): Promise<RemoteOption<string>[]> {
  const page = await fetchUsers({ pageIndex: 1, pageSize: 20, search: keyword || undefined });
  return (page.data ?? []).map((user) => ({
    value: String(user.id),
    label: `${user.name || user.username}（${user.username}）· #${user.id}`,
  }));
}

/** 下游人工用户：「人工 - 做单用户」列表，按用户名模糊搜索 */
async function searchDownstreamUsers(keyword: string): Promise<RemoteOption<number>[]> {
  const page = await fetchManualUsers({ pageIndex: 1, pageSize: 20, username: keyword || undefined });
  return (page.data ?? []).map((user) => ({
    value: user.id,
    label: `${user.username}${user.channel ? ` · ${user.channel}` : ""} · #${user.id}`,
  }));
}

interface SummaryRow {
  key: string;
  type: string;
  category: string;
  count: number;
  manualCount?: number;
  amountRmb: number;
  amountU: number;
  total?: boolean;
}

const manualCategoryOptions = (["IN", "OUT"] as LedgerRecordType[]).map((type) => ({
  label: LEDGER_TYPE_LABEL[type],
  options: LEDGER_CATEGORIES.filter((item) => item.type === type && item.manual).map((item) => ({
    label: item.label,
    value: item.value,
  })),
}));

const { RangePicker } = DatePicker;

const filterCategoryOptions = LEDGER_CATEGORIES.map((item) => ({ label: item.label, value: item.value }));

export function LedgerCard({ ledger, range }: LedgerCardProps) {
  const [view, setView] = useState<LedgerView>("summary");
  const [editing, setEditing] = useState<ReconLedgerRecord | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [snapshotRecord, setSnapshotRecord] = useState<ReconLedgerRecord | null>(null);
  const [channels, setChannels] = useState<SettleChannelRecord[]>([]);
  const [form] = Form.useForm<LedgerFormValues>();
  const { modal } = App.useApp();
  const formCategory = Form.useWatch("category", form);
  const formCurrency = Form.useWatch("currency", form);
  const formChannelId = Form.useWatch("settleChannelId", form);
  const formAmount = Form.useWatch("amount", form);
  const formRate = Form.useWatch("exchangeRate", form);

  const { summary } = ledger;

  useEffect(() => {
    fetchSettleChannels()
      .then(setChannels)
      .catch(() => setChannels([]));
  }, []);

  const { summaryRows } = useMemo(() => {
    const items: ReconLedgerSummaryItem[] = summary?.categoryList ?? [];
    const visible: SummaryRow[] = items
      .filter((item) => item.count > 0)
      .map((item) => ({
        key: item.category,
        type: LEDGER_TYPE_LABEL[item.recordType] ?? item.recordType,
        category: item.categoryName,
        count: item.count,
        manualCount: item.manualCount,
        amountRmb: item.amountRmb,
        amountU: item.amountU,
      }));
    const count = (type: LedgerRecordType) =>
      items.filter((item) => item.recordType === type).reduce((total, item) => total + item.count, 0);


    return {
      summaryRows: [
        ...visible,
        { key: "total-in", type: "入账", category: "总计入账", count: count("IN"), amountRmb: summary?.inRmb ?? 0, amountU: summary?.inU ?? 0, total: true },
        { key: "total-out", type: "出账", category: "总计出账", count: count("OUT"), amountRmb: summary?.outRmb ?? 0, amountU: summary?.outU ?? 0, total: true },
        { key: "total-net", type: "净额", category: "净入账", count: count("IN") + count("OUT"), amountRmb: summary?.netRmb ?? 0, amountU: summary?.netU ?? 0, total: true },
      ],
    };
  }, [summary]);

  /** 所选日期内的总入账、总出账和利润（入账 − 出账），按 RMB，U 记录已折算 */
  const periodTotals = [
    { label: "总入账", value: summary?.inRmb ?? 0 },
    { label: "总出账", value: summary?.outRmb ?? 0 },
    { label: "利润（入账 − 出账）", value: summary?.netRmb ?? 0, highlight: true },
  ];

  /** 受控排序：当前排序列显示升 / 降箭头 */
  const sortOrderOf = (field: LedgerSortField) =>
    ledger.filters.sortField === field
      ? ledger.filters.sortOrder === "asc"
        ? ("ascend" as const)
        : ("descend" as const)
      : null;
  const selectedChannel = channels.find((item) => item.id === formChannelId);

  /** 手续费预览，和 barry 的算法一致：社区入账 → 代收，人工出款 → 代付；U 先算 U 再折 RMB */
  const feePreview = useMemo(() => {
    const isCollect = formCategory === "COMMUNITY_IN";
    if ((!isCollect && formCategory !== "MANUAL_SETTLE") || !selectedChannel || !formAmount) {
      return null;
    }
    const label = isCollect ? "代收手续费" : "代付手续费";
    if (formCurrency === "USDT") {
      const rate = formRate || selectedChannel.exchangeRate;
      const feeU = formAmount * ((isCollect ? selectedChannel.collectFeeRateU : selectedChannel.payoutFeeRateU) || 0);
      return rate ? `${label} ${money(feeU)} U（≈ ${money(feeU * rate)} RMB）` : null;
    }
    const feeRmb = formAmount * ((isCollect ? selectedChannel.collectFeeRate : selectedChannel.payoutFeeRate) || 0);
    return `${label} ${money(feeRmb)} RMB`;
  }, [formCategory, formCurrency, formAmount, formRate, selectedChannel]);

  const openForm = (record: ReconLedgerRecord | null) => {
    setEditing(record);
    form.setFieldsValue({
      recordDate: record ? dayjs(record.recordDate) : dayjs(ledger.queryStart),
      category: record?.category ?? "COMMUNITY_IN",
      currency: record?.currency ?? "RMB",
      amount: record ? (record.currency === "USDT" ? record.amountU ?? null : record.amountRmb) : null,
      settleChannelId: record?.settleChannelId ?? null,
      exchangeRate: record?.exchangeRate ?? null,
      upstreamUserId: record?.upstreamUserId ?? null,
      userId: record?.userId ?? null,
      remark: record?.remark ?? "",
      giveFee: false,
    });
    setFormOpen(true);
  };

  const handleChannelChange = (channelId: number | null) => {
    // 选了通道且按 U：汇率默认带出通道汇率，仍可手改
    const channel = channels.find((item) => item.id === channelId);
    if (form.getFieldValue("currency") === "USDT" && channel?.exchangeRate) {
      form.setFieldValue("exchangeRate", channel.exchangeRate);
    }
  };

  const handleCurrencyChange = (currency: LedgerCurrency) => {
    if (currency === "USDT" && !form.getFieldValue("exchangeRate") && selectedChannel?.exchangeRate) {
      form.setFieldValue("exchangeRate", selectedChannel.exchangeRate);
    }
  };

  /** 勾了手续费赠送时，保存前再确认一次：赠送会直接给上游社区加余额 */
  const confirmGiveFee = (values: LedgerFormValues) =>
    new Promise<boolean>((resolve) => {
      const target =
        editing?.upstreamUserId && editing.upstreamUserId === values.upstreamUserId
          ? editing.upstreamUserName || `#${editing.upstreamUserId}`
          : "所选上游社区";
      modal.confirm({
        title: "确认赠送代收手续费？",
        content: (
          <>
            <p>
              保存后会把这条入账的{feePreview ?? "代收手续费"}加到 {target} 的余额（账户流水「入账赠送」）。
            </p>
            <p>每条入账只赠送一次，已赠送过的不会重复加款；之后修改金额不会补差，删除入账也不会扣回。</p>
          </>
        ),
        okText: "确认保存并赠送",
        cancelText: "再想想",
        onOk: () => resolve(true),
        onCancel: () => resolve(false),
      });
    });

  const handleSubmit = async () => {
    const values = await form.validateFields();
    if (values.giveFee && values.category === "COMMUNITY_IN" && !(await confirmGiveFee(values))) {
      return;
    }
    let saved;
    try {
      saved = await ledger.save(editing?.id ?? null, {
        recordDate: values.recordDate.format("YYYY-MM-DD"),
        category: values.category,
        currency: values.currency,
        amount: Number(values.amount),
        settleChannelId: values.settleChannelId ?? null,
        exchangeRate: values.currency === "USDT" ? values.exchangeRate ?? null : null,
        upstreamUserId: values.category === "COMMUNITY_IN" ? values.upstreamUserId ?? undefined : undefined,
        userId: values.category === "MANUAL_SETTLE" ? values.userId ?? undefined : undefined,
        remark: values.remark?.trim() || undefined,
      });
      message.success(editing ? "已更新出入账记录" : "已新增出入账记录");
      setFormOpen(false);
      setView("detail");
    } catch (err) {
      message.error(err instanceof Error ? err.message : "保存失败");
      return;
    }
    if (values.giveFee && values.category === "COMMUNITY_IN" && saved?.id) {
      await handleGiveFee(saved.id, saved.recordDate || values.recordDate.format("YYYY-MM-DD"));
    }
  };

  /** 入账已保存后再赠送：失败不影响入账，编辑该记录重新勾选即可重试（服务端按入账 ID 幂等） */
  const handleGiveFee = async (id: number, recordDate: string) => {
    try {
      const result = await giveLedgerFee(id, recordDate);
      const target = result?.upstreamUserName || (result?.upstreamUserId ? `#${result.upstreamUserId}` : "该社区");
      if (result?.given) {
        message.success(`已把代收手续费 ${money(result.amount)} RMB 赠送给 ${target}`);
      } else {
        message.info(`这条入账之前已赠送过手续费，未重复赠送`);
      }
    } catch (err) {
      message.error(
        `入账已保存，但手续费赠送失败：${err instanceof Error ? err.message : "未知错误"}。可编辑该记录勾选赠送重试`,
      );
    }
  };

  const handleDelete = async (record: ReconLedgerRecord) => {
    try {
      await ledger.remove(record.id);
      message.success("已删除该条出入账记录");
    } catch (err) {
      message.error(err instanceof Error ? err.message : "删除失败");
    }
  };

  const handleSync = async () => {
    try {
      const result = await ledger.syncWithdraw();
      if (result.failed > 0) {
        // 有失败一定要说出来，不能显示成「没有需要补记」
        message.error(
          `找到 ${result.withdrawCount} 笔提现，${result.failed} 笔记账失败${result.created ? `，新增 ${result.created} 条` : ""}。${result.firstError ?? ""}`,
        );
      } else if (result.withdrawCount === 0) {
        message.info("所选日期内没有提现成功的记录");
      } else if (result.created > 0) {
        message.success(`找到 ${result.withdrawCount} 笔提现，已补记 ${result.created} 条人工出款 / 代付手续费`);
      } else {
        message.success(`找到 ${result.withdrawCount} 笔提现，都已记过账，无需补记`);
      }
    } catch (err) {
      message.error(err instanceof Error ? err.message : "同步失败");
    }
  };

  const summaryColumns: ColumnsType<SummaryRow> = [
    {
      title: "类型",
      dataIndex: "type",
      width: 68,
      render: (value: string) => <Tag className={`recon-type-tag recon-type-tag--${typeTone(value)}`}>{value}</Tag>,
    },
    { title: "类目", dataIndex: "category", width: 108, fixed: "left", render: (value: string) => <span className="recon-row-name">{value}</span> },
    {
      title: "笔数",
      dataIndex: "count",
      width: 110,
      align: "right",
      render: (value: number, row) =>
        row.total || !row.manualCount ? (
          value
        ) : (
          <Tooltip title={`系统 ${value - row.manualCount} 笔，人工 ${row.manualCount} 笔`}>
            <span>
              {value}
              <span className="recon-subcard-caption">（人工 {row.manualCount}）</span>
            </span>
          </Tooltip>
        ),
    },
    moneyColumn<SummaryRow>("金额 RMB", "amountRmb", 110),
    moneyColumn<SummaryRow>("其中 U", "amountU", 100),
  ];

  const detailColumns: ColumnsType<ReconLedgerRecord> = [
    {
      title: "日期",
      dataIndex: "recordDate",
      width: 116,
      fixed: "left",
      sorter: true,
      sortOrder: sortOrderOf("date"),
    },
    {
      title: "类目",
      dataIndex: "categoryName",
      key: "category",
      width: 300,
      sorter: true,
      sortOrder: sortOrderOf("category"),
      render: (value: string, record) => (
        <span style={{ whiteSpace: "nowrap" }}>
          <Tag className={`recon-type-tag recon-type-tag--${record.recordType === "IN" ? "income" : "outcome"}`}>
            {LEDGER_TYPE_LABEL[record.recordType]}
          </Tag>
          {value}
          <SourceTag record={record} />
          {record.modifyCount ? (
            <Tooltip title="人工修改过，点击查看每一版快照">
              <Tag color="purple" style={{ cursor: "pointer" }} onClick={() => setSnapshotRecord(record)}>
                已改 {record.modifyCount} 次
              </Tag>
            </Tooltip>
          ) : null}
        </span>
      ),
    },
    {
      title: "金额",
      key: "amount",
      width: 150,
      align: "right",
      render: (_, record) => <LedgerAmount record={record} />,
    },
    {
      title: "汇率 / 费率",
      key: "rate",
      width: 110,
      align: "right",
      render: (_, record) => (
        <span className="recon-subcard-caption">
          {record.exchangeRate ? `1U=${record.exchangeRate}` : "-"}
          {record.feeRate != null ? <div>{`${Number((record.feeRate * 100).toFixed(4))}%`}</div> : null}
        </span>
      ),
    },
    { title: "通道", dataIndex: "settleChannelName", width: 100, render: (value?: string) => value || "-" },
    {
      title: "上下游用户",
      key: "user",
      sorter: true,
      sortOrder: sortOrderOf("user"),
      width: 130,
      render: (_, record) => (
        <span>
          {record.upstreamUserId ? (
            <Tooltip title={`上游社区 · suffer 用户 #${record.upstreamUserId}`}>
              <span>上游 {record.upstreamUserName || `#${record.upstreamUserId}`}</span>
            </Tooltip>
          ) : (
            record.username || (record.userId ? `#${record.userId}` : null)
          )}
          {record.points ? <div className="recon-subcard-caption">{`${money(record.points)} 积分`}</div> : null}
        </span>
      ),
    },
    {
      title: "备注",
      dataIndex: "remark",
      width: 160,
      render: (value?: string) => value || "-",
    },
    {
      title: "操作",
      key: "actions",
      width: 112,
      fixed: "right",
      align: "center",
      render: (_, record) => (
        <>
          {record.modifyCount ? (
            <Tooltip title="修改快照">
              <Button type="text" size="small" icon={<HistoryOutlined />} onClick={() => setSnapshotRecord(record)} />
            </Tooltip>
          ) : null}
          {record.editable ? (
            <>
              <Tooltip title="编辑">
                <Button type="text" size="small" icon={<EditOutlined />} onClick={() => openForm(record)} />
              </Tooltip>
              <Popconfirm
                title="删除该条记录"
                description={
                  record.category === "COMMUNITY_IN"
                    ? "对应的代收手续费会一起删除。"
                    : record.category === "MANUAL_SETTLE"
                      ? "对应的代付手续费会一起删除。"
                      : "删除后汇总会立即重算。"
                }
                okText="删除"
                cancelText="取消"
                okButtonProps={{ danger: true }}
                onConfirm={() => handleDelete(record)}
              >
                <Tooltip title="删除">
                  <Button type="text" size="small" danger icon={<DeleteOutlined />} />
                </Tooltip>
              </Popconfirm>
            </>
          ) : record.modifyCount ? null : (
            <Tooltip title="系统生成的记录不能修改、删除">
              <span className="recon-subcard-caption">—</span>
            </Tooltip>
          )}
        </>
      ),
    },
  ];

  return (
    <section className="manager-data-card recon-card">
      <SectionHead
        title="出入账"
        caption="人工出款多由提现成功自动生成，也可人工录入；手续费随主记录自动生成。每条都标注系统 / 人工"
        extra={
          <>
            <Segmented<LedgerView>
              value={view}
              onChange={setView}
              options={[
                { label: "汇总", value: "summary" },
                { label: "明细", value: "detail" },
              ]}
            />
            <Tooltip title="补记所选日期内提现成功、但还没记账的人工出款">
              <Button icon={<SyncOutlined />} loading={ledger.submitting} onClick={handleSync}>
                同步人工出账
              </Button>
            </Tooltip>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => openForm(null)}>
              新增
            </Button>
          </>
        }
      />

      {ledger.error ? (
        <Alert
          type="error"
          showIcon
          message={ledger.error}
          action={
            <Button size="small" onClick={() => void ledger.refresh()}>
              重试
            </Button>
          }
        />
      ) : null}

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 12 }}>
        <RangePicker
          allowClear
          placeholder={[range[0].format("YYYY-MM-DD"), range[1].format("YYYY-MM-DD")]}
          suffixIcon={<CalendarOutlined />}
          style={{ width: 268 }}
          value={ledger.filters.dateRange ?? null}
          disabledDate={(current) =>
            current.isBefore(range[0].startOf("day")) || current.isAfter(range[1].endOf("day"))
          }
          onChange={(value) =>
            ledger.setFilters((current) => ({
              ...current,
              dateRange: value?.[0] && value[1] ? [value[0].startOf("day"), value[1].startOf("day")] : undefined,
              page: 1,
            }))
          }
        />
        <span className="recon-subcard-caption">
          {ledger.narrowed
            ? `汇总和明细只看 ${ledger.queryStart} ~ ${ledger.queryEnd}；清空后回到页面所选日期`
            : "在页面所选日期内再按日期筛选，汇总和明细都生效"}
        </span>
      </div>

      {view === "summary" ? (
        <div className="recon-stack">
          <Table<SummaryRow>
            className="recon-table"
            rowKey="key"
            size="small"
            loading={ledger.loading}
            columns={summaryColumns}
            dataSource={summaryRows}
            pagination={false}
            scroll={{ x: 450 }}
            rowClassName={(row) => (row.total ? "recon-row-total" : "")}
          />

          <div className="recon-calc-strip">
            <div className="recon-calc-strip-title">
              {ledger.narrowed ? `${ledger.queryStart} ~ ${ledger.queryEnd} 汇总` : "所选日期汇总"}
            </div>
            <div className="recon-calc-grid">
              {periodTotals.map((item) => (
                <div
                  className={item.highlight ? "recon-calc-item recon-calc-item--highlight" : "recon-calc-item"}
                  key={item.label}
                >
                  <span className="recon-calc-label">{item.label}</span>
                  <span className="recon-calc-value">
                    <MoneyCell value={item.value} />
                    <em className="recon-calc-unit">RMB</em>
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="recon-stack">
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Select<LedgerRecordType>
              allowClear
              placeholder="全部方向"
              style={{ width: 120 }}
              value={ledger.filters.recordType}
              options={(["IN", "OUT"] as LedgerRecordType[]).map((type) => ({ label: LEDGER_TYPE_LABEL[type], value: type }))}
              onChange={(recordType) => ledger.setFilters((current) => ({ ...current, recordType, page: 1 }))}
            />
            <Select<string[]>
              mode="multiple"
              allowClear
              showSearch
              optionFilterProp="label"
              maxTagCount="responsive"
              placeholder="全部类目（可多选、可搜索）"
              style={{ minWidth: 260, maxWidth: 420 }}
              value={ledger.filters.categories}
              options={filterCategoryOptions}
              onChange={(categories) => ledger.setFilters((current) => ({ ...current, categories: categories ?? [], page: 1 }))}
            />
          </div>
          <Table<ReconLedgerRecord>
            className="recon-table"
            rowKey="id"
            size="small"
            loading={ledger.loading}
            columns={detailColumns}
            dataSource={ledger.rows}
            scroll={{ x: 1132 }}
            pagination={{
              current: ledger.filters.page,
              pageSize: ledger.filters.pageSize,
              total: ledger.total,
              showSizeChanger: false,
              size: "small",
            }}
            onChange={(pagination, _filters, sorter, extra) => {
              if (extra.action === "sort") {
                // 排序在服务端做（分页查询），切换排序回到第一页
                const single = Array.isArray(sorter) ? sorter[0] : sorter;
                const field = sortFieldOfColumn(single?.columnKey ?? single?.field);
                ledger.setFilters((current) => ({
                  ...current,
                  sortField: single?.order && field ? field : undefined,
                  sortOrder: single?.order === "ascend" ? "asc" : single?.order === "descend" ? "desc" : undefined,
                  page: 1,
                }));
                return;
              }
              ledger.setFilters((current) => ({ ...current, page: pagination.current ?? 1 }));
            }}
            locale={{ emptyText: <Empty description="所选日期内暂无出入账记录" /> }}
          />
        </div>
      )}

      <LedgerSnapshotModal record={snapshotRecord} onClose={() => setSnapshotRecord(null)} />

      <Modal
        title={editing ? "编辑出入账" : "新增出入账"}
        open={formOpen}
        okText={editing ? "保存" : "确认新增"}
        cancelText="取消"
        width={640}
        destroyOnClose
        confirmLoading={ledger.submitting}
        onOk={handleSubmit}
        onCancel={() => setFormOpen(false)}
      >
        <Form<LedgerFormValues> className="manager-form-skin" form={form} layout="vertical" preserve={false}>
          <div className="recon-form-grid">
            <Form.Item name="recordDate" label="日期" rules={[{ required: true, message: "请选择日期" }]}>
              <DatePicker style={{ width: "100%" }} allowClear={false} />
            </Form.Item>
            <Form.Item name="category" label="类目" rules={[{ required: true, message: "请选择类目" }]}>
              <Select options={manualCategoryOptions} />
            </Form.Item>
            <Form.Item name="currency" label="币种" rules={[{ required: true }]}>
              <Segmented<LedgerCurrency>
                block
                options={[
                  { label: "RMB", value: "RMB" },
                  { label: "U", value: "USDT" },
                ]}
                onChange={handleCurrencyChange}
              />
            </Form.Item>
            <Form.Item
              name="amount"
              label={formCurrency === "USDT" ? "金额（U）" : "金额（RMB）"}
              rules={[{ required: true, message: "请输入金额" }]}
            >
              <InputNumber<number> min={0.01} precision={2} style={{ width: "100%" }} controls={false} />
            </Form.Item>
            {formCategory === "COMMUNITY_IN" ? (
              <Form.Item
                name="upstreamUserId"
                label="上游社区"
                rules={[{ required: true, message: "请选择上游社区" }]}
                extra="从「用户管理」中选择，可按名称、账号搜索"
              >
                <RemoteSearchSelect<string>
                  placeholder="搜索上游社区"
                  fetchOptions={searchUpstreamUsers}
                  initialOption={
                    editing?.upstreamUserId
                      ? { value: editing.upstreamUserId, label: editing.upstreamUserName || `#${editing.upstreamUserId}` }
                      : null
                  }
                />
              </Form.Item>
            ) : null}
            {formCategory === "MANUAL_SETTLE" ? (
              <Form.Item
                name="userId"
                label="下游人工用户"
                rules={[{ required: true, message: "请选择下游人工用户" }]}
                extra="从「人工 - 做单用户」中选择，可按用户名搜索"
              >
                <RemoteSearchSelect<number>
                  placeholder="搜索做单用户"
                  fetchOptions={searchDownstreamUsers}
                  initialOption={
                    editing?.userId ? { value: editing.userId, label: editing.username || `#${editing.userId}` } : null
                  }
                />
              </Form.Item>
            ) : null}
            <Form.Item
              name="settleChannelId"
              label="结算通道"
              rules={[{ required: formCategory === "COMMUNITY_IN", message: "社区入账需选择结算通道" }]}
              extra={
                formCategory === "COMMUNITY_IN"
                  ? "按该通道的代收手续费率生成一条代收手续费"
                  : formCategory === "MANUAL_SETTLE"
                    ? "选了通道会按代付手续费率生成一条代付手续费；不选则不生成"
                    : undefined
              }
            >
              <Select<number>
                allowClear
                placeholder={formCategory === "COMMUNITY_IN" ? "请选择" : "可不选"}
                options={channels
                  .filter((item) => item.enabled || item.id === editing?.settleChannelId)
                  .map((item) => ({
                    label: `${item.name}${item.defaultChannel ? " · 默认" : ""}${item.enabled ? "" : " · 已停用"}`,
                    value: item.id,
                  }))}
                onChange={handleChannelChange}
              />
            </Form.Item>
            {formCurrency === "USDT" ? (
              <Form.Item
                name="exchangeRate"
                label="汇率（1U = ? RMB）"
                rules={[{ required: true, message: "按 U 录入需填写汇率" }]}
                extra={formAmount && formRate ? `折合 ${money(formAmount * formRate)} RMB` : undefined}
              >
                <InputNumber<number> min={0.0001} precision={6} style={{ width: "100%" }} controls={false} />
              </Form.Item>
            ) : null}
            {feePreview ? (
              <Form.Item className="recon-form-wide">
                <Alert type="info" showIcon message={`将同时生成${feePreview}`} />
              </Form.Item>
            ) : null}
            {formCategory === "COMMUNITY_IN" ? (
              <Form.Item
                className="recon-form-wide"
                name="giveFee"
                valuePropName="checked"
                extra="保存后把这条入账的代收手续费加到该上游社区的余额（账户流水「入账赠送」）；每条入账只赠送一次，之后改金额不会补差"
              >
                <Checkbox>代收手续费赠送给该社区</Checkbox>
              </Form.Item>
            ) : null}
            <Form.Item className="recon-form-wide" name="remark" label="备注" rules={[{ max: 255, message: "备注不能超过 255 个字符" }]}>
              <Input placeholder="可填写来源、原因或处理人" />
            </Form.Item>
          </div>
        </Form>
      </Modal>
    </section>
  );
}

/** 表格列 → 服务端排序字段 */
function sortFieldOfColumn(key: unknown): LedgerSortField | undefined {
  if (key === "recordDate") return "date";
  if (key === "category" || key === "user") return key;
  return undefined;
}

/** 标注记录是系统生成还是人工录入 */
function SourceTag({ record }: { record: ReconLedgerRecord }) {
  const manual = record.source === "MANUAL";
  return (
    <Tooltip title={LEDGER_SOURCE_LABEL[record.source] ?? record.source}>
      <Tag color={manual ? "orange" : "blue"} style={{ marginInlineStart: 6 }}>
        {manual ? "人工" : "系统"}
      </Tag>
    </Tooltip>
  );
}

/** 按 RMB 记账只显示 RMB；按 U 记账显示 U，并在下面带折算的 RMB */
function LedgerAmount({ record }: { record: ReconLedgerRecord }) {
  if (record.currency === "USDT" && record.amountU != null) {
    return (
      <span>
        <MoneyCell value={record.amountU} /> U
        <div className="recon-subcard-caption">
          ≈ <MoneyCell value={record.amountRmb} /> RMB
        </div>
      </span>
    );
  }
  return (
    <span>
      <MoneyCell value={record.amountRmb} /> RMB
    </span>
  );
}

function typeTone(value: string) {
  if (value === "入账") return "income";
  if (value === "出账") return "outcome";
  return "net";
}
