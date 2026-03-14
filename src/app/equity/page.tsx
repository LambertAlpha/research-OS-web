/**
 * [INPUT]: 页面加载时自动获取最新美股模型输出，用户可点击"运行模型"刷新。
 * [OUTPUT]: (JSX) - 美股模型详情页，含市场体制、加权总分、配置建议、六模块评分、板块轮动、风险管理、文本报告。
 * [POS]: 美股路由 (/equity)。专注展示 EquityOutput 多维度评分系统，通过 /api/equity 获取数据。
 *
 * [PROTOCOL]:
 * 1. 一旦本文件逻辑变更，必须同步更新此 Header。
 * 2. 更新后必须上浮检查 /src/app/equity/.folder.md 的描述是否依然准确。
 */
"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { Header } from "@/components/Header";
import apiClient from "@/lib/api";
import { cn } from "@/lib/utils";
import type { EquityOutput, HistoryRecord } from "@/types/api";
import {
  BarChart3,
  TrendingUp,
  PieChart,
  Layers,
  ArrowUpCircle,
  ArrowDownCircle,
  ShieldAlert,
  FileText,
  RefreshCw,
} from "lucide-react";

// ============================================================================
// 常量映射
// ============================================================================

const MODULE_NAME_MAP: Record<string, string> = {
  fund_flow: "资金流与配置",
  macro_overlay: "宏观覆盖层",
  market_breadth: "市场宽度",
  market_sentiment: "市场信心",
  price_volume: "价量结构",
  options_market: "期权市场",
};

const REGIME_NAME_MAP: Record<string, string> = {
  BULL: "牛市趋势",
  LATE_CYCLE: "晚周期/筑顶",
  BEAR: "熊市/收缩",
  EARLY_RECOVERY: "早期复甦",
  TRANSITION: "转换期",
};

const REGIME_COLOR_MAP: Record<string, string> = {
  BULL: "#10b981",        // emerald-500
  EARLY_RECOVERY: "#06b6d4", // cyan-500
  TRANSITION: "#f59e0b",  // amber-500
  LATE_CYCLE: "#f97316",  // orange-500
  BEAR: "#ef4444",        // red-500
};

// ============================================================================
// 工具函数
// ============================================================================

function getRegimeColor(code: string): string {
  return REGIME_COLOR_MAP[code] || "#6b7280";
}

function getRegimeName(code: string): string {
  return REGIME_NAME_MAP[code] || code;
}

function getModuleName(key: string): string {
  return MODULE_NAME_MAP[key] || key;
}

function getScoreColor(score: number): string {
  if (score > 1) return "#10b981";   // emerald
  if (score > 0) return "#06b6d4";   // cyan
  if (score > -1) return "#f59e0b";  // amber
  return "#ef4444";                   // red
}

function getScoreBgClass(score: number): string {
  if (score > 1) return "from-emerald-500/10 to-emerald-500/5";
  if (score > 0) return "from-cyan-500/10 to-cyan-500/5";
  if (score > -1) return "from-amber-500/10 to-amber-500/5";
  return "from-red-500/10 to-red-500/5";
}

function getRiskLevelColor(level: string): string {
  switch ((level || "NORMAL").toUpperCase()) {
    case "LOW":
    case "NORMAL":
      return "#10b981";
    case "ELEVATED":
    case "MEDIUM":
      return "#f59e0b";
    case "HIGH":
    case "CRITICAL":
      return "#ef4444";
    default:
      return "#6b7280";
  }
}

// ============================================================================
// 页面组件
// ============================================================================

export default function EquityPage() {
  const [isRunning, setIsRunning] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [equityOutput, setEquityOutput] = useState<EquityOutput | null>(null);
  const [availableDates, setAvailableDates] = useState<string[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | undefined>();
  const historyRecords = useRef<HistoryRecord[]>([]);

  // 页面加载时获取最新数据
  useEffect(() => {
    console.log("[equity] useEffect fired, fetching data...");
    const loadLatest = async () => {
      try {
        const [output, history] = await Promise.all([
          apiClient.getEquityOutput(),
          apiClient
            .getHistory(365)
            .catch(() => ({ records: [] as HistoryRecord[], total: 0, days: 365 })),
        ]);
        console.log("[equity] getEquityOutput result:", output ? "got data" : "null");
        setEquityOutput(output);
        if (output?.data_ts) {
          setSelectedDate(output.data_ts.substring(0, 10));
        }

        historyRecords.current = history.records;
        const dates = [
          ...new Set(
            history.records
              .map((r) => r.data_ts?.split("T")[0])
              .filter((d): d is string => !!d)
          ),
        ];
        setAvailableDates(dates);
      } catch (err) {
        console.error("[equity] Failed to load:", err);
      } finally {
        setIsLoading(false);
      }
    };
    loadLatest();
  }, []);

  // 日期选择回调
  const handleDateSelect = useCallback(async (date: string) => {
    setSelectedDate(date);
    setIsLoading(true);
    try {
      const output = await apiClient.getEquityOutput();
      if (output) {
        setEquityOutput(output);
        
      }
    } catch (error) {
      console.error("Failed to load equity output for date:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // 运行模型
  const handleRunModel = useCallback(async (date?: string) => {
    setIsRunning(true);
    try {
      await apiClient.runModel(date);
      const output = await apiClient.getEquityOutput();
      if (output) {
        setEquityOutput(output);
        
      }
      if (output?.data_ts) {
        setSelectedDate(output.data_ts.substring(0, 10));
      }

      const history = await apiClient
        .getHistory(365)
        .catch(() => ({ records: [] as HistoryRecord[], total: 0, days: 365 }));
      historyRecords.current = history.records;
      const dates = [
        ...new Set(
          history.records
            .map((r) => r.data_ts?.split("T")[0])
            .filter((d): d is string => !!d)
        ),
      ];
      setAvailableDates(dates);
    } catch (error) {
      console.error("Failed to run model:", error);
    } finally {
      setIsRunning(false);
    }
  }, []);

  const regime = equityOutput?.regime;
  const modules = equityOutput?.modules || [];
  const allocation = equityOutput?.allocation;
  const sectorBias = equityOutput?.sector_bias;
  const riskMgmt = equityOutput?.risk_management;

  return (
    <div className="min-h-screen">
      <Header
        onRunModel={handleRunModel}
        isLoading={isRunning}
        lastUpdate={equityOutput?.run_ts}
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
            <h1 className="text-2xl font-bold text-zinc-100">美股模型</h1>
            {equityOutput?.model_version && (
              <span className="text-sm text-zinc-500">
                v{equityOutput.model_version}
              </span>
            )}
          </div>
          <p className="text-zinc-500 text-sm ml-12">
            多维度美股市场信号分析 - 体制识别 + 模块评分 + 配置建议 + 风险管理
          </p>
        </div>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-24">
            <RefreshCw className="w-8 h-8 text-cyan-400 animate-spin mb-4" />
            <p className="text-zinc-500">加载最新数据...</p>
          </div>
        ) : !equityOutput ? (
          <div className="flex flex-col items-center justify-center py-24">
            <div className="relative mb-6">
              <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-blue-600/20 flex items-center justify-center border border-cyan-500/20">
                <BarChart3 className="w-12 h-12 text-cyan-400 animate-float" />
              </div>
              <div className="absolute inset-0 rounded-2xl bg-cyan-500/10 blur-xl" />
            </div>
            <h2 className="text-xl font-semibold text-zinc-200 mb-2">暂无数据</h2>
            <p className="text-zinc-500 text-sm">
              点击「运行模型」按钮开始分析
            </p>
          </div>
        ) : (
          <>
            {/* ================================================================
                第一行：3 个大卡片 — 市场体制 / 加权总分 / 配置建议
                ================================================================ */}
            <div className="grid grid-cols-3 gap-4 mb-8">
              {/* 市场体制卡 */}
              <div
                className="relative rounded-2xl p-6 overflow-hidden backdrop-blur-xl"
                style={{
                  background: `linear-gradient(135deg, ${getRegimeColor(regime?.code || "TRANSITION")}15, transparent)`,
                  borderColor: `${getRegimeColor(regime?.code || "TRANSITION")}40`,
                  borderWidth: 1,
                }}
              >
                <div
                  className="absolute top-0 left-0 right-0 h-1"
                  style={{ backgroundColor: getRegimeColor(regime?.code || "TRANSITION") }}
                />
                <div className="text-xs text-zinc-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <TrendingUp className="w-3.5 h-3.5" />
                  市场体制
                </div>
                <div className="flex items-baseline gap-3 mb-2">
                  <span
                    className="text-3xl font-bold"
                    style={{ color: getRegimeColor(regime?.code || "TRANSITION") }}
                  >
                    {regime?.code || "N/A"}
                  </span>
                  <span className="text-lg text-zinc-200">
                    {getRegimeName(regime?.code || "")}
                  </span>
                </div>
                {regime?.position_cap !== undefined && (
                  <div className="text-sm text-zinc-400">
                    仓位上限:{" "}
                    <span className="text-zinc-200 font-medium">
                      {regime.position_cap}%
                    </span>
                  </div>
                )}
              </div>

              {/* 加权总分卡 */}
              <div
                className={cn(
                  "relative rounded-2xl p-6 overflow-hidden backdrop-blur-xl border bg-gradient-to-br",
                  getScoreBgClass(equityOutput.weighted_score),
                )}
                style={{
                  borderColor: `${getScoreColor(equityOutput.weighted_score)}40`,
                }}
              >
                <div
                  className="absolute top-0 left-0 right-0 h-1"
                  style={{ backgroundColor: getScoreColor(equityOutput.weighted_score) }}
                />
                <div className="text-xs text-zinc-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5" />
                  加权总分
                </div>
                <div
                  className="text-4xl font-bold mb-3"
                  style={{ color: getScoreColor(equityOutput.weighted_score) }}
                >
                  {equityOutput.weighted_score.toFixed(2)}
                </div>
                {/* 分数条 */}
                <div className="relative h-2 rounded-full bg-zinc-800 overflow-hidden">
                  <div
                    className="absolute top-0 h-full rounded-full transition-all duration-500"
                    style={{
                      backgroundColor: getScoreColor(equityOutput.weighted_score),
                      left: "50%",
                      width: `${Math.abs(equityOutput.weighted_score) * 25}%`,
                      transform: equityOutput.weighted_score < 0 ? "translateX(-100%)" : "none",
                    }}
                  />
                  {/* 中心线 */}
                  <div className="absolute top-0 left-1/2 w-px h-full bg-zinc-600" />
                </div>
                <div className="flex justify-between mt-1 text-[10px] text-zinc-600">
                  <span>-2</span>
                  <span>0</span>
                  <span>+2</span>
                </div>
              </div>

              {/* 配置建议卡 */}
              {allocation && (
                <div className="relative rounded-2xl p-6 overflow-hidden backdrop-blur-xl bg-gradient-to-br from-zinc-900/80 to-zinc-950/80 border border-zinc-800/50">
                  <div className="absolute top-0 left-0 right-0 h-0.5 opacity-50 bg-gradient-to-r from-transparent via-cyan-500 to-transparent" />
                  <div className="text-xs text-zinc-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                    <PieChart className="w-3.5 h-3.5" />
                    配置建议
                  </div>

                  {/* 条形图 */}
                  <div className="space-y-3">
                    {/* 股票 */}
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-zinc-400">股票</span>
                        <span className="text-cyan-400 font-medium">
                          {allocation.equity_pct}%
                        </span>
                      </div>
                      <div className="h-2.5 rounded-full bg-zinc-800 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-cyan-500 transition-all duration-500"
                          style={{ width: `${allocation.equity_pct}%` }}
                        />
                      </div>
                    </div>
                    {/* 债券 */}
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-zinc-400">债券</span>
                        <span className="text-blue-400 font-medium">
                          {allocation.bond_pct}%
                        </span>
                      </div>
                      <div className="h-2.5 rounded-full bg-zinc-800 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-blue-500 transition-all duration-500"
                          style={{ width: `${allocation.bond_pct}%` }}
                        />
                      </div>
                    </div>
                    {/* 现金 */}
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-zinc-400">现金</span>
                        <span className="text-zinc-300 font-medium">
                          {allocation.cash_pct}%
                        </span>
                      </div>
                      <div className="h-2.5 rounded-full bg-zinc-800 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-zinc-500 transition-all duration-500"
                          style={{ width: `${allocation.cash_pct}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="divider" />

            {/* ================================================================
                第二行：6 模块评分
                ================================================================ */}
            {modules.length > 0 && (
              <div className="mb-8">
                <h2 className="section-title">
                  <Layers className="w-5 h-5 text-cyan-400" />
                  模块评分
                </h2>
                <div className="grid grid-cols-3 gap-4">
                  {modules.map((mod) => (
                    <div
                      key={mod.name}
                      className="group relative rounded-xl p-4 overflow-hidden bg-gradient-to-br from-zinc-900/80 to-zinc-950/80 border border-zinc-800/50 backdrop-blur-xl hover:border-zinc-700/50 transition-all duration-300"
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <div className="text-sm font-medium text-zinc-200">
                            {getModuleName(mod.name)}
                          </div>
                          <div className="text-xs text-zinc-500">
                            权重: {(mod.weight * 100).toFixed(0)}%
                          </div>
                        </div>
                        <div
                          className="text-2xl font-bold"
                          style={{ color: getScoreColor(mod.score) }}
                        >
                          {mod.score > 0 ? "+" : ""}
                          {mod.score.toFixed(1)}
                        </div>
                      </div>
                      {/* 分数条 */}
                      <div className="relative h-1.5 rounded-full bg-zinc-800 overflow-hidden">
                        <div
                          className="absolute top-0 h-full rounded-full transition-all duration-500"
                          style={{
                            backgroundColor: getScoreColor(mod.score),
                            left: "50%",
                            width: `${Math.abs(mod.score) * 25}%`,
                            transform: mod.score < 0 ? "translateX(-100%)" : "none",
                          }}
                        />
                        <div className="absolute top-0 left-1/2 w-px h-full bg-zinc-600" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="divider" />

            {/* ================================================================
                第三行：板块轮动 + 风险管理
                ================================================================ */}
            <div className="grid grid-cols-2 gap-4 mb-8">
              {/* 板块轮动 */}
              {sectorBias && (
                <div className="relative rounded-2xl p-5 overflow-hidden bg-gradient-to-br from-zinc-900/80 to-zinc-950/80 border border-zinc-800/50 backdrop-blur-xl">
                  <div className="absolute top-0 left-0 right-0 h-0.5 opacity-50 bg-gradient-to-r from-transparent via-cyan-500 to-transparent" />
                  <h3 className="text-xs text-zinc-500 uppercase tracking-wider mb-4 flex items-center gap-1.5">
                    <TrendingUp className="w-4 h-4 text-cyan-400" />
                    板块轮动
                  </h3>

                  {/* 超配 */}
                  <div className="mb-4">
                    <div className="flex items-center gap-1.5 mb-2">
                      <ArrowUpCircle className="w-4 h-4 text-emerald-400" />
                      <span className="text-sm font-medium text-emerald-400">超配</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {sectorBias.overweight.length > 0 ? (
                        sectorBias.overweight.map((sector) => (
                          <span
                            key={sector}
                            className="px-3 py-1 rounded-lg text-sm bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                          >
                            {sector}
                          </span>
                        ))
                      ) : (
                        <span className="text-sm text-zinc-600">无</span>
                      )}
                    </div>
                  </div>

                  {/* 低配 */}
                  <div className="mb-4">
                    <div className="flex items-center gap-1.5 mb-2">
                      <ArrowDownCircle className="w-4 h-4 text-red-400" />
                      <span className="text-sm font-medium text-red-400">低配</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {sectorBias.underweight.length > 0 ? (
                        sectorBias.underweight.map((sector) => (
                          <span
                            key={sector}
                            className="px-3 py-1 rounded-lg text-sm bg-red-500/10 text-red-400 border border-red-500/20"
                          >
                            {sector}
                          </span>
                        ))
                      ) : (
                        <span className="text-sm text-zinc-600">无</span>
                      )}
                    </div>
                  </div>

                  {/* 理由 */}
                  {sectorBias.rationale && (
                    <div className="mt-3 pt-3 border-t border-zinc-800/50">
                      <div className="text-xs text-zinc-500 mb-1">轮动理由</div>
                      <div className="text-sm text-zinc-400">
                        {sectorBias.rationale}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* 风险管理 */}
              {riskMgmt && (
                <div className="relative rounded-2xl p-5 overflow-hidden bg-gradient-to-br from-zinc-900/80 to-zinc-950/80 border border-zinc-800/50 backdrop-blur-xl">
                  <div className="absolute top-0 left-0 right-0 h-0.5 opacity-50 bg-gradient-to-r from-transparent via-amber-500 to-transparent" />
                  <h3 className="text-xs text-zinc-500 uppercase tracking-wider mb-4 flex items-center gap-1.5">
                    <ShieldAlert className="w-4 h-4 text-amber-400" />
                    风险管理
                  </h3>

                  <div className="space-y-4">
                    {/* 回撤百分比 */}
                    <div>
                      <div className="text-xs text-zinc-500 mb-1">当前回撤</div>
                      <div
                        className="text-3xl font-bold"
                        style={{ color: getRiskLevelColor(riskMgmt.level) }}
                      >
                        {(riskMgmt.drawdown_pct ?? 0).toFixed(1)}%
                      </div>
                    </div>

                    {/* 当前级别 */}
                    <div>
                      <div className="text-xs text-zinc-500 mb-1">风险级别</div>
                      <span
                        className="inline-flex items-center px-3 py-1 rounded-lg text-sm font-medium"
                        style={{
                          backgroundColor: `${getRiskLevelColor(riskMgmt.level)}20`,
                          color: getRiskLevelColor(riskMgmt.level),
                          borderWidth: 1,
                          borderColor: `${getRiskLevelColor(riskMgmt.level)}40`,
                        }}
                      >
                        {riskMgmt.level}
                      </span>
                    </div>

                    {/* 建议动作 */}
                    <div>
                      <div className="text-xs text-zinc-500 mb-1">建议动作</div>
                      <div className="text-sm text-zinc-300">{riskMgmt.action}</div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* ================================================================
                底部：文本报告
                ================================================================ */}
            {equityOutput.report_summary && (
              <>
                <div className="divider" />
                <div className="mb-8">
                  <h2 className="section-title">
                    <FileText className="w-5 h-5 text-cyan-400" />
                    分析报告
                  </h2>
                  <div className="relative rounded-2xl p-5 overflow-hidden bg-gradient-to-br from-zinc-900/80 to-zinc-950/80 border border-zinc-800/50 backdrop-blur-xl">
                    <div className="absolute top-0 left-0 right-0 h-0.5 opacity-50 bg-gradient-to-r from-transparent via-zinc-500 to-transparent" />
                    <pre className="text-sm text-zinc-300 whitespace-pre-wrap font-mono leading-relaxed">
                      {equityOutput.report_summary}
                    </pre>
                  </div>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
