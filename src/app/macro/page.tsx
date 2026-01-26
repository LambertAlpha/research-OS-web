"use client";

import { useState, useCallback } from "react";
import { Header } from "@/components/Header";
import { GateCard } from "@/components/GateCard";
import { Chart } from "@/components/Chart";
import apiClient from "@/lib/api";
import { cn } from "@/lib/utils";
import type { ModelOutput, RawDataPoint } from "@/types/api";
import { Globe, BarChart3, Target, TrendingUp, Shield, LineChart } from "lucide-react";

export default function MacroPage() {
  const [isRunning, setIsRunning] = useState(false);
  const [modelOutput, setModelOutput] = useState<ModelOutput | null>(null);
  const [marketData, setMarketData] = useState<Record<string, RawDataPoint[]>>({});

  const handleRunModel = useCallback(async (date?: string) => {
    setIsRunning(true);
    try {
      const output = await apiClient.runModel(date);
      setModelOutput(output);

      // 获取宏观相关数据
      const symbols = ["DXY", "HY_OAS", "IG_OAS", "VIX"];
      const dataPromises = symbols.map(async (symbol) => {
        try {
          const data = await apiClient.getMarketData(symbol);
          return { symbol, data: data.data };
        } catch {
          return { symbol, data: [] };
        }
      });

      const results = await Promise.all(dataPromises);
      const newMarketData: Record<string, RawDataPoint[]> = {};
      results.forEach(({ symbol, data }) => {
        newMarketData[symbol] = data;
      });
      setMarketData(newMarketData);
    } catch (error) {
      console.error("Failed to run model:", error);
    } finally {
      setIsRunning(false);
    }
  }, []);

  const exec = modelOutput?.execution_matrix;

  return (
    <div className="min-h-screen">
      <Header
        onRunModel={handleRunModel}
        isLoading={isRunning}
        lastUpdate={modelOutput?.run_ts}
      />

      <div className="p-6">
        {/* 页面标题 */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-1">
            <div className="p-2 rounded-lg bg-purple-500/10">
              <Globe className="w-5 h-5 text-purple-400" />
            </div>
            <h1 className="text-2xl font-bold text-zinc-100">宏观模型</h1>
          </div>
          <p className="text-zinc-500 text-sm ml-12">
            多维度市场信号分析与执行建议
          </p>
        </div>

        {!modelOutput ? (
          <div className="flex flex-col items-center justify-center py-24">
            <div className="relative mb-6">
              <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-purple-500/20 to-pink-600/20 flex items-center justify-center border border-purple-500/20">
                <Globe className="w-12 h-12 text-purple-400 animate-float" />
              </div>
              <div className="absolute inset-0 rounded-2xl bg-purple-500/10 blur-xl" />
            </div>
            <h2 className="text-xl font-semibold text-zinc-200 mb-2">
              准备就绪
            </h2>
            <p className="text-zinc-500 text-sm">
              点击「运行模型」按钮开始分析
            </p>
          </div>
        ) : (
          <>
            {/* 闸门状态 */}
            <div className="mb-8">
              <h2 className="section-title">
                <span className="text-lg">🚦</span>
                闸门矩阵
              </h2>
              <div className="grid grid-cols-5 gap-4">
                {modelOutput.gates.map((gate) => (
                  <GateCard key={gate.name} gate={gate} />
                ))}
              </div>
            </div>

            <div className="divider" />

            {/* 执行矩阵 */}
            {exec && (
              <div className="mb-8">
                <h2 className="section-title">
                  <Target className="w-5 h-5 text-cyan-400" />
                  执行矩阵
                </h2>
                <div className="grid grid-cols-2 gap-4">
                  {/* 利率表达 */}
                  <div className="group relative rounded-2xl p-5 overflow-hidden transition-all duration-500 bg-gradient-to-br from-zinc-900/80 to-zinc-950/80 border border-zinc-800/50 hover:border-cyan-500/30 backdrop-blur-xl">
                    <div className="absolute top-0 left-0 right-0 h-0.5 opacity-50 bg-gradient-to-r from-transparent via-cyan-500 to-transparent" />
                    <div className="flex items-center gap-2 mb-3">
                      <Target className="w-4 h-4 text-cyan-400" />
                      <span className="text-xs text-zinc-500 font-semibold uppercase tracking-wider">
                        利率表达
                      </span>
                    </div>
                    <div className="text-lg text-zinc-200 font-medium mb-2">
                      {exec.rates_action}
                    </div>
                    <div className="text-sm text-zinc-400">
                      工具: {exec.rates_instruments.join(", ") || "N/A"}
                    </div>
                    <div className="text-sm text-zinc-400 mt-1 flex items-center gap-2">
                      置信度:{" "}
                      <span
                        className={cn(
                          "badge",
                          exec.rates_confidence === "HIGH"
                            ? "badge-success"
                            : "badge-warning"
                        )}
                      >
                        {exec.rates_confidence}
                      </span>
                    </div>
                  </div>

                  {/* 股票板块 */}
                  <div className="group relative rounded-2xl p-5 overflow-hidden transition-all duration-500 bg-gradient-to-br from-zinc-900/80 to-zinc-950/80 border border-zinc-800/50 hover:border-purple-500/30 backdrop-blur-xl">
                    <div className="absolute top-0 left-0 right-0 h-0.5 opacity-50 bg-gradient-to-r from-transparent via-purple-500 to-transparent" />
                    <div className="flex items-center gap-2 mb-3">
                      <TrendingUp className="w-4 h-4 text-purple-400" />
                      <span className="text-xs text-zinc-500 font-semibold uppercase tracking-wider">
                        股票板块
                      </span>
                    </div>
                    <div className="text-lg text-zinc-200 font-medium mb-2">
                      {exec.equity_sector_bias}
                    </div>
                    <div className="text-sm text-zinc-400">
                      推荐板块: {exec.equity_sectors.join(", ") || "N/A"}
                    </div>
                  </div>

                  {/* 对冲要求 */}
                  <div className="group relative rounded-2xl p-5 overflow-hidden transition-all duration-500 bg-gradient-to-br from-zinc-900/80 to-zinc-950/80 border border-zinc-800/50 hover:border-amber-500/30 backdrop-blur-xl">
                    <div className="absolute top-0 left-0 right-0 h-0.5 opacity-50 bg-gradient-to-r from-transparent via-amber-500 to-transparent" />
                    <div className="flex items-center gap-2 mb-3">
                      <Shield className="w-4 h-4 text-amber-400" />
                      <span className="text-xs text-zinc-500 font-semibold uppercase tracking-wider">
                        对冲要求
                      </span>
                    </div>
                    <div className="mb-2">
                      <span
                        className={cn(
                          "badge",
                          exec.hedge_required ? "badge-warning" : "badge-success"
                        )}
                      >
                        {exec.hedge_required ? "需要对冲" : "无需对冲"}
                      </span>
                    </div>
                    {exec.hedge_required && (
                      <>
                        <div className="text-sm text-zinc-400">
                          类型: {exec.hedge_type || "N/A"}
                        </div>
                        <div className="text-sm text-zinc-400 mt-1">
                          工具: {exec.hedge_instruments.join(", ") || "N/A"}
                        </div>
                      </>
                    )}
                  </div>

                  {/* 卖波动许可 */}
                  <div className="group relative rounded-2xl p-5 overflow-hidden transition-all duration-500 bg-gradient-to-br from-zinc-900/80 to-zinc-950/80 border border-zinc-800/50 hover:border-pink-500/30 backdrop-blur-xl">
                    <div className="absolute top-0 left-0 right-0 h-0.5 opacity-50 bg-gradient-to-r from-transparent via-pink-500 to-transparent" />
                    <div className="flex items-center gap-2 mb-3">
                      <LineChart className="w-4 h-4 text-pink-400" />
                      <span className="text-xs text-zinc-500 font-semibold uppercase tracking-wider">
                        卖波动许可
                      </span>
                    </div>
                    <div className="mb-2">
                      <span
                        className={cn(
                          "badge",
                          exec.short_vol_allowed ? "badge-success" : "badge-danger"
                        )}
                      >
                        {exec.short_vol_allowed ? "允许" : "禁止"}
                      </span>
                    </div>
                    <div className="text-sm text-zinc-400">
                      {exec.short_vol_constraints || "无约束"}
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="divider" />

            {/* 市场指标图表 */}
            <div className="mb-8">
              <h2 className="section-title">
                <BarChart3 className="w-5 h-5 text-cyan-400" />
                市场指标
              </h2>
              <div className="grid grid-cols-2 gap-4">
                {marketData.DXY && marketData.DXY.length > 0 && (
                  <Chart
                    data={marketData.DXY}
                    title="美元指数 (DXY)"
                    color="#10b981"
                  />
                )}
                {marketData.HY_OAS && marketData.HY_OAS.length > 0 && (
                  <Chart
                    data={marketData.HY_OAS}
                    title="高收益债 OAS (bp)"
                    color="#f97316"
                    showArea={false}
                    referenceLines={[
                      { y: 400, color: "#f59e0b", label: "关注" },
                      { y: 500, color: "#ef4444", label: "警告" },
                    ]}
                  />
                )}
                {marketData.IG_OAS && marketData.IG_OAS.length > 0 && (
                  <Chart
                    data={marketData.IG_OAS}
                    title="投资级债 OAS (bp)"
                    color="#06b6d4"
                    showArea={false}
                  />
                )}
                {marketData.VIX && marketData.VIX.length > 0 && (
                  <Chart
                    data={marketData.VIX}
                    title="VIX 恐慌指数"
                    color="#ec4899"
                    showArea={false}
                    referenceLines={[
                      { y: 20, color: "#f59e0b", label: "关注" },
                      { y: 30, color: "#ef4444", label: "恐慌" },
                    ]}
                  />
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
