/**
 * [INPUT]: 页面加载时自动获取最新 BTC 模型输出，用户可点击"运行模型"刷新。
 * [OUTPUT]: (JSX) - BTC 中期模型详情页，以结构模式(P1-P8)为核心展示，辅以指标热力图（含阈值提示）和信号摘要。
 * [POS]: BTC 路由 (/btc)。展示 BTC v8.0 模式识别架构的五层输出，通过 /api/btc 获取数据。
 *         页面布局：模式总览(Hero) → 触发模式详情 → 指标热力图 → 信号摘要(降级) → 报告/回测/字典。
 *
 * [PROTOCOL]:
 * 1. 一旦本文件逻辑变更，必须同步更新此 Header。
 * 2. 更新后必须上浮检查 /src/app/btc/.folder.md 的描述是否依然准确。
 */
"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { Header } from "@/components/Header";
import { IndicatorDictionary } from "@/components/IndicatorDictionary";
import dynamic from "next/dynamic";
const BacktestPanel = dynamic(
  () => import("@/components/BacktestPanel").then((m) => ({ default: m.BacktestPanel })),
  { ssr: false }
);
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
  CheckCircle2,
  XCircle,
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

// 每个指标的阈值描述（让用户理解为什么某指标处于某状态）
const INDICATOR_THRESHOLDS: Record<string, string> = {
  A1_ETF_FLOW: ">150M=累积, <-150M=释放",
  A2_COINBASE_BAL: "7D Δ<-500=累积, >500=释放",
  A3_EXCHANGE_NETFLOW: "<-5K=累积, >5K=释放",
  A4_WHALE_EXCHANGE: "P<20=累积, P>80=释放",
  A5_REALIZED_CAP_CHANGE: "小户+新币增长=累积",
  A6_TREND_ACCUM_SCORE: ">0.5且多群体=累积, <-0.5=释放",
  B1_REALIZED_PROFIT: "缓升=累积, 连续飙升≥3日=释放",
  B2_STH_COST_MVRV: "MVRV>1且稳定=累积, <0.9=释放",
  B3_LTH_MVRV_SLOPE: "斜率>0=累积, <0=释放",
  B4_SUPPLY_IN_PROFIT: "80-95%=累积, 65-80%=中性, >95%或<60%=释放",
  B5_SELL_SIDE_RISK: "P<30=累积, P>70=释放",
  C1_URPD_ENTITY: "密集区近价格=累积, 真空区=释放",
  C2_LTH_STH_RATIO: "比例上升=累积, 快速下降=释放",
  C3_LTH_NET_POSITION: "30D Δ>0=累积, <0=释放",
  C4_SUPPLY_BEHAVIOR: "conviction/momentum=累积, profit_taking/loss_selling=释放",
  D1_OI_LIQUIDATION: "OI上升+重建=累积, OI下降+清算飙升=释放",
  D2_FUNDING_RATE: "低/中性费率=累积, 持续过高=释放",
  D3_FUTURES_SPOT_CVD: "现货CVD上升=累积, 期货领跑+现货弱=释放",
  D4_PERP_SPOT_GAP: "价差<0=累积(ETF时代), >0.3=释放",
  D5_OPTIONS_PC_SKEW: "P/C<0.7且Skew<0=累积, P/C>1且Skew>0=释放",
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

// 全部 8 个结构模式（用于 Hero Grid 展示所有模式，无论是否触发）
const ALL_PATTERNS = [
  "P1_INSTITUTIONAL_ACCUMULATION",
  "P2_ETF_DELAYED_ACCUMULATION",
  "P3_SMART_MONEY_DISTRIBUTION",
  "P4_SQUEEZE_IGNITION",
  "P5_CHIP_STABILITY",
  "P6_RETAIL_FOMO",
  "P7_CAPITULATION_BOTTOM",
  "P8_STRUCTURAL_NEUTRALITY",
] as const;

// 每个模式的方向标签
const PATTERN_DIRECTION: Record<string, { label: string; color: string }> = {
  P1_INSTITUTIONAL_ACCUMULATION: { label: "BULL", color: "#10b981" },
  P2_ETF_DELAYED_ACCUMULATION: { label: "BULL", color: "#10b981" },
  P3_SMART_MONEY_DISTRIBUTION: { label: "BEAR", color: "#ef4444" },
  P4_SQUEEZE_IGNITION: { label: "BULL", color: "#10b981" },
  P5_CHIP_STABILITY: { label: "BULL", color: "#10b981" },
  P6_RETAIL_FOMO: { label: "BEAR", color: "#ef4444" },
  P7_CAPITULATION_BOTTOM: { label: "BULL", color: "#10b981" },
  P8_STRUCTURAL_NEUTRALITY: { label: "NEUTRAL", color: "#6b7280" },
};

// 每个模式需要哪些指标
const PATTERN_REQUIRED_INDICATORS: Record<string, string[]> = {
  P1_INSTITUTIONAL_ACCUMULATION: ["A1_ETF_FLOW", "A2_COINBASE_BAL", "A6_TREND_ACCUM_SCORE", "A5_REALIZED_CAP_CHANGE"],
  P2_ETF_DELAYED_ACCUMULATION: ["A1_ETF_FLOW", "A2_COINBASE_BAL", "D4_PERP_SPOT_GAP", "D2_FUNDING_RATE"],
  P3_SMART_MONEY_DISTRIBUTION: ["A4_WHALE_EXCHANGE", "B1_REALIZED_PROFIT", "D3_FUTURES_SPOT_CVD", "C3_LTH_NET_POSITION"],
  P4_SQUEEZE_IGNITION: ["D1_OI_LIQUIDATION", "D3_FUTURES_SPOT_CVD"],
  P5_CHIP_STABILITY: ["C2_LTH_STH_RATIO", "B5_SELL_SIDE_RISK", "C4_SUPPLY_BEHAVIOR", "B4_SUPPLY_IN_PROFIT"],
  P6_RETAIL_FOMO: ["D2_FUNDING_RATE", "D1_OI_LIQUIDATION", "B4_SUPPLY_IN_PROFIT", "D4_PERP_SPOT_GAP", "C4_SUPPLY_BEHAVIOR"],
  P7_CAPITULATION_BOTTOM: ["B2_STH_COST_MVRV", "C4_SUPPLY_BEHAVIOR", "C1_URPD_ENTITY", "B5_SELL_SIDE_RISK"],
  P8_STRUCTURAL_NEUTRALITY: [],
};

// 每个模式要求各指标处于什么状态才算匹配
const PATTERN_REQUIRED_STATES: Record<string, Record<string, string>> = {
  P1_INSTITUTIONAL_ACCUMULATION: {
    A1_ETF_FLOW: "accumulation", A2_COINBASE_BAL: "accumulation",
    A6_TREND_ACCUM_SCORE: "accumulation", A5_REALIZED_CAP_CHANGE: "accumulation",
  },
  P2_ETF_DELAYED_ACCUMULATION: {
    A1_ETF_FLOW: "accumulation", A2_COINBASE_BAL: "accumulation",
    D4_PERP_SPOT_GAP: "accumulation", D2_FUNDING_RATE: "accumulation",
  },
  P3_SMART_MONEY_DISTRIBUTION: {
    A4_WHALE_EXCHANGE: "distribution", B1_REALIZED_PROFIT: "distribution",
    D3_FUTURES_SPOT_CVD: "distribution", C3_LTH_NET_POSITION: "distribution",
  },
  P4_SQUEEZE_IGNITION: {
    D1_OI_LIQUIDATION: "distribution", D3_FUTURES_SPOT_CVD: "accumulation",
  },
  P5_CHIP_STABILITY: {
    C2_LTH_STH_RATIO: "accumulation", B5_SELL_SIDE_RISK: "accumulation",
    C4_SUPPLY_BEHAVIOR: "accumulation", B4_SUPPLY_IN_PROFIT: "neutral",
  },
  P6_RETAIL_FOMO: {
    D2_FUNDING_RATE: "distribution", D1_OI_LIQUIDATION: "accumulation",
    B4_SUPPLY_IN_PROFIT: "distribution", D4_PERP_SPOT_GAP: "distribution",
    C4_SUPPLY_BEHAVIOR: "distribution",
  },
  P7_CAPITULATION_BOTTOM: {
    B2_STH_COST_MVRV: "distribution", C4_SUPPLY_BEHAVIOR: "distribution",
    C1_URPD_ENTITY: "accumulation", B5_SELL_SIDE_RISK: "distribution",
  },
  P8_STRUCTURAL_NEUTRALITY: {},
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
                Section 1: Hero - 结构模式总览 (8 模式网格)
                ================================================================ */}
            <div className="mb-6">
              <h2 className="section-title">
                <Layers className="w-5 h-5 text-orange-400" />
                结构模式总览
              </h2>

              <div className="grid grid-cols-4 gap-3 mb-4">
                {ALL_PATTERNS.map((patId) => {
                  const patInfo = PATTERN_NAMES[patId] || { emoji: "?", desc: "" };
                  const dirInfo = PATTERN_DIRECTION[patId] || { label: "?", color: "#6b7280" };
                  const triggered = patterns.find((p) => p.pattern_id === patId);
                  const isTriggered = !!triggered;
                  const shortName = patId.replace(/^P\d_/, "").replace(/_/g, " ");

                  return (
                    <div
                      key={patId}
                      className="relative rounded-[14px] p-4 overflow-hidden border transition-all"
                      style={{
                        backgroundColor: isTriggered ? "var(--bg-card)" : "transparent",
                        borderColor: isTriggered ? `${dirInfo.color}40` : "var(--border-subtle)",
                        opacity: isTriggered ? 1 : 0.4,
                      }}
                    >
                      {/* 触发状态亮条 */}
                      {isTriggered && (
                        <div
                          className="absolute top-0 left-0 right-0 h-[2px]"
                          style={{ backgroundColor: dirInfo.color }}
                        />
                      )}
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-lg">{patInfo.emoji}</span>
                        <span
                          className="text-[10px] font-medium px-1.5 py-0.5 rounded"
                          style={{
                            backgroundColor: `${dirInfo.color}15`,
                            color: dirInfo.color,
                          }}
                        >
                          {dirInfo.label}
                        </span>
                      </div>
                      <div className="text-xs font-medium text-zinc-300 mb-1 leading-tight capitalize">
                        {shortName.toLowerCase()}
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="text-[10px] text-zinc-500 font-mono">
                          {patId.split("_")[0]}
                        </div>
                        {isTriggered && triggered && (
                          <div
                            className="text-xs font-bold"
                            style={{ color: dirInfo.color }}
                          >
                            {triggered.matched_count}/{triggered.required_count}
                          </div>
                        )}
                      </div>
                      {/* 悬浮指标详情 */}
                      <PatternTooltip patternId={patId} indicatorStates={indicatorStates} />
                    </div>
                  );
                })}
              </div>

              {/* 验证状态条 */}
              <div className="rounded-[14px] px-4 py-3 bg-[var(--bg-card)] border border-[var(--border-subtle)] flex items-center gap-4">
                <div className="flex items-center gap-1.5 text-xs text-zinc-500">
                  {validation?.cancellation ? (
                    <ShieldAlert className="w-4 h-4 text-amber-400" />
                  ) : validation?.resonance ? (
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                  <span className="uppercase tracking-wider font-medium">L4 验证</span>
                </div>
                <div className="h-4 w-px bg-zinc-700" />
                {validation?.cancellation ? (
                  <div className="flex items-center gap-3 text-sm">
                    <span className="font-medium text-amber-400">多空抵销</span>
                    <span className="text-zinc-500">
                      {validation.bull_count} 多头 vs {validation.bear_count} 空头
                    </span>
                    <span className="text-[10px] text-amber-400/80 px-2 py-0.5 rounded bg-amber-500/10">
                      信号降级 NEUTRAL
                    </span>
                  </div>
                ) : validation?.resonance ? (
                  <div className="flex items-center gap-3 text-sm">
                    <span
                      className="font-medium"
                      style={{
                        color: validation.resonance.type === "bull_ultra" ? "#10b981" : "#ef4444",
                      }}
                    >
                      {validation.resonance.name}
                    </span>
                    <span className="text-zinc-500">{validation.resonance.label}</span>
                    <div className="flex flex-wrap gap-1">
                      {validation.resonance.matched_patterns.map((p) => (
                        <span
                          key={p}
                          className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400"
                        >
                          {p.replace(/_/g, " ")}
                        </span>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-3 text-sm">
                    <span className="text-zinc-400">无共振/抵销</span>
                    <span className="text-zinc-600">
                      多头: {validation?.bull_count ?? 0} | 空头: {validation?.bear_count ?? 0}
                    </span>
                  </div>
                )}
              </div>
            </div>

            <div className="divider" />

            {/* ================================================================
                Section 2: 触发模式详情卡片（含指标匹配详情）
                ================================================================ */}
            <div className="mb-8">
              <h2 className="section-title">
                <Zap className="w-5 h-5 text-orange-400" />
                触发模式详情
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
                <div className="space-y-4">
                  {patterns.map((p) => {
                    const patInfo = PATTERN_NAMES[p.pattern_id] || { emoji: "?", desc: "" };
                    const dirInfo = PATTERN_DIRECTION[p.pattern_id] || { label: "?", color: "#6b7280" };
                    const requiredInds = PATTERN_REQUIRED_INDICATORS[p.pattern_id] || [];
                    const requiredStates = PATTERN_REQUIRED_STATES[p.pattern_id] || {};

                    return (
                      <div
                        key={p.pattern_id}
                        className="relative rounded-[14px] overflow-hidden bg-[var(--bg-card)] border border-[var(--border-subtle)]"
                      >
                        {/* 顶部亮条 */}
                        <div
                          className="absolute top-0 left-0 right-0 h-[2px]"
                          style={{ backgroundColor: dirInfo.color }}
                        />

                        <div className="p-5">
                          {/* 头部：名称 + 信号 */}
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex items-center gap-3">
                              <span className="text-2xl">{patInfo.emoji}</span>
                              <div>
                                <div className="text-base font-medium text-zinc-100">{p.name}</div>
                                <div className="text-xs text-zinc-500 mt-0.5">{patInfo.desc}</div>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <span
                                className="text-sm font-bold"
                                style={{ color: dirInfo.color }}
                              >
                                {p.matched_count}/{p.required_count}
                              </span>
                              <span
                                className="px-2.5 py-1 rounded-lg text-xs font-medium"
                                style={{
                                  backgroundColor: `${dirInfo.color}20`,
                                  color: dirInfo.color,
                                  borderWidth: 1,
                                  borderColor: `${dirInfo.color}40`,
                                }}
                              >
                                {p.signal}
                              </span>
                            </div>
                          </div>

                          {/* 指标匹配详情 */}
                          {requiredInds.length > 0 && (
                            <div className="mt-4 rounded-lg bg-zinc-900/50 border border-zinc-800/50 overflow-hidden">
                              <div className="px-3 py-2 border-b border-zinc-800/50">
                                <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-medium">
                                  Required Indicators
                                </span>
                              </div>
                              <div className="divide-y divide-zinc-800/30">
                                {requiredInds.map((indId) => {
                                  const currentState = indicatorStates[indId] || "neutral";
                                  const requiredState = requiredStates[indId] || "neutral";
                                  const isMatched = currentState === requiredState;
                                  const currentCfg = STATE_CONFIG[currentState] ?? STATE_CONFIG["neutral"]!;
                                  const requiredCfg = STATE_CONFIG[requiredState] ?? STATE_CONFIG["neutral"]!;
                                  const reliability = INDICATOR_RELIABILITY[indId] || "";

                                  return (
                                    <div
                                      key={indId}
                                      className="flex items-center justify-between px-3 py-2"
                                    >
                                      <div className="flex items-center gap-2.5">
                                        {isMatched ? (
                                          <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                                        ) : (
                                          <XCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
                                        )}
                                        <span className="text-[10px] font-mono text-zinc-600 w-5">
                                          {indId.split("_")[0]}
                                        </span>
                                        <span className="text-sm text-zinc-300">
                                          {INDICATOR_NAMES[indId] || indId}
                                        </span>
                                        <span className="text-[10px] text-amber-500/60">
                                          {reliability}
                                        </span>
                                      </div>
                                      <div className="flex items-center gap-3">
                                        <div className="flex items-center gap-1">
                                          <span className="text-[10px] text-zinc-600">need:</span>
                                          <span
                                            className="text-[11px] font-medium"
                                            style={{ color: requiredCfg.color }}
                                          >
                                            {requiredCfg.label}
                                          </span>
                                        </div>
                                        <div className="text-zinc-700">|</div>
                                        <div className="flex items-center gap-1">
                                          <span className="text-[10px] text-zinc-600">now:</span>
                                          <span
                                            className="text-[11px] font-medium"
                                            style={{ color: currentCfg.color }}
                                          >
                                            {currentCfg.label}
                                          </span>
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="divider" />

            {/* ================================================================
                Section 3: 指标状态热力图（保持原样）
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
                                title={INDICATOR_THRESHOLDS[indId] || undefined}
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

            <div className="divider" />

            {/* ================================================================
                Section 4: 信号摘要条（降级展示）
                ================================================================ */}
            <div className="mb-8">
              <div className="rounded-[14px] px-5 py-4 bg-[var(--bg-card)] border border-[var(--border-subtle)] flex items-center gap-4 flex-wrap">
                <div className="flex items-center gap-2">
                  <span className="text-lg">{signalCfg.emoji}</span>
                  <span
                    className="text-base font-bold"
                    style={{ color: signalCfg.color }}
                  >
                    {signal.replace("_", " ")}
                  </span>
                </div>
                <div className="h-4 w-px bg-zinc-700" />
                <div className="flex items-center gap-1.5 text-sm">
                  <span className="text-zinc-500">Confidence:</span>
                  <span
                    className="font-medium"
                    style={{ color: CONFIDENCE_COLOR[confidence] || "#6b7280" }}
                  >
                    {confidence}
                  </span>
                </div>
                <div className="h-4 w-px bg-zinc-700" />
                <div className="flex items-center gap-1.5 text-sm">
                  <span className="text-zinc-500">指标分布:</span>
                  <span className="text-emerald-400 font-medium">{accCount}</span>
                  <span className="text-zinc-600">/</span>
                  <span className="text-zinc-400 font-medium">{neuCount}</span>
                  <span className="text-zinc-600">/</span>
                  <span className="text-red-400 font-medium">{distCount}</span>
                  <span className="text-zinc-600 text-xs">(累积/中性/释放)</span>
                </div>
                {btcOutput.action && (
                  <>
                    <div className="h-4 w-px bg-zinc-700" />
                    <div className="text-sm text-zinc-400 flex-1 min-w-0">
                      <span className="text-zinc-500">操作建议: </span>
                      {btcOutput.action}
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* ================================================================
                分析报告
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
        <BacktestPanel model="btc" />

        {/* 指标字典 — 始终显示 */}
        <div className="divider" />
        <IndicatorDictionary modules={["BTC_Price", "BTC_Flow", "BTC_Valuation", "BTC_Supply", "BTC_Derivatives"]} defaultExpanded />
      </div>
    </div>
  );
}

// ============================================================================
// 模式悬浮详情组件
// ============================================================================

function PatternTooltip({
  patternId,
  indicatorStates,
}: {
  patternId: string;
  indicatorStates: Record<string, string>;
}) {
  const [show, setShow] = useState(false);
  const required = PATTERN_REQUIRED_STATES[patternId];
  if (!required || Object.keys(required).length === 0) return null;

  return (
    <div
      className="relative mt-2"
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      <div className="flex items-center gap-1 cursor-help text-zinc-600 hover:text-zinc-400 transition-colors">
        <Eye className="w-3 h-3" />
        <span className="text-[10px]">触发条件</span>
      </div>

      {show && (
        <div className="absolute bottom-full left-0 mb-2 z-50 w-64 rounded-xl p-3 shadow-2xl shadow-black/50 bg-[var(--bg-elevated)] border border-[var(--border-visible)]">
          <div className="text-[10px] text-zinc-500 uppercase tracking-wider mb-2 font-semibold">
            需要全部满足
          </div>
          <div className="space-y-1.5">
            {Object.entries(required).map(([indId, reqState]) => {
              const currentState = indicatorStates[indId] || "neutral";
              const isMatch = currentState === reqState;
              const reqCfg = STATE_CONFIG[reqState] ?? STATE_CONFIG["neutral"]!;
              const curCfg = STATE_CONFIG[currentState] ?? STATE_CONFIG["neutral"]!;

              return (
                <div key={indId} className="flex flex-col gap-0.5">
                  <div className="flex items-center gap-2 text-[11px]">
                    {isMatch ? (
                      <CheckCircle2 className="w-3 h-3 text-emerald-400 flex-shrink-0" />
                    ) : (
                      <XCircle className="w-3 h-3 text-red-400 flex-shrink-0" />
                    )}
                    <span className="text-zinc-400 truncate flex-1">
                      {INDICATOR_NAMES[indId] || indId}
                    </span>
                    <span className="text-[10px] flex-shrink-0" style={{ color: curCfg.color }}>
                      {curCfg.label}
                    </span>
                    <span className="text-zinc-600 flex-shrink-0">/</span>
                    <span className="text-[10px] flex-shrink-0" style={{ color: reqCfg.color }}>
                      {reqCfg.label}
                    </span>
                  </div>
                  {INDICATOR_THRESHOLDS[indId] && (
                    <div className="text-[9px] text-zinc-600 ml-5 leading-tight">
                      {INDICATOR_THRESHOLDS[indId]}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <div className="mt-2 pt-2 border-t border-[var(--border-subtle)] text-[10px] text-zinc-600">
            格式：当前状态 / 需要状态
          </div>
        </div>
      )}
    </div>
  );
}
