"use client";

import { getDataList, instance, unwrapApiResponse, type ApiResponse } from "@/utils/axios";

export class ManualProductTypeRecord {
  id = 0;

  name = "";

  code = "";

  shopGroupId = 0;

  status = "";
}

export class ManualProductRecord {
  id = 0;

  name = "";

  code = "";

  score = 0;

  status = "";

  shopGroupId = 0;

  shopTypeModelList: ManualProductTypeRecord[] = [];

  createdTime?: string;

  updatedTime?: string;
}

export class AssignConfigRecord {
  id = 0;

  shopTypeId = 0;

  queueCode = "";

  strategyName = "";

  assignModel = "";

  assignType = "";

  queueSize = 0;

  assignScale = 0;

  expireTimes = 0;

  loopNum = 0;

  speedByHour = 0;

  assignNum = 0;

  batchAssignNum = 0;

  monitorOrder = false;

  checkNowNum = false;

  todayDistinct = false;
}

export class JudgeConfigRecord {
  id = 0;

  shopTypeId = 0;

  judgeType = "";

  againJudgeType = "";

  againJudgeFlag = false;

  againJudgeDelayTimes = 0;

  assignConfigId = 0;
}

export interface ManualProductListQuery {
  pageIndex?: number;
  pageSize?: number;
  code?: string;
  name?: string;
  status?: string;
  shopGroupId?: number;
  shopTypeCode?: string;
}

export interface ManualProductPayload {
  shopGroupId: number;
  name: string;
  code: string;
  score: number;
  status?: string;
  shopTypeCodeList?: string[];
}

export interface AssignConfigPayload {
  id?: number;
  shopTypeId: number;
  queueCode: string;
  strategyName: string;
  assignModel: string;
  assignType?: string;
  queueSize: number;
  assignScale: number;
  expireTimes: number;
  loopNum: number;
  speedByHour?: number;
  assignNum?: number;
  batchAssignNum?: number;
  monitorOrder?: boolean;
  checkNowNum?: boolean;
  todayDistinct?: boolean;
}

export interface JudgeConfigPayload {
  id?: number;
  shopTypeId: number;
  judgeType: string;
  againJudgeType?: string;
  againJudgeFlag: boolean;
  againJudgeDelayTimes?: number;
  assignConfigId: number;
}

export async function fetchManualProductTypes() {
  return getDataList(ManualProductTypeRecord, "/barry/product-types", {
    pageIndex: 1,
    pageSize: 500,
  });
}

export async function fetchManualProducts(query?: ManualProductListQuery) {
  return getDataList(ManualProductRecord, "/barry/product-categories", {
    pageIndex: 1,
    pageSize: 500,
    ...query,
  } as Record<string, string | number | undefined>);
}

export async function createManualProduct(payload: ManualProductPayload) {
  const response = await instance.post<ApiResponse<ManualProductRecord | null>>("/barry/product-categories", payload);
  return unwrapApiResponse(response.data);
}

export async function updateManualProduct(id: number, payload: ManualProductPayload) {
  const response = await instance.put<ApiResponse<ManualProductRecord | null>>(`/barry/product-categories/${id}`, payload);
  return unwrapApiResponse(response.data);
}

export async function deleteManualProduct(id: number) {
  const response = await instance.delete<ApiResponse<ManualProductRecord | null>>(`/barry/product-categories/${id}`);
  return unwrapApiResponse(response.data);
}

export async function expireManualProduct(id: number) {
  const response = await instance.put<ApiResponse<ManualProductRecord | null>>(`/barry/product-categories/${id}/expire`);
  return unwrapApiResponse(response.data);
}

export async function activateManualProduct(id: number) {
  const response = await instance.put<ApiResponse<ManualProductRecord | null>>(`/barry/product-categories/${id}/active`);
  return unwrapApiResponse(response.data);
}

export class VideoUserRuleRecord {
  id = 0;

  shopCategoryId = 0;

  userId = 0;

  username = "";

  urlFilterEnabled = false;

  urlKeywords = "";

  urlIncludeEnabled = false;

  urlIncludeKeywords = "";

  adFilterEnabled = false;
}

export class AssignUidRuleRecord {
  id = 0;

  shopCategoryId = 0;

  enabled = false;

  minFansNum = 0;

  minItemNum = 0;

  minInteractRate?: number;
}

export class AssignVideoRuleRecord {
  id = 0;

  shopCategoryId = 0;

  enabled = false;

  urlFilterEnabled = false;

  urlKeywords = "";

  urlIncludeEnabled = false;

  urlIncludeKeywords = "";

  adFilterEnabled = false;
}

export class AssignRefundRuleRecord {
  id = 0;

  shopCategoryId = 0;

  enabled = false;

  refundRoundThreshold = 0;

  exceptionRoundThreshold = 0;
}

export class AssignSwitchRecord {
  enabled = false;
}

export interface AssignUidRulePayload {
  id?: number;
  shopCategoryId: number;
  enabled: boolean;
  minFansNum: number;
  minItemNum: number;
  minInteractRate?: number;
}

export interface AssignVideoRulePayload {
  id?: number;
  shopCategoryId: number;
  enabled: boolean;
  urlFilterEnabled: boolean;
  urlKeywords?: string;
  urlIncludeEnabled: boolean;
  urlIncludeKeywords?: string;
  adFilterEnabled: boolean;
}

export interface VideoUserRulePayload {
  id?: number;
  shopCategoryId: number;
  userId: number;
  urlFilterEnabled: boolean;
  urlKeywords?: string;
  urlIncludeEnabled: boolean;
  urlIncludeKeywords?: string;
  adFilterEnabled: boolean;
}

export interface AssignRefundRulePayload {
  id?: number;
  shopCategoryId: number;
  enabled: boolean;
  refundRoundThreshold: number;
  exceptionRoundThreshold: number;
}

export interface AssignSwitchPayload {
  shopCategoryId: number;
  enabled: boolean;
}

export async function fetchAssignConfigsByShopTypeId(shopTypeId: number) {
  return getDataList(AssignConfigRecord, "/barry/assign-configs", { shopTypeId });
}

export async function fetchJudgeConfigsByShopTypeId(shopTypeId: number) {
  return getDataList(JudgeConfigRecord, "/barry/judge-configs", { shopTypeId });
}

export async function fetchAssignUidRule(shopCategoryId: number) {
  const response = await instance.get<ApiResponse<AssignUidRuleRecord | null>>(
    "/barry/assign-uid-rules",
    { params: { shopCategoryId } },
  );
  return unwrapApiResponse(response.data);
}

export async function saveAssignUidRule(payload: AssignUidRulePayload) {
  const response = await instance.post<ApiResponse<AssignUidRuleRecord | null>>(
    "/barry/assign-uid-rules",
    payload,
  );
  return unwrapApiResponse(response.data);
}

export async function fetchAssignVideoRule(shopCategoryId: number) {
  const response = await instance.get<ApiResponse<AssignVideoRuleRecord | null>>(
    "/barry/assign-video-rules",
    { params: { shopCategoryId } },
  );
  return unwrapApiResponse(response.data);
}

export async function saveAssignVideoRule(payload: AssignVideoRulePayload) {
  const response = await instance.post<ApiResponse<AssignVideoRuleRecord | null>>(
    "/barry/assign-video-rules",
    payload,
  );
  return unwrapApiResponse(response.data);
}

export async function fetchAssignRefundRule(shopCategoryId: number) {
  const response = await instance.get<ApiResponse<AssignRefundRuleRecord | null>>(
    "/barry/assign-refund-rules",
    { params: { shopCategoryId } },
  );
  return unwrapApiResponse(response.data);
}

export async function saveAssignRefundRule(payload: AssignRefundRulePayload) {
  const response = await instance.post<ApiResponse<AssignRefundRuleRecord | null>>(
    "/barry/assign-refund-rules",
    payload,
  );
  return unwrapApiResponse(response.data);
}

export async function fetchAssignWhitelistSwitch(shopCategoryId: number) {
  const response = await instance.get<ApiResponse<AssignSwitchRecord | null>>(
    "/barry/assign-whitelist-switch",
    { params: { shopCategoryId } },
  );
  const data = unwrapApiResponse(response.data);
  return Boolean(data?.enabled);
}

export async function saveAssignWhitelistSwitch(payload: AssignSwitchPayload) {
  const response = await instance.post<ApiResponse<unknown>>(
    "/barry/assign-whitelist-switch",
    payload,
  );
  return unwrapApiResponse(response.data);
}

export async function fetchAssignUidSwitch(shopCategoryId: number) {
  const response = await instance.get<ApiResponse<AssignSwitchRecord | null>>(
    "/barry/assign-uid-switch",
    { params: { shopCategoryId } },
  );
  const data = unwrapApiResponse(response.data);
  return Boolean(data?.enabled);
}

export async function saveAssignUidSwitch(payload: AssignSwitchPayload) {
  const response = await instance.post<ApiResponse<unknown>>(
    "/barry/assign-uid-switch",
    payload,
  );
  return unwrapApiResponse(response.data);
}

export async function fetchVideoUserRules(shopCategoryId: number) {
  return getDataList(VideoUserRuleRecord, "/barry/assign-video-user-rules", { shopCategoryId });
}

export async function saveVideoUserRule(payload: VideoUserRulePayload) {
  const response = await instance.post<ApiResponse<VideoUserRuleRecord | null>>(
    "/barry/assign-video-user-rules",
    payload,
  );
  return unwrapApiResponse(response.data);
}

export async function deleteVideoUserRule(shopCategoryId: number, userId: number) {
  const response = await instance.delete<ApiResponse<VideoUserRuleRecord | null>>(
    "/barry/assign-video-user-rules",
    { params: { shopCategoryId, userId } },
  );
  return unwrapApiResponse(response.data);
}

export async function saveAssignConfig(payload: AssignConfigPayload) {
  const response = await instance.post<ApiResponse<AssignConfigRecord | null>>("/barry/assign-configs", payload);
  return unwrapApiResponse(response.data);
}

export async function saveJudgeConfig(payload: JudgeConfigPayload) {
  const response = await instance.post<ApiResponse<JudgeConfigRecord | null>>("/barry/judge-configs", payload);
  return unwrapApiResponse(response.data);
}
