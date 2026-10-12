"use client";

import { Button, InputNumber, Select, Tooltip } from "antd";
import { settleCurrencyOptions } from "@/app/(console)/manual/api/settle.api";
import type { useFeeChannel } from "../hooks/useFeeChannel";
import { money } from "./shared";

type FeeChannelState = ReturnType<typeof useFeeChannel>;

/** 费率（小数）↔ 输入框里的百分比，百分比最多 4 位小数 */
function rateToPercent(rate: number) {
  return Number((rate * 100).toFixed(4));
}

function percentToRate(percent: number) {
  return Number((percent / 100).toFixed(6));
}

export function feeRateText(rate: number) {
  return `${money(rate * 100)}%`;
}

/** 结算通道下拉（只列启用的，默认通道带标注） */
export function FeeChannelSelect({ state, onChange }: { state: FeeChannelState; onChange: (channelId: number) => void }) {
  return (
    <Select
      size="small"
      style={{ width: 140 }}
      placeholder="无可用通道"
      value={state.channel?.id}
      onChange={onChange}
      options={state.channels.map((item) => ({
        value: item.id,
        label: `${item.name}${item.defaultChannel ? "（默认）" : ""}`,
      }))}
    />
  );
}

/**
 * 手续费估算用的通道 / 币种 / 费率选择，存 localStorage；费率默认取通道配置，可在本页改。
 * hideChannel 时不显示通道下拉（几项手续费共用外面一个通道选择）。
 */
export function FeeChannelPicker({ label, state, hideChannel }: { label: string; state: FeeChannelState; hideChannel?: boolean }) {
  return (
    <span className="recon-fee-picker">
      <span className="recon-subcard-caption">{label}</span>
      {hideChannel ? null : <FeeChannelSelect state={state} onChange={state.setChannelId} />}
      <Select
        size="small"
        style={{ width: 110 }}
        value={state.currency}
        onChange={state.setCurrency}
        options={settleCurrencyOptions}
      />
      <Tooltip title={state.channel ? `通道配置费率 ${feeRateText(state.channelRate)}，改动只影响本页估算` : undefined}>
        <InputNumber<number>
          size="small"
          style={{ width: 100 }}
          min={0}
          max={100}
          precision={4}
          controls={false}
          suffix="%"
          disabled={!state.channel}
          value={rateToPercent(state.rate)}
          onChange={(value) => state.setRate(value === null ? null : percentToRate(value))}
        />
      </Tooltip>
      {state.rateOverridden ? (
        <Button size="small" type="link" style={{ padding: 0 }} onClick={() => state.setRate(null)}>
          恢复通道费率
        </Button>
      ) : null}
    </span>
  );
}
