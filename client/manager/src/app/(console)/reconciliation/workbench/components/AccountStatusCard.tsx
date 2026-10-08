"use client";

import { useEffect, useMemo, useState } from "react";
import { EditOutlined, HistoryOutlined, PlusOutlined, RollbackOutlined } from "@ant-design/icons";
import {
  Alert,
  Button,
  DatePicker,
  Empty,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Segmented,
  Select,
  Space,
  Table,
  Tag,
  Tooltip,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import dayjs, { type Dayjs } from "dayjs";
import { message } from "@/utils/notify";
import {
  createOpeningDebt,
  fetchOpeningDebts,
  revokeOpeningDebt,
  updateOpeningDebt,
  type AccountStatusRow,
  type OpeningDebtRecord,
} from "../api/reconciliation.api";
import { FormulaGrid, MoneyCell, SectionHead, UpstreamUserCell, money, moneyColumn, upstreamUserLabel } from "./shared";

interface AccountStatusCardProps {
  rows: AccountStatusRow[];
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  /** 所选区间，用于说明期初 / 期末对应哪天 */
  range: [Dayjs, Dayjs];
}

type AccountView = "system" | "manual";

interface OpeningDebtFormValues {
  amount: number | null;
  effectiveDate: Dayjs;
  remark?: string;
}

const formulas = [
  { label: "系统计算欠款", expression: "人工录入欠款 + 应收（充值）− 社区入账 − 代收手续费，后三项从录入生效日的次日累计到所选日" },
  { label: "人工录入欠款", expression: "同一时刻只有一条未结清；录入新的一条，上一条自动结清" },
  { label: "账户余额", expression: "该用户账户的当前余额，不随所选日期变化" },
];

export function AccountStatusCard({ rows, loading, error, onRetry, range }: AccountStatusCardProps) {
  const [view, setView] = useState<AccountView>("system");
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [history, setHistory] = useState<OpeningDebtRecord[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<OpeningDebtRecord | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [form] = Form.useForm<OpeningDebtFormValues>();

  const openingLabel = range[0].subtract(1, "day").format("MM-DD");
  const closingLabel = range[1].format("MM-DD");
  const selectedRow = rows.find((row) => row.userId === selectedUserId) ?? null;
  const current = history.find((item) => item.settleStatus === "UNSETTLED") ?? null;
  const userOptions = useMemo(
    () =>
      rows.map((row) => ({
        label: upstreamUserLabel(row.name, row.username, row.remark),
        value: row.userId,
      })),
    [rows],
  );

  const loadHistory = async (userId: number | null) => {
    if (!userId) {
      setHistory([]);
      return;
    }
    setHistoryLoading(true);
    try {
      setHistory(await fetchOpeningDebts(userId));
    } catch (err) {
      setHistory([]);
      message.error(err instanceof Error ? err.message : "人工录入欠款加载失败");
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    void loadHistory(selectedUserId);
  }, [selectedUserId]);

  const openManual = (userId: number) => {
    setSelectedUserId(userId);
    setView("manual");
  };

  const openForm = (record: OpeningDebtRecord | null) => {
    setEditing(record);
    form.setFieldsValue({
      amount: record ? record.amount : null,
      effectiveDate: record ? dayjs(record.effectiveDate) : dayjs().startOf("day"),
      remark: record?.remark ?? "",
    });
    setFormOpen(true);
  };

  const afterChange = async () => {
    await loadHistory(selectedUserId);
    onRetry();
  };

  const handleSubmit = async () => {
    if (!selectedUserId) return;
    const values = await form.validateFields();
    const payload = {
      userId: selectedUserId,
      amount: Number(values.amount),
      effectiveDate: values.effectiveDate.format("YYYY-MM-DD"),
      remark: values.remark?.trim() || undefined,
    };
    setSubmitting(true);
    try {
      if (editing) {
        await updateOpeningDebt(editing.id, payload);
        message.success("已更新人工录入欠款");
      } else {
        await createOpeningDebt(payload);
        message.success(current ? "已录入，上一条已自动结清" : "已录入人工录入欠款");
      }
      setFormOpen(false);
      await afterChange();
    } catch (err) {
      message.error(err instanceof Error ? err.message : "保存失败");
    } finally {
      setSubmitting(false);
    }
  };

  const handleRevoke = async (record: OpeningDebtRecord) => {
    try {
      await revokeOpeningDebt(record.id);
      message.success("已撤销，上一条已恢复为未结清");
      await afterChange();
    } catch (err) {
      message.error(err instanceof Error ? err.message : "撤销失败");
    }
  };

  const systemColumns: ColumnsType<AccountStatusRow> = [
    {
      title: "上游用户",
      dataIndex: "name",
      width: 170,
      fixed: "left",
      render: (_, row) => <UpstreamUserCell name={row.name} username={row.username} remark={row.remark} />,
    },
    {
      title: "人工录入欠款",
      key: "currentDebt",
      width: 150,
      align: "right",
      render: (_, row) =>
        row.currentDebt ? (
          <span>
            <MoneyCell value={row.currentDebt.amount} />
            <div className="recon-subcard-caption">{row.currentDebt.effectiveDate} 生效</div>
          </span>
        ) : (
          <span className="recon-subcard-caption">未录入</span>
        ),
    },
    {
      title: `期初欠款（${openingLabel}）`,
      dataIndex: "openingDebt",
      width: 140,
      align: "right",
      render: (value: number | null) => <DebtCell value={value} />,
    },
    moneyColumn<AccountStatusRow>("本期应收", "periodRecharge", 110),
    moneyColumn<AccountStatusRow>("本期入账", "periodIncome", 110),
    moneyColumn<AccountStatusRow>("本期入账手续费", "periodCollectFee", 120),
    {
      title: `系统计算欠款（${closingLabel}）`,
      dataIndex: "closingDebt",
      width: 160,
      align: "right",
      render: (value: number | null, row) =>
        value === null ? (
          <DebtCell value={null} />
        ) : (
          <Tooltip
            title={
              row.closingBaseline
                ? `起点 ${money(row.closingBaseline.amount)}（${row.closingBaseline.effectiveDate} 生效）+ 应收 ${money(row.closingRecharge)} − 入账 ${money(row.closingIncome)} − 手续费 ${money(row.closingCollectFee)}`
                : undefined
            }
          >
            <strong>
              <MoneyCell value={value} />
            </strong>
          </Tooltip>
        ),
    },
    moneyColumn<AccountStatusRow>("账户余额", "balanceAmount", 120),
    {
      title: "操作",
      key: "actions",
      width: 72,
      fixed: "right",
      align: "center",
      render: (_, row) => (
        <Tooltip title="人工录入欠款">
          <Button type="text" size="small" icon={<HistoryOutlined />} onClick={() => openManual(row.userId)} />
        </Tooltip>
      ),
    },
  ];

  const historyColumns: ColumnsType<OpeningDebtRecord> = [
    { title: "生效日期", dataIndex: "effectiveDate", width: 110 },
    moneyColumn<OpeningDebtRecord>("欠款金额", "amount", 120),
    {
      title: "状态",
      key: "settleStatus",
      width: 160,
      render: (_, record) =>
        record.settleStatus === "UNSETTLED" ? (
          <Tag color="orange">未结清（当前有效）</Tag>
        ) : (
          <Tag>已结清{record.settleDate ? ` · ${record.settleDate}` : ""}</Tag>
        ),
    },
    { title: "备注", dataIndex: "remark", render: (value?: string) => value || "-" },
    {
      title: "录入",
      key: "createdBy",
      width: 150,
      render: (_, record) => (
        <span className="recon-subcard-caption">
          {record.createdBy || "-"}
          <div>{record.createdTime}</div>
        </span>
      ),
    },
    {
      title: "操作",
      key: "actions",
      width: 90,
      align: "center",
      render: (_, record) =>
        record.settleStatus === "UNSETTLED" ? (
          <Space size={0}>
            <Tooltip title="修改">
              <Button type="text" size="small" icon={<EditOutlined />} onClick={() => openForm(record)} />
            </Tooltip>
            <Popconfirm
              title="撤销这条录入"
              description="撤销后上一条恢复为未结清，欠款按上一条重新计算。"
              okText="撤销"
              cancelText="取消"
              okButtonProps={{ danger: true }}
              onConfirm={() => handleRevoke(record)}
            >
              <Tooltip title="撤销">
                <Button type="text" size="small" danger icon={<RollbackOutlined />} />
              </Tooltip>
            </Popconfirm>
          </Space>
        ) : (
          <Tooltip title="已结清的记录不能修改">
            <span className="recon-subcard-caption">—</span>
          </Tooltip>
        ),
    },
  ];

  return (
    <section className="manager-data-card recon-card">
      <SectionHead
        title="账户状态"
        caption="活跃上游用户的欠款随所选日期变化；人工录入欠款作为起点"
        extra={
          <Segmented<AccountView>
            value={view}
            onChange={setView}
            options={[
              { label: "系统计算", value: "system" },
              { label: "录入欠款", value: "manual" },
            ]}
          />
        }
      />

      {error ? (
        <Alert
          type="error"
          showIcon
          message={error}
          action={
            <Button size="small" onClick={onRetry}>
              重试
            </Button>
          }
        />
      ) : null}

      {view === "system" ? (
        <div className="recon-stack">
          <Table<AccountStatusRow>
            className="recon-table"
            rowKey="userId"
            size="small"
            loading={loading}
            columns={systemColumns}
            dataSource={rows}
            pagination={rows.length > 10 ? { pageSize: 10, size: "small", showSizeChanger: false } : false}
            scroll={{ x: 1150 }}
            locale={{ emptyText: "没有活跃的上游用户，请先在「用户管理」把用户设为活跃" }}
          />
          <FormulaGrid items={formulas} />
        </div>
      ) : (
        <div className="recon-stack">
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <Select<number>
              showSearch
              optionFilterProp="label"
              placeholder="选择上游用户"
              style={{ minWidth: 320 }}
              value={selectedUserId ?? undefined}
              options={userOptions}
              onChange={setSelectedUserId}
            />
            <Button type="primary" icon={<PlusOutlined />} disabled={!selectedUserId} onClick={() => openForm(null)}>
              录入欠款
            </Button>
            {selectedRow ? (
              <span className="recon-subcard-caption">
                系统计算欠款（{closingLabel}）：{selectedRow.closingDebt === null ? "未建账" : money(selectedRow.closingDebt)}
              </span>
            ) : null}
          </div>
          {selectedUserId ? (
            <Table<OpeningDebtRecord>
              className="recon-table"
              rowKey="id"
              size="small"
              loading={historyLoading}
              columns={historyColumns}
              dataSource={history}
              pagination={false}
              scroll={{ x: 720 }}
              locale={{ emptyText: <Empty description="还没有录入过欠款，点「录入欠款」建账" /> }}
            />
          ) : (
            <Empty description="选择一个上游用户，查看和录入它的欠款时间线" />
          )}
        </div>
      )}

      <Modal
        title={`${editing ? "修改人工录入欠款" : "录入欠款"}${selectedRow ? ` · ${selectedRow.name || selectedRow.username}` : ""}`}
        open={formOpen}
        okText={editing ? "保存" : "确认录入"}
        cancelText="取消"
        destroyOnClose
        confirmLoading={submitting}
        onOk={handleSubmit}
        onCancel={() => setFormOpen(false)}
      >
        {selectedRow ? (
          <div className="recon-subcard" style={{ marginBottom: 16, padding: "10px 14px" }}>
            <div className="recon-subcard-caption" style={{ marginBottom: 2 }}>
              上游用户
            </div>
            <UpstreamUserCell name={selectedRow.name} username={selectedRow.username} remark={selectedRow.remark} />
          </div>
        ) : null}
        {!editing && current ? (
          <Alert
            type="warning"
            showIcon
            style={{ marginBottom: 16 }}
            message={`当前未结清的一条（${current.effectiveDate} 生效，${money(current.amount)}）会自动结清，结清日期为新记录的生效日期。`}
          />
        ) : null}
        <Form<OpeningDebtFormValues> className="manager-form-skin" form={form} layout="vertical" preserve={false}>
          <Form.Item name="amount" label="欠款金额（RMB）" rules={[{ required: true, message: "请填写欠款金额" }]} extra="负数表示多付">
            <InputNumber<number> precision={2} style={{ width: "100%" }} controls={false} />
          </Form.Item>
          <Form.Item
            name="effectiveDate"
            label="生效日期"
            rules={[{ required: true, message: "请选择生效日期" }]}
            extra="生效日当天的流水算在这笔欠款里，从次日开始累计；需晚于上一条的生效日期"
          >
            <DatePicker style={{ width: "100%" }} allowClear={false} />
          </Form.Item>
          <Form.Item name="remark" label="备注" rules={[{ max: 255, message: "备注不能超过 255 个字符" }]}>
            <Input.TextArea rows={2} placeholder="例如：对账确认的期初欠款" />
          </Form.Item>
        </Form>
      </Modal>
    </section>
  );
}

/** 欠款为空 = 所选日期还没有生效的人工录入欠款 */
function DebtCell({ value }: { value: number | null }) {
  if (value === null) {
    return (
      <Tooltip title="这一天之前还没有生效的人工录入欠款，无法计算">
        <span className="recon-subcard-caption">未建账</span>
      </Tooltip>
    );
  }
  return <MoneyCell value={value} />;
}
