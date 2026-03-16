/**
 * [INPUT]: 页面加载时自动获取最新模型输出，用户可点击"运行模型"刷新。
 * [OUTPUT]: (JSX) - 流动性模型 v3.0 详情页，含一票否决警告、风险灯号/评分/杠杆三卡、分项得分、禁止策略、5 个流动性指标图表。
 * [POS]: 流动性路由 (/liquidity)。专注展示 LiquidityOutput 数据，获取 WALCL/SOFR/IORB/WRESBAL/RRPONTSYD/MOVE 六种市场数据。
 *
 * [PROTOCOL]:
 * 1. 一旦本文件逻辑变更，必须同步更新此 Header。
 * 2. 更新后必须上浮检查 /src/app/liquidity/.folder.md 的描述是否依然准确。
 */
"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { Header } from "@/components/Header";
import { Chart } from "@/components/Chart";
import { Tooltip } from "@/components/Tooltip";
import apiClient from "@/lib/api";
import { getRiskLightColor, getRiskLightLabel, formatNumber } from "@/lib/utils";
import type { ModelOutput, RawDataPoint, HistoryRecord } from "@/types/api";
import { Droplets, AlertTriangle, BarChart3, Zap, AlertCircle, RefreshCw } from "lucide-react";

export default function LiquidityPage() {
  const [isRunning, setIsRunning] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [modelOutput, setModelOutput] = useState<ModelOutput | null>(null);
  const [marketData, setMarketData] = useState<Record<string, RawDataPoint[]>>({});
  const [availableDates, setAvailableDates] = useState<string[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | undefined>();
  const historyRecords = useRef<HistoryRecord[]>([]);

  // 加载市场数据的辅助函数
  const loadMarketData = useCallback(async () => {
    const symbols = ["WALCL", "SOFR", "IORB", "WRESBAL", "RRPONTSYD", "MOVE"];
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
        const [output, history] = await Promise.all([
          apiClient.getLatestOutput(),
          apiClient.getHistory(365).catch(() => ({ records: [] as HistoryRecord[], total: 0, days: 365 })),
        ]);
        setModelOutput(output);
        setSelectedDate(output.data_ts?.split("T")[0]);

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

  // 从新的响应结构中获取流动性数据
  const liquidity = modelOutput?.liquidity;

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
        dataAsOf={modelOutput?.data_as_of}
        availableDates={availableDates}
        onDateSelect={handleDateSelect}
        selectedDate={selectedDate}
      />

      <div className="p-6">
        {/* 页面标题 */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-1">
            <div className="p-2 rounded-lg bg-blue-500/10">
              <Droplets className="w-5 h-5 text-blue-400" />
            </div>
            <h1 className="text-2xl font-bold text-zinc-100">流动性模型 v3.0</h1>
          </div>
          <p className="text-zinc-500 text-sm ml-12">
            美元流动性监测与风险评估 - Quantity 40% + Plumbing 30% + Vol Gate 30%
          </p>
        </div>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-24">
            <RefreshCw className="w-8 h-8 text-blue-400 animate-spin mb-4" />
            <p className="text-zinc-500">加载最新数据...</p>
          </div>
        ) : !modelOutput ? (
          <div className="flex flex-col items-center justify-center py-24">
            <div className="relative mb-6">
              <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-blue-500/20 to-cyan-600/20 flex items-center justify-center border border-blue-500/20">
                <Droplets className="w-12 h-12 text-blue-400 animate-float" />
              </div>
              <div className="absolute inset-0 rounded-2xl bg-blue-500/10 blur-xl" />
            </div>
            <h2 className="text-xl font-semibold text-zinc-200 mb-2">
              暂无数据
            </h2>
            <p className="text-zinc-500 text-sm">
              点击「运行模型」按钮开始分析
            </p>
          </div>
        ) : liquidity ? (
          <>
            {/* 一票否决警告 */}
            {liquidity.hard_stop_triggered && (
              <div className="mb-6">
                <div className="relative rounded-xl p-4 overflow-hidden bg-red-500/20 border border-red-500/50 backdrop-blur-xl">
                  <div className="absolute top-0 left-0 right-0 h-1 bg-red-500" />
                  <div className="text-red-400 font-bold flex items-center gap-2 text-lg">
                    <AlertCircle className="w-5 h-5" />
                    一票否决触发
                  </div>
                  <div className="text-red-300 mt-2">
                    {liquidity.hard_stop_reason || "触发强制紧缩条件"}
                  </div>
                </div>
              </div>
            )}

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
                <div className="text-xs font-semibold text-zinc-500 uppercase tracking-wider flex items-center justify-center gap-1.5">
                  风险灯号
                  <Tooltip indicatorKey="risk_light" placement="top" />
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
                  {formatNumber(liquidity.liquidity_score)}
                  <span className="text-lg text-zinc-500">/100</span>
                </div>
                <div className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mt-2 flex items-center justify-center gap-1.5">
                  流动性评分
                  <Tooltip indicatorKey="liquidity_score" placement="top" />
                </div>
                {/* 进度条 */}
                <div className="mt-4 bg-zinc-800 rounded-full h-1.5 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{
                      width: `${liquidity.liquidity_score}%`,
                      backgroundColor: scoreColor,
                      boxShadow: `0 0 10px ${scoreColor}`,
                    }}
                  />
                </div>
                {/* Supply Texture 修正显示 */}
                {liquidity.supply_texture_adjustment !== 0 && (
                  <div className="text-xs text-amber-400 mt-2">
                    Supply Texture: {liquidity.supply_texture_adjustment > 0 ? '+' : ''}{liquidity.supply_texture_adjustment}
                  </div>
                )}
              </div>

              {/* 建议杠杆 */}
              <div className="group relative rounded-2xl p-6 overflow-hidden transition-all duration-500 bg-gradient-to-br from-zinc-900/80 to-zinc-950/80 border border-zinc-800/50 hover:border-cyan-500/30 backdrop-blur-xl text-center">
                <div className="absolute top-0 left-0 right-0 h-0.5 opacity-60 bg-gradient-to-r from-transparent via-cyan-500 to-transparent" />
                <div
                  className="text-4xl font-bold text-cyan-400"
                  style={{ textShadow: "0 0 30px rgba(6, 182, 212, 0.6)" }}
                >
                  {formatNumber(liquidity.leverage_coef, 1)}
                  <span className="text-xl text-zinc-500">x</span>
                </div>
                <div className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mt-2 flex items-center justify-center gap-1.5">
                  建议杠杆
                  <Tooltip indicatorKey="leverage_coef" placement="top" />
                </div>
                <div className="text-zinc-400 text-sm mt-3">
                  {liquidity.leverage_coef <= 0.5
                    ? "🛡️ 保守配置"
                    : liquidity.leverage_coef <= 0.8
                    ? "⚖️ 适度杠杆"
                    : "⚡ 激进操作"}
                </div>
                {/* RRP 缓冲放大器警告 */}
                {liquidity.rrp_buffer_amplified && (
                  <div className="text-xs text-amber-400 mt-2 flex items-center justify-center gap-1">
                    <Zap className="w-3 h-3" />
                    RRP 缓冲放大
                  </div>
                )}
              </div>
            </div>

            <div className="divider" />

            {/* 分项得分 — 按维度分组 */}
            {liquidity.component_scores && liquidity.component_scores.length > 0 && (() => {
              const dimensionConfig: Record<string, { label: string; color: string; colorLight: string; totalWeight: number }> = {
                Quantity:         { label: "水位监测", color: "#06b6d4", colorLight: "rgba(6,182,212,0.15)",  totalWeight: 0.40 },
                Plumbing:         { label: "管道与压力", color: "#f59e0b", colorLight: "rgba(245,158,11,0.15)", totalWeight: 0.30 },
                "Volatility Gate": { label: "隐形阀门", color: "#ef4444", colorLight: "rgba(239,68,68,0.15)",  totalWeight: 0.30 },
              };
              const grouped: Record<string, typeof liquidity.component_scores> = {};
              for (const comp of liquidity.component_scores) {
                const cat = comp.category;
                if (!cat) continue;
                if (!grouped[cat]) grouped[cat] = [];
                grouped[cat].push(comp);
              }
              return (
                <div className="mb-8">
                  <h2 className="section-title">
                    <BarChart3 className="w-5 h-5 text-cyan-400" />
                    分项得分
                  </h2>
                  <div className="grid grid-cols-3 gap-5">
                    {Object.entries(dimensionConfig).map(([dim, cfg]) => {
                      const items = grouped[dim] || [];
                      if (items.length === 0) return null;
                      const dimWeightSum = items.reduce((s, c) => s + c.weight, 0);
                      const dimScore = dimWeightSum > 0
                        ? items.reduce((s, c) => s + c.score * c.weight, 0) / dimWeightSum
                        : 0;
                      return (
                        <div
                          key={dim}
                          className="relative rounded-2xl p-5 overflow-hidden bg-gradient-to-br from-zinc-900/80 to-zinc-950/80 border border-zinc-800/50 backdrop-blur-xl"
                        >
                          {/* 顶部渐变线 */}
                          <div
                            className="absolute top-0 left-0 right-0 h-0.5 opacity-60"
                            style={{ background: `linear-gradient(90deg, transparent, ${cfg.color}, transparent)` }}
                          />

                          {/* 维度标题 + 汇总分 */}
                          <div className="flex items-center justify-between mb-4">
                            <div>
                              <div className="text-sm font-semibold" style={{ color: cfg.color }}>
                                {dim}
                              </div>
                              <div className="text-xs text-zinc-500">{cfg.label} · 权重 {(cfg.totalWeight * 100).toFixed(0)}%</div>
                            </div>
                            <div className="text-right">
                              <div
                                className="text-2xl font-bold"
                                style={{ color: cfg.color, textShadow: `0 0 16px ${cfg.color}40` }}
                              >
                                {formatNumber(dimScore)}
                                <span className="text-sm text-zinc-500">/100</span>
                              </div>
                            </div>
                          </div>

                          {/* 维度进度条 */}
                          <div className="mb-4 bg-zinc-800 rounded-full h-1.5 overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all duration-700"
                              style={{ width: `${dimScore}%`, backgroundColor: cfg.color, boxShadow: `0 0 8px ${cfg.color}` }}
                            />
                          </div>

                          {/* 子项列表 */}
                          <div className="space-y-3">
                            {items.map((comp) => (
                              <div
                                key={comp.name}
                                className="rounded-lg p-3"
                                style={{ backgroundColor: cfg.colorLight }}
                              >
                                <div className="flex items-center justify-between mb-1">
                                  <div className="text-xs text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                                    {comp.name.replace(/_/g, " ")}
                                    <Tooltip indicatorKey={comp.name.toLowerCase()} placement="top" />
                                  </div>
                                  <div className="text-xs text-zinc-500">
                                    权重 {(comp.weight * 100).toFixed(0)}%
                                  </div>
                                </div>
                                <div className="flex items-end justify-between">
                                  <div className="text-lg font-bold text-zinc-200">
                                    {formatNumber(comp.score)}
                                    <span className="text-xs text-zinc-500">/100</span>
                                  </div>
                                  <div className="text-sm text-zinc-400">{comp.label}</div>
                                </div>
                                {/* 子项进度条 */}
                                <div className="mt-2 bg-zinc-800/60 rounded-full h-1 overflow-hidden">
                                  <div
                                    className="h-full rounded-full transition-all duration-500"
                                    style={{
                                      width: `${comp.score}%`,
                                      backgroundColor: cfg.color,
                                      opacity: 0.7,
                                    }}
                                  />
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}

            <div className="divider" />

            {/* 禁止策略 */}
            {liquidity.forbidden_strategies.length > 0 && (
              <div className="mb-8">
                <div className="relative rounded-xl p-4 overflow-hidden bg-red-500/10 border border-red-500/30 backdrop-blur-xl">
                  <div className="absolute top-0 left-0 right-0 h-0.5 opacity-50 bg-gradient-to-r from-transparent via-red-500 to-transparent" />
                  <div className="text-red-400 font-semibold flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4" />
                    禁止策略
                  </div>
                  <div className="text-red-300 mt-2 text-sm">
                    {liquidity.forbidden_strategies.join(", ")}
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
                    referenceLines={[
                      { y: 3, color: "#f59e0b", label: "警示" },
                      { y: 5, color: "#ef4444", label: "红灯" },
                    ]}
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
                {marketData.MOVE && marketData.MOVE.length > 0 && (
                  <Chart
                    data={marketData.MOVE}
                    title="MOVE 利率波动率"
                    color="#ec4899"
                    showArea={false}
                    referenceLines={[
                      { y: 100, color: "#f59e0b", label: "阻塞" },
                      { y: 120, color: "#ef4444", label: "关闸" },
                    ]}
                  />
                )}
                {marketData.RRPONTSYD && marketData.RRPONTSYD.length > 0 && (
                  <Chart
                    data={marketData.RRPONTSYD.map((p) => ({
                      ...p,
                      value: p.value / 1e4, // 转换为亿
                    }))}
                    title="RRP (亿美元)"
                    color="#f97316"
                    referenceLines={[
                      { y: 4000, color: "#ef4444", label: "缓冲阈值" },
                    ]}
                  />
                )}
              </div>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
