/**
 * [INPUT]: { title?, series: ChartSeries[], height? } — pane 标题、系列数组、高度
 * [OUTPUT]: 一个 lightweight-charts pane（多 series 叠加 + 十字线 + 主题对齐 Clinical Dark）
 * [POS]: 位于 /components，被 /charts 路由的页面引用。是 Charts Workspace 的最小可视化单元；
 *        多 pane 由父组件水平堆叠。
 *
 * [PROTOCOL]:
 * 1. 仅渲染传入的 series，不发起 API 请求（pure presentational component）。
 * 2. ResizeObserver 处理父容器宽度变化，chart instance 在 unmount 时正确释放。
 * 3. lightweight-charts v5.x：用 chart.addSeries(LineSeries, options) 而非 v4 的 addLineSeries。
 */
"use client";

import { useEffect, useRef } from "react";
import {
  createChart,
  LineSeries,
  type IChartApi,
  type ISeriesApi,
} from "lightweight-charts";
import type { ChartSeries } from "@/types/api";
import {
  CLINICAL_DARK_CHART_OPTIONS,
  getLineSeriesOptions,
  getSeriesColor,
} from "@/lib/chart-theme";

interface ChartPaneProps {
  title?: string;
  series: ChartSeries[];
  height?: number;
}

export function ChartPane({ title, series, height = 300 }: ChartPaneProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRefs = useRef<ISeriesApi<"Line">[]>([]);

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
    };
  }, [height]);

  // 2. 数据装载/更新（series 变化时）
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;

    // 移除旧 series
    seriesRefs.current.forEach((s) => {
      try {
        chart.removeSeries(s);
      } catch {
        // chart already disposed — ignore
      }
    });
    seriesRefs.current = [];

    // 添加新 series
    series.forEach((s, idx) => {
      const lineSeries = chart.addSeries(LineSeries, getLineSeriesOptions(idx));
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

  return (
    <div className="flex flex-col gap-2">
      {title && (
        <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 px-1">
          <h3 className="text-sm font-medium text-[var(--text-primary)]">
            {title}
          </h3>
          <div className="flex flex-wrap gap-3 text-xs">
            {series.map((s, i) => (
              <span key={s.symbol} className="flex items-center gap-1.5">
                <span
                  className="inline-block h-2 w-2 rounded-full"
                  style={{ backgroundColor: getSeriesColor(i) }}
                />
                <span className="text-[var(--text-secondary)]">
                  {s.display_name}
                </span>
                {s.unit && (
                  <span className="text-[var(--text-faint)]">({s.unit})</span>
                )}
                <span className="text-[var(--text-faint)]">
                  {s.points.length} pts
                </span>
              </span>
            ))}
          </div>
        </div>
      )}
      <div
        ref={containerRef}
        className="overflow-hidden rounded-[10px] border border-[var(--border-subtle)] bg-[var(--bg-card)]"
      />
    </div>
  );
}
