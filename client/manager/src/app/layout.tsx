import type { Metadata } from "next";
import type { ReactNode } from "react";
import { AntdRegistry } from "@ant-design/nextjs-registry";
import { ChineseLocaleProvider } from "@/components/providers/ChineseLocaleProvider";
import { NotifyProvider } from "@/components/providers/NotifyProvider";
import "./globals.css";

export const metadata: Metadata = {
  title: "凤凰管理台",
  description: "基于 Next.js 与 Ant Design 构建的现代化管理后台演示。",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>
        <AntdRegistry>
          <ChineseLocaleProvider>
            <NotifyProvider>{children}</NotifyProvider>
          </ChineseLocaleProvider>
        </AntdRegistry>
      </body>
    </html>
  );
}
