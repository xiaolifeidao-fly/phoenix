"use client";

import { useEffect, useMemo, useState } from "react";
import dayjs, { type Dayjs } from "dayjs";
import {
  CheckCircleOutlined,
  DownloadOutlined,
  ReloadOutlined,
  SearchOutlined,
  WalletOutlined,
} from "@ant-design/icons";
import { Button, DatePicker, Modal, Select, Space, Table, Typography } from "antd";
import type { ColumnsType } from "antd/es/table";
import { message } from "@/utils/notify";
import { dateRangePresets } from "@/utils/date-range-presets";
import { fetchManualChannels, type ManualChannelRecord } from "../../api/channel.api";
import {
  accountManualWithdrawSummary,
  fetchManualWithdrawRecords,
  fetchManualWithdrawSummaries,
  finishManualWithdrawSummary,
  type ManualWithdrawSummary,
} from "../../api/withdraw.api";

const { Text } = Typography;
const { RangePicker } = DatePicker;

/** 与 BFF WithdrawSummaryMaxDays 保持一致 */
const MAX_RANGE_DAYS = 31;

type ActionMode = "account" | "finish";

interface ActionState {
  mode: ActionMode;
  row: ManualWithdrawSummary;
}

const actionMeta: Record<ActionMode, { title: string; desc: string; success: string }> = {
  account: {
    title: "确认发起结算",
    desc: "该日「审核中（APPROVING）」的提现会批量推进到「结算中」。待审核（UN_APPROVE）的记录不受影响。",
    success: "已发起结算，后台异步处理，稍后刷新查看",
  },
  finish: {
    title: "确认发起核销",
    desc: "该日「结算中」的提现会批量核销为「提现成功」，并扣除用户冻结积分。请确认已完成打款。",
    success: "已发起核销，后台异步处理，稍后刷新查看",
  },
};

export function WithdrawSummaryTab() {
  const [channels, setChannels] = useState<ManualChannelRecord[]>([]);
  const [channelLoading, setChannelLoading] = useState(false);
  const [channel, setChannel] = useState("");
  const [dateRange, setDateRange] = useState<[Dayjs, Dayjs]>(createDefaultDateRange);
  const [rows, setRows] = useState<ManualWithdrawSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionState, setActionState] = useState<ActionState | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [exportingDate, setExportingDate] = useState("");

  const loadRows = async (targetChannel = channel, range = dateRange) => {
    if (!targetChannel) {
      message.warning("请选择渠道");
      return;
    }
    setLoading(true);
    try {
      const result = await fetchManualWithdrawSummaries({
        channel: targetChannel,
        startDate: range[0].format("YYYY-MM-DD"),
        endDate: range[1].format("YYYY-MM-DD"),
      });
      setRows(result);
    } catch (error) {
      message.error(error instanceof Error ? error.message : "加载提现汇总失败");
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const loadChannels = async () => {
      setChannelLoading(true);
      try {
        const result = await fetchManualChannels();
        setChannels(result);
        const first = result.find((item) => item.code)?.code ?? "";
        if (first) {
          setChannel(first);
          void loadRows(first);
        }
      } catch (error) {
        message.error(error instanceof Error ? error.message : "加载渠道选项失败");
      } finally {
        setChannelLoading(false);
      }
    };
    void loadChannels();
    // 首次进入只加载一次，后续由「查询」按钮触发
  }, []);

  const channelOptions = useMemo(
    () =>
      channels
        .filter((item) => item.code)
        .map((item) => ({
          label: item.name ? `${item.name} (${item.code})` : item.code,
          value: item.code,
        })),
    [channels],
  );

  const totals = useMemo(
    () =>
      rows.reduce(
        (sum, row) => ({
          approvingNum: sum.approvingNum + row.approvingNum,
          approvingPoints: sum.approvingPoints + row.approvingPoints,
          accountingNum: sum.accountingNum + row.accountingNum,
          accountingPoints: sum.accountingPoints + row.accountingPoints,
          finishNum: sum.finishNum + row.finishNum,
          finishPoints: sum.finishPoints + row.finishPoints,
          errorNum: sum.errorNum + row.errorNum,
          errorPoints: sum.errorPoints + row.errorPoints,
        }),
        {
          approvingNum: 0,
          approvingPoints: 0,
          accountingNum: 0,
          accountingPoints: 0,
          finishNum: 0,
          finishPoints: 0,
          errorNum: 0,
          errorPoints: 0,
        },
      ),
    [rows],
  );

  const handleAction = async () => {
    if (!actionState) {
      return;
    }
    const { mode, row } = actionState;
    const payload = { channel: row.channel, startDate: row.date, endDate: row.date };
    setSubmitting(true);
    try {
      if (mode === "account") {
        await accountManualWithdrawSummary(payload);
      } else {
        await finishManualWithdrawSummary(payload);
      }
      message.success(actionMeta[mode].success);
      setActionState(null);
      await loadRows();
    } catch (error) {
      message.error(error instanceof Error ? error.message : "操作失败");
    } finally {
      setSubmitting(false);
    }
  };

  /** 导出某天「结算中」明细，列同老管理端导出 */
  const handleExport = async (row: ManualWithdrawSummary) => {
    setExportingDate(row.date);
    try {
      const day = dayjs(row.date);
      const records = await fetchManualWithdrawRecords({
        channel: row.channel,
        status: "ACCOUNTING",
        startTime: day.startOf("day").format("YYYY-MM-DD HH:mm:ss"),
        endTime: day.add(1, "day").startOf("day").format("YYYY-MM-DD HH:mm:ss"),
      });
      if (records.length === 0) {
        message.warning("该日没有结算中的提现记录");
        return;
      }
      const XLSX = await import("xlsx");
      const sheet = XLSX.utils.json_to_sheet(
        records.map((item) => ({
          渠道: item.channel,
          账号: item.username,
          积分: Number(item.points || 0),
          申请提现时间: item.applyTime || "",
          支付方式: formatPaymentType(item.paymentType),
          收款人姓名: item.paymentName || "",
          收款账户: item.paymentAccount || "",
        })),
      );
      const book = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(book, sheet, "结算中");
      XLSX.writeFile(book, `提现结算中_${row.channel}_${row.date}.xlsx`);
    } catch (error) {
      message.error(error instanceof Error ? error.message : "导出失败");
    } finally {
      setExportingDate("");
    }
  };

  const columns: ColumnsType<ManualWithdrawSummary> = [
    { title: "日期", dataIndex: "date", width: 120, fixed: "left" },
    { title: "渠道", dataIndex: "channel", width: 120 },
    countColumn("审核中", "approvingNum", "approvingPoints"),
    countColumn("结算中", "accountingNum", "accountingPoints"),
    countColumn("提现完成", "finishNum", "finishPoints"),
    countColumn("提现失败", "errorNum", "errorPoints"),
    {
      title: "操作",
      key: "actions",
      fixed: "right",
      width: 300,
      render: (_, row) => (
        <Space size={4} wrap>
          <Button
            type="text"
            size="small"
            icon={<WalletOutlined />}
            disabled={row.approvingNum <= 0}
            onClick={() => setActionState({ mode: "account", row })}
          >
            发起结算
          </Button>
          <Button
            type="text"
            size="small"
            icon={<CheckCircleOutlined />}
            disabled={row.accountingNum <= 0}
            onClick={() => setActionState({ mode: "finish", row })}
          >
            发起核销
          </Button>
          <Button
            type="text"
            size="small"
            icon={<DownloadOutlined />}
            disabled={row.accountingNum <= 0}
            loading={exportingDate === row.date}
            onClick={() => void handleExport(row)}
          >
            导出结算中
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <Space direction="vertical" size={16} style={{ width: "100%" }}>
      <Space size={[12, 12]} wrap>
        <Select
          showSearch
          optionFilterProp="label"
          placeholder="选择渠道"
          loading={channelLoading}
          options={channelOptions}
          style={{ width: 240 }}
          value={channel || undefined}
          onChange={(value) => setChannel(value)}
        />
        <RangePicker
          allowClear={false}
          presets={dateRangePresets}
          value={dateRange}
          disabledDate={(current) => current.isAfter(dayjs(), "day")}
          onChange={(value) => {
            if (!value || !value[0] || !value[1]) {
              return;
            }
            if (value[1].diff(value[0], "day") + 1 > MAX_RANGE_DAYS) {
              message.warning(`日期跨度不能超过 ${MAX_RANGE_DAYS} 天`);
              return;
            }
            setDateRange([value[0], value[1]]);
          }}
        />
        <Button type="primary" icon={<SearchOutlined />} onClick={() => void loadRows()}>
          查询
        </Button>
        <Button icon={<ReloadOutlined />} onClick={() => void loadRows()}>
          刷新
        </Button>
      </Space>
      <Text type="secondary">
        按申请提现时间逐日汇总；审核中含待审核。结算、核销按「渠道 + 当天」批量提交，后台异步执行，提交后稍等再刷新。
      </Text>

      <Table<ManualWithdrawSummary>
        rowKey={(row) => `${row.channel}_${row.date}`}
        loading={loading}
        columns={columns}
        dataSource={rows}
        scroll={{ x: 1100 }}
        pagination={false}
        summary={() =>
          rows.length > 1 ? (
            <Table.Summary.Row>
              <Table.Summary.Cell index={0} colSpan={2}>
                <Text strong>合计</Text>
              </Table.Summary.Cell>
              <Table.Summary.Cell index={2}>{formatCount(totals.approvingNum, totals.approvingPoints)}</Table.Summary.Cell>
              <Table.Summary.Cell index={3}>{formatCount(totals.accountingNum, totals.accountingPoints)}</Table.Summary.Cell>
              <Table.Summary.Cell index={4}>{formatCount(totals.finishNum, totals.finishPoints)}</Table.Summary.Cell>
              <Table.Summary.Cell index={5}>{formatCount(totals.errorNum, totals.errorPoints)}</Table.Summary.Cell>
              <Table.Summary.Cell index={6} />
            </Table.Summary.Row>
          ) : null
        }
      />

      <Modal
        open={Boolean(actionState)}
        title={actionState ? actionMeta[actionState.mode].title : ""}
        confirmLoading={submitting}
        onOk={() => void handleAction()}
        onCancel={() => setActionState(null)}
        okText="确认"
        cancelText="取消"
      >
        {actionState ? (
          <Space direction="vertical" size={10} style={{ width: "100%" }}>
            <Text>{`渠道：${actionState.row.channel}`}</Text>
            <Text>{`日期：${actionState.row.date}`}</Text>
            {actionState.mode === "account" ? (
              <Text>{`审核中：${formatCount(actionState.row.approvingNum, actionState.row.approvingPoints)}`}</Text>
            ) : (
              <Text>{`结算中：${formatCount(actionState.row.accountingNum, actionState.row.accountingPoints)}`}</Text>
            )}
            <Text type="secondary">{actionMeta[actionState.mode].desc}</Text>
          </Space>
        ) : null}
      </Modal>
    </Space>
  );
}

function countColumn(
  title: string,
  numKey: keyof ManualWithdrawSummary,
  pointsKey: keyof ManualWithdrawSummary,
): ColumnsType<ManualWithdrawSummary>[number] {
  return {
    title,
    key: numKey,
    width: 160,
    render: (_, row) => formatCount(Number(row[numKey]), Number(row[pointsKey])),
  };
}

function formatCount(num: number, points: number) {
  return `${num.toLocaleString("zh-CN")} 笔 / ${points.toLocaleString("zh-CN")} 积分`;
}

function createDefaultDateRange(): [Dayjs, Dayjs] {
  return [dayjs().subtract(6, "day").startOf("day"), dayjs().startOf("day")];
}

function formatPaymentType(value?: string) {
  switch ((value || "").toUpperCase()) {
    case "ALIPAY":
      return "支付宝";
    case "WECHAT":
      return "微信";
    case "WALLET":
      return "钱包";
    default:
      return value || "";
  }
}
