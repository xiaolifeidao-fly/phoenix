"use client";

import { Table, Tag } from "antd";
import type { ColumnsType } from "antd/es/table";
import type { ManualDimensionRow, UpstreamDimensionRow } from "../types";
import { FormulaGrid, MoneyCell, SectionHead, moneyColumn } from "./shared";

interface DimensionAccountingCardProps {
  manualRows: ManualDimensionRow[];
  upstreamRows: UpstreamDimensionRow[];
}

const manualColumns: ColumnsType<ManualDimensionRow> = [
  { title: "类目", dataIndex: "name", width: 92, fixed: "left", render: (value: string) => <span className="recon-row-name">{value}</span> },
  moneyColumn<ManualDimensionRow>("大户 RMB", "bigRmb", 88),
  moneyColumn<ManualDimensionRow>("大户 U", "bigU", 88),
  moneyColumn<ManualDimensionRow>("小户 RMB", "smallRmb", 88),
  moneyColumn<ManualDimensionRow>("小户 U", "smallU", 88),
  moneyColumn<ManualDimensionRow>("其他用户 RMB", "otherRmb", 92),
  moneyColumn<ManualDimensionRow>("其他用户 U", "otherU", 92),
];

const upstreamColumns: ColumnsType<UpstreamDimensionRow> = [
  { title: "类目", dataIndex: "name", width: 92, fixed: "left", render: (value: string) => <span className="recon-row-name">{value}</span> },
  moneyColumn<UpstreamDimensionRow>("真人 RMB", "realRmb", 92),
  moneyColumn<UpstreamDimensionRow>("真人 U", "realU", 92),
  moneyColumn<UpstreamDimensionRow>("其他社区 RMB", "communityRmb", 96),
  moneyColumn<UpstreamDimensionRow>("其他社区 U", "communityU", 96),
];

const formulas = [
  { label: "应收金额", expression: "充值金额 − 返点金额" },
  { label: "小费金额", expression: "消费金额 × 小费比例" },
  { label: "利润", expression: "应收金额 − 小费金额 − 人工总出款" },
];

export function DimensionAccountingCard({ manualRows, upstreamRows }: DimensionAccountingCardProps) {
  const manualTotal = manualRows.find((row) => row.name === "人工总出款");
  const receivable = upstreamRows.find((row) => row.name === "应收金额");
  const tips = upstreamRows.find((row) => row.name === "小费金额");

  const manualOutRmb = manualTotal?.bigRmb ?? 0;
  const manualOutU = manualTotal?.bigU ?? 0;
  const receivableRmb = (receivable?.realRmb ?? 0) + (receivable?.communityRmb ?? 0);
  const receivableU = (receivable?.realU ?? 0) + (receivable?.communityU ?? 0);
  const tipsRmb = (tips?.realRmb ?? 0) + (tips?.communityRmb ?? 0);
  const tipsU = (tips?.realU ?? 0) + (tips?.communityU ?? 0);

  const systemCalc = [
    { label: "当前人工总出款", rmb: manualOutRmb, u: manualOutU },
    { label: "上游应收", rmb: receivableRmb, u: receivableU },
    { label: "总计利润", rmb: receivableRmb - tipsRmb - manualOutRmb, u: receivableU - tipsU - manualOutU, highlight: true },
  ];

  return (
    <section className="manager-data-card recon-card">
      <SectionHead
        title="维度核算"
        caption="人工维度与上游维度合并展示，系统计算在两个维度下方统一呈现"
        extra={<Tag className="recon-readonly-tag">只读</Tag>}
      />

      <div className="recon-dimension-grid">
        <div className="recon-subcard">
          <div className="recon-subcard-head">
            <span className="recon-subcard-title">人工维度</span>
            <span className="recon-subcard-caption">按用户类型聚合，RMB 与 U 分列</span>
          </div>
          <Table<ManualDimensionRow>
            className="recon-table"
            rowKey="name"
            size="small"
            columns={manualColumns}
            dataSource={manualRows}
            pagination={false}
            scroll={{ x: 628 }}
            rowClassName={(row) => (row.total ? "recon-row-total" : "")}
          />
        </div>

        <div className="recon-subcard">
          <div className="recon-subcard-head">
            <span className="recon-subcard-title">上游维度</span>
            <span className="recon-subcard-caption">真人与其他社区拆分</span>
          </div>
          <Table<UpstreamDimensionRow>
            className="recon-table"
            rowKey="name"
            size="small"
            columns={upstreamColumns}
            dataSource={upstreamRows}
            pagination={false}
            scroll={{ x: 468 }}
            rowClassName={(row) => (row.total ? "recon-row-total" : "")}
          />
        </div>
      </div>

      <div className="recon-calc-strip">
        <div className="recon-calc-strip-title">系统计算</div>
        <div className="recon-calc-grid">
          {systemCalc.map((item) => (
            <div
              className={item.highlight ? "recon-calc-item recon-calc-item--highlight" : "recon-calc-item"}
              key={item.label}
            >
              <span className="recon-calc-label">{item.label}</span>
              <span className="recon-calc-value">
                <MoneyCell value={item.rmb} />
                <em className="recon-calc-unit">RMB</em>
                <i className="recon-calc-divider" aria-hidden />
                <MoneyCell value={item.u} />
                <em className="recon-calc-unit">U</em>
              </span>
            </div>
          ))}
        </div>
      </div>

      <FormulaGrid items={formulas} />
    </section>
  );
}
