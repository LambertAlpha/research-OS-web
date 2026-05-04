/**
 * [INPUT]: (symbols: string[], days?, enabled?) — BTC 指标 symbol 数组 + 时间窗口（默认 90 天）
 * [OUTPUT]: ({ dataMap, isLoading, error }) — symbol → series points 的 Map，含全局 loading/error
 *           + useChartCatalog() 单独 hook 拿全 catalog（含 thresholds.numeric）
 * [POS]: 位于 /lib，被 BTC Dashboard L1 全指标看板引用。基于 React Query 的批量 series 拉取。
 *         自动按后端 12 symbols/批限制拆批，sortedSymbols 让 cache key 稳定。
 *
 * [PROTOCOL]:
 * 1. 一旦本文件逻辑变更（hook 签名、批处理策略），必须同步更新此 Header。
 * 2. 更新后必须上浮检查 /src/lib/.folder.md 的描述是否依然准确。
 */
"use client";

import { useMemo } from "react";
import { useQueries, useQuery } from "@tanstack/react-query";
import apiClient from "./api";
import type { ChartCatalogResponse, ChartSeriesPoint } from "@/types/api";

const MAX_SYMBOLS_PER_BATCH = 12; // 后端单次请求上限
const SERIES_STALE_MS = 5 * 60 * 1000;
const CATALOG_STALE_MS = 30 * 60 * 1000;

function chunk<T>(arr: T[], n: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
}

function isoDaysAgo(days: number): string {
  const d = new Date(Date.now() - days * 86_400_000);
  return d.toISOString().slice(0, 10);
}

export function useChartCatalog() {
  return useQuery<ChartCatalogResponse>({
    queryKey: ["chart-catalog"],
    queryFn: () => apiClient.getChartCatalog({}),
    staleTime: CATALOG_STALE_MS,
  });
}

export interface ChartSeriesBatchResult {
  dataMap: Map<string, ChartSeriesPoint[]>;
  isLoading: boolean;
  isFetched: boolean;
  error: Error | null;
}

/**
 * 批量拉取多个 symbol 的时间序列。
 * 自动按 12 个/批拆分；symbols 排序确保 cache key 稳定。
 * 多批次同时发起，任一批 loading 都返回 isLoading=true。
 */
export function useChartSeriesBatch(
  symbols: readonly string[],
  days = 90,
  enabled = true
): ChartSeriesBatchResult {
  const sortedSymbols = useMemo(
    () => [...symbols].filter(Boolean).sort(),
    [symbols]
  );
  const batches = useMemo(
    () => chunk(sortedSymbols, MAX_SYMBOLS_PER_BATCH),
    [sortedSymbols]
  );

  const queries = useQueries({
    queries: batches.map((batch) => ({
      queryKey: ["chart-series", batch.join(","), days],
      queryFn: async () => {
        const end = isoDaysAgo(0);
        const start = isoDaysAgo(days);
        return apiClient.getChartSeries({ symbols: batch, start, end });
      },
      enabled: enabled && batch.length > 0,
      staleTime: SERIES_STALE_MS,
    })),
  });

  const dataMap = useMemo(() => {
    const m = new Map<string, ChartSeriesPoint[]>();
    for (const r of queries) {
      const data = r.data;
      if (!data) continue;
      for (const series of data.series) {
        m.set(series.symbol, series.points);
      }
    }
    return m;
  }, [queries]);

  const isLoading = enabled && queries.some((r) => r.isLoading);
  const isFetched = queries.length > 0 && queries.every((r) => r.isFetched);
  const errorQuery = queries.find((r) => r.error);
  const error = errorQuery?.error
    ? errorQuery.error instanceof Error
      ? errorQuery.error
      : new Error(String(errorQuery.error))
    : null;

  return { dataMap, isLoading, isFetched, error };
}
