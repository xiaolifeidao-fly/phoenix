"use client";

import { useMemo } from "react";
import { Drawer } from "antd";
import dayjs, { type Dayjs } from "dayjs";
import type { useFeeChannel } from "../../workbench/hooks/useFeeChannel";
import { useManualDimension } from "../../workbench/hooks/useManualDimension";
import { useUpstreamDimension } from "../../workbench/hooks/useUpstreamDimension";
import { DimensionAccountingView } from "../../workbench/components/DimensionAccountingCard";

type FeeChannelState = ReturnType<typeof useFeeChannel>;

/** 要看的日期：某一天时 startDate = endDate；合计行为整个所选区间 */
export interface DimensionDetailTarget {
  startDate: string;
  endDate: string;
}

interface DimensionDetailDrawerProps {
  target: DimensionDetailTarget | null;
  collectChannel: FeeChannelState;
  payoutChannel: FeeChannelState;
  onClose: () => void;
}

/** 人工记账里点「做单利润」：按那一天（或整个区间）展示人工维度、上游维度和做单维度利润，样式同对账工作台「维度核算」 */
export function DimensionDetailDrawer({ target, collectChannel, payoutChannel, onClose }: DimensionDetailDrawerProps) {
  const sameDay = target?.startDate === target?.endDate;
  return (
    <Drawer
      title={target ? `${sameDay ? target.startDate : `${target.startDate} ~ ${target.endDate}`} 做单维度` : "做单维度"}
      open={!!target}
      width="min(1500px, 94vw)"
      destroyOnClose
      onClose={onClose}
      extra={
        target && !sameDay ? (
          <span className="recon-subcard-caption">整个区间一起算，返点估算按区间合计的比例，可能和每天相加略有差别</span>
        ) : (
          <span className="recon-subcard-caption">通道在人工记账表格上方选，这里可改币种和费率</span>
        )
      }
    >
      {target ? (
        <DimensionDetailBody target={target} collectChannel={collectChannel} payoutChannel={payoutChannel} />
      ) : null}
    </Drawer>
  );
}

/** 打开抽屉才挂载，才去查人工维度 / 上游维度 */
function DimensionDetailBody({
  target,
  collectChannel,
  payoutChannel,
}: {
  target: DimensionDetailTarget;
  collectChannel: FeeChannelState;
  payoutChannel: FeeChannelState;
}) {
  const range = useMemo<[Dayjs, Dayjs]>(() => [dayjs(target.startDate), dayjs(target.endDate)], [target.startDate, target.endDate]);
  const manual = useManualDimension(range);
  const upstream = useUpstreamDimension(range);
  return (
    <div className="recon-card">
      <DimensionAccountingView
        manualDimension={manual.data}
        manualLoading={manual.loading}
        manualError={manual.error}
        onManualRetry={() => void manual.refresh()}
        upstream={upstream.data}
        upstreamLoading={upstream.loading}
        upstreamError={upstream.error}
        onUpstreamRetry={() => void upstream.refresh()}
        collectChannel={collectChannel}
        payoutChannel={payoutChannel}
        sharedChannel
      />
    </div>
  );
}
