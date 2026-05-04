/**
 * [INPUT]: 页面加载时自动获取最新 BTC 模型输出，用户可点击"运行模型"刷新。
 * [OUTPUT]: (JSX) - BTC 中期模型详情页，以「8 个小模型矩阵」为主轴展示模式识别架构。
 * [POS]: BTC 路由 (/btc)。展示 BTC v8.0 五层架构，通过 /api/btc 获取数据。
 *         页面布局：信号 Hero(L5+L4) → 8 小模型矩阵(L3 Pattern) → L1 全指标看板(A/B/C/D) → 报告/回测/字典。
 *         每个 Pattern 卡都完整显示触发条件命中度（不再 opacity 弱化），sparkline 占位待接 series API。
 *
 * [PROTOCOL]:
 * 1. 一旦本文件逻辑变更，必须同步更新此 Header。
 * 2. 更新后必须上浮检查 /src/app/btc/.folder.md 的描述是否依然准确。
 */
"use client";

import { useState, useCallback, useEffect, useRef, useMemo, type ReactNode } from "react";
// @ts-expect-error - Next.js 自动提供 react-dom 类型
import { createPortal } from "react-dom";
import { Header } from "@/components/Header";
import { IndicatorDictionary } from "@/components/IndicatorDictionary";
import {
  BtcIndicatorChart,
  type BtcIndicatorChartThresholds,
  type BtcIndicatorState,
} from "@/components/BtcIndicatorChart";
import dynamic from "next/dynamic";
const BacktestPanel = dynamic(
  () => import("@/components/BacktestPanel").then((m) => ({ default: m.BacktestPanel })),
  { ssr: false }
);
import apiClient from "@/lib/api";
import { cn } from "@/lib/utils";
import { useChartCatalog, useChartSeriesBatch } from "@/lib/useChartSeries";

import type { BtcOutput, BtcPattern, ChartSeriesPoint, HistoryRecord } from "@/types/api";
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

  // -------------------------------------------------------------------------
  // L1 全指标看板：批量拉 series + catalog（拿 thresholds.numeric）
  // -------------------------------------------------------------------------
  const allIndicatorSymbols = useMemo(
    () => Object.values(INDICATOR_GROUPS).flatMap((g) => g.ids),
    []
  );
  const { data: catalogData } = useChartCatalog();
  const {
    dataMap: seriesMap,
    isLoading: seriesLoading,
  } = useChartSeriesBatch(allIndicatorSymbols, 90, !isLoading && !!btcOutput);

  // catalog → thresholds.numeric Map（仅保留有数值阈值的）
  const thresholdsBySymbol = useMemo(() => {
    const m = new Map<string, BtcIndicatorChartThresholds | null>();
    const inds = catalogData?.indicators ?? [];
    for (const ind of inds) {
      const thr = (ind.thresholds ?? null) as Record<string, unknown> | null;
      const numeric = thr && typeof thr === "object"
        ? (thr["numeric"] as Record<string, unknown> | undefined)
        : undefined;
      if (
        numeric &&
        (typeof numeric.accumulation === "number" ||
          typeof numeric.distribution === "number")
      ) {
        m.set(ind.symbol, {
          accumulation:
            typeof numeric.accumulation === "number" ? numeric.accumulation : undefined,
          distribution:
            typeof numeric.distribution === "number" ? numeric.distribution : undefined,
          unit: typeof numeric.unit === "string" ? numeric.unit : undefined,
          direction:
            numeric.direction === "higher_is_accumulation" ||
            numeric.direction === "lower_is_accumulation"
              ? numeric.direction
              : undefined,
        });
      } else {
        m.set(ind.symbol, null);
      }
    }
    return m;
  }, [catalogData]);

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
                Section A: 顶部信号 Hero (L5 信号 + L4 验证嵌入底部)
                原 Section 4 信号摘要上移并重新设计
                ================================================================ */}
            <div className="mb-6 rounded-[14px] overflow-hidden bg-[var(--bg-card)] border border-[var(--border-subtle)]">
              <div className="p-5 flex items-center gap-6 flex-wrap">
                <div className="flex items-center gap-3">
                  <span className="text-3xl">{signalCfg.emoji}</span>
                  <div>
                    <div
                      className="text-2xl font-bold leading-tight"
                      style={{ color: signalCfg.color }}
                    >
                      {signalCfg.label}
                    </div>
                    <div className="text-[10px] text-zinc-500 uppercase tracking-wider mt-0.5">
                      L5 SIGNAL · {signal.replace("_", " ")}
                    </div>
                  </div>
                </div>
                <div className="h-12 w-px bg-zinc-800" />
                <div>
                  <div className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1">
                    Confidence
                  </div>
                  <div
                    className="text-base font-medium"
                    style={{ color: CONFIDENCE_COLOR[confidence] || "#6b7280" }}
                  >
                    {confidence}
                  </div>
                </div>
                <div className="h-12 w-px bg-zinc-800" />
                <div>
                  <div className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1">
                    指标分布 ({totalIndicators})
                  </div>
                  <div className="flex items-center gap-1.5 text-sm">
                    <span className="text-emerald-400 font-medium tabular-nums">{accCount}</span>
                    <span className="text-[10px] text-zinc-500">累积</span>
                    <span className="text-zinc-700">·</span>
                    <span className="text-zinc-300 font-medium tabular-nums">{neuCount}</span>
                    <span className="text-[10px] text-zinc-500">中性</span>
                    <span className="text-zinc-700">·</span>
                    <span className="text-red-400 font-medium tabular-nums">{distCount}</span>
                    <span className="text-[10px] text-zinc-500">释放</span>
                  </div>
                </div>
                {btcOutput.action && (
                  <>
                    <div className="h-12 w-px bg-zinc-800" />
                    <div className="flex-1 min-w-[180px]">
                      <div className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1">
                        操作建议
                      </div>
                      <div className="text-sm text-zinc-300 leading-snug">
                        {btcOutput.action}
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* L4 验证状态嵌入底部 */}
              <div className="px-5 py-2.5 border-t border-zinc-800/60 flex items-center gap-3 bg-zinc-900/30 flex-wrap">
                <div className="flex items-center gap-1.5 text-[11px] text-zinc-500">
                  {validation?.cancellation ? (
                    <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
                  ) : validation?.resonance ? (
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <Eye className="w-3.5 h-3.5" />
                  )}
                  <span className="uppercase tracking-wider font-medium">L4 验证</span>
                </div>
                {validation?.cancellation ? (
                  <div className="flex items-center gap-2 text-xs flex-wrap">
                    <span className="font-medium text-amber-400">多空抵销</span>
                    <span className="text-zinc-500">
                      {validation.bull_count} 多 vs {validation.bear_count} 空
                    </span>
                    <span className="text-[10px] text-amber-400/80 px-1.5 py-0.5 rounded bg-amber-500/10">
                      信号降级 NEUTRAL
                    </span>
                  </div>
                ) : validation?.resonance ? (
                  <div className="flex items-center gap-2 text-xs flex-wrap">
                    <span
                      className="font-medium"
                      style={{
                        color:
                          validation.resonance.type === "bull_ultra" ? "#10b981" : "#ef4444",
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
                  <div className="text-xs text-zinc-500">
                    无共振/抵销 · 多头 {validation?.bull_count ?? 0} / 空头{" "}
                    {validation?.bear_count ?? 0}
                  </div>
                )}
              </div>
            </div>

            {/* ================================================================
                Section B: 8 个小模型矩阵 (L3 Pattern Layer)
                每张卡完整显示触发条件命中度，按"已触发/接近触发/未触发"三态着色
                ================================================================ */}
            <div className="mb-8">
              <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                <h2 className="section-title !mb-0">
                  <Layers className="w-5 h-5 text-orange-400" />
                  8 个结构模式（小模型）
                </h2>
                <div className="text-[11px] text-zinc-500 flex items-center gap-3">
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-emerald-400" />
                    <span>已触发</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-amber-400" />
                    <span>接近触发 (≥50%)</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-zinc-600" />
                    <span>未触发</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {ALL_PATTERNS.map((patId) => (
                  <PatternMatrixCard
                    key={patId}
                    patternId={patId}
                    indicatorStates={indicatorStates}
                    triggeredPatterns={patterns}
                    seriesMap={seriesMap}
                    thresholdsBySymbol={thresholdsBySymbol}
                  />
                ))}
              </div>
            </div>

            <div className="divider" />

            {/* ================================================================
                Section C: L1 全指标看板（按 ★ 分级 + 数值阈值带 chart）
                ★★★ / ★★ → BtcIndicatorChart（有 numeric 阈值就画带）
                ★      → 状态徽章 + 反向解读说明（不画 chart）
                ================================================================ */}
            <div className="mb-8">
              <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                <h2 className="section-title !mb-0">
                  <Target className="w-5 h-5 text-orange-400" />
                  L1 数据层（20 个核心指标）
                  {seriesLoading && (
                    <span className="text-xs text-zinc-500 ml-2 font-normal">
                      加载 series 数据...
                    </span>
                  )}
                </h2>
                <div className="text-[11px] text-zinc-500 flex items-center gap-3">
                  <span>★★★ 核心可靠</span>
                  <span>·</span>
                  <span>★★ 条件可靠</span>
                  <span>·</span>
                  <span>★ 反向解读</span>
                </div>
              </div>

              <div className="space-y-6">
                {Object.entries(INDICATOR_GROUPS).map(([groupKey, group]) => (
                  <div key={groupKey}>
                    <div className="text-xs uppercase tracking-wider mb-3 flex items-center gap-2 text-zinc-400">
                      <span className="font-bold text-sm text-zinc-300">{groupKey}</span>
                      <span className="text-zinc-500">·</span>
                      <span className="text-zinc-400">{group.title}</span>
                      <span className="text-[10px] text-zinc-600 ml-1">
                        ({group.ids.length} 个指标)
                      </span>
                    </div>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                      {group.ids.map((indId) => (
                        <IndicatorRow
                          key={indId}
                          indId={indId}
                          state={(indicatorStates[indId] || "neutral") as BtcIndicatorState}
                          data={seriesMap.get(indId) || []}
                          thresholds={thresholdsBySymbol.get(indId) ?? null}
                          isLoading={seriesLoading}
                        />
                      ))}
                    </div>
                  </div>
                ))}
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
// 8 模式矩阵卡片 (L3 Pattern Card)
// ============================================================================

const PATTERN_HISTORICAL: Record<string, string> = {
  P1_INSTITUTIONAL_ACCUMULATION: "2024 Q1 ETF 上市初期、2025 Q2 反弹初期均出现",
  P2_ETF_DELAYED_ACCUMULATION: "2025 Q2 至今典型结构：价差持续负值但价格创新高",
  P3_SMART_MONEY_DISTRIBUTION: "2021/11 牛市见顶、2022 崩跌前、2024/4-5 诱多",
  P4_SQUEEZE_IGNITION: "2025/4 费率转正+ETF流入+OTC活跃形成完整升势",
  P5_CHIP_STABILITY: "2023 Q3、2024 Q4 出现此结构后后续爬升",
  P6_RETAIL_FOMO: "2021/11、2024/3 见顶前均出现",
  P7_CAPITULATION_BOTTOM: "2020/3、2022/6、2022/11 底部均出现",
  P8_STRUCTURAL_NEUTRALITY: "大多数横盘整理期均属此状态",
};

const PATTERN_SHORT_NAME: Record<string, string> = {
  P1_INSTITUTIONAL_ACCUMULATION: "机构吸筹确认",
  P2_ETF_DELAYED_ACCUMULATION: "ETF 延迟型吸筹",
  P3_SMART_MONEY_DISTRIBUTION: "主力出货警戒",
  P4_SQUEEZE_IGNITION: "杠杆引爆+接力",
  P5_CHIP_STABILITY: "筹码稳定+蓄势",
  P6_RETAIL_FOMO: "散户 FOMO+过热",
  P7_CAPITULATION_BOTTOM: "投降底部",
  P8_STRUCTURAL_NEUTRALITY: "结构中性/无共识",
};

function PatternMatrixCard({
  patternId,
  indicatorStates,
  triggeredPatterns,
  seriesMap,
  thresholdsBySymbol,
}: {
  patternId: string;
  indicatorStates: Record<string, string>;
  triggeredPatterns: BtcPattern[];
  seriesMap: Map<string, ChartSeriesPoint[]>;
  thresholdsBySymbol: Map<string, BtcIndicatorChartThresholds | null>;
}) {
  const patInfo = PATTERN_NAMES[patternId] || { emoji: "?", desc: "" };
  const dirInfo = PATTERN_DIRECTION[patternId] || { label: "?", color: "#6b7280" };
  const requiredInds = PATTERN_REQUIRED_INDICATORS[patternId] || [];
  const requiredStates = PATTERN_REQUIRED_STATES[patternId] || {};
  const isFallback = patternId === "P8_STRUCTURAL_NEUTRALITY";

  const matched = requiredInds.filter(
    (ind) => indicatorStates[ind] === requiredStates[ind]
  ).length;
  const total = requiredInds.length;
  const percentage = total > 0 ? matched / total : 0;
  const isTriggered = !!triggeredPatterns.find((p) => p.pattern_id === patternId);

  const status: "triggered" | "near" | "dormant" = isTriggered
    ? "triggered"
    : percentage >= 0.5
    ? "near"
    : "dormant";

  const statusLabel = {
    triggered: "已触发",
    near: "接近触发",
    dormant: "未触发",
  }[status];

  const statusColor = {
    triggered: dirInfo.color,
    near: "#fbbf24",
    dormant: "#52525b",
  }[status];

  const borderColor =
    status === "triggered"
      ? `${dirInfo.color}55`
      : status === "near"
      ? "#fbbf2440"
      : "var(--border-subtle)";

  // P8 fallback 卡（无 required_states）
  if (isFallback) {
    return (
      <div
        className="relative rounded-[14px] p-5 overflow-hidden border bg-[var(--bg-card)]"
        style={{ borderColor: isTriggered ? "#9ca3af55" : "var(--border-subtle)" }}
      >
        {isTriggered && (
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-zinc-400" />
        )}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <span className="text-2xl flex-shrink-0">{patInfo.emoji}</span>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono text-zinc-600">P8</span>
                <span className="text-base font-medium text-zinc-100">
                  {PATTERN_SHORT_NAME[patternId]}
                </span>
              </div>
              <div className="text-xs text-zinc-500 mt-0.5">{patInfo.desc}</div>
            </div>
          </div>
          <span
            className="text-[10px] font-medium px-2 py-0.5 rounded flex-shrink-0"
            style={{ backgroundColor: "#6b728020", color: "#9ca3af" }}
          >
            FALLBACK
          </span>
        </div>
        <div className="rounded-lg bg-zinc-900/40 border border-zinc-800/40 p-3">
          <div className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1.5 font-medium">
            触发逻辑
          </div>
          <ul className="text-xs text-zinc-400 leading-relaxed space-y-1 ml-3 list-disc">
            <li>其他 7 个模式均未完整触发</li>
            <li>或多空模式同时存在并互相抵销</li>
          </ul>
          <div className="mt-3 pt-2 border-t border-zinc-800/40 text-xs">
            <span className="text-zinc-500">当前状态：</span>
            {isTriggered ? (
              <span className="text-zinc-300 font-medium">已触发（默认观望状态）</span>
            ) : (
              <span className="text-zinc-500">未触发</span>
            )}
          </div>
        </div>
        <div className="mt-3 flex items-start gap-2 text-[11px] text-zinc-500">
          <span className="flex-shrink-0">📜</span>
          <span className="leading-relaxed">{PATTERN_HISTORICAL[patternId]}</span>
        </div>
      </div>
    );
  }

  return (
    <div
      className="relative rounded-[14px] p-5 overflow-hidden border bg-[var(--bg-card)] transition-all"
      style={{ borderColor }}
    >
      {/* 顶部亮条（仅触发时） */}
      {status === "triggered" && (
        <div
          className="absolute top-0 left-0 right-0 h-[2px]"
          style={{ backgroundColor: dirInfo.color }}
        />
      )}

      {/* 头部：编号 + 名称 + 方向标 */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <span className="text-2xl flex-shrink-0">{patInfo.emoji}</span>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono text-zinc-600">
                {patternId.split("_")[0]}
              </span>
              <span className="text-base font-medium text-zinc-100 truncate">
                {PATTERN_SHORT_NAME[patternId] || patternId}
              </span>
            </div>
            <div className="text-xs text-zinc-500 mt-0.5 line-clamp-2 leading-snug">
              {patInfo.desc}
            </div>
          </div>
        </div>
        <span
          className="text-[10px] font-medium px-2 py-0.5 rounded flex-shrink-0"
          style={{ backgroundColor: `${dirInfo.color}15`, color: dirInfo.color }}
        >
          {dirInfo.label}
        </span>
      </div>

      {/* 命中度 + 进度条 */}
      <div className="mb-4">
        <div className="flex items-baseline justify-between mb-1.5">
          <div className="flex items-baseline gap-1.5">
            <span
              className="text-3xl font-bold tabular-nums leading-none"
              style={{ color: statusColor }}
            >
              {matched}
            </span>
            <span className="text-base text-zinc-500 tabular-nums">/{total}</span>
            <span className="text-[10px] text-zinc-600 ml-1.5">
              ({Math.round(percentage * 100)}%)
            </span>
          </div>
          <span
            className="text-[10px] font-medium px-2 py-0.5 rounded uppercase tracking-wider"
            style={{
              backgroundColor: `${statusColor}20`,
              color: statusColor,
            }}
          >
            {statusLabel}
          </span>
        </div>
        <div className="relative h-1.5 rounded-full bg-zinc-800/60 overflow-hidden">
          <div
            className="absolute top-0 left-0 h-full rounded-full transition-all duration-500"
            style={{
              width: `${percentage * 100}%`,
              backgroundColor: statusColor,
            }}
          />
        </div>
      </div>

      {/* 触发条件列表 */}
      <div className="rounded-lg bg-zinc-900/40 border border-zinc-800/40 overflow-hidden">
        <div className="px-3 py-1.5 border-b border-zinc-800/40 flex items-center justify-between">
          <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-medium">
            触发条件 ({requiredInds.length})
          </span>
          <span className="text-[10px] text-zinc-600">need / now</span>
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
                className="flex items-center gap-2 px-3 py-2 hover:bg-zinc-800/20 transition-colors"
              >
                {isMatched ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                ) : (
                  <XCircle className="w-3.5 h-3.5 text-zinc-600 flex-shrink-0" />
                )}
                <span className="text-[10px] font-mono text-zinc-600 w-6 flex-shrink-0">
                  {indId.split("_")[0]}
                </span>
                <span className="text-xs text-zinc-300 flex-1 truncate" title={INDICATOR_THRESHOLDS[indId] || ""}>
                  {INDICATOR_NAMES[indId] || indId}
                </span>
                <span
                  className="text-[9px] text-amber-500/60 flex-shrink-0"
                  title={`reliability: ${reliability}`}
                >
                  {reliability}
                </span>
                <BtcIndicatorChart
                  symbol={indId}
                  data={seriesMap.get(indId) || []}
                  thresholds={thresholdsBySymbol.get(indId) ?? null}
                  currentState={currentState as BtcIndicatorState}
                  size="sparkline"
                  className="flex-shrink-0 opacity-80"
                />
                <div className="flex items-center gap-0.5 flex-shrink-0">
                  <span
                    className="text-[10px] font-medium px-1.5 py-0.5 rounded"
                    style={{
                      color: requiredCfg.color,
                      backgroundColor: `${requiredCfg.color}10`,
                    }}
                  >
                    {requiredCfg.label}
                  </span>
                  <span className="text-zinc-700 text-[10px] mx-0.5">/</span>
                  <span
                    className="text-[10px] font-medium px-1.5 py-0.5 rounded"
                    style={{
                      color: isMatched ? currentCfg.color : "#a1a1aa",
                      backgroundColor: isMatched
                        ? `${currentCfg.color}10`
                        : "rgb(63 63 70 / 0.3)",
                    }}
                  >
                    {currentCfg.label}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 历史验证 + 信号 label */}
      <div className="mt-3 flex items-center justify-between gap-2 text-[11px]">
        <div className="flex items-start gap-1.5 text-zinc-500 flex-1 min-w-0">
          <span className="flex-shrink-0">📜</span>
          <span className="leading-snug truncate">{PATTERN_HISTORICAL[patternId]}</span>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// L1 指标行组件（按 ★ 分级渲染）
// ============================================================================

function StateBadge({ state }: { state: BtcIndicatorState }) {
  const cfg = STATE_CONFIG[state] || STATE_CONFIG["neutral"]!;
  const Icon = cfg.icon;
  return (
    <div className="flex items-center gap-1 flex-shrink-0">
      <Icon className="w-3.5 h-3.5" style={{ color: cfg.color }} />
      <span className="text-xs font-medium" style={{ color: cfg.color }}>
        {cfg.label}
      </span>
    </div>
  );
}

function IndicatorRow({
  indId,
  state,
  data,
  thresholds,
  isLoading,
}: {
  indId: string;
  state: BtcIndicatorState;
  data: ChartSeriesPoint[];
  thresholds: BtcIndicatorChartThresholds | null;
  isLoading: boolean;
}) {
  const reliability = INDICATOR_RELIABILITY[indId] || "";
  const name = INDICATOR_NAMES[indId] || indId;
  const etfWarning = ETF_REINTERPRET[indId];
  const thresholdHint = INDICATOR_THRESHOLDS[indId];
  const isStar = reliability === "★";

  // ★ 等级（D2 / D4）：仅状态徽章 + 反向解读，不画 chart
  if (isStar) {
    return (
      <div className="rounded-lg p-3 bg-zinc-900/30 border border-zinc-800/40">
        <div className="flex items-center justify-between gap-2 mb-1.5">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-[10px] font-mono text-zinc-600 w-6 flex-shrink-0">
              {indId.split("_")[0]}
            </span>
            <span
              className="text-sm text-zinc-300 truncate"
              title={thresholdHint || undefined}
            >
              {name}
            </span>
            <span className="text-[10px] text-amber-500/70 flex-shrink-0">{reliability}</span>
          </div>
          <StateBadge state={state} />
        </div>
        {etfWarning && (
          <div className="text-[10px] text-amber-400/80 flex items-start gap-1 mt-1.5 leading-snug bg-amber-500/5 rounded px-2 py-1.5 border border-amber-500/15">
            <AlertTriangle className="w-3 h-3 mt-0.5 flex-shrink-0" />
            <span>{etfWarning}</span>
          </div>
        )}
      </div>
    );
  }

  // ★★ / ★★★：渲染 BtcIndicatorChart（有 numeric 阈值就画带，没有就裸曲线）
  const isCore = reliability === "★★★";
  const hasNumericThresholds =
    !!thresholds &&
    (typeof thresholds.accumulation === "number" ||
      typeof thresholds.distribution === "number");

  return (
    <div
      className={cn(
        "rounded-lg p-3 bg-zinc-900/30 border transition-colors",
        isCore ? "border-zinc-700/60" : "border-zinc-800/40"
      )}
    >
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-[10px] font-mono text-zinc-600 w-6 flex-shrink-0">
            {indId.split("_")[0]}
          </span>
          <span
            className="text-sm text-zinc-300 truncate"
            title={thresholdHint || undefined}
          >
            {name}
          </span>
          <span className="text-[10px] text-amber-500/70 flex-shrink-0" title="reliability">
            {reliability}
          </span>
        </div>
      </div>
      <BtcIndicatorChart
        symbol={indId}
        displayName={name}
        data={data}
        thresholds={thresholds}
        currentState={state}
        reliability={(reliability as "★★" | "★★★") || undefined}
        size="expanded"
        isLoading={isLoading}
      />
      {!hasNumericThresholds && data.length > 0 && (
        <div className="text-[10px] text-zinc-500 mt-1.5 leading-snug">
          {thresholdHint
            ? <>判定逻辑：<span className="text-zinc-400">{thresholdHint}</span>（无固定数值阈值带）</>
            : "按 percentile / 复合条件判定，无固定数值阈值带"}
        </div>
      )}
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
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const [mounted, setMounted] = useState(false);
  const triggerRef = useRef<HTMLDivElement>(null);
  const required = PATTERN_REQUIRED_STATES[patternId];

  useEffect(() => { setMounted(true); }, []);

  if (!required || Object.keys(required).length === 0) return null;

  const updatePos = () => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const tipW = 320;
    const tipH = Object.keys(required).length * 52 + 80;
    let top = rect.top - tipH - 8 + window.scrollY;
    let left = rect.left + window.scrollX;
    // 防止超出视口
    if (left + tipW > window.innerWidth - 12) left = window.innerWidth - tipW - 12;
    if (left < 12) left = 12;
    if (top < 12 + window.scrollY) top = rect.bottom + 8 + window.scrollY;
    setPos({ top, left });
  };

  const handleEnter = () => { setShow(true); updatePos(); };
  const handleLeave = () => { setShow(false); };

  const tooltipContent = (
    <div
      className="fixed z-[9999] pointer-events-none"
      style={{ top: `${pos.top}px`, left: `${pos.left}px`, opacity: show ? 1 : 0, transition: "opacity 150ms" }}
    >
      <div className="w-80 rounded-xl p-4 shadow-2xl shadow-black/60 bg-zinc-900 border border-zinc-700">
        <div className="text-xs text-zinc-400 font-semibold mb-3 flex items-center gap-2">
          <Eye className="w-3.5 h-3.5 text-zinc-500" />
          触发条件 — 需要全部满足
        </div>
        <div className="space-y-2.5">
          {Object.entries(required).map(([indId, reqState]) => {
            const currentState = indicatorStates[indId] || "neutral";
            const isMatch = currentState === reqState;
            const reqCfg = STATE_CONFIG[reqState] ?? STATE_CONFIG["neutral"]!;
            const curCfg = STATE_CONFIG[currentState] ?? STATE_CONFIG["neutral"]!;

            return (
              <div key={indId} className="rounded-lg bg-zinc-800/60 px-3 py-2">
                <div className="flex items-center gap-2 mb-1">
                  {isMatch ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                  ) : (
                    <XCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
                  )}
                  <span className="text-sm text-zinc-200 font-medium flex-1">
                    {INDICATOR_NAMES[indId] || indId}
                  </span>
                  <span className="text-xs font-medium px-1.5 py-0.5 rounded" style={{ color: curCfg.color, backgroundColor: `${curCfg.color}15` }}>
                    {curCfg.label}
                  </span>
                  <span className="text-zinc-600 text-xs">→</span>
                  <span className="text-xs font-medium px-1.5 py-0.5 rounded" style={{ color: reqCfg.color, backgroundColor: `${reqCfg.color}15` }}>
                    {reqCfg.label}
                  </span>
                </div>
                {INDICATOR_THRESHOLDS[indId] && (
                  <div className="text-[11px] text-zinc-500 ml-6">
                    {INDICATOR_THRESHOLDS[indId]}
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <div className="mt-3 pt-2 border-t border-zinc-700/50 text-[11px] text-zinc-500">
          当前状态 → 需要状态
        </div>
      </div>
    </div>
  );

  return (
    <>
      <div
        ref={triggerRef}
        className="mt-2"
        onMouseEnter={handleEnter}
        onMouseLeave={handleLeave}
      >
        <div className="flex items-center gap-1.5 cursor-help text-zinc-600 hover:text-zinc-300 transition-colors">
          <Eye className="w-3.5 h-3.5" />
          <span className="text-[11px]">触发条件</span>
        </div>
      </div>
      {mounted && typeof document !== "undefined" && createPortal(tooltipContent, document.body)}
    </>
  );
}
