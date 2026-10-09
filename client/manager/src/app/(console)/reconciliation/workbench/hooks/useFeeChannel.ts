"use client";

import { useEffect, useMemo, useState } from "react";
import {
  fetchSettleChannels,
  type SettleChannelRecord,
  type SettleCurrency,
} from "@/app/(console)/manual/api/settle.api";

interface FeeChannelPref {
  channelId?: number;
  currency: SettleCurrency;
}

function readPref(storageKey: string, defaultCurrency: SettleCurrency): FeeChannelPref {
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<FeeChannelPref>;
      return {
        channelId: typeof parsed.channelId === "number" ? parsed.channelId : undefined,
        currency: parsed.currency === "USDT" || parsed.currency === "RMB" ? parsed.currency : defaultCurrency,
      };
    }
  } catch {
    // 隐私模式等读不到 localStorage 时按默认值
  }
  return { currency: defaultCurrency };
}

function writePref(storageKey: string, pref: FeeChannelPref) {
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(pref));
  } catch {
    // 写不进去只影响下次打开的默认值
  }
}

/**
 * 维度核算估算手续费用的结算通道和币种：选择存在 localStorage，
 * 没选过、或选过的通道已不存在 / 已停用时，取默认通道（没有默认取第一个启用的）。
 */
export function useFeeChannel(storageKey: string, defaultCurrency: SettleCurrency) {
  const [channels, setChannels] = useState<SettleChannelRecord[]>([]);
  const [pref, setPref] = useState<FeeChannelPref>({ currency: defaultCurrency });

  useEffect(() => {
    setPref(readPref(storageKey, defaultCurrency));
    fetchSettleChannels()
      .then(setChannels)
      .catch(() => setChannels([]));
  }, [storageKey, defaultCurrency]);

  const enabledChannels = useMemo(() => channels.filter((item) => item.enabled), [channels]);
  const channel =
    enabledChannels.find((item) => item.id === pref.channelId) ??
    enabledChannels.find((item) => item.defaultChannel) ??
    enabledChannels[0];

  const update = (next: Partial<FeeChannelPref>) => {
    const merged = { channelId: channel?.id, currency: pref.currency, ...next };
    setPref(merged);
    writePref(storageKey, merged);
  };

  return {
    channels: enabledChannels,
    channel,
    currency: pref.currency,
    setChannelId: (channelId: number) => update({ channelId }),
    setCurrency: (currency: SettleCurrency) => update({ currency }),
  };
}

/**
 * 按通道费率估算手续费，金额均为 RMB：
 * 按 U 时取 U 费率（与出入账一致：U 手续费 = U 金额 × U 费率，折回 RMB 即 RMB 金额 × U 费率），有汇率时附带 U 值。
 */
export function estimateFee(
  amountRmb: number,
  channel: SettleChannelRecord | undefined,
  currency: SettleCurrency,
  kind: "collect" | "payout",
) {
  if (!channel) {
    return { rate: 0, feeRmb: 0, feeU: null as number | null };
  }
  const rate =
    currency === "USDT"
      ? (kind === "collect" ? channel.collectFeeRateU : channel.payoutFeeRateU) || 0
      : (kind === "collect" ? channel.collectFeeRate : channel.payoutFeeRate) || 0;
  const feeRmb = amountRmb * rate;
  const feeU = currency === "USDT" && channel.exchangeRate ? feeRmb / channel.exchangeRate : null;
  return { rate, feeRmb, feeU };
}
