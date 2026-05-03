/**
 * [INPUT]: ChartPreset / 历史 WorkspaceState / URL ?w=base64 query
 * [OUTPUT]: WorkspaceState — pane 配置 + 时间区间 + transform 模式
 * [POS]: 位于 /lib，被 /app/charts/page.tsx 引用。Charts Workspace 的 state model
 *        + URL 序列化层（用户复制 URL 即恢复完整 workspace 配置）。
 *
 * [PROTOCOL]:
 * 1. 序列化用 base64(unicode-safe(JSON.stringify(compact)))；compact 不存 id（每次 deserialize 重生）。
 * 2. URL key 固定 ?w=...，不污染其他 query param。
 * 3. crypto.randomUUID() 生成 pane id（用于 React key）；ssr fallback 单调递增。
 */
"use client";

import type { ChartPreset } from "@/types/api";

export type TimeRangePreset = "1M" | "3M" | "6M" | "1Y" | "2Y" | "3Y" | "ALL";

export const TIME_RANGE_PRESETS: { id: TimeRangePreset; label: string }[] = [
  { id: "1M", label: "1M" },
  { id: "3M", label: "3M" },
  { id: "6M", label: "6M" },
  { id: "1Y", label: "1Y" },
  { id: "2Y", label: "2Y" },
  { id: "3Y", label: "3Y" },
  { id: "ALL", label: "ALL" },
];

export type ChartTransform = "none" | "normalize" | "pct_change";

export interface WorkspacePane {
  id: string;
  title: string;
  symbols: string[];
}

export interface WorkspaceState {
  panes: WorkspacePane[];
  range: TimeRangePreset;
  transform: ChartTransform;
  asOf: string | null; // YYYY-MM-DD or null（最新 vintage）
  showEvents: boolean;  // 是否在每个 pane 上叠加事件 markers
}

let _idCounter = 0;
function genPaneId(): string {
  if (typeof window !== "undefined" && window.crypto?.randomUUID) {
    return window.crypto.randomUUID();
  }
  _idCounter += 1;
  return `pane-${Date.now()}-${_idCounter}`;
}

export function newPane(title: string, symbols: string[] = []): WorkspacePane {
  return { id: genPaneId(), title, symbols };
}

export const DEFAULT_WORKSPACE: WorkspaceState = {
  panes: [
    newPane("Liquidity Quantity", ["NET_LIQUIDITY", "WRESBAL"]),
    newPane("Plumbing & Vol Gate", ["MOVE", "SOFR_IORB_SPREAD"]),
  ],
  range: "1Y",
  transform: "none",
  asOf: null,
  showEvents: true,
};

export function rangeToDays(range: TimeRangePreset): number {
  switch (range) {
    case "1M":
      return 30;
    case "3M":
      return 90;
    case "6M":
      return 180;
    case "1Y":
      return 365;
    case "2Y":
      return 730;
    case "3Y":
      return 1095;
    case "ALL":
      return 3650; // 后端无 ALL 概念，用 10 年逼近"全部历史"
  }
}

export function rangeFromDays(days: number): TimeRangePreset {
  if (days <= 31) return "1M";
  if (days <= 95) return "3M";
  if (days <= 185) return "6M";
  if (days <= 370) return "1Y";
  if (days <= 740) return "2Y";
  if (days <= 1100) return "3Y";
  return "ALL";
}

export function presetToWorkspace(
  preset: ChartPreset,
  carryRange?: TimeRangePreset,
  carryAsOf: string | null = null,
  carryShowEvents: boolean = true,
): WorkspaceState {
  return {
    panes: preset.panes.map((p) => newPane(p.title, [...p.indicators])),
    range: carryRange ?? rangeFromDays(preset.default_range_days),
    transform: "none",
    asOf: carryAsOf,
    showEvents: carryShowEvents,
  };
}

// ============================================================
// URL serialization (compact base64 — 中文 title 安全)
// ============================================================

interface CompactState {
  p: { t: string; s: string[] }[];
  r: TimeRangePreset;
  x: ChartTransform;
  a?: string | null;
  e?: boolean;
}

function utf8ToBase64(s: string): string {
  // unicode-safe btoa
  return btoa(unescape(encodeURIComponent(s)));
}

function base64ToUtf8(s: string): string {
  return decodeURIComponent(escape(atob(s)));
}

export function encodeWorkspace(state: WorkspaceState): string {
  if (typeof window === "undefined") return "";
  const compact: CompactState = {
    p: state.panes.map((p) => ({ t: p.title, s: p.symbols })),
    r: state.range,
    x: state.transform,
    a: state.asOf,
    e: state.showEvents,
  };
  return utf8ToBase64(JSON.stringify(compact));
}

export function decodeWorkspace(encoded: string): WorkspaceState | null {
  if (typeof window === "undefined") return null;
  try {
    const compact = JSON.parse(base64ToUtf8(encoded)) as CompactState;
    if (!Array.isArray(compact?.p)) return null;
    return {
      panes: compact.p.map((p) =>
        newPane(typeof p.t === "string" ? p.t : "Pane", Array.isArray(p.s) ? p.s : []),
      ),
      range: compact.r ?? "1Y",
      transform: compact.x ?? "none",
      asOf: compact.a ?? null,
      showEvents: compact.e ?? true,
    };
  } catch {
    return null;
  }
}
