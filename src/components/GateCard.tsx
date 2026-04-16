/**
 * [INPUT]: (gate: GateStatus) - 门控状态对象，含 name/status/value/threshold/message。
 * [OUTPUT]: (<div>) - 闸门状态卡片，含状态指示器、值/阈值显示、进度条、Tooltip 悬浮解释。
 * [POS]: 位于 /components，被 Macro 页面引用。可视化 Layer3 风险闸门矩阵中的单个闸门。
 *
 * [PROTOCOL]:
 * 1. 一旦本文件逻辑变更，必须同步更新此 Header。
 * 2. 更新后必须上浮检查 /src/components/.folder.md 的描述是否依然准确。
 */
"use client";

import { getGateStatusColor } from "@/lib/utils";
import type { GateStatus } from "@/types/api";
import { Tooltip } from "./Tooltip";

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
  const isClosed = gate.status === "closed";

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

  return (
    <div
      className="bg-[var(--bg-card)] rounded-[14px] p-4 transition-colors duration-150 hover:bg-[var(--bg-card-hover)]"
      style={{
        border: isClosed
          ? `1px solid rgba(239, 68, 68, 0.2)`
          : `1px solid var(--border-subtle)`,
        boxShadow: isClosed
          ? `inset 0 0 16px -8px rgba(239, 68, 68, 0.08)`
          : "none",
      }}
    >
      {/* 标题 + 状态 */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <h4 className="font-medium text-zinc-300 text-sm">{gate.name}</h4>
          <Tooltip indicatorKey={gate.name.toLowerCase().replace(/\s+/g, "_")} placement="right" />
        </div>
        <span
          className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wide"
          style={{ color: statusColor }}
        >
          <span
            className="w-1.5 h-1.5 rounded-full"
            style={{
              backgroundColor: statusColor,
              boxShadow: isClosed ? `0 0 6px ${statusColor}60` : "none",
            }}
          />
          {gate.status}
        </span>
      </div>

      {/* 描述 */}
      {gate.message && (
        <p className="text-xs text-[var(--text-muted)] mb-2 line-clamp-2">
          {gate.message}
        </p>
      )}

      {/* 值、进度条、阈值 */}
      <div className="space-y-1.5">
        <div className="flex justify-between text-xs">
          <span className="text-[var(--text-muted)]">Value</span>
          <span className="text-zinc-400 tabular-nums font-medium">
            {formatValue(gate.value)}
          </span>
        </div>

        <div className="h-1 bg-[var(--bg-inset)] rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${progress}%`,
              backgroundColor: statusColor,
            }}
          />
        </div>

        <div className="flex justify-between text-xs">
          <span className="text-[var(--text-muted)]">Threshold</span>
          <span className="text-[var(--text-muted)] tabular-nums text-right max-w-[100px] truncate">
            {formatValue(gate.threshold)}
          </span>
        </div>
      </div>
    </div>
  );
}
