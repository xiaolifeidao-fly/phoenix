"use client";

import { Space, Tabs, Typography } from "antd";
import { DropMonitorTab } from "./DropMonitorTab";
import { DropRepairTab } from "./DropRepairTab";
import { JobRunTab } from "./JobRunTab";

const { Text, Title } = Typography;

export function DropRepairDataPanel() {
  return (
    <Space direction="vertical" size="middle" style={{ width: "100%" }}>
      <Title level={4} style={{ marginBottom: 0 }}>
        掉量监控与补单数据
      </Title>
      <Text type="secondary">
        「掉量监控」看检测结果，只要开了监控就有数据；「补单数据」只统计真正下发过补单的单子；「任务运行」看定时任务本身健不健康。
      </Text>
      <Tabs
        defaultActiveKey="monitor"
        items={[
          { key: "monitor", label: "掉量监控", children: <DropMonitorTab /> },
          { key: "repair", label: "补单数据", children: <DropRepairTab /> },
          { key: "job", label: "任务运行", children: <JobRunTab /> },
        ]}
      />
    </Space>
  );
}
