"use client";

import { ManualMenuPanel } from "../components/ManualMenuPanel";

export default function ManualUserManagementPage() {
  return (
    <ManualMenuPanel
      title="人工用户管理"
      description="这里先为人工用户管理预留独立工作台，后续可以继续接入筛选、名单维护、状态控制和人工干预流水。"
      tag="用户管理"
      metrics={[
        { label: "人工用户池", value: "128" },
        { label: "待处理账号", value: "16" },
        { label: "今日人工干预", value: "42" },
        { label: "异常回访", value: "7" },
      ]}
    />
  );
}
