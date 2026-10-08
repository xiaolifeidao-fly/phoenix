"use client";

import { useState } from "react";
import { Alert, Button, Drawer, Table, Tag, Tooltip } from "antd";
import type { ColumnsType } from "antd/es/table";
import dayjs from "dayjs";
import { FormulaGrid, MoneyCell, SectionHead, UpstreamUserCell, money } from "../../workbench/components/shared";
import type { DebtCompareDay, DebtCompareRow, DebtCompareStatus } from "../api/manual-book.api";
import type { DebtCompareState } from "../hooks/useDebtCompare";

interface DebtCompareCardProps {
  compare: DebtCompareState;
}

const statusMeta: Record<DebtCompareStatus, { label: string; color?: string }> = {
  OK: { label: "一致", color: "green" },
  MINOR: { label: "相差较小", color: "gold" },
  DIFF: { label: "有差异", color: "red" },
  NO_BASELINE: { label: "缺上一份", color: "orange" },
  NO_MANUAL: { label: "人工未记", color: "orange" },
};

const formulas = [
  { label: "核对窗口", expression: "每份人工记账和它的上一份之间（上一份次日 ~ 当天），按社区核对一次" },
  { label: "应收", expression: "这段时间的充值" },
  { label: "入账 + 欠款增量", expression: "这段时间的入账（社区入账 + 代收手续费）+（当天人工欠款 − 上一份人工欠款）" },
  { label: "差值", expression: "（入账 + 欠款增量）− 应收；比例 = 差值 ÷ |应收|" },
];

const empty = <span className="recon-subcard-caption">—</span>;

const shortDate = (value?: string) => (value ? dayjs(value).format("MM-DD") : "");

/** 带正负号的增量：+2,000 / -300 */
function DeltaCell({ value }: { value: number | null }) {
  if (value === null) return empty;
  return (
    <span className={value < 0 ? "recon-amount recon-amount--negative" : "recon-amount"}>
      {value > 0 ? "+" : ""}
      {money(value)}
    </span>
  );
}

/** 欠款核对：每份人工记账和上一份之间，按社区比「充值」和「入账 + 欠款增量」，列出差异和可能的原因 */
export function DebtCompareCard({ compare }: DebtCompareCardProps) {
  const { data } = compare;
  /** 抽屉里看的是哪一天；数据刷新后按日期重新取，那天没了就自动关掉 */
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const selected = data?.days.find((day) => day.date === selectedDate) ?? null;

  const dayColumns: ColumnsType<DebtCompareDay> = [
    {
      title: "记账日",
      dataIndex: "date",
      width: 150,
      render: (value: string, day) => (
        <span>
          <span className="recon-row-name">{value}</span>
          <div className="recon-subcard-caption">
            {day.previousDate ? `对比 ${shortDate(day.previousDate)}，共 ${day.days} 天` : "找不到上一份记账"}
          </div>
        </span>
      ),
    },
    {
      title: "应收（充值）RMB",
      dataIndex: "receivable",
      width: 150,
      align: "right",
      render: (value: number, day) => (day.previousDate ? <MoneyCell value={value} /> : empty),
    },
    {
      title: "入账 + 欠款增量 RMB",
      dataIndex: "manualTotal",
      width: 170,
      align: "right",
      render: (value: number, day) => (day.previousDate ? <MoneyCell value={value} /> : empty),
    },
    {
      title: "差值 RMB",
      dataIndex: "diff",
      width: 130,
      align: "right",
      render: (value: number, day) =>
        !day.previousDate ? (
          empty
        ) : (
          <span className={day.diffCount ? "recon-diff--alert" : "recon-diff--zero"}>
            <MoneyCell value={value} />
          </span>
        ),
    },
    {
      title: "社区",
      key: "count",
      width: 230,
      render: (_, day) => (
        <span>
          {day.diffCount ? <Tag color="red">有差异 {day.diffCount}</Tag> : null}
          {day.issueCount - day.diffCount ? <Tag color="orange">缺数据 {day.issueCount - day.diffCount}</Tag> : null}
          {!day.issueCount ? <Tag color="green">全部一致</Tag> : null}
          <span className="recon-subcard-caption">共 {day.rows.length} 个</span>
        </span>
      ),
    },
  ];

  const columns: ColumnsType<DebtCompareRow> = [
    {
      title: "上游社区",
      dataIndex: "name",
      width: 170,
      fixed: "left",
      render: (_, row) => (
        <span>
          <UpstreamUserCell name={row.name || `#${row.userId}`} username={row.username} remark={row.remark} />
          {row.isTrading ? null : <Tag style={{ marginTop: 4 }}>非活跃</Tag>}
        </span>
      ),
    },
    {
      title: "应收（充值）",
      dataIndex: "receivable",
      width: 120,
      align: "right",
      render: (value: number, row) => (row.status === "NO_BASELINE" ? empty : <MoneyCell value={value} />),
    },
    {
      title: "入账",
      dataIndex: "incomeTotal",
      width: 120,
      align: "right",
      render: (value: number, row) =>
        row.status === "NO_BASELINE" ? (
          empty
        ) : (
          <Tooltip title={`社区入账 ${money(row.income)} + 代收手续费 ${money(row.collectFee)}`}>
            <span>
              <MoneyCell value={value} />
              {row.collectFee ? <div className="recon-subcard-caption">含手续费 {money(row.collectFee)}</div> : null}
            </span>
          </Tooltip>
        ),
    },
    {
      title: "上一份欠款",
      dataIndex: "previousDebt",
      width: 120,
      align: "right",
      render: (value: number | null, row) =>
        value === null ? (
          empty
        ) : (
          <span>
            <MoneyCell value={value} />
            {row.previousMissing ? <div className="recon-subcard-caption">没记，按 0</div> : null}
          </span>
        ),
    },
    {
      title: "当天欠款",
      dataIndex: "manualDebt",
      width: 130,
      align: "right",
      render: (value: number | null, row) =>
        value === null ? (
          empty
        ) : row.manualCurrency === "USDT" ? (
          <span>
            <MoneyCell value={row.manualAmount} /> <span className="recon-subcard-caption">U</span>
            <div className="recon-subcard-caption">≈ {money(value)} RMB</div>
          </span>
        ) : (
          <MoneyCell value={value} />
        ),
    },
    {
      title: "欠款增量",
      dataIndex: "debtChange",
      width: 110,
      align: "right",
      render: (value: number | null) => <DeltaCell value={value} />,
    },
    {
      title: "入账 + 欠款增量",
      dataIndex: "manualTotal",
      width: 130,
      align: "right",
      render: (value: number | null) => (value === null ? empty : <MoneyCell value={value} />),
    },
    {
      title: "差值",
      dataIndex: "diff",
      width: 120,
      align: "right",
      render: (value: number | null, row) =>
        value === null ? (
          empty
        ) : (
          <span className={row.status === "DIFF" ? "recon-diff--alert" : row.status === "OK" ? "recon-diff--zero" : undefined}>
            <MoneyCell value={value} />
            {row.diffRatio !== null ? <div className="recon-subcard-caption">{(row.diffRatio * 100).toFixed(2)}%</div> : null}
          </span>
        ),
    },
    {
      title: "状态",
      dataIndex: "status",
      width: 96,
      align: "center",
      render: (value: DebtCompareStatus) => <Tag color={statusMeta[value]?.color}>{statusMeta[value]?.label ?? value}</Tag>,
    },
    {
      title: "哪里有问题",
      dataIndex: "issues",
      width: 360,
      render: (issues: string[]) =>
        issues.length ? (
          <ul style={{ margin: 0, paddingLeft: 16, fontSize: 12, lineHeight: 1.6 }}>
            {issues.map((issue) => (
              <li key={issue}>{issue}</li>
            ))}
          </ul>
        ) : (
          empty
        ),
    },
  ];

  return (
    <section className="manager-data-card recon-card">
      <SectionHead
        title="欠款核对"
        caption="每份人工记账和上一份之间，这段时间的充值（应收）应当等于入账 + 人工欠款的增量；有差异的列出可能的原因"
      />

      {compare.error ? (
        <Alert
          type="error"
          showIcon
          message={compare.error}
          action={
            <Button size="small" onClick={() => void compare.refresh()}>
              重试
            </Button>
          }
        />
      ) : null}

      <div className="recon-stack">
        {data?.notices.map((notice) => <Alert key={notice} type="info" showIcon message={notice} />)}

        <div className="recon-subcard">
          <div className="recon-subcard-head">
            <span className="recon-subcard-title">按天汇总</span>
            <span className="recon-subcard-caption">
              {data
                ? `区间合计：充值 ${money(data.receivable)}，入账 + 欠款增量 ${money(data.manualTotal)}，差值 ${money(data.diff)}；${data.diffDays} 天有差异，点某一天在抽屉里看各社区明细`
                : ""}
            </span>
          </div>
          <Table<DebtCompareDay>
            className="recon-table"
            rowKey="date"
            size="small"
            loading={compare.loading}
            columns={dayColumns}
            dataSource={data?.days ?? []}
            pagination={false}
            scroll={{ x: 830, y: 280 }}
            onRow={(day) => ({ onClick: () => setSelectedDate(day.date), style: { cursor: "pointer" } })}
            rowClassName={(day) => (day.date === selectedDate ? "recon-row-total" : day.diffCount ? "recon-row-mismatch" : "")}
            locale={{ emptyText: "所选区间内没有人工记账" }}
          />
        </div>

        <FormulaGrid items={formulas} />
      </div>

      <Drawer
        title={selected ? `${selected.date} 各社区明细` : "各社区明细"}
        open={!!selected}
        width="min(1400px, 92vw)"
        destroyOnClose
        onClose={() => setSelectedDate(null)}
        extra={
          selected ? (
            <span className="recon-subcard-caption">
              {selected.previousDate
                ? `${shortDate(selected.previousDate)} 次日 ~ ${shortDate(selected.date)}，共 ${selected.days} 天`
                : "往前找不到上一份记账，算不出欠款增量"}
            </span>
          ) : null
        }
      >
        {selected ? (
          <div className="recon-stack">
            <div className="recon-calc-strip">
              <div className="recon-calc-strip-title">这一天合计</div>
              <div className="recon-calc-grid">
                {[
                  { label: "应收（充值）", value: selected.receivable },
                  { label: "入账 + 欠款增量", value: selected.manualTotal },
                  { label: "差值", value: selected.diff, highlight: true },
                ].map((item) => (
                  <div className={item.highlight ? "recon-calc-item recon-calc-item--highlight" : "recon-calc-item"} key={item.label}>
                    <span className="recon-calc-label">{item.label}</span>
                    <span className={item.highlight && selected.diffCount ? "recon-calc-value recon-diff--alert" : "recon-calc-value"}>
                      <MoneyCell value={item.value} />
                      <em className="recon-calc-unit">RMB</em>
                    </span>
                  </div>
                ))}
                <div className="recon-calc-item">
                  <span className="recon-calc-label">社区</span>
                  <span>
                    {selected.diffCount ? <Tag color="red">有差异 {selected.diffCount}</Tag> : null}
                    {selected.issueCount - selected.diffCount ? <Tag color="orange">缺数据 {selected.issueCount - selected.diffCount}</Tag> : null}
                    {!selected.issueCount ? <Tag color="green">全部一致</Tag> : null}
                  </span>
                </div>
              </div>
            </div>
            <Table<DebtCompareRow>
              className="recon-table"
              rowKey="userId"
              size="small"
              columns={columns}
              dataSource={selected.rows}
              pagination={false}
              scroll={{ x: 1600 }}
              sticky
              rowClassName={(row) => (row.status === "DIFF" ? "recon-row-mismatch" : "")}
              locale={{ emptyText: "没有可核对的上游社区：请先在用户管理把社区设为活跃，或在人工记账里记录社区欠款" }}
            />
          </div>
        ) : null}
      </Drawer>
    </section>
  );
}
