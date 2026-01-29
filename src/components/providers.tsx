/**
 * [INPUT]: (children: React.ReactNode) - 被包裹的子组件树。
 * [OUTPUT]: (<QueryClientProvider>) - 注入 React Query 客户端的 Provider 包装器。
 * [POS]: 位于 /components，被 layout.tsx 引用。配置全局 staleTime=60s、refetchOnWindowFocus=false。
 *
 * [PROTOCOL]:
 * 1. 一旦本文件逻辑变更，必须同步更新此 Header。
 * 2. 更新后必须上浮检查 /src/components/.folder.md 的描述是否依然准确。
 */
"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000, // 1 minute
            refetchOnWindowFocus: false,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}
