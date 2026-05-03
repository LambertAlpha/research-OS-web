/**
 * [INPUT]: { series, height?, events? } — 系列数组、可选事件标记、高度
 * [OUTPUT]: 一个 lightweight-charts pane（多 series 叠加 + 自动双 y 轴 + 十字线 +
 *           可选 event markers + 主题对齐 Clinical Dark）
 * [POS]: 位于 /components，被 EditablePane 引用。Charts Workspace 的最小可视化单元。
 *
 * [PROTOCOL]:
 * 1. 仅渲染传入的 series 与 events，不发起 API 请求（pure presentational）。
 * 2. ResizeObserver 处理父容器宽度变化，chart instance 在 unmount 时正确释放。
 * 3. lightweight-charts v5：用 chart.addSeries(LineSeries, {...}) + priceScaleId 区分轴。
 * 4. 双 y 轴策略：按 series 数据中位数的 log10 量级聚类，最大间隔 > 1.5 个数量级时
 *    自动分到 left/right 两轴；否则全部 right 单轴。
 * 5. events markers：用 v5 的 createSeriesMarkers plugin attach 到第一个 series。
 */
"use client";

import { useEffect, useRef } from "react";
import {
  createChart,
  createSeriesMarkers,
  LineSeries,
  type IChartApi,
  type ISeriesApi,
  type ISeriesMarkersPluginApi,
  type SeriesMarker,
  type Time,
} from "lightweight-charts";
import type { ChartSeries, ChartEvent } from "@/types/api";
import {
  CLINICAL_DARK_CHART_OPTIONS,
  getLineSeriesOptions,
} from "@/lib/chart-theme";

interface ChartPaneProps {
  series: ChartSeries[];
  events?: ChartEvent[];
  height?: number;
}

// 把 series 按数据量级聚类成 left/right 两组
// 返回 Map<symbol, "left" | "right">
function clusterAxes(series: ChartSeries[]): Map<string, "left" | "right"> {
  const result = new Map<string, "left" | "right">();
  if (series.length <= 1) {
    series.forEach((s) => result.set(s.symbol, "right"));
    return result;
  }

  const items = series.map((s) => {
    const values = s.points
      .map((p) => p.value)
      .filter(
        (v): v is number => v !== null && Number.isFinite(v) && v !== 0,
      )
      .map(Math.abs);
    if (values.length === 0) return { symbol: s.symbol, magnitude: 0 };
    values.sort((a, b) => a - b);
    const median = values[Math.floor(values.length / 2)] ?? 1;
    return { symbol: s.symbol, magnitude: Math.log10(median) };
  });

  const sorted = [...items].sort((a, b) => a.magnitude - b.magnitude);
  let maxGap = 0;
  let splitIdx = -1;
  for (let i = 1; i < sorted.length; i++) {
    const gap = sorted[i]!.magnitude - sorted[i - 1]!.magnitude;
    if (gap > maxGap) {
      maxGap = gap;
      splitIdx = i;
    }
  }

  // 数量级差 < 1.0（10x）→ 单轴；>= 1.0 自动分到 left/right
  if (maxGap < 1.0 || splitIdx < 0) {
    series.forEach((s) => result.set(s.symbol, "right"));
    return result;
  }

  // splitIdx 之前（小量级）走 left；splitIdx 及之后（大量级）走 right
  sorted.forEach((item, i) => {
    result.set(item.symbol, i < splitIdx ? "left" : "right");
  });
  return result;
}

function severityColor(severity: ChartEvent["severity"]): string {
  switch (severity) {
    case "critical":
      return "#ef4444";
    case "warning":
      return "#eab308";
    case "info":
    default:
      return "#3b82f6";
  }
}

function eventsToMarkers(
  events: ChartEvent[],
): SeriesMarker<Time>[] {
  // 不渲染 text 标签——markers 密集时文字会重叠成噪音；hover 时由
  // lightweight-charts 默认 tooltip 提示（包含 time + 颜色，足够定位）
  return events.map((e) => ({
    time: e.ts.slice(0, 10) as Time,
    position: e.severity === "critical" ? "aboveBar" : "belowBar",
    color: severityColor(e.severity),
    shape:
      e.severity === "critical"
        ? "arrowDown"
        : e.severity === "warning"
          ? "circle"
          : "circle",
    size: e.severity === "critical" ? 1.5 : 0.8,
  }));
}

export function ChartPane({ series, events, height = 300 }: ChartPaneProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRefs = useRef<ISeriesApi<"Line">[]>([]);
  const markersPluginRef = useRef<ISeriesMarkersPluginApi<Time> | null>(null);

  // 1. 创建 chart 实例（一次）
  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      ...CLINICAL_DARK_CHART_OPTIONS,
      width: containerRef.current.clientWidth,
      height,
    });
    chartRef.current = chart;

    const resizeObserver = new ResizeObserver(() => {
      if (containerRef.current && chartRef.current) {
        chartRef.current.applyOptions({
          width: containerRef.current.clientWidth,
        });
      }
    });
    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
      chart.remove();
      chartRef.current = null;
      seriesRefs.current = [];
      markersPluginRef.current = null;
    };
  }, [height]);

  // 2. 数据装载/更新
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;

    // 移除旧 series + markers
    seriesRefs.current.forEach((s) => {
      try {
        chart.removeSeries(s);
      } catch {
        // chart already disposed — ignore
      }
    });
    seriesRefs.current = [];
    markersPluginRef.current = null;

    // 双 y 轴聚类
    const axisMap = clusterAxes(series);
    const usedLeft = Array.from(axisMap.values()).some((v) => v === "left");
    chart.applyOptions({
      leftPriceScale: { visible: usedLeft },
      rightPriceScale: { visible: true },
    });

    series.forEach((s, idx) => {
      const priceScaleId = axisMap.get(s.symbol) ?? "right";
      const lineSeries = chart.addSeries(LineSeries, {
        ...getLineSeriesOptions(idx),
        priceScaleId,
      });

      const data = s.points
        .filter((p) => p.value !== null && Number.isFinite(p.value))
        .map((p) => ({
          time: p.ts.slice(0, 10) as `${number}-${number}-${number}`,
          value: p.value as number,
        }))
        .sort((a, b) => a.time.localeCompare(b.time));

      // 去重：同 time 取最后一个值
      const dedup: typeof data = [];
      for (const point of data) {
        const last = dedup.length > 0 ? dedup[dedup.length - 1] : undefined;
        if (last && last.time === point.time) {
          dedup[dedup.length - 1] = point;
        } else {
          dedup.push(point);
        }
      }

      lineSeries.setData(dedup);
      seriesRefs.current.push(lineSeries);
    });

    if (series.length > 0) {
      chart.timeScale().fitContent();
    }
  }, [series]);

  // 3. events markers
  useEffect(() => {
    const chart = chartRef.current;
    const firstSeries = seriesRefs.current[0];
    if (!chart || !firstSeries) return;

    const markers = events && events.length > 0 ? eventsToMarkers(events) : [];

    if (markersPluginRef.current) {
      markersPluginRef.current.setMarkers(markers);
    } else if (markers.length > 0) {
      markersPluginRef.current = createSeriesMarkers(firstSeries, markers);
    }
  }, [events, series]);

  return (
    <div
      ref={containerRef}
      className="overflow-hidden rounded-[10px] border border-[var(--border-subtle)] bg-[var(--bg-card)]"
    />
  );
}
