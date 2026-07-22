"use client";

import { App, message as staticMessage } from "antd";
import { useEffect } from "react";
import type { ReactNode } from "react";
import { registerMessageInstance } from "@/utils/notify";

/** 同时最多堆叠 3 条，超出自动顶掉最旧的 */
staticMessage.config({ maxCount: 3, top: 72, duration: 3 });

function MessageBridge({ children }: { children: ReactNode }) {
  const { message } = App.useApp();

  useEffect(() => {
    registerMessageInstance(message);
  }, [message]);

  return <>{children}</>;
}

/**
 * 提供 antd App 上下文，让消息/弹窗能读到 ConfigProvider 的主题，
 * 并把 message 实例交给 utils/notify 供全站复用。
 */
export function NotifyProvider({ children }: { children: ReactNode }) {
  return (
    <App
      message={{ maxCount: 3, top: 72, duration: 3 }}
      notification={{ placement: "topRight" }}
    >
      <MessageBridge>{children}</MessageBridge>
    </App>
  );
}
