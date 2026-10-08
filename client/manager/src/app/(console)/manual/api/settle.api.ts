"use client";

import { getData, getDataList, instance, unwrapApiResponse, type ApiResponse } from "@/utils/axios";

/** 结算方式：按 U（USDT）结算 / 按人民币结算。 */
export type SettleCurrency = "USDT" | "RMB";

export const settleCurrencyOptions: Array<{ label: string; value: SettleCurrency }> = [
  { label: "按U结算", value: "USDT" },
  { label: "按RMB结算", value: "RMB" },
];

export function resolveSettleCurrencyText(value?: string) {
  return settleCurrencyOptions.find((item) => item.value === value)?.label ?? "未配置";
}

export class SettleChannelRecord {
  id = 0;

  name = "";

  /** 代收手续费率，0~1 */
  collectFeeRate = 0;

  /** 代付手续费率，0~1 */
  payoutFeeRate = 0;

  /** U 代收手续费率，0~1 */
  collectFeeRateU = 0;

  /** U 代付手续费率，0~1 */
  payoutFeeRateU = 0;

  /** 汇率：1U = ? RMB；未配置时按 U 结算的出入账退回按 RMB 记账 */
  exchangeRate?: number | null;

  enabled = true;

  /** 是否默认通道：用户没绑定通道时，提现记账用它算代付手续费、取汇率；全表最多一个 */
  defaultChannel = false;

  remark = "";

  createdTime?: string;

  updatedTime?: string;
}

export interface SettleChannelPayload {
  name: string;
  collectFeeRate: number;
  payoutFeeRate: number;
  collectFeeRateU: number;
  payoutFeeRateU: number;
  exchangeRate?: number | null;
  enabled: boolean;
  defaultChannel: boolean;
  remark?: string;
}

export class UserSettleConfigRecord {
  userId = 0;

  settleCurrency?: SettleCurrency;

  settleChannelId?: number;

  settleChannelName?: string;

  remark = "";

  updatedTime?: string;
}

export interface UserSettleConfigPayload {
  settleCurrency: SettleCurrency;
  settleChannelId?: number | null;
  remark?: string;
}

export async function fetchSettleChannels() {
  return getDataList(SettleChannelRecord, "/barry/settle-channels");
}

export async function createSettleChannel(payload: SettleChannelPayload) {
  const response = await instance.post<ApiResponse<SettleChannelRecord | null>>("/barry/settle-channels", payload);
  return unwrapApiResponse(response.data);
}

export async function updateSettleChannel(id: number, payload: SettleChannelPayload) {
  const response = await instance.put<ApiResponse<SettleChannelRecord | null>>(`/barry/settle-channels/${id}`, payload);
  return unwrapApiResponse(response.data);
}

/** 未配置时返回 null。 */
export async function fetchUserSettleConfig(userId: number): Promise<UserSettleConfigRecord | null> {
  return getData(UserSettleConfigRecord, `/barry/user-details/${userId}/settle`);
}

export async function saveUserSettleConfig(userId: number, payload: UserSettleConfigPayload) {
  const response = await instance.put<ApiResponse<UserSettleConfigRecord | null>>(
    `/barry/user-details/${userId}/settle`,
    payload,
  );
  return unwrapApiResponse(response.data);
}
