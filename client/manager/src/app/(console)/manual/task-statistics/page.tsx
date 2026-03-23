"use client";

import { ManualMenuPanel } from "../components/ManualMenuPanel";

export default function ManualTaskStatisticsPage() {
  return (
    <ManualMenuPanel
      title="人工任务统计"
      description="这个页面先承接人工任务统计菜单，后续可以接日报、趋势图、处理耗时、人员效率和任务来源分析。"
      tag="任务统计"
      metrics={[
        { label: "今日任务", value: "268" },
        { label: "已完成", value: "231" },
        { label: "处理中", value: "29" },
        { label: "完成率", value: "86.2%" },
      ]}
    />
  );
}
