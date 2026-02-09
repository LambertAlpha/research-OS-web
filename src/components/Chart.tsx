/**
 * [INPUT]: (data: RawDataPoint[], title, color?, showArea?, referenceLines?) - 时序数据点、标题、图表样式配置。
 * [OUTPUT]: (<div>) - 基于 Recharts 的交互式图表卡片，支持时间段选择、鼠标滚轮缩放、面积图/折线图，含最新值、变化率、参考线。
 * [POS]: 位于 /components，被 Overview/Liquidity/Macro 三个页面引用。通用金融数据可视化组件。
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
import { TrendingUp } from "lucide-react";
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
  { key: "1W", label: "1周", days: 7 },
  { key: "1M", label: "1月", days: 30 },
  { key: "3M", label: "3月", days: 90 },
  { key: "6M", label: "6月", days: 180 },
  { key: "1Y", label: "1年", days: 365 },
  { key: "ALL", label: "全部", days: Infinity },
];

export function Chart({
  data,
  title,
  color = "#06b6d4",
  showArea = true,
  referenceLines = [],
}: ChartProps) {
  const [selectedRange, setSelectedRange] = useState<TimeRange>("ALL");
  const [visibleRange, setVisibleRange] = useState<{ start: number; end: number } | null>(null);
  const chartRef = useRef<HTMLDivElement>(null);

  // 根据时间段按钮过滤数据
  const filteredData = useMemo(() => {
    const range = TIME_RANGES.find((r) => r.key === selectedRange);
    if (!range || range.days === Infinity) return data;

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - range.days);
    return data.filter((point) => new Date(point.ts) >= cutoffDate);
  }, [data, selectedRange]);

  // 转换为图表数据格式
  const allChartData = useMemo(() =>
    filteredData.map((point) => ({
      date: new Date(point.ts).toLocaleDateString("zh-CN", {
        month: "short",
        day: "numeric",
      }),
      value: point.value,
      fullDate: point.ts,
    })),
    [filteredData]
  );

  // 根据滚轮缩放范围裁剪数据
  const chartData = useMemo(() => {
    if (!visibleRange) return allChartData;
    return allChartData.slice(visibleRange.start, visibleRange.end + 1);
  }, [allChartData, visibleRange]);

  const ChartComponent = showArea ? AreaChart : LineChart;

  // 计算最新值和变化
  const latestItem = chartData.at(-1);
  const previousItem = chartData.at(-2);
  const latestValue = latestItem?.value ?? 0;
  const previousValue = previousItem?.value ?? latestValue;
  const change = latestValue - previousValue;
  const changePercent = previousValue !== 0 ? (change / previousValue) * 100 : 0;

  // 鼠标滚轮缩放
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const len = allChartData.length;
    if (len < 5) return;

    const currentStart = visibleRange?.start ?? 0;
    const currentEnd = visibleRange?.end ?? len - 1;
    const currentRange = currentEnd - currentStart;

    // 滚轮向上 = 放大（显示更少数据），向下 = 缩小（显示更多数据）
    // 灵敏度：每次滚动变化 2%
    const zoomFactor = e.deltaY > 0 ? 1.02 : 0.98;
    let newRange = Math.round(currentRange * zoomFactor);

    // 限制范围
    newRange = Math.max(5, Math.min(len - 1, newRange));

    if (newRange === currentRange) return;

    // 以右侧（最新数据）为锚点缩放
    const newStart = Math.max(0, len - 1 - newRange);
    const newEnd = len - 1;

    if (newStart === 0 && newEnd === len - 1) {
      setVisibleRange(null);
    } else {
      setVisibleRange({ start: newStart, end: newEnd });
    }
  }, [allChartData.length, visibleRange]);

  // 选择预设时间段时重置滚轮缩放
  const handleRangeSelect = useCallback((rangeKey: TimeRange) => {
    setSelectedRange(rangeKey);
    setVisibleRange(null);
  }, []);

  return (
    <div
      ref={chartRef}
      className="group relative rounded-2xl p-5 overflow-hidden transition-all duration-500 bg-gradient-to-br from-zinc-900/80 to-zinc-950/80 border border-zinc-800/50 hover:border-cyan-500/20 backdrop-blur-xl"
    >
      {/* 顶部渐变线 */}
      <div
        className="absolute top-0 left-0 right-0 h-0.5 opacity-50"
        style={{
          background: `linear-gradient(90deg, transparent, ${color}, transparent)`,
        }}
      />

      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div
            className="p-1.5 rounded-lg"
            style={{ backgroundColor: `${color}15` }}
          >
            <TrendingUp className="w-3.5 h-3.5" style={{ color }} />
          </div>
          <h3 className="text-sm font-medium text-zinc-300">{title}</h3>
        </div>

        {/* 最新数值 */}
        <div className="text-right">
          <p
            className="text-lg font-bold"
            style={{ color, textShadow: `0 0 20px ${color}40` }}
          >
            {latestValue.toLocaleString("zh-CN", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </p>
          <p
            className={`text-[10px] font-medium ${
              change >= 0 ? "text-emerald-400" : "text-red-400"
            }`}
          >
            {change >= 0 ? "+" : ""}
            {changePercent.toFixed(2)}%
          </p>
        </div>
      </div>

      {/* 时间段选择器 */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex gap-1">
          {TIME_RANGES.map((range) => (
            <button
              key={range.key}
              onClick={() => handleRangeSelect(range.key)}
              className={cn(
                "px-2 py-0.5 text-[10px] rounded transition-all",
                selectedRange === range.key
                  ? "text-zinc-100"
                  : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50"
              )}
              style={
                selectedRange === range.key
                  ? { backgroundColor: `${color}30`, color }
                  : undefined
              }
            >
              {range.label}
            </button>
          ))}
        </div>

        {/* 缩放提示 */}
        <span className="text-[9px] text-zinc-600">滚轮缩放</span>
      </div>

      {/* Chart - 添加滚轮事件 */}
      <div onWheel={handleWheel} style={{ cursor: "ns-resize" }}>
        <ResponsiveContainer width="100%" height={200}>
          <ChartComponent data={chartData}>
            <defs>
              <linearGradient id={`gradient-${title}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity={0.3} />
                <stop offset="100%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="#27272a"
              vertical={false}
            />
            <XAxis
              dataKey="date"
              stroke="#52525b"
              fontSize={10}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              stroke="#52525b"
              fontSize={10}
              tickLine={false}
              axisLine={false}
              width={50}
              domain={["auto", "auto"]}
              tickFormatter={(value) =>
                value >= 1000 ? `${(value / 1000).toFixed(1)}k` : value.toFixed(1)
              }
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "#18181b",
                border: "1px solid #3f3f46",
                borderRadius: "12px",
                color: "#f4f4f5",
                boxShadow: `0 0 20px ${color}20`,
              }}
              labelStyle={{ color: "#a1a1aa", marginBottom: "4px" }}
              itemStyle={{ color }}
              labelFormatter={(_, payload) =>
                payload?.[0]?.payload?.fullDate
                  ? new Date(payload[0].payload.fullDate).toLocaleDateString(
                      "zh-CN"
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
                strokeOpacity={0.7}
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
                strokeWidth={2}
                fill={`url(#gradient-${title})`}
                dot={false}
                activeDot={{
                  r: 4,
                  fill: color,
                  stroke: "#18181b",
                  strokeWidth: 2,
                }}
              />
            ) : (
              <Line
                type="monotone"
                dataKey="value"
                stroke={color}
                strokeWidth={2}
                dot={false}
                activeDot={{
                  r: 4,
                  fill: color,
                  stroke: "#18181b",
                  strokeWidth: 2,
                }}
              />
            )}
          </ChartComponent>
        </ResponsiveContainer>
      </div>

      {/* 底部渐变线 */}
      <div
        className="absolute bottom-0 left-0 right-0 h-px opacity-30"
        style={{
          background: `linear-gradient(90deg, transparent, ${color}, transparent)`,
        }}
      />
    </div>
  );
}
