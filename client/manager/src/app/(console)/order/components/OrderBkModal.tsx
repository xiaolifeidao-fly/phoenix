"use client";

import { useEffect } from "react";
import { Form, InputNumber, Typography } from "antd";
import { WorkspaceDrawer } from "@/components/manager-shell/WorkspaceDrawer";
import type { OrderRecord } from "../api/order.api";

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

export function OrderBkModal({ open, submitting, order, onCancel, onSubmit }: OrderBkModalProps) {
  const [form] = Form.useForm<BkFormValues>();

  useEffect(() => {
    if (!open) {
      form.resetFields();
      return;
    }
    form.setFieldsValue({ num: order?.orderNum ?? 1 });
  }, [form, open, order]);

  return (
    <WorkspaceDrawer
      open={open}
      title="订单补款"
      okText="确认补款"
      cancelText="取消"
      width={480}
      submitting={submitting}
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
        <div style={{ marginBottom: 16 }}>
          <Text style={{ color: "var(--manager-text-soft)" }}>
            订单 #{order.id}，单价 {order.price || "0"}，总数量 {order.orderNum}
          </Text>
        </div>
      ) : null}
      <Form<BkFormValues> className="manager-form-skin" form={form} layout="vertical" preserve={false}>
        <Form.Item
          label="补款数量"
          name="num"
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
          <InputNumber min={1} max={order?.orderNum || undefined} style={{ width: "100%" }} />
        </Form.Item>
      </Form>
    </WorkspaceDrawer>
  );
}
