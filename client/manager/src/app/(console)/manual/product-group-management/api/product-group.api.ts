"use client";

import { getDataList, instance, unwrapApiResponse, type ApiResponse } from "@/utils/axios";

export class ShopGroupRecord {
  id = 0;

  name = "";

  code = "";

  status = "";

  active = true;

  createdTime?: string;

  updatedTime?: string;
}

export class BridgeConfigRecord {
  id = 0;

  bridgeCategoryId = 0;

  alias = "";

  mapperUrl = "";

  method = "";

  header = "";

  weight = 0;

  bridgeType = "";

  status = "";

  loadBalanceFlag = false;

  bodyParams = "";

  analysisName = "";

  rateOfSuccess = 0;

  successNum = 0;

  errorNum = 0;

  deleteNum = 0;

  source = "";

  contentType = "";

  fetchType = "";

  fetchAnalysis = "";

  notGetDataNum = 0;

  fetchProxyUrl = "";

  active = true;

  createdTime?: string;

  updatedTime?: string;
}

export interface BridgeConfigPayload {
  alias?: string;
  mapperUrl: string;
  method: string;
  header?: string;
  weight?: number;
  bridgeType: string;
  loadBalanceFlag?: boolean;
  bodyParams?: string;
  analysisName?: string;
  source?: string;
  contentType?: string;
  fetchType?: string;
  fetchAnalysis?: string;
  fetchProxyUrl?: string;
}

export interface ShopGroupPayload {
  name: string;
  code: string;
}

/**
 * 白名单分组：分配策略「白名单维度」的分组字典，挂在商品分组下。
 *
 * 分配策略里存的是 code，name 只用于展示，因此改名不会影响已配置的白名单数据。
 */
export class WhitelistGroupRecord {
  id = 0;

  shopGroupId = 0;

  code = "";

  name = "";

  sortId = 0;

  status = "";

  active = true;

  createdTime?: string;

  updatedTime?: string;
}

export interface WhitelistGroupPayload {
  code: string;
  name: string;
  sortId?: number;
}

export async function fetchShopGroups() {
  return getDataList(ShopGroupRecord, "/barry/shop-groups");
}

export async function createShopGroup(payload: ShopGroupPayload) {
  const response = await instance.post<ApiResponse<ShopGroupRecord>>("/barry/shop-groups", payload);
  return unwrapApiResponse(response.data);
}

export async function updateShopGroup(shopGroupId: number, payload: ShopGroupPayload) {
  const response = await instance.put<ApiResponse<ShopGroupRecord>>(`/barry/shop-groups/${shopGroupId}`, payload);
  return unwrapApiResponse(response.data);
}

export async function deleteShopGroup(shopGroupId: number) {
  const response = await instance.delete<ApiResponse<{ deleted: boolean }>>(`/barry/shop-groups/${shopGroupId}`);
  return unwrapApiResponse(response.data);
}

export async function fetchBridgeConfigs(shopGroupId: number) {
  return getDataList(BridgeConfigRecord, `/barry/shop-groups/${shopGroupId}/bridge-configs`);
}

export async function fetchBridgeTypes() {
  const response = await instance.get<ApiResponse<string[]>>("/barry/workbench-dashboard/bridge-types");
  return unwrapApiResponse(response.data);
}

export async function createBridgeConfig(shopGroupId: number, payload: BridgeConfigPayload) {
  const response = await instance.post<ApiResponse<BridgeConfigRecord>>(
    `/barry/shop-groups/${shopGroupId}/bridge-configs`,
    payload,
  );
  return unwrapApiResponse(response.data);
}

export async function updateBridgeConfig(shopGroupId: number, bridgeConfigId: number, payload: BridgeConfigPayload) {
  const response = await instance.put<ApiResponse<BridgeConfigRecord>>(
    `/barry/shop-groups/${shopGroupId}/bridge-configs/${bridgeConfigId}`,
    payload,
  );
  return unwrapApiResponse(response.data);
}

export async function deleteBridgeConfig(shopGroupId: number, bridgeConfigId: number) {
  const response = await instance.delete<ApiResponse<{ deleted: boolean }>>(
    `/barry/shop-groups/${shopGroupId}/bridge-configs/${bridgeConfigId}`,
  );
  return unwrapApiResponse(response.data);
}

export async function activateBridgeConfig(shopGroupId: number, bridgeConfigId: number) {
  const response = await instance.put<ApiResponse<{ updated: boolean }>>(
    `/barry/shop-groups/${shopGroupId}/bridge-configs/${bridgeConfigId}/active`,
  );
  return unwrapApiResponse(response.data);
}

export async function disableBridgeConfig(shopGroupId: number, bridgeConfigId: number) {
  const response = await instance.put<ApiResponse<{ updated: boolean }>>(
    `/barry/shop-groups/${shopGroupId}/bridge-configs/${bridgeConfigId}/disable`,
  );
  return unwrapApiResponse(response.data);
}

export async function resetBridgeConfigStatistics(shopGroupId: number, bridgeConfigId: number) {
  const response = await instance.post<ApiResponse<{ reset: boolean }>>(
    `/barry/shop-groups/${shopGroupId}/bridge-configs/${bridgeConfigId}/reset-statistics`,
  );
  return unwrapApiResponse(response.data);
}

export async function fetchWhitelistGroups(shopGroupId: number) {
  return getDataList(WhitelistGroupRecord, `/barry/shop-groups/${shopGroupId}/whitelist-groups`);
}

export async function createWhitelistGroup(shopGroupId: number, payload: WhitelistGroupPayload) {
  const response = await instance.post<ApiResponse<WhitelistGroupRecord>>(
    `/barry/shop-groups/${shopGroupId}/whitelist-groups`,
    payload,
  );
  return unwrapApiResponse(response.data);
}

export async function updateWhitelistGroup(
  shopGroupId: number,
  whitelistGroupId: number,
  payload: WhitelistGroupPayload,
) {
  const response = await instance.put<ApiResponse<WhitelistGroupRecord>>(
    `/barry/shop-groups/${shopGroupId}/whitelist-groups/${whitelistGroupId}`,
    payload,
  );
  return unwrapApiResponse(response.data);
}

export async function deleteWhitelistGroup(shopGroupId: number, whitelistGroupId: number) {
  const response = await instance.delete<ApiResponse<{ deleted: boolean }>>(
    `/barry/shop-groups/${shopGroupId}/whitelist-groups/${whitelistGroupId}`,
  );
  return unwrapApiResponse(response.data);
}
