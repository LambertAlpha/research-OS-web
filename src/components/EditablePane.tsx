/**
 * [INPUT]: { pane, series, missingSymbols, onRemoveSeries, onAddIndicator, onDeletePane }
 * [OUTPUT]: 单个可编辑 pane — title bar (添加/删除按钮) + series chips (含 ✕) + ChartPane canvas
 * [POS]: 位于 /components，被 /charts page 引用。包装 ChartPane 加上 CRUD 控件，
 *        并在 series 都 missing 时退化到 "暂无数据" 占位。
 *
 * [PROTOCOL]:
 * 1. 不发起 API 请求；series + missingSymbols 由父组件预先按 pane.symbols 切分。
 * 2. ChartPane 只接收非空 series；missingSymbols 仅在 chips 区显示 amber 标记。
 * 3. 移除 series 直接从 pane.symbols 删除（不区分 missing vs present）。
 */
"use client";

import { X, Plus, Trash2 } from "lucide-react";
import { ChartPane } from "./ChartPane";
import { PriceLineManager } from "./PriceLineManager";
import type { ChartEvent, ChartSeries } from "@/types/api";
import {
  rangeToDays,
  type PriceLine,
  type TimeRangePreset,
  type WorkspacePane,
} from "@/lib/workspace-state";
import { getSeriesColor } from "@/lib/chart-theme";

const PANE_TIMERANGE_OPTIONS: { value: TimeRangePreset | ""; label: string }[] = [
  { value: "", label: "跟全局" },
  { value: "1M", label: "1M" },
  { value: "3M", label: "3M" },
  { value: "6M", label: "6M" },
  { value: "1Y", label: "1Y" },
  { value: "2Y", label: "2Y" },
  { value: "3Y", label: "3Y" },
  { value: "ALL", label: "ALL" },
];

interface EditablePaneProps {
  pane: WorkspacePane;
  series: ChartSeries[];
  events?: ChartEvent[];
  missingSymbols: string[];
  ratioMode?: boolean;
  customMarkers?: { id: string; ts: string; label: string; severity: "info" | "warning" | "critical" }[];
  visibleStart?: string;
  visibleEnd?: string;
  // 全局 range — 用于 disable 大于全局的 pane timeRange 选项（避免数据被隐形截断）
  globalRange?: TimeRangePreset;
  onRemoveSeries: (symbol: string) => void;
  onAddIndicator: () => void;
  onDeletePane: () => void;
  onSetAxisOverride?: (
    symbol: string,
    axis: "left" | "right" | null,
  ) => void;
  onSetPaneTimeRange?: (range: TimeRangePreset | null) => void;
  onAddPriceLine?: (
    value: number,
    label: string,
    color: PriceLine["color"],
  ) => void;
  onRemovePriceLine?: (id: string) => void;
}

// chip 上的轴状态循环：null (Auto) → left → right → null
function nextAxisState(
  current: "left" | "right" | undefined,
): "left" | "right" | null {
  if (current === undefined) return "left";
  if (current === "left") return "right";
  return null; // 从 right → 回到 Auto
}

function axisLabel(current: "left" | "right" | undefined): string {
  if (current === "left") return "L";
  if (current === "right") return "R";
  return "Auto";
}

function axisColor(current: "left" | "right" | undefined): string {
  if (current === "left") return "var(--status-green)";
  if (current === "right") return "#3b82f6";
  return "var(--text-faint)";
}

export function EditablePane({
  pane,
  series,
  events,
  missingSymbols,
  ratioMode = false,
  customMarkers,
  visibleStart,
  visibleEnd,
  globalRange,
  onRemoveSeries,
  onAddIndicator,
  onDeletePane,
  onSetAxisOverride,
  onSetPaneTimeRange,
  onAddPriceLine,
  onRemovePriceLine,
}: EditablePaneProps) {
  // axis toggle 仅对多 series 且存在数据的 pane 有意义
  const showAxisToggle = series.length >= 2 && onSetAxisOverride !== undefined;
  const totalSymbols = pane.symbols.length;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3 px-1">
        <div className="flex items-baseline gap-2">
          <h3 className="text-sm font-medium text-[var(--text-primary)]">
            {pane.title}
          </h3>
          {pane.timeRange && (
            <span className="rounded border border-[rgba(168,85,247,0.3)] bg-[rgba(168,85,247,0.08)] px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-[#a855f7]">
              {pane.timeRange}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {onSetPaneTimeRange && (
            <select
              value={pane.timeRange ?? ""}
              onChange={(e) => {
                const v = e.target.value;
                onSetPaneTimeRange(v === "" ? null : (v as TimeRangePreset));
              }}
              className="rounded-md border border-[var(--border-subtle)] bg-[var(--bg-card)] px-1.5 py-0.5 text-xs text-[var(--text-secondary)] outline-none hover:bg-[var(--bg-card-hover)] hover:text-[var(--text-primary)]"
              title="此 pane 的 timeRange override（仅 zoom in 至 ≤ 全局范围；要更大区间请调全局工具栏）"
            >
              {PANE_TIMERANGE_OPTIONS.map((opt) => {
                const isLarger =
                  opt.value !== "" &&
                  globalRange !== undefined &&
                  rangeToDays(opt.value as TimeRangePreset) >
                    rangeToDays(globalRange);
                return (
                  <option key={opt.value} value={opt.value} disabled={isLarger}>
                    {opt.label}
                    {isLarger ? " (>全局)" : ""}
                  </option>
                );
              })}
            </select>
          )}
          {onAddPriceLine && onRemovePriceLine && (
            <PriceLineManager
              lines={pane.priceLines ?? []}
              onAdd={onAddPriceLine}
              onRemove={onRemovePriceLine}
            />
          )}
          <button
            onClick={onAddIndicator}
            className="flex items-center gap-1 rounded-md border border-[var(--border-subtle)] bg-[var(--bg-card)] px-2 py-1 text-xs text-[var(--text-secondary)] hover:bg-[var(--bg-card-hover)] hover:text-[var(--text-primary)]"
            title="添加指标到此 pane"
          >
            <Plus className="h-3 w-3" />
            指标
          </button>
          <button
            onClick={onDeletePane}
            className="rounded-md border border-[var(--border-subtle)] bg-[var(--bg-card)] p-1.5 text-[var(--text-faint)] transition-colors hover:bg-[var(--bg-card-hover)] hover:text-[var(--status-red)]"
            title="删除 pane"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      </div>

      {/* chips：按 pane.symbols 顺序 */}
      {totalSymbols > 0 && (
        <div className="flex flex-wrap gap-1.5 px-1">
          {pane.symbols.map((sym, idx) => {
            const s = series.find((x) => x.symbol === sym);
            const isMissing = missingSymbols.includes(sym);
            const axisState = pane.axisOverrides?.[sym];
            return (
              <span
                key={sym}
                className={
                  "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs " +
                  (isMissing
                    ? "border-[rgba(234,179,8,0.3)] bg-[rgba(234,179,8,0.06)]"
                    : "border-[var(--border-subtle)] bg-[var(--bg-card)]")
                }
              >
                <span
                  className="inline-block h-1.5 w-1.5 rounded-full"
                  style={{
                    backgroundColor: isMissing
                      ? "var(--status-amber)"
                      : getSeriesColor(idx),
                  }}
                />
                <span
                  className={
                    isMissing
                      ? "text-[var(--status-amber)]"
                      : "text-[var(--text-secondary)]"
                  }
                >
                  {s?.display_name ?? sym}
                </span>
                {s && (
                  <span className="text-[var(--text-faint)]">
                    {s.points.length}pts
                  </span>
                )}
                {isMissing && (
                  <span className="text-[var(--text-faint)]">missing</span>
                )}
                {showAxisToggle && !isMissing && (
                  <button
                    onClick={() =>
                      onSetAxisOverride?.(sym, nextAxisState(axisState))
                    }
                    className="rounded px-1 font-mono text-[9px] uppercase transition-colors hover:bg-[var(--bg-card-hover)]"
                    style={{ color: axisColor(axisState) }}
                    title={
                      axisState
                        ? `Y 轴：${axisState === "left" ? "左" : "右"}（手动）— 点击循环切换`
                        : "Y 轴：自动 — 点击切到左轴"
                    }
                  >
                    {axisLabel(axisState)}
                  </button>
                )}
                <button
                  onClick={() => onRemoveSeries(sym)}
                  className="text-[var(--text-faint)] transition-colors hover:text-[var(--status-red)]"
                  title="移除"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            );
          })}
        </div>
      )}

      {/* chart canvas */}
      {series.length > 0 ? (
        <ChartPane
          series={series}
          events={events}
          customMarkers={customMarkers}
          axisOverrides={pane.axisOverrides}
          height={300}
          ratioMode={ratioMode}
          visibleStart={visibleStart}
          visibleEnd={visibleEnd}
          priceLines={pane.priceLines}
        />
      ) : (
        <div className="rounded-[10px] border border-dashed border-[var(--border-subtle)] bg-[var(--bg-inset)] py-12 text-center text-sm text-[var(--text-muted)]">
          {totalSymbols === 0
            ? "点击「指标」按钮添加到此 pane"
            : "选定指标暂无可用数据（详见上方 chip 标记）"}
        </div>
      )}
    </div>
  );
}
