"use client";

/**
 * 「查看所有账号余额」的排除用户偏好，只存在当前浏览器。
 * 做单用户页维护；人工记账的「真实结余」也按这份名单排除，两边看到的用户余额一致。
 */
const EXCLUDED_POINTS_USERS_STORAGE_KEY = "phoenix_manager_manual_user_excluded_points_users_v1";

export interface ExcludedPointsUser {
  userId: number;
  username: string;
}

export function readExcludedUsers(): ExcludedPointsUser[] {
  if (typeof window === "undefined") {
    return [];
  }
  try {
    const rawValue = window.localStorage.getItem(EXCLUDED_POINTS_USERS_STORAGE_KEY);
    if (!rawValue) {
      return [];
    }
    const parsed: unknown = JSON.parse(rawValue);
    if (!Array.isArray(parsed)) {
      window.localStorage.removeItem(EXCLUDED_POINTS_USERS_STORAGE_KEY);
      return [];
    }
    return parsed
      .map((item) => item as Partial<ExcludedPointsUser>)
      .filter((item): item is ExcludedPointsUser => Number.isSafeInteger(item?.userId) && Number(item?.userId) > 0)
      .map((item) => ({ userId: item.userId, username: String(item.username ?? item.userId) }));
  } catch {
    // 隐私模式、或存量数据格式变了：直接当作没有偏好
    return [];
  }
}

export function writeExcludedUsers(users: ExcludedPointsUser[]) {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage.setItem(EXCLUDED_POINTS_USERS_STORAGE_KEY, JSON.stringify(users));
  } catch {
    // 忽略隐私模式下的写入失败
  }
}
