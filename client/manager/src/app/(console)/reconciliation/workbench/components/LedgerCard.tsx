"use client";

import { Fragment, useMemo, useState } from "react";
import { DeleteOutlined, PlusOutlined } from "@ant-design/icons";
import {
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
  Table,
  Tag,
  Tooltip,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import dayjs, { type Dayjs } from "dayjs";
import { message } from "@/utils/notify";
import { LEDGER_CATEGORIES, type LedgerRecord, type LedgerType } from "../types";
import { MoneyCell, SectionHead, moneyColumn } from "./shared";

interface LedgerCardProps {
  rows: LedgerRecord[];
  onChange: (rows: LedgerRecord[]) => void;
  /** 出账基准：人工维度「总出款」 */
  manualOutBaseline: { bigRmb: number; bigU: number; smallRmb: number; smallU: number };
  /** 入账基准：上游维度「应收金额」 */
  receivableBaseline: { rmb: number; u: number };
  /** 新增记录时的默认日期 */
  defaultDate: Dayjs;
}

type LedgerView = "summary" | "detail";

interface LedgerFormValues {
  date: Dayjs;
  type: LedgerType;
  category: string;
  amountRmb: number;
  amountU: number;
  feeRmb: number;
  feeU: number;
  remark?: string;
}

interface LedgerTotals {
  amountRmb: number;
  amountU: number;
  feeRmb: number;
  feeU: number;
}

const emptyTotals = (): LedgerTotals => ({ amountRmb: 0, amountU: 0, feeRmb: 0, feeU: 0 });

function accumulate(target: LedgerTotals, row: LedgerRecord) {
  target.amountRmb += Number(row.amountRmb) || 0;
  target.amountU += Number(row.amountU) || 0;
  target.feeRmb += Number(row.feeRmb) || 0;
  target.feeU += Number(row.feeU) || 0;
  return target;
}

interface SummaryRow extends LedgerTotals {
  key: string;
  type: string;
  category: string;
  total?: boolean;
}

interface CompareRow {
  key: string;
  label: string;
  targetLabel: string;
  ledgerRmb: number;
  ledgerU: number;
  targetRmb: number;
  targetU: number;
  diffRmb: number;
  diffU: number;
  matched: boolean;
}

export function LedgerCard({
  rows,
  onChange,
  manualOutBaseline,
  receivableBaseline,
  defaultDate,
}: LedgerCardProps) {
  const [view, setView] = useState<LedgerView>("summary");
  const [createOpen, setCreateOpen] = useState(false);
  const [form] = Form.useForm<LedgerFormValues>();
  const createType = Form.useWatch("type", form) as LedgerType | undefined;

  const { summaryRows, compareRows } = useMemo(() => {
    const out = rows.filter((row) => row.type === "出款").reduce(accumulate, emptyTotals());
    const income = rows.filter((row) => row.type === "入账").reduce(accumulate, emptyTotals());

    // 先按预设类目排序，再补上明细里出现过的自定义类目
    const ordered: SummaryRow[] = [
      ...LEDGER_CATEGORIES["出款"].map((category) => ({ type: "出款", category })),
      ...LEDGER_CATEGORIES["入账"].map((category) => ({ type: "入账", category })),
    ].map((item) => ({ ...item, key: `${item.type}-${item.category}`, ...emptyTotals() }));
    const index = new Map(ordered.map((item) => [item.key, item]));

    rows.forEach((row) => {
      const key = `${row.type}-${row.category}`;
      let item = index.get(key);
      if (!item) {
        item = { key, type: row.type, category: row.category, ...emptyTotals() };
        index.set(key, item);
        ordered.push(item);
      }
      accumulate(item, row);
    });

    const visible = ordered.filter(
      (item) => item.amountRmb || item.amountU || item.feeRmb || item.feeU,
    );

    const categoryTotal = (category: string) =>
      rows.filter((row) => row.type === "出款" && row.category === category).reduce(accumulate, emptyTotals());

    const bigOut = categoryTotal("大户出款");
    const smallOut = categoryTotal("小户出款");

    const compare: CompareRow[] = [
      {
        key: "big",
        label: "大户出账",
        targetLabel: "人工维度 · 总出款",
        ledgerRmb: bigOut.amountRmb,
        ledgerU: bigOut.amountU,
        targetRmb: manualOutBaseline.bigRmb,
        targetU: manualOutBaseline.bigU,
      },
      {
        key: "small",
        label: "小户出账",
        targetLabel: "人工维度 · 总出款",
        ledgerRmb: smallOut.amountRmb,
        ledgerU: smallOut.amountU,
        targetRmb: manualOutBaseline.smallRmb,
        targetU: manualOutBaseline.smallU,
      },
      {
        key: "income",
        label: "总计入账",
        targetLabel: "上游维度 · 应收金额",
        ledgerRmb: income.amountRmb,
        ledgerU: income.amountU,
        targetRmb: receivableBaseline.rmb,
        targetU: receivableBaseline.u,
      },
    ].map((item) => {
      const diffRmb = item.ledgerRmb - item.targetRmb;
      const diffU = item.ledgerU - item.targetU;
      return { ...item, diffRmb, diffU, matched: diffRmb === 0 && diffU === 0 };
    });

    return {
      summaryRows: [
        ...visible,
        { key: "total-out", type: "出款", category: "总计出款", ...out, total: true },
        { key: "total-in", type: "入账", category: "总计入账", ...income, total: true },
        {
          key: "total-net",
          type: "净额",
          category: "净入账",
          amountRmb: income.amountRmb - out.amountRmb,
          amountU: income.amountU - out.amountU,
          feeRmb: income.feeRmb + out.feeRmb,
          feeU: income.feeU + out.feeU,
          total: true,
        },
      ] as SummaryRow[],
      compareRows: compare,
    };
  }, [rows, manualOutBaseline, receivableBaseline]);

  const mismatchCount = compareRows.filter((row) => !row.matched).length;

  const updateRow = (id: number, patch: Partial<LedgerRecord>) => {
    onChange(rows.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  };

  const handleDelete = (id: number) => {
    onChange(rows.filter((row) => row.id !== id));
    message.success("已删除该条出入账记录");
  };

  const openCreate = () => {
    form.setFieldsValue({
      date: defaultDate,
      type: "入账",
      category: LEDGER_CATEGORIES["入账"][0],
      amountRmb: 0,
      amountU: 0,
      feeRmb: 0,
      feeU: 0,
      remark: "",
    });
    setCreateOpen(true);
  };

  const handleCreate = async () => {
    const values = await form.validateFields();
    const nextId = Math.max(0, ...rows.map((row) => row.id)) + 1;
    onChange([
      {
        id: nextId,
        date: values.date.format("YYYY-MM-DD"),
        type: values.type,
        category: values.category,
        amountRmb: Number(values.amountRmb) || 0,
        amountU: Number(values.amountU) || 0,
        feeRmb: Number(values.feeRmb) || 0,
        feeU: Number(values.feeU) || 0,
        remark: values.remark?.trim() || "",
      },
      ...rows,
    ]);
    setCreateOpen(false);
    setView("detail");
    message.success("已新增出入账记录");
  };

  const summaryColumns: ColumnsType<SummaryRow> = [
    {
      title: "类型",
      dataIndex: "type",
      width: 68,
      render: (value: string) => <Tag className={`recon-type-tag recon-type-tag--${typeTone(value)}`}>{value}</Tag>,
    },
    { title: "类目", dataIndex: "category", width: 108, fixed: "left", render: (value: string) => <span className="recon-row-name">{value}</span> },
    moneyColumn<SummaryRow>("金额 RMB", "amountRmb", 96),
    moneyColumn<SummaryRow>("金额 U", "amountU", 92),
    moneyColumn<SummaryRow>("手续费 RMB", "feeRmb", 96),
    moneyColumn<SummaryRow>("手续费 U", "feeU", 92),
  ];

  const detailColumns: ColumnsType<LedgerRecord> = [
    {
      title: "日期",
      dataIndex: "date",
      width: 138,
      fixed: "left",
      render: (value: string, record) => (
        <DatePicker
          value={value ? dayjs(value) : null}
          allowClear={false}
          style={{ width: "100%" }}
          onChange={(next) => next && updateRow(record.id, { date: next.format("YYYY-MM-DD") })}
        />
      ),
    },
    {
      title: "类型",
      dataIndex: "type",
      width: 96,
      render: (value: LedgerType, record) => (
        <Select<LedgerType>
          value={value}
          style={{ width: "100%" }}
          options={(Object.keys(LEDGER_CATEGORIES) as LedgerType[]).map((item) => ({ label: item, value: item }))}
          onChange={(type) =>
            updateRow(record.id, {
              type,
              category: LEDGER_CATEGORIES[type].includes(record.category)
                ? record.category
                : LEDGER_CATEGORIES[type][0],
            })
          }
        />
      ),
    },
    {
      title: "类目",
      dataIndex: "category",
      width: 136,
      render: (value: string, record) => (
        <Select
          value={value}
          style={{ width: "100%" }}
          options={LEDGER_CATEGORIES[record.type].map((item) => ({ label: item, value: item }))}
          onChange={(category) => updateRow(record.id, { category })}
        />
      ),
    },
    numberEditColumn("金额 RMB", "amountRmb", updateRow),
    numberEditColumn("金额 U", "amountU", updateRow),
    numberEditColumn("手续费 RMB", "feeRmb", updateRow),
    numberEditColumn("手续费 U", "feeU", updateRow),
    {
      title: "备注",
      dataIndex: "remark",
      width: 160,
      render: (value: string, record) => (
        <Input
          value={value}
          placeholder="来源 / 原因 / 处理人"
          onChange={(event) => updateRow(record.id, { remark: event.target.value })}
        />
      ),
    },
    {
      title: "操作",
      key: "actions",
      width: 72,
      fixed: "right",
      align: "center",
      render: (_, record) => (
        <Popconfirm
          title="删除该条记录"
          description="删除后汇总与差异对比会立即重算。"
          okText="删除"
          cancelText="取消"
          okButtonProps={{ danger: true }}
          onConfirm={() => handleDelete(record.id)}
        >
          <Tooltip title="删除">
            <Button type="text" size="small" danger icon={<DeleteOutlined />} />
          </Tooltip>
        </Popconfirm>
      ),
    },
  ];

  return (
    <section className="manager-data-card recon-card">
      <SectionHead
        title="出入账"
        caption="汇总视图用于复核，明细视图负责录入、修改与删除"
        extra={
          <>
            {mismatchCount > 0 ? (
              <Tag className="recon-alert-pill">{mismatchCount} 项存在差异</Tag>
            ) : (
              <Tag className="recon-ok-pill">全部一致</Tag>
            )}
            <Segmented<LedgerView>
              value={view}
              onChange={setView}
              options={[
                { label: "汇总", value: "summary" },
                { label: "明细", value: "detail" },
              ]}
            />
            {view === "detail" ? (
              <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
                新增
              </Button>
            ) : null}
          </>
        }
      />

      {view === "summary" ? (
        <div className="recon-stack">
          <Table<SummaryRow>
            className="recon-table"
            rowKey="key"
            size="small"
            columns={summaryColumns}
            dataSource={summaryRows}
            pagination={false}
            scroll={{ x: 552 }}
            rowClassName={(row) => (row.total ? "recon-row-total" : "")}
          />

          <div className="recon-subcard">
            <div className="recon-subcard-head">
              <span className="recon-subcard-title">出入账差异对比</span>
              <span className="recon-subcard-caption">
                出账对比人工维度「总出款」，入账对比上游维度「应收金额」
              </span>
            </div>
            <div className="recon-compare-list">
              {compareRows.map((row) => (
                <CompareItem key={row.key} row={row} />
              ))}
            </div>
          </div>
        </div>
      ) : (
        <Table<LedgerRecord>
          className="recon-table recon-table--editable"
          rowKey="id"
          size="small"
          columns={detailColumns}
          dataSource={rows}
          pagination={false}
          scroll={{ x: 1034 }}
          locale={{
            emptyText: <Empty description="暂无明细，点击「新增」录入出入账记录" />,
          }}
        />
      )}

      <Modal
        title="新增出入账"
        open={createOpen}
        okText="确认新增"
        cancelText="取消"
        width={640}
        destroyOnClose
        onOk={handleCreate}
        onCancel={() => setCreateOpen(false)}
      >
        <Form<LedgerFormValues> className="manager-form-skin" form={form} layout="vertical" preserve={false}>
          <div className="recon-form-grid">
            <Form.Item name="date" label="日期" rules={[{ required: true, message: "请选择日期" }]}>
              <DatePicker style={{ width: "100%" }} allowClear={false} />
            </Form.Item>
            <Form.Item name="type" label="类型" rules={[{ required: true }]}>
              <Select
                options={(Object.keys(LEDGER_CATEGORIES) as LedgerType[]).map((item) => ({ label: item, value: item }))}
                onChange={(type: LedgerType) => form.setFieldValue("category", LEDGER_CATEGORIES[type][0])}
              />
            </Form.Item>
            <Form.Item className="recon-form-wide" name="category" label="类目" rules={[{ required: true, message: "请选择类目" }]}>
              <Select options={LEDGER_CATEGORIES[createType ?? "入账"].map((item) => ({ label: item, value: item }))} />
            </Form.Item>
            <Form.Item name="amountRmb" label="金额 RMB">
              <InputNumber style={{ width: "100%" }} controls={false} />
            </Form.Item>
            <Form.Item name="amountU" label="金额 U">
              <InputNumber style={{ width: "100%" }} controls={false} />
            </Form.Item>
            <Form.Item name="feeRmb" label="手续费 RMB">
              <InputNumber style={{ width: "100%" }} controls={false} />
            </Form.Item>
            <Form.Item name="feeU" label="手续费 U">
              <InputNumber style={{ width: "100%" }} controls={false} />
            </Form.Item>
            <Form.Item className="recon-form-wide" name="remark" label="备注">
              <Input placeholder="可填写来源、原因或处理人" maxLength={120} />
            </Form.Item>
          </div>
        </Form>
      </Modal>
    </section>
  );
}

function numberEditColumn(
  title: string,
  dataIndex: "amountRmb" | "amountU" | "feeRmb" | "feeU",
  updateRow: (id: number, patch: Partial<LedgerRecord>) => void,
): ColumnsType<LedgerRecord>[number] {
  return {
    title,
    dataIndex,
    width: 108,
    align: "right",
    render: (value: number, record: LedgerRecord) => (
      <InputNumber
        value={value}
        controls={false}
        style={{ width: "100%" }}
        onChange={(next) => updateRow(record.id, { [dataIndex]: Number(next) || 0 })}
      />
    ),
  };
}

/** 单个对比项：左右布局下表格太宽，改用「出入账 / 基准 / 差异」三栏小卡 */
function CompareItem({ row }: { row: CompareRow }) {
  return (
    <div className={row.matched ? "recon-compare-item" : "recon-compare-item recon-compare-item--mismatch"}>
      <div className="recon-compare-head">
        <span className="recon-compare-label">{row.label}</span>
        <span className="recon-compare-target">vs {row.targetLabel}</span>
        {row.matched ? <Tag color="success">一致</Tag> : <Tag color="error">有差异</Tag>}
      </div>
      <div className="recon-compare-grid">
        <span className="recon-compare-col" />
        <span className="recon-compare-col">出入账</span>
        <span className="recon-compare-col">基准</span>
        <span className="recon-compare-col">差异</span>
        {(
          [
            { unit: "RMB", ledger: row.ledgerRmb, target: row.targetRmb, diff: row.diffRmb },
            { unit: "U", ledger: row.ledgerU, target: row.targetU, diff: row.diffU },
          ] as const
        ).map((line) => (
          <Fragment key={line.unit}>
            <span className="recon-compare-unit">{line.unit}</span>
            <span className="recon-compare-cell">
              <MoneyCell value={line.ledger} />
            </span>
            <span className="recon-compare-cell">
              <MoneyCell value={line.target} />
            </span>
            <span className="recon-compare-cell">
              <DiffCell value={line.diff} />
            </span>
          </Fragment>
        ))}
      </div>
    </div>
  );
}

function DiffCell({ value }: { value: number }) {
  if (!value) {
    return <span className="recon-diff recon-diff--zero">0</span>;
  }
  return (
    <span className="recon-diff recon-diff--alert">
      <MoneyCell value={value} />
    </span>
  );
}

function typeTone(value: string) {
  if (value === "入账") return "income";
  if (value === "出款") return "outcome";
  return "net";
}
