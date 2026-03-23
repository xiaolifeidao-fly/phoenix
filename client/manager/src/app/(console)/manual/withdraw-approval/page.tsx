"use client";

import { ManualMenuPanel } from "../components/ManualMenuPanel";

export default function ManualWithdrawApprovalPage() {
  return (
    <ManualMenuPanel
      title="人工提现审批"
      description="这里作为人工提现审批的独立入口，后续可以继续补待审列表、风控备注、通过驳回和审批轨迹。"
      tag="提现审批"
      metrics={[
        { label: "待审批", value: "18" },
        { label: "今日通过", value: "64" },
        { label: "今日驳回", value: "6" },
        { label: "高风险单", value: "3" },
      ]}
    />
  );
}
