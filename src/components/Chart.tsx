/**
 * [INPUT]: (data: RawDataPoint[], title, color?, showArea?, referenceLines?) - 时序数据点、标题、图表样式配置。
 * [OUTPUT]: (<div>) - 基于 Recharts 的交互式图表卡片，支持时间段选择、鼠标滚轮缩放、面积图/折线图。
 * [POS]: 位于 /components，被 Liquidity/Macro 等页面引用。通用金融数据可视化组件。
 *
 * [PROTOCOL]:
 * 1. 一旦本文件逻辑变更，必须同步更新此 Header。
 * 2. 更新后必须上浮检查 /src/components/.folder.md 的描述是否依然准确。
 */
"use client";

import { useState, useMemo, useCallback, useRef } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Area,
  AreaChart,
} from "recharts";
import type { RawDataPoint } from "@/types/api";
import { cn } from "@/lib/utils";

type TimeRange = "1W" | "1M" | "3M" | "6M" | "1Y" | "ALL";

interface ChartProps {
  data: RawDataPoint[];
  title: string;
  color?: string;
  showArea?: boolean;
  referenceLines?: Array<{
    y: number;
    color: string;
    label: string;
  }>;
}

const TIME_RANGES: { key: TimeRange; label: string; days: number }[] = [
  { key: "1W", label: "1W", days: 7 },
  { key: "1M", label: "1M", days: 30 },
  { key: "3M", label: "3M", days: 90 },
  { key: "6M", label: "6M", days: 180 },
  { key: "1Y", label: "1Y", days: 365 },
  { key: "ALL", label: "ALL", days: Infinity },
];

export function Chart({
  data,
  title,
  color = "#a1a1aa",
  showArea = true,
  referenceLines = [],
}: ChartProps) {
  const [selectedRange, setSelectedRange] = useState<TimeRange>("ALL");
  const [visibleRange, setVisibleRange] = useState<{ start: number; end: number } | null>(null);
  const chartRef = useRef<HTMLDivElement>(null);

  const filteredData = useMemo(() => {
    const range = TIME_RANGES.find((r) => r.key === selectedRange);
    if (!range || range.days === Infinity) return data;
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - range.days);
    return data.filter((point) => new Date(point.ts) >= cutoffDate);
  }, [data, selectedRange]);

  const allChartData = useMemo(() =>
    filteredData.map((point) => ({
      date: new Date(point.ts).toLocaleDateString("zh-CN", {
        month: "short",
        day: "numeric",
        timeZone: "Asia/Shanghai",
      }),
      value: point.value,
      fullDate: point.ts,
    })),
    [filteredData]
  );

  const chartData = useMemo(() => {
    if (!visibleRange) return allChartData;
    return allChartData.slice(visibleRange.start, visibleRange.end + 1);
  }, [allChartData, visibleRange]);

  const ChartComponent = showArea ? AreaChart : LineChart;

  const latestItem = chartData.at(-1);
  const previousItem = chartData.at(-2);
  const latestValue = latestItem?.value ?? 0;
  const previousValue = previousItem?.value ?? latestValue;
  const change = latestValue - previousValue;
  const changePercent = previousValue !== 0 ? (change / previousValue) * 100 : 0;

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const len = allChartData.length;
    if (len < 5) return;

    const currentStart = visibleRange?.start ?? 0;
    const currentEnd = visibleRange?.end ?? len - 1;
    const currentRange = currentEnd - currentStart;

    const zoomFactor = e.deltaY > 0 ? 1.02 : 0.98;
    let newRange = Math.round(currentRange * zoomFactor);
    newRange = Math.max(5, Math.min(len - 1, newRange));

    if (newRange === currentRange) return;

    const newStart = Math.max(0, len - 1 - newRange);
    const newEnd = len - 1;

    if (newStart === 0 && newEnd === len - 1) {
      setVisibleRange(null);
    } else {
      setVisibleRange({ start: newStart, end: newEnd });
    }
  }, [allChartData.length, visibleRange]);

  const handleRangeSelect = useCallback((rangeKey: TimeRange) => {
    setSelectedRange(rangeKey);
    setVisibleRange(null);
  }, []);

  return (
    <div
      ref={chartRef}
      className="bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-[14px] p-5 transition-colors duration-150 hover:bg-[var(--bg-card-hover)]"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-sm text-[var(--text-muted)]">{title}</h3>
        <div className="text-right">
          <p className="text-lg font-semibold text-zinc-200 tabular-nums">
            {latestValue.toLocaleString("zh-CN", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </p>
          <p
            className={`text-[10px] font-medium tabular-nums ${
              change >= 0 ? "text-emerald-400" : "text-red-400"
            }`}
          >
            {change >= 0 ? "+" : ""}
            {changePercent.toFixed(2)}%
          </p>
        </div>
      </div>

      {/* 时间段 */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex gap-0.5">
          {TIME_RANGES.map((range) => (
            <button
              key={range.key}
              onClick={() => handleRangeSelect(range.key)}
              className={cn(
                "px-2 py-0.5 text-[10px] rounded transition-colors duration-100",
                selectedRange === range.key
                  ? "text-zinc-200 bg-[var(--bg-elevated)]"
                  : "text-[var(--text-faint)] hover:text-[var(--text-muted)]"
              )}
            >
              {range.label}
            </button>
          ))}
        </div>
        <span className="text-[9px] text-[var(--text-faint)]">scroll to zoom</span>
      </div>

      {/* Chart */}
      <div onWheel={handleWheel} style={{ cursor: "ns-resize" }}>
        <ResponsiveContainer width="100%" height={180}>
          <ChartComponent data={chartData}>
            <defs>
              <linearGradient id={`gradient-${title}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity={0.12} />
                <stop offset="100%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="rgba(255,255,255,0.03)"
              vertical={false}
            />
            <XAxis
              dataKey="date"
              stroke="rgba(255,255,255,0.06)"
              fontSize={10}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              stroke="rgba(255,255,255,0.06)"
              fontSize={10}
              tickLine={false}
              axisLine={false}
              width={45}
              domain={["auto", "auto"]}
              tickFormatter={(value) =>
                value >= 1000 ? `${(value / 1000).toFixed(1)}k` : value.toFixed(1)
              }
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "var(--bg-elevated)",
                border: "1px solid var(--border-visible)",
                borderRadius: "8px",
                color: "var(--text-primary)",
                fontSize: "12px",
              }}
              labelStyle={{ color: "var(--text-muted)", marginBottom: "2px" }}
              itemStyle={{ color: "var(--text-secondary)" }}
              labelFormatter={(_, payload) =>
                payload?.[0]?.payload?.fullDate
                  ? new Date(payload[0].payload.fullDate).toLocaleDateString(
                      "zh-CN",
                      { timeZone: "Asia/Shanghai" }
                    )
                  : ""
              }
            />
            {referenceLines.map((line, i) => (
              <ReferenceLine
                key={i}
                y={line.y}
                stroke={line.color}
                strokeDasharray="5 5"
                strokeOpacity={0.4}
                label={{
                  value: line.label,
                  position: "right",
                  fill: line.color,
                  fontSize: 9,
                  fontWeight: 500,
                }}
              />
            ))}
            {showArea ? (
              <Area
                type="monotone"
                dataKey="value"
                stroke={color}
                strokeWidth={1.5}
                fill={`url(#gradient-${title})`}
                dot={false}
                activeDot={{
                  r: 3,
                  fill: color,
                  stroke: "var(--bg-card)",
                  strokeWidth: 2,
                }}
              />
            ) : (
              <Line
                type="monotone"
                dataKey="value"
                stroke={color}
                strokeWidth={1.5}
                dot={false}
                activeDot={{
                  r: 3,
                  fill: color,
                  stroke: "var(--bg-card)",
                  strokeWidth: 2,
                }}
              />
            )}
          </ChartComponent>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
