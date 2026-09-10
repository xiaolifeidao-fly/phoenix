"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ReloadOutlined } from "@ant-design/icons";
import { Button, Empty, Modal, Progress, Select, Space, Table, Tooltip, Typography } from "antd";
import type { ColumnsType } from "antd/es/table";
import { message } from "@/utils/notify";
import {
  ORDER_MANUAL_STATUS_LABELS,
  fetchOrderManualDetailUsers,
  fetchOrderManualDetails,
  type OrderManualRecord,
  type OrderManualUserSummary,
  type OrderRecord,
} from "../api/order.api";

const { Text, Title } = Typography;

const DEFAULT_PAGE_SIZE = 20;

/** barry order_record 状态对应 globals.css 中的 order-status-tag--* */
const MANUAL_STATUS_TONE: Record<string, "neutral" | "active" | "success" | "warning" | "danger"> = {
  PENDING: "active",
  UN_CHECK: "warning",
  CHECKED: "success",
  CHECK_ERROR: "danger",
  DELETE: "neutral",
  SECRET: "neutral",
  UN_AUTHORIZE: "neutral",
};

interface OrderManualDetailModalProps {
  open: boolean;
  order: OrderRecord | null;
  onClose: () => void;
}

const formatNumber = (value?: number) => (value == null ? "-" : value.toLocaleString("zh-CN"));

const formatDateTime = (value?: string) => (value ? value.replace("T", " ").slice(0, 19) : "-");

/**
 * 订单的做单明细弹框：上方是做单人分布（barry order_record 按做单用户聚合），
 * 下方是做单明细分页，可按做单用户筛选。数据全部由 barry-inner 转发。
 */
export function OrderManualDetailModal({ open, order, onClose }: OrderManualDetailModalProps) {
  const [users, setUsers] = useState<OrderManualUserSummary[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [records, setRecords] = useState<OrderManualRecord[]>([]);
  const [recordsLoading, setRecordsLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [userId, setUserId] = useState<number | undefined>(undefined);
  /** barry 是否有该订单对应的商品记录，没有时列表和分布都为空 */
  const [shopMatched, setShopMatched] = useState(true);

  const orderId = order?.id;
  /** 明细请求序号，翻页与筛选连点时只认最后一次请求的结果 */
  const recordsRequestRef = useRef(0);

  const loadUsers = useCallback(async (currentOrderId: number) => {
    setUsersLoading(true);
    try {
      setUsers(await fetchOrderManualDetailUsers(currentOrderId));
    } catch (error) {
      message.error(error instanceof Error ? error.message : "加载做单人分布失败");
    } finally {
      setUsersLoading(false);
    }
  }, []);

  const loadRecords = useCallback(
    async (currentOrderId: number, nextPage: number, nextPageSize: number, nextUserId?: number) => {
      const requestId = recordsRequestRef.current + 1;
      recordsRequestRef.current = requestId;
      setRecordsLoading(true);
      try {
        const result = await fetchOrderManualDetails({
          orderId: currentOrderId,
          userId: nextUserId,
          page: nextPage,
          pageSize: nextPageSize,
        });
        if (recordsRequestRef.current !== requestId) {
          return;
        }
        setRecords(result.records ?? []);
        setTotal(result.total ?? 0);
        setPage(result.page ?? nextPage);
        setPageSize(result.pageSize ?? nextPageSize);
        setShopMatched(Boolean(result.shopId));
      } catch (error) {
        if (recordsRequestRef.current !== requestId) {
          return;
        }
        message.error(error instanceof Error ? error.message : "加载做单明细失败");
      } finally {
        if (recordsRequestRef.current === requestId) {
          setRecordsLoading(false);
        }
      }
    },
    [],
  );

  useEffect(() => {
    if (!open || !orderId) {
      setUsers([]);
      setRecords([]);
      setTotal(0);
      setPage(1);
      setPageSize(DEFAULT_PAGE_SIZE);
      setUserId(undefined);
      setShopMatched(true);
      return;
    }
    void loadUsers(orderId);
    void loadRecords(orderId, 1, DEFAULT_PAGE_SIZE, undefined);
  }, [loadRecords, loadUsers, open, orderId]);

  const handleUserChange = (nextUserId?: number) => {
    setUserId(nextUserId);
    setPage(1);
    if (orderId) {
      void loadRecords(orderId, 1, pageSize, nextUserId);
    }
  };

  const handleRefresh = () => {
    if (!orderId) {
      return;
    }
    void loadUsers(orderId);
    void loadRecords(orderId, page, pageSize, userId);
  };

  const summary = useMemo(() => {
    return users.reduce(
      (acc, item) => ({
        orderNum: acc.orderNum + (item.orderNum ?? 0),
        upAccountNum: acc.upAccountNum + (item.upAccountNum ?? 0),
        pendingNum: acc.pendingNum + (item.pendingNum ?? 0),
        checkedNum: acc.checkedNum + (item.checkedNum ?? 0),
      }),
      { orderNum: 0, upAccountNum: 0, pendingNum: 0, checkedNum: 0 },
    );
  }, [users]);

  const userColumns: ColumnsType<OrderManualUserSummary> = [
    {
      title: "做单用户",
      key: "user",
      width: 200,
      render: (_, record) => (
        <div className="order-record-cell">
          <Text strong className="order-record-cell__primary">{record.username || `用户 #${record.userId}`}</Text>
          <Text className="order-record-cell__meta">
            ID {record.userId}
            {record.channel ? ` · ${record.channel}` : ""}
          </Text>
        </div>
      ),
    },
    {
      title: "做单数",
      key: "orderNum",
      width: 200,
      sorter: (a, b) => a.orderNum - b.orderNum,
      defaultSortOrder: "descend",
      render: (_, record) => {
        const percent = summary.orderNum > 0 ? Math.round((record.orderNum / summary.orderNum) * 100) : 0;
        return (
          <div className="order-record-cell">
            <div className="order-record-cell__metric-row">
              <span><b className="order-num">{formatNumber(record.orderNum)}</b> 条</span>
              <span>占比 {percent}%</span>
            </div>
            <Progress percent={percent} showInfo={false} size="small" />
          </div>
        );
      },
    },
    {
      title: "上号账号数",
      dataIndex: "upAccountNum",
      width: 110,
      align: "right",
      sorter: (a, b) => a.upAccountNum - b.upAccountNum,
      render: (value: number) => <span className="order-num">{formatNumber(value)}</span>,
    },
    {
      title: "未提交",
      dataIndex: "pendingNum",
      width: 96,
      align: "right",
      sorter: (a, b) => a.pendingNum - b.pendingNum,
      render: (value: number) => <span className="order-num">{formatNumber(value)}</span>,
    },
    {
      title: "审核中",
      dataIndex: "unCheckNum",
      width: 96,
      align: "right",
      render: (value: number) => <span className="order-num">{formatNumber(value)}</span>,
    },
    {
      title: "审核成功",
      dataIndex: "checkedNum",
      width: 96,
      align: "right",
      render: (value: number) => <span className="order-num">{formatNumber(value)}</span>,
    },
    {
      title: "审核失败",
      dataIndex: "checkErrorNum",
      width: 96,
      align: "right",
      render: (value: number) => <span className="order-num">{formatNumber(value)}</span>,
    },
  ];

  const recordColumns: ColumnsType<OrderManualRecord> = [
    {
      title: "记录 / 时间",
      key: "record",
      width: 220,
      render: (_, record) => (
        <div className="order-record-cell">
          <Text strong className="order-record-cell__primary order-record-cell__id">#{record.id}</Text>
          <Text className="order-record-cell__meta">接单：{formatDateTime(record.createdTime)}</Text>
          <Text className="order-record-cell__meta">更新：{formatDateTime(record.updatedTime)}</Text>
          <Text className="order-record-cell__meta">过期：{formatDateTime(record.expireTime)}</Text>
        </div>
      ),
    },
    {
      title: "做单用户",
      key: "user",
      width: 176,
      render: (_, record) => (
        <div className="order-record-cell">
          <Text strong className="order-record-cell__primary">{record.username || `用户 #${record.userId}`}</Text>
          <Text className="order-record-cell__meta">
            ID {record.userId}
            {record.channel ? ` · ${record.channel}` : ""}
          </Text>
        </div>
      ),
    },
    {
      title: "上号账号",
      key: "uid",
      width: 200,
      render: (_, record) => (
        <div className="order-record-cell">
          <Tooltip title={record.uid || "无 UID"}>
            <Text
              className="order-record-cell__primary"
              ellipsis
              copyable={record.uid ? { text: record.uid, tooltips: ["复制 UID", "已复制"] } : false}
            >
              {record.uid || "-"}
            </Text>
          </Tooltip>
          <Text className="order-record-cell__meta">类型：{record.uidType || "-"}</Text>
        </div>
      ),
    },
    {
      title: "状态",
      dataIndex: "orderStatus",
      width: 106,
      align: "center",
      render: (value: string) => (
        <span className={`order-status-tag order-status-tag--${MANUAL_STATUS_TONE[value] ?? "neutral"}`}>
          {ORDER_MANUAL_STATUS_LABELS[value] ?? value ?? "-"}
        </span>
      ),
    },
    {
      title: "数量 / 积分",
      key: "num",
      width: 150,
      render: (_, record) => (
        <div className="order-record-cell">
          <Text className="order-record-cell__primary">
            {formatNumber(record.startNum)} → {formatNumber(record.endNum)}
          </Text>
          <Text className="order-record-cell__meta">积分 {formatNumber(record.orderScore)}</Text>
        </div>
      ),
    },
    {
      title: "分发 / 标签",
      key: "assign",
      width: 160,
      render: (_, record) => (
        <div className="order-record-cell">
          <Text className="order-record-cell__primary">分发 #{record.assignmentId || "-"}</Text>
          <Tooltip title={record.tag || "无标签"}>
            <Text className="order-record-cell__meta" ellipsis>标签：{record.tag || "-"}</Text>
          </Tooltip>
        </div>
      ),
    },
    {
      title: "说明",
      dataIndex: "description",
      render: (value: string) => (
        <Tooltip title={value || "无说明"}>
          <Text className="order-record-cell__meta" ellipsis>{value || "-"}</Text>
        </Tooltip>
      ),
    },
  ];

  const emptyDescription = shopMatched
    ? "当前筛选条件下暂无做单明细"
    : "该订单在 barry 未找到进件或商品记录，暂无做单数据";

  return (
    <Modal
      open={open}
      onCancel={onClose}
      title={`做单明细 · 订单 #${orderId ?? "-"}`}
      width={1160}
      destroyOnClose
      footer={[
        <Button key="close" type="primary" onClick={onClose}>关闭</Button>,
      ]}
    >
      <Space direction="vertical" size={16} style={{ width: "100%" }}>
        <div className="manual-assign-queue-header">
          <div className="manual-assign-queue-summary">
            <Text type="secondary">商品：<Text strong>{order?.shopName || "-"}</Text></Text>
            <Text type="secondary">类目：<Text strong>{order?.shopCategoryName || "-"}</Text></Text>
            <Text type="secondary">做单人数：<Text strong>{formatNumber(users.length)}</Text></Text>
            <Text type="secondary">做单总数：<Text strong>{formatNumber(summary.orderNum)}</Text></Text>
            <Text type="secondary">未提交：<Text strong>{formatNumber(summary.pendingNum)}</Text></Text>
            <Text type="secondary">审核成功：<Text strong>{formatNumber(summary.checkedNum)}</Text></Text>
          </div>
          <div className="manual-assign-queue-actions">
            <Button
              size="small"
              icon={<ReloadOutlined />}
              loading={usersLoading || recordsLoading}
              onClick={handleRefresh}
            >
              刷新
            </Button>
          </div>
        </div>

        <div>
          <div className="manager-section-label">做单人分布</div>
          <Title level={5} style={{ margin: "8px 0 4px" }}>每个做单用户在该订单下的做单量</Title>
          <Text type="secondary">点击行可按该用户筛选下方明细，再次点击取消筛选</Text>
          <Table<OrderManualUserSummary>
            style={{ marginTop: 12 }}
            rowKey="userId"
            size="small"
            loading={usersLoading}
            columns={userColumns}
            dataSource={users}
            pagination={false}
            scroll={{ x: 900, y: 232 }}
            rowClassName={(record) => (record.userId === userId ? "ant-table-row-selected" : "")}
            onRow={(record) => ({
              style: { cursor: "pointer" },
              onClick: () => handleUserChange(record.userId === userId ? undefined : record.userId),
            })}
            locale={{ emptyText: <Empty description={shopMatched ? "该订单还没有人做单" : emptyDescription} /> }}
          />
        </div>

        <div>
          <div className="manual-order-detail-filter-bar" style={{ marginBottom: 12 }}>
            <div className="manual-order-detail-filter-field">
              <div className="manager-section-label" style={{ marginBottom: 6 }}>做单用户</div>
              <Select<number>
                allowClear
                showSearch
                style={{ width: "100%" }}
                placeholder="全部做单用户"
                value={userId}
                loading={usersLoading}
                optionFilterProp="label"
                options={users.map((item) => ({
                  value: item.userId,
                  label: `${item.username || `用户 #${item.userId}`}（${formatNumber(item.orderNum)} 条）`,
                }))}
                onChange={(value) => handleUserChange(value ?? undefined)}
              />
            </div>
          </div>
          <Table<OrderManualRecord>
            rowKey="id"
            size="small"
            loading={recordsLoading}
            columns={recordColumns}
            dataSource={records}
            scroll={{ x: 1180 }}
            pagination={{
              current: page,
              pageSize,
              total,
              size: "small",
              showSizeChanger: true,
              pageSizeOptions: ["20", "50", "100"],
              showTotal: (count, range) => `第 ${range[0]}-${range[1]} 条 / 共 ${count} 条`,
              onChange: (nextPage, nextPageSize) => {
                if (orderId) {
                  void loadRecords(orderId, nextPage, nextPageSize ?? pageSize, userId);
                }
              },
            }}
            locale={{ emptyText: <Empty description={emptyDescription} /> }}
          />
        </div>
      </Space>
    </Modal>
  );
}
