/**
 * [INPUT]: index (number) — 用于挑选 SERIES_COLORS 的索引
 * [OUTPUT]: lightweight-charts ChartOptions / LineSeries options，已对齐 Clinical Dark
 * [POS]: 位于 /lib，被 ChartPane 引用。把 globals.css 里的 Clinical Dark CSS variables
 *        映射成 lightweight-charts 接受的具体颜色值。CSS variable 不能直接进 canvas，所以
 *        本文件硬编码值；改 CSS tokens 时此文件需同步更新。
 *
 * [PROTOCOL]:
 * 1. 一旦 globals.css 颜色 token 变更，必须同步更新此文件硬编码值。
 * 2. 新增图表类型（K线/直方图）时按需扩展 getXxxOptions() 工厂。
 */
import {
  ColorType,
  CrosshairMode,
  LineStyle,
  type DeepPartial,
  type ChartOptions,
  type LineSeriesPartialOptions,
} from "lightweight-charts";

export const CLINICAL_DARK_CHART_OPTIONS: DeepPartial<ChartOptions> = {
  layout: {
    background: { type: ColorType.Solid, color: "#111113" },
    textColor: "#a1a1aa",
    fontSize: 12,
    fontFamily:
      "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
  },
  grid: {
    vertLines: { color: "rgba(255, 255, 255, 0.04)", style: LineStyle.Solid },
    horzLines: { color: "rgba(255, 255, 255, 0.04)", style: LineStyle.Solid },
  },
  rightPriceScale: {
    borderColor: "rgba(255, 255, 255, 0.06)",
    textColor: "#63636e",
  },
  timeScale: {
    borderColor: "rgba(255, 255, 255, 0.06)",
    timeVisible: false,
    secondsVisible: false,
  },
  crosshair: {
    mode: CrosshairMode.Normal,
    vertLine: {
      color: "rgba(228, 228, 231, 0.25)",
      width: 1,
      style: LineStyle.Solid,
      labelBackgroundColor: "#19191c",
    },
    horzLine: {
      color: "rgba(228, 228, 231, 0.25)",
      width: 1,
      style: LineStyle.Solid,
      labelBackgroundColor: "#19191c",
    },
  },
};

// 多 series 颜色板（同 pane 多线时按 index 取色，避免重复）
export const SERIES_COLORS = [
  "#22c55e", // green - 第一序列
  "#3b82f6", // blue
  "#eab308", // amber
  "#a855f7", // purple
  "#06b6d4", // cyan
  "#ec4899", // pink
  "#f97316", // orange
  "#ef4444", // red
] as const;

export function getSeriesColor(index: number): string {
  // noUncheckedIndexedAccess：mod 后必然命中数组，但 TS 不能推断
  return SERIES_COLORS[index % SERIES_COLORS.length] as string;
}

export function getLineSeriesOptions(index: number): LineSeriesPartialOptions {
  return {
    color: getSeriesColor(index),
    lineWidth: 2,
    crosshairMarkerVisible: true,
    crosshairMarkerRadius: 3,
    priceLineVisible: false,
    lastValueVisible: true,
  };
}
