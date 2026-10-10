"use client";

import { useCallback, useEffect, useState } from "react";
import { DeleteOutlined, EditOutlined } from "@ant-design/icons";
import { Alert, Button, DatePicker, Form, Input, InputNumber, Modal, Popconfirm, Select, Space, Table, Tooltip } from "antd";
import type { ColumnsType } from "antd/es/table";
import dayjs, { type Dayjs } from "dayjs";
import { message } from "@/utils/notify";
import { revokeOpeningDebt, saveOpeningDebt, type AccountStatusRow } from "../api/reconciliation.api";
import {
  clearOpeningBalance,
  fetchOpeningBalance,
  saveOpeningBalance,
  type ManualBookCompareItem,
  type ManualBookCurrency,
  type OpeningBalanceRecord,
} from "../../manual-book/api/manual-book.api";
import { PairCell } from "../../manual-book/components/PairCell";
import { FormulaGrid, MoneyCell, SectionHead, UpstreamUserCell, money, moneyColumn } from "./shared";

interface AccountStatusCardProps {
  rows: AccountStatusRow[];
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  /** 所选区间，用于说明期初 / 期末对应哪天 */
  range: [Dayjs, Dayjs];
  /** 人工记账对比的合计行：区间内最后一份人工余额 vs 以初始余额为基准的系统应有余额 */
  balanceTotal?: ManualBookCompareItem | null;
  /** 初始余额改了之后，人工记账对比要重算 */
  onOpeningBalanceChange?: () => void;
}

interface OpeningBalanceFormValues {
  balanceDate: Dayjs;
  currency: ManualBookCurrency;
  balance: number | null;
  exchangeRate?: number | null;
  remark?: string;
}

interface OpeningDebtFormValues {
  amount: number | null;
  debtDate: Dayjs;
  remark?: string;
}

const formulas = [
  { label: "人工录入欠款", expression: "每个社区一条，带欠款日期；金额是那天结束时的欠款（和人工记账一样）" },
  { label: "系统计算欠款", expression: "人工录入欠款 + 欠款日期次日到所选日的（充值 − 社区入账 − 代收手续费）" },
  { label: "期初欠款", expression: "截至开始日前一天的系统计算欠款；欠款日期晚于它时算不出" },
  { label: "账户余额", expression: "该用户账户的当前余额，不随所选日期变化" },
];

export function AccountStatusCard({ rows, loading, error, onRetry, range, balanceTotal, onOpeningBalanceChange }: AccountStatusCardProps) {
  const [editing, setEditing] = useState<AccountStatusRow | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [form] = Form.useForm<OpeningDebtFormValues>();
  const [opening, setOpening] = useState<OpeningBalanceRecord | null>(null);
  const [openingError, setOpeningError] = useState<string | null>(null);
  const [openingFormOpen, setOpeningFormOpen] = useState(false);
  const [openingSubmitting, setOpeningSubmitting] = useState(false);
  const [openingForm] = Form.useForm<OpeningBalanceFormValues>();
  const openingCurrency = Form.useWatch("currency", openingForm);

  const loadOpening = useCallback(async () => {
    try {
      setOpening(await fetchOpeningBalance());
      setOpeningError(null);
    } catch (err) {
      setOpeningError(err instanceof Error ? err.message : "初始余额加载失败");
    }
  }, []);

  useEffect(() => {
    void loadOpening();
  }, [loadOpening]);

  const openOpeningForm = () => {
    openingForm.setFieldsValue({
      balanceDate: opening ? dayjs(opening.balanceDate) : range[0].subtract(1, "day").startOf("day"),
      currency: opening?.currency ?? "USDT",
      balance: opening?.balance ?? null,
      exchangeRate: opening?.exchangeRate ?? null,
      remark: opening?.remark ?? "",
    });
    setOpeningFormOpen(true);
  };

  const handleOpeningSubmit = async () => {
    const values = await openingForm.validateFields();
    setOpeningSubmitting(true);
    try {
      const saved = await saveOpeningBalance({
        balanceDate: values.balanceDate.format("YYYY-MM-DD"),
        currency: values.currency,
        balance: Number(values.balance),
        exchangeRate: values.currency === "USDT" ? values.exchangeRate ?? null : null,
        remark: values.remark?.trim() || undefined,
      });
      setOpening(saved ?? null);
      message.success("已保存初始余额，人工记账对比已按它重算");
      setOpeningFormOpen(false);
      onOpeningBalanceChange?.();
    } catch (err) {
      message.error(err instanceof Error ? err.message : "保存失败");
    } finally {
      setOpeningSubmitting(false);
    }
  };

  const handleOpeningClear = async () => {
    try {
      await clearOpeningBalance();
      setOpening(null);
      message.success("已清除初始余额");
      onOpeningBalanceChange?.();
    } catch (err) {
      message.error(err instanceof Error ? err.message : "清除失败");
    }
  };

  const openingLabel = range[0].subtract(1, "day").format("MM-DD");
  const closingLabel = range[1].format("MM-DD");

  const openForm = (row: AccountStatusRow) => {
    setEditing(row);
    form.setFieldsValue({
      amount: row.currentDebt?.amount ?? null,
      debtDate: row.currentDebt?.debtDate ? dayjs(row.currentDebt.debtDate) : range[0].subtract(1, "day").startOf("day"),
      remark: row.currentDebt?.remark ?? "",
    });
  };

  const handleSubmit = async () => {
    if (!editing) return;
    const values = await form.validateFields();
    setSubmitting(true);
    try {
      await saveOpeningDebt({
        userId: editing.userId,
        amount: Number(values.amount),
        debtDate: values.debtDate.format("YYYY-MM-DD"),
        remark: values.remark?.trim() || undefined,
      });
      message.success(editing.currentDebt ? "已更新人工录入欠款" : "已录入人工录入欠款");
      setEditing(null);
      onRetry();
    } catch (err) {
      message.error(err instanceof Error ? err.message : "保存失败");
    } finally {
      setSubmitting(false);
    }
  };

  const handleRevoke = async (row: AccountStatusRow) => {
    if (!row.currentDebt) return;
    try {
      await revokeOpeningDebt(row.currentDebt.id);
      message.success("已清除人工录入欠款");
      onRetry();
    } catch (err) {
      message.error(err instanceof Error ? err.message : "清除失败");
    }
  };

  const columns: ColumnsType<AccountStatusRow> = [
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
          <Tooltip
            title={`${row.currentDebt.updatedBy || row.currentDebt.createdBy || "-"} · ${row.currentDebt.updatedTime || row.currentDebt.createdTime || ""}${row.currentDebt.remark ? `（${row.currentDebt.remark}）` : ""}`}
          >
            <span>
              <MoneyCell value={row.currentDebt.amount} />
              <div className="recon-subcard-caption">
                {row.currentDebt.debtDate ? `${row.currentDebt.debtDate} 的欠款` : "未填欠款日期"}
              </div>
            </span>
          </Tooltip>
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
            title={`人工录入 ${money(row.currentDebt?.amount)}（${row.currentDebt?.debtDate ?? "开始日前一天"} 的欠款）+ 之后的应收 ${money(row.closingRecharge)} − 入账 ${money(row.closingIncome)} − 手续费 ${money(row.closingCollectFee)}`}
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
      width: 90,
      fixed: "right",
      align: "center",
      render: (_, row) => (
        <Space size={0}>
          <Tooltip title={row.currentDebt ? "修改人工录入欠款" : "录入欠款"}>
            <Button type="text" size="small" icon={<EditOutlined />} onClick={() => openForm(row)} />
          </Tooltip>
          {row.currentDebt ? (
            <Popconfirm
              title="清除人工录入欠款"
              description="清除后这个社区回到未建账，欠款核对里初始欠款按 0 算。"
              okText="清除"
              cancelText="取消"
              okButtonProps={{ danger: true }}
              onConfirm={() => handleRevoke(row)}
            >
              <Tooltip title="清除">
                <Button type="text" size="small" danger icon={<DeleteOutlined />} />
              </Tooltip>
            </Popconfirm>
          ) : null}
        </Space>
      ),
    },
  ];

  return (
    <section className="manager-data-card recon-card">
      <SectionHead title="账户状态" caption="活跃上游用户；人工录入欠款每个社区一条，从欠款日期的次日开始累计" />

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

      <div className="recon-stack">
        <OpeningBalanceStrip
          opening={opening}
          error={openingError}
          total={balanceTotal ?? null}
          onEdit={openOpeningForm}
          onClear={handleOpeningClear}
          onRetry={() => void loadOpening()}
        />
        <Table<AccountStatusRow>
          className="recon-table"
          rowKey="userId"
          size="small"
          loading={loading}
          columns={columns}
          dataSource={rows}
          pagination={rows.length > 10 ? { pageSize: 10, size: "small", showSizeChanger: false } : false}
          scroll={{ x: 1260 }}
          locale={{ emptyText: "没有活跃的上游用户，请先在「用户管理」把用户设为活跃" }}
        />
        <FormulaGrid items={formulas} />
      </div>

      <Modal
        title={`${editing?.currentDebt ? "修改人工录入欠款" : "录入欠款"}${editing ? ` · ${editing.name || editing.username}` : ""}`}
        open={!!editing}
        okText="保存"
        cancelText="取消"
        destroyOnClose
        confirmLoading={submitting}
        onOk={handleSubmit}
        onCancel={() => setEditing(null)}
      >
        {editing ? (
          <div className="recon-subcard" style={{ marginBottom: 16, padding: "10px 14px" }}>
            <div className="recon-subcard-caption" style={{ marginBottom: 2 }}>
              上游用户
            </div>
            <UpstreamUserCell name={editing.name} username={editing.username} remark={editing.remark} />
          </div>
        ) : null}
        <Form<OpeningDebtFormValues> className="manager-form-skin" form={form} layout="vertical" preserve={false}>
          <Form.Item
            name="amount"
            label="欠款金额（RMB）"
            rules={[{ required: true, message: "请填写欠款金额" }]}
            extra="负数表示多付。每个社区只有这一条"
          >
            <InputNumber<number> precision={2} style={{ width: "100%" }} controls={false} />
          </Form.Item>
          <Form.Item
            name="debtDate"
            label="欠款日期"
            rules={[{ required: true, message: "请选择欠款日期" }]}
            extra="欠款金额是这天结束时的欠款（和人工记账填的一样），从第二天开始累计充值、入账、手续费"
          >
            <DatePicker style={{ width: "100%" }} allowClear={false} />
          </Form.Item>
          <Form.Item name="remark" label="备注" rules={[{ max: 255, message: "备注不能超过 255 个字符" }]}>
            <Input.TextArea rows={2} placeholder="例如：对账确认的期初欠款" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={opening ? "修改初始余额" : "设置初始余额"}
        open={openingFormOpen}
        okText="保存"
        cancelText="取消"
        destroyOnClose
        confirmLoading={openingSubmitting}
        onOk={handleOpeningSubmit}
        onCancel={() => setOpeningFormOpen(false)}
      >
        <Form<OpeningBalanceFormValues> className="manager-form-skin" form={openingForm} layout="vertical" preserve={false}>
          <Form.Item
            name="balanceDate"
            label="初始余额日期"
            rules={[{ required: true, message: "请选择日期" }]}
            extra="金额是这天结束时账上的余额（和人工记账填的一样），从第二天开始累计入账、出账"
          >
            <DatePicker style={{ width: "100%" }} allowClear={false} />
          </Form.Item>
          <Form.Item label="初始余额" required extra="全局只有一条；人工记账每天的余额都和「初始余额 + 之后入账 − 出账」对比">
            <div style={{ display: "flex", gap: 8 }}>
              <Form.Item name="currency" noStyle>
                <Select<ManualBookCurrency>
                  style={{ width: 90 }}
                  options={[
                    { label: "U", value: "USDT" },
                    { label: "RMB", value: "RMB" },
                  ]}
                />
              </Form.Item>
              <Form.Item name="balance" noStyle rules={[{ required: true, message: "请填写初始余额" }]}>
                <InputNumber<number> precision={2} style={{ flex: 1 }} controls={false} placeholder="例如 86166.04" />
              </Form.Item>
            </div>
          </Form.Item>
          {openingCurrency === "USDT" ? (
            <Form.Item
              name="exchangeRate"
              label="汇率（1U = ? RMB）"
              rules={[
                { required: true, message: "按 U 记时请填写汇率" },
                { type: "number", min: 0.00000001, message: "汇率必须大于 0" },
              ]}
            >
              <InputNumber<number> precision={4} style={{ width: "100%" }} controls={false} />
            </Form.Item>
          ) : null}
          <Form.Item name="remark" label="备注" rules={[{ max: 255, message: "备注不能超过 255 个字符" }]}>
            <Input.TextArea rows={2} placeholder="例如：10 月初盘点的账上余额" />
          </Form.Item>
        </Form>
      </Modal>
    </section>
  );
}

/**
 * 全局初始余额：人工记账对比的基准。旁边对照截至区间最后一份记账那天的
 * 系统应有余额（初始余额 + 之后入账 − 出账）和人工余额。
 */
function OpeningBalanceStrip({
  opening,
  error,
  total,
  onEdit,
  onClear,
  onRetry,
}: {
  opening: OpeningBalanceRecord | null;
  error: string | null;
  total: ManualBookCompareItem | null;
  onEdit: () => void;
  onClear: () => void;
  onRetry: () => void;
}) {
  const comparable = !!opening && !!total && total.systemBalanceRmb !== null;
  const asOf = total ? dayjs(total.date).format("MM-DD") : "";
  return (
    <div className="recon-calc-strip">
      <div className="recon-calc-strip-title">
        初始余额
        <div className="recon-subcard-caption" style={{ fontWeight: 400 }}>
          人工记账对比的基准：系统应有余额 = 初始余额 + 之后的入账 − 出账，不拿上一份人工记账当起点
        </div>
      </div>
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
      <div className="recon-calc-grid">
        <div className="recon-calc-item recon-calc-item--highlight">
          <span className="recon-calc-label">
            {opening ? `${dayjs(opening.balanceDate).format("YYYY-MM-DD")} 结束时` : "还没设初始余额"}
          </span>
          {opening ? (
            <Tooltip
              title={`${opening.updatedBy || "-"} · ${opening.updatedTime || ""}${opening.remark ? `（${opening.remark}）` : ""}`}
            >
              <span className="recon-calc-value">
                <MoneyCell value={opening.balanceRmb} />
                <em className="recon-calc-unit">RMB</em>
                {opening.currency === "USDT" ? (
                  <div className="recon-subcard-caption">
                    {money(opening.balance)} U × {opening.exchangeRate}
                  </div>
                ) : null}
              </span>
            </Tooltip>
          ) : (
            <span className="recon-subcard-caption">设了之后人工记账才能和系统对比</span>
          )}
          <Space size={0}>
            <Button type="link" size="small" icon={<EditOutlined />} onClick={onEdit}>
              {opening ? "修改" : "设置"}
            </Button>
            {opening ? (
              <Popconfirm
                title="清除初始余额"
                description="清除后人工记账对比没有基准，只显示人工记的余额。"
                okText="清除"
                cancelText="取消"
                okButtonProps={{ danger: true }}
                onConfirm={onClear}
              >
                <Button type="link" size="small" danger icon={<DeleteOutlined />}>
                  清除
                </Button>
              </Popconfirm>
            ) : null}
          </Space>
        </div>
        <div className="recon-calc-item">
          <span className="recon-calc-label">{comparable ? `截至 ${asOf} 余额` : "截至区间最后一份记账"}</span>
          {comparable ? (
            <PairCell
              manual={total.balanceRmb}
              system={total.systemBalanceRmb}
              systemTip={`初始余额 ${money(total.openingBalanceRmb)} + 入账 ${money(total.sinceIn)} − 出账 ${money(total.sinceOut)}`}
            />
          ) : (
            <span className="recon-subcard-caption">
              {opening ? "所选区间没有初始余额日期之后的人工记账" : "—"}
            </span>
          )}
        </div>
        <div className="recon-calc-item">
          <span className="recon-calc-label">差值（人工 − 系统）</span>
          <span className={total?.status === "DIFF" ? "recon-calc-value recon-diff--alert" : "recon-calc-value"}>
            {comparable && total.diff !== null ? <MoneyCell value={total.diff} /> : <span className="recon-subcard-caption">—</span>}
            <em className="recon-calc-unit">RMB</em>
          </span>
        </div>
      </div>
    </div>
  );
}

/** 欠款为空 = 还没录人工录入欠款，或这天早于欠款日期 */
function DebtCell({ value }: { value: number | null }) {
  if (value === null) {
    return (
      <Tooltip title="还没录人工录入欠款，或这天早于欠款日期，无法计算">
        <span className="recon-subcard-caption">未建账</span>
      </Tooltip>
    );
  }
  return <MoneyCell value={value} />;
}
