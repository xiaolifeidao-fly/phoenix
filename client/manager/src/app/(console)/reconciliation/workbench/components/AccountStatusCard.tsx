"use client";

import { useMemo, useState } from "react";
import { CheckCircleOutlined, EditOutlined, PlusOutlined, WarningOutlined } from "@ant-design/icons";
import {
  Button,
  DatePicker,
  Form,
  Input,
  InputNumber,
  Modal,
  Segmented,
  Select,
  Space,
  Table,
  Tag,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import dayjs, { type Dayjs } from "dayjs";
import { message } from "@/utils/notify";
import {
  ACCOUNT_DIFF_ALERT_PERCENT,
  ACCOUNT_FIELDS,
  type AccountFieldKey,
  type AccountManualRow,
  type AccountSystemRow,
} from "../types";
import { FormulaGrid, MoneyCell, SectionHead, money, moneyColumn } from "./shared";

interface AccountStatusCardProps {
  systemRows: AccountSystemRow[];
  manualRows: AccountManualRow[];
  onManualRowsChange: (rows: AccountManualRow[]) => void;
  /** 新增记录时的默认日期 */
  defaultDate: Dayjs;
}

type AccountView = "system" | "manual";

const NEW_SUBJECT = "__new_community__";
const kindOptions = ["社区", "平台", "代收方"].map((item) => ({ label: item, value: item }));

interface AccountFormValues {
  date: Dayjs;
  subject: string;
  customSubject?: string;
  kind: string;
  debtRmb: number;
  debtU: number;
  balanceRmb: number;
  balanceU: number;
}

const formulas = [
  { label: "当前欠款", expression: "应收金额 − 社区入账 − 社区入账手续费" },
  { label: "当前余额", expression: "上期余额 + 总计入账 − 总计出款" },
  { label: "录入约束", expression: "系统计算不可修改，人工录入用于每日复核" },
];

export function AccountStatusCard({
  systemRows,
  manualRows,
  onManualRowsChange,
  defaultDate,
}: AccountStatusCardProps) {
  const [view, setView] = useState<AccountView>("system");
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<AccountManualRow[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [form] = Form.useForm<AccountFormValues>();
  const selectedSubject = Form.useWatch("subject", form);

  const visibleRows = editing ? draft : manualRows;

  const alerts = useMemo(() => {
    const systemBySubject = new Map(systemRows.map((row) => [row.subject, row]));
    const result: {
      key: string;
      date: string;
      subject: string;
      field: string;
      systemValue: number;
      manualValue: number;
      percent: number;
    }[] = [];

    manualRows.forEach((manualRow) => {
      const systemRow = systemBySubject.get(manualRow.subject);
      if (!systemRow) return;
      ACCOUNT_FIELDS.forEach((field) => {
        const percent = diffPercent(systemRow[field.key], manualRow[field.key]);
        if (percent > ACCOUNT_DIFF_ALERT_PERCENT) {
          result.push({
            key: `${manualRow.id}-${field.key}`,
            date: manualRow.date,
            subject: manualRow.subject,
            field: field.label,
            systemValue: systemRow[field.key],
            manualValue: manualRow[field.key],
            percent,
          });
        }
      });
    });

    return result.sort((a, b) => b.percent - a.percent);
  }, [systemRows, manualRows]);

  const switchView = (next: AccountView) => {
    if (next !== "manual" && editing) {
      setEditing(false);
      setDraft([]);
    }
    setView(next);
  };

  const startEdit = () => {
    setDraft(manualRows.map((row) => ({ ...row })));
    setEditing(true);
  };

  const cancelEdit = () => {
    setEditing(false);
    setDraft([]);
  };

  const saveEdit = () => {
    onManualRowsChange(draft.map((row) => ({ ...row })));
    setEditing(false);
    setDraft([]);
    message.success("人工录入已保存，差异预警已重算");
  };

  const updateDraft = (id: number, patch: Partial<AccountManualRow>) => {
    setDraft((current) => current.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  };

  const openCreate = () => {
    const first = systemRows[0];
    form.setFieldsValue({
      date: defaultDate,
      subject: first?.subject,
      customSubject: "",
      kind: first?.kind ?? "社区",
      debtRmb: first?.debtRmb ?? 0,
      debtU: first?.debtU ?? 0,
      balanceRmb: first?.balanceRmb ?? 0,
      balanceU: first?.balanceU ?? 0,
    });
    setCreateOpen(true);
  };

  /** 选中已有主体时，用系统计算值预填，减少手工输入 */
  const prefillFromSystem = (subject: string) => {
    if (subject === NEW_SUBJECT) {
      form.setFieldsValue({ kind: "社区", debtRmb: 0, debtU: 0, balanceRmb: 0, balanceU: 0 });
      return;
    }
    const systemRow = systemRows.find((row) => row.subject === subject);
    if (!systemRow) return;
    form.setFieldsValue({
      kind: systemRow.kind,
      debtRmb: systemRow.debtRmb,
      debtU: systemRow.debtU,
      balanceRmb: systemRow.balanceRmb,
      balanceU: systemRow.balanceU,
    });
  };

  const handleCreate = async () => {
    const values = await form.validateFields();
    const subject =
      values.subject === NEW_SUBJECT ? (values.customSubject ?? "").trim() : values.subject;
    if (!subject) {
      message.error("请填写新增社区名称");
      return;
    }
    const target = editing ? draft : manualRows;
    const nextRow: AccountManualRow = {
      id: Math.max(0, ...target.map((row) => row.id)) + 1,
      date: values.date.format("YYYY-MM-DD"),
      subject,
      kind: values.kind,
      debtRmb: Number(values.debtRmb) || 0,
      debtU: Number(values.debtU) || 0,
      balanceRmb: Number(values.balanceRmb) || 0,
      balanceU: Number(values.balanceU) || 0,
    };
    if (editing) {
      setDraft([nextRow, ...draft]);
    } else {
      onManualRowsChange([nextRow, ...manualRows]);
    }
    setCreateOpen(false);
    setView("manual");
    message.success("已新增人工录入记录");
  };

  const systemColumns: ColumnsType<AccountSystemRow> = [
    { title: "账户主体", dataIndex: "subject", width: 92, fixed: "left", render: (value: string) => <span className="recon-row-name">{value}</span> },
    { title: "类型", dataIndex: "kind", width: 72, render: (value: string) => <Tag className="recon-kind-tag">{value}</Tag> },
    moneyColumn<AccountSystemRow>("欠款金额 RMB", "debtRmb", 100),
    moneyColumn<AccountSystemRow>("欠款金额 U", "debtU", 96),
    moneyColumn<AccountSystemRow>("账户余额 RMB", "balanceRmb", 100),
    moneyColumn<AccountSystemRow>("账户余额 U", "balanceU", 96),
  ];

  const manualColumns: ColumnsType<AccountManualRow> = [
    {
      title: "日期",
      dataIndex: "date",
      width: editing ? 138 : 100,
      fixed: "left",
      render: (value: string, record) =>
        editing ? (
          <DatePicker
            value={value ? dayjs(value) : null}
            allowClear={false}
            style={{ width: "100%" }}
            onChange={(next) => next && updateDraft(record.id, { date: next.format("YYYY-MM-DD") })}
          />
        ) : (
          value
        ),
    },
    {
      title: "账户主体",
      dataIndex: "subject",
      width: editing ? 120 : 96,
      fixed: "left",
      render: (value: string, record) =>
        editing ? (
          <Input value={value} onChange={(event) => updateDraft(record.id, { subject: event.target.value })} />
        ) : (
          <span className="recon-row-name">{value}</span>
        ),
    },
    {
      title: "类型",
      dataIndex: "kind",
      width: editing ? 104 : 76,
      render: (value: string, record) =>
        editing ? (
          <Select
            value={value}
            style={{ width: "100%" }}
            options={kindOptions}
            onChange={(kind) => updateDraft(record.id, { kind })}
          />
        ) : (
          <Tag className="recon-kind-tag">{value}</Tag>
        ),
    },
    ...ACCOUNT_FIELDS.map((field) => ({
      title: field.label,
      dataIndex: field.key,
      width: editing ? 116 : 104,
      align: "right" as const,
      render: (value: number, record: AccountManualRow) =>
        editing ? (
          <InputNumber
            value={value}
            controls={false}
            style={{ width: "100%" }}
            onChange={(next) => updateDraft(record.id, { [field.key]: Number(next) || 0 })}
          />
        ) : (
          <ManualValueCell
            value={value}
            systemValue={systemRows.find((row) => row.subject === record.subject)?.[field.key as AccountFieldKey]}
          />
        ),
    })),
  ];

  return (
    <section className="manager-data-card recon-card">
      <SectionHead
        title="账户状态"
        caption="系统计算只读，人工录入按日期维护并自动对比差异"
        extra={
          <>
            <Segmented<AccountView>
              value={view}
              onChange={switchView}
              options={[
                { label: "系统计算", value: "system" },
                { label: "人工录入", value: "manual" },
              ]}
            />
            {view === "manual" &&
              (editing ? (
                <Space size={8}>
                  <Button icon={<PlusOutlined />} onClick={openCreate}>
                    新增记录
                  </Button>
                  <Button onClick={cancelEdit}>取消</Button>
                  <Button type="primary" onClick={saveEdit}>
                    保存
                  </Button>
                </Space>
              ) : (
                <Button icon={<EditOutlined />} onClick={startEdit}>
                  编辑
                </Button>
              ))}
          </>
        }
      />

      {view === "system" ? (
        <div className="recon-stack">
          <Table<AccountSystemRow>
            className="recon-table"
            rowKey="subject"
            size="small"
            columns={systemColumns}
            dataSource={systemRows}
            pagination={false}
            scroll={{ x: 556 }}
          />
          <FormulaGrid items={formulas} />
        </div>
      ) : (
        <div className="recon-stack">
          {editing ? (
            <div className="recon-edit-hint">
              编辑态：修改后点击「保存」才会写入并重新计算差异预警，点击「取消」放弃本次改动。
            </div>
          ) : null}
          <Table<AccountManualRow>
            className={editing ? "recon-table recon-table--editable" : "recon-table"}
            rowKey="id"
            size="small"
            columns={manualColumns}
            dataSource={visibleRows}
            pagination={false}
            scroll={{ x: editing ? 928 : 688 }}
          />
        </div>
      )}

      <div className="recon-alert-zone">
        {alerts.length ? (
          <>
            <div className="recon-alert-zone-head">
              <WarningOutlined />
              <span>
                {alerts.length} 项人工录入与系统计算差异超过 {ACCOUNT_DIFF_ALERT_PERCENT}%，需要跟进
              </span>
            </div>
            <div className="recon-alert-list">
              {alerts.map((item) => (
                <div className="recon-alert" key={item.key}>
                  <span className="recon-alert-date">{item.date}</span>
                  <span className="recon-alert-copy">
                    <strong>
                      {item.subject} · {item.field}
                    </strong>
                    系统 {money(item.systemValue)}，人工 {money(item.manualValue)}
                  </span>
                  <span className="recon-alert-percent">差异 {item.percent.toFixed(1)}%</span>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="recon-alert-empty">
            <CheckCircleOutlined />
            人工录入与系统计算差异均未超过 {ACCOUNT_DIFF_ALERT_PERCENT}%，暂无需跟进项。
          </div>
        )}
      </div>

      <Modal
        title="新增账户状态人工录入"
        open={createOpen}
        okText="确认新增"
        cancelText="取消"
        width={720}
        destroyOnClose
        onOk={handleCreate}
        onCancel={() => setCreateOpen(false)}
      >
        <Form<AccountFormValues> className="manager-form-skin" form={form} layout="vertical" preserve={false}>
          <div className="recon-form-grid">
            <Form.Item name="date" label="日期" rules={[{ required: true, message: "请选择日期" }]}>
              <DatePicker style={{ width: "100%" }} allowClear={false} />
            </Form.Item>
            <Form.Item name="subject" label="账户主体" rules={[{ required: true, message: "请选择账户主体" }]}>
              <Select
                options={[
                  ...systemRows.map((row) => ({ label: row.subject, value: row.subject })),
                  { label: "＋ 新增社区", value: NEW_SUBJECT },
                ]}
                onChange={prefillFromSystem}
              />
            </Form.Item>
            <Form.Item
              name="customSubject"
              label="新增社区名称"
              rules={
                selectedSubject === NEW_SUBJECT
                  ? [{ required: true, message: "请填写新增社区名称" }]
                  : undefined
              }
            >
              <Input
                placeholder={selectedSubject === NEW_SUBJECT ? "请输入社区名称" : "选择「新增社区」后填写"}
                disabled={selectedSubject !== NEW_SUBJECT}
                maxLength={40}
              />
            </Form.Item>
            <Form.Item name="kind" label="主体类型" rules={[{ required: true }]}>
              <Select options={kindOptions} />
            </Form.Item>
            <Form.Item name="debtRmb" label="欠款金额 RMB">
              <InputNumber style={{ width: "100%" }} controls={false} />
            </Form.Item>
            <Form.Item name="debtU" label="欠款金额 U">
              <InputNumber style={{ width: "100%" }} controls={false} />
            </Form.Item>
            <Form.Item name="balanceRmb" label="账户余额 RMB">
              <InputNumber style={{ width: "100%" }} controls={false} />
            </Form.Item>
            <Form.Item name="balanceU" label="账户余额 U">
              <InputNumber style={{ width: "100%" }} controls={false} />
            </Form.Item>
          </div>
        </Form>
      </Modal>
    </section>
  );
}

/** 人工录入只读态：差异超阈值的单元格标黄，方便一眼定位 */
function ManualValueCell({ value, systemValue }: { value: number; systemValue?: number }) {
  const percent = systemValue === undefined ? 0 : diffPercent(systemValue, value);
  const flagged = percent > ACCOUNT_DIFF_ALERT_PERCENT;
  return (
    <span className={flagged ? "recon-manual-cell recon-manual-cell--flagged" : "recon-manual-cell"}>
      <MoneyCell value={value} />
      {flagged ? <em className="recon-manual-cell-badge">{percent.toFixed(1)}%</em> : null}
    </span>
  );
}

/** 人工值相对系统值的偏差百分比；系统值为 0 时，只要人工值不为 0 就视为 100% */
function diffPercent(systemValue: number, manualValue: number): number {
  const base = Math.abs(Number(systemValue) || 0);
  const diff = Math.abs((Number(manualValue) || 0) - (Number(systemValue) || 0));
  if (base === 0) return diff === 0 ? 0 : 100;
  return (diff / base) * 100;
}
