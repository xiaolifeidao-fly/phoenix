"use client";

import { useEffect, useMemo, useState } from "react";
import {
  fetchSettleChannels,
  type SettleChannelRecord,
  type SettleCurrency,
} from "@/app/(console)/manual/api/settle.api";

type FeeKind = "collect" | "payout";

interface FeeChannelPref {
  channelId?: number;
  currency: SettleCurrency;
  /** 本页改过的费率，键为「通道 id:币种」，值为小数（0.01 = 1%） */
  rates?: Record<string, number>;
}

function rateKey(channelId: number, currency: SettleCurrency) {
  return `${channelId}:${currency}`;
}

function readRates(value: unknown): Record<string, number> | undefined {
  if (!value || typeof value !== "object") {
    return undefined;
  }
  const rates: Record<string, number> = {};
  for (const [key, rate] of Object.entries(value as Record<string, unknown>)) {
    if (typeof rate === "number" && Number.isFinite(rate) && rate >= 0 && rate <= 1) {
      rates[key] = rate;
    }
  }
  return rates;
}

/** 通道配置的费率：按 U 取 U 费率，按 RMB 取 RMB 费率 */
function channelFeeRate(channel: SettleChannelRecord | undefined, currency: SettleCurrency, kind: FeeKind) {
  if (!channel) {
    return 0;
  }
  return (
    (currency === "USDT"
      ? kind === "collect"
        ? channel.collectFeeRateU
        : channel.payoutFeeRateU
      : kind === "collect"
        ? channel.collectFeeRate
        : channel.payoutFeeRate) || 0
  );
}

function readPref(storageKey: string, defaultCurrency: SettleCurrency): FeeChannelPref {
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<FeeChannelPref>;
      return {
        channelId: typeof parsed.channelId === "number" ? parsed.channelId : undefined,
        currency: parsed.currency === "USDT" || parsed.currency === "RMB" ? parsed.currency : defaultCurrency,
        rates: readRates(parsed.rates),
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
 * 维度核算估算手续费用的结算通道、币种和费率：选择存在 localStorage，
 * 没选过、或选过的通道已不存在 / 已停用时，取默认通道（没有默认取第一个启用的）。
 * 费率默认取通道配置，可在本页按「通道 + 币种」改，只影响本页估算，不写回结算通道。
 */
export function useFeeChannel(storageKey: string, defaultCurrency: SettleCurrency, kind: FeeKind) {
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

  const channelRate = channelFeeRate(channel, pref.currency, kind);
  const key = channel ? rateKey(channel.id, pref.currency) : undefined;
  const overrideRate = key !== undefined ? pref.rates?.[key] : undefined;

  const update = (next: Partial<FeeChannelPref>) => {
    const merged = { channelId: channel?.id, currency: pref.currency, rates: pref.rates, ...next };
    setPref(merged);
    writePref(storageKey, merged);
  };

  /** 改当前通道 + 币种的费率；传 null 或与通道配置相同时恢复通道费率 */
  const setRate = (rate: number | null) => {
    if (key === undefined) {
      return;
    }
    const rates = { ...pref.rates };
    if (rate === null || Math.abs(rate - channelRate) < 1e-12) {
      delete rates[key];
    } else {
      rates[key] = rate;
    }
    update({ rates });
  };

  return {
    channels: enabledChannels,
    channel,
    currency: pref.currency,
    /** 实际用于计算的费率 */
    rate: overrideRate ?? channelRate,
    channelRate,
    rateOverridden: overrideRate !== undefined,
    setChannelId: (channelId: number) => update({ channelId }),
    setCurrency: (currency: SettleCurrency) => update({ currency }),
    setRate,
  };
}

/**
 * 按所选费率估算手续费，金额均为 RMB：
 * 按 U 时用 U 费率（与出入账一致：U 手续费 = U 金额 × U 费率，折回 RMB 即 RMB 金额 × U 费率），通道有汇率时附带 U 值。
 */
export function estimateFee(amountRmb: number, state: ReturnType<typeof useFeeChannel>) {
  if (!state.channel) {
    return { feeRmb: 0, feeU: null as number | null };
  }
  const feeRmb = amountRmb * state.rate;
  const feeU = state.currency === "USDT" && state.channel.exchangeRate ? feeRmb / state.channel.exchangeRate : null;
  return { feeRmb, feeU };
}
