/**
 * [INPUT]: ?w=base64 query param（可选，恢复 workspace state；缺省走 DEFAULT_WORKSPACE）
 * [OUTPUT]: /charts 路由 — Charts Workspace M3：自由组合 + URL 序列化 + 时间区间切换 + Transform
 * [POS]: 位于 /app/charts，与 dashboard 页面平级。定位「自由探索指标」工作台
 *        （vs dashboard 的「看模型说什么」、未来 /explain/* 的「看模型为什么这么判」）。
 *
 * [PROTOCOL]:
 * 1. workspace state 持久化到 URL（replaceState，不污染 history）；任何 state 变化即同步。
 * 2. catalog 一次拉取（presets + indicators + event_types），session 内复用。
 * 3. series 在 symbols / range / transform 任一变化时重拉；空 symbol 集跳过 fetch。
 * 4. M3 范围：preset 加载 + 自由 pane CRUD + indicator 搜索添加 + 区间/Transform 切换 + URL 分享。
 *    暂不支持：as_of vintage 回放、event overlay 渲染、双 y 轴、绘图工具。
 */
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { apiClient } from "@/lib/api";
import { ChartsToolbar } from "@/components/ChartsToolbar";
import { EditablePane } from "@/components/EditablePane";
import { IndicatorSearchModal } from "@/components/IndicatorSearchModal";
import type {
  ChartCatalogResponse,
  ChartPreset,
  ChartSeriesResponse,
} from "@/types/api";
import {
  DEFAULT_WORKSPACE,
  decodeWorkspace,
  encodeWorkspace,
  newPane,
  presetToWorkspace,
  rangeToDays,
  type ChartTransform,
  type TimeRangePreset,
  type WorkspaceState,
} from "@/lib/workspace-state";

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function loadInitialState(): WorkspaceState {
  if (typeof window === "undefined") return DEFAULT_WORKSPACE;
  const w = new URLSearchParams(window.location.search).get("w");
  if (w) {
    const parsed = decodeWorkspace(w);
    if (parsed) return parsed;
  }
  return DEFAULT_WORKSPACE;
}

export default function ChartsPage() {
  const [catalog, setCatalog] = useState<ChartCatalogResponse | null>(null);
  const [seriesData, setSeriesData] = useState<ChartSeriesResponse | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [state, setState] = useState<WorkspaceState>(loadInitialState);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchTargetPaneId, setSearchTargetPaneId] = useState<string | null>(
    null,
  );
  const [copyState, setCopyState] = useState<"idle" | "copied">("idle");

  // sync URL with state (no history pollution)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const encoded = encodeWorkspace(state);
    const url = new URL(window.location.href);
    if (encoded) url.searchParams.set("w", encoded);
    else url.searchParams.delete("w");
    window.history.replaceState({}, "", url.toString());
  }, [state]);

  // catalog (once)
  useEffect(() => {
    let cancelled = false;
    apiClient
      .getChartCatalog()
      .then((data) => {
        if (!cancelled) setCatalog(data);
      })
      .catch((e: Error) => {
        if (!cancelled) setError(`catalog: ${e.message}`);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // series (re-fetch on symbols / range / transform change)
  const allSymbols = useMemo(
    () => Array.from(new Set(state.panes.flatMap((p) => p.symbols))),
    [state.panes],
  );

  useEffect(() => {
    if (allSymbols.length === 0) {
      setSeriesData({ series: [], warnings: [] });
      return;
    }

    const end = isoDate(new Date());
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - rangeToDays(state.range));
    const start = isoDate(startDate);

    let cancelled = false;
    setLoading(true);
    setError(null);
    apiClient
      .getChartSeries({
        symbols: allSymbols,
        start,
        end,
        transform: state.transform,
      })
      .then((d) => {
        if (!cancelled) setSeriesData(d);
      })
      .catch((e: Error) => {
        if (!cancelled) setError(`series: ${e.message}`);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [allSymbols, state.range, state.transform]);

  // ============== handlers ==============

  const loadPreset = useCallback((preset: ChartPreset) => {
    setState((prev) => presetToWorkspace(preset, prev.range));
  }, []);

  const setRange = useCallback(
    (r: TimeRangePreset) => setState((s) => ({ ...s, range: r })),
    [],
  );

  const setTransform = useCallback(
    (t: ChartTransform) => setState((s) => ({ ...s, transform: t })),
    [],
  );

  const addPane = useCallback(() => {
    setState((s) => ({
      ...s,
      panes: [...s.panes, newPane(`Pane ${s.panes.length + 1}`)],
    }));
  }, []);

  const deletePane = useCallback((id: string) => {
    setState((s) => ({ ...s, panes: s.panes.filter((p) => p.id !== id) }));
  }, []);

  const removeSeries = useCallback((paneId: string, symbol: string) => {
    setState((s) => ({
      ...s,
      panes: s.panes.map((p) =>
        p.id === paneId
          ? { ...p, symbols: p.symbols.filter((x) => x !== symbol) }
          : p,
      ),
    }));
  }, []);

  const openSearchFor = useCallback((paneId: string) => {
    setSearchTargetPaneId(paneId);
    setSearchOpen(true);
  }, []);

  const onSelectIndicator = useCallback(
    (symbol: string) => {
      if (!searchTargetPaneId) return;
      setState((s) => ({
        ...s,
        panes: s.panes.map((p) =>
          p.id === searchTargetPaneId && !p.symbols.includes(symbol)
            ? { ...p, symbols: [...p.symbols, symbol] }
            : p,
        ),
      }));
    },
    [searchTargetPaneId],
  );

  const reset = useCallback(() => setState(DEFAULT_WORKSPACE), []);

  const copyUrl = useCallback(async () => {
    if (typeof window === "undefined") return;
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopyState("copied");
      setTimeout(() => setCopyState("idle"), 2000);
    } catch {
      // clipboard unavailable — silently no-op
    }
  }, []);

  // pre-compute per-pane series + missing
  const paneRender = useMemo(() => {
    return state.panes.map((pane) => {
      const series = pane.symbols
        .map((sym) => seriesData?.series.find((s) => s.symbol === sym))
        .filter((s): s is NonNullable<typeof s> => s !== undefined);
      const missingSymbols = pane.symbols.filter(
        (sym) => !series.some((s) => s.symbol === sym),
      );
      return { pane, series, missingSymbols };
    });
  }, [state.panes, seriesData]);

  const targetPane = state.panes.find((p) => p.id === searchTargetPaneId);

  return (
    <div className="min-h-screen bg-[var(--bg)] py-6 px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-4">
        <header className="space-y-2">
          <div className="flex items-baseline gap-3">
            <h1 className="text-xl font-semibold text-[var(--text-primary)]">
              Charts Workspace
            </h1>
            <span className="rounded-full border border-[var(--border-subtle)] bg-[var(--bg-card)] px-2.5 py-0.5 text-[11px] uppercase tracking-wider text-[var(--text-muted)]">
              M3
            </span>
          </div>
          <p className="text-sm text-[var(--text-secondary)]">
            自由探索 {catalog?.indicators.length ?? "..."} 个指标 — preset
            起步、随后自由组合 pane / series / 时间区间，URL 即配置。
          </p>
        </header>

        {catalog && (
          <ChartsToolbar
            presets={catalog.presets}
            range={state.range}
            transform={state.transform}
            onLoadPreset={loadPreset}
            onRangeChange={setRange}
            onTransformChange={setTransform}
            onAddPane={addPane}
            onReset={reset}
            onCopyUrl={copyUrl}
            copyState={copyState}
          />
        )}

        {error && (
          <div className="rounded-md border border-[rgba(239,68,68,0.3)] bg-[rgba(239,68,68,0.06)] px-4 py-2 text-sm text-[var(--status-red)]">
            {error}
          </div>
        )}

        {loading && !seriesData && (
          <div className="rounded-md border border-[var(--border-subtle)] bg-[var(--bg-card)] px-4 py-6 text-sm text-[var(--text-muted)]">
            加载中…
          </div>
        )}

        <div className="space-y-4">
          {paneRender.map(({ pane, series, missingSymbols }) => (
            <EditablePane
              key={pane.id}
              pane={pane}
              series={series}
              missingSymbols={missingSymbols}
              onRemoveSeries={(sym) => removeSeries(pane.id, sym)}
              onAddIndicator={() => openSearchFor(pane.id)}
              onDeletePane={() => deletePane(pane.id)}
            />
          ))}

          {state.panes.length === 0 && (
            <div className="rounded-[10px] border border-dashed border-[var(--border-subtle)] bg-[var(--bg-inset)] py-12 text-center text-sm text-[var(--text-muted)]">
              没有 pane — 点工具栏「添加 Pane」或加载 preset
            </div>
          )}
        </div>

        {/* warnings panel — 全局视角，独立于 pane */}
        {seriesData && seriesData.warnings.length > 0 && (
          <div className="rounded-md border border-[var(--border-subtle)] bg-[var(--bg-card)] p-4">
            <h4 className="mb-2 text-xs font-medium text-[var(--text-secondary)]">
              数据告警 ({seriesData.warnings.length})
            </h4>
            <ul className="space-y-1">
              {seriesData.warnings.map((w, i) => (
                <li key={i} className="text-xs text-[var(--text-muted)]">
                  <span
                    className={
                      "font-mono " +
                      (w.code === "MISSING"
                        ? "text-[var(--status-amber)]"
                        : "text-[var(--text-secondary)]")
                    }
                  >
                    [{w.code}]
                  </span>{" "}
                  <span className="font-mono">{w.symbol}</span>: {w.message}
                </li>
              ))}
            </ul>
          </div>
        )}

        <IndicatorSearchModal
          catalog={catalog}
          isOpen={searchOpen}
          excludeSymbols={targetPane?.symbols ?? []}
          paneTitle={targetPane?.title}
          onClose={() => setSearchOpen(false)}
          onSelect={onSelectIndicator}
        />
      </div>
    </div>
  );
}
