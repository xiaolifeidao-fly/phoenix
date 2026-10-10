"use client";

import { useState } from "react";
import { Alert, Button, Drawer, Table, Tag, Tooltip } from "antd";
import type { ColumnsType } from "antd/es/table";
import dayjs from "dayjs";
import { FormulaGrid, MoneyCell, SectionHead, UpstreamUserCell, money } from "../../workbench/components/shared";
import type { DebtCompareDay, DebtCompareRow, DebtCompareStatus } from "../api/manual-book.api";
import type { DebtCompareState } from "../hooks/useDebtCompare";
import { PairCell, signed } from "./PairCell";

interface DebtCompareCardProps {
  compare: DebtCompareState;
}

const statusMeta: Record<DebtCompareStatus, { label: string; color?: string }> = {
  OK: { label: "一致", color: "green" },
  MINOR: { label: "相差较小", color: "gold" },
  DIFF: { label: "有差异", color: "red" },
  NO_MANUAL: { label: "人工未记", color: "orange" },
  BEFORE_START: { label: "早于欠款日期", color: "orange" },
};

const formulas = [
  { label: "怎么看", expression: "每个指标一格两行：上面「人工」、下面「系统」；两行对不上的格子标红" },
  { label: "当天", expression: "充值、入账、手续费、增量只算选中的那天；上一份记账隔了几天时，从上一份的次日算起" },
  { label: "上一份欠款", expression: "人工 = 上一份人工记账的欠款（没有时为初始欠款）；系统 = 截至那天的系统欠款" },
  { label: "当天增量", expression: "人工 = 当天欠款 − 上一份欠款；系统 = 当天充值 − 入账 − 入账代收手续费" },
  { label: "当天欠款", expression: "人工 = 当天人工记账里的欠款；系统 = 初始欠款 + 欠款日期次日到当天的累计增量（也等于系统上一份 + 系统当天增量）" },
  { label: "应收", expression: "人工 = 人工当天增量 + 当天入账 + 当天手续费；系统 = 当天充值。两行的差 = 当天新增差异" },
  { label: "差值", expression: "人工欠款 − 系统欠款（截至当天的累计差异）；「当天新增」= 人工增量 − 系统增量" },
  { label: "初始欠款", expression: "账户状态里的人工录入欠款，是欠款日期那天结束时的欠款；没录按 0、当作所选开始日前一天的欠款" },
];

const empty = <span className="recon-subcard-caption">—</span>;

const shortDate = (value?: string) => (value ? dayjs(value).format("MM-DD") : "");

/** 差值：累计差异，下面一行写当天新增 */
function DiffCell({ diff, dayDiff, alert, ratio }: { diff: number | null; dayDiff: number | null; alert: boolean; ratio?: number | null }) {
  if (diff === null) return empty;
  return (
    <span className={alert ? "recon-diff--alert" : Math.abs(diff) <= 0.01 ? "recon-diff--zero" : undefined}>
      <MoneyCell value={diff} />
      {ratio !== undefined && ratio !== null ? <div className="recon-subcard-caption">{(ratio * 100).toFixed(2)}%</div> : null}
      {dayDiff !== null && Math.abs(dayDiff) > 0.01 ? <div className="recon-subcard-caption">当天新增 {signed(dayDiff)}</div> : null}
    </span>
  );
}

/** 早于欠款日期时系统那边没法算 */
const systemValue = (row: DebtCompareRow, value: number) => (row.status === "BEFORE_START" ? null : value);

const flowTip = (item: { recharge: number; income: number; collectFee: number }) =>
  `充值 ${money(item.recharge)} − 入账 ${money(item.income)} − 代收手续费 ${money(item.collectFee)}`;

/** 当天窗口：一天写 MM-DD，跨几天写 MM-DD ~ MM-DD */
const dayRange = (from: string | undefined, to: string) => (!from || from === to ? shortDate(to) : `${shortDate(from)} ~ ${shortDate(to)}`);

/** 欠款核对：选中某天，看那天的人工 / 系统两套数，对不上的格子标红 */
export function DebtCompareCard({ compare }: DebtCompareCardProps) {
  const { data } = compare;
  /** 抽屉里看的是哪一天；数据刷新后按日期重新取，那天没了就自动关掉 */
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const selected = data?.days.find((day) => day.date === selectedDate) ?? null;
  const latest = data?.days[0] ?? null;

  const dayColumns: ColumnsType<DebtCompareDay> = [
    {
      title: "记账日",
      dataIndex: "date",
      width: 130,
      fixed: "left",
      render: (value: string, day) => (
        <span>
          <span className="recon-row-name">{value}</span>
          <div className="recon-subcard-caption">共 {day.rows.length} 个社区</div>
        </span>
      ),
    },
    {
      title: "当天增量",
      key: "debtChange",
      width: 170,
      align: "right",
      render: (_, day) => (
        <PairCell
          manual={day.manualDebtChange}
          system={day.debtChange}
          delta
          manualTip={`当天欠款 ${money(day.manualDebt)} − 上一份 ${money(day.prevManualDebt)}`}
          systemTip={flowTip(day)}
        />
      ),
    },
    {
      title: "当天欠款",
      key: "debt",
      width: 170,
      align: "right",
      render: (_, day) => <PairCell manual={day.manualDebt} system={day.systemDebt} />,
    },
    {
      title: "当天入账 + 手续费",
      key: "incomeTotal",
      width: 170,
      align: "right",
      render: (_, day) => {
        const total = day.income + day.collectFee;
        const tip = `入账 ${money(day.income)} + 代收手续费 ${money(day.collectFee)}`;
        return <PairCell manual={total} system={total} manualTip={tip} systemTip={tip} />;
      },
    },
    {
      title: "应收",
      key: "receivable",
      width: 170,
      align: "right",
      render: (_, day) => (
        <PairCell
          manual={day.manualReceivable}
          system={day.systemReceivable}
          manualTip={`人工增量 ${money(day.manualDebtChange)} + 入账 ${money(day.income)} + 手续费 ${money(day.collectFee)}`}
          systemTip={`当天充值 ${money(day.recharge)}`}
        />
      ),
    },
    {
      title: "差值 RMB",
      dataIndex: "diff",
      width: 140,
      align: "right",
      render: (value: number, day) => <DiffCell diff={value} dayDiff={day.dayDiff} alert={day.diffCount > 0} />,
    },
    {
      title: "社区",
      key: "count",
      width: 200,
      render: (_, day) => (
        <span>
          {day.diffCount ? <Tag color="red">有差异 {day.diffCount}</Tag> : null}
          {day.issueCount - day.diffCount ? <Tag color="orange">缺数据 {day.issueCount - day.diffCount}</Tag> : null}
          {!day.issueCount ? <Tag color="green">全部一致</Tag> : null}
        </span>
      ),
    },
  ];

  const columns: ColumnsType<DebtCompareRow> = [
    {
      title: "上游社区",
      dataIndex: "name",
      width: 160,
      fixed: "left",
      render: (_, row) => (
        <span>
          <UpstreamUserCell name={row.name || `#${row.userId}`} username={row.username} remark={row.remark} />
          {row.isTrading ? null : <Tag style={{ marginTop: 4 }}>非活跃</Tag>}
        </span>
      ),
    },
    {
      title: "初始欠款",
      dataIndex: "openingDebt",
      width: 130,
      align: "right",
      render: (value: number, row) => (
        <span>
          <MoneyCell value={value} />
          <div className="recon-subcard-caption">
            {row.openingMissing ? "没录，按 0" : row.openingDate ? `${shortDate(row.openingDate)} 的欠款` : "未填欠款日期"}
          </div>
        </span>
      ),
    },
    {
      title: "上一份欠款",
      key: "prevDebt",
      width: 170,
      align: "right",
      render: (_, row) =>
        row.status === "BEFORE_START" ? (
          <span className="recon-subcard-caption">初始欠款是 {shortDate(row.openingDate)} 的</span>
        ) : (
          <div>
            <PairCell manual={row.prevManualDebt} system={row.prevSystemDebt} />
            <div className="recon-subcard-caption">{row.prevIsOpening ? "就是初始欠款" : `${shortDate(row.prevDate)} 记账`}</div>
          </div>
        ),
    },
    {
      title: "当天增量",
      dataIndex: "debtChange",
      width: 170,
      align: "right",
      render: (value: number, row) => (
        <div>
          <PairCell
            manual={row.manualDebtChange}
            system={systemValue(row, value)}
            delta
            manualTip={row.manualDebt === null ? undefined : `当天欠款 ${money(row.manualDebt)} − 上一份 ${money(row.prevManualDebt)}`}
            systemTip={flowTip(row)}
          />
          {row.dayStart && selected && row.dayStart !== selected.date ? (
            <div className="recon-subcard-caption">{dayRange(row.dayStart, selected.date)}</div>
          ) : null}
        </div>
      ),
    },
    {
      title: "当天欠款",
      key: "debt",
      width: 170,
      align: "right",
      render: (_, row) => (
        <PairCell
          manual={row.manualDebt}
          system={systemValue(row, row.systemDebt)}
          manualExtra={
            row.manualCurrency === "USDT" ? (
              <span className="recon-subcard-caption">（{money(row.manualAmount)} U）</span>
            ) : undefined
          }
          systemTip={`初始欠款 ${money(row.openingDebt)} + 欠款日期次日到当天的累计增量 ${money(row.systemDebt - row.openingDebt)}（= 上一份 ${money(row.prevSystemDebt)} + 当天增量 ${money(row.debtChange)}）`}
        />
      ),
    },
    {
      title: "当天入账",
      dataIndex: "income",
      width: 150,
      align: "right",
      render: (value: number, row) => <PairCell manual={systemValue(row, value)} system={systemValue(row, value)} />,
    },
    {
      title: "当天手续费",
      dataIndex: "collectFee",
      width: 140,
      align: "right",
      render: (value: number, row) => <PairCell manual={systemValue(row, value)} system={systemValue(row, value)} />,
    },
    {
      title: "应收",
      key: "receivable",
      width: 170,
      align: "right",
      render: (_, row) => (
        <PairCell
          manual={row.manualReceivable}
          system={systemValue(row, row.systemReceivable)}
          manualTip={
            row.manualDebtChange === null
              ? undefined
              : `人工增量 ${signed(row.manualDebtChange)} + 入账 ${money(row.income)} + 手续费 ${money(row.collectFee)}`
          }
          systemTip={`当天充值 ${money(row.recharge)}`}
        />
      ),
    },
    {
      title: "差值",
      dataIndex: "diff",
      width: 130,
      align: "right",
      render: (value: number | null, row) => <DiffCell diff={value} dayDiff={row.dayDiff} alert={row.status === "DIFF"} ratio={row.diffRatio} />,
    },
    {
      title: "状态",
      dataIndex: "status",
      width: 110,
      align: "center",
      render: (value: DebtCompareStatus) => <Tag color={statusMeta[value]?.color}>{statusMeta[value]?.label ?? value}</Tag>,
    },
    {
      title: "哪里有问题",
      dataIndex: "issues",
      width: 380,
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
        caption="每个记账日一行，点开看各社区当天的数：上面是人工、下面是系统，对不上的格子标红"
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
              {latest
                ? `最新 ${shortDate(latest.date)}：人工欠款 ${money(latest.manualDebt)}，系统欠款 ${money(latest.systemDebt)}，差值 ${money(latest.diff)}；${data?.diffDays ?? 0} 天有差异，点某一天看各社区明细`
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
            scroll={{ x: 1150, y: 320 }}
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
        width="min(1500px, 94vw)"
        destroyOnClose
        onClose={() => setSelectedDate(null)}
        extra={
          selected ? (
            <span className="recon-subcard-caption">充值 / 入账 / 手续费 / 增量只算 {shortDate(selected.date)} 当天；欠款是截至当天的余额</span>
          ) : null
        }
      >
        {selected ? (
          <div className="recon-stack">
            <div className="recon-calc-strip">
              <div className="recon-calc-strip-title">这一天合计</div>
              <div className="recon-calc-grid">
                {[
                  { label: "上一份欠款", manual: selected.prevManualDebt, system: selected.prevSystemDebt },
                  { label: "当天增量", manual: selected.manualDebtChange, system: selected.debtChange, delta: true },
                  { label: "当天欠款", manual: selected.manualDebt, system: selected.systemDebt },
                  { label: "当天入账 + 手续费", manual: selected.income + selected.collectFee, system: selected.income + selected.collectFee },
                  { label: "应收", manual: selected.manualReceivable, system: selected.systemReceivable },
                ].map((item) => (
                  <div className="recon-calc-item" key={item.label}>
                    <span className="recon-calc-label">{item.label}</span>
                    <PairCell manual={item.manual} system={item.system} delta={item.delta} />
                  </div>
                ))}
                <div className="recon-calc-item recon-calc-item--highlight">
                  <span className="recon-calc-label">差值</span>
                  <span className={selected.diffCount ? "recon-calc-value recon-diff--alert" : "recon-calc-value"}>
                    <MoneyCell value={selected.diff} />
                    <em className="recon-calc-unit">RMB</em>
                    {Math.abs(selected.dayDiff) > 0.01 ? <div className="recon-subcard-caption">当天新增 {signed(selected.dayDiff)}</div> : null}
                  </span>
                </div>
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
              scroll={{ x: 1960 }}
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
