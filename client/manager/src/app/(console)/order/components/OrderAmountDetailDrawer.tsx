"use client";

import { useEffect, useState } from "react";
import { Descriptions, Table, Typography, message } from "antd";
import type { ColumnsType } from "antd/es/table";
import { WorkspaceDrawer } from "@/components/manager-shell/WorkspaceDrawer";
import { fetchOrderAmountDetails, type OrderAmountDetail, type OrderRecord } from "../api/order.api";

const { Text } = Typography;

interface OrderAmountDetailDrawerProps {
  open: boolean;
  order: OrderRecord | null;
  onClose: () => void;
}

export function OrderAmountDetailDrawer({ open, order, onClose }: OrderAmountDetailDrawerProps) {
  const [details, setDetails] = useState<OrderAmountDetail[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !order) {
      setDetails([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    fetchOrderAmountDetails(order.id)
      .then((result) => {
        if (!cancelled) {
          setDetails(result.data);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          message.error(error instanceof Error ? error.message : "加载订单明细失败");
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [open, order]);

  const columns: ColumnsType<OrderAmountDetail> = [
    {
      title: "明细ID",
      dataIndex: "id",
      width: 90,
    },
    {
      title: "消耗金额",
      dataIndex: "orderConsumerAmount",
      width: 140,
      render: (value: string) => <Text style={{ color: "var(--manager-text)" }}>{value || "-"}</Text>,
    },
    {
      title: "描述",
      dataIndex: "description",
      render: (value: string) => <span className="manager-value">{value || "-"}</span>,
    },
    {
      title: "时间",
      dataIndex: "createdTime",
      width: 180,
      render: (value: string) => value || "-",
    },
  ];

  return (
    <WorkspaceDrawer open={open} title="订单明细" cancelText="关闭" width={640} onClose={onClose}>
      {order ? (
        <Descriptions column={2} size="small" style={{ marginBottom: 16 }}>
          <Descriptions.Item label="订单ID">{order.id}</Descriptions.Item>
          <Descriptions.Item label="租户">{order.tenantName || "-"}</Descriptions.Item>
          <Descriptions.Item label="商品">{order.shopName || "-"}</Descriptions.Item>
          <Descriptions.Item label="类目">{order.shopCategoryName || "-"}</Descriptions.Item>
          <Descriptions.Item label="下单用户">{order.userName || "-"}</Descriptions.Item>
          <Descriptions.Item label="订单状态">{order.orderStatus || "-"}</Descriptions.Item>
          <Descriptions.Item label="单价">{order.price || "-"}</Descriptions.Item>
          <Descriptions.Item label="订单金额">{order.orderAmount || "-"}</Descriptions.Item>
          <Descriptions.Item label="业务ID" span={2}>
            {order.businessId || "-"}
          </Descriptions.Item>
        </Descriptions>
      ) : null}
      <Table<OrderAmountDetail>
        rowKey="id"
        size="small"
        loading={loading}
        dataSource={details}
        columns={columns}
        pagination={false}
      />
    </WorkspaceDrawer>
  );
}
