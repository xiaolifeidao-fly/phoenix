"use client";

import type { MessageInstance } from "antd/es/message/interface";

/**
 * 全站消息提示统一出口。
 *
 * 直接用 antd 的静态 message 有两个问题：拿不到 ConfigProvider 的主题
 * （控制台会警告 "Static function can not consume context"），以及短时间内
 * 重复文案会一条条堆叠。这里持有一个由 <NotifyProvider /> 注入的实例，
 * 并在其上做去重，业务侧调用方式保持 `message.error(...)` 不变。
 */

type MessageType = "success" | "error" | "warning" | "info" | "loading";

let instance: MessageInstance | null = null;

/** 相同文案在该窗口内只展示一次 */
const DEDUPE_WINDOW_MS = 1500;
const recentlyShown = new Map<string, number>();

export function registerMessageInstance(api: MessageInstance) {
  instance = api;
}

function contentKey(type: MessageType, content: unknown) {
  return `${type}:${typeof content === "string" ? content : JSON.stringify(content)}`;
}

function shouldSuppress(type: MessageType, content: unknown) {
  const key = contentKey(type, content);
  const now = Date.now();
  const lastShownAt = recentlyShown.get(key);

  if (lastShownAt !== undefined && now - lastShownAt < DEDUPE_WINDOW_MS) {
    return true;
  }

  recentlyShown.set(key, now);
  // 顺带清理过期项，避免长会话下 Map 无限增长
  recentlyShown.forEach((timestamp, mapKey) => {
    if (now - timestamp > DEDUPE_WINDOW_MS) {
      recentlyShown.delete(mapKey);
    }
  });
  return false;
}

function emit(type: MessageType, args: Parameters<MessageInstance[MessageType]>) {
  const [content] = args;

  if (shouldSuppress(type, content)) {
    return;
  }

  if (!instance) {
    // Provider 尚未挂载（例如模块顶层就触发了提示），降级到控制台而不是静默丢弃
    console.warn(`[notify] message instance not ready: ${String(content)}`);
    return;
  }

  return (instance[type] as (...rest: unknown[]) => unknown)(...args);
}

export const message = {
  success: (...args: Parameters<MessageInstance["success"]>) => emit("success", args),
  error: (...args: Parameters<MessageInstance["error"]>) => emit("error", args),
  warning: (...args: Parameters<MessageInstance["warning"]>) => emit("warning", args),
  info: (...args: Parameters<MessageInstance["info"]>) => emit("info", args),
  loading: (...args: Parameters<MessageInstance["loading"]>) => emit("loading", args),
  destroy: (key?: string | number) => instance?.destroy(key),
};
