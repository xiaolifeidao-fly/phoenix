"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { DeleteOutlined, EditOutlined, HistoryOutlined, MinusCircleOutlined, PlusOutlined } from "@ant-design/icons";
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
  Popover,
  Select,
  Spin,
  Table,
  Tag,
  Tooltip,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import dayjs, { type Dayjs } from "dayjs";
import { message } from "@/utils/notify";
import { fetchSettleChannels } from "@/app/(console)/manual/api/settle.api";
import { fetchUsers } from "@/app/(console)/user/api/user.api";
import {
  fetchManualBookDetail,
  type ManualBookCompareItem,
  type ManualBookCompareStatus,
  type ManualBookIssue,
  type ManualBookIssueColumn,
  type ManualBookIssueKind,
  type ManualBookDebtCompare,
  type ManualBookLedgerCategory,
  type ManualBookCurrency,
  type ManualBookRecord,
} from "../api/manual-book.api";
import type { ManualBookState } from "../hooks/useManualBook";
import { ManualBookLogModal } from "./ManualBookLogModal";
import { RemoteSearchSelect, type RemoteOption } from "../../workbench/components/RemoteSearchSelect";
import { FormulaGrid, MoneyCell, SectionHead, UpstreamUserCell, money, upstreamUserLabel } from "../../workbench/components/shared";
import { PairCell, signed } from "./PairCell";

interface ManualBookCardProps {
  book: ManualBookState;
  /** 放在标题右侧、操作按钮前面的筛选条件（时间段） */
  filters?: ReactNode;
}

interface DebtFormValue {
  upstreamUserId?: number | null;
  currency: ManualBookCurrency;
  amount?: number | null;
}

interface ManualBookFormValues {
  bookDate: Dayjs;
  currency: ManualBookCurrency;
  balance: number | null;
  exchangeRate?: number | null;
  remark?: string;
  debts: DebtFormValue[];
}

interface CompareRow extends ManualBookCompareItem {
  key: string;
  total?: boolean;
}

const currencyOptions = [
  { label: "U", value: "USDT" },
  { label: "RMB", value: "RMB" },
];

const statusMeta: Record<ManualBookCompareStatus, { label: string; color?: string; tip: string }> = {
  OK: { label: "一致", color: "green", tip: "人工余额与系统应有余额（初始余额 + 之后入账 − 出账）一致" },
  DIFF: { label: "有差异", color: "red", tip: "人工余额与系统应有余额不一致（累计差，看「当天新增」判断是不是这天出的问题）" },
  MISSING: { label: "未记账", tip: "这一天没有人工记账；它的出入账会并到下一份记账的当天利润里" },
  NO_BASELINE: { label: "未设初始余额", color: "orange", tip: "还没在「账户状态」设初始余额，算不出系统应有余额" },
  BEFORE_START: { label: "早于初始余额", tip: "这一天早于初始余额日期，不对比" },
};

/** 差值来源按类别上色，挂在对应那一列的下面 */
const issueKindMeta: Record<ManualBookIssueKind, { label: string; color: string }> = {
  balance: { label: "累计差", color: "red" },
  split: { label: "新增 / 之前", color: "orange" },
  fx: { label: "汇率", color: "purple" },
  carry: { label: "之前带过来", color: "blue" },
  ledger: { label: "等于某类出入账", color: "magenta" },
  neighbor: { label: "日期错位", color: "geekblue" },
  check: { label: "待核对", color: "gold" },
};

const formulas = [
  { label: "怎么看", expression: "余额和利润一格两行：上面「人工」、下面「系统」，对不上的格子标红；差值的可能原因用彩色标签挂在对应那一列下面，悬浮看完整说明" },
  {
    label: "标签颜色",
    expression: (Object.keys(issueKindMeta) as ManualBookIssueKind[]).map((kind) => (
      <Tag key={kind} color={issueKindMeta[kind].color} style={{ marginBottom: 4 }}>
        {issueKindMeta[kind].label}
      </Tag>
    )),
  },
  { label: "基准", expression: "账户状态里的初始余额（带日期）；系统余额只从它累计，不拿人工记的余额当起点" },
  { label: "当天余额", expression: "人工 = 记的截至当天余额（U 按当天汇率折 RMB）；系统 = 初始余额 + 初始余额日期次日到当天的入账 − 出账" },
  { label: "当天利润", expression: "人工 = 当天余额 − 上一份余额（没有上一份时是初始余额）；系统 = 入账 − 出账。余额已经扣过当天出账，所以不用再减" },
  { label: "入账 / 出账", expression: "上一份次日 ~ 当天的出入账，按类目拆开；出账含人工出款、代付 / 代收手续费、服务器出款、其他出账" },
  { label: "差值 / 比例", expression: "差值 = 人工余额 − 系统余额（截至当天的累计差）；比例 = 差值 ÷ |系统余额|；当天新增 = 人工利润 − 系统利润" },
  { label: "截至当天欠款", expression: "这一天各社区欠款合计（累计值）；增量 = 截至当天欠款 − 上一份人工记账的欠款，不参与余额对比" },
  { label: "合计", expression: "终点 = 区间内最后一份；区间利润的起点 = 开始日之前最近一份（初始余额日期之后），没有就是初始余额" },
];

/** 上游社区：suffer「用户管理」列表，按名称 / 账号 / 邮箱 / 手机模糊搜索 */
async function searchUpstreamUsers(keyword: string): Promise<RemoteOption<number>[]> {
  const page = await fetchUsers({ pageIndex: 1, pageSize: 20, search: keyword || undefined });
  return (page.data ?? []).map((user) => ({
    value: Number(user.id),
    label: upstreamUserLabel(user.name, user.username, user.remark),
  }));
}

const shortDate = (value?: string) => (value ? dayjs(value).format("MM-DD") : "");

const ratioText = (value: number | null) => (value === null ? "—" : `${(value * 100).toFixed(2)}%`);

const currencyText = (value?: ManualBookCurrency) => (value === "RMB" ? "RMB" : "U");

export function ManualBookCard({ book, filters }: ManualBookCardProps) {
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ManualBookRecord | null>(null);
  const [previous, setPrevious] = useState<ManualBookRecord | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [defaultRate, setDefaultRate] = useState<number | null>(null);
  const [logRange, setLogRange] = useState<{ start: string; end: string } | null>(null);
  const [form] = Form.useForm<ManualBookFormValues>();
  const formCurrency = Form.useWatch("currency", form);
  const formDebts = Form.useWatch("debts", form);

  const { data } = book;
  const booksById = useMemo(() => new Map((data?.books ?? []).map((item) => [item.id, item])), [data]);

  useEffect(() => {
    fetchSettleChannels()
      .then((channels) => {
        const fallback = channels.find((item) => item.defaultChannel && item.enabled) ?? channels.find((item) => item.exchangeRate);
        setDefaultRate(fallback?.exchangeRate ?? null);
      })
      .catch(() => setDefaultRate(null));
  }, []);

  /** 合计放第一行，每天按日期倒序（最新的在上面） */
  const rows = useMemo<CompareRow[]>(() => {
    if (!data) return [];
    const days = [...data.days].reverse().map((item) => ({ ...item, key: item.date }));
    return data.total ? [{ ...data.total, key: "total", total: true }, ...days] : days;
  }, [data]);

  const needRate = formCurrency === "USDT" || (formDebts ?? []).some((item) => item?.currency === "USDT");
  const previousDebts = useMemo(
    () => new Map((previous?.debts ?? []).map((item) => [item.upstreamUserId, item])),
    [previous],
  );
  /** 编辑或预填时回显社区名称 */
  const knownUsers = useMemo(() => {
    const names = new Map<number, string>();
    [...(previous?.debts ?? []), ...(editing?.debts ?? [])].forEach((item) =>
      names.set(
        item.upstreamUserId,
        upstreamUserLabel(item.upstreamUserName, item.upstreamUsername, item.upstreamRemark) || `#${item.upstreamUserId}`,
      ),
    );
    return names;
  }, [previous, editing]);

  /** 按日期取记账：当天已有就切到修改，没有就带出上一份的币种、汇率和社区（金额留空逐项填） */
  const loadForDate = async (date: Dayjs, editingId?: number) => {
    setDetailLoading(true);
    try {
      const detail = await fetchManualBookDetail(date.format("YYYY-MM-DD"));
      setPrevious(detail.previous);
      if (detail.book) {
        if (editingId !== detail.book.id) {
          message.info(`${date.format("MM-DD")} 已经记过账，已切换为修改`);
        }
        fillFromBook(detail.book);
        return;
      }
      setEditing(null);
      const source = detail.previous;
      form.setFieldsValue({
        bookDate: date,
        currency: source?.currency ?? "USDT",
        balance: null,
        exchangeRate: source?.exchangeRate ?? defaultRate,
        remark: "",
        debts: (source?.debts ?? []).map((item) => ({ upstreamUserId: item.upstreamUserId, currency: item.currency, amount: null })),
      });
    } catch (err) {
      message.error(err instanceof Error ? err.message : "记账加载失败");
    } finally {
      setDetailLoading(false);
    }
  };

  const fillFromBook = (record: ManualBookRecord) => {
    setEditing(record);
    form.setFieldsValue({
      bookDate: dayjs(record.bookDate),
      currency: record.currency,
      balance: record.balance,
      exchangeRate: record.exchangeRate ?? defaultRate,
      remark: record.remark ?? "",
      debts: record.debts.map((item) => ({ upstreamUserId: item.upstreamUserId, currency: item.currency, amount: item.amount })),
    });
  };

  const openForm = (date: Dayjs, record?: ManualBookRecord) => {
    form.resetFields();
    setEditing(record ?? null);
    setPrevious(null);
    setFormOpen(true);
    if (record) {
      fillFromBook(record);
    }
    // 修改时也取一次上一份，用来提示上一份的金额
    void loadForDate(date, record?.id);
  };

  const handleSubmit = async () => {
    const values = await form.validateFields();
    try {
      await book.save(editing?.id ?? null, {
        bookDate: values.bookDate.format("YYYY-MM-DD"),
        currency: values.currency,
        balance: Number(values.balance),
        exchangeRate: needRate ? values.exchangeRate ?? null : null,
        remark: values.remark?.trim() || undefined,
        debts: (values.debts ?? []).map((item) => ({
          upstreamUserId: Number(item.upstreamUserId),
          currency: item.currency,
          amount: Number(item.amount),
        })),
      });
      message.success(editing ? "已更新人工记账" : "已记账");
      setFormOpen(false);
    } catch (err) {
      message.error(err instanceof Error ? err.message : "保存失败");
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await book.remove(id);
      message.success("已删除这一天的记账");
    } catch (err) {
      message.error(err instanceof Error ? err.message : "删除失败");
    }
  };

  const columns: ColumnsType<CompareRow> = [
    {
      title: "日期",
      dataIndex: "date",
      width: 150,
      fixed: "left",
      render: (_, row) => {
        const window = row.baselineDate ? `${shortDate(row.baselineDate)} → ${shortDate(row.date)}` : null;
        if (row.total) {
          return (
            <span>
              <span className="recon-row-name">合计</span>
              <div className="recon-subcard-caption">{window ?? (row.status === "NO_BASELINE" ? "未设初始余额" : "区间内没有可对比的记账")}</div>
            </span>
          );
        }
        return (
          <span>
            <span className="recon-row-name">{row.date}</span>
            {row.gapDays > 1 && window ? (
              <Tooltip title={`中间有天没记账，按 ${window} 共 ${row.gapDays} 天对比`}>
                <div className="recon-subcard-caption">含 {row.gapDays} 天（{window}）</div>
              </Tooltip>
            ) : null}
          </span>
        );
      },
    },
    {
      title: (
        <Tooltip title="上面是人工记的截至当天余额；下面是系统应有余额 = 初始余额 + 之后入账 − 出账。两行对不上的格子标红">
          <span>当天余额 RMB</span>
        </Tooltip>
      ),
      key: "balance",
      width: 190,
      align: "right",
      render: (_, row) =>
        row.status === "MISSING" ? (
          <div>
            <span className="recon-subcard-caption">未记账</span>
            {row.systemBalanceRmb !== null ? (
              <div className="recon-subcard-caption">系统 {money(row.systemBalanceRmb)}</div>
            ) : null}
          </div>
        ) : (
          <div>
            <PairCell
              manual={row.balanceRmb}
              system={row.systemBalanceRmb}
              manualTip={row.currency === "USDT" && row.balance !== null ? `人工记的 ${money(row.balance)} U，按当天汇率折 RMB` : undefined}
              systemTip={
                row.systemBalanceRmb !== null
                  ? `${shortDate(row.openingDate)} 初始余额 ${money(row.openingBalanceRmb)} + 入账 ${money(row.sinceIn)} − 出账 ${money(row.sinceOut)}`
                  : undefined
              }
            />
            {row.currency === "USDT" && row.balance !== null ? (
              <div className="recon-subcard-caption">人工记 {money(row.balance)} U</div>
            ) : null}
            {row.status === "NO_BASELINE" ? (
              <div className="recon-subcard-caption">未设初始余额，算不出系统余额</div>
            ) : row.status === "BEFORE_START" ? (
              <div className="recon-subcard-caption">早于初始余额日期</div>
            ) : row.baselineDate ? (
              <Tooltip
                title={
                  row.baselineIsOpening
                    ? "当天利润从初始余额算起"
                    : `上一份人工记账；同一天的系统余额 ${money(row.baselineSystemBalanceRmb)}`
                }
              >
                <div className="recon-subcard-caption">
                  {row.baselineIsOpening ? "初始余额" : "上一份"} {shortDate(row.baselineDate)}：{money(row.baselineBalanceRmb)}
                </div>
              </Tooltip>
            ) : null}
            <IssueTags issues={row.issues} column="balance" />
          </div>
        ),
    },
    {
      title: (
        <Tooltip title="上面是人工利润 = 当天余额 − 上一份余额（没有上一份时是初始余额）；下面是出入账利润 = 入账 − 出账（出账含手续费）">
          <span>{"当天利润 RMB"}</span>
        </Tooltip>
      ),
      key: "profit",
      width: 180,
      align: "right",
      render: (_, row) => (
        <div>
          <PairCell
            manual={row.manualProfit}
            system={row.ledgerProfit}
            delta
            manualTip={
              row.baselineDate
                ? `${shortDate(row.date)} 余额 − ${shortDate(row.baselineDate)} 余额${row.balanceChange !== null && row.currency === "USDT" ? `（${signed(row.balanceChange)} U）` : ""}`
                : undefined
            }
            systemTip={`入账 ${money(row.ledgerIn)} − 出账 ${money(row.ledgerOut)}`}
          />
          {row.dayFxEffect !== null && Math.abs(row.dayFxEffect) > 0.01 ? (
            <div className="recon-subcard-caption">其中汇率变化 {signed(row.dayFxEffect)}</div>
          ) : null}
          <IssueTags issues={row.issues} column="profit" />
        </div>
      ),
    },
    {
      title: "入账",
      dataIndex: "ledgerIn",
      width: 170,
      align: "right",
      render: (value: number, row) => (
        <div>
          <LedgerBreakdown total={value} categories={row.ledgerCategories} recordType="IN" />
          <IssueTags issues={row.issues} column="in" />
        </div>
      ),
    },
    {
      title: (
        <Tooltip title="含人工出款、代付手续费、代收手续费、服务器出款、其他出账">
          <span>出账（含手续费）</span>
        </Tooltip>
      ),
      dataIndex: "ledgerOut",
      width: 190,
      align: "right",
      render: (value: number, row) => (
        <div>
          <LedgerBreakdown total={value} categories={row.ledgerCategories} recordType="OUT" />
          <IssueTags issues={row.issues} column="out" />
        </div>
      ),
    },
    {
      title: (
        <Tooltip title="人工余额 − 系统余额，是截至当天的累计差；下面的「新增」= 人工利润 − 系统利润，不为 0 说明差异出在这段日期">
          <span>差值 RMB</span>
        </Tooltip>
      ),
      dataIndex: "diff",
      width: 140,
      align: "right",
      render: (value: number | null, row) =>
        value === null ? (
          <span className="recon-subcard-caption">—</span>
        ) : (
          <span className={row.status === "DIFF" ? "recon-diff--alert" : "recon-diff--zero"}>
            <MoneyCell value={value} />
            {row.diffRatio !== null ? <div className="recon-subcard-caption">{ratioText(row.diffRatio)}</div> : null}
            {row.dayDiff !== null && (Math.abs(row.dayDiff) > 0.01 || row.status === "DIFF") ? (
              <div className={Math.abs(row.dayDiff) > 0.01 ? "recon-subcard-caption recon-amount--negative" : "recon-subcard-caption"}>
                {row.total ? "区间新增" : "当天新增"} {signed(row.dayDiff)}
              </div>
            ) : null}
            <IssueTags issues={row.issues} column="diff" />
          </span>
        ),
    },
    {
      title: "状态",
      dataIndex: "status",
      width: 96,
      align: "center",
      render: (value: ManualBookCompareStatus) => (
        <Tooltip title={statusMeta[value].tip}>
          <Tag color={statusMeta[value].color}>{statusMeta[value].label}</Tag>
        </Tooltip>
      ),
    },
    {
      title: (
        <Tooltip title="截至当天各社区欠款合计（累计值，不是当天新增）；下面是比上一份记账多出 / 少了多少">
          <span>截至当天欠款 RMB</span>
        </Tooltip>
      ),
      dataIndex: "debtTotalRmb",
      width: 140,
      align: "right",
      render: (value: number | null, row) =>
        value === null ? (
          <span className="recon-subcard-caption">—</span>
        ) : (
          <Tooltip
            title={
              row.debtBaselineDate
                ? `截至 ${shortDate(row.date)} 欠款 − 截至 ${shortDate(row.debtBaselineDate)} 欠款`
                : "往前找不到上一份记账，算不出增量"
            }
          >
            <span>
              {/* 合计行也是截至区间最后一天的欠款，不是各天相加 */}
              <MoneyCell value={value} />
              {/* 各社区截至当天的账户余额（取当天的快照）合计，悬浮看明细 */}
              {row.debts?.length ? (
                <Popover
                  title={`截至 ${shortDate(row.date)} 各社区欠款`}
                  content={<DebtBreakdown debts={row.debts} changeLabel={row.total ? "区间增量" : "增量"} />}
                  placement="bottom"
                >
                  <div className="recon-subcard-caption" style={{ cursor: "pointer", textDecoration: "underline dotted" }}>
                    {row.debts.length} 个社区 · 账户余额 {balanceSummary(row.debts)}
                  </div>
                </Popover>
              ) : null}
              {row.debtChangeRmb !== null ? (
                <div className="recon-subcard-caption">
                  {row.total ? "区间增量 " : "增量 "}
                  <span className={row.debtChangeRmb < 0 ? "recon-amount--negative" : undefined}>
                    {row.debtChangeRmb > 0 ? "+" : ""}
                    {money(row.debtChangeRmb)}
                  </span>
                </div>
              ) : null}
            </span>
          </Tooltip>
        ),
    },
    {
      title: "操作",
      key: "actions",
      width: 120,
      fixed: "right",
      align: "center",
      render: (_, row) => {
        if (row.total) return null;
        const record = row.bookId ? booksById.get(row.bookId) : undefined;
        // 没记账的天也能看记录：可能是被删掉了
        const history = (
          <Tooltip title="修改记录">
            <Button type="text" size="small" icon={<HistoryOutlined />} onClick={() => setLogRange({ start: row.date, end: row.date })} />
          </Tooltip>
        );
        if (!record) {
          return (
            <>
              <Button type="link" size="small" onClick={() => openForm(dayjs(row.date))}>
                记账
              </Button>
              {history}
            </>
          );
        }
        return (
          <>
            {history}
            <Tooltip title="修改">
              <Button type="text" size="small" icon={<EditOutlined />} onClick={() => openForm(dayjs(record.bookDate), record)} />
            </Tooltip>
            <Popconfirm
              title="删除这一天的记账"
              description="余额和社区欠款一起删除，前后两天的对比会重新计算；删除前的内容保留在修改记录里。"
              okText="删除"
              cancelText="取消"
              okButtonProps={{ danger: true }}
              onConfirm={() => handleDelete(record.id)}
            >
              <Tooltip title="删除">
                <Button type="text" size="small" danger icon={<DeleteOutlined />} />
              </Tooltip>
            </Popconfirm>
          </>
        );
      },
    },
  ];

  const total = data?.total ?? null;

  return (
    <section className="manager-data-card recon-card">
      <SectionHead
        title="人工记账"
        caption="每天记一份截至当天的余额和各社区欠款；人工余额和系统应有余额（初始余额 + 之后入账 − 出账）逐日对照，对不上的标红"
        extra={
          <>
            {filters}
            <Tooltip title="所选日期内所有新增、修改、删除的记录">
              <Button
                icon={<HistoryOutlined />}
                disabled={!data}
                onClick={() => data && setLogRange({ start: data.startDate, end: data.endDate })}
              >
                修改记录
              </Button>
            </Tooltip>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => openForm(dayjs().startOf("day"))}>
              记账
            </Button>
          </>
        }
      />

      {book.error ? (
        <Alert
          type="error"
          showIcon
          message={book.error}
          action={
            <Button size="small" onClick={() => void book.refresh()}>
              重试
            </Button>
          }
        />
      ) : null}

      <div className="recon-stack">
        <div className="recon-calc-strip">
          <div className="recon-calc-strip-title">
            所选日期对比
            <div className="recon-subcard-caption" style={{ fontWeight: 400 }}>
              {data?.openingBalance
                ? `基准：${data.openingBalance.balanceDate} 初始余额 ${money(data.openingBalance.balanceRmb)} RMB`
                : "基准：还没设初始余额，请在对账工作台「账户状态」里设置"}
            </div>
            {total?.baselineDate ? (
              <div className="recon-subcard-caption" style={{ fontWeight: 400 }}>
                区间利润 {total.baselineIsOpening ? "初始余额 " : ""}
                {shortDate(total.baselineDate)} → {shortDate(total.date)}，共 {total.gapDays} 天
              </div>
            ) : null}
          </div>
          <div className="recon-calc-grid">
            <div className="recon-calc-item">
              <span className="recon-calc-label">期末余额</span>
              <PairCell manual={total?.balanceRmb ?? null} system={total?.systemBalanceRmb ?? null} />
            </div>
            <div className="recon-calc-item">
              <span className="recon-calc-label">区间利润</span>
              <PairCell manual={total?.manualProfit ?? null} system={total ? total.ledgerProfit : null} delta />
            </div>
            <div className="recon-calc-item recon-calc-item--highlight">
              <span className="recon-calc-label">差值（累计）</span>
              <span className={total?.status === "DIFF" ? "recon-calc-value recon-diff--alert" : "recon-calc-value"}>
                {total?.diff == null ? <span className="recon-subcard-caption">—</span> : <MoneyCell value={total.diff} />}
                <em className="recon-calc-unit">RMB</em>
                {total?.dayDiff != null ? <div className="recon-subcard-caption">区间新增 {signed(total.dayDiff)}</div> : null}
              </span>
            </div>
            <div className="recon-calc-item">
              <span className="recon-calc-label">差值比例</span>
              <span className={total?.status === "DIFF" ? "recon-calc-value recon-diff--alert" : "recon-calc-value"}>
                <span className="recon-amount">{total?.diff != null ? ratioText(total.diffRatio) : "—"}</span>
              </span>
            </div>
            <div className="recon-calc-item">
              <span className="recon-calc-label">有差异的天数</span>
              <span className={data?.diffDays ? "recon-calc-value recon-diff--alert" : "recon-calc-value"}>
                <span className="recon-amount">{data?.diffDays ?? 0}</span>
                <em className="recon-calc-unit">天</em>
              </span>
            </div>
          </div>
        </div>

        <Table<CompareRow>
          className="recon-table"
          rowKey="key"
          size="small"
          loading={book.loading}
          columns={columns}
          dataSource={rows}
          pagination={false}
          scroll={{ x: 1780, y: 560 }}
          rowClassName={(row) => (row.total ? "recon-row-total" : row.status === "DIFF" ? "recon-row-mismatch" : "")}
          expandable={{
            rowExpandable: (row) =>
              row.total ? (row.debts?.length ?? 0) > 0 : !!row.bookId && (booksById.get(row.bookId)?.debts.length ?? 0) > 0,
            expandedRowRender: (row) =>
              row.total ? (
                <div style={{ padding: "4px 8px" }}>
                  <div className="recon-subcard-caption" style={{ marginBottom: 6 }}>
                    截至 {shortDate(row.date)} 各社区欠款{row.debtBaselineDate ? `，增量相对 ${shortDate(row.debtBaselineDate)}` : ""}
                  </div>
                  <DebtBreakdown debts={row.debts ?? []} changeLabel="区间增量" />
                </div>
              ) : (
                <DebtList record={row.bookId ? booksById.get(row.bookId) : undefined} debts={row.debts} />
              ),
          }}
          locale={{ emptyText: <Empty description="所选日期还没有记账，点「记账」录入截至当天的余额和社区欠款" /> }}
        />
        <FormulaGrid items={formulas} />
      </div>

      <ManualBookLogModal range={logRange} onClose={() => setLogRange(null)} />

      <Modal
        title={editing ? `修改记账（${editing.bookDate}）` : "记账"}
        open={formOpen}
        width={640}
        okText={editing ? "保存" : "确认记账"}
        cancelText="取消"
        destroyOnClose
        confirmLoading={book.submitting}
        okButtonProps={{ disabled: detailLoading }}
        onOk={handleSubmit}
        onCancel={() => setFormOpen(false)}
      >
        <Spin spinning={detailLoading}>
          {!editing && previous ? (
            <Alert
              type="info"
              showIcon
              style={{ marginBottom: 16 }}
              message={`已带出 ${previous.bookDate} 的币种、汇率和社区，金额请按今天的实际值逐项填写`}
            />
          ) : null}
          <Form<ManualBookFormValues> className="manager-form-skin" form={form} layout="vertical" preserve={false}>
            <Form.Item name="bookDate" label="记账日期" rules={[{ required: true, message: "请选择记账日期" }]} extra="每天只有一份；选了已经记过账的日期会切换为修改">
              <DatePicker
                style={{ width: "100%" }}
                allowClear={false}
                disabled={!!editing}
                onChange={(value) => (value ? void loadForDate(value.startOf("day")) : undefined)}
              />
            </Form.Item>
            <Form.Item
              label="截至当天余额"
              required
              extra={`这一天结束时账上还剩多少${previous ? `；截至 ${shortDate(previous.bookDate)}：${money(previous.balance)} ${currencyText(previous.currency)}` : ""}`}
            >
              <div style={{ display: "flex", gap: 8 }}>
                <Form.Item name="currency" noStyle>
                  <Select<ManualBookCurrency> style={{ width: 90 }} options={currencyOptions} />
                </Form.Item>
                <Form.Item name="balance" noStyle rules={[{ required: true, message: "请填写截至当天余额" }]}>
                  <InputNumber<number> precision={2} style={{ flex: 1 }} controls={false} placeholder="例如 86166.04" />
                </Form.Item>
              </div>
            </Form.Item>
            {needRate ? (
              <Form.Item
                name="exchangeRate"
                label="汇率（1U = ? RMB）"
                rules={[
                  { required: true, message: "有按 U 记的金额，请填写汇率" },
                  { type: "number", min: 0.00000001, message: "汇率必须大于 0" },
                ]}
                extra="U 金额按这个汇率折算 RMB 后和出入账对比；默认带出上一份或默认结算通道的汇率"
              >
                <InputNumber<number> precision={4} style={{ width: "100%" }} controls={false} />
              </Form.Item>
            ) : null}

            <Form.Item label="社区欠款" extra="每个社区一天一条，默认按 RMB；负数表示多付">
              <Form.List name="debts">
                {(fields, { add, remove }) => (
                  <div className="recon-stack" style={{ gap: 8 }}>
                    {fields.map((field) => {
                      const userId = form.getFieldValue(["debts", field.name, "upstreamUserId"]) as number | undefined;
                      const last = userId ? previousDebts.get(userId) : undefined;
                      return (
                        <div key={field.key} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                          <Form.Item
                            name={[field.name, "upstreamUserId"]}
                            style={{ flex: "1 1 200px", marginBottom: 0 }}
                            rules={[
                              { required: true, message: "请选择上游社区" },
                              ({ getFieldValue }) => ({
                                validator(_, value) {
                                  const duplicated = (getFieldValue("debts") as DebtFormValue[]).filter((item) => item?.upstreamUserId === value).length > 1;
                                  return duplicated ? Promise.reject(new Error("社区重复了")) : Promise.resolve();
                                },
                              }),
                            ]}
                          >
                            <RemoteSearchSelect<number>
                              placeholder="搜索上游社区"
                              fetchOptions={searchUpstreamUsers}
                              initialOption={userId && knownUsers.has(userId) ? { value: userId, label: knownUsers.get(userId)! } : null}
                            />
                          </Form.Item>
                          <Form.Item name={[field.name, "currency"]} style={{ width: 80, marginBottom: 0 }}>
                            <Select<ManualBookCurrency> options={currencyOptions} />
                          </Form.Item>
                          <Form.Item
                            name={[field.name, "amount"]}
                            style={{ flex: "0 1 150px", marginBottom: 0 }}
                            rules={[{ required: true, message: "请填写金额" }]}
                            extra={last && !editing ? `上一份 ${money(last.amount)}` : undefined}
                          >
                            <InputNumber<number> precision={2} style={{ width: "100%" }} controls={false} placeholder="欠款" />
                          </Form.Item>
                          <Button type="text" danger icon={<MinusCircleOutlined />} onClick={() => remove(field.name)} />
                        </div>
                      );
                    })}
                    <Button type="dashed" icon={<PlusOutlined />} onClick={() => add({ currency: "RMB", amount: null })}>
                      添加社区
                    </Button>
                  </div>
                )}
              </Form.List>
            </Form.Item>
            <Form.Item name="remark" label="备注" rules={[{ max: 255, message: "备注不能超过 255 个字符" }]}>
              <Input.TextArea rows={2} />
            </Form.Item>
          </Form>
        </Spin>
      </Modal>
    </section>
  );
}

/** 展开行：这一天各社区的欠款 */
function DebtList({ record, debts }: { record?: ManualBookRecord; debts?: ManualBookDebtCompare[] }) {
  if (!record) return null;
  return (
    <div className="recon-stack" style={{ gap: 4, padding: "4px 8px" }}>
      {/* 对比数据里带了各社区增量就用它，否则只列当天的欠款 */}
      <DebtBreakdown debts={debts?.length ? debts : record.debts.map((item) => ({ ...item, change: null, changeRmb: null, isNew: false }))} changeLabel="增量" />
      <div className="recon-subcard-caption">
        {record.exchangeRate ? `汇率 1U = ${record.exchangeRate} RMB · ` : ""}
        {record.updatedBy ? `${record.updatedBy} 更新于 ${record.updatedTime ?? ""}` : ""}
        {record.remark ? ` · ${record.remark}` : ""}
      </div>
    </div>
  );
}

/** 各社区欠款：截至当天的金额 + 相对上一份的增量（上一份没有这个社区时标「新增」） */
function DebtBreakdown({ debts, changeLabel }: { debts: ManualBookDebtCompare[]; changeLabel: string }) {
  if (!debts.length) return <span className="recon-subcard-caption">没有记社区欠款</span>;
  const total = debts.reduce((sum, item) => sum + item.amountRmb, 0);
  const live = debts.some((item) => item.upstreamBalanceLive);
  return (
    <div className="recon-stack" style={{ gap: 4, minWidth: 460, maxWidth: 640 }}>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 16 }} className="recon-subcard-caption">
        <span style={{ width: 130, textAlign: "right" }}>截至当天账户余额</span>
        <span style={{ minWidth: 150, textAlign: "right" }}>欠款</span>
      </div>
      {debts.map((item) => (
        <div key={item.upstreamUserId} style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <span style={{ flex: 1, minWidth: 0 }}>
            <UpstreamUserCell
              name={item.upstreamUserName || `#${item.upstreamUserId}`}
              username={item.upstreamUsername}
              remark={item.upstreamRemark}
            />
          </span>
          <span style={{ width: 130, textAlign: "right", whiteSpace: "nowrap" }}>
            <UpstreamBalanceCell debt={item} />
          </span>
          <span style={{ minWidth: 150, textAlign: "right", whiteSpace: "nowrap" }}>
            <MoneyCell value={item.amount} /> <span className="recon-subcard-caption">{currencyText(item.currency)}</span>
            {item.currency === "USDT" ? <span className="recon-subcard-caption">（≈ {money(item.amountRmb)} RMB）</span> : null}
            {item.changeRmb !== null ? (
              <div className="recon-subcard-caption">
                {item.isNew ? "新增" : changeLabel}{" "}
                <span className={item.changeRmb < 0 ? "recon-amount--negative" : undefined}>
                  {item.changeRmb > 0 ? "+" : ""}
                  {money(item.changeRmb)}
                </span>
              </div>
            ) : null}
          </span>
        </div>
      ))}
      <div style={{ display: "flex", alignItems: "center", gap: 16, borderTop: "1px solid var(--manager-border-soft)", paddingTop: 4 }}>
        <span className="recon-row-name" style={{ flex: 1 }}>
          合计
        </span>
        <span style={{ width: 130, textAlign: "right", whiteSpace: "nowrap" }}>
          {balanceSummary(debts)}
        </span>
        <span style={{ minWidth: 150, textAlign: "right", whiteSpace: "nowrap" }}>
          <MoneyCell value={total} /> <span className="recon-subcard-caption">RMB</span>
        </span>
      </div>
      <div className="recon-subcard-caption">
        账户余额是已充值还没消费的部分，取每天 00:00 打的前一天快照，大家看到的都是那天的数
        {live ? "；当天还没打快照，暂时显示当前余额（实时）" : ""}
      </div>
    </div>
  );
}

/** 社区账户余额：有快照显示快照，当天显示实时余额并标出，过去没有快照显示 — */
function UpstreamBalanceCell({ debt }: { debt: ManualBookDebtCompare }) {
  if (debt.upstreamBalance === null || debt.upstreamBalance === undefined) {
    return (
      <Tooltip title="这一天没有余额快照（快照功能上线前，或当天没打上）">
        <span className="recon-subcard-caption">—</span>
      </Tooltip>
    );
  }
  return (
    <Tooltip title={debt.upstreamBalanceLive ? "当天还没打快照，这是当前余额，会随时变化" : `快照时间 ${debt.upstreamBalanceTime ?? ""}`}>
      <span>
        <MoneyCell value={debt.upstreamBalance} />
        {debt.upstreamBalanceLive ? <span className="recon-subcard-caption"> 实时</span> : null}
      </span>
    </Tooltip>
  );
}

/** 有余额的社区合计；全都没有快照时显示 —，部分缺失时标出缺几个 */
function balanceSummary(debts: ManualBookDebtCompare[]) {
  const known = debts.filter((item) => item.upstreamBalance !== null && item.upstreamBalance !== undefined);
  if (!known.length) return "—";
  const total = money(known.reduce((sum, item) => sum + (item.upstreamBalance ?? 0), 0));
  return known.length < debts.length ? `${total}（${debts.length - known.length} 个无快照）` : total;
}

/** 入账 / 出账合计，下面按类目拆开（只列有金额的类目） */
/** 某一列下面的差值来源：彩色短标签，悬浮看完整说明 */
function IssueTags({ issues, column }: { issues?: ManualBookIssue[]; column: ManualBookIssueColumn }) {
  const items = (issues ?? []).filter((issue) => issue.column === column);
  if (!items.length) return null;
  return (
    <div className="recon-issue-tags">
      {items.map((issue) => (
        <Tooltip key={issue.text} title={issue.text}>
          <Tag color={issueKindMeta[issue.kind]?.color} className="recon-issue-tag">
            {issue.label}
          </Tag>
        </Tooltip>
      ))}
    </div>
  );
}

function LedgerBreakdown({
  total,
  categories,
  recordType,
}: {
  total: number;
  categories?: ManualBookLedgerCategory[];
  recordType: "IN" | "OUT";
}) {
  const items = (categories ?? []).filter((item) => item.recordType === recordType && Math.abs(item.amountRmb) > 0.001);
  return (
    <span>
      <MoneyCell value={total} />
      {items.map((item) => (
        <div className="recon-subcard-caption" key={item.category}>
          {item.categoryName} {money(item.amountRmb)}
          {item.count > 1 ? `（${item.count} 笔）` : ""}
        </div>
      ))}
    </span>
  );
}
