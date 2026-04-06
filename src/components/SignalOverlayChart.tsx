/**
 * [INPUT]: (priceSeries: RawDataPoint[], signals: BacktestSignal[], signalChanges: SignalChange[]) - 价格序列、信号快照、变更事件。
 * [OUTPUT]: (<div>) - SPX 价格折线 + 风险灯号背景色带 + 宏观状态标注 + 信号详情悬浮提示。
 * [POS]: 位于 /components，被 /backtest 页面引用。回测专用的信号叠加可视化组件。
 *
 * [PROTOCOL]:
 * 1. 一旦本文件逻辑变更，必须同步更新此 Header。
 * 2. 更新后必须上浮检查 /src/components/.folder.md 的描述是否依然准确。
 */
"use client";

import { useState, useMemo, useCallback, useRef } from "react";
import {
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  ReferenceArea,
  ReferenceLine,
} from "recharts";
import type { RawDataPoint, BacktestSignal, SignalChange } from "@/types/api";
import { TrendingUp, ZoomIn } from "lucide-react";
import { cn } from "@/lib/utils";

type TimeRange = "3M" | "6M" | "1Y" | "2Y" | "ALL";

const TIME_RANGES: { key: TimeRange; label: string; days: number }[] = [
  { key: "3M", label: "3月", days: 90 },
  { key: "6M", label: "6月", days: 180 },
  { key: "1Y", label: "1年", days: 365 },
  { key: "2Y", label: "2年", days: 730 },
  { key: "ALL", label: "全部", days: Infinity },
];

const RISK_LIGHT_COLORS: Record<string, string> = {
  green: "rgba(34, 197, 94, 0.08)",
  yellow: "rgba(234, 179, 8, 0.08)",
  red: "rgba(239, 68, 68, 0.12)",
  unknown: "rgba(100, 116, 139, 0.05)",
};

const RISK_LIGHT_BORDER: Record<string, string> = {
  green: "#22c55e",
  yellow: "#eab308",
  red: "#ef4444",
  unknown: "#64748b",
};

const MACRO_STATE_LABELS: Record<string, string> = {
  A: "增长",
  B: "冲击",
  C: "衰退",
  D: "通胀",
};

interface SignalOverlayChartProps {
  priceSeries: RawDataPoint[];
  signals: BacktestSignal[];
  signalChanges: SignalChange[];
  priceSymbol?: string;
}

interface ChartDataPoint {
  date: string;
  dateLabel: string;
  value: number;
  signal?: BacktestSignal;
  riskLight: string;
  macroState: string;
}

const SYMBOL_LABELS: Record<string, string> = {
  SPX: "S&P 500",
  NDX: "NASDAQ 100",
  "BTC-USD": "Bitcoin",
};

export function SignalOverlayChart({
  priceSeries,
  signals,
  signalChanges,
  priceSymbol = "SPX",
}: SignalOverlayChartProps) {
  const [selectedRange, setSelectedRange] = useState<TimeRange>("ALL");
  const [visibleRange, setVisibleRange] = useState<{
    start: number;
    end: number;
  } | null>(null);
  const chartRef = useRef<HTMLDivElement>(null);

  // 构建信号索引 (date → signal)
  const signalMap = useMemo(() => {
    const map = new Map<string, BacktestSignal>();
    for (const s of signals) {
      map.set(s.date, s);
    }
    return map;
  }, [signals]);

  // 合并价格 + 信号数据，按日期对齐
  const fullChartData = useMemo(() => {
    const data: ChartDataPoint[] = [];
    let lastSignal: BacktestSignal | undefined;

    for (const point of priceSeries) {
      const dateStr = point.ts.slice(0, 10);

      // 查找最近的信号（信号是周五，价格是日频）
      const exactSignal = signalMap.get(dateStr);
      if (exactSignal) {
        lastSignal = exactSignal;
      }

      data.push({
        date: dateStr,
        dateLabel: new Date(point.ts).toLocaleDateString("zh-CN", {
          month: "short",
          day: "numeric",
          timeZone: "Asia/Shanghai",
        }),
        value: point.value,
        signal: exactSignal,
        riskLight: lastSignal?.risk_light ?? "unknown",
        macroState: lastSignal?.macro_state ?? "N/A",
      });
    }
    return data;
  }, [priceSeries, signalMap]);

  // 按时间段过滤
  const filteredData = useMemo(() => {
    const range = TIME_RANGES.find((r) => r.key === selectedRange);
    if (!range || range.days === Infinity) return fullChartData;

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - range.days);
    const cutoffStr = cutoff.toISOString().split("T")[0] ?? "";
    return fullChartData.filter((p) => p.date >= cutoffStr);
  }, [fullChartData, selectedRange]);

  // 应用缩放
  const chartData = useMemo(() => {
    if (!visibleRange) return filteredData;
    return filteredData.slice(visibleRange.start, visibleRange.end + 1);
  }, [filteredData, visibleRange]);

  // 生成风险灯号色带区间
  const riskBands = useMemo(() => {
    if (chartData.length === 0) return [];
    const bands: {
      startIdx: number;
      endIdx: number;
      riskLight: string;
    }[] = [];

    let currentBand = {
      startIdx: 0,
      endIdx: 0,
      riskLight: chartData[0]!.riskLight,
    };

    for (let i = 1; i < chartData.length; i++) {
      const point = chartData[i]!;
      if (point.riskLight === currentBand.riskLight) {
        currentBand.endIdx = i;
      } else {
        bands.push({ ...currentBand });
        currentBand = {
          startIdx: i,
          endIdx: i,
          riskLight: point.riskLight,
        };
      }
    }
    bands.push(currentBand);
    return bands;
  }, [chartData]);

  // 生成宏观状态变更标记线
  const stateChangeLines = useMemo(() => {
    const lines: { date: string; from: string; to: string }[] = [];
    for (const change of signalChanges) {
      if (change.type === "macro_state" && change.from && change.to) {
        // 确保在可见范围内
        if (chartData.some((d) => d.date === change.date)) {
          lines.push({
            date: change.date,
            from: change.from,
            to: change.to,
          });
        }
      }
    }
    return lines;
  }, [signalChanges, chartData]);

  // 鼠标滚轮缩放
  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault();
      const len = filteredData.length;
      if (len < 10) return;

      const currentStart = visibleRange?.start ?? 0;
      const currentEnd = visibleRange?.end ?? len - 1;
      const currentRange = currentEnd - currentStart;

      const zoomFactor = e.deltaY > 0 ? 1.03 : 0.97;
      let newRange = Math.round(currentRange * zoomFactor);
      newRange = Math.max(10, Math.min(len - 1, newRange));

      if (newRange === currentRange) return;

      const newStart = Math.max(0, len - 1 - newRange);
      const newEnd = len - 1;

      if (newStart === 0 && newEnd === len - 1) {
        setVisibleRange(null);
      } else {
        setVisibleRange({ start: newStart, end: newEnd });
      }
    },
    [filteredData.length, visibleRange]
  );

  const handleRangeSelect = useCallback((rangeKey: TimeRange) => {
    setSelectedRange(rangeKey);
    setVisibleRange(null);
  }, []);

  // 统计
  const latestPrice = chartData.at(-1)?.value ?? 0;
  const firstPrice = chartData[0]?.value ?? latestPrice;
  const totalReturn =
    firstPrice !== 0 ? ((latestPrice - firstPrice) / firstPrice) * 100 : 0;

  const signalStats = useMemo(() => {
    const counts = { green: 0, yellow: 0, red: 0 };
    for (const s of signals) {
      if (s.risk_light in counts) {
        counts[s.risk_light as keyof typeof counts]++;
      }
    }
    return counts;
  }, [signals]);

  return (
    <div className="space-y-4">
      {/* 主图表卡片 */}
      <div
        ref={chartRef}
        className="group relative rounded-[14px] p-5 overflow-hidden transition-all duration-500 bg-[var(--bg-card)] border border-[var(--border-subtle)] hover:bg-[var(--bg-card-hover)]"
      >

        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-zinc-500/10">
              <TrendingUp className="w-4 h-4 text-zinc-400" />
            </div>
            <h3 className="text-sm font-medium text-zinc-300">
              {SYMBOL_LABELS[priceSymbol] ?? priceSymbol} 信号叠加图
            </h3>
            <span className="text-[10px] text-zinc-500 px-2 py-0.5 rounded bg-zinc-800/50">
              {signals.length} 个信号点
            </span>
          </div>

          <div className="text-right">
            <p className="text-lg font-bold text-zinc-200">
              {latestPrice.toLocaleString("zh-CN", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </p>
            <p
              className={cn(
                "text-[10px] font-medium",
                totalReturn >= 0 ? "text-emerald-400" : "text-red-400"
              )}
            >
              区间: {totalReturn >= 0 ? "+" : ""}
              {totalReturn.toFixed(2)}%
            </p>
          </div>
        </div>

        {/* 时间段 + 灯号统计 */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex gap-1">
            {TIME_RANGES.map((range) => (
              <button
                key={range.key}
                onClick={() => handleRangeSelect(range.key)}
                className={cn(
                  "px-2 py-0.5 text-[10px] rounded transition-all",
                  selectedRange === range.key
                    ? "bg-zinc-700/40 text-zinc-200"
                    : "text-zinc-500 hover:text-zinc-300 hover:bg-[var(--bg-card-hover)]"
                )}
              >
                {range.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3 text-[10px]">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span className="text-zinc-500">{signalStats.green}</span>
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-yellow-500" />
              <span className="text-zinc-500">{signalStats.yellow}</span>
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-red-500" />
              <span className="text-zinc-500">{signalStats.red}</span>
            </span>
            <span className="text-zinc-600 flex items-center gap-0.5">
              <ZoomIn className="w-3 h-3" />
              滚轮缩放
            </span>
          </div>
        </div>

        {/* 图表 */}
        <div onWheel={handleWheel} style={{ cursor: "ns-resize" }}>
          <ResponsiveContainer width="100%" height={400}>
            <ComposedChart
              data={chartData}
              margin={{ top: 10, right: 10, left: 10, bottom: 0 }}
            >
              <defs>
                <linearGradient id="priceGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#06b6d4" stopOpacity={0.15} />
                  <stop offset="100%" stopColor="#06b6d4" stopOpacity={0} />
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
                interval="preserveStartEnd"
                minTickGap={50}
                tickFormatter={(d: string) =>
                  new Date(d).toLocaleDateString("zh-CN", {
                    month: "short",
                    day: "numeric",
                    timeZone: "Asia/Shanghai",
                  })
                }
              />

              <YAxis
                stroke="#52525b"
                fontSize={10}
                tickLine={false}
                axisLine={false}
                width={55}
                domain={["auto", "auto"]}
                tickFormatter={(v) =>
                  v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v.toFixed(0)
                }
              />

              <RechartsTooltip content={<CustomTooltip />} />

              {/* 风险灯号背景色带 */}
              {riskBands.map((band, i) => {
                const bandStart = chartData[band.startIdx]?.date;
                const bandEnd = chartData[band.endIdx]?.date;
                if (!bandStart || !bandEnd) return null;
                return (
                  <ReferenceArea
                    key={`band-${i}`}
                    x1={bandStart}
                    x2={bandEnd}
                    fill={RISK_LIGHT_COLORS[band.riskLight] ?? RISK_LIGHT_COLORS.unknown}
                    fillOpacity={1}
                    stroke="none"
                  />
                );
              })}

              {/* 宏观状态变更标记线 */}
              {stateChangeLines.map((line, i) => {
                const dataPoint = chartData.find((d) => d.date === line.date);
                if (!dataPoint) return null;
                return (
                  <ReferenceLine
                    key={`state-${i}`}
                    x={dataPoint.date}
                    stroke="#a78bfa"
                    strokeDasharray="4 4"
                    strokeOpacity={0.5}
                    label={{
                      value: `${line.from}→${line.to}`,
                      position: "top",
                      fill: "#a78bfa",
                      fontSize: 9,
                    }}
                  />
                );
              })}

              {/* 价格折线 */}
              <Line
                type="monotone"
                dataKey="value"
                stroke="#06b6d4"
                strokeWidth={1.5}
                dot={false}
                activeDot={{
                  r: 4,
                  fill: "#06b6d4",
                  stroke: "#18181b",
                  strokeWidth: 2,
                }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        {/* 底部灯号图例 */}
        <div className="flex items-center justify-center gap-6 mt-3 text-[10px] text-zinc-500">
          <span className="flex items-center gap-1.5">
            <span className="w-8 h-2 rounded-sm bg-emerald-500/20 border border-emerald-500/30" />
            Green (1.0x)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-8 h-2 rounded-sm bg-yellow-500/20 border border-yellow-500/30" />
            Yellow (0.7x)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-8 h-2 rounded-sm bg-red-500/20 border border-red-500/30" />
            Red (0.4x)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-0 border-t border-dashed border-purple-400" />
            宏观状态切换
          </span>
        </div>
      </div>
    </div>
  );
}

/**
 * 自定义 Tooltip：显示信号详情
 */
function CustomTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: ChartDataPoint }>;
  label?: string;
}) {
  if (!active || !payload?.[0]) return null;

  const data = payload[0].payload;
  const signal = data.signal;

  const riskColor = RISK_LIGHT_BORDER[data.riskLight] ?? "#64748b";

  return (
    <div className="bg-zinc-900/95 border border-[var(--border-subtle)] rounded-xl p-3 shadow-xl min-w-[200px]">
      <p className="text-[11px] text-zinc-400 mb-2">{data.date}</p>

      {/* 价格 */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] text-zinc-500">SPX</span>
        <span className="text-sm font-bold text-zinc-200">
          {data.value.toLocaleString("zh-CN", { maximumFractionDigits: 2 })}
        </span>
      </div>

      {/* 灯号 + 宏观状态 */}
      <div className="flex items-center gap-2 mb-2">
        <span
          className="px-1.5 py-0.5 rounded text-[10px] font-medium"
          style={{
            backgroundColor: `${riskColor}20`,
            color: riskColor,
            border: `1px solid ${riskColor}40`,
          }}
        >
          {data.riskLight.toUpperCase()}
        </span>
        <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-purple-500/20 text-purple-400 border border-purple-500/40">
          State {data.macroState}
        </span>
      </div>

      {/* 信号详情（仅周五信号点） */}
      {signal && (
        <div className="border-t border-zinc-800 pt-2 mt-1 space-y-1">
          <div className="flex justify-between text-[10px]">
            <span className="text-zinc-500">流动性评分</span>
            <span className="text-zinc-300">{signal.liquidity_score.toFixed(0)}/100</span>
          </div>
          <div className="flex justify-between text-[10px]">
            <span className="text-zinc-500">杠杆系数</span>
            <span className="text-zinc-300">{signal.leverage_coef}x</span>
          </div>
          {signal.key_metrics.move != null && (
            <div className="flex justify-between text-[10px]">
              <span className="text-zinc-500">MOVE</span>
              <span className="text-zinc-300">
                {signal.key_metrics.move.toFixed(1)}
              </span>
            </div>
          )}
          {signal.key_metrics.sofr_iorb != null && (
            <div className="flex justify-between text-[10px]">
              <span className="text-zinc-500">SOFR-IORB</span>
              <span className="text-zinc-300">
                {signal.key_metrics.sofr_iorb.toFixed(1)}bp
              </span>
            </div>
          )}
          {signal.key_metrics.corr_20d != null && (
            <div className="flex justify-between text-[10px]">
              <span className="text-zinc-500">Corr 20D</span>
              <span className="text-zinc-300">
                {signal.key_metrics.corr_20d.toFixed(2)}
              </span>
            </div>
          )}
          {signal.gates_closed.length > 0 && (
            <div className="flex justify-between text-[10px]">
              <span className="text-zinc-500">闸门关闭</span>
              <span className="text-red-400 text-right">
                {signal.gates_closed.join(", ")}
              </span>
            </div>
          )}
          {signal.hard_stop_triggered && (
            <p className="text-[10px] text-red-400 font-medium mt-1">
              一票否决触发
            </p>
          )}
        </div>
      )}
    </div>
  );
}
