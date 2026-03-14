/**
 * [INPUT]: 页面加载时自动获取最新模型输出，用户可点击"运行模型"刷新。可选 date 参数。
 * [OUTPUT]: (JSX) - 市场概览仪表板，含风险灯号、流动性评分、杠杆系数、模型报告、闸门矩阵、市场行情图表、告警信息。
 * [POS]: 首页路由 (/)，位于 /app 根路径。聚合 liquidity + macro 数据的全局概览视图，是用户进入系统的第一个触点。
 *
 * [PROTOCOL]:
 * 1. 一旦本文件逻辑变更，必须同步更新此 Header。
 * 2. 更新后必须上浮检查 /src/app/.folder.md 的描述是否依然准确。
 */
"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { Header } from "@/components/Header";
import { MetricCard } from "@/components/MetricCard";
import { GateCard } from "@/components/GateCard";
import { Chart } from "@/components/Chart";
import apiClient from "@/lib/api";
import {
  getRiskLightColor,
  getRiskLightLabel,
  formatNumber,
  formatDate,
} from "@/lib/utils";
import type { ModelOutput, RawDataPoint, HistoryRecord } from "@/types/api";
import { Rocket, AlertTriangle, TrendingUp, BarChart3, RefreshCw } from "lucide-react";

export default function OverviewPage() {
  const [isRunning, setIsRunning] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [modelOutput, setModelOutput] = useState<ModelOutput | null>(null);
  const [marketData, setMarketData] = useState<Record<string, RawDataPoint[]>>(
    {}
  );
  const [availableDates, setAvailableDates] = useState<string[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | undefined>();
  const historyRecords = useRef<HistoryRecord[]>([]);

  // 加载市场数据的辅助函数
  const loadMarketData = useCallback(async () => {
    const symbols = ["SPX", "MOVE", "DXY", "HY_OAS"];
    const results = await Promise.all(
      symbols.map(async (symbol) => {
        try {
          const data = await apiClient.getMarketData(symbol);
          return { symbol, data: data.data };
        } catch {
          return { symbol, data: [] as RawDataPoint[] };
        }
      })
    );
    const newMarketData: Record<string, RawDataPoint[]> = {};
    results.forEach(({ symbol, data }) => {
      newMarketData[symbol] = data;
    });
    setMarketData(newMarketData);
  }, []);

  // 页面加载时获取最新数据 + 市场数据 + 历史记录
  useEffect(() => {
    const loadLatest = async () => {
      try {
        // 并行加载最新输出和历史记录
        const [output, history] = await Promise.all([
          apiClient.getLatestOutput(),
          apiClient.getHistory(365).catch(() => ({ records: [] as HistoryRecord[], total: 0, days: 365 })),
        ]);
        setModelOutput(output);
        setSelectedDate(output.data_ts?.split("T")[0]);

        // 提取有数据的日期列表
        historyRecords.current = history.records;
        const dates = [...new Set(history.records.map((r) => r.data_ts?.split("T")[0]).filter((d): d is string => !!d))];
        setAvailableDates(dates);

        await loadMarketData();
      } catch {
        console.log("No latest output available");
      } finally {
        setIsLoading(false);
      }
    };
    loadLatest();
  }, [loadMarketData]);

  // 日期选择回调
  const handleDateSelect = useCallback(
    async (date: string) => {
      setSelectedDate(date);

      const record = historyRecords.current.find(
        (r) => r.data_ts.split("T")[0] === date
      );
      if (!record) return; // 无历史数据，仅切换日期，用户可点"运行模型"

      setIsLoading(true);
      try {
        const output = await apiClient.getOutputById(record.run_id);
        setModelOutput(output);
        await loadMarketData();
      } catch (error) {
        console.error("Failed to load output for date:", error);
      } finally {
        setIsLoading(false);
      }
    },
    [loadMarketData]
  );

  const handleRunModel = useCallback(async (date?: string) => {
    setIsRunning(true);
    try {
      const output = await apiClient.runModel(date);
      setModelOutput(output);
      setSelectedDate(output.data_ts?.split("T")[0]);

      // 刷新历史记录
      const history = await apiClient.getHistory(365).catch(() => ({ records: [] as HistoryRecord[], total: 0, days: 365 }));
      historyRecords.current = history.records;
      const dates = [...new Set(history.records.map((r) => r.data_ts?.split("T")[0]).filter((d): d is string => !!d))];
      setAvailableDates(dates);

      await loadMarketData();
    } catch (error) {
      console.error("Failed to run model:", error);
    } finally {
      setIsRunning(false);
    }
  }, [loadMarketData]);

  // 从新的 v2.0 响应结构中获取流动性数据
  const liquidity = modelOutput?.liquidity;
  const macro = modelOutput?.macro;

  const riskLightColor = liquidity
    ? getRiskLightColor(liquidity.risk_light)
    : "#52525b";
  const riskLightLabel = liquidity
    ? getRiskLightLabel(liquidity.risk_light)
    : "未运行";
  const riskLightEmoji =
    liquidity?.risk_light === "green"
      ? "🟢"
      : liquidity?.risk_light === "yellow"
      ? "🟡"
      : liquidity?.risk_light === "red"
      ? "🔴"
      : "⚪";

  const scoreColor =
    (liquidity?.liquidity_score ?? 0) >= 70
      ? "#10b981"
      : (liquidity?.liquidity_score ?? 0) >= 40
      ? "#f59e0b"
      : "#ef4444";

  const leverageLabel =
    (liquidity?.leverage_coef ?? 0) <= 0.5
      ? "保守"
      : (liquidity?.leverage_coef ?? 0) <= 0.8
      ? "适度"
      : "激进";

  return (
    <div className="min-h-screen">
      <Header
        onRunModel={handleRunModel}
        isLoading={isRunning}
        lastUpdate={modelOutput?.run_ts}
        availableDates={availableDates}
        onDateSelect={handleDateSelect}
        selectedDate={selectedDate}
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
                {formatDate(modelOutput.data_ts)}
              </span>
            </p>
          )}
        </div>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-24">
            <RefreshCw className="w-8 h-8 text-cyan-400 animate-spin mb-4" />
            <p className="text-zinc-500">加载最新数据...</p>
          </div>
        ) : !modelOutput ? (
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
                indicatorKey="risk_light"
              />
              <MetricCard
                label="流动性评分"
                value={formatNumber(liquidity?.liquidity_score ?? 0)}
                sublabel="满分 100"
                color={scoreColor}
                indicatorKey="liquidity_score"
              />
              <MetricCard
                label="杠杆系数"
                value={`${formatNumber(liquidity?.leverage_coef ?? 0, 1)}x`}
                sublabel={leverageLabel}
                color="#06b6d4"
                indicatorKey="leverage_coef"
              />
              <MetricCard
                label="执行时间"
                value={`${modelOutput.execution_time_ms ?? 0}ms`}
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
            {macro?.layer3?.gates && macro.layer3.gates.length > 0 && (
              <div className="mb-8">
                <h2 className="section-title">
                  <span className="text-lg">🚦</span>
                  闸门矩阵
                </h2>
                <div className="grid grid-cols-5 gap-4">
                  {macro.layer3.gates.map((gate) => (
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
