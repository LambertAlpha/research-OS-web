/**
 * [INPUT]: 页面加载时自动获取最新模型输出，用户可点击"运行模型"刷新。可选 date 参数。
 * [OUTPUT]: (JSX) - Bento Grid 市场概览仪表板，含风险灯号、流动性评分、杠杆系数、宏观状态、模型报告、闸门矩阵、市场行情图表、告警信息。
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
import { RefreshCw, AlertTriangle } from "lucide-react";

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

  const handleDateSelect = useCallback(
    async (date: string) => {
      setSelectedDate(date);
      const record = historyRecords.current.find(
        (r) => r.data_ts.split("T")[0] === date
      );
      if (!record) return;

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
      ? "#22c55e"
      : (liquidity?.liquidity_score ?? 0) >= 40
      ? "#eab308"
      : "#ef4444";

  const leverageLabel =
    (liquidity?.leverage_coef ?? 0) <= 0.5
      ? "保守"
      : (liquidity?.leverage_coef ?? 0) <= 0.8
      ? "适度"
      : "激进";

  const macroStateColor =
    macro?.macro_state?.code === "A"
      ? "#22c55e"
      : macro?.macro_state?.code === "B"
      ? "#eab308"
      : macro?.macro_state?.code === "C"
      ? "#f97316"
      : macro?.macro_state?.code === "D"
      ? "#ef4444"
      : "#71717a";

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
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-32">
            <RefreshCw className="w-5 h-5 text-[var(--text-faint)] animate-spin mb-3" />
            <p className="text-[var(--text-muted)] text-sm">加载数据...</p>
          </div>
        ) : !modelOutput ? (
          <div className="flex flex-col items-center justify-center py-32">
            <div className="w-14 h-14 rounded-2xl bg-[var(--bg-card)] border border-[var(--border-subtle)] flex items-center justify-center mb-4">
              <span className="text-2xl animate-float">⚡</span>
            </div>
            <h2 className="text-base font-medium text-zinc-300 mb-1">
              准备就绪
            </h2>
            <p className="text-[var(--text-muted)] text-sm">
              点击「运行模型」开始分析
            </p>
          </div>
        ) : (
          <>
            {/* 页面标题 */}
            <div className="mb-6">
              <h1 className="text-[1.75rem] font-semibold text-zinc-100 tracking-tight font-display leading-tight">
                市场概览
              </h1>
              {modelOutput?.data_ts && (
                <p className="text-[var(--text-faint)] text-xs mt-1">
                  {formatDate(modelOutput.data_ts)}
                </p>
              )}
            </div>

            {/* ============ BENTO GRID ============ */}
            <div className="grid grid-cols-12 gap-4">

              {/* ── Row 1-2: Hero + Metrics ── */}

              {/* 风险灯号 Hero */}
              <div className="col-span-5 row-span-2 bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-[14px] p-6 flex flex-col justify-between transition-colors duration-150 hover:bg-[var(--bg-card-hover)]">
                <div>
                  <p className="text-[10px] font-medium text-[var(--text-faint)] uppercase tracking-widest mb-5">
                    Risk Status
                  </p>
                  <div className="flex items-start gap-4 mb-5">
                    <span className="text-5xl leading-none">{riskLightEmoji}</span>
                    <div>
                      <p
                        className="text-2xl font-semibold font-display leading-tight"
                        style={{ color: riskLightColor }}
                      >
                        {riskLightLabel}
                      </p>
                      <p className="text-sm text-[var(--text-muted)] mt-1 leading-relaxed">
                        {liquidity?.risk_light === "green"
                          ? "流动性环境健康，可正常运营"
                          : liquidity?.risk_light === "yellow"
                          ? "流动性趋紧，需保持警惕"
                          : liquidity?.risk_light === "red"
                          ? "流动性恶化，建议减仓"
                          : "等待模型输出"}
                      </p>
                    </div>
                  </div>
                </div>

                {/* 底部摘要 */}
                <div className="flex gap-8 pt-4 border-t border-[var(--border-subtle)]">
                  <div>
                    <p className="text-[10px] text-[var(--text-faint)] uppercase tracking-wider mb-0.5">Score</p>
                    <p className="text-lg font-semibold tabular-nums" style={{ color: scoreColor }}>
                      {formatNumber(liquidity?.liquidity_score ?? 0)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] text-[var(--text-faint)] uppercase tracking-wider mb-0.5">Leverage</p>
                    <p className="text-lg font-semibold tabular-nums text-zinc-300">
                      {formatNumber(liquidity?.leverage_coef ?? 0, 1)}x
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] text-[var(--text-faint)] uppercase tracking-wider mb-0.5">Hard Stop</p>
                    <p className={`text-lg font-semibold ${liquidity?.hard_stop_triggered ? "text-red-400" : "text-[var(--text-faint)]"}`}>
                      {liquidity?.hard_stop_triggered ? "YES" : "NO"}
                    </p>
                  </div>
                </div>
              </div>

              {/* 流动性评分 */}
              <div className="col-span-4">
                <MetricCard
                  label="流动性评分"
                  value={formatNumber(liquidity?.liquidity_score ?? 0)}
                  sublabel="满分 100"
                  color={scoreColor}
                  indicatorKey="liquidity_score"
                />
              </div>

              {/* 杠杆系数 */}
              <div className="col-span-3">
                <MetricCard
                  label="杠杆系数"
                  value={`${formatNumber(liquidity?.leverage_coef ?? 0, 1)}x`}
                  sublabel={leverageLabel}
                  color="#a1a1aa"
                  indicatorKey="leverage_coef"
                />
              </div>

              {/* 宏观状态 */}
              <div className="col-span-4">
                <div className="bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-[14px] p-5 transition-colors duration-150 hover:bg-[var(--bg-card-hover)]">
                  <p className="text-[10px] font-medium text-[var(--text-faint)] uppercase tracking-widest mb-3">
                    Macro State
                  </p>
                  <div className="flex items-baseline gap-3">
                    <span
                      className="text-3xl font-semibold font-display"
                      style={{ color: macroStateColor }}
                    >
                      {macro?.macro_state?.code ?? "-"}
                    </span>
                    <span className="text-sm text-[var(--text-muted)]">
                      {macro?.macro_state?.name ?? "未知"}
                    </span>
                  </div>
                  {macro?.correction?.level && macro.correction.level !== "NONE" && (
                    <p className="text-xs text-amber-400/70 mt-2">
                      纠错 {macro.correction.level}: {macro.correction.reason}
                    </p>
                  )}
                </div>
              </div>

              {/* 执行时间 */}
              <div className="col-span-3">
                <MetricCard
                  label="执行时间"
                  value={`${modelOutput.execution_time_ms ?? 0}ms`}
                  sublabel={modelOutput.status}
                  color="#71717a"
                />
              </div>

              {/* ── Row 3: Gates (完整 GateCard) + Report ── */}

              {macro?.layer3?.gates && macro.layer3.gates.length > 0 && (
                <div className="col-span-5">
                  <p className="text-[10px] font-medium text-[var(--text-faint)] uppercase tracking-widest mb-3">
                    Gate Matrix
                  </p>
                  <div className="grid grid-cols-1 gap-2">
                    {macro.layer3.gates.map((gate) => (
                      <GateCard key={gate.name} gate={gate} />
                    ))}
                  </div>
                </div>
              )}

              <div className={macro?.layer3?.gates && macro.layer3.gates.length > 0 ? "col-span-7" : "col-span-12"}>
                <p className="text-[10px] font-medium text-[var(--text-faint)] uppercase tracking-widest mb-3">
                  Model Report
                </p>
                <div className="bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-[14px] p-5">
                  <pre className="font-mono text-[13px] text-[var(--text-secondary)] whitespace-pre-wrap leading-relaxed">
                    {modelOutput.report_summary}
                  </pre>
                </div>
              </div>

              {/* ── Alerts ── */}
              {modelOutput.alerts.length > 0 && (
                <div className="col-span-12">
                  <p className="text-[10px] font-medium text-[var(--text-faint)] uppercase tracking-widest mb-3 flex items-center gap-1.5">
                    <AlertTriangle className="w-3 h-3 text-amber-500/70" />
                    Alerts
                  </p>
                  <div className="space-y-2">
                    {modelOutput.alerts.map((alert, i) => (
                      <div
                        key={i}
                        className={`rounded-[12px] px-4 py-3 ${
                          alert.level === "CRITICAL"
                            ? "alert-critical"
                            : "alert-warning"
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              alert.level === "CRITICAL"
                                ? "bg-red-500 animate-pulse"
                                : "bg-amber-500"
                            }`}
                          />
                          <span
                            className={`text-xs font-medium ${
                              alert.level === "CRITICAL"
                                ? "text-red-400"
                                : "text-amber-400"
                            }`}
                          >
                            {alert.type}
                          </span>
                        </div>
                        <p className="text-sm text-[var(--text-secondary)] pl-4">
                          {alert.message}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ── Market Charts ── */}
              <div className="col-span-12">
                <p className="text-[10px] font-medium text-[var(--text-faint)] uppercase tracking-widest mb-3">
                  Market Data
                </p>
              </div>

              {marketData.SPX && marketData.SPX.length > 0 && (
                <div className="col-span-7">
                  <Chart data={marketData.SPX} title="S&P 500" color="#e4e4e7" />
                </div>
              )}

              {marketData.MOVE && marketData.MOVE.length > 0 && (
                <div className="col-span-5">
                  <Chart
                    data={marketData.MOVE}
                    title="MOVE Index"
                    color="#eab308"
                    showArea={false}
                    referenceLines={[
                      { y: 100, color: "#eab308", label: "关注" },
                      { y: 120, color: "#ef4444", label: "关闸" },
                    ]}
                  />
                </div>
              )}

              {marketData.DXY && marketData.DXY.length > 0 && (
                <div className="col-span-5">
                  <Chart data={marketData.DXY} title="美元指数 (DXY)" color="#a1a1aa" />
                </div>
              )}

              {marketData.HY_OAS && marketData.HY_OAS.length > 0 && (
                <div className="col-span-7">
                  <Chart
                    data={marketData.HY_OAS}
                    title="高收益债 OAS (bp)"
                    color="#f87171"
                    showArea={false}
                    referenceLines={[
                      { y: 400, color: "#eab308", label: "关注" },
                      { y: 500, color: "#ef4444", label: "警告" },
                    ]}
                  />
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
