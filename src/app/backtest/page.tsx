/**
 * [INPUT]: 用户选择日期范围，触发回测 API 请求。
 * [OUTPUT]: (<div>) - 回测页面：参数面板 + 信号叠加图 + 信号变更时间线 + 统计卡片。
 * [POS]: 位于 /app/backtest，回测功能的主页面入口。
 *
 * [PROTOCOL]:
 * 1. 一旦本文件逻辑变更，必须同步更新此 Header。
 * 2. 更新后必须上浮检查 /src/app/.folder.md 的描述是否依然准确。
 */
"use client";

import { useState, useCallback } from "react";
import { RefreshCw, Calendar, Clock, AlertTriangle, TrendingUp, Shield, Activity } from "lucide-react";
import { SignalOverlayChart } from "@/components/SignalOverlayChart";
import apiClient from "@/lib/api";
import type { BacktestResult, BacktestSignal, SignalChange } from "@/types/api";
import { cn } from "@/lib/utils";

// 默认回测范围：过去 1 年
function getDefaultDates() {
  const end = new Date();
  const start = new Date();
  start.setFullYear(start.getFullYear() - 1);
  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
  };
}

export default function BacktestPage() {
  const defaults = getDefaultDates();
  const [startDate, setStartDate] = useState(defaults.start);
  const [endDate, setEndDate] = useState(defaults.end);
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<BacktestResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleRunBacktest = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await apiClient.runBacktest(startDate, endDate);
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "回测失败");
    } finally {
      setIsLoading(false);
    }
  }, [startDate, endDate]);

  // 预设时间范围快捷键
  const presets = [
    { label: "6个月", months: 6 },
    { label: "1年", months: 12 },
    { label: "2年", months: 24 },
    { label: "3年", months: 36 },
  ];

  const applyPreset = (months: number) => {
    const end = new Date();
    const start = new Date();
    start.setMonth(start.getMonth() - months);
    setStartDate(start.toISOString().slice(0, 10));
    setEndDate(end.toISOString().slice(0, 10));
  };

  return (
    <div className="min-h-screen p-6 space-y-6">
      {/* 页面标题 */}
      <div>
        <h1 className="text-2xl font-bold text-zinc-100">信号回测</h1>
        <p className="text-sm text-zinc-500 mt-1">
          历史信号叠加 — 查看模型在每个关键时刻的判断
        </p>
      </div>

      {/* 参数面板 */}
      <div className="relative rounded-2xl p-5 bg-gradient-to-br from-zinc-900/80 to-zinc-950/80 border border-zinc-800/50 backdrop-blur-xl">
        <div className="absolute top-0 left-0 right-0 h-0.5 opacity-50 bg-gradient-to-r from-transparent via-violet-400 to-transparent" />

        <div className="flex flex-wrap items-end gap-4">
          {/* 日期范围 */}
          <div className="flex items-center gap-3">
            <div>
              <label className="block text-[10px] text-zinc-500 mb-1 uppercase tracking-wider">
                起始日期
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="bg-zinc-800/50 border border-zinc-700/50 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-cyan-500/50"
              />
            </div>
            <span className="text-zinc-600 pb-2">→</span>
            <div>
              <label className="block text-[10px] text-zinc-500 mb-1 uppercase tracking-wider">
                结束日期
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="bg-zinc-800/50 border border-zinc-700/50 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-cyan-500/50"
              />
            </div>
          </div>

          {/* 预设快捷键 */}
          <div className="flex gap-1.5">
            {presets.map((p) => (
              <button
                key={p.months}
                onClick={() => applyPreset(p.months)}
                className="px-3 py-2 text-xs rounded-lg bg-zinc-800/50 border border-zinc-700/50 text-zinc-400 hover:text-zinc-200 hover:border-zinc-600 transition-all"
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* 运行按钮 */}
          <button
            onClick={handleRunBacktest}
            disabled={isLoading}
            className={cn(
              "px-6 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2",
              isLoading
                ? "bg-zinc-700 text-zinc-400 cursor-not-allowed"
                : "bg-gradient-to-r from-cyan-500 to-blue-500 text-white hover:from-cyan-400 hover:to-blue-400 shadow-lg shadow-cyan-500/20"
            )}
          >
            <RefreshCw
              className={cn("w-4 h-4", isLoading && "animate-spin")}
            />
            {isLoading ? "回测运行中..." : "运行回测"}
          </button>
        </div>

        {/* 提示 */}
        {!result && !isLoading && (
          <p className="text-[11px] text-zinc-600 mt-3">
            选择日期范围后点击运行。首次运行需要从 FRED/Yahoo
            拉取历史数据，可能需要 1-2 分钟。
          </p>
        )}

        {/* 执行信息 */}
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

      {/* 错误提示 */}
      {error && (
        <div className="rounded-xl p-4 bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* 结果区域 */}
      {result && (
        <>
          {/* 统计卡片 */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard
              icon={<Shield className="w-4 h-4" />}
              label="绿灯周数"
              value={String(
                result.signals.filter((s) => s.risk_light === "green").length
              )}
              sub={`${((result.signals.filter((s) => s.risk_light === "green").length / result.total_signals) * 100).toFixed(0)}%`}
              color="#22c55e"
            />
            <StatCard
              icon={<AlertTriangle className="w-4 h-4" />}
              label="黄灯周数"
              value={String(
                result.signals.filter((s) => s.risk_light === "yellow").length
              )}
              sub={`${((result.signals.filter((s) => s.risk_light === "yellow").length / result.total_signals) * 100).toFixed(0)}%`}
              color="#eab308"
            />
            <StatCard
              icon={<AlertTriangle className="w-4 h-4" />}
              label="红灯周数"
              value={String(
                result.signals.filter((s) => s.risk_light === "red").length
              )}
              sub={`${((result.signals.filter((s) => s.risk_light === "red").length / result.total_signals) * 100).toFixed(0)}%`}
              color="#ef4444"
            />
            <StatCard
              icon={<TrendingUp className="w-4 h-4" />}
              label="一票否决次数"
              value={String(
                result.signals.filter((s) => s.hard_stop_triggered).length
              )}
              sub="hard stop"
              color="#f97316"
            />
          </div>

          {/* 信号叠加图 */}
          <SignalOverlayChart
            priceSeries={result.price_series}
            signals={result.signals}
            signalChanges={result.signal_changes}
          />

          {/* 信号明细表 */}
          <SignalDetailTable signals={result.signals} />

          {/* 信号变更时间线 */}
          <div className="relative rounded-2xl p-5 bg-gradient-to-br from-zinc-900/80 to-zinc-950/80 border border-zinc-800/50 backdrop-blur-xl">
            <div className="absolute top-0 left-0 right-0 h-0.5 opacity-50 bg-gradient-to-r from-transparent via-amber-400 to-transparent" />

            <h3 className="text-sm font-medium text-zinc-300 mb-4 flex items-center gap-2">
              <Activity className="w-4 h-4 text-amber-400" />
              信号变更时间线
            </h3>

            {result.signal_changes.length === 0 ? (
              <p className="text-sm text-zinc-600">无信号变更</p>
            ) : (
              <div className="space-y-0">
                {result.signal_changes.map((change, i) => (
                  <SignalChangeRow key={i} change={change} />
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

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
    <div className="relative rounded-xl p-4 bg-gradient-to-br from-zinc-900/80 to-zinc-950/80 border border-zinc-800/50 backdrop-blur-xl overflow-hidden">
      <div
        className="absolute top-0 left-0 right-0 h-0.5 opacity-60"
        style={{
          background: `linear-gradient(90deg, transparent, ${color}, transparent)`,
        }}
      />
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

function SignalChangeRow({ change }: { change: SignalChange }) {
  const typeConfig: Record<
    string,
    { icon: React.ReactNode; color: string; bg: string }
  > = {
    risk_light: {
      icon: <Shield className="w-3 h-3" />,
      color: "text-cyan-400",
      bg: "bg-cyan-500/10",
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
  };

  const config = typeConfig[change.type] ?? typeConfig.risk_light!;

  return (
    <div className="flex items-center gap-3 py-2 border-b border-zinc-800/50 last:border-b-0">
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
// 信号明细表 — 展示每周的完整信号数据
// ============================================================================

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

function SignalDetailTable({ signals }: { signals: BacktestSignal[] }) {
  const [expanded, setExpanded] = useState(false);

  // 默认显示最近 10 条，展开后全部显示（最新在前）
  const reversed = [...signals].reverse();
  const displayed = expanded ? reversed : reversed.slice(0, 10);

  return (
    <div className="relative rounded-2xl p-5 bg-gradient-to-br from-zinc-900/80 to-zinc-950/80 border border-zinc-800/50 backdrop-blur-xl">
      <div className="absolute top-0 left-0 right-0 h-0.5 opacity-50 bg-gradient-to-r from-transparent via-cyan-400 to-transparent" />

      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-zinc-300 flex items-center gap-2">
          <Activity className="w-4 h-4 text-cyan-400" />
          信号明细表
          <span className="text-[10px] text-zinc-600">（每周五）</span>
        </h3>
        {signals.length > 10 && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-[11px] text-cyan-400 hover:text-cyan-300 transition-colors"
          >
            {expanded ? "收起" : `展开全部 (${signals.length})`}
          </button>
        )}
      </div>

      <div className="overflow-x-auto">
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
            {displayed.map((s, i) => {
              const macroStyle = MACRO_STATE_STYLE[s.macro_state];
              return (
                <tr
                  key={s.date}
                  className={cn(
                    "border-b border-zinc-800/30 hover:bg-zinc-800/20 transition-colors",
                    i === 0 && "bg-zinc-800/10"
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
                            : "text-red-400"
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
                            : "text-zinc-400"
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
                            : "text-zinc-400"
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
                              : "bg-cyan-500/20 text-cyan-400"
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
      </div>
    </div>
  );
}
