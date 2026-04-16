/**
 * [INPUT]: 用户导航到 /backtest 路由。
 * [OUTPUT]: (<div>) - 回测页面：Header + BacktestPanel（combined 模式）。
 * [POS]: 位于 /app/backtest，回测功能的独立页面入口。实际逻辑已提取至 BacktestPanel 组件。
 *
 * [PROTOCOL]:
 * 1. 一旦本文件逻辑变更，必须同步更新此 Header。
 * 2. 更新后必须上浮检查 /src/app/.folder.md 的描述是否依然准确。
 */
"use client";

import { BacktestPanel } from "@/components/BacktestPanel";

export default function BacktestPage() {
  return (
    <div className="min-h-screen p-6">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-zinc-100">信号回测</h1>
        <p className="text-sm text-zinc-500 mt-1">
          历史信号叠加 — 查看模型在每个关键时刻的判断
        </p>
      </div>
      <BacktestPanel model="combined" />
    </div>
  );
}
