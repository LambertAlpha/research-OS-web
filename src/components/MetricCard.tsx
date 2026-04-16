/**
 * [INPUT]: (label, value, sublabel?, color?, icon?, trend?, indicatorKey?) - 指标名称、数值、颜色和趋势方向、可选的指标解释 key。
 * [OUTPUT]: (<div>) - 扁平暗色指标卡片,支持悬浮解释 Tooltip。
 * [POS]: 位于 /components，通用指标卡片组件。展示风险灯号、流动性评分、杠杆系数等核心数值。当前暂无页面引用，保留备用。
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
  color = "#a1a1aa",
  icon,
  trend,
  indicatorKey,
}: MetricCardProps) {
  const trendColor =
    trend === "up"
      ? "text-emerald-400"
      : trend === "down"
      ? "text-red-400"
      : "text-zinc-500";

  return (
    <div className="bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-[14px] p-5 transition-colors duration-150 hover:bg-[var(--bg-card-hover)]">
      {/* 标签 + Tooltip */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-1.5">
          <p className="text-[11px] font-medium text-[var(--text-muted)] uppercase tracking-wider">
            {label}
          </p>
          {indicatorKey && <Tooltip indicatorKey={indicatorKey} placement="right" />}
        </div>
        {icon && <div className="text-[var(--text-faint)]">{icon}</div>}
      </div>

      {/* 数值 */}
      <p
        className="text-[1.75rem] font-semibold tabular-nums leading-tight"
        style={{ color }}
      >
        {value}
      </p>

      {/* 副标签 */}
      {sublabel && (
        <p className={cn("text-xs mt-1.5", trendColor)}>
          {sublabel}
        </p>
      )}
    </div>
  );
}
