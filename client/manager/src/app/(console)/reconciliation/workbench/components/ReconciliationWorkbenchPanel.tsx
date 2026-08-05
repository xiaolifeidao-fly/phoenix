"use client";

import { useMemo, useState } from "react";
import { CalendarOutlined, ReloadOutlined } from "@ant-design/icons";
import { Button, DatePicker, Space, Tooltip, Typography } from "antd";
import dayjs, { type Dayjs } from "dayjs";
import { message } from "@/utils/notify";
import { dateRangePresets } from "@/utils/date-range-presets";
import {
  DEFAULT_RANGE_END,
  DEFAULT_RANGE_START,
  accountManualRows as initialAccountManualRows,
  accountSystemRows,
  ledgerRecords as initialLedgerRecords,
  manualDimensionRows,
  upstreamDimensionRows,
} from "../data/reconciliation.mock";
import type { AccountManualRow, LedgerRecord } from "../types";
import { AccountStatusCard } from "./AccountStatusCard";
import { DimensionAccountingCard } from "./DimensionAccountingCard";
import { LedgerCard } from "./LedgerCard";
import { MoneyCell } from "./shared";

const { RangePicker } = DatePicker;
const { Text } = Typography;

const defaultRange: [Dayjs, Dayjs] = [dayjs(DEFAULT_RANGE_START), dayjs(DEFAULT_RANGE_END)];

export function ReconciliationWorkbenchPanel() {
  const [range, setRange] = useState<[Dayjs, Dayjs]>(defaultRange);
  const [ledgerRows, setLedgerRows] = useState<LedgerRecord[]>(initialLedgerRecords);
  const [manualAccountRows, setManualAccountRows] = useState<AccountManualRow[]>(initialAccountManualRows);

  const baselines = useMemo(() => {
    const manualOut = manualDimensionRows.find((row) => row.name === "总出款");
    const receivable = upstreamDimensionRows.find((row) => row.name === "应收金额");
    return {
      manualOut: {
        bigRmb: manualOut?.bigRmb ?? 0,
        bigU: manualOut?.bigU ?? 0,
        smallRmb: manualOut?.smallRmb ?? 0,
        smallU: manualOut?.smallU ?? 0,
      },
      receivable: {
        rmb: (receivable?.realRmb ?? 0) + (receivable?.communityRmb ?? 0),
        u: (receivable?.realU ?? 0) + (receivable?.communityU ?? 0),
      },
    };
  }, []);

  const overview = useMemo(() => {
    const sum = (type: LedgerRecord["type"], key: "amountRmb" | "amountU") =>
      ledgerRows.filter((row) => row.type === type).reduce((total, row) => total + (Number(row[key]) || 0), 0);
    const inRmb = sum("入账", "amountRmb");
    const outRmb = sum("出款", "amountRmb");
    return [
      { label: "总计入账 RMB", value: inRmb },
      { label: "总计出款 RMB", value: outRmb },
      { label: "净入账 RMB", value: inRmb - outRmb },
      { label: "上游应收 RMB", value: baselines.receivable.rmb },
    ];
  }, [ledgerRows, baselines]);

  const handleReset = () => {
    setRange(defaultRange);
    setLedgerRows(initialLedgerRecords);
    setManualAccountRows(initialAccountManualRows);
    message.success("已重置为最新对账快照");
  };

  return (
    <div className="manager-page-stack recon-page">
      <section className="manager-data-card recon-toolbar">
        <div className="recon-toolbar-copy">
          <div className="manager-section-label">FINANCE RECONCILIATION</div>
          <div className="recon-toolbar-title">资金出入账对账工作台</div>
          <Text type="secondary" style={{ fontSize: 13 }}>
            只读维度沉淀经营结果，出入账明细负责录入与修正，汇总视图用于复核。
          </Text>
        </div>
        <div className="recon-toolbar-controls">
          <Space size={8} wrap>
            <RangePicker
              value={range}
              allowClear={false}
              presets={dateRangePresets}
              suffixIcon={<CalendarOutlined />}
              style={{ width: 268 }}
              onChange={(value) =>
                value?.[0] && value[1] ? setRange([value[0].startOf("day"), value[1].startOf("day")]) : undefined
              }
            />
            <Tooltip title="重置筛选与本地改动">
              <Button icon={<ReloadOutlined />} onClick={handleReset}>
                重置
              </Button>
            </Tooltip>
          </Space>
        </div>
      </section>

      <section className="manager-stats-grid recon-overview">
        {overview.map((item) => (
          <div className="manager-metric-chip recon-overview-chip" key={item.label}>
            <span className="recon-overview-label">{item.label}</span>
            <span className="recon-overview-value">
              <MoneyCell value={item.value} />
            </span>
          </div>
        ))}
      </section>

      <DimensionAccountingCard manualRows={manualDimensionRows} upstreamRows={upstreamDimensionRows} />

      <div className="recon-duo-grid">
        <LedgerCard
          rows={ledgerRows}
          onChange={setLedgerRows}
          manualOutBaseline={baselines.manualOut}
          receivableBaseline={baselines.receivable}
          defaultDate={range[0]}
        />

        <AccountStatusCard
          systemRows={accountSystemRows}
          manualRows={manualAccountRows}
          onManualRowsChange={setManualAccountRows}
          defaultDate={range[1]}
        />
      </div>
    </div>
  );
}
