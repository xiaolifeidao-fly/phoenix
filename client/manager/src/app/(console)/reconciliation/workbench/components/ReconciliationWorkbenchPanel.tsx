"use client";

import { useMemo, useState } from "react";
import { CalendarOutlined, ReloadOutlined } from "@ant-design/icons";
import { Button, DatePicker, Space, Tooltip, Typography } from "antd";
import dayjs, { type Dayjs } from "dayjs";
import { message } from "@/utils/notify";
import { dateRangePresets } from "@/utils/date-range-presets";
import { useAccountStatus } from "../hooks/useAccountStatus";
import { useLedger } from "../hooks/useLedger";
import { useManualBook } from "../../manual-book/hooks/useManualBook";
import { useDebtCompare } from "../../manual-book/hooks/useDebtCompare";
import { useManualDimension } from "../hooks/useManualDimension";
import { useUpstreamDimension } from "../hooks/useUpstreamDimension";
import { AccountStatusCard } from "./AccountStatusCard";
import { DimensionAccountingCard } from "./DimensionAccountingCard";
import { LedgerCard } from "./LedgerCard";
import { ManualBookCard } from "../../manual-book/components/ManualBookCard";
import { DebtCompareCard } from "../../manual-book/components/DebtCompareCard";
import { MoneyCell } from "./shared";

const { RangePicker } = DatePicker;
const { Text } = Typography;

/** 默认本月：月初到今天 */
const buildDefaultRange = (): [Dayjs, Dayjs] => [dayjs().startOf("month"), dayjs().startOf("day")];

export function ReconciliationWorkbenchPanel() {
  const [range, setRange] = useState<[Dayjs, Dayjs]>(buildDefaultRange);

  const manualDimension = useManualDimension(range);
  const ledger = useLedger(range);
  const accountStatus = useAccountStatus(range);
  const manualBook = useManualBook(range);
  const debtCompare = useDebtCompare(range);

  /** 出入账增删改、同步提现之后，人工记账的利润对比跟着重算 */
  const afterLedgerChange = <T,>(result: T) => {
    void manualBook.refresh();
    void debtCompare.refresh();
    return result;
  };
  const ledgerState = {
    ...ledger,
    save: (...args: Parameters<typeof ledger.save>) => ledger.save(...args).then(afterLedgerChange),
    remove: (id: number) => ledger.remove(id).then(afterLedgerChange),
    syncWithdraw: () => ledger.syncWithdraw().then(afterLedgerChange),
  };
  /** 人工记账改了社区欠款，欠款核对跟着重算 */
  const afterBookChange = <T,>(result: T) => {
    void debtCompare.refresh();
    return result;
  };
  const manualBookState = {
    ...manualBook,
    save: (...args: Parameters<typeof manualBook.save>) => manualBook.save(...args).then(afterBookChange),
    remove: (id: number) => manualBook.remove(id).then(afterBookChange),
  };

  const upstream = useUpstreamDimension(range);

  /** 上游应收 = 充值金额 − 返点金额，只有 RMB */
  const baselines = useMemo(
    () => ({
      receivable: {
        rmb: (upstream.data?.rechargeAmount ?? 0) - (upstream.data?.rebateAmount ?? 0),
      },
    }),
    [upstream.data],
  );

  const overview = useMemo(
    () => [
      { label: "总计入账 RMB", value: ledger.summary?.inRmb ?? 0 },
      { label: "总计出账 RMB", value: ledger.summary?.outRmb ?? 0 },
      { label: "净入账 RMB", value: ledger.summary?.netRmb ?? 0 },
      { label: "上游应收 RMB", value: baselines.receivable.rmb },
    ],
    [ledger.summary, baselines],
  );

  const handleReset = () => {
    setRange(buildDefaultRange());
    // 区间没变时 hook 不会自己重查，这里显式刷新一次
    void manualDimension.refresh();
    void ledger.refresh();
    void upstream.refresh();
    void accountStatus.refresh();
    void manualBook.refresh();
    void debtCompare.refresh();
    message.success("已重置为本月");
  };

  return (
    <div className="manager-page-stack recon-page">
      {/* 标题栏 + 概览固定在顶栏下方，不随页面滚动 */}
      <div className="recon-sticky-head">
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
              <Tooltip title="日期重置为本月并重新加载">
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
      </div>

      <DimensionAccountingCard
        manualDimension={manualDimension.data}
        manualLoading={manualDimension.loading}
        manualError={manualDimension.error}
        onManualRetry={() => void manualDimension.refresh()}
        upstream={upstream.data}
        upstreamLoading={upstream.loading}
        upstreamError={upstream.error}
        onUpstreamRetry={() => void upstream.refresh()}
      />

      <div className="recon-duo-grid">
        <LedgerCard
          ledger={ledgerState}
          defaultDate={range[0]}
        />

        <AccountStatusCard
          rows={accountStatus.rows}
          loading={accountStatus.loading}
          error={accountStatus.error}
          onRetry={() => {
            // 录入 / 修改 / 撤销人工录入欠款后也走这里，欠款核对的起点跟着变
            void accountStatus.refresh();
            void debtCompare.refresh();
          }}
          range={range}
        />
      </div>

      {/* 和「对账 - 人工记账」页面是同一个组件，日期跟随工作台顶部的区间 */}
      <ManualBookCard book={manualBookState} />

      <DebtCompareCard compare={debtCompare} />
    </div>
  );
}
