/**
 * [INPUT]: { catalog, isOpen, excludeSymbols, onClose, onSelect }
 * [OUTPUT]: 全屏 modal — 搜索框 + 按 model_module 分组的 indicator 列表
 * [POS]: 位于 /components，被 /charts page 引用。点击 backdrop 或 ESC 关闭；
 *        onSelect 后**不关闭**（支持连续批量添加）。
 *
 * [PROTOCOL]:
 * 1. 不发起 API 请求，catalog 由父组件传入。
 * 2. 搜索 case-insensitive，匹配 symbol / display_name / description / module。
 * 3. excludeSymbols 中的指标灰显且禁点击（避免重复添加）。
 * 4. feature 类型用 amber badge，raw 类型用灰 badge。
 */
"use client";

import { useEffect, useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import type { ChartCatalogResponse, ChartIndicator } from "@/types/api";

interface IndicatorSearchModalProps {
  catalog: ChartCatalogResponse | null;
  isOpen: boolean;
  excludeSymbols?: string[];
  onClose: () => void;
  onSelect: (symbol: string) => void;
  paneTitle?: string;
}

export function IndicatorSearchModal({
  catalog,
  isOpen,
  excludeSymbols = [],
  onClose,
  onSelect,
  paneTitle,
}: IndicatorSearchModalProps) {
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (isOpen) setQuery("");
  }, [isOpen]);

  const filtered = useMemo(() => {
    if (!catalog) return [];
    const q = query.trim().toLowerCase();
    if (!q) return catalog.indicators;
    return catalog.indicators.filter(
      (i) =>
        i.symbol.toLowerCase().includes(q) ||
        i.display_name.toLowerCase().includes(q) ||
        (i.description ?? "").toLowerCase().includes(q) ||
        i.model_module.toLowerCase().includes(q),
    );
  }, [catalog, query]);

  const byModule = useMemo(() => {
    const map = new Map<string, ChartIndicator[]>();
    for (const i of filtered) {
      const m = i.model_module || "Misc";
      if (!map.has(m)) map.set(m, []);
      map.get(m)!.push(i);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [filtered]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 backdrop-blur-sm pt-20 px-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl rounded-xl border border-[var(--border-visible)] bg-[var(--bg-card)] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-[var(--border-subtle)] px-4 py-3">
          <Search className="h-4 w-4 shrink-0 text-[var(--text-muted)]" />
          <input
            autoFocus
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={`搜索 ${catalog?.indicators.length ?? 0} 个指标 (symbol / 名称 / 描述 / 模块)...`}
            className="flex-1 bg-transparent text-sm text-[var(--text-primary)] placeholder-[var(--text-faint)] outline-none"
          />
          <button
            onClick={onClose}
            className="rounded p-1 text-[var(--text-faint)] hover:bg-[var(--bg-card-hover)] hover:text-[var(--text-primary)]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="max-h-[60vh] overflow-y-auto px-2 py-2">
          {byModule.length === 0 && (
            <div className="px-4 py-8 text-center text-sm text-[var(--text-muted)]">
              {query ? `没有匹配 "${query}" 的指标` : "加载中…"}
            </div>
          )}
          {byModule.map(([module, items]) => (
            <div key={module} className="mb-3">
              <div className="px-2 py-1 text-[10px] font-medium uppercase tracking-wider text-[var(--text-faint)]">
                {module}
                <span className="ml-2 normal-case tracking-normal text-[var(--text-faint)]">
                  ({items.length})
                </span>
              </div>
              <div className="space-y-0.5">
                {items.map((ind) => {
                  const excluded = excludeSymbols.includes(ind.symbol);
                  return (
                    <button
                      key={ind.symbol}
                      disabled={excluded}
                      onClick={() => !excluded && onSelect(ind.symbol)}
                      className={
                        "flex w-full items-center gap-3 rounded-md px-2 py-1.5 text-left transition-colors " +
                        (excluded
                          ? "cursor-not-allowed opacity-40"
                          : "hover:bg-[var(--bg-card-hover)]")
                      }
                    >
                      <span
                        className={
                          "shrink-0 rounded px-1.5 py-0.5 font-mono text-[10px] " +
                          (ind.series_type === "feature"
                            ? "bg-[rgba(234,179,8,0.1)] text-[var(--status-amber)]"
                            : "bg-[var(--bg-elevated)] text-[var(--text-faint)]")
                        }
                      >
                        {ind.series_type}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline gap-2">
                          <span className="font-mono text-xs text-[var(--text-primary)]">
                            {ind.symbol}
                          </span>
                          <span className="truncate text-xs text-[var(--text-secondary)]">
                            {ind.display_name}
                          </span>
                        </div>
                        {ind.description && (
                          <div className="truncate text-[11px] text-[var(--text-faint)]">
                            {ind.description}
                          </div>
                        )}
                      </div>
                      <span className="shrink-0 text-[10px] text-[var(--text-faint)]">
                        {ind.frequency}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between border-t border-[var(--border-subtle)] px-4 py-2 text-[11px] text-[var(--text-faint)]">
          <span>
            {paneTitle ? `添加到 「${paneTitle}」 ·` : ""} 点击连续添加 · ESC 关闭
          </span>
          {excludeSymbols.length > 0 && (
            <span>已添加 {excludeSymbols.length}</span>
          )}
        </div>
      </div>
    </div>
  );
}
