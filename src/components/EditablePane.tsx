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
import type { ChartSeries } from "@/types/api";
import type { WorkspacePane } from "@/lib/workspace-state";
import { getSeriesColor } from "@/lib/chart-theme";

interface EditablePaneProps {
  pane: WorkspacePane;
  series: ChartSeries[];
  missingSymbols: string[];
  onRemoveSeries: (symbol: string) => void;
  onAddIndicator: () => void;
  onDeletePane: () => void;
}

export function EditablePane({
  pane,
  series,
  missingSymbols,
  onRemoveSeries,
  onAddIndicator,
  onDeletePane,
}: EditablePaneProps) {
  const totalSymbols = pane.symbols.length;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3 px-1">
        <h3 className="text-sm font-medium text-[var(--text-primary)]">
          {pane.title}
        </h3>
        <div className="flex items-center gap-1">
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
        <ChartPane series={series} height={300} />
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
