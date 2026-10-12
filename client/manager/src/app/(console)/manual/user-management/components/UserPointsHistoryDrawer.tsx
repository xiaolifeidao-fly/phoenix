"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CalendarOutlined, ReloadOutlined } from "@ant-design/icons";
import { Alert, Button, DatePicker, Drawer, Empty, Select, Space, Table, Tabs, Tag, Tooltip, Typography } from "antd";
import type { ColumnsType } from "antd/es/table";
import dayjs, { type Dayjs } from "dayjs";
import { dateRangePresets } from "@/utils/date-range-presets";
import {
  MANUAL_POINTS_HISTORY_MAX_DAYS,
  MANUAL_POINTS_SOURCE_LABEL,
  fetchManualUserPointsDaily,
  fetchManualUserPointsRecords,
  type ManualPointsSource,
  type ManualUserPointsDailyRecord,
  type ManualUserPointsRecord,
  type ManualUserRecord,
} from "../../api/user.api";
import { fetchManualWithdrawRecords, formatPaymentType, type ManualWithdrawRecord } from "../../api/withdraw.api";

const { RangePicker } = DatePicker;
const { Text } = Typography;

/** 与列表页一致：10000 积分 = 1 元 */
const POINTS_PER_YUAN = 10000;

const PAGE_SIZE = 20;

type HistoryTab = "summary" | "withdraw" | "detail";

/** 抽屉只需要用户 id、用户名；余额有就显示在右上角 */
export type UserPointsHistoryTarget = Pick<ManualUserRecord, "id" | "username"> &
  Partial<Pick<ManualUserRecord, "activePoints" | "blockPoints">>;

interface UserPointsHistoryDrawerProps {
  user: UserPointsHistoryTarget | null;
  onClose: () => void;
  /** 显示「提现记录」页签（提现和结算管理里打开时用） */
  showWithdraws?: boolean;
}

/** 提现记录页签不展示进行中的提现：待审核 / 审核中 / 结算中 */
const IN_PROGRESS_WITHDRAW_STATUSES = new Set(["UN_APPROVE", "APPROVING", "ACCOUNTING"]);

const withdrawStatusMeta: Record<string, { text: string; color: string }> = {
  FINISH: { text: "提现成功", color: "success" },
  ERROR: { text: "提现失败", color: "error" },
  CANCEL: { text: "取消成功", color: "default" },
  CANCELING: { text: "取消中", color: "default" },
  UN_FINISH: { text: "待完成", color: "default" },
};


/** 默认近 7 天（含今天） */
const buildDefaultRange = (): [Dayjs, Dayjs] => [dayjs().subtract(6, "day").startOf("day"), dayjs().startOf("day")];

const sourceColor: Record<string, string> = {
  TASK_APPROVE: "green",
  CHILDREN: "cyan",
  MANUAL_ADJUST: "orange",
  WITHDRAW: "red",
};

/** 带符号的积分：+1,200 / -3,000，负数标红；0 显示为 0 */
function PointsCell({ value, muted }: { value: number; muted?: boolean }) {
  if (!value) {
    return <Text type="secondary">0</Text>;
  }
  return (
    <Text type={value < 0 ? "danger" : muted ? "secondary" : undefined} style={{ fontVariantNumeric: "tabular-nums" }}>
      {value > 0 ? "+" : ""}
      {value.toLocaleString("zh-CN")}
    </Text>
  );
}

/** 积分 + 下方小字约合金额；0 不显示金额 */
function PointsYuanCell({ value }: { value: number }) {
  return (
    <span>
      <PointsCell value={value} />
      {value ? (
        <div>
          <Text type="secondary" style={{ fontSize: 12 }}>
            ≈ {yuan(value)} 元
          </Text>
        </div>
      ) : null}
    </span>
  );
}

/** 抽屉顶部的余额卡片：大号数字 + 约合金额 */
function BalanceCard({ label, points, color }: { label: string; points: number; color: string }) {
  return (
    <div className="manager-data-card" style={{ padding: "14px 18px", borderLeft: `4px solid ${color}` }}>
      <Text type="secondary" style={{ fontSize: 13 }}>
        {label}
      </Text>
      <div style={{ marginTop: 4, fontSize: 26, fontWeight: 700, lineHeight: 1.3, color, fontVariantNumeric: "tabular-nums" }}>
        {points.toLocaleString("zh-CN")}
        <Text type="secondary" style={{ marginLeft: 6, fontSize: 13, fontWeight: 400 }}>
          积分
        </Text>
      </div>
      <Text type="secondary" style={{ fontSize: 12 }}>
        ≈ {yuan(points)} 元
      </Text>
    </div>
  );
}

function yuan(points: number) {
  return (points / POINTS_PER_YUAN).toLocaleString("zh-CN", { maximumFractionDigits: 4 });
}

/** 用户积分明细：积分汇总（按天）+ 提现记录（可选）+ 积分明细（倒序分页），共用一个日期区间 */
export function UserPointsHistoryDrawer({ user, onClose, showWithdraws = false }: UserPointsHistoryDrawerProps) {
  const [tab, setTab] = useState<HistoryTab>("summary");
  const [range, setRange] = useState<[Dayjs, Dayjs]>(buildDefaultRange);
  const [source, setSource] = useState<ManualPointsSource | undefined>();
  const [page, setPage] = useState(1);

  const [daily, setDaily] = useState<ManualUserPointsDailyRecord[]>([]);
  const [records, setRecords] = useState<ManualUserPointsRecord[]>([]);
  const [withdraws, setWithdraws] = useState<ManualWithdrawRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestSeq = useRef(0);

  const userId = user?.id ?? 0;
  const username = user?.username ?? "";
  const startDate = range[0].format("YYYY-MM-DD");
  const endDate = range[1].format("YYYY-MM-DD");
  const days = range[1].diff(range[0], "day") + 1;

  // 换用户时回到默认状态
  useEffect(() => {
    setTab("summary");
    setRange(buildDefaultRange());
    setSource(undefined);
    setPage(1);
    setDaily([]);
    setRecords([]);
    setWithdraws([]);
    setTotal(0);
    setError(null);
  }, [userId]);

  const load = useCallback(async () => {
    const seq = ++requestSeq.current;
    if (!userId) {
      return;
    }
    if (days > MANUAL_POINTS_HISTORY_MAX_DAYS) {
      setError(`日期区间最长 ${MANUAL_POINTS_HISTORY_MAX_DAYS} 天，请缩小范围`);
      setDaily([]);
      setRecords([]);
      setWithdraws([]);
      setTotal(0);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      if (tab === "summary") {
        const result = await fetchManualUserPointsDaily({ userId, startDate, endDate });
        if (seq === requestSeq.current) {
          setDaily(result);
        }
      } else if (tab === "withdraw") {
        // 按申请时间查，只保留已结束的提现（进行中的在提现记录列表里处理）
        const result = await fetchManualWithdrawRecords({
          username,
          startTime: `${startDate} 00:00:00`,
          endTime: `${endDate} 23:59:59`,
        });
        if (seq === requestSeq.current) {
          setWithdraws(
            result
              .filter((item) => !IN_PROGRESS_WITHDRAW_STATUSES.has(item.status))
              .sort((a, b) => (b.applyTime || "").localeCompare(a.applyTime || "") || b.id - a.id),
          );
        }
      } else {
        const result = await fetchManualUserPointsRecords({ userId, startDate, endDate, source, page, pageSize: PAGE_SIZE });
        if (seq === requestSeq.current) {
          setRecords(result.data);
          setTotal(result.total ?? 0);
        }
      }
    } catch (err) {
      if (seq === requestSeq.current) {
        setError(err instanceof Error ? err.message : "积分数据加载失败");
      }
    } finally {
      if (seq === requestSeq.current) {
        setLoading(false);
      }
    }
  }, [userId, username, tab, startDate, endDate, days, source, page]);

  useEffect(() => {
    void load();
  }, [load]);

  const totals = useMemo(
    () =>
      daily.reduce(
        (sum, day) => ({
          taskPoints: sum.taskPoints + day.taskPoints,
          childrenPoints: sum.childrenPoints + day.childrenPoints,
          adjustPoints: sum.adjustPoints + day.adjustPoints,
          withdrawPoints: sum.withdrawPoints + day.withdrawPoints,
          otherPoints: sum.otherPoints + day.otherPoints,
          netPoints: sum.netPoints + day.netPoints,
        }),
        { taskPoints: 0, childrenPoints: 0, adjustPoints: 0, withdrawPoints: 0, otherPoints: 0, netPoints: 0 },
      ),
    [daily],
  );
  const hasOther = daily.some((day) => day.otherPoints !== 0);

  /** 点汇总里的某一天：切到明细，只看这一天 */
  const openDay = (date: string) => {
    const day = dayjs(date);
    setRange([day, day]);
    setPage(1);
    setTab("detail");
  };

  const dailyColumns: ColumnsType<ManualUserPointsDailyRecord> = [
    {
      title: "日期",
      dataIndex: "date",
      width: 120,
      fixed: "left",
      render: (value: string) => (
        <Tooltip title="查看这一天的明细">
          <Button type="link" size="small" style={{ padding: 0 }} onClick={() => openDay(value)}>
            {value}
          </Button>
        </Tooltip>
      ),
    },
    { title: "任务入账", dataIndex: "taskPoints", width: 110, align: "right", render: (value: number) => <PointsYuanCell value={value} /> },
    { title: "徒弟奖励", dataIndex: "childrenPoints", width: 110, align: "right", render: (value: number) => <PointsYuanCell value={value} /> },
    { title: "人工调整", dataIndex: "adjustPoints", width: 110, align: "right", render: (value: number) => <PointsYuanCell value={value} /> },
    { title: "提现", dataIndex: "withdrawPoints", width: 110, align: "right", render: (value: number) => <PointsYuanCell value={value} /> },
    ...(hasOther
      ? [{ title: "其他", dataIndex: "otherPoints", width: 100, align: "right" as const, render: (value: number) => <PointsYuanCell value={value} /> }]
      : []),
    {
      title: "净变动",
      dataIndex: "netPoints",
      width: 130,
      align: "right",
      render: (value: number) => <PointsYuanCell value={value} />,
    },
  ];

  const withdrawTotal = useMemo(
    () => withdraws.filter((item) => item.status === "FINISH").reduce((sum, item) => sum + Number(item.points || 0), 0),
    [withdraws],
  );

  const withdrawColumns: ColumnsType<ManualWithdrawRecord> = [
    { title: "申请时间", dataIndex: "applyTime", width: 170, fixed: "left", render: (value?: string) => value || "-" },
    {
      title: "积分",
      dataIndex: "points",
      width: 130,
      align: "right",
      render: (value: number) => (
        <span>
          <Text style={{ fontVariantNumeric: "tabular-nums" }}>{Number(value || 0).toLocaleString("zh-CN")}</Text>
          <div>
            <Text type="secondary" style={{ fontSize: 12 }}>
              ≈ {yuan(Number(value || 0))} 元
            </Text>
          </div>
        </span>
      ),
    },
    {
      title: "状态",
      dataIndex: "status",
      width: 100,
      render: (value: string) => {
        const meta = withdrawStatusMeta[value];
        return <Tag color={meta?.color}>{meta?.text || value || "-"}</Tag>;
      },
    },
    {
      title: "支付方式",
      key: "payment",
      width: 200,
      render: (_, record) => (
        <div>
          {formatPaymentType(record.paymentType)}
          <div>
            <Text type="secondary" style={{ fontSize: 12, wordBreak: "break-all" }}>
              {[record.paymentName, record.paymentAccount].filter(Boolean).join(" / ") || "-"}
            </Text>
          </div>
        </div>
      ),
    },
    { title: "审核时间", dataIndex: "approveTime", width: 170, render: (value?: string) => value || "-" },
    {
      title: "备注",
      dataIndex: "description",
      width: 220,
      render: (value?: string) => <div style={{ whiteSpace: "normal", wordBreak: "break-all" }}>{value || "-"}</div>,
    },
    {
      title: "记录ID",
      dataIndex: "id",
      width: 90,
      render: (value: number) => <Text type="secondary">{value || "-"}</Text>,
    },
  ];

  const recordColumns: ColumnsType<ManualUserPointsRecord> = [
    { title: "时间", dataIndex: "createdTime", width: 170, fixed: "left", render: (value?: string) => value || "-" },
    {
      title: "来源",
      dataIndex: "source",
      width: 100,
      render: (value: string | undefined, record) => (
        <Tag color={value ? sourceColor[value] : undefined}>{record.sourceName || value || "-"}</Tag>
      ),
    },
    { title: "积分", dataIndex: "points", width: 110, align: "right", render: (value: number) => <PointsCell value={value} /> },
    {
      title: "变动后余额",
      dataIndex: "balancePoints",
      width: 120,
      align: "right",
      render: (value?: number) => (value == null ? <Text type="secondary">-</Text> : value.toLocaleString("zh-CN")),
    },
    {
      title: "说明",
      dataIndex: "description",
      width: 260,
      render: (value?: string, record?: ManualUserPointsRecord) => (
        <div style={{ whiteSpace: "normal", wordBreak: "break-all" }}>
          {value || "-"}
          {record?.childrenUserId ? (
            <div>
              <Text type="secondary" style={{ fontSize: 12 }}>
                徒弟 #{record.childrenUserId}
              </Text>
            </div>
          ) : null}
        </div>
      ),
    },
    { title: "做单日期", dataIndex: "taskDate", width: 110, render: (value?: string) => value || "-" },
    {
      title: "流水号",
      dataIndex: "serial",
      width: 180,
      render: (value?: string) => (
        <Text type="secondary" style={{ fontSize: 12, wordBreak: "break-all" }}>
          {value || "-"}
        </Text>
      ),
    },
  ];

  return (
    <Drawer
      className="manager-workspace-drawer"
      destroyOnHidden
      open={!!user}
      width="min(1080px, 92vw)"
      title={user ? `积分明细 · ${user.username}` : "积分明细"}
      onClose={onClose}
    >
      <Space direction="vertical" size={12} style={{ width: "100%" }}>
        {user && user.activePoints != null && user.blockPoints != null ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
            <BalanceCard label="当前可用余额" points={user.activePoints} color="var(--manager-primary)" />
            <BalanceCard label="冻结（提现中）" points={user.blockPoints} color="var(--manager-amber)" />
          </div>
        ) : null}
        <Space size={8} wrap>
          <RangePicker
            value={range}
            allowClear={false}
            presets={dateRangePresets}
            suffixIcon={<CalendarOutlined />}
            disabledDate={(current) => current.isAfter(dayjs().endOf("day"))}
            onChange={(value) => {
              if (value?.[0] && value[1]) {
                setRange([value[0].startOf("day"), value[1].startOf("day")]);
                setPage(1);
              }
            }}
          />
          {tab === "detail" ? (
            <Select<ManualPointsSource>
              allowClear
              placeholder="全部来源"
              style={{ width: 140 }}
              value={source}
              options={(Object.keys(MANUAL_POINTS_SOURCE_LABEL) as ManualPointsSource[]).map((value) => ({
                value,
                label: MANUAL_POINTS_SOURCE_LABEL[value],
              }))}
              onChange={(value) => {
                setSource(value);
                setPage(1);
              }}
            />
          ) : null}
          <Button icon={<ReloadOutlined />} onClick={() => void load()}>
            刷新
          </Button>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {tab === "withdraw"
              ? `按申请时间筛选，不含待审核、审核中、结算中的提现，最长 ${MANUAL_POINTS_HISTORY_MAX_DAYS} 天`
              : tab === "summary"
                ? `任务入账、徒弟奖励取积分日汇总表；人工调整、提现取流水（按流水时间归日，流水被清理的日期为 0），最长 ${MANUAL_POINTS_HISTORY_MAX_DAYS} 天`
                : `按做单日期统计（人工调整、提现等无做单日期的按流水时间），最长 ${MANUAL_POINTS_HISTORY_MAX_DAYS} 天；提现在提现成功时扣除`}
          </Text>
        </Space>

        {error ? (
          <Alert
            type="error"
            showIcon
            message={error}
            action={
              <Button size="small" onClick={() => void load()}>
                重试
              </Button>
            }
          />
        ) : null}

        <Tabs
          activeKey={tab}
          onChange={(key) => setTab(key as HistoryTab)}
          items={[
            {
              key: "summary",
              label: "积分汇总",
              children: (
                <Table<ManualUserPointsDailyRecord>
                  rowKey="date"
                  size="small"
                  loading={loading}
                  columns={dailyColumns}
                  dataSource={daily}
                  pagination={false}
                  scroll={{ x: 790, y: "calc(100vh - 360px)" }}
                  locale={{ emptyText: <Empty description="所选日期内没有积分变动" /> }}
                  summary={() =>
                    daily.length ? (
                      <Table.Summary fixed="top">
                        <Table.Summary.Row style={{ fontWeight: 600 }}>
                          <Table.Summary.Cell index={0}>合计（{daily.length} 天）</Table.Summary.Cell>
                          <Table.Summary.Cell index={1} align="right">
                            <PointsYuanCell value={totals.taskPoints} />
                          </Table.Summary.Cell>
                          <Table.Summary.Cell index={2} align="right">
                            <PointsYuanCell value={totals.childrenPoints} />
                          </Table.Summary.Cell>
                          <Table.Summary.Cell index={3} align="right">
                            <PointsYuanCell value={totals.adjustPoints} />
                          </Table.Summary.Cell>
                          <Table.Summary.Cell index={4} align="right">
                            <PointsYuanCell value={totals.withdrawPoints} />
                          </Table.Summary.Cell>
                          {hasOther ? (
                            <Table.Summary.Cell index={5} align="right">
                              <PointsYuanCell value={totals.otherPoints} />
                            </Table.Summary.Cell>
                          ) : null}
                          <Table.Summary.Cell index={hasOther ? 6 : 5} align="right">
                            <PointsYuanCell value={totals.netPoints} />
                          </Table.Summary.Cell>
                        </Table.Summary.Row>
                      </Table.Summary>
                    ) : null
                  }
                />
              ),
            },
            ...(showWithdraws
              ? [
                  {
                    key: "withdraw",
                    label: "提现记录",
                    children: (
                      <Table<ManualWithdrawRecord>
                        rowKey="id"
                        size="small"
                        loading={loading}
                        columns={withdrawColumns}
                        dataSource={withdraws}
                        pagination={false}
                        scroll={{ x: 1080, y: "calc(100vh - 360px)" }}
                        locale={{ emptyText: <Empty description="所选日期内没有已结束的提现" /> }}
                        summary={() =>
                          withdraws.length ? (
                            <Table.Summary fixed="top">
                              <Table.Summary.Row style={{ fontWeight: 600 }}>
                                <Table.Summary.Cell index={0}>共 {withdraws.length} 笔</Table.Summary.Cell>
                                <Table.Summary.Cell index={1} align="right">
                                  {withdrawTotal.toLocaleString("zh-CN")}
                                  <div>
                                    <Text type="secondary" style={{ fontSize: 12, fontWeight: 400 }}>
                                      提现成功合计 ≈ {yuan(withdrawTotal)} 元
                                    </Text>
                                  </div>
                                </Table.Summary.Cell>
                                <Table.Summary.Cell index={2} colSpan={5} />
                              </Table.Summary.Row>
                            </Table.Summary>
                          ) : null
                        }
                      />
                    ),
                  },
                ]
              : []),
            {
              key: "detail",
              label: "积分明细",
              children: (
                <Table<ManualUserPointsRecord>
                  rowKey="id"
                  size="small"
                  loading={loading}
                  columns={recordColumns}
                  dataSource={records}
                  scroll={{ x: 1030 }}
                  pagination={{
                    current: page,
                    pageSize: PAGE_SIZE,
                    total,
                    showSizeChanger: false,
                    showTotal: (count) => `共 ${count} 条`,
                    onChange: setPage,
                  }}
                  locale={{ emptyText: <Empty description="所选日期内没有积分明细" /> }}
                />
              ),
            },
          ]}
        />
      </Space>
    </Drawer>
  );
}
