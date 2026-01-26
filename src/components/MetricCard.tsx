"use client";

import { cn } from "@/lib/utils";

interface MetricCardProps {
  label: string;
  value: string | number;
  sublabel?: string;
  color?: string;
  icon?: React.ReactNode;
  trend?: "up" | "down" | "neutral";
  glowColor?: string;
}

export function MetricCard({
  label,
  value,
  sublabel,
  color = "#06b6d4",
  icon,
  trend,
  glowColor,
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
          <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
            {label}
          </p>
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
