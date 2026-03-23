"use client";

import {
  ApartmentOutlined,
  AuditOutlined,
  BarChartOutlined,
  ShopOutlined,
  SolutionOutlined,
} from "@ant-design/icons";
import { Col, Row, Space, Tag, Typography } from "antd";
import type { ReactNode } from "react";

const { Paragraph, Text, Title } = Typography;

interface ManualMenuPanelProps {
  title: string;
  description: string;
  tag: string;
  metrics: Array<{
    label: string;
    value: string;
  }>;
}

interface ManualEntry {
  key: string;
  title: string;
  description: string;
  icon: ReactNode;
}

const manualEntries: ManualEntry[] = [
  {
    key: "user",
    title: "用户管理",
    description: "集中处理人工用户名单、账号状态与人工干预记录。",
    icon: <SolutionOutlined />,
  },
  {
    key: "product",
    title: "人工商品管理",
    description: "维护人工商品池、上架策略与人工处理优先级。",
    icon: <ShopOutlined />,
  },
  {
    key: "channel",
    title: "渠道管理",
    description: "查看渠道状态、分配能力与人工通道配置。",
    icon: <ApartmentOutlined />,
  },
  {
    key: "task",
    title: "任务统计",
    description: "聚合人工任务量、完成趋势与处理效率。",
    icon: <BarChartOutlined />,
  },
  {
    key: "withdraw",
    title: "提现审批",
    description: "承接人工审核、异常拦截与审批结果回溯。",
    icon: <AuditOutlined />,
  },
];

export function ManualMenuPanel({ title, description, tag, metrics }: ManualMenuPanelProps) {
  return (
    <div className="manager-page-stack">
      <section
        className="manager-shell-card manager-grid-bg"
        style={{ borderRadius: 30, padding: 28 }}
      >
        <Space direction="vertical" size={14} style={{ width: "100%" }}>
          <Tag
            bordered={false}
            style={{
              width: "fit-content",
              margin: 0,
              borderRadius: 999,
              paddingInline: 12,
              paddingBlock: 6,
              fontWeight: 700,
              color: "var(--manager-primary-strong)",
              background: "rgba(93, 125, 246, 0.12)",
            }}
          >
            {tag}
          </Tag>
          <div>
            <div className="manager-brand-kicker">Manual Console</div>
            <Title level={2} className="manager-display-title" style={{ margin: "14px 0 10px" }}>
              {title}
            </Title>
            <Paragraph style={{ maxWidth: 760, margin: 0, color: "var(--manager-text-soft)" }}>
              {description}
            </Paragraph>
          </div>
        </Space>
      </section>

      <Row gutter={[16, 16]}>
        {metrics.map((metric) => (
          <Col key={metric.label} xs={24} sm={12} xl={6}>
            <article className="manager-data-card" style={{ borderRadius: 24, padding: 22 }}>
              <div className="manager-section-label">{metric.label}</div>
              <div
                className="manager-display-title"
                style={{ marginTop: 12, fontSize: 28, color: "var(--manager-text)" }}
              >
                {metric.value}
              </div>
            </article>
          </Col>
        ))}
      </Row>

      <section className="manager-shell-card" style={{ borderRadius: 30, padding: 24 }}>
        <Space direction="vertical" size={18} style={{ width: "100%" }}>
          <div>
            <div className="manager-section-label">人工模块</div>
            <Title level={4} style={{ margin: "10px 0 0" }}>
              二级菜单概览
            </Title>
          </div>

          <Row gutter={[16, 16]}>
            {manualEntries.map((entry) => (
              <Col key={entry.key} xs={24} md={12} xl={8}>
                <article
                  style={{
                    height: "100%",
                    borderRadius: 24,
                    padding: 20,
                    background: "linear-gradient(180deg, rgba(255,255,255,0.98), rgba(244,248,253,0.96))",
                    border: "1px solid rgba(145, 171, 212, 0.24)",
                    boxShadow: "0 18px 42px rgba(103, 133, 182, 0.08)",
                  }}
                >
                  <Space direction="vertical" size={12} style={{ width: "100%" }}>
                    <div
                      style={{
                        width: 48,
                        height: 48,
                        borderRadius: 16,
                        display: "grid",
                        placeItems: "center",
                        color: "var(--manager-primary-strong)",
                        background: "rgba(93, 125, 246, 0.1)",
                        fontSize: 20,
                      }}
                    >
                      {entry.icon}
                    </div>
                    <div>
                      <Text strong style={{ fontSize: 16, color: "var(--manager-text)" }}>
                        {entry.title}
                      </Text>
                      <Paragraph
                        style={{
                          margin: "8px 0 0",
                          color: "var(--manager-text-soft)",
                        }}
                      >
                        {entry.description}
                      </Paragraph>
                    </div>
                  </Space>
                </article>
              </Col>
            ))}
          </Row>
        </Space>
      </section>
    </div>
  );
}
