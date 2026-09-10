"use client";

import { useEffect, useState } from "react";
import { Alert, Descriptions, Form, InputNumber, Skeleton, Typography } from "antd";
import { WorkspaceDrawer } from "@/components/manager-shell/WorkspaceDrawer";
import {
  calculateSuggestedBkNum,
  fetchOrderRealDetail,
  hasRealFactNum,
  type OrderRealDetail,
  type OrderRecord,
} from "../api/order.api";

const { Text } = Typography;

interface OrderBkModalProps {
  open: boolean;
  submitting: boolean;
  order: OrderRecord | null;
  onCancel: () => void;
  onSubmit: (num: number) => Promise<void>;
}

interface BkFormValues {
  num: number;
}

const formatNumber = (value?: number | null) =>
  value == null ? "-" : Number(value).toLocaleString("zh-CN");

/** 补款金额由 kakrolot 用库里的单价计算，这里只是给操作人一个预估 */
const formatAmount = (price: string, num?: number) => {
  const unitPrice = Number(price || 0);
  if (!Number.isFinite(unitPrice) || !num || num <= 0) {
    return "-";
  }
  return `${(unitPrice * num).toFixed(2)} 元`;
};

export function OrderBkModal({ open, submitting, order, onCancel, onSubmit }: OrderBkModalProps) {
  const [form] = Form.useForm<BkFormValues>();
  const num = Form.useWatch("num", form);
  const [realDetail, setRealDetail] = useState<OrderRealDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    if (!open || !order) {
      form.resetFields();
      setRealDetail(null);
      setLoadError("");
      return;
    }
    let cancelled = false;
    setLoading(true);
    setLoadError("");
    setRealDetail(null);
    // 取不到实时数据时退回原来的行为：默认补订单总量，由操作人自行判断
    form.setFieldsValue({ num: order.orderNum });
    fetchOrderRealDetail(order.id)
      .then((detail) => {
        if (cancelled) {
          return;
        }
        setRealDetail(detail);
        if (hasRealFactNum(detail)) {
          form.setFieldsValue({ num: calculateSuggestedBkNum(order, detail.factNum) });
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setLoadError(error instanceof Error ? error.message : "获取订单实时数据失败");
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
  }, [form, open, order]);

  const factAvailable = hasRealFactNum(realDetail);
  const suggestedNum = order && factAvailable ? calculateSuggestedBkNum(order, realDetail.factNum) : undefined;

  return (
    <WorkspaceDrawer
      open={open}
      title="订单补款"
      okText="确认补款"
      cancelText="取消"
      width={560}
      submitting={submitting}
      okDisabled={loading}
      onClose={() => {
        form.resetFields();
        onCancel();
      }}
      onSubmit={async () => {
        const values = await form.validateFields();
        await onSubmit(values.num);
        form.resetFields();
      }}
    >
      {order ? (
        <Skeleton active loading={loading} paragraph={{ rows: 4 }}>
          <Descriptions
            size="small"
            column={2}
            bordered
            style={{ marginBottom: 16 }}
          >
            <Descriptions.Item label="订单">#{order.id}</Descriptions.Item>
            <Descriptions.Item label="单价">{order.price || "0"}</Descriptions.Item>
            <Descriptions.Item label="下单量">{formatNumber(order.orderNum)}</Descriptions.Item>
            <Descriptions.Item label="起始值 → 当前值">
              {formatNumber(order.initNum)} → {formatNumber(order.endNum)}
            </Descriptions.Item>
            <Descriptions.Item label="平台当前值">
              {realDetail && realDetail.nowNum >= 0 ? formatNumber(realDetail.nowNum) : "-"}
            </Descriptions.Item>
            <Descriptions.Item label="实际增量">
              {factAvailable ? formatNumber(realDetail.factNum) : "-"}
            </Descriptions.Item>
            <Descriptions.Item label="做单审核">
              {realDetail
                ? `通过 ${formatNumber(realDetail.checkedCount)} / 待审 ${formatNumber(realDetail.unCheckCount)}`
                : "-"}
            </Descriptions.Item>
            <Descriptions.Item label="建议补款">
              {suggestedNum == null ? "-" : formatNumber(suggestedNum)}
            </Descriptions.Item>
          </Descriptions>
        </Skeleton>
      ) : null}

      {loadError ? (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
          message="没取到实时数据，补款数量已退回订单总量，请人工核对后再提交"
          description={loadError}
        />
      ) : null}
      {!loadError && realDetail && !factAvailable ? (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
          message="barry 没取到平台当前值，无法算出建议补款数量，请人工核对后再提交"
          description={realDetail.getNowError || undefined}
        />
      ) : null}
      {suggestedNum === 0 ? (
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
          message="按实时数据该订单已做够，无需补款"
        />
      ) : null}

      <Form<BkFormValues> className="manager-form-skin" form={form} layout="vertical" preserve={false}>
        <Form.Item
          label="补款数量"
          name="num"
          extra={
            <Text style={{ color: "var(--manager-text-soft)" }}>
              预计补款金额 {formatAmount(order?.price ?? "0", num)}
              {suggestedNum != null && num !== suggestedNum
                ? `，建议值 ${formatNumber(suggestedNum)}`
                : ""}
            </Text>
          }
          rules={[
            { required: true, message: "请输入补款数量" },
            {
              validator: (_, value) => {
                if (value == null || value <= 0) {
                  return Promise.reject(new Error("补款数量必须大于 0"));
                }
                if (order && order.orderNum > 0 && value > order.orderNum) {
                  return Promise.reject(new Error("补款数量不能大于订单总数量"));
                }
                return Promise.resolve();
              },
            },
          ]}
        >
          <InputNumber min={0} max={order?.orderNum || undefined} disabled={loading} style={{ width: "100%" }} />
        </Form.Item>
      </Form>
    </WorkspaceDrawer>
  );
}
