"use client";

import { Space, Tabs, Typography } from "antd";
import { ManualWithdrawApprovalPanel } from "../../withdraw-approval/components/ManualWithdrawApprovalPanel";
import { WithdrawSummaryTab } from "./WithdrawSummaryTab";

const { Text, Title } = Typography;

/** 人工 - 提现和结算管理：迁移老管理端「提现记录」「提现汇总」 */
export function WithdrawSettlePanel() {
  return (
    <Space direction="vertical" size="middle" style={{ width: "100%" }}>
      <Title level={4} style={{ marginBottom: 0 }}>
        提现和结算管理
      </Title>
      <Text type="secondary">
        「提现记录」逐笔查询并处理结算、核销、驳回；「提现汇总」按渠道逐日统计，可整天批量结算、核销并导出结算中明细。
      </Text>
      <Tabs
        defaultActiveKey="records"
        destroyInactiveTabPane={false}
        items={[
          { key: "records", label: "提现记录", children: <ManualWithdrawApprovalPanel /> },
          { key: "summary", label: "提现汇总", children: <WithdrawSummaryTab /> },
        ]}
      />
    </Space>
  );
}
