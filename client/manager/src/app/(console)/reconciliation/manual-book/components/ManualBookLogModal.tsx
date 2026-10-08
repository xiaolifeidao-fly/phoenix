"use client";

import { useEffect, useState } from "react";
import { Alert, Empty, Modal, Spin, Tag, Timeline } from "antd";
import { fetchManualBookLogs, type ManualBookLog, type ManualBookLogAction } from "../api/manual-book.api";

interface ManualBookLogModalProps {
  /** 为空时关闭；查一天时 start、end 相同 */
  range: { start: string; end: string } | null;
  onClose: () => void;
}

const actionMeta: Record<ManualBookLogAction, { label: string; color: string }> = {
  CREATE: { label: "新增", color: "green" },
  UPDATE: { label: "修改", color: "blue" },
  DELETE: { label: "删除", color: "red" },
};

/** 人工记账的修改记录：每次新增 / 修改 / 删除一条，逐项列出改了什么 */
export function ManualBookLogModal({ range, onClose }: ManualBookLogModalProps) {
  const [logs, setLogs] = useState<ManualBookLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!range) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchManualBookLogs(range.start, range.end)
      .then((result) => !cancelled && setLogs(result))
      .catch((err) => {
        if (!cancelled) {
          setLogs([]);
          setError(err instanceof Error ? err.message : "修改记录加载失败");
        }
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [range]);

  const single = range && range.start === range.end;

  return (
    <Modal
      title={range ? `修改记录（${single ? range.start : `${range.start} ~ ${range.end}`}）` : "修改记录"}
      open={!!range}
      footer={null}
      width={640}
      destroyOnClose
      onCancel={onClose}
    >
      <Spin spinning={loading}>
        {error ? <Alert type="error" showIcon message={error} style={{ marginBottom: 12 }} /> : null}
        {!loading && !error && logs.length === 0 ? (
          <Empty description="没有修改记录" />
        ) : (
          <div style={{ maxHeight: 560, overflowY: "auto", paddingTop: 8 }}>
            <Timeline
              items={logs.map((log) => ({
                color: actionMeta[log.action]?.color,
                children: (
                  <div className="recon-stack" style={{ gap: 4 }}>
                    <div>
                      <Tag color={actionMeta[log.action]?.color}>{actionMeta[log.action]?.label ?? log.action}</Tag>
                      {single ? null : <span className="recon-row-name">{log.bookDate} </span>}
                      <span className="recon-subcard-caption">
                        {log.operator || "-"} · {log.time}
                      </span>
                    </div>
                    {log.changes.map((change, index) => (
                      <div key={`${change.label}-${index}`} style={{ fontSize: 13 }}>
                        <span className="recon-subcard-caption">{change.label}：</span>
                        {log.action === "UPDATE" ? (
                          <>
                            <span style={change.before ? { textDecoration: "line-through", opacity: 0.6 } : undefined}>
                              {change.before || "（无）"}
                            </span>
                            {" → "}
                            <strong>{change.after || "（删除）"}</strong>
                          </>
                        ) : (
                          <span>{change.after ?? change.before}</span>
                        )}
                      </div>
                    ))}
                  </div>
                ),
              }))}
            />
          </div>
        )}
      </Spin>
    </Modal>
  );
}
