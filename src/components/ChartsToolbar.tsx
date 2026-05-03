/**
 * [INPUT]: { presets, range, transform, onLoadPreset, onRangeChange, onTransformChange,
 *            onAddPane, onReset, onCopyUrl, copyState }
 * [OUTPUT]: 顶部工具栏 — 两行布局：第一行 preset 选择，第二行 区间/Transform/操作
 * [POS]: 位于 /components，被 /charts page 引用。pure presentational：所有 state 由父组件维护。
 */
"use client";

import { Copy, RotateCcw, Plus, Clock } from "lucide-react";
import type { ChartPreset, ChartEventType } from "@/types/api";
import {
  TIME_RANGE_PRESETS,
  type TimeRangePreset,
  type ChartTransform,
} from "@/lib/workspace-state";
import { EventsSelector } from "./EventsSelector";

interface ChartsToolbarProps {
  presets: ChartPreset[];
  range: TimeRangePreset;
  transform: ChartTransform;
  asOf: string | null;
  eventTypes: ChartEventType[];
  enabledEventTypes: string[];
  defaultEventTypes: string[];
  onLoadPreset: (preset: ChartPreset) => void;
  onRangeChange: (r: TimeRangePreset) => void;
  onTransformChange: (t: ChartTransform) => void;
  onAsOfChange: (asOf: string | null) => void;
  onEventTypesChange: (next: string[]) => void;
  onAddPane: () => void;
  onReset: () => void;
  onCopyUrl: () => void;
  copyState: "idle" | "copied";
}

const TRANSFORM_OPTIONS: { id: ChartTransform; label: string; tip: string }[] = [
  { id: "none", label: "原始", tip: "原始数值" },
  { id: "normalize", label: "归一化", tip: "起始值 = 100，便于跨数量级对比" },
  { id: "pct_change", label: "%变化", tip: "环比百分比变化" },
];

export function ChartsToolbar({
  presets,
  range,
  transform,
  asOf,
  eventTypes,
  enabledEventTypes,
  defaultEventTypes,
  onLoadPreset,
  onRangeChange,
  onTransformChange,
  onAsOfChange,
  onEventTypesChange,
  onAddPane,
  onReset,
  onCopyUrl,
  copyState,
}: ChartsToolbarProps) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card)] p-3">
      {/* Row 1: presets */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[10px] uppercase tracking-wider text-[var(--text-faint)]">
          Preset
        </span>
        {presets.map((p) => (
          <button
            key={p.id}
            onClick={() => onLoadPreset(p)}
            className="rounded-md border border-[var(--border-subtle)] bg-[var(--bg-inset)] px-2.5 py-1 text-xs text-[var(--text-secondary)] hover:bg-[var(--bg-card-hover)] hover:text-[var(--text-primary)]"
            title={p.description}
          >
            {p.name}
          </button>
        ))}
      </div>

      {/* Row 2: range / transform / actions */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] uppercase tracking-wider text-[var(--text-faint)]">
              区间
            </span>
            <div className="flex rounded-md border border-[var(--border-subtle)] bg-[var(--bg-inset)] p-0.5">
              {TIME_RANGE_PRESETS.map((p) => (
                <button
                  key={p.id}
                  onClick={() => onRangeChange(p.id)}
                  className={
                    "rounded px-2 py-0.5 text-xs transition-colors " +
                    (range === p.id
                      ? "bg-[var(--bg-elevated)] text-[var(--text-primary)]"
                      : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]")
                  }
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] uppercase tracking-wider text-[var(--text-faint)]">
              变换
            </span>
            <div className="flex rounded-md border border-[var(--border-subtle)] bg-[var(--bg-inset)] p-0.5">
              {TRANSFORM_OPTIONS.map((t) => (
                <button
                  key={t.id}
                  onClick={() => onTransformChange(t.id)}
                  className={
                    "rounded px-2 py-0.5 text-xs transition-colors " +
                    (transform === t.id
                      ? "bg-[var(--bg-elevated)] text-[var(--text-primary)]"
                      : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]")
                  }
                  title={t.tip}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* As Of vintage replay */}
          <div className="flex items-center gap-1.5">
            <span
              className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-[var(--text-faint)]"
              title="时间机器：查看某历史日期时点的数据状态（仅 raw 类型生效）"
            >
              <Clock className="h-3 w-3" />
              As Of
            </span>
            <input
              type="date"
              value={asOf ?? ""}
              onChange={(e) => onAsOfChange(e.target.value || null)}
              max={new Date().toISOString().slice(0, 10)}
              className={
                "rounded-md border bg-[var(--bg-inset)] px-2 py-0.5 text-xs outline-none " +
                (asOf
                  ? "border-[rgba(168,85,247,0.4)] text-[var(--text-primary)]"
                  : "border-[var(--border-subtle)] text-[var(--text-muted)]")
              }
            />
            {asOf && (
              <button
                onClick={() => onAsOfChange(null)}
                className="rounded-md border border-[var(--border-subtle)] bg-[var(--bg-inset)] px-1.5 py-0.5 text-[10px] text-[var(--text-muted)] hover:bg-[var(--bg-card-hover)] hover:text-[var(--text-primary)]"
                title="清除 As Of（回到最新 vintage）"
              >
                清除
              </button>
            )}
          </div>

          {/* Events selector — multi-select popover */}
          <EventsSelector
            eventTypes={eventTypes}
            enabled={enabledEventTypes}
            defaultRecommended={defaultEventTypes}
            onChange={onEventTypesChange}
          />
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onAddPane}
            className="flex items-center gap-1 rounded-md border border-[var(--border-subtle)] bg-[var(--bg-inset)] px-2 py-1 text-xs text-[var(--text-secondary)] hover:bg-[var(--bg-card-hover)] hover:text-[var(--text-primary)]"
          >
            <Plus className="h-3 w-3" />
            添加 Pane
          </button>
          <button
            onClick={onCopyUrl}
            className={
              "flex items-center gap-1 rounded-md border px-2 py-1 text-xs transition-colors " +
              (copyState === "copied"
                ? "border-[rgba(34,197,94,0.4)] bg-[rgba(34,197,94,0.1)] text-[var(--status-green)]"
                : "border-[var(--border-subtle)] bg-[var(--bg-inset)] text-[var(--text-secondary)] hover:bg-[var(--bg-card-hover)] hover:text-[var(--text-primary)]")
            }
          >
            <Copy className="h-3 w-3" />
            {copyState === "copied" ? "已复制" : "复制 URL"}
          </button>
          <button
            onClick={onReset}
            className="flex items-center gap-1 rounded-md border border-[var(--border-subtle)] bg-[var(--bg-inset)] p-1.5 text-xs text-[var(--text-muted)] hover:bg-[var(--bg-card-hover)] hover:text-[var(--text-primary)]"
            title="重置到默认 workspace"
          >
            <RotateCcw className="h-3 w-3" />
          </button>
        </div>
      </div>
    </div>
  );
}
