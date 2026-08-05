"use client";

import { useEffect, useState } from "react";
import { Descriptions, Empty, Table, Tag, Typography } from "antd";
import dayjs from "dayjs";
import type { ColumnsType } from "antd/es/table";
import { WorkspaceDrawer } from "@/components/manager-shell/WorkspaceDrawer";
import { message } from "@/utils/notify";
import {
  fetchAccountRechargeDetails,
  type AccountRechargeDetail,
  type UserRecord,
} from "../api/user.api";

const { Text } = Typography;
const PAGE_SIZE = 10;

interface UserRechargeDetailDrawerProps {
  open: boolean;
  user: UserRecord | null;
  onClose: () => void;
}

export function UserRechargeDetailDrawer({ open, user, onClose }: UserRechargeDetailDrawerProps) {
  const [details, setDetails] = useState<AccountRechargeDetail[]>([]);
  const [total, setTotal] = useState(0);
  const [pageIndex, setPageIndex] = useState(1);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) {
      setDetails([]);
      setTotal(0);
      setPageIndex(1);
      return;
    }
    if (!user?.accountId) {
      setDetails([]);
      setTotal(0);
      return;
    }

    let cancelled = false;
    setLoading(true);
    fetchAccountRechargeDetails(user.accountId, pageIndex, PAGE_SIZE)
      .then((result) => {
        if (!cancelled) {
          setDetails(result.data);
          setTotal(result.total);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setDetails([]);
          setTotal(0);
          message.error(error instanceof Error ? error.message : "加载充值明细失败");
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
  }, [open, pageIndex, user]);

  const columns: ColumnsType<AccountRechargeDetail> = [
    {
      title: "类型",
      dataIndex: "type",
      width: 90,
      render: (value: string) => (
        <Tag color={value === "GIVEN" ? "cyan" : "green"}>{formatRechargeType(value)}</Tag>
      ),
    },
    {
      title: "变动金额",
      dataIndex: "amount",
      width: 130,
      render: (value: string) => <Text strong>{formatCurrency(value)}</Text>,
    },
    {
      title: "变动后余额",
      dataIndex: "balanceAmount",
      width: 140,
      render: (value: string) => formatCurrency(value),
    },
    {
      title: "描述",
      dataIndex: "description",
      width: 180,
      render: (value: string) => value || "-",
    },
    {
      title: "操作人",
      dataIndex: "operator",
      width: 110,
      render: (value: string) => value || "-",
    },
    {
      title: "时间",
      dataIndex: "createdTime",
      width: 170,
      render: (value: string) => formatDateTime(value),
    },
  ];

  return (
    <WorkspaceDrawer
      open={open}
      title="充值明细"
      cancelText="关闭"
      width="min(760px, 100vw)"
      onClose={onClose}
    >
      {user ? (
        <Descriptions column={{ xs: 1, sm: 2 }} size="small" style={{ marginBottom: 20 }}>
          <Descriptions.Item label="用户名">{user.username || "-"}</Descriptions.Item>
          <Descriptions.Item label="用户 ID">{user.id}</Descriptions.Item>
          <Descriptions.Item label="账户 ID">{user.accountId || "未开通"}</Descriptions.Item>
          <Descriptions.Item label="当前余额">
            {formatCurrency(user.tineBalance ?? user.balanceAmount)}
          </Descriptions.Item>
        </Descriptions>
      ) : null}

      {!user?.accountId ? (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="该用户尚未开通账户" />
      ) : (
        <Table<AccountRechargeDetail>
          rowKey="id"
          size="small"
          loading={loading}
          dataSource={details}
          columns={columns}
          scroll={{ x: 820 }}
          pagination={{
            current: pageIndex,
            pageSize: PAGE_SIZE,
            total,
            showSizeChanger: false,
            showTotal: (value) => `共 ${value} 条`,
            onChange: setPageIndex,
          }}
        />
      )}
    </WorkspaceDrawer>
  );
}

function formatRechargeType(value: string) {
  if (value === "PAY") {
    return "充值";
  }
  if (value === "GIVEN") {
    return "赠送";
  }
  return value || "-";
}

function formatCurrency(value?: string | number) {
  const amount = Number(value || 0);
  if (!Number.isFinite(amount)) {
    return value || "-";
  }
  return new Intl.NumberFormat("zh-CN", {
    style: "currency",
    currency: "CNY",
    maximumFractionDigits: 2,
  }).format(amount);
}

function formatDateTime(value?: string) {
  if (!value) {
    return "-";
  }
  const parsed = dayjs(value);
  return parsed.isValid() ? parsed.format("YYYY-MM-DD HH:mm:ss") : value;
}
