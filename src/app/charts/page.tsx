/**
 * [INPUT]: 无（路由 page，浏览器端拉 catalog + series）
 * [OUTPUT]: /charts 路由页面 — Charts Workspace M2 PoC
 * [POS]: 位于 /app/charts，与 /macro /liquidity /equity /btc 等 dashboard 页面平级，
 *        定位是"自由探索指标"工作台（vs dashboard 的"看模型说什么"）。
 *
 * [PROTOCOL]:
 * 1. catalog 一次拉取，session 内复用；preset 切换不触发 catalog 重拉。
 * 2. preset 切换 → 重拉 series（按 preset.default_range_days）。
 * 3. M2 PoC 范围：preset 切换 + 多 pane 渲染 + warning 展示。
 *    暂不支持：indicator 搜索增删、URL 序列化、event overlay、自定义时间区间、归一化对比。
 */
"use client";

import { useEffect, useState } from "react";
import { apiClient } from "@/lib/api";
import { ChartPane } from "@/components/ChartPane";
import type {
  ChartCatalogResponse,
  ChartSeriesResponse,
  ChartPreset,
} from "@/types/api";

const DEFAULT_PRESET_ID = "us_dollar_liquidity";

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export default function ChartsPage() {
  const [catalog, setCatalog] = useState<ChartCatalogResponse | null>(null);
  const [seriesData, setSeriesData] = useState<ChartSeriesResponse | null>(
    null,
  );
  const [activePresetId, setActivePresetId] =
    useState<string>(DEFAULT_PRESET_ID);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // 1. catalog（一次）
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

  // 2. preset 切换 → 拉 series
  useEffect(() => {
    if (!catalog) return;
    const preset = catalog.presets.find((p) => p.id === activePresetId);
    if (!preset) {
      setError(`preset '${activePresetId}' not found`);
      return;
    }

    const symbols = Array.from(
      new Set(preset.panes.flatMap((p) => p.indicators)),
    );
    if (!symbols.length) return;

    const end = isoDate(new Date());
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - preset.default_range_days);
    const start = isoDate(startDate);

    let cancelled = false;
    setLoading(true);
    setError(null);
    apiClient
      .getChartSeries({ symbols, start, end })
      .then((data) => {
        if (!cancelled) setSeriesData(data);
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
  }, [catalog, activePresetId]);

  const activePreset: ChartPreset | null =
    catalog?.presets.find((p) => p.id === activePresetId) ?? null;

  return (
    <div className="min-h-screen bg-[var(--bg)] py-6 px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-baseline gap-3">
              <h1 className="text-xl font-semibold text-[var(--text-primary)]">
                Charts Workspace
              </h1>
              <span className="rounded-full border border-[var(--border-subtle)] bg-[var(--bg-card)] px-2.5 py-0.5 text-[11px] uppercase tracking-wider text-[var(--text-muted)]">
                M2 · PoC
              </span>
            </div>
          </div>
          <p className="text-sm text-[var(--text-secondary)]">
            自由探索研究 OS 指标 — 区别于 Dashboard 看模型说什么，这里看数据怎么动。
          </p>
        </header>

        {/* preset switcher */}
        {catalog && catalog.presets.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {catalog.presets.map((p) => {
              const active = p.id === activePresetId;
              return (
                <button
                  key={p.id}
                  onClick={() => setActivePresetId(p.id)}
                  className={
                    "rounded-md border px-3 py-1.5 text-xs transition-colors " +
                    (active
                      ? "border-[var(--border-visible)] bg-[var(--bg-elevated)] text-[var(--text-primary)]"
                      : "border-[var(--border-subtle)] bg-[var(--bg-card)] text-[var(--text-secondary)] hover:bg-[var(--bg-card-hover)]")
                  }
                >
                  {p.name}
                </button>
              );
            })}
          </div>
        )}

        {activePreset && (
          <p className="text-sm text-[var(--text-muted)]">
            {activePreset.description}
          </p>
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

        {/* panes */}
        {activePreset && seriesData && (
          <div className="space-y-4">
            {activePreset.panes.map((pane, idx) => {
              const paneSeries = pane.indicators
                .map((sym) => seriesData.series.find((s) => s.symbol === sym))
                .filter(
                  (s): s is NonNullable<typeof s> => s !== undefined,
                );

              if (paneSeries.length === 0) {
                return (
                  <div
                    key={`${activePreset.id}-${idx}`}
                    className="rounded-md border border-[var(--border-subtle)] bg-[var(--bg-card)] px-4 py-6 text-sm text-[var(--text-muted)]"
                  >
                    {pane.title}：所有指标缺失（详见下方告警）
                  </div>
                );
              }

              return (
                <ChartPane
                  key={`${activePreset.id}-${idx}`}
                  title={pane.title}
                  series={paneSeries}
                  height={300}
                />
              );
            })}
          </div>
        )}

        {/* warnings */}
        {seriesData && seriesData.warnings.length > 0 && (
          <div className="rounded-md border border-[var(--border-subtle)] bg-[var(--bg-card)] p-4">
            <h4 className="mb-2 text-xs font-medium text-[var(--text-secondary)]">
              数据告警
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
      </div>
    </div>
  );
}
