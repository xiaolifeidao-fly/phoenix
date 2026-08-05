"use client";

import { useEffect } from "react";
import { Alert, Form, Input, Typography } from "antd";
import { WorkspaceDrawer } from "@/components/manager-shell/WorkspaceDrawer";
import type { OrderRecord } from "../api/order.api";

const { Text } = Typography;

interface OrderExceptionModalProps {
  open: boolean;
  submitting: boolean;
  /** 单个打标时的订单；批量打标时为 null */
  order: OrderRecord | null;
  /** 批量打标的订单数量，单个打标时为 0 */
  batchCount?: number;
  onCancel: () => void;
  onSubmit: (reason: string) => Promise<void>;
}

interface ExceptionFormValues {
  reason?: string;
}

export function OrderExceptionModal({
  open,
  submitting,
  order,
  batchCount = 0,
  onCancel,
  onSubmit,
}: OrderExceptionModalProps) {
  const [form] = Form.useForm<ExceptionFormValues>();
  const isBatch = !order && batchCount > 0;

  useEffect(() => {
    if (!open) {
      form.resetFields();
    }
  }, [form, open]);

  return (
    <WorkspaceDrawer
      open={open}
      title={isBatch ? `批量标记异常（${batchCount} 笔）` : "标记异常"}
      okText="确认打标"
      cancelText="取消"
      width={480}
      submitting={submitting}
      onClose={() => {
        form.resetFields();
        onCancel();
      }}
      onSubmit={async () => {
        const values = await form.validateFields();
        await onSubmit(values.reason?.trim() ?? "");
        form.resetFields();
      }}
    >
      <Alert
        type="warning"
        showIcon
        style={{ marginBottom: 16 }}
        message="打标后将同时停止该订单的分发"
        description="不传异常原因时由系统生成默认原因。若停止分发失败，异常原因会补充说明，需要重新操作。"
      />
      {order ? (
        <div style={{ marginBottom: 16 }}>
          <Text style={{ color: "var(--manager-text-soft)" }}>
            订单 #{order.id}，{order.shopName || "-"}，已分发 {order.orderAssignNum}
          </Text>
        </div>
      ) : null}
      <Form<ExceptionFormValues> className="manager-form-skin" form={form} layout="vertical" preserve={false}>
        <Form.Item
          label="异常原因（可选）"
          name="reason"
          rules={[{ max: 200, message: "异常原因不能超过 200 个字符" }]}
        >
          <Input.TextArea rows={3} placeholder="例如：视频链接失效" allowClear />
        </Form.Item>
      </Form>
    </WorkspaceDrawer>
  );
}
