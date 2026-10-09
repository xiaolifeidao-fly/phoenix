"use client";

import { useEffect, useState } from "react";
import { ReloadOutlined } from "@ant-design/icons";
import { Button, Drawer, Space, Table, Tag } from "antd";
import type { ColumnsType } from "antd/es/table";
import { message } from "@/utils/notify";
import {
  fetchManualProductScoreChanges,
  type ManualProductRecord,
  type ManualProductScoreChangeRecord,
} from "../../api/product.api";

const DEFAULT_PAGE_SIZE = 20;

interface ManualProductScoreHistoryDrawerProps {
  /** 非空即打开，只看这个人工商品的调价历史 */
  product: ManualProductRecord | null;
  onClose: () => void;
}

/** 单个人工商品的调价（积分变更）历史：按时间倒序、服务端分页 */
export function ManualProductScoreHistoryDrawer({ product, onClose }: ManualProductScoreHistoryDrawerProps) {
  const [records, setRecords] = useState<ManualProductScoreChangeRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [pageIndex, setPageIndex] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const shopCategoryId = product?.id ?? 0;

  const load = async (nextPageIndex: number, nextPageSize: number) => {
    setLoading(true);
    try {
      const result = await fetchManualProductScoreChanges({
        pageIndex: nextPageIndex,
        pageSize: nextPageSize,
        shopCategoryId,
      });
      setRecords(result.data);
      setTotal(result.total);
      setPageIndex(nextPageIndex);
      setPageSize(nextPageSize);
    } catch (error) {
      message.error(error instanceof Error ? error.message : "加载调价历史失败");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (shopCategoryId) {
      void load(1, pageSize);
    } else {
      setRecords([]);
      setTotal(0);
    }
    // 换商品时从第一页拉，翻页由分页器触发
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shopCategoryId]);

  const columns: ColumnsType<ManualProductScoreChangeRecord> = [
    {
      title: "时间",
      dataIndex: "createdTime",
      width: 180,
      render: (value?: string) => formatDateTime(value),
    },
    {
      title: "旧积分",
      dataIndex: "oldScore",
      width: 110,
      render: (value: number | null) => value ?? "-",
    },
    {
      title: "新积分",
      dataIndex: "newScore",
      width: 110,
      render: (value: number | null) => <span style={{ fontWeight: 600 }}>{value ?? "-"}</span>,
    },
    {
      title: "变动",
      key: "scoreDelta",
      width: 110,
      render: (_, record) => <ScoreDeltaTag oldScore={record.oldScore} newScore={record.newScore} />,
    },
    {
      title: "操作人",
      dataIndex: "createdBy",
      width: 140,
      render: (value?: string) => value || "-",
    },
  ];

  return (
    <Drawer
      className="manager-workspace-drawer"
      title={`调价历史${product ? ` · ${product.name || product.code}` : ""}`}
      open={product !== null}
      width={760}
      footer={null}
      onClose={onClose}
    >
      <Space wrap size={12} style={{ marginBottom: 16 }}>
        <Button icon={<ReloadOutlined />} onClick={() => void load(pageIndex, pageSize)}>
          刷新
        </Button>
        <Tag style={{ color: "var(--manager-text-soft)", background: "rgba(170,192,238,0.16)", border: "none" }}>
          共 {total} 条
        </Tag>
      </Space>
      <Table<ManualProductScoreChangeRecord>
        rowKey="id"
        loading={loading}
        dataSource={records}
        columns={columns}
        scroll={{ x: 650 }}
        locale={{ emptyText: "暂无调价记录（上线后修改积分才会记录）" }}
        pagination={{
          current: pageIndex,
          pageSize,
          total,
          showSizeChanger: true,
          pageSizeOptions: [20, 50, 100],
          showTotal: (value) => `共 ${value} 条`,
          onChange: (page, size) => void load(size !== pageSize ? 1 : page, size),
        }}
      />
    </Drawer>
  );
}

function ScoreDeltaTag({ oldScore, newScore }: { oldScore: number | null; newScore: number | null }) {
  if (oldScore === null || newScore === null || oldScore === newScore) {
    return <Tag>-</Tag>;
  }
  const up = newScore > oldScore;
  return <Tag color={up ? "red" : "green"}>{up ? "↑" : "↓"} {Math.abs(newScore - oldScore)}</Tag>;
}

function formatDateTime(value?: string) {
  if (!value) {
    return "-";
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return parsed.toLocaleString("zh-CN", { hour12: false });
}
