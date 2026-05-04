/**
 * [INPUT]: { events, eventTypes } — 当前区间所有事件 + catalog.event_types 元数据
 * [OUTPUT]: 可展开的事件类型分布面板（替代旧的扁平 badges 列表）
 * [POS]: 位于 /components，被 /charts page 引用。让用户能"一眼对照"图上 markers
 *        的颜色/形状跟它们的中文含义，并点开看具体事件 ts + label。
 *
 * [PROTOCOL]:
 * 1. 不发起 API 请求；events 已是过滤后的当前区间事件。
 * 2. 按 event.type 分组聚合 count，type metadata（中文名 / severity 颜色）从
 *    eventTypes lookup；找不到时降级到 type id + 灰色 dot。
 * 3. 每个 type row 可点击展开/折叠列表；列表按 ts desc 排序。
 * 4. 颜色映射跟 ChartPane markers 的 severityColor 一致（critical=red /
 *    warning=amber / info=blue），让用户视觉对照即明白。
 */
"use client";

import { useState } from "react";
import { ChevronRight } from "lucide-react";
import type { ChartEvent, ChartEventType } from "@/types/api";

interface EventsBreakdownPanelProps {
  events: ChartEvent[];
  eventTypes: ChartEventType[];
}

const SEVERITY_COLOR: Record<string, string> = {
  critical: "#ef4444",
  warning: "#eab308",
  info: "#3b82f6",
};

const SEVERITY_LABEL: Record<string, string> = {
  critical: "重要",
  warning: "警告",
  info: "信息",
};

const SHAPE_FOR_SEVERITY: Record<string, string> = {
  critical: "▾", // 向下箭头（跟 ChartPane arrowDown 对应）
  warning: "●", // 圆点
  info: "●", // 圆点
};

export function EventsBreakdownPanel({
  events,
  eventTypes,
}: EventsBreakdownPanelProps) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  if (events.length === 0) return null;

  // 按 type 分组
  const grouped = new Map<string, ChartEvent[]>();
  for (const e of events) {
    if (!grouped.has(e.type)) grouped.set(e.type, []);
    grouped.get(e.type)!.push(e);
  }

  // type metadata lookup
  const metaById = new Map<string, ChartEventType>();
  for (const t of eventTypes) metaById.set(t.id, t);

  // 排序：count desc
  const rows = Array.from(grouped.entries())
    .sort(([, a], [, b]) => b.length - a.length)
    .map(([typeId, evs]) => ({
      typeId,
      events: evs,
      meta: metaById.get(typeId),
    }));

  const toggle = (typeId: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(typeId)) next.delete(typeId);
      else next.add(typeId);
      return next;
    });
  };

  return (
    <div className="rounded-md border border-[var(--border-subtle)] bg-[var(--bg-card)] p-3 text-xs">
      <div className="mb-2 flex items-baseline gap-2 text-[var(--text-secondary)]">
        <span className="font-medium">当前区间事件标记</span>
        <span className="text-[var(--text-faint)]">
          · 共 {events.length} 条 · 点击行展开详情
        </span>
      </div>

      <ul className="divide-y divide-[var(--border-subtle)]">
        {rows.map(({ typeId, events: evs, meta }) => {
          const severity = meta?.default_severity ?? "info";
          // 该组事件的实际 severity 可能跟 default 不同（如 risk_light_change 转 red 时是 critical）
          // 取该组实际 severities 的最严重（critical > warning > info）
          const actualSev =
            evs.find((e) => e.severity === "critical")
              ? "critical"
              : evs.find((e) => e.severity === "warning")
                ? "warning"
                : evs.find((e) => e.severity === "info")
                  ? "info"
                  : severity;
          const color = SEVERITY_COLOR[actualSev] ?? "var(--text-faint)";
          const shape = SHAPE_FOR_SEVERITY[actualSev] ?? "●";
          const isExpanded = expanded.has(typeId);
          const displayName = meta?.name ?? typeId;
          return (
            <li key={typeId}>
              <button
                onClick={() => toggle(typeId)}
                aria-expanded={isExpanded}
                className="flex w-full items-center gap-2 py-1.5 text-left hover:bg-[var(--bg-card-hover)] -mx-3 px-3"
              >
                <ChevronRight
                  aria-hidden="true"
                  className={
                    "h-3 w-3 shrink-0 text-[var(--text-faint)] transition-transform " +
                    (isExpanded ? "rotate-90" : "")
                  }
                />
                <span
                  className="inline-flex h-5 w-5 shrink-0 items-center justify-center font-mono text-base leading-none"
                  style={{ color }}
                  title={`严重级别：${SEVERITY_LABEL[actualSev] ?? actualSev}`}
                >
                  {shape}
                </span>
                <span className="text-[var(--text-primary)]">{displayName}</span>
                {meta?.model && (
                  <span className="text-[10px] uppercase tracking-wider text-[var(--text-faint)]">
                    {meta.model}
                  </span>
                )}
                <span className="ml-auto font-mono text-[var(--text-faint)]">
                  {evs.length}
                </span>
              </button>
              {isExpanded && (
                <ul className="max-h-96 space-y-1 overflow-y-auto px-9 pb-2 pt-1">
                  {[...evs]
                    .sort((a, b) => b.ts.localeCompare(a.ts))
                    .slice(0, 50) // 上限 50 条避免长得离谱
                    .map((e) => {
                      const evColor = SEVERITY_COLOR[e.severity] ?? color;
                      // review-driven：用稳定组合 key 而非数组 index
                      // 防止排序后 React 复用错位
                      const stableKey = `${typeId}-${e.ts}-${e.label}`;
                      return (
                        <li
                          key={stableKey}
                          className="flex items-baseline gap-2 text-[11px]"
                        >
                          <span
                            className="h-1.5 w-1.5 shrink-0 rounded-full"
                            style={{ backgroundColor: evColor }}
                          />
                          <span className="font-mono text-[var(--text-faint)]">
                            {e.ts.slice(0, 10)}
                          </span>
                          <span className="flex-1 text-[var(--text-secondary)]">
                            {e.label}
                          </span>
                          {e.from_state && e.to_state && (
                            <span className="font-mono text-[10px] text-[var(--text-faint)]">
                              {e.from_state} → {e.to_state}
                            </span>
                          )}
                        </li>
                      );
                    })}
                  {evs.length > 50 && (
                    <li className="text-[10px] text-[var(--text-faint)]">
                      ... 还有 {evs.length - 50} 条（隐藏）
                    </li>
                  )}
                </ul>
              )}
            </li>
          );
        })}
      </ul>

      <div className="mt-2 flex flex-wrap gap-3 border-t border-[var(--border-subtle)] pt-2 text-[10px] text-[var(--text-faint)]">
        <span>图上 markers 配色：</span>
        <span className="flex items-center gap-1">
          <span style={{ color: SEVERITY_COLOR.critical }}>▾</span>
          重要 (critical)
        </span>
        <span className="flex items-center gap-1">
          <span style={{ color: SEVERITY_COLOR.warning }}>●</span>
          警告 (warning)
        </span>
        <span className="flex items-center gap-1">
          <span style={{ color: SEVERITY_COLOR.info }}>●</span>
          信息 (info)
        </span>
      </div>
    </div>
  );
}
