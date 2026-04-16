/**
 * [INPUT]: (model: string, defaultPriceSymbol?: string, priceSymbols?: Array) - 模型类型、默认标的、可选标的列表。
 * [OUTPUT]: (<div>) - 可嵌入的回测面板：参数选择 + 统计卡片 + 信号叠加图 + 信号明细表 + 信号变更时间线。
 * [POS]: 位于 /components，被 /backtest 页面及各模型页面引用。回测功能的核心可复用组件。
 *
 * [PROTOCOL]:
 * 1. 一旦本文件逻辑变更，必须同步更新此 Header。
 * 2. 更新后必须上浮检查 /src/components/.folder.md 的描述是否依然准确。
 */
"use client";

import { useState, useCallback, useMemo } from "react";
import {
  RefreshCw,
  Calendar,
  Clock,
  AlertTriangle,
  TrendingUp,
  Shield,
  Activity,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { SignalOverlayChart } from "@/components/SignalOverlayChart";
import apiClient from "@/lib/api";
import type { BacktestResult, BacktestSignal, SignalChange } from "@/types/api";
import { cn } from "@/lib/utils";

// ============================================================================
// Types
// ============================================================================

export type BacktestModelType = "combined" | "liquidity" | "macro" | "equity" | "btc";

export interface BacktestPanelProps {
  model: BacktestModelType;
  defaultPriceSymbol?: string; // "SPX" for most, "BTC-USD" for btc
  /** Available price symbols for this model */
  priceSymbols?: { value: string; label: string }[];
}

// ============================================================================
// Constants
// ============================================================================

/** 按模型定制的价格基准选项 */
const MODEL_PRICE_SYMBOLS: Record<BacktestModelType, { value: string; label: string }[]> = {
  combined: [
    { value: "SPX", label: "S&P 500" },
    { value: "NDX", label: "NASDAQ 100" },
    { value: "BTC-USD", label: "Bitcoin" },
  ],
  liquidity: [
    { value: "SPX", label: "S&P 500" },
    { value: "NDX", label: "NASDAQ 100" },
  ],
  macro: [
    { value: "SPX", label: "S&P 500" },
    { value: "NDX", label: "NASDAQ 100" },
  ],
  equity: [
    { value: "SPX", label: "S&P 500" },
    { value: "NDX", label: "NASDAQ 100" },
  ],
  btc: [
    { value: "BTC-USD", label: "Bitcoin" },
  ],
};

const PRESETS = [
  { label: "6个月", months: 6 },
  { label: "1年", months: 12 },
  { label: "2年", months: 24 },
  { label: "3年", months: 36 },
];

const RISK_LIGHT_EMOJI: Record<string, string> = {
  green: "🟢",
  yellow: "🟡",
  red: "🔴",
  unknown: "⚪",
};

const MACRO_STATE_STYLE: Record<string, { label: string; color: string }> = {
  A: { label: "A 增长", color: "text-emerald-400" },
  B: { label: "B 冲击", color: "text-amber-400" },
  C: { label: "C 衰退", color: "text-red-400" },
  D: { label: "D 通胀", color: "text-orange-400" },
};

// ============================================================================
// Helpers
// ============================================================================

function getDefaultDates() {
  const end = new Date();
  const start = new Date();
  start.setFullYear(start.getFullYear() - 1);
  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
  };
}

/** Compute stat cards based on model type */
function computeStatCards(
  model: BacktestModelType,
  signals: BacktestSignal[],
  total: number,
) {
  const pct = (count: number) =>
    total > 0 ? `${((count / total) * 100).toFixed(0)}%` : "0%";

  if (model === "macro") {
    // Macro model: show state distribution A/B/C/D
    const stateA = signals.filter((s) => s.macro_state === "A").length;
    const stateB = signals.filter((s) => s.macro_state === "B").length;
    const stateC = signals.filter((s) => s.macro_state === "C").length;
    const stateD = signals.filter((s) => s.macro_state === "D").length;
    return [
      { icon: <Shield className="w-4 h-4" />, label: "A 增长", value: String(stateA), sub: pct(stateA), color: "#22c55e" },
      { icon: <AlertTriangle className="w-4 h-4" />, label: "B 冲击", value: String(stateB), sub: pct(stateB), color: "#eab308" },
      { icon: <AlertTriangle className="w-4 h-4" />, label: "C 衰退", value: String(stateC), sub: pct(stateC), color: "#ef4444" },
      { icon: <TrendingUp className="w-4 h-4" />, label: "D 通胀", value: String(stateD), sub: pct(stateD), color: "#f97316" },
    ];
  }

  if (model === "equity") {
    // Equity model: show regime distribution from summary
    const regimeCounts: Record<string, number> = {};
    for (const s of signals) {
      const regime = (s.summary?.regime_code as string) ?? "TRANSITION";
      regimeCounts[regime] = (regimeCounts[regime] ?? 0) + 1;
    }
    const bull = regimeCounts["BULL"] ?? 0;
    const late = regimeCounts["LATE_CYCLE"] ?? 0;
    const bear = regimeCounts["BEAR"] ?? 0;
    const other = total - bull - late - bear;
    return [
      { icon: <TrendingUp className="w-4 h-4" />, label: "BULL", value: String(bull), sub: pct(bull), color: "#22c55e" },
      { icon: <Activity className="w-4 h-4" />, label: "LATE CYCLE", value: String(late), sub: pct(late), color: "#eab308" },
      { icon: <AlertTriangle className="w-4 h-4" />, label: "BEAR", value: String(bear), sub: pct(bear), color: "#ef4444" },
      { icon: <Shield className="w-4 h-4" />, label: "其他", value: String(other), sub: pct(other), color: "#64748b" },
    ];
  }

  if (model === "btc") {
    // BTC model: show signal distribution
    const signalCounts: Record<string, number> = {};
    for (const s of signals) {
      const sig = (s.summary?.btc_signal as string) ?? "NEUTRAL";
      signalCounts[sig] = (signalCounts[sig] ?? 0) + 1;
    }
    const long = (signalCounts["STRONG_LONG"] ?? 0) + (signalCounts["LONG"] ?? 0);
    const neutral = signalCounts["NEUTRAL"] ?? 0;
    const short = (signalCounts["STRONG_SHORT"] ?? 0) + (signalCounts["SHORT"] ?? 0);
    const hardStops = signals.filter((s) => s.hard_stop_triggered).length;
    return [
      { icon: <TrendingUp className="w-4 h-4" />, label: "做多信号", value: String(long), sub: pct(long), color: "#22c55e" },
      { icon: <Activity className="w-4 h-4" />, label: "中性信号", value: String(neutral), sub: pct(neutral), color: "#64748b" },
      { icon: <AlertTriangle className="w-4 h-4" />, label: "做空信号", value: String(short), sub: pct(short), color: "#ef4444" },
      { icon: <Shield className="w-4 h-4" />, label: "一票否决", value: String(hardStops), sub: "hard stop", color: "#f97316" },
    ];
  }

  // Default: "combined" / "liquidity" — risk light distribution
  const green = signals.filter((s) => s.risk_light === "green").length;
  const yellow = signals.filter((s) => s.risk_light === "yellow").length;
  const red = signals.filter((s) => s.risk_light === "red").length;
  const hardStops = signals.filter((s) => s.hard_stop_triggered).length;
  return [
    { icon: <Shield className="w-4 h-4" />, label: "绿灯周数", value: String(green), sub: pct(green), color: "#22c55e" },
    { icon: <AlertTriangle className="w-4 h-4" />, label: "黄灯周数", value: String(yellow), sub: pct(yellow), color: "#eab308" },
    { icon: <AlertTriangle className="w-4 h-4" />, label: "红灯周数", value: String(red), sub: pct(red), color: "#ef4444" },
    { icon: <TrendingUp className="w-4 h-4" />, label: "一票否决次数", value: String(hardStops), sub: "hard stop", color: "#f97316" },
  ];
}

// ============================================================================
// Main Component
// ============================================================================

export function BacktestPanel({
  model,
  defaultPriceSymbol,
  priceSymbols,
}: BacktestPanelProps) {
  const resolvedSymbols = priceSymbols ?? MODEL_PRICE_SYMBOLS[model] ?? MODEL_PRICE_SYMBOLS.combined;
  const resolvedDefault = defaultPriceSymbol ?? resolvedSymbols[0]?.value ?? "SPX";
  const defaults = getDefaultDates();
  const [startDate, setStartDate] = useState(defaults.start);
  const [endDate, setEndDate] = useState(defaults.end);
  const [priceSymbol, setPriceSymbol] = useState(resolvedDefault);
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<BacktestResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleRunBacktest = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await apiClient.runBacktest(startDate, endDate, priceSymbol, false, model);
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "回测失败");
    } finally {
      setIsLoading(false);
    }
  }, [startDate, endDate, priceSymbol, model]);

  // Switch asset: update state + re-run if result already exists
  const handleSymbolChange = useCallback(
    (symbol: string) => {
      setPriceSymbol(symbol);
      if (result) {
        setIsLoading(true);
        setError(null);
        apiClient
          .runBacktest(startDate, endDate, symbol, false, model)
          .then(setResult)
          .catch((err) =>
            setError(err instanceof Error ? err.message : "回测失败"),
          )
          .finally(() => setIsLoading(false));
      }
    },
    [startDate, endDate, result, model],
  );

  const applyPreset = (months: number) => {
    const end = new Date();
    const start = new Date();
    start.setMonth(start.getMonth() - months);
    setStartDate(start.toISOString().slice(0, 10));
    setEndDate(end.toISOString().slice(0, 10));
  };

  const statCards = useMemo(
    () =>
      result
        ? computeStatCards(model, result.signals, result.total_signals)
        : [],
    [result, model],
  );

  return (
    <div className="space-y-6">
      {/* Parameter Panel */}
      <div className="relative rounded-[14px] p-5 bg-[var(--bg-card)] border border-[var(--border-subtle)]">
        <div className="flex flex-wrap items-end gap-4">
          {/* Date range */}
          <div className="flex items-center gap-3">
            <div>
              <label className="block text-[10px] text-zinc-500 mb-1 uppercase tracking-wider">
                起始日期
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="bg-zinc-800/50 border border-[var(--border-subtle)] rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-zinc-600"
              />
            </div>
            <span className="text-zinc-600 pb-2">&rarr;</span>
            <div>
              <label className="block text-[10px] text-zinc-500 mb-1 uppercase tracking-wider">
                结束日期
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="bg-zinc-800/50 border border-[var(--border-subtle)] rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-zinc-600"
              />
            </div>
          </div>

          {/* Asset selector */}
          <div>
            <label className="block text-[10px] text-zinc-500 mb-1 uppercase tracking-wider">
              标的资产
            </label>
            <div className="flex gap-1.5">
              {resolvedSymbols.map((s) => (
                <button
                  key={s.value}
                  onClick={() => handleSymbolChange(s.value)}
                  className={cn(
                    "px-3 py-2 text-xs rounded-lg border transition-all",
                    priceSymbol === s.value
                      ? "bg-zinc-700/40 border-zinc-500 text-zinc-200"
                      : "bg-zinc-800/50 border-[var(--border-subtle)] text-zinc-400 hover:text-zinc-200 hover:bg-[var(--bg-card-hover)]",
                  )}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Presets */}
          <div className="flex gap-1.5">
            {PRESETS.map((p) => (
              <button
                key={p.months}
                onClick={() => applyPreset(p.months)}
                className="px-3 py-2 text-xs rounded-lg bg-zinc-800/50 border border-[var(--border-subtle)] text-zinc-400 hover:text-zinc-200 hover:bg-[var(--bg-card-hover)] transition-all"
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Run button */}
          <button
            onClick={handleRunBacktest}
            disabled={isLoading}
            className={cn(
              "px-6 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2",
              isLoading
                ? "bg-zinc-700 text-zinc-400 cursor-not-allowed"
                : "bg-zinc-200 text-zinc-900 hover:bg-zinc-300",
            )}
          >
            <RefreshCw className={cn("w-4 h-4", isLoading && "animate-spin")} />
            {isLoading ? "回测运行中..." : "运行回测"}
          </button>
        </div>

        {/* Hint text */}
        {!result && !isLoading && (
          <p className="text-[11px] text-zinc-600 mt-3">
            选择日期范围后点击运行。首次运行需要从 FRED/Yahoo
            拉取历史数据，可能需要 1-2 分钟。
          </p>
        )}

        {/* Execution info */}
        {result && (
          <div className="flex items-center gap-4 mt-3 text-[11px] text-zinc-500">
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              耗时 {(result.execution_time_ms / 1000).toFixed(1)}s
            </span>
            <span className="flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              {result.total_signals} 个信号点
            </span>
            <span className="flex items-center gap-1">
              <Activity className="w-3 h-3" />
              {result.signal_changes.length} 次信号变更
            </span>
          </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-xl p-4 bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Results */}
      {result && result.total_signals === 0 && (
        <div className="rounded-[14px] p-5 bg-amber-500/10 border border-amber-500/30 text-center">
          <p className="text-amber-400 text-sm">该日期范围内无信号数据</p>
          <p className="text-zinc-500 text-xs mt-1">请尝试扩大日期范围或检查数据源</p>
        </div>
      )}

      {result && result.total_signals > 0 && (
        <>
          {/* Stat cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {statCards.map((card) => (
              <StatCard key={card.label} {...card} />
            ))}
          </div>

          {/* Signal overlay chart */}
          <SignalOverlayChart
            priceSeries={result.price_series}
            signals={result.signals}
            signalChanges={result.signal_changes}
            priceSymbol={priceSymbol}
          />

          {/* Signal detail table */}
          <SignalDetailTable signals={result.signals} model={model} />

          {/* Signal change timeline */}
          <SignalChangeTimeline changes={result.signal_changes} />
        </>
      )}
    </div>
  );
}

// ============================================================================
// Sub-Components
// ============================================================================

function StatCard({
  icon,
  label,
  value,
  sub,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub: string;
  color: string;
}) {
  return (
    <div className="relative rounded-[14px] p-4 bg-[var(--bg-card)] border border-[var(--border-subtle)] overflow-hidden">
      <div className="flex items-center gap-2 mb-2">
        <span style={{ color }} className="opacity-70">
          {icon}
        </span>
        <span className="text-[11px] text-zinc-500">{label}</span>
      </div>
      <p className="text-2xl font-bold" style={{ color }}>
        {value}
      </p>
      <p className="text-[10px] text-zinc-600 mt-0.5">{sub}</p>
    </div>
  );
}

// ============================================================================
// Signal Change Timeline
// ============================================================================

function SignalChangeTimeline({ changes }: { changes: SignalChange[] }) {
  return (
    <div className="relative rounded-[14px] p-5 bg-[var(--bg-card)] border border-[var(--border-subtle)]">
      <h3 className="text-sm font-medium text-zinc-300 mb-4 flex items-center gap-2">
        <Activity className="w-4 h-4 text-zinc-400" />
        信号变更时间线
      </h3>

      {changes.length === 0 ? (
        <p className="text-sm text-zinc-600">无信号变更</p>
      ) : (
        <div className="space-y-0">
          {changes.map((change, i) => (
            <SignalChangeRow key={i} change={change} />
          ))}
        </div>
      )}
    </div>
  );
}

function SignalChangeRow({ change }: { change: SignalChange }) {
  const typeConfig: Record<
    string,
    { icon: React.ReactNode; color: string; bg: string }
  > = {
    risk_light: {
      icon: <Shield className="w-3 h-3" />,
      color: "text-zinc-400",
      bg: "bg-zinc-500/10",
    },
    macro_state: {
      icon: <TrendingUp className="w-3 h-3" />,
      color: "text-purple-400",
      bg: "bg-purple-500/10",
    },
    gate_closed: {
      icon: <AlertTriangle className="w-3 h-3" />,
      color: "text-red-400",
      bg: "bg-red-500/10",
    },
    gate_opened: {
      icon: <Shield className="w-3 h-3" />,
      color: "text-emerald-400",
      bg: "bg-emerald-500/10",
    },
    hard_stop: {
      icon: <AlertTriangle className="w-3 h-3" />,
      color: "text-orange-400",
      bg: "bg-orange-500/10",
    },
    regime_change: {
      icon: <TrendingUp className="w-3 h-3" />,
      color: "text-blue-400",
      bg: "bg-blue-500/10",
    },
    btc_signal_change: {
      icon: <Activity className="w-3 h-3" />,
      color: "text-orange-400",
      bg: "bg-orange-500/10",
    },
  };

  const config = typeConfig[change.type] ?? typeConfig.risk_light!;

  return (
    <div className="flex items-center gap-3 py-2 border-b border-[var(--border-subtle)] last:border-b-0">
      <span className="text-[11px] text-zinc-600 font-mono w-24 shrink-0">
        {change.date}
      </span>
      <span className={cn("p-1 rounded", config!.bg, config!.color)}>
        {config!.icon}
      </span>
      <span className="text-[11px] text-zinc-300">{change.description}</span>
    </div>
  );
}

// ============================================================================
// Signal Detail Table (model-aware columns)
// ============================================================================

function SignalDetailTable({
  signals,
  model,
}: {
  signals: BacktestSignal[];
  model: BacktestModelType;
}) {
  const [expanded, setExpanded] = useState(false);

  const reversed = [...signals].reverse();
  const displayed = expanded ? reversed : reversed.slice(0, 10);

  return (
    <div className="relative rounded-[14px] p-5 bg-[var(--bg-card)] border border-[var(--border-subtle)]">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-zinc-300 flex items-center gap-2">
          <Activity className="w-4 h-4 text-zinc-400" />
          信号明细表
          <span className="text-[10px] text-zinc-600">（每周五）</span>
        </h3>
        {signals.length > 10 && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-[11px] text-zinc-400 hover:text-zinc-300 transition-colors flex items-center gap-1"
          >
            {expanded ? (
              <>
                收起 <ChevronUp className="w-3 h-3" />
              </>
            ) : (
              <>
                展开全部 ({signals.length}) <ChevronDown className="w-3 h-3" />
              </>
            )}
          </button>
        )}
      </div>

      <div className="overflow-x-auto">
        {model === "macro" ? (
          <MacroDetailTable signals={displayed} />
        ) : model === "equity" ? (
          <EquityDetailTable signals={displayed} />
        ) : model === "btc" ? (
          <BtcDetailTable signals={displayed} />
        ) : (
          <CombinedDetailTable signals={displayed} />
        )}
      </div>
    </div>
  );
}

/** Combined / Liquidity detail table (original layout) */
function CombinedDetailTable({ signals }: { signals: BacktestSignal[] }) {
  return (
    <table className="w-full text-[11px]">
      <thead>
        <tr className="border-b border-zinc-800">
          <th className="text-left py-2 px-2 text-zinc-500 font-medium">日期</th>
          <th className="text-center py-2 px-2 text-zinc-500 font-medium">灯号</th>
          <th className="text-right py-2 px-2 text-zinc-500 font-medium">评分</th>
          <th className="text-right py-2 px-2 text-zinc-500 font-medium">杠杆</th>
          <th className="text-center py-2 px-2 text-zinc-500 font-medium">宏观</th>
          <th className="text-right py-2 px-2 text-zinc-500 font-medium">MOVE</th>
          <th className="text-right py-2 px-2 text-zinc-500 font-medium">SOFR-IORB</th>
          <th className="text-right py-2 px-2 text-zinc-500 font-medium">Corr 20D</th>
          <th className="text-right py-2 px-2 text-zinc-500 font-medium">HY OAS</th>
          <th className="text-right py-2 px-2 text-zinc-500 font-medium">2s10s</th>
          <th className="text-center py-2 px-2 text-zinc-500 font-medium">否决</th>
          <th className="text-center py-2 px-2 text-zinc-500 font-medium">纠错</th>
          <th className="text-left py-2 px-2 text-zinc-500 font-medium">闸门</th>
          <th className="text-left py-2 px-2 text-zinc-500 font-medium">禁止策略</th>
        </tr>
      </thead>
      <tbody>
        {signals.map((s, i) => {
          const macroStyle = MACRO_STATE_STYLE[s.macro_state];
          return (
            <tr
              key={s.date}
              className={cn(
                "border-b border-zinc-800/30 hover:bg-zinc-800/20 transition-colors",
                i === 0 && "bg-zinc-800/10",
              )}
            >
              <td className="py-2 px-2 text-zinc-400 font-mono">{s.date}</td>
              <td className="py-2 px-2 text-center">
                {RISK_LIGHT_EMOJI[s.risk_light] ?? "⚪"}
              </td>
              <td className="py-2 px-2 text-right font-mono">
                <span
                  className={cn(
                    "font-medium",
                    s.liquidity_score >= 70
                      ? "text-emerald-400"
                      : s.liquidity_score >= 40
                        ? "text-amber-400"
                        : "text-red-400",
                  )}
                >
                  {s.liquidity_score.toFixed(0)}
                </span>
              </td>
              <td className="py-2 px-2 text-right font-mono text-zinc-300">
                {s.leverage_coef}x
              </td>
              <td className="py-2 px-2 text-center">
                <span className={cn("font-medium", macroStyle?.color ?? "text-zinc-500")}>
                  {macroStyle?.label ?? s.macro_state}
                </span>
              </td>
              <td className="py-2 px-2 text-right font-mono text-zinc-400">
                {s.key_metrics.move != null ? s.key_metrics.move.toFixed(1) : "—"}
              </td>
              <td className="py-2 px-2 text-right font-mono">
                <span
                  className={cn(
                    s.key_metrics.sofr_iorb != null && s.key_metrics.sofr_iorb > 5
                      ? "text-red-400"
                      : s.key_metrics.sofr_iorb != null && s.key_metrics.sofr_iorb > 3
                        ? "text-amber-400"
                        : "text-zinc-400",
                  )}
                >
                  {s.key_metrics.sofr_iorb != null
                    ? `${s.key_metrics.sofr_iorb.toFixed(1)}bp`
                    : "—"}
                </span>
              </td>
              <td className="py-2 px-2 text-right font-mono">
                <span
                  className={cn(
                    s.key_metrics.corr_20d != null && s.key_metrics.corr_20d > 0.3
                      ? "text-emerald-400"
                      : s.key_metrics.corr_20d != null && s.key_metrics.corr_20d < -0.3
                        ? "text-red-400"
                        : "text-zinc-400",
                  )}
                >
                  {s.key_metrics.corr_20d != null
                    ? s.key_metrics.corr_20d.toFixed(2)
                    : "—"}
                </span>
              </td>
              <td className="py-2 px-2 text-right font-mono text-zinc-400">
                {s.key_metrics.hy_oas != null ? s.key_metrics.hy_oas.toFixed(0) : "—"}
              </td>
              <td className="py-2 px-2 text-right font-mono text-zinc-400">
                {s.key_metrics.yield_curve_2s10s != null
                  ? `${s.key_metrics.yield_curve_2s10s.toFixed(0)}bp`
                  : "—"}
              </td>
              <td className="py-2 px-2 text-center">
                {s.hard_stop_triggered ? (
                  <span className="text-red-400 font-bold">!</span>
                ) : (
                  <span className="text-zinc-700">—</span>
                )}
              </td>
              <td className="py-2 px-2 text-center">
                {s.correction_level !== "NONE" ? (
                  <span
                    className={cn(
                      "px-1.5 py-0.5 rounded text-[10px] font-medium",
                      s.correction_level === "C"
                        ? "bg-red-500/20 text-red-400"
                        : s.correction_level === "B"
                          ? "bg-amber-500/20 text-amber-400"
                          : "bg-zinc-500/20 text-zinc-400",
                    )}
                  >
                    {s.correction_level}档
                  </span>
                ) : (
                  <span className="text-zinc-700">—</span>
                )}
              </td>
              <td className="py-2 px-2">
                {s.gates_closed.length > 0 ? (
                  <span className="text-red-400 text-[10px]">
                    {s.gates_closed.join(", ")}
                  </span>
                ) : (
                  <span className="text-zinc-700">—</span>
                )}
              </td>
              <td className="py-2 px-2">
                {s.forbidden_strategies.length > 0 ? (
                  <span className="text-amber-400 text-[10px]">
                    {s.forbidden_strategies.join(", ")}
                  </span>
                ) : (
                  <span className="text-zinc-700">—</span>
                )}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

/** Macro model detail table */
function MacroDetailTable({ signals }: { signals: BacktestSignal[] }) {
  return (
    <table className="w-full text-[11px]">
      <thead>
        <tr className="border-b border-zinc-800">
          <th className="text-left py-2 px-2 text-zinc-500 font-medium">日期</th>
          <th className="text-center py-2 px-2 text-zinc-500 font-medium">宏观状态</th>
          <th className="text-center py-2 px-2 text-zinc-500 font-medium">灯号</th>
          <th className="text-right py-2 px-2 text-zinc-500 font-medium">Corr 20D</th>
          <th className="text-right py-2 px-2 text-zinc-500 font-medium">Corr 60D</th>
          <th className="text-right py-2 px-2 text-zinc-500 font-medium">2s10s</th>
          <th className="text-right py-2 px-2 text-zinc-500 font-medium">HY OAS</th>
          <th className="text-center py-2 px-2 text-zinc-500 font-medium">纠错</th>
          <th className="text-left py-2 px-2 text-zinc-500 font-medium">闸门</th>
        </tr>
      </thead>
      <tbody>
        {signals.map((s, i) => {
          const macroStyle = MACRO_STATE_STYLE[s.macro_state];
          return (
            <tr
              key={s.date}
              className={cn(
                "border-b border-zinc-800/30 hover:bg-zinc-800/20 transition-colors",
                i === 0 && "bg-zinc-800/10",
              )}
            >
              <td className="py-2 px-2 text-zinc-400 font-mono">{s.date}</td>
              <td className="py-2 px-2 text-center">
                <span className={cn("font-medium", macroStyle?.color ?? "text-zinc-500")}>
                  {macroStyle?.label ?? s.macro_state}
                </span>
              </td>
              <td className="py-2 px-2 text-center">
                {RISK_LIGHT_EMOJI[s.risk_light] ?? "⚪"}
              </td>
              <td className="py-2 px-2 text-right font-mono">
                <span
                  className={cn(
                    s.key_metrics.corr_20d != null && s.key_metrics.corr_20d > 0.3
                      ? "text-emerald-400"
                      : s.key_metrics.corr_20d != null && s.key_metrics.corr_20d < -0.3
                        ? "text-red-400"
                        : "text-zinc-400",
                  )}
                >
                  {s.key_metrics.corr_20d != null ? s.key_metrics.corr_20d.toFixed(2) : "—"}
                </span>
              </td>
              <td className="py-2 px-2 text-right font-mono">
                <span
                  className={cn(
                    s.key_metrics.corr_60d != null && s.key_metrics.corr_60d > 0.3
                      ? "text-emerald-400"
                      : s.key_metrics.corr_60d != null && s.key_metrics.corr_60d < -0.3
                        ? "text-red-400"
                        : "text-zinc-400",
                  )}
                >
                  {s.key_metrics.corr_60d != null ? s.key_metrics.corr_60d.toFixed(2) : "—"}
                </span>
              </td>
              <td className="py-2 px-2 text-right font-mono text-zinc-400">
                {s.key_metrics.yield_curve_2s10s != null
                  ? `${s.key_metrics.yield_curve_2s10s.toFixed(0)}bp`
                  : "—"}
              </td>
              <td className="py-2 px-2 text-right font-mono text-zinc-400">
                {s.key_metrics.hy_oas != null ? s.key_metrics.hy_oas.toFixed(0) : "—"}
              </td>
              <td className="py-2 px-2 text-center">
                {s.correction_level !== "NONE" ? (
                  <span
                    className={cn(
                      "px-1.5 py-0.5 rounded text-[10px] font-medium",
                      s.correction_level === "C"
                        ? "bg-red-500/20 text-red-400"
                        : s.correction_level === "B"
                          ? "bg-amber-500/20 text-amber-400"
                          : "bg-zinc-500/20 text-zinc-400",
                    )}
                  >
                    {s.correction_level}档
                  </span>
                ) : (
                  <span className="text-zinc-700">—</span>
                )}
              </td>
              <td className="py-2 px-2">
                {s.gates_closed.length > 0 ? (
                  <span className="text-red-400 text-[10px]">
                    {s.gates_closed.join(", ")}
                  </span>
                ) : (
                  <span className="text-zinc-700">—</span>
                )}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

/** Equity model detail table */
function EquityDetailTable({ signals }: { signals: BacktestSignal[] }) {
  return (
    <table className="w-full text-[11px]">
      <thead>
        <tr className="border-b border-zinc-800">
          <th className="text-left py-2 px-2 text-zinc-500 font-medium">日期</th>
          <th className="text-center py-2 px-2 text-zinc-500 font-medium">灯号</th>
          <th className="text-center py-2 px-2 text-zinc-500 font-medium">体制</th>
          <th className="text-right py-2 px-2 text-zinc-500 font-medium">综合评分</th>
          <th className="text-right py-2 px-2 text-zinc-500 font-medium">股票%</th>
          <th className="text-right py-2 px-2 text-zinc-500 font-medium">债券%</th>
          <th className="text-right py-2 px-2 text-zinc-500 font-medium">现金%</th>
          <th className="text-right py-2 px-2 text-zinc-500 font-medium">回撤</th>
          <th className="text-center py-2 px-2 text-zinc-500 font-medium">否决</th>
        </tr>
      </thead>
      <tbody>
        {signals.map((s, i) => {
          const regime = (s.summary?.regime_code as string) ?? "—";
          const score = s.summary?.weighted_score as number | undefined;
          const eqPct = s.summary?.equity_pct as number | undefined;
          const bondPct = s.summary?.bond_pct as number | undefined;
          const cashPct = s.summary?.cash_pct as number | undefined;
          const ddPct = s.summary?.drawdown_pct as number | undefined;

          return (
            <tr
              key={s.date}
              className={cn(
                "border-b border-zinc-800/30 hover:bg-zinc-800/20 transition-colors",
                i === 0 && "bg-zinc-800/10",
              )}
            >
              <td className="py-2 px-2 text-zinc-400 font-mono">{s.date}</td>
              <td className="py-2 px-2 text-center">
                {RISK_LIGHT_EMOJI[s.risk_light] ?? "⚪"}
              </td>
              <td className="py-2 px-2 text-center">
                <span
                  className={cn(
                    "px-1.5 py-0.5 rounded text-[10px] font-medium",
                    regime === "BULL"
                      ? "bg-emerald-500/20 text-emerald-400"
                      : regime === "BEAR"
                        ? "bg-red-500/20 text-red-400"
                        : regime === "LATE_CYCLE"
                          ? "bg-amber-500/20 text-amber-400"
                          : "bg-zinc-500/20 text-zinc-400",
                  )}
                >
                  {regime}
                </span>
              </td>
              <td className="py-2 px-2 text-right font-mono text-zinc-300">
                {score != null ? score.toFixed(0) : "—"}
              </td>
              <td className="py-2 px-2 text-right font-mono text-zinc-300">
                {eqPct != null ? `${eqPct}%` : "—"}
              </td>
              <td className="py-2 px-2 text-right font-mono text-zinc-300">
                {bondPct != null ? `${bondPct}%` : "—"}
              </td>
              <td className="py-2 px-2 text-right font-mono text-zinc-300">
                {cashPct != null ? `${cashPct}%` : "—"}
              </td>
              <td className="py-2 px-2 text-right font-mono">
                <span
                  className={cn(
                    ddPct != null && ddPct > 10
                      ? "text-red-400"
                      : ddPct != null && ddPct > 5
                        ? "text-amber-400"
                        : "text-zinc-400",
                  )}
                >
                  {ddPct != null ? `${ddPct.toFixed(1)}%` : "—"}
                </span>
              </td>
              <td className="py-2 px-2 text-center">
                {s.hard_stop_triggered ? (
                  <span className="text-red-400 font-bold">!</span>
                ) : (
                  <span className="text-zinc-700">—</span>
                )}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

/** BTC model detail table */
function BtcDetailTable({ signals }: { signals: BacktestSignal[] }) {
  return (
    <table className="w-full text-[11px]">
      <thead>
        <tr className="border-b border-zinc-800">
          <th className="text-left py-2 px-2 text-zinc-500 font-medium">日期</th>
          <th className="text-center py-2 px-2 text-zinc-500 font-medium">灯号</th>
          <th className="text-center py-2 px-2 text-zinc-500 font-medium">BTC 信号</th>
          <th className="text-center py-2 px-2 text-zinc-500 font-medium">置信度</th>
          <th className="text-right py-2 px-2 text-zinc-500 font-medium">多头模式</th>
          <th className="text-right py-2 px-2 text-zinc-500 font-medium">空头模式</th>
          <th className="text-center py-2 px-2 text-zinc-500 font-medium">共振</th>
          <th className="text-center py-2 px-2 text-zinc-500 font-medium">否决</th>
        </tr>
      </thead>
      <tbody>
        {signals.map((s, i) => {
          const btcSignal = (s.summary?.btc_signal as string) ?? "—";
          const confidence = (s.summary?.signal_confidence as string) ?? "—";
          const bullCount = (s.summary?.bull_count as number) ?? 0;
          const bearCount = (s.summary?.bear_count as number) ?? 0;
          const resonance = (s.summary?.resonance_type as string) ?? null;

          return (
            <tr
              key={s.date}
              className={cn(
                "border-b border-zinc-800/30 hover:bg-zinc-800/20 transition-colors",
                i === 0 && "bg-zinc-800/10",
              )}
            >
              <td className="py-2 px-2 text-zinc-400 font-mono">{s.date}</td>
              <td className="py-2 px-2 text-center">
                {RISK_LIGHT_EMOJI[s.risk_light] ?? "⚪"}
              </td>
              <td className="py-2 px-2 text-center">
                <span
                  className={cn(
                    "px-1.5 py-0.5 rounded text-[10px] font-medium",
                    btcSignal.includes("LONG")
                      ? "bg-emerald-500/20 text-emerald-400"
                      : btcSignal.includes("SHORT")
                        ? "bg-red-500/20 text-red-400"
                        : "bg-zinc-500/20 text-zinc-400",
                  )}
                >
                  {btcSignal}
                </span>
              </td>
              <td className="py-2 px-2 text-center">
                <span
                  className={cn(
                    "text-[10px] font-medium",
                    confidence === "HIGH"
                      ? "text-emerald-400"
                      : confidence === "MEDIUM"
                        ? "text-amber-400"
                        : "text-zinc-500",
                  )}
                >
                  {confidence}
                </span>
              </td>
              <td className="py-2 px-2 text-right font-mono text-emerald-400">
                {bullCount}
              </td>
              <td className="py-2 px-2 text-right font-mono text-red-400">
                {bearCount}
              </td>
              <td className="py-2 px-2 text-center">
                {resonance ? (
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-purple-500/20 text-purple-400">
                    {resonance}
                  </span>
                ) : (
                  <span className="text-zinc-700">—</span>
                )}
              </td>
              <td className="py-2 px-2 text-center">
                {s.hard_stop_triggered ? (
                  <span className="text-red-400 font-bold">!</span>
                ) : (
                  <span className="text-zinc-700">—</span>
                )}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
