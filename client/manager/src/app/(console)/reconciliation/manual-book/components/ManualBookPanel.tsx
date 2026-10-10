"use client";

import { useState } from "react";
import { CalendarOutlined, ReloadOutlined } from "@ant-design/icons";
import { Button, DatePicker, Space, Tabs, Tooltip } from "antd";
import dayjs, { type Dayjs } from "dayjs";
import { message } from "@/utils/notify";
import { dateRangePresets } from "@/utils/date-range-presets";
import { LedgerCard } from "../../workbench/components/LedgerCard";
import { useLedger } from "../../workbench/hooks/useLedger";
import { MANUAL_DIMENSION_MAX_DAYS } from "../../workbench/hooks/useManualDimension";
import { useDebtCompare } from "../hooks/useDebtCompare";
import { useManualBook } from "../hooks/useManualBook";
import { DebtCompareCard } from "./DebtCompareCard";
import { ManualBookCard } from "./ManualBookCard";

const { RangePicker } = DatePicker;

type PanelTab = "ledger" | "manual-book" | "debt-compare";

/** 默认当天 */
const buildDefaultRange = (): [Dayjs, Dayjs] => [dayjs().startOf("day"), dayjs().startOf("day")];

/**
 * 对账 - 人工记账：两个页签共用一个时间段。
 * 出入账复用对账工作台的出入账组件，人工记账、欠款核对和工作台底部用的是同一组组件。
 */
export function ManualBookPanel() {
  const [tab, setTab] = useState<PanelTab>("ledger");
  const [range, setRange] = useState<[Dayjs, Dayjs]>(buildDefaultRange);
  const ledger = useLedger(range);
  const book = useManualBook(range);
  const debtCompare = useDebtCompare(range);

  /** 出入账增删改、同步提现之后，人工记账的利润对比和欠款核对跟着重算 */
  const afterLedgerChange = <T,>(result: T) => {
    void book.refresh();
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
  const bookState = {
    ...book,
    save: (...args: Parameters<typeof book.save>) => book.save(...args).then(afterBookChange),
    remove: (id: number) => book.remove(id).then(afterBookChange),
  };

  const handleReset = () => {
    setRange(buildDefaultRange());
    // 区间没变时 hook 不会自己重查，这里显式刷新一次
    void ledger.refresh();
    void book.refresh();
    void debtCompare.refresh();
    message.success("已重置为当天");
  };

  const filters = (
    <Space size={8} wrap>
      <RangePicker
        value={range}
        allowClear={false}
        presets={dateRangePresets}
        suffixIcon={<CalendarOutlined />}
        style={{ width: 268 }}
        disabledDate={(current, info) =>
          // 区间最长 93 天，选了一端后另一端超出范围的日期置灰
          !!info?.from && Math.abs(current.startOf("day").diff(info.from.startOf("day"), "day")) >= MANUAL_DIMENSION_MAX_DAYS
        }
        onChange={(value) =>
          value?.[0] && value[1] ? setRange([value[0].startOf("day"), value[1].startOf("day")]) : undefined
        }
      />
      <Tooltip title="日期重置为当天并重新加载">
        <Button icon={<ReloadOutlined />} onClick={handleReset}>
          重置
        </Button>
      </Tooltip>
    </Space>
  );

  return (
    <div className="manager-page-stack recon-page">
      <Tabs
        activeKey={tab}
        onChange={(key) => setTab(key as PanelTab)}
        tabBarExtraContent={filters}
        items={[
          {
            key: "ledger",
            label: "出入账",
            children: <LedgerCard ledger={ledgerState} range={range} />,
          },
          {
            key: "manual-book",
            label: "人工记账",
            children: <ManualBookCard book={bookState} />,
          },
          {
            key: "debt-compare",
            label: "欠款核对",
            children: <DebtCompareCard compare={debtCompare} />,
          },
        ]}
      />
    </div>
  );
}
