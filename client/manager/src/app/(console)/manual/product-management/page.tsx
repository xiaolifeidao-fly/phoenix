"use client";

import { ManualMenuPanel } from "../components/ManualMenuPanel";

export default function ManualProductManagementPage() {
  return (
    <ManualMenuPanel
      title="人工商品管理"
      description="这里作为人工商品的管理入口，适合继续承接商品池维护、上下架控制、价格校正和人工分发规则。"
      tag="人工商品管理"
      metrics={[
        { label: "人工商品数", value: "36" },
        { label: "待调整价格", value: "5" },
        { label: "今日上架", value: "12" },
        { label: "人工库存预警", value: "3" },
      ]}
    />
  );
}
