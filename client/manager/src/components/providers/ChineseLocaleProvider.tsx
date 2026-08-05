"use client";

import type { ReactNode } from "react";
import { ConfigProvider } from "antd";
import zhCN from "antd/locale/zh_CN";
import dayjs from "dayjs";
import "dayjs/locale/zh-cn";
import { modernTheme } from "@/styles/theme";

dayjs.locale("zh-cn");

export function ChineseLocaleProvider({ children }: { children: ReactNode }) {
  return (
    <ConfigProvider theme={modernTheme} locale={zhCN}>
      {children}
    </ConfigProvider>
  );
}
