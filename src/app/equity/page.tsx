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
import { IndicatorDictionary } from "@/components/IndicatorDictionary";
import dynamic from "next/dynamic";
const BacktestPanel = dynamic(
  () => import("@/components/BacktestPanel").then((m) => ({ default: m.BacktestPanel })),
  { ssr: false }
);
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
  ChevronDown,
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

// 模块名 → triggered_rules key 映射
const MODULE_TRIGGER_KEY: Record<string, string> = {
  fund_flow: "module_fund_flow",
  macro_overlay: "module_macro_overlay",
  market_breadth: "module_breadth",
  market_sentiment: "module_sentiment",
  price_volume: "module_price_volume",
  options_market: "module_options",
};

// 子指标中文标签
const SUB_INDICATOR_LABELS: Record<string, string> = {
  // 宏观覆盖层
  fed_funds: "联邦基金利率",
  yield_curve: "收益率曲线 2Y-10Y",
  real_rate: "实际利率 (TIPS)",
  credit_spread: "信用利差 (HY OAS)",
  ism_pmi: "ISM 制造业 PMI",
  initial_claims: "初领失业金",
  lei: "LEI 领先指标",
  // 资金流
  hyg_trend: "HYG 高收益债 ETF",
  lqd_trend: "LQD 投资级债 ETF",
  tactical_hyg_lqd: "战术 HYG/LQD 组合",
  margin_debt_yoy: "保证金债务 YoY",
  tic_cross_border: "TIC 跨境资金净流入",
  cot_asset_manager: "COT 资管净持仓",
  // 市场宽度
  rsp_spy_trend: "RSP/SPY 等权比值",
  sector_count: "板块参与度 (站上200DMA)",
  // 期权
  vix_term_structure: "VIX 期限结构",
  vvix: "VVIX 波动率的波动率",
  vix_monthly_avg: "VIX 月均值",
  // 情绪
  naaim: "NAAIM 经理人持仓",
  aaii_bear: "AAII 散户看空比例",
  // 价量
  SPX: "S&P 500",
  NDX: "Nasdaq 100",
  RUT: "Russell 2000",
};

// 7 因子中文名（顺序对应文档 §四）
const FACTOR_LABEL_MAP: Record<string, string> = {
  spx_trend: "SPX vs 200DMA",
  ad_line: "A/D Line 趋势",
  pct_above_200dma: "站上 200DMA 比例",
  eps_revision: "前瞻 EPS 修正",
  hy_oas: "信用利差 HY OAS",
  fed_policy: "Fed 政策",
  sentiment: "情绪 AAII/NAAIM",
};

// 因子投票的 4 个体制（单因子只投 BULL/EARLY_RECOVERY/LATE_CYCLE/BEAR，
// TRANSITION 仅是合议结果不作单因子投票，故矩阵列只展示 4 个）
const REGIME_ORDER = ["BULL", "EARLY_RECOVERY", "LATE_CYCLE", "BEAR"];

const REGIME_LABEL: Record<string, string> = {
  BULL: "牛市",
  EARLY_RECOVERY: "早期复苏",
  TRANSITION: "过渡",
  LATE_CYCLE: "晚周期",
  BEAR: "熊市",
};

// 7 因子在 5 体制下的判定文字（PDF §四原表）— 用于 tooltip
const FACTOR_REGIME_DESC: Record<string, Record<string, string>> = {
  spx_trend: {
    BULL: "在上方上升中", LATE_CYCLE: "在上方但趋平",
    BEAR: "在下方下降", EARLY_RECOVERY: "在下方但趋平", TRANSITION: "—",
  },
  ad_line: {
    BULL: "同步创新高", LATE_CYCLE: "与指数背离",
    BEAR: "持续创新低", EARLY_RECOVERY: "向上拐头", TRANSITION: "—",
  },
  pct_above_200dma: {
    BULL: ">65%", LATE_CYCLE: "45-65% 下降",
    BEAR: "<35%", EARLY_RECOVERY: "<35% 但回升", TRANSITION: "—",
  },
  eps_revision: {
    BULL: "净正值", LATE_CYCLE: "趋平",
    BEAR: "净负值", EARLY_RECOVERY: "转正", TRANSITION: "—",
  },
  hy_oas: {
    BULL: "<400bp", LATE_CYCLE: "从低位回升",
    BEAR: ">500bp", EARLY_RECOVERY: "见顶收窄", TRANSITION: "—",
  },
  fed_policy: {
    BULL: "中性至宽松", LATE_CYCLE: "紧缩中",
    BEAR: "限制性", EARLY_RECOVERY: "转向宽松", TRANSITION: "—",
  },
  sentiment: {
    BULL: "正常", LATE_CYCLE: "极度乐观",
    BEAR: "极度恐慌", EARLY_RECOVERY: "仍恐惧", TRANSITION: "—",
  },
};

// 因子原始值的展示格式化
function formatFactorValue(key: string, factor: any): string {
  if (!factor) return "—";
  if (key === "spx_trend") {
    const above = factor.spx_above_200dma;
    const slope = factor.spx_200dma_slope;
    return `${above ? "上方" : "下方"}${slope !== undefined ? `, 斜率 ${slope > 0 ? "+" : ""}${Number(slope).toFixed(2)}%/d` : ""}`;
  }
  if (key === "pct_above_200dma") return factor.value !== undefined ? `${Number(factor.value).toFixed(0)}%` : "—";
  if (key === "eps_revision") return factor.value !== undefined ? `${Number(factor.value).toFixed(0)} (Citi)` : "—";
  if (key === "hy_oas") return factor.value !== undefined ? `${Number(factor.value).toFixed(2)}%` : "—";
  if (key === "fed_policy") return factor.dff_3m_change !== undefined ? `Δ3M=${Number(factor.dff_3m_change).toFixed(2)}` : "—";
  if (key === "sentiment") return factor.naaim !== undefined ? `NAAIM=${Number(factor.naaim).toFixed(0)}` : "—";
  if (key === "ad_line") return factor.value !== undefined ? `${Number(factor.value).toFixed(0)}` : "—";
  return "—";
}

// 子指标数值单位声明（驱动数值格式化）
type SubIndicatorUnit = "usd_m" | "usd_b" | "percent" | "yoy_pct" | "ratio" | "bps" | "raw";
const SUB_INDICATOR_UNIT: Record<string, SubIndicatorUnit> = {
  margin_debt_yoy: "yoy_pct",
  tic_cross_border: "usd_m",
  cot_asset_manager: "raw",
  naaim: "raw",
  aaii_bear: "percent",
  fed_funds: "percent",
  yield_curve: "bps",
  real_rate: "percent",
  credit_spread: "bps",
};

function formatNumberByUnit(value: number, unit?: SubIndicatorUnit): string {
  if (unit === "yoy_pct" || unit === "percent") return `${value.toFixed(1)}%`;
  if (unit === "bps") return `${value.toFixed(0)} bps`;
  if (unit === "usd_m") return `$${value.toLocaleString("en", { maximumFractionDigits: 0 })}M`;
  if (unit === "usd_b") return `$${(value / 1000).toFixed(2)}B`;
  if (unit === "ratio") return value.toFixed(3);
  if (Math.abs(value) >= 1000)
    return value.toLocaleString("en", { maximumFractionDigits: 0 });
  return value.toFixed(2);
}

function humanizeState(s: string): string {
  const map: Record<string, string> = {
    stable: "持平",
    rising: "↑ 上升",
    falling: "↓ 下跌",
    expansion: "扩张",
    contraction: "收缩",
    neutral: "中性",
    above: "上方",
    below: "下方",
    bullish: "看多",
    bearish: "看空",
  };
  return map[s] || s;
}

interface ParsedSubValue {
  primary: string;
  secondary?: string;
  score?: number;
}

function parseSubValue(key: string, value: unknown): ParsedSubValue {
  const unit = SUB_INDICATOR_UNIT[key];
  if (value === null || value === undefined) return { primary: "—" };
  if (typeof value === "number") return { primary: formatNumberByUnit(value, unit) };
  if (typeof value === "string") return { primary: humanizeState(value) };
  if (typeof value === "boolean") return { primary: value ? "✓" : "✗" };
  if (typeof value !== "object") return { primary: String(value) };

  const obj = value as Record<string, unknown>;
  const score = typeof obj.score === "number" ? obj.score : undefined;

  // {hyg, lqd, score} — 双 ETF 状态
  if ("hyg" in obj && "lqd" in obj) {
    return {
      primary: `HYG ${humanizeState(String(obj.hyg))} · LQD ${humanizeState(String(obj.lqd))}`,
      score,
    };
  }
  // {above: bool, score} — 200DMA 位置
  if ("above" in obj && typeof obj.above === "boolean") {
    return {
      primary: obj.above ? "↑ 200DMA 上方" : "↓ 200DMA 下方",
      score,
    };
  }
  // {value: number, score} — 通用单值结构
  if (typeof obj.value === "number") {
    return {
      primary: formatNumberByUnit(obj.value, unit),
      score,
    };
  }
  // {vote, naaim} — sentiment factor
  if ("vote" in obj && typeof obj.naaim === "number") {
    return {
      primary: `NAAIM ${obj.naaim.toFixed(0)}`,
      secondary: `vote: ${String(obj.vote)}`,
      score,
    };
  }

  // 兜底：紧凑列出非 score 字段
  const flat = Object.entries(obj)
    .filter(([k2]) => k2 !== "score")
    .map(([k2, v]) => `${k2}: ${typeof v === "object" ? "…" : String(v).slice(0, 16)}`)
    .join(" · ");
  return { primary: flat || "—", score };
}

function SubIndicatorRow({ k, value }: { k: string; value: unknown }) {
  const label = SUB_INDICATOR_LABELS[k] || k;
  const parsed = parseSubValue(k, value);
  const hasScore = parsed.score !== undefined;
  const score = parsed.score ?? 0;
  const scoreColor =
    !hasScore || score === 0 ? "#71717a" : score > 0 ? "#10b981" : "#ef4444";

  return (
    <div className="text-xs">
      <div className="flex items-center justify-between gap-3 mb-1">
        <span className="text-zinc-500 truncate">{label}</span>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="font-mono text-zinc-300 text-right">{parsed.primary}</span>
          {hasScore && (
            <span
              className="font-mono font-medium tabular-nums w-9 text-right text-[11px]"
              style={{ color: scoreColor }}
            >
              {score > 0 ? "+" : ""}
              {score.toFixed(1)}
            </span>
          )}
        </div>
      </div>
      {parsed.secondary && (
        <div className="text-[10px] text-zinc-600 mb-1 ml-1">{parsed.secondary}</div>
      )}
      {hasScore && (
        <div className="relative h-1 rounded-full bg-zinc-800/60 overflow-hidden">
          <div
            className="absolute top-0 h-full rounded-full transition-all duration-500"
            style={{
              backgroundColor: scoreColor,
              left: "50%",
              width: `${Math.min(Math.abs(score), 2) * 25}%`,
              transform: score < 0 ? "translateX(-100%)" : "none",
            }}
          />
          <div className="absolute top-0 left-1/2 w-px h-full bg-zinc-700/60" />
        </div>
      )}
    </div>
  );
}

// ============================================================================
// 工具函数
// ============================================================================

function getRegimeColor(code: string): string {
  return REGIME_COLOR_MAP[code] || "#6b7280";
}

// ============================================================================
// FactorMatrix：7 因子 × 5 体制 投票矩阵
// ============================================================================

function FactorMatrix({ regime }: { regime: any }) {
  const factors = regime?.factors as Record<string, any> | undefined;
  const voteCounts = regime?.vote_counts as Record<string, number> | undefined;
  if (!factors || !voteCounts) return null;

  // 文档 §四：7 因子里 ≥5 个一致 = 多数派 → 确认体制；< 5 = 信号分裂 → TRANSITION
  const threshold = 5;

  const sortedVotes = Object.entries(voteCounts).sort((a, b) => b[1] - a[1]);
  const [topCode, topCount] = sortedVotes[0] || ["TRANSITION", 0];

  const isSplit = topCount < threshold;
  const distanceText = isSplit
    ? `距 ${REGIME_LABEL[topCode] || topCode} 切换还差 ${threshold - topCount} 个因子`
    : "信号确认";

  return (
    <div
      className="mb-8 rounded-[14px] border p-5"
      style={{ backgroundColor: "var(--bg-card)", borderColor: "#27272a" }}
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-zinc-400" />
          <h3 className="text-sm font-medium text-zinc-200">7 因子体制识别清单</h3>
        </div>
        <div className="text-xs text-zinc-400">{distanceText}</div>
      </div>

      {/* 投票统计 bar */}
      <div className="flex items-center gap-2 mb-4 text-xs flex-wrap">
        <span className="text-zinc-500">投票:</span>
        {REGIME_ORDER.filter((r) => (voteCounts[r] || 0) > 0).map((r) => (
          <span
            key={r}
            className="px-2 py-0.5 rounded"
            style={{
              backgroundColor: `${getRegimeColor(r)}20`,
              color: getRegimeColor(r),
            }}
          >
            {voteCounts[r]} {REGIME_LABEL[r]}
          </span>
        ))}
        <span className="text-zinc-500 ml-1">→</span>
        <span className="font-medium" style={{ color: getRegimeColor(regime.code) }}>
          {REGIME_LABEL[regime.code] || regime.code}
        </span>
        {isSplit && <span className="text-amber-500 text-[10px]">(信号分裂)</span>}
      </div>

      {/* 因子矩阵 */}
      <div className="space-y-1">
        <div className="grid grid-cols-[140px_repeat(4,_70px)_1fr] gap-2 text-[10px] text-zinc-500 px-2 py-1 border-b border-zinc-800">
          <div>因子</div>
          {REGIME_ORDER.map((r) => (
            <div key={r} className="text-center">
              {REGIME_LABEL[r]}
            </div>
          ))}
          <div className="text-zinc-400 pl-2">实测</div>
        </div>
        {Object.keys(FACTOR_LABEL_MAP).map((key) => {
          const factor = factors[key];
          if (!factor) return null;
          const voteCode = factor.vote;
          return (
            <div
              key={key}
              className="grid grid-cols-[140px_repeat(4,_70px)_1fr] gap-2 text-xs px-2 py-2 rounded hover:bg-zinc-900/30 transition-colors"
              title={FACTOR_REGIME_DESC[key]?.[voteCode] || ""}
            >
              <div className="text-zinc-300">{FACTOR_LABEL_MAP[key]}</div>
              {REGIME_ORDER.map((r) => (
                <div key={r} className="flex justify-center items-center h-5">
                  {r === voteCode ? (
                    <div
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: getRegimeColor(r) }}
                    />
                  ) : (
                    <div className="w-1 h-1 rounded-full bg-zinc-700" />
                  )}
                </div>
              ))}
              <div className="text-zinc-400 pl-2 text-[11px]">
                {formatFactorValue(key, factor)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
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
  const [expandedModule, setExpandedModule] = useState<string | null>("all");
  const [isLoading, setIsLoading] = useState(true);
  const [equityOutput, setEquityOutput] = useState<EquityOutput | null>(null);
  const [availableDates, setAvailableDates] = useState<string[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | undefined>();
  const historyRecords = useRef<HistoryRecord[]>([]);

  // 页面加载时获取最新数据
  useEffect(() => {
    const loadLatest = async () => {
      try {
        const [output, history] = await Promise.all([
          apiClient.getEquityOutput(),
          apiClient
            .getHistory(365)
            .catch(() => ({ records: [] as HistoryRecord[], total: 0, days: 365 })),
        ]);
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
            <div className="p-2 rounded-lg bg-zinc-800">
              <BarChart3 className="w-5 h-5 text-zinc-400" />
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
            <RefreshCw className="w-8 h-8 text-zinc-400 animate-spin mb-4" />
            <p className="text-zinc-500">加载最新数据...</p>
          </div>
        ) : !equityOutput ? (
          <div className="flex flex-col items-center justify-center py-24">
            <div className="relative mb-6">
              <div className="w-24 h-24 rounded-[14px] bg-[var(--bg-elevated)] flex items-center justify-center border border-[var(--border-subtle)]">
                <BarChart3 className="w-12 h-12 text-zinc-400 animate-float" />
              </div>
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
                className="relative rounded-[14px] p-6 overflow-hidden border"
                style={{
                  backgroundColor: 'var(--bg-card)',
                  borderColor: `${getRegimeColor(regime?.code || "TRANSITION")}40`,
                }}
              >
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
                className="relative rounded-[14px] p-6 overflow-hidden border bg-[var(--bg-card)]"
                style={{
                  borderColor: `${getScoreColor(equityOutput.weighted_score)}40`,
                }}
              >
                <div className="text-xs text-zinc-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5" />
                  加权总分
                </div>
                <div
                  className="text-4xl font-bold mb-1"
                  style={{ color: getScoreColor(equityOutput.weighted_score) }}
                >
                  {equityOutput.weighted_score > 0 ? "+" : ""}{equityOutput.weighted_score.toFixed(2)}
                </div>
                <div className="text-xs text-zinc-500 mb-3">
                  {equityOutput.weighted_score >= 1.5 ? "强烈看多" :
                   equityOutput.weighted_score >= 0.5 ? "偏多" :
                   equityOutput.weighted_score > -0.5 ? "中性" :
                   equityOutput.weighted_score > -1.5 ? "偏空" : "强烈看空"}
                  {" · 范围 -2 到 +2"}
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
                <div className="relative rounded-[14px] p-6 overflow-hidden bg-[var(--bg-card)] border border-[var(--border-subtle)]">
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
                        <span className="text-zinc-200 font-medium">
                          {allocation.equity_pct}%
                        </span>
                      </div>
                      <div className="h-2.5 rounded-full bg-zinc-800 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-zinc-400 transition-all duration-500"
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

            {/* ================================================================
                7 因子体制识别清单（vote_counts 存在时渲染，向后兼容）
                ================================================================ */}
            {regime?.factors && regime?.vote_counts && <FactorMatrix regime={regime} />}

            <div className="divider" />

            {/* ================================================================
                第二行：6 模块评分
                ================================================================ */}
            {modules.length > 0 && (
              <div className="mb-8">
                <h2 className="section-title">
                  <Layers className="w-5 h-5 text-zinc-400" />
                  模块评分
                </h2>
                <div className="grid grid-cols-3 gap-4">
                  {modules.map((mod) => {
                    const triggerKey = MODULE_TRIGGER_KEY[mod.name];
                    const triggerData = triggerKey ? equityOutput?.triggered_rules?.[triggerKey] : null;
                    const subInputs = triggerData?.input_values || {};
                    const isExpanded = expandedModule === "all" || expandedModule === mod.name;
                    const hasSubData = Object.keys(subInputs).length > 0;

                    return (
                      <div
                        key={mod.name}
                        className={cn(
                          "group relative rounded-[14px] p-4 overflow-hidden bg-[var(--bg-card)] border transition-all duration-300",
                          hasSubData ? "cursor-pointer hover:bg-[var(--bg-card-hover)]" : "",
                          isExpanded ? "border-zinc-600/50" : "border-[var(--border-subtle)]"
                        )}
                        onClick={() => hasSubData && setExpandedModule(isExpanded ? null : mod.name)}
                      >
                        <div className="flex items-center justify-between mb-3">
                          <div>
                            <div className="text-sm font-medium text-zinc-200 flex items-center gap-1.5">
                              {getModuleName(mod.name)}
                              {hasSubData && (
                                <ChevronDown
                                  className={cn(
                                    "w-3.5 h-3.5 text-zinc-500 transition-transform duration-200",
                                    isExpanded && "rotate-180"
                                  )}
                                />
                              )}
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

                        {/* 展开：子指标详情 */}
                        {isExpanded && hasSubData && (
                          <div className="mt-4 pt-3 border-t border-[var(--border-subtle)] space-y-2.5">
                            {Object.entries(subInputs).map(([key, value]) => (
                              <SubIndicatorRow key={key} k={key} value={value} />
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
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
                <div className="relative rounded-[14px] p-5 overflow-hidden bg-[var(--bg-card)] border border-[var(--border-subtle)]">
                  <h3 className="text-xs text-zinc-500 uppercase tracking-wider mb-4 flex items-center gap-1.5">
                    <TrendingUp className="w-4 h-4 text-zinc-400" />
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
                    <div className="mt-3 pt-3 border-t border-[var(--border-subtle)]">
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
                <div className="relative rounded-[14px] p-5 overflow-hidden bg-[var(--bg-card)] border border-[var(--border-subtle)]">
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
                    <FileText className="w-5 h-5 text-zinc-400" />
                    分析报告
                  </h2>
                  <div className="relative rounded-[14px] p-5 overflow-hidden bg-[var(--bg-card)] border border-[var(--border-subtle)]">
                    <pre className="text-sm text-zinc-300 whitespace-pre-wrap font-mono leading-relaxed">
                      {equityOutput.report_summary}
                    </pre>
                  </div>
                </div>
              </>
            )}

          </>
        )}

        {/* 信号回测 */}
        <div className="divider" />
        <BacktestPanel model="equity" />

        {/* 指标字典 — 始终显示，不依赖模型输出 */}
        <div className="divider" />
        <IndicatorDictionary modules={["Equity_MacroOverlay", "Equity_Breadth", "Equity_PriceVolume", "Equity_Options", "Equity_FundFlow", "Equity_Sentiment"]} defaultExpanded />
      </div>
    </div>
  );
}
