/**
 * [INPUT]: (symbol, displayName?, data: ChartSeriesPoint[], thresholds?, currentState, reliability?, size?, className?, isLoading?)
 *          — BTC v8.0 指标的时序点 + 累积/释放阈值 + 当前状态 + 模式（sparkline | expanded）。
 * [OUTPUT]: (<div>) — 纯 SVG 图表组件，渲染指标走势曲线 + 阈值带 + 状态着色。
 *           sparkline 模式：80x24 行内紧凑折线；expanded 模式：全宽 96–120px 大图，带 3 段染色阈值带 + 阈值虚线 + 当前值徽章 + 状态徽章。
 *           Loading 显示骨架；Empty 显示"等待数据接入"；缺阈值时仅画曲线。
 * [POS]: 位于 /components，被 BTC Dashboard 的 L1 全指标看板（★★★ 级核心指标）引用。
 *         作为 src/app/btc/page.tsx 内联占位 Sparkline 函数的正式替代品（接受真实 series API 数据）。
 *         纯 presentational：无 API 调用、无状态副作用，data 由父组件传入。
 *
 * [PROTOCOL]:
 * 1. 一旦本文件逻辑变更（props 签名、阈值带绘制、状态着色规则），必须同步更新此 Header。
 * 2. 更新后必须上浮检查 /src/components/.folder.md 的描述是否依然准确。
 * 3. 严格遵守：纯 SVG，不引入新依赖（不要 d3/recharts/lightweight-charts）。
 */
"use client";

import { useId, useMemo } from "react";
import type { JSX } from "react";
import type { ChartSeriesPoint } from "@/types/api";
import { cn } from "@/lib/utils";

// ============================================================================
// 类型定义（导出）
// ============================================================================

export interface BtcIndicatorChartThresholds {
  accumulation?: number;
  distribution?: number;
  unit?: string;
  direction?: "higher_is_accumulation" | "lower_is_accumulation";
}

export type BtcIndicatorState = "accumulation" | "neutral" | "distribution";

export interface BtcIndicatorChartProps {
  symbol: string;
  displayName?: string;
  data: ChartSeriesPoint[];
  thresholds?: BtcIndicatorChartThresholds | null;
  currentState: BtcIndicatorState;
  reliability?: "★★★" | "★★" | "★";
  size?: "sparkline" | "expanded";
  className?: string;
  isLoading?: boolean;
}

// ============================================================================
// 常量
// ============================================================================

const STATE_STYLES: Record<
  BtcIndicatorState,
  { stroke: string; fill: string; label: string; badgeBg: string }
> = {
  accumulation: {
    stroke: "#10b981",
    fill: "rgba(16, 185, 129, 0.08)",
    label: "累积",
    badgeBg: "rgba(16, 185, 129, 0.15)",
  },
  neutral: {
    stroke: "#71717a",
    fill: "rgba(113, 113, 122, 0.06)",
    label: "中性",
    badgeBg: "rgba(113, 113, 122, 0.18)",
  },
  distribution: {
    stroke: "#ef4444",
    fill: "rgba(239, 68, 68, 0.08)",
    label: "释放",
    badgeBg: "rgba(239, 68, 68, 0.15)",
  },
};

const ACCUMULATION_FILL = "rgba(16, 185, 129, 0.08)";
const DISTRIBUTION_FILL = "rgba(239, 68, 68, 0.08)";
const NEUTRAL_FILL = "rgba(113, 113, 122, 0.04)";
const ACCUMULATION_LINE = "rgba(16, 185, 129, 0.55)";
const DISTRIBUTION_LINE = "rgba(239, 68, 68, 0.55)";

// SVG viewBox 尺寸（与 CSS 渲染尺寸解耦，便于响应式）
const SPARK_W = 80;
const SPARK_H = 24;
const EXPANDED_VB_W = 600;
const EXPANDED_VB_H = 120;

// ============================================================================
// 工具函数
// ============================================================================

interface ValidPoint {
  index: number;
  value: number;
}

/** 过滤掉 null/NaN/undefined value，返回 (index_in_original_array, value) */
function filterValidPoints(data: ChartSeriesPoint[]): ValidPoint[] {
  const out: ValidPoint[] = [];
  for (let i = 0; i < data.length; i++) {
    const pt = data[i];
    if (!pt) continue;
    const v = pt.value;
    if (v === null || v === undefined) continue;
    if (typeof v !== "number" || Number.isNaN(v)) continue;
    out.push({ index: i, value: v });
  }
  return out;
}

/** 把有效点映射到 SVG 坐标。返回 [{x, y, value, originalIndex}] */
interface PlottedPoint {
  x: number;
  y: number;
  value: number;
  originalIndex: number;
}

function plotPoints(
  valid: ValidPoint[],
  totalLen: number,
  yMin: number,
  yMax: number,
  width: number,
  height: number,
  paddingX: number,
  paddingY: number,
): PlottedPoint[] {
  const innerW = width - paddingX * 2;
  const innerH = height - paddingY * 2;
  const yRange = yMax - yMin || 1;
  // x 用原始 index（保留时间间隙）；length===1 时居中
  const xDenom = totalLen > 1 ? totalLen - 1 : 1;
  return valid.map((p) => {
    const x =
      totalLen > 1
        ? paddingX + (p.index / xDenom) * innerW
        : paddingX + innerW / 2;
    const y = paddingY + ((yMax - p.value) / yRange) * innerH;
    return { x, y, value: p.value, originalIndex: p.index };
  });
}

/** 生成 SVG path d 字符串。length 1 时返回 null（让调用者改画 circle） */
function buildLinePath(plotted: PlottedPoint[]): string | null {
  if (plotted.length === 0) return null;
  if (plotted.length === 1) return null;
  let d = "";
  for (let i = 0; i < plotted.length; i++) {
    const p = plotted[i];
    if (!p) continue;
    d += `${i === 0 ? "M" : "L"}${p.x.toFixed(2)},${p.y.toFixed(2)}`;
    if (i < plotted.length - 1) d += " ";
  }
  return d;
}

/** 计算 y 轴范围：取数据 min/max + 阈值，并加 6% 头尾 padding */
function computeYRange(
  values: number[],
  thresholds?: BtcIndicatorChartThresholds | null,
): { yMin: number; yMax: number } {
  const candidates: number[] = [...values];
  if (thresholds) {
    if (typeof thresholds.accumulation === "number")
      candidates.push(thresholds.accumulation);
    if (typeof thresholds.distribution === "number")
      candidates.push(thresholds.distribution);
  }
  if (candidates.length === 0) return { yMin: 0, yMax: 1 };
  let minV = candidates[0] as number;
  let maxV = candidates[0] as number;
  for (const v of candidates) {
    if (v < minV) minV = v;
    if (v > maxV) maxV = v;
  }
  if (minV === maxV) {
    const pad = Math.abs(minV) > 0 ? Math.abs(minV) * 0.1 : 1;
    return { yMin: minV - pad, yMax: maxV + pad };
  }
  const span = maxV - minV;
  const pad = span * 0.06;
  return { yMin: minV - pad, yMax: maxV + pad };
}

/** 把数值映射到 viewBox y 坐标 */
function valueToY(
  value: number,
  yMin: number,
  yMax: number,
  height: number,
  paddingY: number,
): number {
  const innerH = height - paddingY * 2;
  const yRange = yMax - yMin || 1;
  return paddingY + ((yMax - value) / yRange) * innerH;
}

// 数量级 humanize：1.5e8 → "150M"，6.5e9 → "6.5B"，5400 → "5.4K"，0.72 → "0.72"
function humanizeNumber(v: number): string {
  if (!Number.isFinite(v)) return "—";
  const abs = Math.abs(v);
  const sign = v < 0 ? "-" : "";
  const trim = (s: string) => s.replace(/\.?0+$/, "");
  if (abs >= 1e12) return `${sign}${trim((abs / 1e12).toFixed(2))}T`;
  if (abs >= 1e9) return `${sign}${trim((abs / 1e9).toFixed(2))}B`;
  if (abs >= 1e6) return `${sign}${trim((abs / 1e6).toFixed(1))}M`;
  if (abs >= 1e4) return `${sign}${trim((abs / 1e3).toFixed(1))}K`;
  if (abs >= 1000) return v.toLocaleString("en", { maximumFractionDigits: 0 });
  if (abs >= 10) return v.toFixed(1);
  if (abs >= 1) return v.toFixed(2);
  return v.toFixed(3);
}

function formatValue(v: number, unit?: string): string {
  const s = humanizeNumber(v);
  return unit ? `${s} ${unit}` : s;
}

function formatThreshold(v: number): string {
  return humanizeNumber(v);
}

// ============================================================================
// Sparkline 模式
// ============================================================================

function SparklineMode({
  data,
  thresholds,
  currentState,
  symbol,
  isLoading,
  className,
}: {
  data: ChartSeriesPoint[];
  thresholds?: BtcIndicatorChartThresholds | null;
  currentState: BtcIndicatorState;
  symbol: string;
  isLoading: boolean;
  className?: string;
}) {
  const styles = STATE_STYLES[currentState];
  const valid = useMemo(() => filterValidPoints(data), [data]);

  if (isLoading) {
    return (
      <div
        className={cn(
          "inline-block rounded bg-zinc-800/60 animate-pulse",
          className,
        )}
        style={{ width: SPARK_W, height: SPARK_H }}
        aria-label="loading"
      />
    );
  }

  if (valid.length === 0) {
    return (
      <div
        className={cn(
          "inline-flex items-center justify-center rounded border border-dashed border-zinc-700/60 text-[8px] text-zinc-600",
          className,
        )}
        style={{ width: SPARK_W, height: SPARK_H }}
        aria-label={`${symbol} no data`}
      >
        无数据
      </div>
    );
  }

  const values = valid.map((p) => p.value);
  const { yMin, yMax } = computeYRange(values, thresholds);
  const plotted = plotPoints(
    valid,
    data.length,
    yMin,
    yMax,
    SPARK_W,
    SPARK_H,
    1,
    2,
  );

  const linePath = buildLinePath(plotted);
  const lastPoint = plotted[plotted.length - 1];

  // 阈值线（极淡）
  const accY =
    thresholds && typeof thresholds.accumulation === "number"
      ? valueToY(thresholds.accumulation, yMin, yMax, SPARK_H, 2)
      : null;
  const distY =
    thresholds && typeof thresholds.distribution === "number"
      ? valueToY(thresholds.distribution, yMin, yMax, SPARK_H, 2)
      : null;

  return (
    <svg
      width={SPARK_W}
      height={SPARK_H}
      viewBox={`0 0 ${SPARK_W} ${SPARK_H}`}
      className={cn("inline-block", className)}
      aria-label={`${symbol} sparkline, state=${currentState}`}
      role="img"
    >
      {accY !== null && (
        <line
          x1={0}
          x2={SPARK_W}
          y1={accY}
          y2={accY}
          stroke="#10b981"
          strokeWidth={0.5}
          strokeOpacity={0.25}
          strokeDasharray="2 2"
        />
      )}
      {distY !== null && (
        <line
          x1={0}
          x2={SPARK_W}
          y1={distY}
          y2={distY}
          stroke="#ef4444"
          strokeWidth={0.5}
          strokeOpacity={0.25}
          strokeDasharray="2 2"
        />
      )}
      {linePath && (
        <path
          d={linePath}
          stroke={styles.stroke}
          strokeWidth={1.2}
          fill="none"
          strokeLinejoin="round"
          strokeLinecap="round"
          opacity={0.85}
        />
      )}
      {/* length===1 退化成单点 */}
      {plotted.length === 1 && plotted[0] && (
        <circle
          cx={plotted[0].x}
          cy={plotted[0].y}
          r={1.5}
          fill={styles.stroke}
        />
      )}
      {lastPoint && plotted.length > 1 && (
        <circle cx={lastPoint.x} cy={lastPoint.y} r={1.5} fill={styles.stroke} />
      )}
    </svg>
  );
}

// ============================================================================
// Expanded 模式
// ============================================================================

function ExpandedMode({
  symbol,
  displayName,
  data,
  thresholds,
  currentState,
  reliability,
  isLoading,
  className,
}: {
  symbol: string;
  displayName?: string;
  data: ChartSeriesPoint[];
  thresholds?: BtcIndicatorChartThresholds | null;
  currentState: BtcIndicatorState;
  reliability?: "★★★" | "★★" | "★";
  isLoading: boolean;
  className?: string;
}) {
  const styles = STATE_STYLES[currentState];
  const gradId = useId();
  const valid = useMemo(() => filterValidPoints(data), [data]);

  // Loading 骨架
  if (isLoading) {
    return (
      <div
        className={cn(
          "rounded-[10px] border border-[var(--border-subtle)] bg-[var(--bg-card)] p-3",
          className,
        )}
      >
        <div className="flex items-center justify-between mb-2">
          <div className="h-3 w-24 rounded bg-zinc-800/60 animate-pulse" />
          <div className="h-3 w-16 rounded bg-zinc-800/60 animate-pulse" />
        </div>
        <div
          className="rounded bg-zinc-800/40 animate-pulse"
          style={{ height: 96 }}
        />
      </div>
    );
  }

  // 头部信息（symbol + reliability + displayName）
  const Header = (
    <div className="flex items-baseline justify-between gap-2 mb-1.5 min-w-0">
      <div className="flex items-baseline gap-2 min-w-0">
        <span className="text-[10px] font-mono text-zinc-600 truncate">
          {symbol}
        </span>
        {displayName && (
          <span className="text-xs text-zinc-300 truncate">{displayName}</span>
        )}
        {reliability && (
          <span
            className="text-[10px] text-amber-500/70 flex-shrink-0"
            title={`reliability ${reliability}`}
          >
            {reliability}
          </span>
        )}
      </div>
    </div>
  );

  // Empty 态
  if (valid.length === 0) {
    return (
      <div
        className={cn(
          "rounded-[10px] border border-dashed border-zinc-700/60 bg-[var(--bg-card)] p-3",
          className,
        )}
      >
        {Header}
        <div
          className="flex items-center justify-center text-xs text-zinc-500"
          style={{ height: 96 }}
        >
          等待数据接入
        </div>
      </div>
    );
  }

  const values = valid.map((p) => p.value);
  const { yMin, yMax } = computeYRange(values, thresholds);

  const paddingX = 8;
  const paddingY = 8;
  const plotted = plotPoints(
    valid,
    data.length,
    yMin,
    yMax,
    EXPANDED_VB_W,
    EXPANDED_VB_H,
    paddingX,
    paddingY,
  );

  const linePath = buildLinePath(plotted);
  const lastPoint = plotted[plotted.length - 1];
  const lastValue = lastPoint?.value ?? values[values.length - 1] ?? 0;

  const hasAcc =
    !!thresholds && typeof thresholds.accumulation === "number";
  const hasDist =
    !!thresholds && typeof thresholds.distribution === "number";
  const hasThresholds = hasAcc && hasDist;
  const direction = thresholds?.direction ?? "higher_is_accumulation";
  const unit = thresholds?.unit;

  // 阈值带 y 坐标（在 viewBox 中）
  const accY =
    hasAcc && thresholds
      ? valueToY(
          thresholds.accumulation as number,
          yMin,
          yMax,
          EXPANDED_VB_H,
          paddingY,
        )
      : null;
  const distY =
    hasDist && thresholds
      ? valueToY(
          thresholds.distribution as number,
          yMin,
          yMax,
          EXPANDED_VB_H,
          paddingY,
        )
      : null;

  // 计算 3 段染色矩形的 y 上下界
  // 注意：y 坐标越小代表数值越大（SVG 习惯）。
  // higher_is_accumulation：数值高 → 累积区（绿）→ y 小
  //                          数值低 → 释放区（红）→ y 大
  // lower_is_accumulation 反过来。
  const renderThresholdBand = () => {
    if (!hasThresholds || accY === null || distY === null) return null;
    // 排序两条阈值线对应的 y（topY 是较小的 y，bottomY 是较大的 y）
    const topY = Math.min(accY, distY);
    const bottomY = Math.max(accY, distY);
    const chartTop = paddingY;
    const chartBottom = EXPANDED_VB_H - paddingY;

    // 顶部带 [chartTop, topY]、中间带 [topY, bottomY]、底部带 [bottomY, chartBottom]
    let topFill: string;
    let bottomFill: string;
    if (direction === "higher_is_accumulation") {
      topFill = ACCUMULATION_FILL;
      bottomFill = DISTRIBUTION_FILL;
    } else {
      topFill = DISTRIBUTION_FILL;
      bottomFill = ACCUMULATION_FILL;
    }
    return (
      <g>
        <rect
          x={0}
          y={chartTop}
          width={EXPANDED_VB_W}
          height={Math.max(0, topY - chartTop)}
          fill={topFill}
        />
        <rect
          x={0}
          y={topY}
          width={EXPANDED_VB_W}
          height={Math.max(0, bottomY - topY)}
          fill={NEUTRAL_FILL}
        />
        <rect
          x={0}
          y={bottomY}
          width={EXPANDED_VB_W}
          height={Math.max(0, chartBottom - bottomY)}
          fill={bottomFill}
        />
      </g>
    );
  };

  // 阈值线（虚线）
  const renderThresholdLines = () => {
    if (!thresholds) return null;
    return (
      <g>
        {accY !== null && (
          <line
            x1={0}
            x2={EXPANDED_VB_W}
            y1={accY}
            y2={accY}
            stroke="#10b981"
            strokeWidth={1}
            strokeDasharray="4 3"
            strokeOpacity={0.7}
          />
        )}
        {distY !== null && (
          <line
            x1={0}
            x2={EXPANDED_VB_W}
            y1={distY}
            y2={distY}
            stroke="#ef4444"
            strokeWidth={1}
            strokeDasharray="4 3"
            strokeOpacity={0.7}
          />
        )}
      </g>
    );
  };

  // 阈值 label（右侧）
  const renderThresholdLabels = () => {
    if (!thresholds) return null;
    const labelX = EXPANDED_VB_W - 4;
    const items: JSX.Element[] = [];
    if (accY !== null && typeof thresholds.accumulation === "number") {
      const op = direction === "higher_is_accumulation" ? "≥" : "≤";
      items.push(
        <text
          key="acc-label"
          x={labelX}
          y={accY - 3}
          fill="#10b981"
          fontSize={9}
          textAnchor="end"
          fontFamily="ui-sans-serif, system-ui"
        >
          {`${op} ${formatThreshold(thresholds.accumulation)}`}
        </text>,
      );
    }
    if (distY !== null && typeof thresholds.distribution === "number") {
      const op = direction === "higher_is_accumulation" ? "≤" : "≥";
      items.push(
        <text
          key="dist-label"
          x={labelX}
          y={distY + 10}
          fill="#ef4444"
          fontSize={9}
          textAnchor="end"
          fontFamily="ui-sans-serif, system-ui"
        >
          {`${op} ${formatThreshold(thresholds.distribution)}`}
        </text>,
      );
    }
    return <g>{items}</g>;
  };

  return (
    <div
      className={cn(
        "rounded-[10px] border border-[var(--border-subtle)] bg-[var(--bg-card)] p-3",
        className,
      )}
    >
      {/* Header 行：symbol + name + reliability + 当前值 */}
      <div className="flex items-baseline justify-between gap-3 mb-1.5 min-w-0">
        <div className="flex items-baseline gap-2 min-w-0">
          <span className="text-[10px] font-mono text-zinc-600">{symbol}</span>
          {displayName && (
            <span className="text-xs text-zinc-300 truncate">{displayName}</span>
          )}
          {reliability && (
            <span
              className="text-[10px] text-amber-500/70 flex-shrink-0"
              title={`reliability ${reliability}`}
            >
              {reliability}
            </span>
          )}
        </div>
        <div className="flex items-baseline gap-1 flex-shrink-0">
          <span
            className="text-sm font-semibold tabular-nums leading-none"
            style={{ color: styles.stroke }}
          >
            {formatValue(lastValue)}
          </span>
          {unit && (
            <span className="text-[10px] text-zinc-500 leading-none">{unit}</span>
          )}
        </div>
      </div>

      {/* SVG 主体 */}
      <div className="relative">
        <svg
          viewBox={`0 0 ${EXPANDED_VB_W} ${EXPANDED_VB_H}`}
          width="100%"
          height={96}
          preserveAspectRatio="none"
          className="block overflow-visible"
          aria-label={`${symbol} ${displayName ?? ""} chart, state=${currentState}`}
          role="img"
        >
          <defs>
            <linearGradient id={`grad-${gradId}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={styles.stroke} stopOpacity={0.25} />
              <stop offset="100%" stopColor={styles.stroke} stopOpacity={0} />
            </linearGradient>
          </defs>

          {/* 阈值染色带 */}
          {renderThresholdBand()}

          {/* 阈值虚线 */}
          {renderThresholdLines()}

          {/* 折线 */}
          {linePath && (
            <path
              d={linePath}
              stroke={styles.stroke}
              strokeWidth={1.5}
              fill="none"
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
          )}

          {/* 单点 fallback */}
          {plotted.length === 1 && plotted[0] && (
            <circle
              cx={plotted[0].x}
              cy={plotted[0].y}
              r={3}
              fill={styles.stroke}
            />
          )}

          {/* 末端高亮点 */}
          {lastPoint && plotted.length > 1 && (
            <>
              <circle
                cx={lastPoint.x}
                cy={lastPoint.y}
                r={4}
                fill={styles.stroke}
                stroke="#111113"
                strokeWidth={1}
              />
            </>
          )}

          {/* 阈值 label（最上层） */}
          {renderThresholdLabels()}
        </svg>

        {/* 左下角状态徽章 */}
        <div className="absolute left-1 bottom-1 pointer-events-none">
          <span
            className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium"
            style={{
              color: styles.stroke,
              backgroundColor: styles.badgeBg,
            }}
          >
            <span
              className="inline-block w-1 h-1 rounded-full"
              style={{ backgroundColor: styles.stroke }}
            />
            {styles.label}
          </span>
        </div>

        {/* 右下角：无阈值定义 提示 */}
        {!hasThresholds && (
          <div className="absolute right-1 bottom-1 text-[9px] text-zinc-600 pointer-events-none">
            无阈值定义
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// 主组件
// ============================================================================

export function BtcIndicatorChart(props: BtcIndicatorChartProps): JSX.Element {
  const {
    symbol,
    displayName,
    data,
    thresholds,
    currentState,
    reliability,
    size = "expanded",
    className,
    isLoading = false,
  } = props;

  if (size === "sparkline") {
    return (
      <SparklineMode
        data={data}
        thresholds={thresholds}
        currentState={currentState}
        symbol={symbol}
        isLoading={isLoading}
        className={className}
      />
    );
  }

  return (
    <ExpandedMode
      symbol={symbol}
      displayName={displayName}
      data={data}
      thresholds={thresholds}
      currentState={currentState}
      reliability={reliability}
      isLoading={isLoading}
      className={className}
    />
  );
}

// ============================================================================
// Demo（可选辅助 — 未导出到 index，仅用于本地 visual sandbox）
// ============================================================================

/** Deterministic mock：按 seed + direction 生成 30 个点 */
function mockSeries(seed: string, direction: number, base: number): ChartSeriesPoint[] {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h = (h ^ seed.charCodeAt(i)) * 16777619;
    h = h >>> 0; // 保持 uint32
  }
  const out: ChartSeriesPoint[] = [];
  let v = base;
  const start = Date.UTC(2026, 0, 1);
  for (let i = 0; i < 30; i++) {
    h = (h * 9301 + 49297) % 233280;
    const noise = (h / 233280 - 0.5) * Math.max(20, Math.abs(base) * 0.3);
    v += direction * Math.max(2, Math.abs(base) * 0.04) + noise + Math.sin(i * 0.7) * 5;
    out.push({
      ts: new Date(start + i * 86400000).toISOString(),
      value: v,
    });
  }
  return out;
}

export function BtcIndicatorChartDemo(): JSX.Element {
  const thresholds: BtcIndicatorChartThresholds = {
    accumulation: 150,
    distribution: -150,
    unit: "M",
    direction: "higher_is_accumulation",
  };

  const accData = mockSeries("A1_ETF_FLOW_acc", 6, 50);
  const distData = mockSeries("A1_ETF_FLOW_dist", -6, 50);
  const neutralData = mockSeries("A1_ETF_FLOW_neu", 0, 0);
  const noThreshData = mockSeries("X_NO_THRESH", 1, 30);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 p-6 bg-[#111113] min-h-screen">
      <BtcIndicatorChart
        symbol="A1_ETF_FLOW"
        displayName="ETF 净流入（累积态）"
        data={accData}
        thresholds={thresholds}
        currentState="accumulation"
        reliability="★★★"
        size="expanded"
      />
      <BtcIndicatorChart
        symbol="A1_ETF_FLOW"
        displayName="ETF 净流入（释放态）"
        data={distData}
        thresholds={thresholds}
        currentState="distribution"
        reliability="★★★"
        size="expanded"
      />
      <BtcIndicatorChart
        symbol="A1_ETF_FLOW"
        displayName="ETF 净流入（中性态）"
        data={neutralData}
        thresholds={thresholds}
        currentState="neutral"
        reliability="★★★"
        size="expanded"
      />
      <BtcIndicatorChart
        symbol="X_DEMO"
        displayName="无阈值指标示例"
        data={noThreshData}
        currentState="neutral"
        reliability="★★"
        size="expanded"
      />
    </div>
  );
}
