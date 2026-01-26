"use client";

import { useState, useCallback } from "react";
import { Header } from "@/components/Header";
import { MetricCard } from "@/components/MetricCard";
import { GateCard } from "@/components/GateCard";
import { Chart } from "@/components/Chart";
import apiClient from "@/lib/api";
import {
  getRiskLightColor,
  getRiskLightLabel,
  formatNumber,
} from "@/lib/utils";
import type { ModelOutput, RawDataPoint } from "@/types/api";
import { Rocket, AlertTriangle, TrendingUp, BarChart3 } from "lucide-react";

export default function OverviewPage() {
  const [isRunning, setIsRunning] = useState(false);
  const [modelOutput, setModelOutput] = useState<ModelOutput | null>(null);
  const [marketData, setMarketData] = useState<Record<string, RawDataPoint[]>>(
    {}
  );

  const handleRunModel = useCallback(async (date?: string) => {
    setIsRunning(true);
    try {
      const output = await apiClient.runModel(date);
      setModelOutput(output);

      // 获取市场数据
      const symbols = ["SPX", "MOVE", "DXY", "HY_OAS"];
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

  const leverageLabel =
    (modelOutput?.leverage_coef ?? 0) <= 0.5
      ? "保守"
      : (modelOutput?.leverage_coef ?? 0) <= 0.8
      ? "适度"
      : "激进";

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
            <div className="p-2 rounded-lg bg-cyan-500/10">
              <BarChart3 className="w-5 h-5 text-cyan-400" />
            </div>
            <h1 className="text-2xl font-bold text-zinc-100">市场概览</h1>
          </div>
          {modelOutput?.data_ts && (
            <p className="text-zinc-500 text-sm ml-12">
              数据日期:{" "}
              <span className="text-zinc-400">
                {new Date(modelOutput.data_ts).toLocaleDateString("zh-CN")}
              </span>
            </p>
          )}
        </div>

        {!modelOutput ? (
          <div className="flex flex-col items-center justify-center py-24">
            <div className="relative mb-6">
              <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-blue-600/20 flex items-center justify-center border border-cyan-500/20">
                <Rocket className="w-12 h-12 text-cyan-400 animate-float" />
              </div>
              <div className="absolute inset-0 rounded-2xl bg-cyan-500/10 blur-xl" />
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
            <div className="grid grid-cols-4 gap-4 mb-8">
              <MetricCard
                label="风险灯号"
                value={riskLightEmoji}
                sublabel={riskLightLabel}
                color={riskLightColor}
              />
              <MetricCard
                label="流动性评分"
                value={formatNumber(modelOutput.liquidity_score)}
                sublabel="满分 100"
                color={scoreColor}
              />
              <MetricCard
                label="杠杆系数"
                value={`${formatNumber(modelOutput.leverage_coef, 1)}x`}
                sublabel={leverageLabel}
                color="#06b6d4"
              />
              <MetricCard
                label="执行时间"
                value={`${modelOutput.execution_time_ms}ms`}
                sublabel={modelOutput.status}
                color="#a855f7"
              />
            </div>

            {/* 分隔线 */}
            <div className="divider" />

            {/* 模型报告 */}
            <div className="mb-8">
              <h2 className="section-title">
                <TrendingUp className="w-5 h-5 text-cyan-400" />
                模型报告
              </h2>
              <div className="relative rounded-2xl p-6 overflow-hidden bg-gradient-to-br from-zinc-900/80 to-zinc-950/80 border border-zinc-800/50 backdrop-blur-xl">
                <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-cyan-500/50 to-transparent opacity-50" />
                <pre className="font-mono text-sm text-zinc-300 whitespace-pre-wrap leading-relaxed">
                  {modelOutput.report_summary}
                </pre>
              </div>
            </div>

            {/* 分隔线 */}
            <div className="divider" />

            {/* 闸门状态 */}
            {modelOutput.gates.length > 0 && (
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
            )}

            {/* 分隔线 */}
            <div className="divider" />

            {/* 市场数据图表 */}
            <div className="mb-8">
              <h2 className="section-title">
                <BarChart3 className="w-5 h-5 text-cyan-400" />
                市场行情
              </h2>
              <div className="grid grid-cols-2 gap-4">
                {marketData.SPX && marketData.SPX.length > 0 && (
                  <Chart
                    data={marketData.SPX}
                    title="S&P 500"
                    color="#06b6d4"
                  />
                )}
                {marketData.MOVE && marketData.MOVE.length > 0 && (
                  <Chart
                    data={marketData.MOVE}
                    title="MOVE Index"
                    color="#f59e0b"
                    showArea={false}
                    referenceLines={[
                      { y: 100, color: "#f59e0b", label: "关注" },
                      { y: 120, color: "#ef4444", label: "关闸" },
                    ]}
                  />
                )}
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
                    color="#a855f7"
                    showArea={false}
                    referenceLines={[
                      { y: 400, color: "#f59e0b", label: "关注" },
                      { y: 500, color: "#ef4444", label: "警告" },
                    ]}
                  />
                )}
              </div>
            </div>

            {/* 告警 */}
            {modelOutput.alerts.length > 0 && (
              <div className="mb-8">
                <h2 className="section-title">
                  <AlertTriangle className="w-5 h-5 text-amber-400" />
                  告警信息
                </h2>
                <div className="space-y-3">
                  {modelOutput.alerts.map((alert, i) => (
                    <div
                      key={i}
                      className={`relative rounded-xl p-4 overflow-hidden backdrop-blur-xl ${
                        alert.level === "CRITICAL"
                          ? "bg-red-500/10 border border-red-500/30"
                          : "bg-amber-500/10 border border-amber-500/30"
                      }`}
                    >
                      {/* 顶部渐变线 */}
                      <div
                        className={`absolute top-0 left-0 right-0 h-0.5 opacity-50 ${
                          alert.level === "CRITICAL"
                            ? "bg-gradient-to-r from-transparent via-red-500 to-transparent"
                            : "bg-gradient-to-r from-transparent via-amber-500 to-transparent"
                        }`}
                      />

                      <div
                        className={`font-semibold text-sm flex items-center gap-2 ${
                          alert.level === "CRITICAL"
                            ? "text-red-400"
                            : "text-amber-400"
                        }`}
                      >
                        <span
                          className={`w-2 h-2 rounded-full animate-pulse ${
                            alert.level === "CRITICAL"
                              ? "bg-red-500"
                              : "bg-amber-500"
                          }`}
                        />
                        [{alert.type}]
                      </div>
                      <div className="text-zinc-300 text-sm mt-2">
                        {alert.message}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
