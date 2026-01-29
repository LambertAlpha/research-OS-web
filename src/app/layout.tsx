/**
 * [INPUT]: (children: React.ReactNode) - 子页面组件，由 Next.js App Router 注入。
 * [OUTPUT]: (<html> Root Element) - 包含 Sidebar + Providers 的完整 HTML 页面骨架。
 * [POS]: 全局根布局，位于 /app 顶层，包裹所有页面组件。注入 Inter 字体、全局样式、侧边栏导航和 React Query Provider。
 *
 * [PROTOCOL]:
 * 1. 一旦本文件逻辑变更，必须同步更新此 Header。
 * 2. 更新后必须上浮检查 /src/app/.folder.md 的描述是否依然准确。
 */
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Sidebar } from "@/components/Sidebar";
import { Providers } from "@/components/providers";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Research OS",
  description: "宏观研究操作系统 - Macro Intelligence Platform",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className={inter.className}>
        <Providers>
          <div className="flex min-h-screen">
            <Sidebar />
            <main className="flex-1 ml-64">{children}</main>
          </div>
        </Providers>
      </body>
    </html>
  );
}
