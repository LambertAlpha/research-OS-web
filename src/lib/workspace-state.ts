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
  // 用户手动覆盖该 pane 内 series 的 y 轴归属，缺失时走 ChartPane 自动聚类
  axisOverrides?: Record<string, "left" | "right">;
}

// 推荐默认勾选的事件类型（覆盖核心模型决策事件，不含 rule_triggered/alert 噪音）
export const DEFAULT_ENABLED_EVENT_TYPES: string[] = [
  "risk_light_change",
  "hard_stop",
  "macro_state_change",
  "equity_regime_change",
  "btc_pattern_triggered",
];

export interface WorkspaceState {
  panes: WorkspacePane[];
  range: TimeRangePreset;
  transform: ChartTransform;
  asOf: string | null; // YYYY-MM-DD or null（最新 vintage）
  // 选中的事件类型 ID 列表；空数组 = 不显示任何 markers
  enabledEventTypes: string[];
  // Ratio Mode：每个 pane 的所有 series 除以该 pane 第一个 series 的同 ts 值
  // 用于看跨 series 的相对比率（如 BTC / Realized Price）；first series 自身变成 y=1 基准
  ratioMode: boolean;
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
  enabledEventTypes: [...DEFAULT_ENABLED_EVENT_TYPES],
  ratioMode: false,
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
  carryEventTypes: string[] = [...DEFAULT_ENABLED_EVENT_TYPES],
  carryRatioMode: boolean = false,
): WorkspaceState {
  return {
    panes: preset.panes.map((p) => newPane(p.title, [...p.indicators])),
    range: carryRange ?? rangeFromDays(preset.default_range_days),
    transform: "none",
    asOf: carryAsOf,
    enabledEventTypes: carryEventTypes,
    ratioMode: carryRatioMode,
  };
}

// ============================================================
// URL serialization (compact base64 — 中文 title 安全)
// ============================================================

interface CompactState {
  // 新版字段
  p: { t: string; s: string[]; o?: Record<string, "left" | "right"> }[];
  r: TimeRangePreset;
  x: ChartTransform;
  a?: string | null;
  // M5: 选中事件类型数组（覆盖 M4 的 boolean e）
  et?: string[];
  // M4 兼容字段（旧 URL 中的 boolean）
  e?: boolean | string[];
  // M7+: Ratio Mode
  rm?: boolean;
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
    p: state.panes.map((p) => {
      const entry: CompactState["p"][number] = { t: p.title, s: p.symbols };
      if (p.axisOverrides && Object.keys(p.axisOverrides).length > 0) {
        entry.o = p.axisOverrides;
      }
      return entry;
    }),
    r: state.range,
    x: state.transform,
    a: state.asOf,
    et: state.enabledEventTypes,
    rm: state.ratioMode || undefined, // 仅在 true 时序列化，缩短 URL
  };
  return utf8ToBase64(JSON.stringify(compact));
}

export function decodeWorkspace(encoded: string): WorkspaceState | null {
  if (typeof window === "undefined") return null;
  try {
    const compact = JSON.parse(base64ToUtf8(encoded)) as CompactState;
    if (!Array.isArray(compact?.p)) return null;

    // 事件类型解析：et > e（兼容 M4 boolean / 老 array）
    let enabledEventTypes: string[];
    if (Array.isArray(compact.et)) {
      enabledEventTypes = compact.et.filter(
        (x): x is string => typeof x === "string",
      );
    } else if (Array.isArray(compact.e)) {
      enabledEventTypes = (compact.e as unknown[]).filter(
        (x): x is string => typeof x === "string",
      );
    } else if (compact.e === false) {
      enabledEventTypes = [];
    } else if (typeof compact.e === "string") {
      // 防御：旧 URL 中 `e` 意外是字符串，尝试 JSON.parse 否则降级到默认
      try {
        const parsed = JSON.parse(compact.e);
        enabledEventTypes = Array.isArray(parsed)
          ? parsed.filter((x: unknown): x is string => typeof x === "string")
          : [...DEFAULT_ENABLED_EVENT_TYPES];
      } catch {
        enabledEventTypes = [...DEFAULT_ENABLED_EVENT_TYPES];
      }
    } else {
      // M4 e=true 或缺失 → 默认 5 类
      enabledEventTypes = [...DEFAULT_ENABLED_EVENT_TYPES];
    }

    return {
      panes: compact.p.map((p) => {
        const pane = newPane(
          typeof p.t === "string" ? p.t : "Pane",
          Array.isArray(p.s) ? p.s : [],
        );
        if (p.o && typeof p.o === "object") {
          pane.axisOverrides = p.o;
        }
        return pane;
      }),
      range: compact.r ?? "1Y",
      transform: compact.x ?? "none",
      asOf: compact.a ?? null,
      enabledEventTypes,
      ratioMode: compact.rm === true,
    };
  } catch {
    return null;
  }
}
