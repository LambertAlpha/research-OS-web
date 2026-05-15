/**
 * [INPUT]: /api/treasury-narrative 数据（react-query 60s 轮询）+ POST /api/model/run 触发运行
 * [OUTPUT]: 美债敘事判定系统 v1.0 Dashboard（13 敘事象限 / 27 指标 / 5 区布局）
 * [POS]: 路由 /treasury-narrative。完整 Pattern-first 布局，参考 BTC 页风格。
 *         Section 1 Hero（主敘事 + 信心度 + Kelly）
 *         Section 2 Banner（N-13 / 转换窗口，条件渲染）
 *         Section 3 13 Narrative Matrix（4 列网格）
 *         Section 4 Action Card（首选模型 / 倉位 / 对沖 / 避开）
 *         Section 5 27 Indicators Panel（POL/TERM/VOL/SUP/CRX 5 群）
 *         Section 6 Report / Backtest tabs
 *
 * [PROTOCOL]:
 * 1. 一旦本文件逻辑变更，必须同步更新此 Header。
 * 2. 13 敘事 / 27 指标元数据若与 yml / engine 漂移，必须以后端为准并同步本文件。
 */
"use client";

import { useCallback, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import dynamic from "next/dynamic";

import { Header } from "@/components/Header";
import apiClient, { fetchTreasuryNarrative } from "@/lib/api";
import { cn } from "@/lib/utils";

import type {
  EvidenceLevel,
  NarrativeId,
  TreasuryEvidenceItem,
  TreasuryIndicatorEvidence,
  TreasuryNarrativeAllScores,
  TreasuryNarrativeResponse,
} from "@/types/treasury-narrative";
import {
  CONFIDENCE_DISPLAY,
  INDICATOR_GROUPS,
  NARRATIVE_METADATA,
} from "@/types/treasury-narrative";

import {
  AlertCircle,
  AlertTriangle,
  Activity,
  ArrowLeftRight,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Circle,
  CircleDot,
  Clock,
  FileText,
  Gauge,
  LineChart,
  Layers,
  RefreshCw,
  ScrollText,
  ShieldAlert,
  Target,
  Wallet,
  XCircle,
  type LucideIcon,
} from "lucide-react";

const BacktestPanel = dynamic(
  () => import("@/components/BacktestPanel").then((m) => ({ default: m.BacktestPanel })),
  { ssr: false },
);

// ============================================================================
// 常量映射（与 config/rules_treasury_narrative.yml 对齐）
// ============================================================================

const CYCLE_LABEL: Record<string, string> = {
  reflation: "再通胀",
  soft_landing: "软着陆",
  hard_landing: "硬着陆",
  stagflation: "滞胀",
  pivot: "政策转向",
  special: "金融稳定特别",
};

const DRIVER_LABEL: Record<string, string> = {
  policy: "政策",
  inflation: "通胀",
  fiscal: "财政",
  supply_shock: "供应冲击",
  stability_event: "稳定事件",
};

const NARRATIVE_ORDER: NarrativeId[] = [
  "N-01", "N-02", "N-03", "N-04", "N-05", "N-06", "N-07",
  "N-08", "N-09", "N-10", "N-11", "N-12", "N-13",
];

// Evidence level → icon / color 映射（卡片展开显示 signature breakdown 用）
interface EvidenceLevelConfig {
  icon: LucideIcon;
  iconColor: string;
  label: string;
  chipClass: string;
}

const EVIDENCE_LEVEL_CONFIG: Record<EvidenceLevel, EvidenceLevelConfig> = {
  full: {
    icon: CheckCircle2,
    iconColor: "text-emerald-400",
    label: "✓ FULL",
    chipClass: "bg-emerald-500/10 text-emerald-300",
  },
  partial: {
    icon: CircleDot,
    iconColor: "text-amber-400",
    label: "◐ PART",
    chipClass: "bg-amber-500/10 text-amber-300",
  },
  reverse: {
    icon: ArrowLeftRight,
    iconColor: "text-red-400",
    label: "⟲ REVERSE",
    chipClass: "bg-red-500/10 text-red-300",
  },
  missing: {
    icon: AlertCircle,
    iconColor: "text-orange-400",
    label: "⚠ MISS",
    chipClass: "bg-orange-500/10 text-orange-300",
  },
  pending: {
    icon: Clock,
    iconColor: "text-zinc-500",
    label: "⏳ PEND",
    chipClass: "bg-zinc-700/30 text-zinc-400",
  },
  none: {
    icon: Circle,
    iconColor: "text-zinc-600",
    label: "·",
    chipClass: "bg-zinc-800/30 text-zinc-500",
  },
};

// 27 个指标的元数据（id → name + group + signature_count），与 yml 中 indicators / weight_summary 对齐
interface IndicatorMeta {
  id: string;
  group: keyof typeof INDICATOR_GROUPS;
  name_cn: string;
  weight: number;
  reliability: "★★★" | "★★" | "★";
}

const INDICATORS_META: IndicatorMeta[] = [
  // POL
  { id: "POL-01", group: "POL", name_cn: "Fed Funds Futures 12M 隐含路径", weight: 1.5, reliability: "★★★" },
  { id: "POL-02", group: "POL", name_cn: "Fed Path 偏离 (Market vs SEP)", weight: 1.5, reliability: "★★★" },
  { id: "POL-03", group: "POL", name_cn: "2Y Treasury Yield", weight: 1.0, reliability: "★★★" },
  { id: "POL-04", group: "POL", name_cn: "SOFR Futures 12M 远端", weight: 1.0, reliability: "★★" },
  { id: "POL-05", group: "POL", name_cn: "Fed 沟通情绪打分", weight: 1.0, reliability: "★★" },
  // TERM
  { id: "TERM-01", group: "TERM", name_cn: "2s10s 利差", weight: 1.5, reliability: "★★★" },
  { id: "TERM-02", group: "TERM", name_cn: "5s30s 利差", weight: 1.0, reliability: "★★" },
  { id: "TERM-03", group: "TERM", name_cn: "2s5s10s 蝶式", weight: 1.0, reliability: "★★" },
  { id: "TERM-04", group: "TERM", name_cn: "10Y TIPS 实质收益率", weight: 1.5, reliability: "★★★" },
  { id: "TERM-05", group: "TERM", name_cn: "10Y Breakeven 通胀", weight: 1.5, reliability: "★★★" },
  { id: "TERM-06", group: "TERM", name_cn: "5y5y 远期通胀预期", weight: 1.5, reliability: "★★★" },
  // VOL
  { id: "VOL-01", group: "VOL", name_cn: "MOVE Index", weight: 1.0, reliability: "★★★" },
  { id: "VOL-02", group: "VOL", name_cn: "MOVE 期限结构 (1M/3M)", weight: 1.0, reliability: "★★" },
  { id: "VOL-03", group: "VOL", name_cn: "Treasury VRP (波动风险溢价)", weight: 1.0, reliability: "★★" },
  { id: "VOL-04", group: "VOL", name_cn: "10Y Swaption Skew (25-Delta)", weight: 0.7, reliability: "★★" },
  // SUP
  { id: "SUP-01", group: "SUP", name_cn: "Treasury 标售综合分数", weight: 1.5, reliability: "★★★" },
  { id: "SUP-02", group: "SUP", name_cn: "财政脉冲 (12M 滚动赤字 % GDP)", weight: 1.5, reliability: "★★★" },
  { id: "SUP-03", group: "SUP", name_cn: "海外官方持仓 (Fed Custody)", weight: 1.5, reliability: "★★★" },
  { id: "SUP-04", group: "SUP", name_cn: "Primary Dealer 净仓位", weight: 1.0, reliability: "★★" },
  { id: "SUP-05", group: "SUP", name_cn: "CFTC COT — Treasury 期货", weight: 1.0, reliability: "★★" },
  { id: "SUP-06", group: "SUP", name_cn: "Basis Trade 规模（隐含）", weight: 1.5, reliability: "★★" },
  { id: "SUP-07", group: "SUP", name_cn: "Repo 压力 (SOFR-IORB)", weight: 0.7, reliability: "★★★" },
  // CRX
  { id: "CRX-01", group: "CRX", name_cn: "DXY (美元指数)", weight: 1.0, reliability: "★★★" },
  { id: "CRX-02", group: "CRX", name_cn: "HY OAS (高收益信用利差)", weight: 1.5, reliability: "★★★" },
  { id: "CRX-03", group: "CRX", name_cn: "SPX-Treasury 60d 相关性", weight: 1.5, reliability: "★★★" },
  { id: "CRX-04", group: "CRX", name_cn: "WTI 原油前月", weight: 1.0, reliability: "★★" },
  { id: "CRX-05", group: "CRX", name_cn: "Gold Spot (LBMA)", weight: 1.0, reliability: "★★" },
];

const INDICATOR_NAME_MAP = new Map(INDICATORS_META.map((i) => [i.id, i.name_cn]));

const GROUP_COLOR_CLASS: Record<keyof typeof INDICATOR_GROUPS, string> = {
  POL: "bg-blue-500/10 text-blue-300 border-blue-500/30",
  TERM: "bg-cyan-500/10 text-cyan-300 border-cyan-500/30",
  VOL: "bg-purple-500/10 text-purple-300 border-purple-500/30",
  SUP: "bg-amber-500/10 text-amber-300 border-amber-500/30",
  CRX: "bg-emerald-500/10 text-emerald-300 border-emerald-500/30",
};

const POSITION_BIAS_LABEL: Record<string, string> = {
  short_long_end_bear_steepener: "做空长端 · Bear Steepener",
  structural_bear_steepener: "结构性 Bear Steepener",
  bull_steepener_standard_dv01: "Bull Steepener · 标准 DV01",
  long_long_end: "做多长端",
  long_long_end_high_conviction: "做多长端（高确信）",
  long_long_end_tlt_tmf: "做多长端 · TLT/TMF",
  cash_only: "仅现金",
  cash_only_shy: "现金 + SHY",
  cash_only_full_stop: "现金 · 全部暂停",
  cash_and_short_end_shy: "现金 + SHY 短端",
  neutral_strict_dv01: "中性 · 严格 DV01",
  structural_short_long_end: "结构性做空长端",
  long_short_end_max_benefit: "做多短端（最大化收益）",
  long_short_end_zt_zf: "做多短端 · ZT/ZF",
  short_long_end_reduced_total_dv01: "做空长端 · 缩减总 DV01",
};

// ============================================================================
// 主页面
// ============================================================================

export default function TreasuryNarrativePage() {
  const [isRunning, setIsRunning] = useState(false);
  const [bottomTab, setBottomTab] = useState<"report" | "backtest">("report");

  const { data, isLoading, error, refetch } = useQuery<TreasuryNarrativeResponse>({
    queryKey: ["treasury-narrative"],
    queryFn: fetchTreasuryNarrative,
    refetchInterval: 60_000,
    retry: 1,
    staleTime: 30_000,
  });

  const handleRunModel = useCallback(async (date?: string) => {
    setIsRunning(true);
    try {
      await apiClient.runModel(date);
      await refetch();
    } catch (err) {
      console.error("Failed to run treasury_narrative model:", err);
    } finally {
      setIsRunning(false);
    }
  }, [refetch]);

  const payload = data?.treasury;
  const primary = payload?.primary_narrative;
  const confidence = payload?.confidence;
  const transition = payload?.transition_window;
  const indicatorEvidence = payload?.indicator_evidence ?? {};
  const allScoresMap = useMemo(() => {
    const m = new Map<string, TreasuryNarrativeAllScores>();
    (payload?.all_scores ?? []).forEach((s) => {
      if (typeof s.id === "string") m.set(s.id, s);
    });
    return m;
  }, [payload?.all_scores]);

  // primary 命中的 evidence indicators（用于 indicator panel 加亮）
  const primaryEvidenceMap = useMemo(() => {
    const m = new Map<string, TreasuryEvidenceItem>();
    primary?.evidence?.forEach((e) => m.set(e.indicator, e));
    return m;
  }, [primary?.evidence]);

  return (
    <div className="min-h-screen">
      <Header
        onRunModel={handleRunModel}
        isLoading={isRunning}
        lastUpdate={data?.run_ts}
        dataAsOf={data?.data_ts}
      />

      <div className="p-6">
        {/* 页面标题 */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-1">
            <div className="p-2 rounded-lg bg-indigo-500/10">
              <ScrollText className="w-5 h-5 text-indigo-300" />
            </div>
            <h1 className="text-2xl font-bold text-zinc-100">美债敘事判定系统</h1>
            {data?.model_version && (
              <span className="text-sm text-zinc-500">v{data.model_version}</span>
            )}
          </div>
          <p className="text-zinc-500 text-sm ml-12">
            13 敘事象限 × 27 指标 · 週度发布 · 模式识别 + 信心度 + Kelly 仓位
          </p>
        </div>

        {isLoading ? (
          <LoadingState />
        ) : error || !payload || !primary ? (
          <ErrorState
            isRunning={isRunning}
            onRun={() => handleRunModel()}
            message={error instanceof Error ? error.message : undefined}
          />
        ) : (
          <>
            {/* ============================================================
                Section 1 · HERO（主敘事卡片）
                ============================================================ */}
            <HeroCard
              primaryId={primary.id}
              matchScore={primary.match_score}
              evidence={primary.evidence}
              confidence={confidence}
              kellyMultiplier={payload.kelly_multiplier}
            />

            {/* ============================================================
                Section 2 · BANNER（N-13 / Transition Window）
                ============================================================ */}
            <BannerStack
              n13Triggered={payload.n13_triggered}
              n13EarlyWarning={payload.n13_early_warning}
              transition={transition}
              allScoresMap={allScoresMap}
              kelly={payload.kelly_multiplier}
            />

            {/* ============================================================
                Section 3 · 13 NARRATIVE MATRIX
                ============================================================ */}
            <NarrativeMatrix
              primaryId={primary.id}
              allScoresMap={allScoresMap}
              primaryEvidence={primary.evidence ?? []}
            />

            {/* ============================================================
                Section 4 · ACTION CARD
                ============================================================ */}
            <ActionCard
              action={payload.action}
              kelly={payload.kelly_multiplier}
              isN13={payload.n13_triggered}
            />

            {/* ============================================================
                Section 5 · 27 INDICATORS PANEL
                ============================================================ */}
            <IndicatorPanel
              indicatorEvidence={indicatorEvidence}
              primaryEvidenceMap={primaryEvidenceMap}
            />

            {/* ============================================================
                告警列表（如有）
                ============================================================ */}
            {data?.alerts && data.alerts.length > 0 && (
              <div className="mb-6">
                <h2 className="section-title">
                  <ShieldAlert className="w-5 h-5 text-amber-400" />
                  告警
                </h2>
                <div className="space-y-2">
                  {data.alerts.map((alert, i) => (
                    <div
                      key={i}
                      className={cn(
                        "flex items-start gap-3 p-3 rounded-xl border",
                        alert.level === "CRITICAL"
                          ? "bg-red-500/5 border-red-500/30"
                          : alert.level === "WARNING"
                            ? "bg-amber-500/5 border-amber-500/20"
                            : "bg-zinc-800/40 border-zinc-700/40",
                      )}
                    >
                      <AlertTriangle
                        className={cn(
                          "w-4 h-4 mt-0.5 flex-shrink-0",
                          alert.level === "CRITICAL"
                            ? "text-red-400"
                            : alert.level === "WARNING"
                              ? "text-amber-400"
                              : "text-zinc-400",
                        )}
                      />
                      <div>
                        <div className="text-xs font-medium text-zinc-300">
                          {alert.type}
                        </div>
                        <div className="text-xs text-zinc-400 mt-0.5">
                          {alert.message}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ============================================================
                Section 6 · REPORT / BACKTEST tabs
                ============================================================ */}
            <div className="divider" />
            <div className="mb-3 flex items-center gap-2">
              <button
                onClick={() => setBottomTab("report")}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors",
                  bottomTab === "report"
                    ? "bg-zinc-800 text-zinc-100"
                    : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50",
                )}
              >
                <FileText className="w-4 h-4" />
                文本日评
              </button>
              <button
                onClick={() => setBottomTab("backtest")}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors",
                  bottomTab === "backtest"
                    ? "bg-zinc-800 text-zinc-100"
                    : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50",
                )}
              >
                <LineChart className="w-4 h-4" />
                历史回测
              </button>
            </div>

            {bottomTab === "report" ? (
              <ReportPanel summary={data?.report_summary ?? ""} />
            ) : (
              <BacktestPanel model="treasury_narrative" defaultPriceSymbol="US10Y" />
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Section 1 · HERO
// ============================================================================

function HeroCard({
  primaryId,
  matchScore,
  evidence,
  confidence,
  kellyMultiplier,
}: {
  primaryId: string;
  matchScore: number;
  evidence: TreasuryEvidenceItem[];
  confidence: TreasuryNarrativeResponse["treasury"]["confidence"] | undefined;
  kellyMultiplier: number;
}) {
  const meta = NARRATIVE_METADATA[primaryId as NarrativeId];
  const confLevel = confidence?.level ?? "LOW";
  const confDisplay = CONFIDENCE_DISPLAY[confLevel];

  const fullCount = evidence.filter((e) => e.level === "full").length;
  const partialCount = evidence.filter((e) => e.level === "partial").length;
  const totalCount = evidence.length;

  return (
    <div className="mb-6 rounded-[14px] overflow-hidden bg-[var(--bg-card)] border border-indigo-500/30 relative">
      {/* 顶部亮条 */}
      <div className="absolute top-0 left-0 right-0 h-[2px] bg-indigo-400/60" />

      <div className="p-6">
        <div className="flex items-start justify-between gap-6 flex-wrap mb-4">
          {/* 左：主敘事身份 */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-1">
              <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-500">
                {primaryId} · 主敘事
              </span>
              {meta && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800/80 text-zinc-400">
                  {CYCLE_LABEL[meta.cycle] ?? meta.cycle} × {DRIVER_LABEL[meta.driver] ?? meta.driver}
                </span>
              )}
            </div>
            <h2 className="text-3xl font-bold text-zinc-100 leading-tight mb-1.5">
              {meta?.name_cn ?? primaryId}
            </h2>
            {meta && (
              <p className="text-sm text-zinc-400 leading-relaxed">
                {meta.short_description}
              </p>
            )}
          </div>

          {/* 右：信心度 + Kelly */}
          <div className="flex flex-col gap-2 items-end shrink-0">
            <div
              className={cn(
                "px-3 py-1.5 rounded-lg border text-sm font-medium flex items-center gap-2",
                confDisplay.colorClass,
              )}
            >
              <span>{confDisplay.emoji}</span>
              <span>信心度 · {confDisplay.label}</span>
              {confidence && (
                <span className="text-[10px] tabular-nums opacity-80">
                  Δ={confidence.delta.toFixed(1)}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 text-xs text-zinc-400">
              <Wallet className="w-3.5 h-3.5" />
              <span>Kelly ×</span>
              <span className="text-base font-bold text-zinc-100 tabular-nums">
                {kellyMultiplier.toFixed(2)}
              </span>
            </div>
            {confidence && confidence.move_value != null && (
              <div className="text-[10px] text-zinc-500">
                MOVE = {confidence.move_value.toFixed(1)} · 修正 × {confidence.move_factor.toFixed(2)}
              </div>
            )}
          </div>
        </div>

        {/* 匹配度进度条 */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-zinc-500 uppercase tracking-wider">匹配度</span>
            <span className="text-zinc-300 font-medium tabular-nums">
              {matchScore.toFixed(1)} / 100
            </span>
          </div>
          <div className="h-2 rounded-full bg-zinc-800/70 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-cyan-400 transition-all duration-500"
              style={{ width: `${Math.min(matchScore, 100)}%` }}
            />
          </div>
          <div className="flex items-center gap-3 text-xs text-zinc-400">
            <span>
              <span className="text-emerald-400 font-medium">{fullCount}</span>
              <span className="text-zinc-500"> full</span>
            </span>
            <span className="text-zinc-700">·</span>
            <span>
              <span className="text-amber-400 font-medium">{partialCount}</span>
              <span className="text-zinc-500"> partial</span>
            </span>
            <span className="text-zinc-700">·</span>
            <span className="text-zinc-500">
              共 {totalCount} 项 signature
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Section 2 · Banner stack
// ============================================================================

function BannerStack({
  n13Triggered,
  n13EarlyWarning,
  transition,
  allScoresMap,
  kelly,
}: {
  n13Triggered: boolean;
  n13EarlyWarning: boolean;
  transition: TreasuryNarrativeResponse["treasury"]["transition_window"] | undefined;
  allScoresMap: Map<string, TreasuryNarrativeAllScores>;
  kelly: number;
}) {
  if (!n13Triggered && !n13EarlyWarning && !transition?.triggered) return null;

  return (
    <div className="mb-6 space-y-3">
      {/* N-13 主触发：红色全宽 */}
      {n13Triggered && (
        <div className="rounded-xl p-4 bg-red-600/15 border border-red-600/40 flex items-start gap-3 animate-pulse">
          <ShieldAlert className="w-5 h-5 text-red-300 mt-0.5 flex-shrink-0" />
          <div>
            <div className="text-sm font-bold text-red-300">
              🚨 N-13 金融稳定特别状态触发
            </div>
            <div className="text-xs text-zinc-300 mt-1 leading-relaxed">
              全部交易模型暂停，持有现金 + SHY，等待 Fed 介入信号（SRF / 紧急 QE / SLR 豁免）。
              Kelly 强制 = 0。
            </div>
          </div>
        </div>
      )}

      {/* N-13 早期预警：琥珀 */}
      {!n13Triggered && n13EarlyWarning && (
        <div className="rounded-xl p-4 bg-amber-500/10 border border-amber-500/30 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-300 mt-0.5 flex-shrink-0" />
          <div>
            <div className="text-sm font-bold text-amber-300">
              ⚠️ N-13 早期预警
            </div>
            <div className="text-xs text-zinc-300 mt-1 leading-relaxed">
              单组触发条件命中但未构成主触发，主敘事信心度已降一级。密切监控 Basis Trade / Repo / MOVE。
            </div>
          </div>
        </div>
      )}

      {/* 转换窗口：琥珀 */}
      {transition?.triggered && (
        <div className="rounded-xl p-4 bg-amber-500/10 border border-amber-500/30 flex items-start gap-3">
          <Activity className="w-5 h-5 text-amber-300 mt-0.5 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="text-sm font-bold text-amber-300">
              ⚠️ 敘事转换窗口触发
            </div>
            <div className="text-xs text-zinc-300 mt-1 leading-relaxed">
              触发条件：
              <span className="text-zinc-200 ml-1">
                {(transition.triggers ?? []).join(", ") || "—"}
              </span>
            </div>
            {transition.candidates && transition.candidates.length > 0 && (
              <div className="text-xs text-zinc-300 mt-2 flex flex-wrap items-center gap-2">
                <span className="text-zinc-500">候选敘事：</span>
                {transition.candidates.map((cid, i) => {
                  const score = allScoresMap.get(cid)?.score;
                  const cMeta = NARRATIVE_METADATA[cid as NarrativeId];
                  return (
                    <span key={`${cid}-${i}`} className="inline-flex items-center gap-1">
                      <span className="px-2 py-0.5 rounded bg-zinc-800/80 text-zinc-200 font-mono text-[11px]">
                        {cid}
                      </span>
                      {cMeta && (
                        <span className="text-zinc-400">{cMeta.name_cn}</span>
                      )}
                      {typeof score === "number" && (
                        <span className="text-zinc-500 tabular-nums">
                          ({score.toFixed(1)})
                        </span>
                      )}
                      {i < transition.candidates.length - 1 && (
                        <span className="text-zinc-700 mx-1">↔</span>
                      )}
                    </span>
                  );
                })}
              </div>
            )}
            <div className="text-xs text-zinc-400 mt-2">
              动作偏向：保守（保护下行 优于 追求上行），Kelly × {kelly.toFixed(2)}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Section 3 · 13 Narrative Matrix
// ============================================================================

function NarrativeMatrix({
  primaryId,
  allScoresMap,
  primaryEvidence,
}: {
  primaryId: string;
  allScoresMap: Map<string, TreasuryNarrativeAllScores>;
  primaryEvidence: TreasuryEvidenceItem[];
}) {
  return (
    <div className="mb-8">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <h2 className="section-title !mb-0">
          <Layers className="w-5 h-5 text-indigo-300" />
          13 敘事象限矩阵
        </h2>
        <div className="text-[11px] text-zinc-500 flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-indigo-400" />
            <span>主敘事</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-amber-400" />
            <span>接近触发 (≥40)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-zinc-600" />
            <span>未触发</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        {NARRATIVE_ORDER.map((nid) => {
          const isPrimary = nid === primaryId;
          return (
            <NarrativeMatrixCard
              key={nid}
              narrativeId={nid}
              isPrimary={isPrimary}
              score={allScoresMap.get(nid)}
              primaryEvidenceFallback={isPrimary ? primaryEvidence : undefined}
            />
          );
        })}
      </div>
    </div>
  );
}

function NarrativeMatrixCard({
  narrativeId,
  isPrimary,
  score,
  primaryEvidenceFallback,
}: {
  narrativeId: NarrativeId;
  isPrimary: boolean;
  score: TreasuryNarrativeAllScores | undefined;
  primaryEvidenceFallback?: TreasuryEvidenceItem[];
}) {
  const meta = NARRATIVE_METADATA[narrativeId];
  const matchScore = score?.score ?? 0;
  const activeEvidence = score?.active_evidence ?? 0;
  // 优先使用 all_scores 里的 evidence（新后端契约）；fallback 到主敘事的 evidence（兼容旧后端）
  const evidence =
    score?.evidence && score.evidence.length > 0
      ? score.evidence
      : isPrimary && primaryEvidenceFallback
        ? primaryEvidenceFallback
        : [];
  const totalSignatureCount = score?.total_signature_count ?? evidence.length;
  const isNear = !isPrimary && matchScore >= 40;

  // primary 默认展开，其余默认折叠（突出主敘事的 signature breakdown）
  const [expanded, setExpanded] = useState(isPrimary);

  const fullCount = evidence.filter((e) => e.level === "full").length;
  const partialCount = evidence.filter((e) => e.level === "partial").length;
  const reverseCount = evidence.filter((e) => e.level === "reverse").length;

  const stateLabel = isPrimary ? "✅ 主敘事" : isNear ? "🟡 接近触发" : "未触发";
  const statusColor = isPrimary ? "#818cf8" : isNear ? "#fbbf24" : "#52525b";

  return (
    <div
      className={cn(
        "relative rounded-[12px] p-4 border bg-[var(--bg-card)] transition-all",
        isPrimary
          ? "border-indigo-400/60 ring-2 ring-indigo-500/30"
          : isNear
            ? "border-amber-500/40"
            : "border-zinc-800/60 opacity-70",
      )}
    >
      {/* 主敘事顶部亮条 */}
      {isPrimary && (
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-indigo-400 rounded-t-[12px]" />
      )}

      {/* 顶部 mini header */}
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-[10px] font-mono text-zinc-500 flex-shrink-0">
            {narrativeId}
          </span>
          <span className="text-[10px] text-zinc-500 truncate">
            {CYCLE_LABEL[meta.cycle] ?? meta.cycle} × {DRIVER_LABEL[meta.driver] ?? meta.driver}
          </span>
        </div>
        <span
          className="text-[9px] font-medium px-1.5 py-0.5 rounded uppercase tracking-wider whitespace-nowrap flex-shrink-0"
          style={{ backgroundColor: `${statusColor}20`, color: statusColor }}
        >
          {stateLabel}
        </span>
      </div>

      {/* 中部：名称 + 描述 */}
      <h3 className="text-sm font-bold text-zinc-100 mb-1 leading-snug">
        {meta.name_cn}
      </h3>
      <p className="text-[11px] text-zinc-500 mb-3 leading-relaxed line-clamp-2 min-h-[28px]">
        {meta.short_description}
      </p>

      {/* 进度条 */}
      <div className="mb-2">
        <div className="flex items-baseline justify-between mb-1">
          <span
            className="text-xl font-bold tabular-nums leading-none"
            style={{ color: statusColor }}
          >
            {matchScore.toFixed(1)}
          </span>
          <span className="text-[10px] text-zinc-500 tabular-nums">/ 100</span>
        </div>
        <div className="h-1 rounded-full bg-zinc-800/70 overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${Math.min(matchScore, 100)}%`,
              backgroundColor: statusColor,
            }}
          />
        </div>
      </div>

      {/* 命中度行（学 HERO 风格，展示 full/partial/reverse 分布）*/}
      <div className="text-[10px] text-zinc-500 flex items-center gap-1.5 flex-wrap">
        {evidence.length > 0 ? (
          <>
            <span>
              <span className="text-emerald-400 font-medium">{fullCount}</span>
              <span className="text-zinc-600"> full</span>
            </span>
            <span className="text-zinc-700">·</span>
            <span>
              <span className="text-amber-400 font-medium">{partialCount}</span>
              <span className="text-zinc-600"> partial</span>
            </span>
            {reverseCount > 0 && (
              <>
                <span className="text-zinc-700">·</span>
                <span>
                  <span className="text-red-400 font-medium">{reverseCount}</span>
                  <span className="text-zinc-600"> reverse</span>
                </span>
              </>
            )}
            <span className="text-zinc-700">·</span>
            <span className="text-zinc-500">共 {totalSignatureCount} 项</span>
          </>
        ) : (
          <span>
            命中 <span className="text-zinc-300 font-medium">{activeEvidence}</span> active · 共 {totalSignatureCount} 项
          </span>
        )}
        <span className="truncate ml-auto text-zinc-600">{meta.typical_lifespan}</span>
      </div>

      {/* N-13 标记 */}
      {meta.is_override && (
        <div className="mt-2 text-[10px] text-red-400/80 flex items-center gap-1 border-t border-zinc-800/60 pt-2">
          <ShieldAlert className="w-3 h-3" />
          覆盖层 · 优先于所有其他敘事
        </div>
      )}

      {/* 展开按钮（仅在 evidence 非空时显示，学 BTC Pattern 展开块）*/}
      {evidence.length > 0 && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className={cn(
            "mt-2.5 w-full text-[11px] flex items-center justify-center gap-1 py-1 border-t transition-colors",
            isPrimary
              ? "border-indigo-500/30 text-indigo-300 hover:text-indigo-200"
              : isNear
                ? "border-amber-500/20 text-amber-300/80 hover:text-amber-200"
                : "border-zinc-800/60 text-zinc-500 hover:text-zinc-300",
          )}
          aria-expanded={expanded}
        >
          <ChevronDown
            className={cn(
              "w-3 h-3 transition-transform",
              expanded && "rotate-180",
            )}
          />
          {expanded ? "收起" : `展开 ${evidence.length} 项指标详情`}
        </button>
      )}

      {/* Signature breakdown 详情（点击展开）*/}
      {expanded && evidence.length > 0 && (
        <div className="mt-2 space-y-1.5">
          {evidence.map((e, i) => (
            <EvidenceRow key={`${e.indicator}-${i}`} evidence={e} />
          ))}
        </div>
      )}
    </div>
  );
}

function EvidenceRow({ evidence }: { evidence: TreasuryEvidenceItem }) {
  const config =
    EVIDENCE_LEVEL_CONFIG[evidence.level] ?? EVIDENCE_LEVEL_CONFIG.none;
  const Icon = config.icon;
  const indicatorName = INDICATOR_NAME_MAP.get(evidence.indicator);
  const contribution = evidence.contribution ?? 0;
  const weight = evidence.weight ?? 0;
  const featureValue = evidence.feature_value;

  const formattedFeatureValue = (() => {
    if (featureValue == null || !Number.isFinite(featureValue)) return "—";
    if (Math.abs(featureValue) >= 1000) return featureValue.toFixed(0);
    if (Math.abs(featureValue) >= 10) return featureValue.toFixed(2);
    return featureValue.toFixed(3);
  })();

  return (
    <div className="rounded-md bg-zinc-800/40 px-2.5 py-1.5">
      <div className="flex items-center gap-1.5 mb-0.5">
        <Icon className={cn("w-3.5 h-3.5 flex-shrink-0", config.iconColor)} />
        <span className="text-xs text-zinc-200 font-medium font-mono flex-shrink-0">
          {evidence.indicator}
        </span>
        <span
          className={cn(
            "text-[10px] font-medium px-1.5 py-0.5 rounded whitespace-nowrap flex-shrink-0",
            config.chipClass,
          )}
        >
          {config.label}
        </span>
        <span
          className={cn(
            "text-[10px] font-mono w-14 text-right ml-auto tabular-nums flex-shrink-0",
            contribution > 0
              ? "text-emerald-400"
              : contribution < 0
                ? "text-red-400"
                : "text-zinc-500",
          )}
        >
          {contribution > 0 ? "+" : ""}
          {contribution.toFixed(2)}
        </span>
      </div>
      <div className="text-[10px] text-zinc-500 ml-5 flex gap-2 items-center">
        {indicatorName ? (
          <span className="text-zinc-400 truncate" title={indicatorName}>
            {indicatorName}
          </span>
        ) : (
          <span className="text-zinc-600">—</span>
        )}
        <span className="ml-auto whitespace-nowrap">
          now:{" "}
          <span className="text-zinc-300 tabular-nums">
            {formattedFeatureValue}
          </span>
        </span>
        <span className="whitespace-nowrap">
          w{" "}
          <span className="text-zinc-400 tabular-nums">{weight.toFixed(1)}</span>
        </span>
      </div>
    </div>
  );
}

// ============================================================================
// Section 4 · Action Card
// ============================================================================

function ActionCard({
  action,
  kelly,
  isN13,
}: {
  action: TreasuryNarrativeResponse["treasury"]["action"];
  kelly: number;
  isN13: boolean;
}) {
  const positionLabel = POSITION_BIAS_LABEL[action.position_bias] ?? action.position_bias;

  return (
    <div className="mb-8">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <h2 className="section-title !mb-0">
          <Target className="w-5 h-5 text-indigo-300" />
          本週动作清单
        </h2>
        <div className="flex items-center gap-2 text-xs text-zinc-400">
          <Gauge className="w-3.5 h-3.5" />
          <span>Kelly × </span>
          <span className="text-base font-bold text-zinc-100 tabular-nums">
            {kelly.toFixed(2)}
          </span>
          {isN13 && (
            <span className="ml-2 text-red-400 font-medium text-[11px]">
              (N-13 强制 0)
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* 首选模型 */}
        <ActionCol
          icon={<Target className="w-4 h-4 text-emerald-400" />}
          title="首选模型"
          colorClass="emerald"
          items={action.preferred_models}
          emptyLabel={isN13 ? "全部暂停" : "无明确首选"}
        />

        {/* 倉位偏向 */}
        <div className="rounded-[12px] p-4 border border-zinc-800/60 bg-[var(--bg-card)]">
          <div className="flex items-center gap-2 text-[10px] text-zinc-500 uppercase tracking-wider mb-2">
            <Wallet className="w-4 h-4 text-amber-400" />
            倉位偏向
          </div>
          {action.position_bias ? (
            <div className="text-sm text-amber-200 font-medium leading-snug">
              {positionLabel}
            </div>
          ) : (
            <div className="text-xs text-zinc-500 italic">未指定</div>
          )}
          <div className="text-[10px] text-zinc-600 mt-2 font-mono">
            {action.position_bias}
          </div>
        </div>

        {/* 对沖 */}
        <ActionCol
          icon={<ShieldAlert className="w-4 h-4 text-cyan-400" />}
          title="对沖建议"
          colorClass="cyan"
          items={action.hedge}
          emptyLabel="无对沖"
        />

        {/* 避开 */}
        <ActionCol
          icon={<XCircle className="w-4 h-4 text-red-400" />}
          title="避开策略"
          colorClass="red"
          items={action.avoid}
          emptyLabel="无禁止"
        />
      </div>

      {/* note + exit_condition */}
      {(action.note || action.exit_condition) && (
        <div className="mt-3 px-4 py-2.5 rounded-lg bg-zinc-900/40 border border-zinc-800/40 text-xs text-zinc-400 leading-relaxed">
          {action.note && (
            <div>
              <span className="text-zinc-500 mr-2">注释：</span>
              {action.note}
            </div>
          )}
          {action.exit_condition && (
            <div className="mt-1">
              <span className="text-zinc-500 mr-2">退出条件：</span>
              <span className="text-amber-300">{action.exit_condition}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ActionCol({
  icon,
  title,
  colorClass,
  items,
  emptyLabel,
}: {
  icon: React.ReactNode;
  title: string;
  colorClass: "emerald" | "cyan" | "red" | "amber";
  items: string[];
  emptyLabel: string;
}) {
  const colorMap = {
    emerald: "bg-emerald-500/10 text-emerald-300 border-emerald-500/30",
    cyan: "bg-cyan-500/10 text-cyan-300 border-cyan-500/30",
    red: "bg-red-500/10 text-red-300 border-red-500/30",
    amber: "bg-amber-500/10 text-amber-300 border-amber-500/30",
  } as const;

  return (
    <div className="rounded-[12px] p-4 border border-zinc-800/60 bg-[var(--bg-card)]">
      <div className="flex items-center gap-2 text-[10px] text-zinc-500 uppercase tracking-wider mb-2">
        {icon}
        {title}
      </div>
      {items && items.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {items.map((item, i) => (
            <span
              key={`${item}-${i}`}
              className={cn(
                "px-2 py-0.5 rounded text-[11px] font-mono border",
                colorMap[colorClass],
              )}
            >
              {item}
            </span>
          ))}
        </div>
      ) : (
        <div className="text-xs text-zinc-500 italic">{emptyLabel}</div>
      )}
    </div>
  );
}

// ============================================================================
// Section 5 · 27 Indicators Panel
// ============================================================================

function IndicatorPanel({
  indicatorEvidence,
  primaryEvidenceMap,
}: {
  indicatorEvidence: Record<string, TreasuryIndicatorEvidence>;
  primaryEvidenceMap: Map<string, TreasuryEvidenceItem>;
}) {
  const [activeGroup, setActiveGroup] = useState<keyof typeof INDICATOR_GROUPS | "ALL">("ALL");

  const groupKeys = Object.keys(INDICATOR_GROUPS) as (keyof typeof INDICATOR_GROUPS)[];

  const visibleIndicators = useMemo(() => {
    if (activeGroup === "ALL") return INDICATORS_META;
    return INDICATORS_META.filter((i) => i.group === activeGroup);
  }, [activeGroup]);

  return (
    <div className="mb-8">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <h2 className="section-title !mb-0">
          <Activity className="w-5 h-5 text-indigo-300" />
          27 指标看板（5 群）
        </h2>
        <div className="text-[11px] text-zinc-500 flex items-center gap-3">
          <span className="flex items-center gap-1.5">
            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
            <span>命中主敘事</span>
          </span>
          <span className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-zinc-500" />
            <span>active</span>
          </span>
          <span className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-red-400" />
            <span>missing</span>
          </span>
        </div>
      </div>

      {/* Group tab 切换 */}
      <div className="flex items-center gap-1.5 mb-4 flex-wrap">
        <button
          onClick={() => setActiveGroup("ALL")}
          className={cn(
            "px-3 py-1 rounded-lg text-xs font-medium transition-colors border",
            activeGroup === "ALL"
              ? "bg-zinc-800 text-zinc-100 border-zinc-700"
              : "bg-zinc-900/30 text-zinc-400 border-zinc-800/60 hover:text-zinc-200",
          )}
        >
          全部 27
        </button>
        {groupKeys.map((g) => {
          const meta = INDICATOR_GROUPS[g];
          const count = INDICATORS_META.filter((i) => i.group === g).length;
          const active = activeGroup === g;
          return (
            <button
              key={g}
              onClick={() => setActiveGroup(g)}
              className={cn(
                "px-3 py-1 rounded-lg text-xs font-medium transition-colors border",
                active
                  ? GROUP_COLOR_CLASS[g]
                  : "bg-zinc-900/30 text-zinc-400 border-zinc-800/60 hover:text-zinc-200",
              )}
            >
              <span className="font-mono">{g}</span>
              <span className="ml-1.5 opacity-70">{meta.name_cn}</span>
              <span className="ml-1.5 text-[10px] opacity-60">({count})</span>
            </button>
          );
        })}
      </div>

      {/* group description（仅在某 group active 时显示） */}
      {activeGroup !== "ALL" && (
        <div className="text-[11px] text-zinc-500 mb-3 px-3 py-2 rounded-lg bg-zinc-900/30 border border-zinc-800/40">
          <span className="text-zinc-400 font-medium mr-2">
            {INDICATOR_GROUPS[activeGroup].name_cn}
          </span>
          · 权重 {INDICATOR_GROUPS[activeGroup].weight}
          · {INDICATOR_GROUPS[activeGroup].description}
        </div>
      )}

      {/* indicator 卡片网格 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2.5">
        {visibleIndicators.map((meta) => {
          const evidence = indicatorEvidence[meta.id];
          const primaryHit = primaryEvidenceMap.get(meta.id);
          return (
            <IndicatorCard
              key={meta.id}
              meta={meta}
              evidence={evidence}
              primaryHit={primaryHit}
            />
          );
        })}
      </div>
    </div>
  );
}

function IndicatorCard({
  meta,
  evidence,
  primaryHit,
}: {
  meta: IndicatorMeta;
  evidence: TreasuryIndicatorEvidence | undefined;
  primaryHit: TreasuryEvidenceItem | undefined;
}) {
  const status = evidence?.status ?? "missing";
  const value = evidence?.value;
  const isHit = !!primaryHit && (primaryHit.level === "full" || primaryHit.level === "partial");
  const isMissing = !evidence || !evidence.available || status === "missing";
  const isPending = status === "pending";

  const formattedValue = useMemo(() => {
    if (value == null || !Number.isFinite(value)) return null;
    if (Math.abs(value) >= 1000) return value.toFixed(0);
    if (Math.abs(value) >= 10) return value.toFixed(2);
    return value.toFixed(3);
  }, [value]);

  return (
    <div
      className={cn(
        "rounded-lg p-3 border bg-[var(--bg-card)] transition-colors",
        isMissing
          ? "border-red-500/40 bg-red-500/5"
          : isHit
            ? "border-emerald-500/40 bg-emerald-500/5"
            : isPending
              ? "border-zinc-700/40 bg-zinc-900/30 opacity-70"
              : "border-zinc-800/60",
      )}
    >
      {/* Header: id + group + reliability */}
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-[10px] font-mono text-zinc-500 flex-shrink-0">
            {meta.id}
          </span>
          <span
            className={cn(
              "text-[9px] px-1 py-0.5 rounded font-mono border",
              GROUP_COLOR_CLASS[meta.group],
            )}
          >
            {meta.group}
          </span>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          {isHit && (
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
          )}
          {isMissing && <AlertTriangle className="w-3.5 h-3.5 text-red-400" />}
          <span className="text-[9px] text-amber-500/70" title={`reliability ${meta.reliability}`}>
            {meta.reliability}
          </span>
        </div>
      </div>

      {/* Name */}
      <div className="text-xs text-zinc-200 mb-2 leading-snug line-clamp-2 min-h-[32px]">
        {meta.name_cn}
      </div>

      {/* Value + Status */}
      <div className="flex items-end justify-between gap-2 mb-1.5">
        <div className="min-w-0">
          {formattedValue != null ? (
            <div className="text-base font-bold text-zinc-100 tabular-nums leading-none">
              {formattedValue}
            </div>
          ) : (
            <div className="text-base text-zinc-600 leading-none">—</div>
          )}
        </div>
        <StatusChip status={status} isMissing={isMissing} />
      </div>

      {/* Weight + Primary hit info */}
      <div className="flex items-center justify-between gap-2 text-[10px] text-zinc-500">
        <span>weight {meta.weight.toFixed(1)}</span>
        {isHit && primaryHit && (
          <span className="text-emerald-400 font-medium uppercase tracking-wider">
            ✓ {primaryHit.level}
          </span>
        )}
        {!isHit && primaryHit?.level === "reverse" && (
          <span className="text-red-400 font-medium uppercase tracking-wider">
            reverse
          </span>
        )}
      </div>

      {/* reason hint（如有） */}
      {evidence?.reason && (
        <div className="mt-1.5 pt-1.5 border-t border-zinc-800/40 text-[10px] text-zinc-500 italic leading-snug line-clamp-2">
          {evidence.reason}
        </div>
      )}
    </div>
  );
}

function StatusChip({ status, isMissing }: { status: string; isMissing: boolean }) {
  if (isMissing) {
    return (
      <span className="text-[9px] font-medium px-1.5 py-0.5 rounded bg-red-500/20 text-red-300 uppercase tracking-wider">
        missing
      </span>
    );
  }
  if (status === "pending") {
    return (
      <span className="text-[9px] font-medium px-1.5 py-0.5 rounded bg-zinc-700/40 text-zinc-400 uppercase tracking-wider">
        pending
      </span>
    );
  }
  return (
    <span className="text-[9px] font-medium px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-300 uppercase tracking-wider">
      active
    </span>
  );
}

// ============================================================================
// Section 6 helpers · Report panel
// ============================================================================

function ReportPanel({ summary }: { summary: string }) {
  if (!summary) {
    return (
      <div className="rounded-[14px] p-5 bg-[var(--bg-card)] border border-[var(--border-subtle)]">
        <div className="text-sm text-zinc-500 italic">本週无报告文本。</div>
      </div>
    );
  }
  return (
    <div className="rounded-[14px] p-5 bg-[var(--bg-card)] border border-[var(--border-subtle)]">
      <pre className="text-sm text-zinc-300 whitespace-pre-wrap font-mono leading-relaxed">
        {summary}
      </pre>
    </div>
  );
}

// ============================================================================
// Loading / Error states
// ============================================================================

function LoadingState() {
  return (
    <div className="flex flex-col items-center justify-center py-24">
      <RefreshCw className="w-8 h-8 text-indigo-300 animate-spin mb-4" />
      <p className="text-zinc-500">加载美债敘事数据...</p>
    </div>
  );
}

function ErrorState({
  isRunning,
  onRun,
  message,
}: {
  isRunning: boolean;
  onRun: () => void;
  message?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-24">
      <div className="relative mb-6">
        <div className="w-24 h-24 rounded-[14px] bg-[var(--bg-card)] flex items-center justify-center border border-[var(--border-subtle)]">
          <ScrollText className="w-12 h-12 text-indigo-300 animate-float" />
        </div>
      </div>
      <h2 className="text-xl font-semibold text-zinc-200 mb-2">暂无数据</h2>
      <p className="text-zinc-500 text-sm mb-1">尚未产出 treasury_narrative 模型输出</p>
      {message && (
        <p className="text-[11px] text-zinc-600 mb-4 max-w-md text-center font-mono">
          {message}
        </p>
      )}
      <button
        onClick={onRun}
        disabled={isRunning}
        className={cn(
          "mt-4 px-4 py-2 rounded-lg text-sm font-medium border transition-colors flex items-center gap-2",
          isRunning
            ? "bg-zinc-800 text-zinc-500 border-zinc-700 cursor-not-allowed"
            : "bg-indigo-500/15 text-indigo-200 border-indigo-500/40 hover:bg-indigo-500/25",
        )}
      >
        {isRunning ? (
          <>
            <RefreshCw className="w-4 h-4 animate-spin" />
            正在运行...
          </>
        ) : (
          <>
            <ChevronRight className="w-4 h-4" />
            运行模型
          </>
        )}
      </button>
    </div>
  );
}

// Side-effect helper to avoid unused warnings if any helper accidentally trimmed
void INDICATOR_NAME_MAP;
