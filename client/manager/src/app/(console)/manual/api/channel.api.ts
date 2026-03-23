"use client";

import { getDataList, instance, unwrapApiResponse, type ApiResponse } from "@/utils/axios";

export class ManualChannelRecord {
  id = 0;

  code = "";

  name = "";

  type = "";

  typeDesc = "";

  retailerCommissionScale?: number;

  merchantCommissionScale?: number;

  allowAssign?: boolean;

  assignLimit?: number;

  remark = "";

  createdTime?: string;

  updatedTime?: string;
}

export interface ManualChannelPayload {
  code: string;
  name: string;
  type: string;
  retailerCommissionScale?: number;
  merchantCommissionScale?: number;
  allowAssign?: boolean;
  assignLimit?: number;
  remark?: string;
}

export interface ManualChannelUpdatePayload extends ManualChannelPayload {
  id: number;
}

export async function fetchManualChannels() {
  return getDataList(ManualChannelRecord, "/barry/channel-details");
}

export async function createManualChannel(payload: ManualChannelPayload) {
  const response = await instance.post<ApiResponse<string>>("/barry/channel-details", payload);
  return unwrapApiResponse(response.data);
}

export async function updateManualChannel(payload: ManualChannelUpdatePayload) {
  const response = await instance.put<ApiResponse<string>>("/barry/channel-details", payload);
  return unwrapApiResponse(response.data);
}
