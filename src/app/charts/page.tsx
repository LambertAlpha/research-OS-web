/**
 * [INPUT]: ?w=base64 query param（可选，恢复 workspace state；缺省走 DEFAULT_WORKSPACE）
 * [OUTPUT]: /charts 路由 — Charts Workspace M6：M5 能力 + 双 y 轴手动覆盖（chip 上 axis toggle）+ markers hover tooltip
 * [POS]: 位于 /app/charts，与 dashboard 页面平级。定位「自由探索指标」工作台
 *        （vs dashboard 的「看模型说什么」、未来 /explain/* 的「看模型为什么这么判」）。
 *
 * [PROTOCOL]:
 * 1. workspace state（panes / range / transform / asOf / showEvents）持久化到 URL，
 *    任何 state 变化即同步；replaceState 不污染 history。
 * 2. catalog 一次拉取（presets + indicators + event_types），session 内复用。
 * 3. series 在 symbols / range / transform / asOf 任一变化时重拉。
 * 4. events 在 range / asOf / showEvents 变化时重拉（showEvents=false 时不拉）。
 * 5. M4 范围（本版本）：preset / 自由 pane CRUD / indicator 搜索 / 区间 / Transform /
 *    URL 分享 / **双 y 轴自动分轴 / 事件 markers overlay / as_of vintage 回放**。
 */
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { apiClient } from "@/lib/api";
import { ChartsToolbar } from "@/components/ChartsToolbar";
import { EditablePane } from "@/components/EditablePane";
import { IndicatorSearchModal } from "@/components/IndicatorSearchModal";
import type {
  ChartCatalogResponse,
  ChartEventsResponse,
  ChartPreset,
  ChartSeriesResponse,
} from "@/types/api";
import {
  DEFAULT_ENABLED_EVENT_TYPES,
  DEFAULT_WORKSPACE,
  decodeWorkspace,
  encodeWorkspace,
  newPane,
  newCustomMarker,
  presetToWorkspace,
  rangeToDays,
  type ChartTransform,
  type TimeRangePreset,
  type WorkspaceState,
} from "@/lib/workspace-state";

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// SSR 安全：初始 state 在服务端永远走 DEFAULT_WORKSPACE，客户端 mount 后
// 用 useEffect 从 URL 加载（避免 hydration mismatch）
function readUrlWorkspace(): WorkspaceState | null {
  if (typeof window === "undefined") return null;
  const w = new URLSearchParams(window.location.search).get("w");
  if (!w) return null;
  return decodeWorkspace(w);
}

export default function ChartsPage() {
  const [catalog, setCatalog] = useState<ChartCatalogResponse | null>(null);
  const [seriesData, setSeriesData] = useState<ChartSeriesResponse | null>(
    null,
  );
  const [eventsData, setEventsData] = useState<ChartEventsResponse | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // SSR 安全：服务端 = DEFAULT_WORKSPACE，客户端 mount 后从 URL 加载（见下方 useEffect）
  const [state, setState] = useState<WorkspaceState>(DEFAULT_WORKSPACE);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchTargetPaneId, setSearchTargetPaneId] = useState<string | null>(
    null,
  );
  const [copyState, setCopyState] = useState<"idle" | "copied">("idle");

  // 客户端 mount 后从 URL 加载 workspace（避免 SSR hydration mismatch）
  useEffect(() => {
    const fromUrl = readUrlWorkspace();
    if (fromUrl) setState(fromUrl);
  }, []);

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

  // series (re-fetch on symbols / range / transform / asOf change)
  const allSymbols = useMemo(
    () => Array.from(new Set(state.panes.flatMap((p) => p.symbols))),
    [state.panes],
  );

  useEffect(() => {
    if (allSymbols.length === 0) {
      setSeriesData({ series: [], warnings: [] });
      return;
    }

    const end = state.asOf ?? isoDate(new Date());
    const startDate = new Date(end);
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
        asOf: state.asOf ?? undefined,
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
  }, [allSymbols, state.range, state.transform, state.asOf]);

  // events (re-fetch on range / asOf / enabledEventTypes change)
  // M5：用户在 EventsSelector 选什么类型就拉什么类型；空选 = 不拉。
  useEffect(() => {
    if (state.enabledEventTypes.length === 0) {
      setEventsData({ events: [] });
      return;
    }

    const end = state.asOf ?? isoDate(new Date());
    const startDate = new Date(end);
    startDate.setDate(startDate.getDate() - rangeToDays(state.range));
    const start = isoDate(startDate);

    let cancelled = false;
    apiClient
      .getChartEvents({
        start,
        end,
        types: state.enabledEventTypes,
      })
      .then((d) => {
        if (!cancelled) setEventsData(d);
      })
      .catch(() => {
        if (!cancelled) setEventsData({ events: [] });
      });
    return () => {
      cancelled = true;
    };
  }, [state.enabledEventTypes, state.range, state.asOf]);

  // ============== handlers ==============

  const loadPreset = useCallback((preset: ChartPreset) => {
    setState((prev) =>
      presetToWorkspace(
        preset,
        prev.range,
        prev.asOf,
        prev.enabledEventTypes,
        prev.ratioMode,
        prev.customMarkers,
      ),
    );
  }, []);

  const setRange = useCallback(
    (r: TimeRangePreset) => setState((s) => ({ ...s, range: r })),
    [],
  );

  const setTransform = useCallback(
    (t: ChartTransform) => setState((s) => ({ ...s, transform: t })),
    [],
  );

  const setAsOf = useCallback(
    (asOf: string | null) => setState((s) => ({ ...s, asOf })),
    [],
  );

  const setEnabledEventTypes = useCallback(
    (next: string[]) => setState((s) => ({ ...s, enabledEventTypes: next })),
    [],
  );

  const toggleRatioMode = useCallback(
    () => setState((s) => ({ ...s, ratioMode: !s.ratioMode })),
    [],
  );

  const addCustomMarker = useCallback(
    (
      ts: string,
      label: string,
      severity: "info" | "warning" | "critical",
    ) => {
      setState((s) => ({
        ...s,
        customMarkers: [...s.customMarkers, newCustomMarker(ts, label, severity)],
      }));
    },
    [],
  );

  const removeCustomMarker = useCallback(
    (id: string) => {
      setState((s) => ({
        ...s,
        customMarkers: s.customMarkers.filter((m) => m.id !== id),
      }));
    },
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
      panes: s.panes.map((p) => {
        if (p.id !== paneId) return p;
        // 同时清理 axisOverrides 中该 symbol 的条目
        const nextOverrides = { ...(p.axisOverrides ?? {}) };
        delete nextOverrides[symbol];
        return {
          ...p,
          symbols: p.symbols.filter((x) => x !== symbol),
          axisOverrides:
            Object.keys(nextOverrides).length > 0 ? nextOverrides : undefined,
        };
      }),
    }));
  }, []);

  const setAxisOverride = useCallback(
    (paneId: string, symbol: string, axis: "left" | "right" | null) => {
      setState((s) => ({
        ...s,
        panes: s.panes.map((p) => {
          if (p.id !== paneId) return p;
          const next = { ...(p.axisOverrides ?? {}) };
          if (axis === null) {
            delete next[symbol];
          } else {
            next[symbol] = axis;
          }
          return {
            ...p,
            axisOverrides: Object.keys(next).length > 0 ? next : undefined,
          };
        }),
      }));
    },
    [],
  );

  const setPaneTimeRange = useCallback(
    (paneId: string, range: TimeRangePreset | null) => {
      setState((s) => ({
        ...s,
        panes: s.panes.map((p) =>
          p.id === paneId ? { ...p, timeRange: range ?? undefined } : p,
        ),
      }));
    },
    [],
  );

  const openSearchFor = useCallback((paneId: string) => {
    setSearchTargetPaneId(paneId);
    setSearchOpen(true);
  }, []);

  // 用 useCallback 包裹 onClose 让 IndicatorSearchModal 内部的 keyboard listener
  // 不会因为 page render 导致 deps 变化而反复 unmount/remount
  const closeSearchModal = useCallback(() => setSearchOpen(false), []);

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

  // pre-compute per-pane series + missing + visible range
  const paneRender = useMemo(() => {
    const today = new Date();
    const globalEnd = state.asOf ? new Date(state.asOf) : today;
    return state.panes.map((pane) => {
      const series = pane.symbols
        .map((sym) => seriesData?.series.find((s) => s.symbol === sym))
        .filter((s): s is NonNullable<typeof s> => s !== undefined);
      const missingSymbols = pane.symbols.filter(
        (sym) => !series.some((s) => s.symbol === sym),
      );
      // 计算 pane 的 visible range（如果 pane 有 timeRange override）
      let visibleStart: string | undefined;
      let visibleEnd: string | undefined;
      if (pane.timeRange) {
        const days = rangeToDays(pane.timeRange);
        const startDate = new Date(globalEnd);
        startDate.setDate(startDate.getDate() - days);
        visibleStart = isoDate(startDate);
        visibleEnd = isoDate(globalEnd);
      }
      return { pane, series, missingSymbols, visibleStart, visibleEnd };
    });
  }, [state.panes, seriesData, state.asOf]);

  const targetPane = state.panes.find((p) => p.id === searchTargetPaneId);
  const eventsForOverlay =
    state.enabledEventTypes.length > 0 ? eventsData?.events ?? [] : [];

  return (
    <div className="min-h-screen bg-[var(--bg)] py-6 px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-4">
        <header className="space-y-2">
          <div className="flex items-baseline gap-3">
            <h1 className="text-xl font-semibold text-[var(--text-primary)]">
              Charts Workspace
            </h1>
            <span className="rounded-full border border-[var(--border-subtle)] bg-[var(--bg-card)] px-2.5 py-0.5 text-[11px] uppercase tracking-wider text-[var(--text-muted)]">
              M6
            </span>
            {state.asOf && (
              <span
                className="rounded-full border border-[rgba(168,85,247,0.4)] bg-[rgba(168,85,247,0.08)] px-2.5 py-0.5 text-[11px] uppercase tracking-wider text-[#a855f7]"
                title="时间机器：当前显示某历史日期的 vintage 数据"
              >
                AS OF {state.asOf}
              </span>
            )}
          </div>
          <p className="text-sm text-[var(--text-secondary)]">
            自由探索 {catalog?.indicators.length ?? "..."} 个指标 — preset
            起步、随后自由组合 pane / series / 时间区间 / vintage，URL 即配置。
          </p>
        </header>

        {catalog && (
          <ChartsToolbar
            presets={catalog.presets}
            range={state.range}
            transform={state.transform}
            asOf={state.asOf}
            eventTypes={catalog.event_types}
            enabledEventTypes={state.enabledEventTypes}
            defaultEventTypes={DEFAULT_ENABLED_EVENT_TYPES}
            ratioMode={state.ratioMode}
            customMarkers={state.customMarkers}
            onLoadPreset={loadPreset}
            onRangeChange={setRange}
            onTransformChange={setTransform}
            onAsOfChange={setAsOf}
            onEventTypesChange={setEnabledEventTypes}
            onToggleRatioMode={toggleRatioMode}
            onAddCustomMarker={addCustomMarker}
            onRemoveCustomMarker={removeCustomMarker}
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
          {paneRender.map(({ pane, series, missingSymbols, visibleStart, visibleEnd }) => (
            <EditablePane
              key={pane.id}
              pane={pane}
              series={series}
              events={eventsForOverlay}
              visibleStart={visibleStart}
              visibleEnd={visibleEnd}
              customMarkers={state.customMarkers}
              missingSymbols={missingSymbols}
              ratioMode={state.ratioMode}
              onRemoveSeries={(sym) => removeSeries(pane.id, sym)}
              onAddIndicator={() => openSearchFor(pane.id)}
              onDeletePane={() => deletePane(pane.id)}
              onSetAxisOverride={(sym, axis) =>
                setAxisOverride(pane.id, sym, axis)
              }
              onSetPaneTimeRange={(range) =>
                setPaneTimeRange(pane.id, range)
              }
            />
          ))}

          {state.panes.length === 0 && (
            <div className="rounded-[10px] border border-dashed border-[var(--border-subtle)] bg-[var(--bg-inset)] py-12 text-center text-sm text-[var(--text-muted)]">
              没有 pane — 点工具栏「添加 Pane」或加载 preset
            </div>
          )}
        </div>

        {/* events 摘要：当前区间事件总数 + 各类型分布 */}
        {state.enabledEventTypes.length > 0 &&
          eventsData &&
          eventsData.events.length > 0 && (
          <div className="rounded-md border border-[var(--border-subtle)] bg-[var(--bg-card)] p-3 text-xs">
            <div className="mb-2 flex items-center gap-2 text-[var(--text-secondary)]">
              <span className="font-medium">当前区间事件标记</span>
              <span className="text-[var(--text-faint)]">
                · 共 {eventsData.events.length} 条
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {Object.entries(
                eventsData.events.reduce<Record<string, number>>((acc, e) => {
                  acc[e.type] = (acc[e.type] ?? 0) + 1;
                  return acc;
                }, {}),
              )
                .sort(([, a], [, b]) => b - a)
                .map(([type, count]) => (
                  <span
                    key={type}
                    className="rounded-full border border-[var(--border-subtle)] bg-[var(--bg-inset)] px-2 py-0.5 text-[11px] text-[var(--text-muted)]"
                  >
                    {type}: {count}
                  </span>
                ))}
            </div>
          </div>
        )}

        {/* warnings panel */}
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
          onClose={closeSearchModal}
          onSelect={onSelectIndicator}
        />
      </div>
    </div>
  );
}
