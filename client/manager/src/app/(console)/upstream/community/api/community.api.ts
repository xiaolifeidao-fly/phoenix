"use client";

import { getPage, instance, unwrapApiResponse, type ApiResponse } from "@/utils/axios";

/** 上游社区配置（kakrolot external_order_config），sync* 为上一个完整分钟的同步统计，无样本时为 null */
export class UpstreamCommunity {
  id = 0;
  channel = "";
  prefixUrl = "";
  prefixUrlAvailable: boolean | null = null;
  active = false;
  createBy = "";
  updateBy = "";
  createdAt: string | number | null = null;
  updatedAt: string | number | null = null;
  syncOk: number | null = null;
  syncFailNet: number | null = null;
  syncFailAuth: number | null = null;
  syncFailBiz: number | null = null;
  syncOkAvgMs: number | null = null;
  syncFailAvgMs: number | null = null;
  syncOkP95 = "";
  syncQueueDepth: number | null = null;
}

export interface UpstreamCommunityQuery extends Record<string, string | number | undefined> {
  pageIndex: number;
  pageSize: number;
  channel?: string;
  /** "true" | "false"，不传表示全部 */
  active?: string;
}

export function fetchUpstreamCommunities(query: UpstreamCommunityQuery) {
  return getPage(UpstreamCommunity, "/upstream/communities", query);
}

async function postAction(path: string, body?: unknown) {
  const response = await instance.post<ApiResponse<{ message: string }>>(path, body);
  return unwrapApiResponse(response.data);
}

export function updateUpstreamCommunityPrefixUrl(id: number, prefixUrl: string) {
  return postAction(`/upstream/communities/${id}/update`, { prefixUrl });
}

export function disableUpstreamCommunity(id: number) {
  return postAction(`/upstream/communities/${id}/disable`);
}

export function enableUpstreamCommunity(id: number) {
  return postAction(`/upstream/communities/${id}/enable`);
}
