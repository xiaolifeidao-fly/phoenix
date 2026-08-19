"use client";

import { getDataList, type PageResult } from "@/utils/axios";
import { fetchBarryAppUsers, type BarryAppUserRecord } from "./user.api";

export class OrderFetchMonitorRecord {
  userId = 0;

  hitNum = 0;

  missNum = 0;

  windowSeconds = 0;

  hitRemainingSeconds = 0;

  missRemainingSeconds = 0;

  hitElapsedSeconds = 0;

  missElapsedSeconds = 0;

  elapsedSeconds = 0;

  hitSpeed = 0;

  missSpeed = 0;

  hitRate = 0;
}

export interface ManualUserMonitorQuery {
  pageIndex?: number;
  pageSize?: number;
  userId?: string;
  username?: string;
  windowSeconds?: number;
}

export interface ManualUserMonitorItem extends BarryAppUserRecord {
  monitor: OrderFetchMonitorRecord;
}

export async function fetchManualUserMonitorPage(
  query: ManualUserMonitorQuery = {},
): Promise<PageResult<ManualUserMonitorItem>> {
  const page = await fetchBarryAppUsers({
    pageIndex: query.pageIndex ?? 1,
    pageSize: query.pageSize ?? 20,
    userId: query.userId?.trim() || undefined,
    username: query.username?.trim() || undefined,
  });
  const userIds = page.data.map((user) => user.userId).filter(Boolean);

  if (!userIds.length) {
    return { total: page.total, data: [] };
  }

  const monitorRecords = await getDataList(OrderFetchMonitorRecord, "/barry/order-fetch-monitor/users", {
    userIds: userIds.join(","),
    windowSeconds: query.windowSeconds,
  });
  const monitorByUserId = new Map(monitorRecords.map((record) => [String(record.userId), record]));

  return {
    total: page.total,
    data: page.data.map((user) => ({
      ...user,
      monitor: monitorByUserId.get(String(user.userId)) ?? new OrderFetchMonitorRecord(),
    })),
  };
}
