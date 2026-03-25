"use client";

import { useEffect, useMemo, useState } from "react";
import dayjs, { type Dayjs } from "dayjs";
import {
  AppstoreOutlined,
  BarChartOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  ReloadOutlined,
  SearchOutlined,
  WarningOutlined,
} from "@ant-design/icons";
import {
  Button,
  DatePicker,
  Empty,
  Input,
  Progress,
  Select,
  Space,
  Table,
  Tag,
  Typography,
  message,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import {
  fetchManualTaskStatistics,
  type ManualTaskStatisticsDetail,
  type ManualTaskStatisticsOverview,
} from "../../api/task-statistics.api";

const { Paragraph, Text, Title } = Typography;
const { RangePicker } = DatePicker;

type DateRangeValue = [Dayjs | null, Dayjs | null] | null;

const defaultDateRange: [Dayjs, Dayjs] = [dayjs().startOf("day"), dayjs().startOf("day")];

export function ManualTaskStatisticsPanel() {
  const [loading, setLoading] = useState(false);
  const [overview, setOverview] = useState<ManualTaskStatisticsOverview | null>(null);
  const [filters, setFilters] = useState({
    keyword: "",
    shopGroupId: undefined as number | undefined,
    dateRange: defaultDateRange,
  });

  const loadOverview = async (
    nextFilters: {
      keyword: string;
      shopGroupId: number | undefined;
      dateRange: [Dayjs, Dayjs];
    } = filters,
  ) => {
    setLoading(true);
    try {
      const [startDate, endDate] = nextFilters.dateRange;
      const result = await fetchManualTaskStatistics({
        keyword: nextFilters.keyword.trim() || undefined,
        shopGroupId: nextFilters.shopGroupId,
        startDate: startDate ? startDate.format("YYYY-MM-DD") : undefined,
        endDate: endDate ? endDate.format("YYYY-MM-DD") : undefined,
      });
      setOverview(result);
    } catch (error) {
      message.error(error instanceof Error ? error.message : "加载人工任务情况失败");
      setOverview(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadOverview();
  }, []);

  const stats = useMemo(() => {
    if (!overview) {
      return [];
    }
    return [
      {
        label: "任务总量",
        value: formatCount(overview.totalNum),
        hint: "Barry 汇总回传的总任务数",
        icon: <BarChartOutlined />,
        accent: "#316DCA",
        background: "linear-gradient(135deg, rgba(49,109,202,0.16), rgba(80,163,255,0.08))",
      },
      {
        label: "待审核",
        value: formatCount(overview.waitNum),
        hint: "当前仍需人工处理的审核量",
        icon: <ClockCircleOutlined />,
        accent: "#B26A16",
        background: "linear-gradient(135deg, rgba(237,165,80,0.16), rgba(255,219,167,0.12))",
      },
      {
        label: "已完成",
        value: formatCount(overview.doneNum),
        hint: "已审核完成的任务数量",
        icon: <CheckCircleOutlined />,
        accent: "#1E8A5A",
        background: "linear-gradient(135deg, rgba(39,174,96,0.18), rgba(144,238,144,0.10))",
      },
      {
        label: "异常数",
        value: formatCount(overview.errorNum),
        hint: "审核异常或回查失败的记录数",
        icon: <WarningOutlined />,
        accent: "#BA3C30",
        background: "linear-gradient(135deg, rgba(219,76,63,0.16), rgba(255,196,189,0.12))",
      },
      {
        label: "处理中",
        value: formatCount(overview.pendingNum),
        hint: "已进入处理流转但未出审核结果",
        icon: <AppstoreOutlined />,
        accent: "#7357C8",
        background: "linear-gradient(135deg, rgba(115,87,200,0.15), rgba(191,177,239,0.1))",
      },
      {
        label: "统计分组",
        value: formatCount(overview.groupCount),
        hint: "当前纳入统计的 dashboard 分组数",
        icon: <BarChartOutlined />,
        accent: "#1A7D83",
        background: "linear-gradient(135deg, rgba(26,125,131,0.16), rgba(158,231,232,0.10))",
      },
    ];
  }, [overview]);

  const topGroups = useMemo(() => (overview?.detailList ?? []).slice(0, 3), [overview]);

  const groupOptions = useMemo(
    () =>
      (overview?.groupOptions ?? []).map((item) => ({
        label: item.businessType ? `${item.name} (${item.businessType})` : item.name,
        value: item.id,
      })),
    [overview],
  );

  const columns: ColumnsType<ManualTaskStatisticsDetail> = [
    {
      title: "任务分组",
      dataIndex: "name",
      width: 240,
      render: (value: string, record) => (
        <Space direction="vertical" size={2}>
          <Text style={{ color: "var(--manager-text)", fontWeight: 600 }}>{value || "-"}</Text>
          <Text type="secondary">{record.businessType || record.businessCode || "未配置 Barry 编码"}</Text>
        </Space>
      ),
    },
    {
      title: "总量",
      dataIndex: "totalNum",
      width: 110,
      render: (value: number) => formatCount(value),
    },
    {
      title: "处理中",
      dataIndex: "pendingNum",
      width: 110,
      render: (value: number) => <Tag color="processing">{formatCount(value)}</Tag>,
    },
    {
      title: "待审核",
      dataIndex: "waitNum",
      width: 110,
      render: (value: number) => <Tag color="gold">{formatCount(value)}</Tag>,
    },
    {
      title: "已完成",
      dataIndex: "doneNum",
      width: 110,
      render: (value: number) => <Tag color="success">{formatCount(value)}</Tag>,
    },
    {
      title: "异常",
      dataIndex: "errorNum",
      width: 110,
      render: (value: number) => <Tag color="error">{formatCount(value)}</Tag>,
    },
    {
      title: "完成率",
      dataIndex: "completionRate",
      width: 220,
      render: (_: number, record) => (
        <Space direction="vertical" size={6} style={{ width: "100%" }}>
          <Progress
            percent={Number((record.completionRate * 100).toFixed(1))}
            strokeColor="#2AA876"
            trailColor="rgba(128, 145, 171, 0.18)"
            size="small"
            showInfo={false}
          />
          <Text type="secondary">{`${formatPercent(record.completionRate)} · 完成 ${formatCount(record.doneNum)} / ${formatCount(
            record.completionCount,
          )}`}</Text>
        </Space>
      ),
    },
  ];

  return (
    <div className="manager-page-stack">
      <section className="manager-shell-card manager-grid-bg" style={{ borderRadius: 30, padding: 28 }}>
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
            任务统计
          </Tag>
          <div>
            <div className="manager-brand-kicker">Manual Console</div>
            <Title level={2} className="manager-display-title" style={{ margin: "14px 0 10px" }}>
              人工任务情况统计台
            </Title>
            <Paragraph style={{ maxWidth: 820, margin: 0, color: "var(--manager-text-soft)" }}>
              基于本地 dashboard 分组配置汇总 Barry 的人工订单审核情况，可按日期范围、统计分组和关键词快速查看待审核、已完成、处理中与异常任务。
            </Paragraph>
          </div>
          <Space size={[8, 8]} wrap>
            <Tag color="blue">{`统计范围 ${overview?.startDate || dayjs().format("YYYY-MM-DD")} ~ ${
              overview?.endDate || dayjs().format("YYYY-MM-DD")
            }`}</Tag>
            <Tag color="geekblue">{`分组 ${formatCount(overview?.groupCount ?? 0)}`}</Tag>
            <Tag color="green">{`完成率 ${formatPercent(resolveOverviewCompletionRate(overview))}`}</Tag>
          </Space>
        </Space>
      </section>

      <section className="manager-shell-card" style={{ borderRadius: 28, padding: 24 }}>
        <Space direction="vertical" size={18} style={{ width: "100%" }}>
          <div>
            <div className="manager-section-label">筛选条件</div>
            <Title level={4} style={{ margin: "10px 0 0" }}>
              快速定位当前人工任务压力
            </Title>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: 14,
              alignItems: "end",
            }}
          >
            <div>
              <Text type="secondary">日期范围</Text>
              <RangePicker
                style={{ width: "100%", marginTop: 8 }}
                value={filters.dateRange}
                allowClear={false}
                onChange={(value: DateRangeValue) =>
                  setFilters((current) => ({
                    ...current,
                    dateRange:
                      value && value[0] && value[1]
                        ? [value[0].startOf("day"), value[1].startOf("day")]
                        : defaultDateRange,
                  }))
                }
              />
            </div>

            <div>
              <Text type="secondary">统计分组</Text>
              <Select
                allowClear
                placeholder="全部 dashboard 分组"
                style={{ width: "100%", marginTop: 8 }}
                options={groupOptions}
                value={filters.shopGroupId}
                onChange={(value) => setFilters((current) => ({ ...current, shopGroupId: value }))}
              />
            </div>

            <div>
              <Text type="secondary">关键词</Text>
              <Input
                allowClear
                placeholder="支持分组名、Barry 编码检索"
                style={{ marginTop: 8 }}
                value={filters.keyword}
                onChange={(event) => setFilters((current) => ({ ...current, keyword: event.target.value }))}
                onPressEnter={() => void loadOverview()}
              />
            </div>

            <Space>
              <Button type="primary" icon={<SearchOutlined />} onClick={() => void loadOverview()} loading={loading}>
                查询
              </Button>
              <Button
                icon={<ReloadOutlined />}
                onClick={() => {
                  const resetFilters = {
                    keyword: "",
                    shopGroupId: undefined,
                    dateRange: defaultDateRange,
                  };
                  setFilters(resetFilters);
                  void loadOverview(resetFilters);
                }}
              >
                重置
              </Button>
            </Space>
          </div>
        </Space>
      </section>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: 16,
        }}
      >
        {stats.map((metric) => (
          <article
            key={metric.label}
            className="manager-data-card"
            style={{ borderRadius: 24, padding: 22, background: metric.background }}
          >
            <Space direction="vertical" size={10} style={{ width: "100%" }}>
              <div
                style={{
                  width: 44,
                  height: 44,
                  display: "grid",
                  placeItems: "center",
                  borderRadius: 14,
                  background: "rgba(255,255,255,0.8)",
                  color: metric.accent,
                  fontSize: 18,
                }}
              >
                {metric.icon}
              </div>
              <div className="manager-section-label">{metric.label}</div>
              <div className="manager-display-title" style={{ fontSize: 28, color: "var(--manager-text)" }}>
                {metric.value}
              </div>
              <Text type="secondary">{metric.hint}</Text>
            </Space>
          </article>
        ))}
      </div>

      <section className="manager-shell-card" style={{ borderRadius: 28, padding: 24 }}>
        <Space direction="vertical" size={18} style={{ width: "100%" }}>
          <div>
            <div className="manager-section-label">重点分组</div>
            <Title level={4} style={{ margin: "10px 0 0" }}>
              当前完成量最高的人工任务池
            </Title>
          </div>

          {topGroups.length > 0 ? (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                gap: 16,
              }}
            >
              {topGroups.map((item, index) => (
                <article
                  key={`${item.shopGroupId}-${item.name}`}
                  style={{
                    borderRadius: 24,
                    padding: 20,
                    background:
                      index === 0
                        ? "linear-gradient(145deg, rgba(36, 115, 214, 0.14), rgba(255,255,255,0.94))"
                        : "linear-gradient(180deg, rgba(255,255,255,0.98), rgba(244,248,253,0.96))",
                    border: "1px solid rgba(145, 171, 212, 0.24)",
                  }}
                >
                  <Space direction="vertical" size={10} style={{ width: "100%" }}>
                    <Space align="center" style={{ justifyContent: "space-between", width: "100%" }}>
                      <Text strong style={{ color: "var(--manager-text)", fontSize: 16 }}>
                        {item.name}
                      </Text>
                      <Tag color={index === 0 ? "blue" : "default"}>{`Top ${index + 1}`}</Tag>
                    </Space>
                    <Text type="secondary">{item.businessType || item.businessCode || "未配置 Barry 编码"}</Text>
                    <Space size={18} wrap>
                      <MetricInline label="已完成" value={formatCount(item.doneNum)} />
                      <MetricInline label="待审核" value={formatCount(item.waitNum)} />
                      <MetricInline label="完成率" value={formatPercent(item.completionRate)} />
                    </Space>
                  </Space>
                </article>
              ))}
            </div>
          ) : (
            <Empty description="当前筛选条件下暂无人工任务分组" />
          )}
        </Space>
      </section>

      <section className="manager-shell-card" style={{ borderRadius: 28, padding: 24 }}>
        <Space direction="vertical" size={18} style={{ width: "100%" }}>
          <div>
            <div className="manager-section-label">明细列表</div>
            <Title level={4} style={{ margin: "10px 0 0" }}>
              分组查看人工任务完成情况
            </Title>
          </div>

          <Table<ManualTaskStatisticsDetail>
            rowKey={(record) => `${record.shopGroupId}-${record.businessType || record.businessCode || record.name}`}
            loading={loading}
            columns={columns}
            dataSource={overview?.detailList ?? []}
            pagination={false}
            scroll={{ x: 980 }}
            locale={{ emptyText: <Empty description="暂无人工任务数据" /> }}
          />
        </Space>
      </section>
    </div>
  );
}

function MetricInline({ label, value }: { label: string; value: string }) {
  return (
    <Space direction="vertical" size={2}>
      <Text type="secondary">{label}</Text>
      <Text strong style={{ color: "var(--manager-text)" }}>
        {value}
      </Text>
    </Space>
  );
}

function formatCount(value: number) {
  return Number(value || 0).toLocaleString("zh-CN");
}

function formatPercent(value: number) {
  return `${(Number(value || 0) * 100).toFixed(1)}%`;
}

function resolveOverviewCompletionRate(overview: ManualTaskStatisticsOverview | null) {
  if (!overview) {
    return 0;
  }
  const denominator = Number(overview.waitNum || 0) + Number(overview.doneNum || 0);
  if (denominator <= 0) {
    return 0;
  }
  return Number(overview.doneNum || 0) / denominator;
}
