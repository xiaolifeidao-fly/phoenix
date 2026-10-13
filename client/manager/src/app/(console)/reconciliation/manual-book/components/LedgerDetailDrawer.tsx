"use client";

import { useEffect, useState } from "react";
import {
  Alert,
  Button,
  Drawer,
  Input,
  Segmented,
  Table,
  Tag,
  Tooltip,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import dayjs from "dayjs";
import {
  LEDGER_CATEGORIES,
  LEDGER_TYPE_LABEL,
  fetchLedgerPage,
  type LedgerRecordType,
  type ReconLedgerRecord,
} from "../../workbench/api/reconciliation.api";
import {
  LedgerAmount,
  LedgerSourceTag,
  money,
} from "../../workbench/components/shared";
import type { ManualBookLedgerCategory } from "../api/manual-book.api";

/** 抽屉要查的范围：日期窗口 + 方向，category 为空表示这个方向下全部类目 */
export interface LedgerDetailTarget {
  startDate: string;
  endDate: string;
  recordType: LedgerRecordType;
  category?: string;
  /** 对比表里这一格的数字，用来核对 */
  total: number;
  categories?: ManualBookLedgerCategory[];
  /** 初始余额当天：这些出入账已含在初始余额里，只做展示 */
  inOpening?: boolean;
}

const PAGE_SIZE = 20;
const ALL = "ALL";

/** 只展示、不计入出账合计和余额的类目：代收手续费 */
export const DISPLAY_ONLY_CATEGORY = "COLLECT_FEE";

/** 上下游用户名点一下即按它筛选 */
function buildColumns(
  onPickUser: (name: string) => void,
): ColumnsType<ReconLedgerRecord> {
  return [
    { title: "日期", dataIndex: "recordDate", width: 110 },
    {
      title: "类目",
      dataIndex: "categoryName",
      width: 190,
      render: (value: string, record) => (
        <span style={{ whiteSpace: "nowrap" }}>
          {value}
          <LedgerSourceTag record={record} />
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
          {record.feeRate != null ? (
            <div>{`${Number((record.feeRate * 100).toFixed(4))}%`}</div>
          ) : null}
        </span>
      ),
    },
    {
      title: "通道",
      dataIndex: "settleChannelName",
      width: 100,
      render: (value?: string) => value || "-",
    },
    {
      title: "上下游用户",
      key: "user",
      width: 140,
      render: (_, record) => {
        const name = record.upstreamUserId
          ? record.upstreamUserName
          : record.username;
        const label = record.upstreamUserId
          ? `上游 ${record.upstreamUserName || `#${record.upstreamUserId}`}`
          : record.username || (record.userId ? `#${record.userId}` : "-");
        return (
          <span>
            {name ? (
              <Tooltip title="只看这个用户">
                <span
                  className="recon-link-amount"
                  onClick={() => onPickUser(name)}
                >
                  {label}
                </span>
              </Tooltip>
            ) : (
              label
            )}
            {record.points ? (
              <div className="recon-subcard-caption">{`${money(record.points)} 积分`}</div>
            ) : null}
          </span>
        );
      },
    },
    {
      title: "备注",
      dataIndex: "remark",
      width: 180,
      render: (value?: string) => value || "-",
    },
  ];
}

/** 人工记账对比里点入账 / 出账：按日期窗口 + 类型查出入账明细（只读） */
export function LedgerDetailDrawer({
  target,
  onClose,
}: {
  target: LedgerDetailTarget | null;
  onClose: () => void;
}) {
  const [category, setCategory] = useState<string>(ALL);
  const [page, setPage] = useState(1);
  const [records, setRecords] = useState<ReconLedgerRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  /** 输入框里的字；停顿 300ms 后才作为 userKeyword 去查 */
  const [userInput, setUserInput] = useState("");
  const [userKeyword, setUserKeyword] = useState("");

  useEffect(() => {
    setCategory(target?.category ?? ALL);
    setPage(1);
    setUserInput("");
    setUserKeyword("");
  }, [target]);

  useEffect(() => {
    const keyword = userInput.trim();
    if (keyword === userKeyword) return;
    const timer = setTimeout(() => {
      setUserKeyword(keyword);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [userInput, userKeyword]);

  const pickUser = (name: string) => {
    setUserInput(name);
    setUserKeyword(name);
    setPage(1);
  };

  useEffect(() => {
    if (!target) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchLedgerPage({
      startDate: target.startDate,
      endDate: target.endDate,
      recordType: target.recordType,
      category: category === ALL ? undefined : category,
      userKeyword: userKeyword || undefined,
      sortField: "date",
      sortOrder: "desc",
      page,
      pageSize: PAGE_SIZE,
    })
      .then((result) => {
        if (cancelled) return;
        setRecords(result.data ?? []);
        setTotal(result.total ?? 0);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setRecords([]);
        setTotal(0);
        setError(err instanceof Error ? err.message : "查询失败");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [target, category, userKeyword, page, reloadKey]);

  if (!target) return null;

  const typeLabel = LEDGER_TYPE_LABEL[target.recordType];
  const byCategory = new Map(
    (target.categories ?? [])
      .filter((item) => item.recordType === target.recordType)
      .map((item) => [item.category, item]),
  );
  const options = [
    { value: ALL, label: `全部 ${money(target.total)}` },
    ...LEDGER_CATEGORIES.filter((item) => item.type === target.recordType).map(
      (item) => {
        const summary = byCategory.get(item.value);
        return {
          value: item.value,
          label: summary
            ? `${item.label} ${money(summary.amountRmb)}`
            : item.label,
        };
      },
    ),
  ];
  const selected = category === ALL ? null : byCategory.get(category);
  const displayOnly = byCategory.get(DISPLAY_ONLY_CATEGORY);
  const expectedAmount =
    category === ALL ? target.total : (selected?.amountRmb ?? 0);
  const expectedCount = category === ALL ? undefined : (selected?.count ?? 0);
  const sameDay = target.startDate === target.endDate;
  const range = sameDay
    ? target.endDate
    : `${target.startDate} ~ ${target.endDate}`;
  const categoryLabel =
    category === ALL
      ? "全部"
      : (LEDGER_CATEGORIES.find((item) => item.value === category)?.label ??
        category);

  return (
    <Drawer
      title={`${range} · ${typeLabel} · ${categoryLabel}`}
      open
      width="min(1100px, 94vw)"
      onClose={onClose}
      extra={
        !sameDay ? (
          <span className="recon-subcard-caption">
            上一份记账次日 ~ 当天，共{" "}
            {dayjs(target.endDate).diff(dayjs(target.startDate), "day") + 1} 天
          </span>
        ) : null
      }
    >
      <div className="recon-stack">
        <Segmented
          value={category}
          options={options}
          onChange={(value) => {
            setCategory(String(value));
            setPage(1);
          }}
        />
        <Input
          allowClear
          style={{ maxWidth: 320 }}
          placeholder="上下游用户：做单用户名 / 上游社区名称"
          value={userInput}
          onChange={(event) => setUserInput(event.target.value)}
        />
        <div className="recon-subcard-caption">
          {userKeyword ? `「${userKeyword}」共 ${total} 笔` : `共 ${total} 笔`}
          {!userKeyword &&
          expectedCount !== undefined &&
          expectedCount !== total &&
          !loading &&
          !error ? (
            <Tag color="orange" style={{ marginInlineStart: 6 }}>
              对比表里是 {expectedCount} 笔
            </Tag>
          ) : null}
          ；对比表里合计 {money(expectedAmount)} RMB（U 记录按折算值
          {userKeyword ? "，不随用户筛选变化" : ""}）
          {category === ALL &&
          displayOnly &&
          Math.abs(displayOnly.amountRmb) > 0.001
            ? `；下面的明细含代收手续费 ${money(displayOnly.amountRmb)}，它只做展示，不计入合计`
            : null}
          {category === DISPLAY_ONLY_CATEGORY
            ? "；代收手续费只做展示，不从余额扣除，不计入出账合计"
            : null}
        </div>
        {target.inOpening ? (
          <Alert
            type="info"
            showIcon
            message="初始余额是这天的日终余额，这些出入账已含在里面，不参与利润和差值对比"
          />
        ) : null}
        {error ? (
          <Alert
            type="error"
            showIcon
            message={error}
            action={
              <Button
                size="small"
                onClick={() => setReloadKey((key) => key + 1)}
              >
                重试
              </Button>
            }
          />
        ) : null}
        <Table<ReconLedgerRecord>
          className="recon-table"
          rowKey="id"
          size="small"
          loading={loading}
          columns={buildColumns(pickUser)}
          dataSource={records}
          scroll={{ x: 980 }}
          pagination={{
            current: page,
            pageSize: PAGE_SIZE,
            total,
            showSizeChanger: false,
            onChange: setPage,
          }}
          locale={{
            emptyText: userKeyword
              ? `这段日期没有「${userKeyword}」的${typeLabel}记录`
              : `这段日期没有${typeLabel}记录`,
          }}
        />
      </div>
    </Drawer>
  );
}
