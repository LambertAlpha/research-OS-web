/**
 * [INPUT]: 页面加载时自动获取最新 BTC 模型输出，用户可点击"运行模型"刷新。
 * [OUTPUT]: (JSX) - BTC 中期模型详情页，含最终信号、指标状态热力图、触发模式、共振/抵销验证、操作建议。
 * [POS]: BTC 路由 (/btc)。展示 BTC v8.0 模式识别架构的五层输出，通过 /api/btc 获取数据。
 *
 * [PROTOCOL]:
 * 1. 一旦本文件逻辑变更，必须同步更新此 Header。
 * 2. 更新后必须上浮检查 /src/app/btc/.folder.md 的描述是否依然准确。
 */
"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { Header } from "@/components/Header";
import { IndicatorDictionary } from "@/components/IndicatorDictionary";
import { BacktestPanel } from "@/components/BacktestPanel";
import apiClient from "@/lib/api";

import type { BtcOutput, HistoryRecord } from "@/types/api";
import {
  Bitcoin,
  Target,
  Layers,
  ShieldCheck,
  ShieldAlert,
  FileText,
  RefreshCw,
  ArrowUpCircle,
  ArrowDownCircle,
  MinusCircle,
  Zap,
  Eye,
  AlertTriangle,
} from "lucide-react";

// ============================================================================
// 常量映射
// ============================================================================

const SIGNAL_CONFIG: Record<string, { color: string; label: string; emoji: string }> = {
  STRONG_LONG: { color: "#10b981", label: "强烈做多", emoji: "🟢🟢" },
  LONG: { color: "#10b981", label: "做多", emoji: "🟢" },
  NEUTRAL: { color: "#6b7280", label: "观望", emoji: "⚪" },
  SHORT: { color: "#f59e0b", label: "做空/减仓", emoji: "🔴" },
  STRONG_SHORT: { color: "#ef4444", label: "强烈做空", emoji: "🔴🔴" },
};

const CONFIDENCE_COLOR: Record<string, string> = {
  HIGH: "#10b981",
  MEDIUM: "#f59e0b",
  LOW: "#6b7280",
};

const STATE_CONFIG: Record<string, { color: string; label: string; icon: typeof ArrowUpCircle }> = {
  accumulation: { color: "#10b981", label: "累积", icon: ArrowUpCircle },
  neutral: { color: "#6b7280", label: "中性", icon: MinusCircle },
  distribution: { color: "#ef4444", label: "释放", icon: ArrowDownCircle },
};

const INDICATOR_GROUPS: Record<string, { title: string; color: string; ids: string[] }> = {
  A: {
    title: "资金流与分布",
    color: "#a1a1aa",
    ids: ["A1_ETF_FLOW", "A2_COINBASE_BAL", "A3_EXCHANGE_NETFLOW", "A4_WHALE_EXCHANGE", "A5_REALIZED_CAP_CHANGE", "A6_TREND_ACCUM_SCORE"],
  },
  B: {
    title: "估值与风险",
    color: "#a1a1aa",
    ids: ["B1_REALIZED_PROFIT", "B2_STH_COST_MVRV", "B3_LTH_MVRV_SLOPE", "B4_SUPPLY_IN_PROFIT", "B5_SELL_SIDE_RISK"],
  },
  C: {
    title: "供给结构",
    color: "#a1a1aa",
    ids: ["C1_URPD_ENTITY", "C2_LTH_STH_RATIO", "C3_LTH_NET_POSITION", "C4_SUPPLY_BEHAVIOR"],
  },
  D: {
    title: "衍生品",
    color: "#a1a1aa",
    ids: ["D1_OI_LIQUIDATION", "D2_FUNDING_RATE", "D3_FUTURES_SPOT_CVD", "D4_PERP_SPOT_GAP", "D5_OPTIONS_PC_SKEW"],
  },
};

// ETF 可靠性分级（V8.0 核心创新）
const INDICATOR_RELIABILITY: Record<string, string> = {
  A1_ETF_FLOW: "★★★", A2_COINBASE_BAL: "★★★", A3_EXCHANGE_NETFLOW: "★★",
  A4_WHALE_EXCHANGE: "★★★", A5_REALIZED_CAP_CHANGE: "★★", A6_TREND_ACCUM_SCORE: "★★★",
  B1_REALIZED_PROFIT: "★★", B2_STH_COST_MVRV: "★★", B3_LTH_MVRV_SLOPE: "★★",
  B4_SUPPLY_IN_PROFIT: "★★", B5_SELL_SIDE_RISK: "★★★",
  C1_URPD_ENTITY: "★★", C2_LTH_STH_RATIO: "★★", C3_LTH_NET_POSITION: "★★",
  C4_SUPPLY_BEHAVIOR: "★★★",
  D1_OI_LIQUIDATION: "★★", D2_FUNDING_RATE: "★", D3_FUTURES_SPOT_CVD: "★★★",
  D4_PERP_SPOT_GAP: "★", D5_OPTIONS_PC_SKEW: "★★",
};

// ETF 时代需反向解读的指标
const ETF_REINTERPRET: Record<string, string> = {
  D4_PERP_SPOT_GAP: "ETF 时代反向解读：负价差+上涨=健康（现货买盘主导）",
  D2_FUNDING_RATE: "ETF 时代反向解读：负费率+上涨=行情未过热",
};

const INDICATOR_NAMES: Record<string, string> = {
  A1_ETF_FLOW: "ETF 净流入",
  A2_COINBASE_BAL: "Coinbase 余额",
  A3_EXCHANGE_NETFLOW: "交易所净流动",
  A4_WHALE_EXCHANGE: "主力转入交易所",
  A5_REALIZED_CAP_CHANGE: "已实现市值变化",
  A6_TREND_ACCUM_SCORE: "趋势累积分数",
  B1_REALIZED_PROFIT: "已实现利润",
  B2_STH_COST_MVRV: "短期 MVRV",
  B3_LTH_MVRV_SLOPE: "长期 MVRV 斜率",
  B4_SUPPLY_IN_PROFIT: "盈利供应比例",
  B5_SELL_SIDE_RISK: "卖方风险比率",
  C1_URPD_ENTITY: "成本分布 (URPD)",
  C2_LTH_STH_RATIO: "长短期供应比",
  C3_LTH_NET_POSITION: "LTH 净仓位变化",
  C4_SUPPLY_BEHAVIOR: "投资者行为供应",
  D1_OI_LIQUIDATION: "OI+清算结构",
  D2_FUNDING_RATE: "资金费率",
  D3_FUTURES_SPOT_CVD: "期现 CVD",
  D4_PERP_SPOT_GAP: "永续-现货价差",
  D5_OPTIONS_PC_SKEW: "期权 P/C+Skew",
};

const PATTERN_NAMES: Record<string, { emoji: string; desc: string }> = {
  P1_INSTITUTIONAL_ACCUMULATION: { emoji: "🏦", desc: "机构资金透过 ETF+Custody 同步吸筹" },
  P2_ETF_DELAYED_ACCUMULATION: { emoji: "⏳", desc: "OTC/Custody 吸筹但价格尚未反映" },
  P3_SMART_MONEY_DISTRIBUTION: { emoji: "🐋", desc: "主力大量转入交易所+获利了结" },
  P4_SQUEEZE_IGNITION: { emoji: "🚀", desc: "空头回补引爆 → 多头接力建仓" },
  P5_CHIP_STABILITY: { emoji: "🧱", desc: "筹码稳定+波动性蓄势" },
  P6_RETAIL_FOMO: { emoji: "🔥", desc: "散户杠杆追多+全市场浮盈" },
  P7_CAPITULATION_BOTTOM: { emoji: "💀", desc: "大规模亏损+投降卖出+价格触及支撑" },
  P8_STRUCTURAL_NEUTRALITY: { emoji: "⚖️", desc: "信号分化/互相矛盾" },
};

// ============================================================================
// 页面组件
// ============================================================================

export default function BtcPage() {
  const [isRunning, setIsRunning] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [btcOutput, setBtcOutput] = useState<BtcOutput | null>(null);
  const [availableDates, setAvailableDates] = useState<string[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | undefined>();
  const historyRecords = useRef<HistoryRecord[]>([]);

  useEffect(() => {
    const loadLatest = async () => {
      try {
        const [output, history] = await Promise.all([
          apiClient.getBtcOutput(),
          apiClient
            .getHistory(365)
            .catch(() => ({ records: [] as HistoryRecord[], total: 0, days: 365 })),
        ]);
        setBtcOutput(output);
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
        console.error("[btc] Failed to load:", err);
      } finally {
        setIsLoading(false);
      }
    };
    loadLatest();
  }, []);

  const handleDateSelect = useCallback(async (date: string) => {
    setSelectedDate(date);
    setIsLoading(true);
    try {
      const output = await apiClient.getBtcOutput();
      if (output) setBtcOutput(output);
    } catch (error) {
      console.error("Failed to load BTC output:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleRunModel = useCallback(async (date?: string) => {
    setIsRunning(true);
    try {
      await apiClient.runModel(date);
      const output = await apiClient.getBtcOutput();
      if (output) setBtcOutput(output);
      if (output?.data_ts) setSelectedDate(output.data_ts.substring(0, 10));
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

  const signal = btcOutput?.signal || "NEUTRAL";
  const signalCfg = SIGNAL_CONFIG[signal] ?? SIGNAL_CONFIG["NEUTRAL"]!;
  const confidence = btcOutput?.signal_confidence || "LOW";
  const indicatorStates = btcOutput?.indicator_states || {};
  const patterns = btcOutput?.triggered_patterns || [];
  const validation = btcOutput?.validation;

  // 统计
  const totalIndicators = Object.keys(indicatorStates).length;
  const accCount = Object.values(indicatorStates).filter((s) => s === "accumulation").length;
  const distCount = Object.values(indicatorStates).filter((s) => s === "distribution").length;
  const neuCount = totalIndicators - accCount - distCount;
  const allNeutral = totalIndicators > 0 && accCount === 0 && distCount === 0;

  return (
    <div className="min-h-screen">
      <Header
        onRunModel={handleRunModel}
        isLoading={isRunning}
        lastUpdate={btcOutput?.run_ts}
        availableDates={availableDates}
        onDateSelect={handleDateSelect}
        selectedDate={selectedDate}
      />

      <div className="p-6">
        {/* 页面标题 */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-1">
            <div className="p-2 rounded-lg bg-orange-500/10">
              <Bitcoin className="w-5 h-5 text-orange-400" />
            </div>
            <h1 className="text-2xl font-bold text-zinc-100">BTC 中期模型</h1>
            {btcOutput?.model_version && (
              <span className="text-sm text-zinc-500">v{btcOutput.model_version}</span>
            )}
          </div>
          <p className="text-zinc-500 text-sm ml-12">
            模式识别架构 - 20 指标 x 3 状态 → 8 结构模式 → 共振/抵销 → 信号
          </p>
        </div>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-24">
            <RefreshCw className="w-8 h-8 text-orange-400 animate-spin mb-4" />
            <p className="text-zinc-500">加载最新数据...</p>
          </div>
        ) : !btcOutput ? (
          <div className="flex flex-col items-center justify-center py-24">
            <div className="relative mb-6">
              <div className="w-24 h-24 rounded-[14px] bg-[var(--bg-card)] flex items-center justify-center border border-[var(--border-subtle)]">
                <Bitcoin className="w-12 h-12 text-orange-400 animate-float" />
              </div>
            </div>
            <h2 className="text-xl font-semibold text-zinc-200 mb-2">暂无数据</h2>
            <p className="text-zinc-500 text-sm mb-1">点击「运行模型」按钮开始分析</p>
            <p className="text-zinc-600 text-xs">数据源（Glassnode/Farside/Coinglass/Deribit）接入后将自动产生信号</p>
          </div>
        ) : (
          <>
            {/* 数据源状态横幅：当所有指标都是中性时，提示数据源未接入 */}
            {allNeutral && (
              <div className="mb-6 px-4 py-3 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-400 mt-0.5 flex-shrink-0" />
                <div>
                  <div className="text-sm font-medium text-amber-400">Data Sources Pending</div>
                  <div className="text-xs text-zinc-400 mt-0.5">
                    20 indicators are showing neutral because on-chain data sources (Glassnode / CryptoQuant / CoinGlass / Deribit) are not yet connected.
                    The signal below is a placeholder. Real signals will appear after data integration.
                  </div>
                </div>
              </div>
            )}

            {/* ================================================================
                第一行：信号 + 信心度 + 验证状态
                ================================================================ */}
            <div className="grid grid-cols-3 gap-4 mb-8">
              {/* 最终信号卡 */}
              <div
                className="relative rounded-[14px] p-6 overflow-hidden bg-[var(--bg-card)] border border-[var(--border-subtle)]"
              >
                <div className="text-xs text-zinc-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Target className="w-3.5 h-3.5" />
                  最终信号
                </div>
                <div className="flex items-baseline gap-3 mb-1">
                  <span className="text-3xl">{signalCfg.emoji}</span>
                  <span
                    className="text-3xl font-bold"
                    style={{ color: signalCfg.color }}
                  >
                    {signal.replace("_", " ")}
                  </span>
                </div>
                <div className="text-sm text-zinc-400 mt-1">
                  {signalCfg.label}
                </div>
              </div>

              {/* 信心度 + 统计卡 */}
              <div className="relative rounded-[14px] p-6 overflow-hidden bg-[var(--bg-card)] border border-[var(--border-subtle)]">
                <div className="text-xs text-zinc-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5" />
                  信心度 & 覆盖
                </div>
                <div className="flex items-baseline gap-2 mb-3">
                  <span
                    className="text-2xl font-bold"
                    style={{ color: CONFIDENCE_COLOR[confidence] || "#6b7280" }}
                  >
                    {confidence}
                  </span>
                </div>
                {/* 指标状态统计 */}
                <div className="grid grid-cols-3 gap-2">
                  <div className="text-center p-2 rounded-lg bg-emerald-500/10">
                    <div className="text-lg font-bold text-emerald-400">{accCount}</div>
                    <div className="text-[10px] text-zinc-500">累积</div>
                  </div>
                  <div className="text-center p-2 rounded-lg bg-zinc-500/10">
                    <div className="text-lg font-bold text-zinc-400">{neuCount}</div>
                    <div className="text-[10px] text-zinc-500">中性</div>
                  </div>
                  <div className="text-center p-2 rounded-lg bg-red-500/10">
                    <div className="text-lg font-bold text-red-400">{distCount}</div>
                    <div className="text-[10px] text-zinc-500">释放</div>
                  </div>
                </div>
              </div>

              {/* 验证状态卡 */}
              <div className="relative rounded-[14px] p-6 overflow-hidden bg-[var(--bg-card)] border border-[var(--border-subtle)]">
                <div className="text-xs text-zinc-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  {validation?.cancellation ? (
                    <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
                  ) : validation?.resonance ? (
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <Eye className="w-3.5 h-3.5" />
                  )}
                  L4 验证
                </div>

                {validation?.cancellation ? (
                  <div>
                    <div className="text-xl font-bold text-amber-400 mb-1">多空抵销</div>
                    <div className="text-sm text-zinc-400">
                      {validation.bull_count} 多头 vs {validation.bear_count} 空头模式同时存在
                    </div>
                    <div className="text-xs text-amber-400/80 mt-2">信号降级为 NEUTRAL</div>
                  </div>
                ) : validation?.resonance ? (
                  <div>
                    <div
                      className="text-xl font-bold mb-1"
                      style={{
                        color: validation.resonance.type === "bull_ultra" ? "#10b981" : "#ef4444",
                      }}
                    >
                      {validation.resonance.name}
                    </div>
                    <div className="text-sm text-zinc-400">{validation.resonance.label}</div>
                    <div className="flex flex-wrap gap-1 mt-2">
                      {validation.resonance.matched_patterns.map((p) => (
                        <span
                          key={p}
                          className="text-[10px] px-2 py-0.5 rounded bg-zinc-800 text-zinc-400"
                        >
                          {p.replace(/_/g, " ")}
                        </span>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div>
                    <div className="text-xl font-bold text-zinc-400 mb-1">无共振/抵销</div>
                    <div className="text-sm text-zinc-500">
                      多头: {validation?.bull_count ?? 0} | 空头: {validation?.bear_count ?? 0}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="divider" />

            {/* ================================================================
                第二行：触发模式
                ================================================================ */}
            <div className="mb-8">
              <h2 className="section-title">
                <Layers className="w-5 h-5 text-orange-400" />
                L3 触发模式
              </h2>

              {patterns.length === 0 ? (
                <div className="rounded-[14px] p-8 bg-[var(--bg-card)] border border-[var(--border-subtle)] text-center">
                  <Eye className="w-8 h-8 text-zinc-600 mx-auto mb-3" />
                  <div className="text-zinc-400 font-medium">无模式触发</div>
                  <div className="text-sm text-zinc-600 mt-1">
                    所有 8 个结构模式均未满足触发条件 → P8 默认状态（观望）
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  {patterns.map((p) => {
                    const patInfo = PATTERN_NAMES[p.pattern_id] || { emoji: "?", desc: "" };
                    const isBull = p.direction === "bull";
                    const color = isBull ? "#10b981" : "#ef4444";

                    return (
                      <div
                        key={p.pattern_id}
                        className="relative rounded-[14px] p-5 overflow-hidden bg-[var(--bg-card)] border border-[var(--border-subtle)]"
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <span className="text-xl">{patInfo.emoji}</span>
                            <div>
                              <div className="text-sm font-medium text-zinc-200">{p.name}</div>
                              <div className="text-xs text-zinc-500">{p.pattern_id}</div>
                            </div>
                          </div>
                          <span
                            className="px-2.5 py-1 rounded-lg text-xs font-medium"
                            style={{
                              backgroundColor: `${color}20`,
                              color,
                              borderWidth: 1,
                              borderColor: `${color}40`,
                            }}
                          >
                            {p.signal}
                          </span>
                        </div>
                        <div className="text-xs text-zinc-500 mb-3">{patInfo.desc}</div>
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-zinc-500">
                            匹配: {p.matched_count}/{p.required_count}
                          </span>
                          <div className="flex flex-wrap gap-1">
                            {p.matched_indicators.map((ind) => (
                              <span
                                key={ind}
                                className="px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 text-[10px]"
                              >
                                {ind.split("_")[0]}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="divider" />

            {/* ================================================================
                第三行：指标状态热力图
                ================================================================ */}
            <div className="mb-8">
              <h2 className="section-title">
                <Target className="w-5 h-5 text-orange-400" />
                L2 指标状态（20 个核心指标）
              </h2>

              <div className="grid grid-cols-2 gap-4">
                {Object.entries(INDICATOR_GROUPS).map(([groupKey, group]) => (
                  <div
                    key={groupKey}
                    className="relative rounded-[14px] p-4 overflow-hidden bg-[var(--bg-card)] border border-[var(--border-subtle)]"
                  >
                    <div className="text-xs uppercase tracking-wider mb-3 flex items-center gap-1.5" style={{ color: group.color }}>
                      <span className="font-bold text-sm">{groupKey}</span>
                      <span className="text-zinc-500">{group.title}</span>
                    </div>

                    <div className="space-y-1.5">
                      {group.ids.map((indId) => {
                        const state = indicatorStates[indId] || "neutral";
                        const stateCfg = STATE_CONFIG[state] ?? STATE_CONFIG["neutral"]!;
                        const StateIcon = stateCfg.icon;

                        const reliability = INDICATOR_RELIABILITY[indId] || "";
                        const etfWarning = ETF_REINTERPRET[indId];

                        return (
                          <div key={indId}>
                            <div
                              className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-zinc-800/30 transition-colors"
                            >
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] font-mono text-zinc-600 w-6">
                                  {indId.split("_")[0]}
                                </span>
                                <span className="text-sm text-zinc-300">
                                  {INDICATOR_NAMES[indId] || indId}
                                </span>
                                <span className="text-[10px] text-amber-500/70" title="ETF post reliability">
                                  {reliability}
                                </span>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <StateIcon
                                  className="w-3.5 h-3.5"
                                  style={{ color: stateCfg.color }}
                                />
                              <span
                                className="text-xs font-medium min-w-[32px] text-right"
                                style={{ color: stateCfg.color }}
                              >
                                {stateCfg.label}
                              </span>
                            </div>
                          </div>
                          {etfWarning && (
                            <div className="ml-10 px-2 pb-1 text-[10px] text-amber-400/70 flex items-center gap-1">
                              <AlertTriangle className="w-3 h-3" />
                              {etfWarning}
                            </div>
                          )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* ================================================================
                操作建议
                ================================================================ */}
            {btcOutput.action && (
              <>
                <div className="divider" />
                <div className="mb-8">
                  <h2 className="section-title">
                    <AlertTriangle className="w-5 h-5 text-orange-400" />
                    操作建议
                  </h2>
                  <div
                    className="relative rounded-[14px] p-5 overflow-hidden bg-[var(--bg-card)] border border-[var(--border-subtle)]"
                  >
                    <div className="text-sm text-zinc-300 leading-relaxed">
                      {btcOutput.action}
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* ================================================================
                底部：文本报告
                ================================================================ */}
            {btcOutput.report_summary && (
              <>
                <div className="divider" />
                <div className="mb-8">
                  <h2 className="section-title">
                    <FileText className="w-5 h-5 text-orange-400" />
                    分析报告
                  </h2>
                  <div className="relative rounded-[14px] p-5 overflow-hidden bg-[var(--bg-card)] border border-[var(--border-subtle)]">
                    <pre className="text-sm text-zinc-300 whitespace-pre-wrap font-mono leading-relaxed">
                      {btcOutput.report_summary}
                    </pre>
                  </div>
                </div>
              </>
            )}

            {/* ================================================================
                告警
                ================================================================ */}
            {btcOutput.alerts && btcOutput.alerts.length > 0 && (
              <>
                <div className="divider" />
                <div className="mb-8">
                  <h2 className="section-title">
                    <ShieldAlert className="w-5 h-5 text-amber-400" />
                    告警
                  </h2>
                  <div className="space-y-2">
                    {btcOutput.alerts.map((alert, i) => (
                      <div
                        key={i}
                        className="flex items-start gap-3 p-3 rounded-xl bg-amber-500/5 border border-amber-500/20"
                      >
                        <AlertTriangle className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" />
                        <div>
                          <div className="text-sm text-amber-400 font-medium">{alert.type}</div>
                          <div className="text-sm text-zinc-400">{alert.message}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </>
        )}

        {/* 信号回测 */}
        <div className="divider" />
        <BacktestPanel model="btc" defaultPriceSymbol="BTC-USD" priceSymbols={[{ value: "BTC-USD", label: "Bitcoin" }]} />

        {/* 指标字典 — 始终显示 */}
        <div className="divider" />
        <IndicatorDictionary modules={["BTC_Price", "BTC_Flow", "BTC_Valuation", "BTC_Supply", "BTC_Derivatives"]} defaultExpanded />
      </div>
    </div>
  );
}
