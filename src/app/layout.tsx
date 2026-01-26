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
