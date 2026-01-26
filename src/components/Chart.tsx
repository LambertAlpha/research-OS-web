"use client";

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

export function Chart({
  data,
  title,
  color = "#06b6d4",
  showArea = true,
  referenceLines = [],
}: ChartProps) {
  const chartData = data.map((point) => ({
    date: new Date(point.ts).toLocaleDateString("zh-CN", {
      month: "short",
      day: "numeric",
    }),
    value: point.value,
    fullDate: point.ts,
  }));

  const ChartComponent = showArea ? AreaChart : LineChart;

  // 计算最新值和变化
  const latestItem = chartData.at(-1);
  const previousItem = chartData.at(-2);
  const latestValue = latestItem?.value ?? 0;
  const previousValue = previousItem?.value ?? latestValue;
  const change = latestValue - previousValue;
  const changePercent = previousValue !== 0 ? (change / previousValue) * 100 : 0;

  return (
    <div className="group relative rounded-2xl p-5 overflow-hidden transition-all duration-500 bg-gradient-to-br from-zinc-900/80 to-zinc-950/80 border border-zinc-800/50 hover:border-cyan-500/20 backdrop-blur-xl">
      {/* 顶部渐变线 */}
      <div
        className="absolute top-0 left-0 right-0 h-0.5 opacity-50"
        style={{
          background: `linear-gradient(90deg, transparent, ${color}, transparent)`,
        }}
      />

      {/* Header */}
      <div className="flex items-center justify-between mb-4">
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

      {/* Chart */}
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
            tickFormatter={(value) =>
              value >= 1000 ? `${(value / 1000).toFixed(1)}k` : value
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
