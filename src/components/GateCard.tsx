/**
 * [INPUT]: (gate: GateStatus) - 门控状态对象，含 name/status/value/threshold/message。
 * [OUTPUT]: (<div>) - 闸门状态卡片，含状态指示器（脉冲动画）、值/阈值显示、进度条。
 * [POS]: 位于 /components，被 Overview 和 Macro 页面引用。可视化 Layer3 风险闸门矩阵中的单个闸门。
 *
 * [PROTOCOL]:
 * 1. 一旦本文件逻辑变更，必须同步更新此 Header。
 * 2. 更新后必须上浮检查 /src/components/.folder.md 的描述是否依然准确。
 */
"use client";

import { getGateStatusColor } from "@/lib/utils";
import type { GateStatus } from "@/types/api";
import { cn } from "@/lib/utils";

interface GateCardProps {
  gate: GateStatus;
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return "-";
  if (typeof value === "number") return value.toFixed(2);
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

export function GateCard({ gate }: GateCardProps) {
  const statusColor = getGateStatusColor(gate.status);

  // 计算进度条（仅当 value 和 threshold 都是数值时）
  let progress = 50;
  if (
    typeof gate.value === "number" &&
    typeof gate.threshold === "number" &&
    gate.threshold !== 0
  ) {
    progress = Math.min(
      100,
      Math.max(0, (gate.value / gate.threshold) * 100)
    );
  }

  const isOpen = gate.status === "open";
  const isClosed = gate.status === "closed";

  return (
    <div
      className={cn(
        "group relative rounded-2xl p-4 overflow-hidden transition-all duration-500",
        "bg-gradient-to-br from-zinc-900/80 to-zinc-950/80",
        "border backdrop-blur-xl",
        isOpen && "border-emerald-500/30 hover:border-emerald-500/50",
        isClosed && "border-red-500/30 hover:border-red-500/50",
        !isOpen && !isClosed && "border-amber-500/30 hover:border-amber-500/50"
      )}
    >
      {/* 顶部渐变线 */}
      <div
        className="absolute top-0 left-0 right-0 h-0.5 opacity-70"
        style={{
          background: `linear-gradient(90deg, transparent, ${statusColor}, transparent)`,
        }}
      />

      {/* 状态发光背景 */}
      <div
        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-2xl"
        style={{
          boxShadow: `inset 0 0 30px -15px ${statusColor}50`,
        }}
      />

      {/* 内容 */}
      <div className="relative z-10">
        <div className="flex items-center justify-between mb-3">
          <h4 className="font-semibold text-zinc-200 text-sm">{gate.name}</h4>
          <span
            className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5"
            style={{
              backgroundColor: `${statusColor}15`,
              color: statusColor,
              boxShadow: `0 0 15px -5px ${statusColor}50`,
            }}
          >
            <span
              className="w-1.5 h-1.5 rounded-full animate-pulse"
              style={{ backgroundColor: statusColor }}
            />
            {gate.status}
          </span>
        </div>

        {gate.message && (
          <p className="text-xs text-zinc-500 mb-3 line-clamp-2">
            {gate.message}
          </p>
        )}

        <div className="space-y-2">
          <div className="flex justify-between text-xs">
            <span className="text-zinc-500">Value</span>
            <span className="text-zinc-300 font-medium">
              {formatValue(gate.value)}
            </span>
          </div>

          {/* 进度条 */}
          <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-700 ease-out"
              style={{
                width: `${progress}%`,
                backgroundColor: statusColor,
                boxShadow: `0 0 10px ${statusColor}`,
              }}
            />
          </div>

          <div className="flex justify-between text-xs">
            <span className="text-zinc-500">Threshold</span>
            <span
              className="text-zinc-400 text-right max-w-[100px] truncate"
              title={formatValue(gate.threshold)}
            >
              {formatValue(gate.threshold)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
