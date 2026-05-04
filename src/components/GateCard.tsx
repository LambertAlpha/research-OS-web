/**
 * [INPUT]: (gate: GateStatus) - 门控状态对象，含 name/status/value/threshold/message。
 * [OUTPUT]: (<div>) - 闸门状态卡片，schema-aware 渲染：单值用进度条，多值（如 Credit Gate）展开为内联标签。
 * [POS]: 位于 /components，被 Macro 页面引用。可视化 Layer3 风险闸门矩阵中的单个闸门。
 *
 * [PROTOCOL]:
 * 1. 一旦本文件逻辑变更，必须同步更新此 Header。
 * 2. 更新后必须上浮检查 /src/components/.folder.md 的描述是否依然准确。
 */
"use client";

import { getGateStatusColor } from "@/lib/utils";
import { cn } from "@/lib/utils";
import type { GateStatus } from "@/types/api";
import { Tooltip } from "./Tooltip";

interface GateCardProps {
  gate: GateStatus;
}

// 复合 value/threshold 的字段标签（中文化）
const KEY_LABELS: Record<string, string> = {
  HY_OAS: "HY",
  IG_OAS: "IG",
  HY_OAS_pct: "HY ≥",
  IG_OAS_pct: "IG ≥",
  acceleration: "加速",
  positive: "正阈",
  negative: "负阈",
};

// 字段单位推断
type FieldUnit = "percent" | "bps" | "ratio" | "bool" | "raw";
const KEY_UNITS: Record<string, FieldUnit> = {
  HY_OAS: "percent",
  IG_OAS: "percent",
  HY_OAS_pct: "percent",
  IG_OAS_pct: "percent",
  acceleration: "bool",
  positive: "ratio",
  negative: "ratio",
};

function formatScalar(value: unknown, unit?: FieldUnit): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "boolean") return value ? "✓" : "✗";
  if (typeof value !== "number") return String(value);
  if (unit === "percent") return `${value.toFixed(2)}%`;
  if (unit === "bps") return `${value.toFixed(0)} bps`;
  if (unit === "ratio") return value.toFixed(2);
  if (Math.abs(value) >= 1000)
    return value.toLocaleString("en", { maximumFractionDigits: 0 });
  return value.toFixed(2);
}

// schema-aware 值渲染：标量直接显示，对象展开为内联标签序列
function ValueDisplay({ value, align = "right" }: { value: unknown; align?: "left" | "right" }) {
  if (value === null || value === undefined) {
    return <span className="text-zinc-400 tabular-nums font-medium">—</span>;
  }
  if (typeof value === "number") {
    return <span className="text-zinc-400 tabular-nums font-medium">{value.toFixed(2)}</span>;
  }
  if (typeof value === "boolean") {
    return (
      <span
        className={cn(
          "tabular-nums font-medium",
          value ? "text-amber-400" : "text-zinc-500"
        )}
      >
        {value ? "✓ Yes" : "✗ No"}
      </span>
    );
  }
  if (typeof value === "string") {
    return <span className="text-zinc-400 font-medium">{value}</span>;
  }
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    return (
      <div
        className={cn(
          "flex flex-wrap items-center gap-x-2 gap-y-0.5",
          align === "right" ? "justify-end" : "justify-start"
        )}
      >
        {Object.entries(obj).map(([k, v]) => {
          const label = KEY_LABELS[k] || k;
          const unit = KEY_UNITS[k];
          const isBool = typeof v === "boolean";
          const text = formatScalar(v, unit);
          const valueColor = isBool
            ? v
              ? "text-amber-400"
              : "text-zinc-600"
            : "text-zinc-300";
          return (
            <span key={k} className="inline-flex items-center gap-1 text-[11px] whitespace-nowrap">
              <span className="text-zinc-500">{label}</span>
              <span className={cn("tabular-nums font-medium", valueColor)}>{text}</span>
            </span>
          );
        })}
      </div>
    );
  }
  return <span className="text-zinc-400 font-medium">{String(value)}</span>;
}

// 计算进度条：value 和 threshold 都是 number 时直接比；如果都是 object 则用第一个数值字段对照
function computeProgress(
  value: GateStatus["value"],
  threshold: GateStatus["threshold"]
): number | null {
  if (typeof value === "number" && typeof threshold === "number" && threshold !== 0) {
    return Math.min(100, Math.max(0, (value / threshold) * 100));
  }
  // 复合 object：尝试匹配 *_pct 阈值（如 HY_OAS / HY_OAS_pct）
  if (
    value &&
    typeof value === "object" &&
    threshold &&
    typeof threshold === "object"
  ) {
    const v = value as Record<string, unknown>;
    const t = threshold as Record<string, unknown>;
    for (const [k, vNum] of Object.entries(v)) {
      if (typeof vNum !== "number") continue;
      const thrKey = `${k}_pct` in t ? `${k}_pct` : k in t ? k : null;
      const thrNum = thrKey ? t[thrKey] : undefined;
      if (typeof thrNum === "number" && thrNum !== 0) {
        return Math.min(100, Math.max(0, (vNum / thrNum) * 100));
      }
    }
  }
  return null;
}

export function GateCard({ gate }: GateCardProps) {
  const statusColor = getGateStatusColor(gate.status);
  const isClosed = gate.status === "closed";
  const progress = computeProgress(gate.value, gate.threshold);

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
          <Tooltip
            indicatorKey={gate.name.toLowerCase().replace(/\s+/g, "_")}
            placement="right"
          />
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

      {/* Value */}
      <div className="space-y-1.5">
        <div className="flex justify-between items-start text-xs gap-3">
          <span className="text-[var(--text-muted)] flex-shrink-0">Value</span>
          <div className="min-w-0 flex-1 flex justify-end">
            <ValueDisplay value={gate.value} align="right" />
          </div>
        </div>

        {/* 进度条 — 仅当能计算出有效比例时显示 */}
        {progress !== null && (
          <div className="h-1 bg-[var(--bg-inset)] rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${progress}%`,
                backgroundColor: statusColor,
              }}
            />
          </div>
        )}

        {/* Threshold */}
        <div className="flex justify-between items-start text-xs gap-3">
          <span className="text-[var(--text-muted)] flex-shrink-0">Threshold</span>
          <div className="min-w-0 flex-1 flex justify-end">
            <ValueDisplay value={gate.threshold} align="right" />
          </div>
        </div>
      </div>
    </div>
  );
}
