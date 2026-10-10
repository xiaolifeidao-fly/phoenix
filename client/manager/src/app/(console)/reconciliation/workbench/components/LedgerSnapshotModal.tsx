"use client";

import { useEffect, useState } from "react";
import { Alert, Empty, Modal, Spin, Tag, Timeline } from "antd";
import {
  LEDGER_TYPE_LABEL,
  fetchLedgerSnapshots,
  type LedgerSnapshotAction,
  type ReconLedgerRecord,
  type ReconLedgerSnapshot,
} from "../api/reconciliation.api";
import { money } from "./shared";

interface LedgerSnapshotModalProps {
  /** 为空时关闭 */
  record: ReconLedgerRecord | null;
  onClose: () => void;
}

const actionMeta: Record<LedgerSnapshotAction, { label: string; color: string }> = {
  ORIGINAL: { label: "原始", color: "gray" },
  CREATE: { label: "新增", color: "green" },
  UPDATE: { label: "修改", color: "blue" },
  RESTORE: { label: "恢复", color: "cyan" },
  DELETE: { label: "删除", color: "red" },
};

/** 快照里逐项对比的字段，值都格式化成展示用的文本，空为 "" */
const fields: { label: string; value: (row: ReconLedgerSnapshot) => string }[] = [
  { label: "日期", value: (row) => row.recordDate },
  { label: "类目", value: (row) => `${LEDGER_TYPE_LABEL[row.recordType] ?? row.recordType} · ${row.categoryName}` },
  {
    label: "金额",
    value: (row) =>
      row.currency === "USDT" && row.amountU != null
        ? `${money(row.amountU)} U（≈ ${money(row.amountRmb)} RMB）`
        : `${money(row.amountRmb)} RMB`,
  },
  { label: "汇率", value: (row) => (row.exchangeRate ? `1U=${row.exchangeRate}` : "") },
  { label: "费率", value: (row) => (row.feeRate != null ? `${Number((row.feeRate * 100).toFixed(4))}%` : "") },
  { label: "通道", value: (row) => row.settleChannelName ?? "" },
  { label: "上游社区", value: (row) => (row.upstreamUserId ? row.upstreamUserName || `#${row.upstreamUserId}` : "") },
  { label: "下游人工用户", value: (row) => (row.userId ? row.username || `#${row.userId}` : "") },
  { label: "备注", value: (row) => row.remark ?? "" },
];

/** 出入账的修改快照：每次人工改动存一版完整内容，修改的版本逐项列出和上一版的差异 */
export function LedgerSnapshotModal({ record, onClose }: LedgerSnapshotModalProps) {
  const [snapshots, setSnapshots] = useState<ReconLedgerSnapshot[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!record) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchLedgerSnapshots(record.id)
      .then((result) => !cancelled && setSnapshots(result))
      .catch((err) => {
        if (!cancelled) {
          setSnapshots([]);
          setError(err instanceof Error ? err.message : "快照加载失败");
        }
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [record]);

  // 最新的在上面；和按版本升序的上一版对比
  const items = snapshots
    .map((snapshot, index) => ({ snapshot, previous: index > 0 ? snapshots[index - 1] : undefined }))
    .reverse();

  return (
    <Modal
      title={record ? `修改快照（${record.recordDate} · ${record.categoryName} · #${record.id}）` : "修改快照"}
      open={!!record}
      footer={null}
      width={680}
      destroyOnClose
      onCancel={onClose}
    >
      <Spin spinning={loading}>
        {error ? <Alert type="error" showIcon message={error} style={{ marginBottom: 12 }} /> : null}
        {!loading && !error && snapshots.length === 0 ? (
          <Empty description="没有修改快照" />
        ) : (
          <div style={{ maxHeight: 560, overflowY: "auto", paddingTop: 8 }}>
            <Timeline
              items={items.map(({ snapshot, previous }, index) => {
                const meta = actionMeta[snapshot.action];
                const changes = previous
                  ? fields
                      .map((field) => ({ label: field.label, before: field.value(previous), after: field.value(snapshot) }))
                      .filter((change) => change.before !== change.after)
                  : [];
                return {
                  color: meta?.color,
                  children: (
                    <div className="recon-stack" style={{ gap: 4 }}>
                      <div>
                        <Tag color={meta?.color}>{meta?.label ?? snapshot.action}</Tag>
                        <span className="recon-row-name">v{snapshot.version} </span>
                        {index === 0 && snapshot.ledgerActive ? <Tag>当前</Tag> : null}
                        <span className="recon-subcard-caption">
                          {snapshot.operator || "-"} · {snapshot.snapshotTime || "-"}
                        </span>
                      </div>
                      {changes.map((change) => (
                        <div key={change.label} style={{ fontSize: 13 }}>
                          <span className="recon-subcard-caption">{change.label}：</span>
                          <span style={change.before ? { textDecoration: "line-through", opacity: 0.6 } : undefined}>
                            {change.before || "（无）"}
                          </span>
                          {" → "}
                          <strong>{change.after || "（清空）"}</strong>
                        </div>
                      ))}
                      {snapshot.action === "DELETE" ? <div style={{ fontSize: 13 }}>记录已删除，以下为删除前的内容</div> : null}
                      <SnapshotContent snapshot={snapshot} />
                    </div>
                  ),
                };
              })}
            />
          </div>
        )}
      </Spin>
    </Modal>
  );
}

/** 这一版的完整内容 */
function SnapshotContent({ snapshot }: { snapshot: ReconLedgerSnapshot }) {
  return (
    <div
      className="recon-subcard-caption"
      style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: "2px 12px" }}
    >
      {fields.map((field) => {
        const value = field.value(snapshot);
        return value ? (
          <span key={field.label}>
            {field.label}：{value}
          </span>
        ) : null;
      })}
    </div>
  );
}
