/**
 * [INPUT]: (label, value, sublabel?, color?, icon?, trend?, glowColor?, indicatorKey?) - 指标名称、数值、颜色和趋势方向、可选的指标解释 key。
 * [OUTPUT]: (<div>) - 带顶部渐变线、霓虹发光效果的单指标卡片,支持悬浮解释。
 * [POS]: 位于 /components,被 Overview 页面引用。展示风险灯号、流动性评分、杠杆系数等核心数值。
 *
 * [PROTOCOL]:
 * 1. 一旦本文件逻辑变更,必须同步更新此 Header。
 * 2. 更新后必须上浮检查 /src/components/.folder.md 的描述是否依然准确。
 */
"use client";

import { cn } from "@/lib/utils";
import { Tooltip } from "./Tooltip";

interface MetricCardProps {
  label: string;
  value: string | number;
  sublabel?: string;
  color?: string;
  icon?: React.ReactNode;
  trend?: "up" | "down" | "neutral";
  glowColor?: string;
  indicatorKey?: string;
}

export function MetricCard({
  label,
  value,
  sublabel,
  color = "#06b6d4",
  icon,
  trend,
  glowColor,
  indicatorKey,
}: MetricCardProps) {
  const trendColor =
    trend === "up"
      ? "text-emerald-400"
      : trend === "down"
      ? "text-red-400"
      : "text-zinc-400";

  const effectiveGlow = glowColor || color;

  return (
    <div
      className={cn(
        "group relative rounded-2xl p-5 overflow-hidden transition-all duration-500",
        "bg-gradient-to-br from-zinc-900/80 to-zinc-950/80",
        "border border-zinc-800/50 hover:border-cyan-500/30",
        "backdrop-blur-xl"
      )}
    >
      {/* 顶部渐变线 */}
      <div
        className="absolute top-0 left-0 right-0 h-0.5 opacity-60"
        style={{
          background: `linear-gradient(90deg, transparent, ${effectiveGlow}, transparent)`,
        }}
      />

      {/* Hover 时的内发光 */}
      <div
        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-2xl"
        style={{
          boxShadow: `inset 0 0 40px -15px ${effectiveGlow}40`,
        }}
      />

      {/* 内容 */}
      <div className="relative z-10">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
              {label}
            </p>
            {indicatorKey && <Tooltip indicatorKey={indicatorKey} placement="right" />}
          </div>
          {icon && (
            <div
              className="p-2 rounded-lg"
              style={{ backgroundColor: `${color}15` }}
            >
              {icon}
            </div>
          )}
        </div>

        <p
          className="text-3xl font-bold mb-1 transition-all duration-300"
          style={{
            color,
            textShadow: `0 0 30px ${effectiveGlow}60`,
          }}
        >
          {value}
        </p>

        {sublabel && (
          <p className={cn("text-xs mt-2 font-medium", trendColor)}>
            {sublabel}
          </p>
        )}
      </div>

      {/* 角落装饰 */}
      <div className="absolute bottom-0 right-0 w-20 h-20 opacity-5">
        <div
          className="w-full h-full"
          style={{
            background: `radial-gradient(circle at bottom right, ${color}, transparent 70%)`,
          }}
        />
      </div>
    </div>
  );
}
