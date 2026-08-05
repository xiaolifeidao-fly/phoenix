"use client";

import { useEffect, useMemo, useState } from "react";
import {
  EyeOutlined,
  PlayCircleOutlined,
  PlusOutlined,
  ReloadOutlined,
  SearchOutlined,
  SyncOutlined,
} from "@ant-design/icons";
import {
  Button,
  Drawer,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Progress,
  Select,
  Space,
  Table,
  Tag,
  Tooltip,
  Typography,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import dayjs from "dayjs";
import { message } from "@/utils/notify";
import {
  executeRefundBatchTask,
  fetchRefundBatchDetails,
  fetchRefundBatchTasks,
  importRefundBatch,
  type RefundBatchDetail,
  type RefundBatchTask,
} from "../api/refund-batch.api";

const { Text } = Typography;
const TASK_POLL_INTERVAL = 3000;
const DETAIL_POLL_INTERVAL = 2000;

const taskStatusOptions = [
  { label: "全部状态", value: "" },
  { label: "待处理", value: "PENDING" },
  { label: "处理中", value: "PROCESSING" },
  { label: "已完成", value: "COMPLETED" },
  { label: "失败", value: "FAILED" },
];

interface ImportFormValues {
  taskName?: string;
  tinyUrls: string;
}

export function RefundBatchPanel() {
  const [tasks, setTasks] = useState<RefundBatchTask[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [query, setQuery] = useState({ pageIndex: 1, pageSize: 20, taskStatus: "" });
  const [importOpen, setImportOpen] = useState(false);
  const [importForm] = Form.useForm<ImportFormValues>();
  const [detailTask, setDetailTask] = useState<RefundBatchTask | null>(null);
  const [details, setDetails] = useState<RefundBatchDetail[]>([]);
  const [detailTotal, setDetailTotal] = useState(0);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailQuery, setDetailQuery] = useState({ pageIndex: 1, pageSize: 20, orderRecordId: undefined as number | undefined, tinyUrl: "" });

  const loadTasks = async (next = query, silent = false) => {
    if (!silent) setLoading(true);
    try {
      const result = await fetchRefundBatchTasks({
        ...next,
        taskStatus: next.taskStatus || undefined,
      });
      setTasks(result.data);
      setTotal(result.total);
      setQuery(next);
    } catch (error) {
      if (!silent) {
        message.error(error instanceof Error ? error.message : "加载批量退单任务失败");
        setTasks([]);
        setTotal(0);
      }
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const loadDetails = async (task: RefundBatchTask, next = detailQuery, silent = false) => {
    if (!silent) setDetailLoading(true);
    try {
      const result = await fetchRefundBatchDetails({
        pageIndex: next.pageIndex,
        pageSize: next.pageSize,
        taskId: task.id,
        orderRecordId: next.orderRecordId,
        tinyUrl: next.tinyUrl.trim() || undefined,
      });
      setDetails(result.data);
      setDetailTotal(result.total);
      setDetailQuery(next);
    } catch (error) {
      if (!silent) {
        message.error(error instanceof Error ? error.message : "加载退单明细失败");
        setDetails([]);
        setDetailTotal(0);
      }
    } finally {
      if (!silent) setDetailLoading(false);
    }
  };

  useEffect(() => {
    void loadTasks();
  }, []);

  const hasProcessingTasks = tasks.some((task) => task.taskStatus === "PROCESSING");

  useEffect(() => {
    if (!hasProcessingTasks) return undefined;
    const timer = window.setInterval(() => {
      void loadTasks(query, true);
    }, TASK_POLL_INTERVAL);
    return () => window.clearInterval(timer);
  }, [hasProcessingTasks, query.pageIndex, query.pageSize, query.taskStatus]);

  useEffect(() => {
    if (!detailTask || detailTask.taskStatus !== "PROCESSING") return undefined;
    let refreshing = false;
    const taskID = detailTask.id;
    const timer = window.setInterval(async () => {
      if (refreshing) return;
      refreshing = true;
      try {
        const result = await fetchRefundBatchTasks({ pageIndex: 1, pageSize: 1, taskId: taskID });
        const latestTask = result.data[0];
        if (latestTask) {
          setDetailTask(latestTask);
          setTasks((current) => current.map((task) => (task.id === latestTask.id ? latestTask : task)));
          await loadDetails(latestTask, detailQuery, true);
        }
      } catch {
        // Keep the last successful progress snapshot and retry on the next interval.
      } finally {
        refreshing = false;
      }
    }, DETAIL_POLL_INTERVAL);
    return () => window.clearInterval(timer);
  }, [detailTask?.id, detailTask?.taskStatus, detailQuery.pageIndex, detailQuery.pageSize, detailQuery.orderRecordId, detailQuery.tinyUrl]);

  const stats = useMemo(() => {
    const counts = tasks.reduce(
      (result, item) => {
        result.success += item.successCount || 0;
        result.failed += item.failCount || 0;
        result.pending += item.pendingCount || 0;
        return result;
      },
      { success: 0, failed: 0, pending: 0 },
    );
    return [
      { label: "当前任务", value: total },
      { label: "本页成功", value: counts.success },
      { label: "本页失败", value: counts.failed },
      { label: "本页待处理", value: counts.pending },
    ];
  }, [tasks, total]);

  const handleImport = async () => {
    const values = await importForm.validateFields();
    setSubmitting(true);
    try {
      const result = await importRefundBatch({
        taskName: values.taskName?.trim() || undefined,
        tinyUrls: values.tinyUrls,
      });
      message.success(result.message || "导入成功");
      setImportOpen(false);
      importForm.resetFields();
      await loadTasks({ ...query, pageIndex: 1 });
    } catch (error) {
      message.error(error instanceof Error ? error.message : "导入失败");
    } finally {
      setSubmitting(false);
    }
  };

  const handleExecute = async (task: RefundBatchTask) => {
    setSubmitting(true);
    try {
      const result = await executeRefundBatchTask(task.id);
      message.success(result.message || "任务已开始执行");
      const runningTask = { ...task, taskStatus: "PROCESSING", taskStatusDesc: "处理中" };
      setTasks((current) => current.map((item) => (item.id === task.id ? runningTask : item)));
      openDetails(runningTask);
      void loadTasks(query, true);
    } catch (error) {
      message.error(error instanceof Error ? error.message : "执行任务失败");
    } finally {
      setSubmitting(false);
    }
  };

  const openDetails = (task: RefundBatchTask) => {
    const next = { pageIndex: 1, pageSize: 20, orderRecordId: undefined, tinyUrl: "" };
    setDetailTask(task);
    setDetailQuery(next);
    void loadDetails(task, next);
  };

  const taskColumns: ColumnsType<RefundBatchTask> = [
    { title: "任务 ID", dataIndex: "id", width: 100 },
    {
      title: "任务名称",
      dataIndex: "taskName",
      width: 240,
      render: (value: string) => <Text strong>{value || "-"}</Text>,
    },
    {
      title: "执行进度",
      key: "progress",
      width: 250,
      render: (_, record) => {
        const completed = (record.successCount || 0) + (record.failCount || 0);
        const percent = record.totalCount > 0 ? Math.round((completed / record.totalCount) * 100) : 0;
        return <Progress percent={percent} size="small" status={record.failCount > 0 ? "exception" : "normal"} />;
      },
    },
    {
      title: "成功 / 失败 / 待处理",
      key: "counts",
      width: 210,
      render: (_, record) => (
        <Space size={6}>
          <Tag color="success">{record.successCount || 0}</Tag>
          <Tag color="error">{record.failCount || 0}</Tag>
          <Tag>{record.pendingCount || 0}</Tag>
        </Space>
      ),
    },
    {
      title: "状态",
      dataIndex: "taskStatus",
      width: 120,
      render: (value: string, record) => <Tag color={statusColor(value)}>{record.taskStatusDesc || statusText(value)}</Tag>,
    },
    { title: "创建时间", dataIndex: "createdAt", width: 180, render: formatTime },
    {
      title: "操作",
      key: "actions",
      width: 110,
      fixed: "right",
      render: (_, record) => (
        <Space size={4} onClick={(event) => event.stopPropagation()}>
          <Tooltip title="查看明细">
            <Button type="text" size="small" icon={<EyeOutlined />} onClick={() => openDetails(record)} />
          </Tooltip>
          <Popconfirm
            title="执行退单任务"
            description="新管理端会逐条处理明细，并调用 Kakrolot 执行最终退单，确认继续？"
            okText="执行"
            cancelText="取消"
            disabled={record.taskStatus !== "PENDING"}
            onConfirm={() => handleExecute(record)}
          >
            <Tooltip title={record.taskStatus === "PENDING" ? "执行任务" : "仅待处理任务可执行"}>
              <Button type="text" size="small" icon={<PlayCircleOutlined />} disabled={record.taskStatus !== "PENDING" || submitting} />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const detailColumns: ColumnsType<RefundBatchDetail> = [
    { title: "明细 ID", dataIndex: "id", width: 100 },
    { title: "订单 ID", dataIndex: "orderRecordId", width: 120, render: (value: number) => value || "-" },
    { title: "短链接", dataIndex: "tinyUrl", width: 260, ellipsis: true },
    {
      title: "数量",
      key: "numbers",
      width: 240,
      render: (_, record) => `初始 ${record.initNum || 0} · 当前 ${record.factEndNum || 0} · 下单 ${record.orderNum || 0}`,
    },
    {
      title: "人工审核",
      key: "review",
      width: 170,
      render: (_, record) => `已审 ${record.rgApproveNum || 0} · 未审 ${record.rgUnApproveNum || 0}`,
    },
    {
      title: "状态",
      dataIndex: "detailStatus",
      width: 120,
      render: (value: string, record) => <Tag color={statusColor(value)}>{record.detailStatusDesc || statusText(value)}</Tag>,
    },
    { title: "失败原因", dataIndex: "errorReason", width: 240, ellipsis: true, render: (value: string) => value || "-" },
    { title: "处理时间", dataIndex: "processedAt", width: 180, render: formatTime },
  ];

  return (
    <div className="manager-page-stack">
      <section className="manager-stats-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(150px, 150px))" }}>
        {stats.map((item) => (
          <div key={item.label} className="manager-metric-chip manager-metric-chip-compact">
            <Text style={{ color: "var(--manager-text-faint)", fontSize: 12 }}>{item.label}</Text>
            <div className="manager-value" style={{ marginTop: 4, fontSize: 22, lineHeight: 1.1 }}>{item.value}</div>
          </div>
        ))}
      </section>

      <section className="manager-data-card manager-toolbar-panel">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
          <Space wrap>
            <Select
              value={query.taskStatus}
              options={taskStatusOptions}
              style={{ width: 160 }}
              onChange={(taskStatus) => void loadTasks({ ...query, pageIndex: 1, taskStatus })}
            />
            <Button icon={<ReloadOutlined />} loading={loading} onClick={() => void loadTasks()}>刷新</Button>
          </Space>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setImportOpen(true)}>新建退单任务</Button>
        </div>
      </section>

      <section className="manager-data-card manager-table">
        <Table<RefundBatchTask>
          rowKey="id"
          loading={loading}
          dataSource={tasks}
          columns={taskColumns}
          scroll={{ x: 1250 }}
          onRow={(record) => ({
            tabIndex: 0,
            role: "button",
            "aria-label": `查看任务 ${record.taskName || record.id} 的退单明细`,
            style: { cursor: "pointer" },
            onClick: () => openDetails(record),
            onKeyDown: (event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                openDetails(record);
              }
            },
          })}
          pagination={{
            current: query.pageIndex,
            pageSize: query.pageSize,
            total,
            showSizeChanger: true,
            onChange: (pageIndex, pageSize) => void loadTasks({ ...query, pageIndex, pageSize }),
          }}
        />
      </section>

      <Modal
        title="新建批量退单任务"
        open={importOpen}
        okText="导入"
        cancelText="取消"
        confirmLoading={submitting}
        onOk={handleImport}
        onCancel={() => { setImportOpen(false); importForm.resetFields(); }}
      >
        <Form<ImportFormValues> className="manager-form-skin" form={importForm} layout="vertical" preserve={false}>
          <Form.Item name="taskName" label="任务名称">
            <Input placeholder="不填写时由系统自动生成" maxLength={100} />
          </Form.Item>
          <Form.Item name="tinyUrls" label="短链接列表" rules={[{ required: true, message: "请输入短链接" }]}>
            <Input.TextArea rows={10} placeholder="每行一个 tiny_url" />
          </Form.Item>
        </Form>
      </Modal>

      <Drawer
        title={detailTask ? `${detailTask.taskName || `任务 ${detailTask.id}`} · 退单明细` : "退单明细"}
        open={Boolean(detailTask)}
        width="min(1180px, 94vw)"
        destroyOnClose
        extra={detailTask ? (
          <Space size={8}>
            {detailTask.taskStatus === "PROCESSING" && <Text type="secondary"><SyncOutlined spin /> 每 2 秒更新</Text>}
            <Tag color={statusColor(detailTask.taskStatus)}>{detailTask.taskStatusDesc || statusText(detailTask.taskStatus)}</Tag>
          </Space>
        ) : null}
        onClose={() => { setDetailTask(null); setDetails([]); setDetailTotal(0); }}
      >
        {detailTask && (
          <div style={{ marginBottom: 16 }}>
            <Progress
              percent={taskProgress(detailTask)}
              status={detailTask.taskStatus === "FAILED" ? "exception" : detailTask.taskStatus === "COMPLETED" ? "success" : "active"}
            />
            <Space size={8} wrap>
              <Text type="secondary">共 {detailTask.totalCount || 0} 条</Text>
              <Tag color="success">成功 {detailTask.successCount || 0}</Tag>
              <Tag color="error">失败 {detailTask.failCount || 0}</Tag>
              <Tag>待处理 {detailTask.pendingCount || 0}</Tag>
            </Space>
          </div>
        )}
        <Space wrap style={{ marginBottom: 16 }}>
          <InputNumber
            min={1}
            precision={0}
            placeholder="订单 ID"
            value={detailQuery.orderRecordId}
            onChange={(value) => setDetailQuery((current) => ({ ...current, orderRecordId: value ? Number(value) : undefined }))}
          />
          <Input
            prefix={<SearchOutlined />}
            placeholder="搜索短链接"
            value={detailQuery.tinyUrl}
            onChange={(event) => setDetailQuery((current) => ({ ...current, tinyUrl: event.target.value }))}
            onPressEnter={() => detailTask && void loadDetails(detailTask, { ...detailQuery, pageIndex: 1 })}
            style={{ width: 280 }}
          />
          <Button type="primary" icon={<SearchOutlined />} onClick={() => detailTask && void loadDetails(detailTask, { ...detailQuery, pageIndex: 1 })}>查询</Button>
          <Button icon={<ReloadOutlined />} onClick={() => detailTask && void loadDetails(detailTask)}>刷新</Button>
        </Space>
        <Table<RefundBatchDetail>
          rowKey="id"
          loading={detailLoading}
          dataSource={details}
          columns={detailColumns}
          scroll={{ x: 1450 }}
          pagination={{
            current: detailQuery.pageIndex,
            pageSize: detailQuery.pageSize,
            total: detailTotal,
            showSizeChanger: true,
            onChange: (pageIndex, pageSize) => detailTask && void loadDetails(detailTask, { ...detailQuery, pageIndex, pageSize }),
          }}
        />
      </Drawer>
    </div>
  );
}

function statusColor(value: string) {
  if (value === "COMPLETED" || value === "SUCCESS") return "success";
  if (value === "FAILED") return "error";
  if (value === "PROCESSING") return "processing";
  return "default";
}

function taskProgress(task: RefundBatchTask) {
  const completed = (task.successCount || 0) + (task.failCount || 0);
  return task.totalCount > 0 ? Math.min(100, Math.round((completed / task.totalCount) * 100)) : 0;
}

function statusText(value: string) {
  const labels: Record<string, string> = {
    PENDING: "待处理",
    PROCESSING: "处理中",
    COMPLETED: "已完成",
    SUCCESS: "成功",
    FAILED: "失败",
  };
  return labels[value] || value || "-";
}

function formatTime(value: string | number | null) {
  if (!value) return "-";
  const parsed = dayjs(value);
  return parsed.isValid() ? parsed.format("YYYY-MM-DD HH:mm:ss") : String(value);
}
