"use client";

import { useState, useCallback } from "react";
import { Header } from "@/components/Header";
import { MetricCard } from "@/components/MetricCard";
import { Chart } from "@/components/Chart";
import apiClient from "@/lib/api";
import { getRiskLightColor, getRiskLightLabel, formatNumber } from "@/lib/utils";
import type { ModelOutput, RawDataPoint } from "@/types/api";
import { Droplets, AlertTriangle, BarChart3 } from "lucide-react";

export default function LiquidityPage() {
  const [isRunning, setIsRunning] = useState(false);
  const [modelOutput, setModelOutput] = useState<ModelOutput | null>(null);
  const [marketData, setMarketData] = useState<Record<string, RawDataPoint[]>>({});

  const handleRunModel = useCallback(async (date?: string) => {
    setIsRunning(true);
    try {
      const output = await apiClient.runModel(date);
      setModelOutput(output);

      // 获取流动性相关数据
      const symbols = ["WALCL", "SOFR", "IORB", "WRESBAL"];
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

  const riskLightColor = modelOutput
    ? getRiskLightColor(modelOutput.risk_light)
    : "#52525b";
  const riskLightLabel = modelOutput
    ? getRiskLightLabel(modelOutput.risk_light)
    : "未运行";
  const riskLightEmoji =
    modelOutput?.risk_light === "green"
      ? "🟢"
      : modelOutput?.risk_light === "yellow"
      ? "🟡"
      : modelOutput?.risk_light === "red"
      ? "🔴"
      : "⚪";

  const scoreColor =
    (modelOutput?.liquidity_score ?? 0) >= 70
      ? "#10b981"
      : (modelOutput?.liquidity_score ?? 0) >= 40
      ? "#f59e0b"
      : "#ef4444";

  // 计算 SOFR-IORB 利差
  const sofrData = marketData.SOFR;
  const iorbData = marketData.IORB;
  const sofrIorbSpread =
    sofrData && iorbData && sofrData.length > 0 && iorbData.length > 0
      ? sofrData
          .map((sofr, i) => {
            const iorb = iorbData[i];
            if (!iorb) return null;
            return {
              ts: sofr.ts,
              value: (sofr.value - iorb.value) * 100, // bp
            };
          })
          .filter((v): v is RawDataPoint => v !== null)
      : [];

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
            <div className="p-2 rounded-lg bg-blue-500/10">
              <Droplets className="w-5 h-5 text-blue-400" />
            </div>
            <h1 className="text-2xl font-bold text-zinc-100">流动性模型</h1>
          </div>
          <p className="text-zinc-500 text-sm ml-12">
            美元流动性监测与风险评估
          </p>
        </div>

        {!modelOutput ? (
          <div className="flex flex-col items-center justify-center py-24">
            <div className="relative mb-6">
              <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-blue-500/20 to-cyan-600/20 flex items-center justify-center border border-blue-500/20">
                <Droplets className="w-12 h-12 text-blue-400 animate-float" />
              </div>
              <div className="absolute inset-0 rounded-2xl bg-blue-500/10 blur-xl" />
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
            {/* 核心指标卡片 */}
            <div className="grid grid-cols-3 gap-6 mb-8">
              {/* 风险灯号 */}
              <div className="group relative rounded-2xl p-6 overflow-hidden transition-all duration-500 bg-gradient-to-br from-zinc-900/80 to-zinc-950/80 border border-zinc-800/50 hover:border-cyan-500/30 backdrop-blur-xl text-center">
                <div
                  className="absolute top-0 left-0 right-0 h-0.5 opacity-60"
                  style={{
                    background: `linear-gradient(90deg, transparent, ${riskLightColor}, transparent)`,
                  }}
                />
                <div className="text-6xl mb-4">{riskLightEmoji}</div>
                <div className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                  风险灯号
                </div>
                <div
                  className="text-xl font-semibold mt-2"
                  style={{ color: riskLightColor, textShadow: `0 0 20px ${riskLightColor}40` }}
                >
                  {riskLightLabel}
                </div>
              </div>

              {/* 流动性评分 */}
              <div className="group relative rounded-2xl p-6 overflow-hidden transition-all duration-500 bg-gradient-to-br from-zinc-900/80 to-zinc-950/80 border border-zinc-800/50 hover:border-cyan-500/30 backdrop-blur-xl text-center">
                <div
                  className="absolute top-0 left-0 right-0 h-0.5 opacity-60"
                  style={{
                    background: `linear-gradient(90deg, transparent, ${scoreColor}, transparent)`,
                  }}
                />
                <div
                  className="text-4xl font-bold"
                  style={{ color: scoreColor, textShadow: `0 0 30px ${scoreColor}60` }}
                >
                  {formatNumber(modelOutput.liquidity_score)}
                  <span className="text-lg text-zinc-500">/100</span>
                </div>
                <div className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mt-2">
                  流动性评分
                </div>
                {/* 进度条 */}
                <div className="mt-4 bg-zinc-800 rounded-full h-1.5 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{
                      width: `${modelOutput.liquidity_score}%`,
                      backgroundColor: scoreColor,
                      boxShadow: `0 0 10px ${scoreColor}`,
                    }}
                  />
                </div>
              </div>

              {/* 建议杠杆 */}
              <div className="group relative rounded-2xl p-6 overflow-hidden transition-all duration-500 bg-gradient-to-br from-zinc-900/80 to-zinc-950/80 border border-zinc-800/50 hover:border-cyan-500/30 backdrop-blur-xl text-center">
                <div className="absolute top-0 left-0 right-0 h-0.5 opacity-60 bg-gradient-to-r from-transparent via-cyan-500 to-transparent" />
                <div
                  className="text-4xl font-bold text-cyan-400"
                  style={{ textShadow: "0 0 30px rgba(6, 182, 212, 0.6)" }}
                >
                  {formatNumber(modelOutput.leverage_coef, 1)}
                  <span className="text-xl text-zinc-500">x</span>
                </div>
                <div className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mt-2">
                  建议杠杆
                </div>
                <div className="text-zinc-400 text-sm mt-3">
                  {modelOutput.leverage_coef <= 0.5
                    ? "🛡️ 保守配置"
                    : modelOutput.leverage_coef <= 0.8
                    ? "⚖️ 适度杠杆"
                    : "⚡ 激进操作"}
                </div>
              </div>
            </div>

            <div className="divider" />

            {/* 禁止策略 */}
            {modelOutput.forbidden_strategies.length > 0 && (
              <div className="mb-8">
                <div className="relative rounded-xl p-4 overflow-hidden bg-red-500/10 border border-red-500/30 backdrop-blur-xl">
                  <div className="absolute top-0 left-0 right-0 h-0.5 opacity-50 bg-gradient-to-r from-transparent via-red-500 to-transparent" />
                  <div className="text-red-400 font-semibold flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4" />
                    禁止策略
                  </div>
                  <div className="text-red-300 mt-2 text-sm">
                    {modelOutput.forbidden_strategies.join(", ")}
                  </div>
                </div>
              </div>
            )}

            {/* 流动性指标图表 */}
            <div className="mb-8">
              <h2 className="section-title">
                <BarChart3 className="w-5 h-5 text-cyan-400" />
                流动性指标
              </h2>
              <div className="grid grid-cols-2 gap-4">
                {marketData.WALCL && marketData.WALCL.length > 0 && (
                  <Chart
                    data={marketData.WALCL.map((p) => ({
                      ...p,
                      value: p.value / 1e6, // 转换为万亿
                    }))}
                    title="Fed 资产负债表 (万亿美元)"
                    color="#a855f7"
                  />
                )}
                {sofrIorbSpread.length > 0 && (
                  <Chart
                    data={sofrIorbSpread}
                    title="SOFR-IORB 利差 (bp)"
                    color="#10b981"
                    showArea={false}
                    referenceLines={[{ y: 5, color: "#ef4444", label: "红灯阈值" }]}
                  />
                )}
                {marketData.WRESBAL && marketData.WRESBAL.length > 0 && (
                  <Chart
                    data={marketData.WRESBAL.map((p) => ({
                      ...p,
                      value: p.value / 1e6, // 转换为万亿
                    }))}
                    title="银行准备金 (万亿美元)"
                    color="#06b6d4"
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
