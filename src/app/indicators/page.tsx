/**
 * [INPUT]: 页面加载时自动请求 /api/indicators，展示所有活跃指标。用户可按模块筛选、按关键词搜索、点击展开详情。
 * [OUTPUT]: (JSX) - 指标字典页面，表格展示所有指标的 symbol、名称、来源、频率、模块，支持展开详情。
 * [POS]: 路由 (/indicators)。从数据库获取 indicator_catalog 表数据并展示。
 *
 * [PROTOCOL]:
 * 1. 一旦本文件逻辑变更，必须同步更新此 Header。
 * 2. 更新后必须上浮检查 /src/app/indicators/.folder.md 的描述是否依然准确。
 */
"use client";

import { useState, useEffect, useMemo, Fragment } from "react";
import { Header } from "@/components/Header";
import apiClient from "@/lib/api";
import { cn } from "@/lib/utils";
import type { IndicatorRecord } from "@/types/api";
import { BookOpen, RefreshCw, Search, ChevronDown, ChevronRight } from "lucide-react";

/** 模块筛选选项 */
/** 模块对应的颜色 */
const MODULE_COLORS: Record<string, string> = {
  // 流动性模型
  Liquidity: "text-zinc-400 bg-zinc-500/10 border-zinc-500/30",
  // 宏观模型
  Layer1: "text-amber-400 bg-amber-500/10 border-amber-500/30",
  Layer2: "text-violet-400 bg-violet-500/10 border-violet-500/30",
  Layer3: "text-red-400 bg-red-500/10 border-red-500/30",
  Execution: "text-emerald-400 bg-emerald-500/10 border-emerald-500/30",
  Correction: "text-orange-400 bg-orange-500/10 border-orange-500/30",
  // 美股模型
  Equity_MacroOverlay: "text-blue-400 bg-blue-500/10 border-blue-500/30",
  Equity_Breadth: "text-teal-400 bg-teal-500/10 border-teal-500/30",
  Equity_PriceVolume: "text-indigo-400 bg-indigo-500/10 border-indigo-500/30",
  Equity_Options: "text-pink-400 bg-pink-500/10 border-pink-500/30",
  Equity_FundFlow: "text-sky-400 bg-sky-500/10 border-sky-500/30",
  Equity_Sentiment: "text-rose-400 bg-rose-500/10 border-rose-500/30",
  // 共用
  Common: "text-zinc-400 bg-zinc-500/10 border-zinc-500/30",
};

/** 频率标签映射 */
const FREQUENCY_LABELS: Record<string, string> = {
  D: "日频",
  W: "周频",
  M: "月频",
  Q: "季频",
  I: "日内",
};

export default function IndicatorsPage() {
  const [indicators, setIndicators] = useState<IndicatorRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeModule, setActiveModule] = useState<string>("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      setIsLoading(true);
      try {
        const response = await apiClient.getIndicatorCatalog();
        setIndicators(response.indicators);
      } catch (err) {
        console.error("Failed to load indicator catalog:", err);
        setError(err instanceof Error ? err.message : "Failed to load data");
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
  }, []);

  /** 筛选后的指标列表 */
  const filteredIndicators = useMemo(() => {
    let result = indicators;

    // 按模块筛选
    if (activeModule !== "All") {
      result = result.filter((ind) => ind.model_module === activeModule);
    }

    // 按搜索词筛选
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (ind) =>
          ind.symbol.toLowerCase().includes(q) ||
          ind.display_name.toLowerCase().includes(q)
      );
    }

    return result;
  }, [indicators, activeModule, searchQuery]);

  /** 获取可用的模块列表（从数据中动态提取） */
  const availableModules = useMemo(() => {
    const modules = [...new Set(indicators.map((ind) => ind.model_module))].sort();
    return ["All", ...modules];
  }, [indicators]);

  return (
    <div className="min-h-screen">
      <Header />

      <div className="p-6">
        {/* 页面标题 */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-1">
            <div className="p-2 rounded-lg bg-zinc-500/10">
              <BookOpen className="w-5 h-5 text-zinc-400" />
            </div>
            <h1 className="text-2xl font-bold text-zinc-100">Indicator Dictionary</h1>
          </div>
          <p className="text-zinc-500 text-sm ml-12">
            指标字典 — 共 {indicators.length} 个指标（{indicators.filter(i => i.is_active).length} 已接入 / {indicators.filter(i => !i.is_active).length} 待接入）
          </p>
        </div>

        {/* 筛选栏 */}
        <div className="mb-6 flex flex-col sm:flex-row gap-4">
          {/* 模块筛选 */}
          <div className="flex flex-wrap gap-2">
            {availableModules.map((module) => (
              <button
                key={module}
                onClick={() => setActiveModule(module)}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-medium border transition-all duration-200",
                  activeModule === module
                    ? "bg-zinc-700/40 text-zinc-200 border-zinc-500"
                    : "bg-zinc-900/50 text-zinc-400 border-[var(--border-subtle)] hover:bg-[var(--bg-card-hover)] hover:text-zinc-300"
                )}
              >
                {module}
              </button>
            ))}
          </div>

          {/* 搜索框 */}
          <div className="relative flex-1 max-w-sm ml-auto">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
            <input
              type="text"
              placeholder="搜索 Symbol 或名称..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-zinc-900/50 border border-[var(--border-subtle)] rounded-lg text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-600 transition-colors"
            />
          </div>
        </div>

        {/* 内容区域 */}
        {isLoading ? (
          <div className="relative rounded-[14px] overflow-hidden bg-[var(--bg-card)] border border-[var(--border-subtle)] p-16 text-center text-zinc-500">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2" />
            加载中...
          </div>
        ) : error ? (
          <div className="relative rounded-[14px] overflow-hidden bg-[var(--bg-card)] border border-red-500/30 p-16 text-center text-red-400">
            {error}
          </div>
        ) : (
          <div className="relative rounded-[14px] overflow-hidden bg-[var(--bg-card)] border border-[var(--border-subtle)]">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[var(--border-subtle)]">
                  <th className="w-8 py-4 px-3" />
                  <th className="text-left py-4 px-5 text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                    Symbol
                  </th>
                  <th className="text-left py-4 px-5 text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                    名称
                  </th>
                  <th className="text-left py-4 px-5 text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                    说明
                  </th>
                  <th className="text-left py-4 px-5 text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                    来源
                  </th>
                  <th className="text-left py-4 px-5 text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                    频率
                  </th>
                  <th className="text-left py-4 px-5 text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                    模块
                  </th>
                  <th className="text-left py-4 px-5 text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                    单位
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredIndicators.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-16 text-center text-zinc-500">
                      {searchQuery ? "未找到匹配的指标" : "暂无指标数据"}
                    </td>
                  </tr>
                ) : (
                  filteredIndicators.map((ind, i) => {
                    const isExpanded = expandedRow === ind.symbol;
                    const moduleColor = MODULE_COLORS[ind.model_module] || MODULE_COLORS.Common;
                    const isPending = !ind.is_active;

                    return (
                      <Fragment key={ind.symbol}>
                        <tr
                          onClick={() => setExpandedRow(isExpanded ? null : ind.symbol)}
                          className={cn(
                            "border-b border-zinc-800/30 transition-colors duration-200 hover:bg-zinc-800/20 cursor-pointer",
                            i % 2 === 0 ? "bg-zinc-900/30" : "",
                            isPending && "opacity-50"
                          )}
                        >
                          <td className="py-4 px-3 text-zinc-500">
                            {isExpanded ? (
                              <ChevronDown className="w-4 h-4" />
                            ) : (
                              <ChevronRight className="w-4 h-4" />
                            )}
                          </td>
                          <td className="py-4 px-5 text-sm font-mono font-medium">
                            <span className={isPending ? "text-zinc-500" : "text-zinc-300"}>{ind.symbol}</span>
                            {isPending && (
                              <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-500 border border-zinc-700">
                                待接入
                              </span>
                            )}
                          </td>
                          <td className="py-4 px-5 text-sm text-zinc-200">
                            {ind.display_name}
                          </td>
                          <td className="py-4 px-5 text-sm text-zinc-500 max-w-xs">
                            {ind.description || "—"}
                          </td>
                          <td className="py-4 px-5 text-sm text-zinc-400">
                            {ind.source}
                          </td>
                          <td className="py-4 px-5">
                            <span className="text-xs text-zinc-400">
                              {FREQUENCY_LABELS[ind.frequency] || ind.frequency}
                            </span>
                          </td>
                          <td className="py-4 px-5">
                            <span
                              className={cn(
                                "inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium border",
                                moduleColor
                              )}
                            >
                              {ind.model_module}
                            </span>
                          </td>
                          <td className="py-4 px-5 text-sm text-zinc-500">
                            {ind.unit || "-"}
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr key={`${ind.symbol}-detail`} className="bg-zinc-900/60">
                            <td colSpan={8} className="px-8 py-5">
                              <div className="grid grid-cols-3 gap-6">
                                {/* 描述 */}
                                <div>
                                  <div className="text-xs text-zinc-500 uppercase tracking-wider font-semibold mb-2">
                                    描述
                                  </div>
                                  <p className="text-sm text-zinc-300">
                                    {ind.description || "暂无描述"}
                                  </p>
                                </div>
                                {/* 权重 */}
                                <div>
                                  <div className="text-xs text-zinc-500 uppercase tracking-wider font-semibold mb-2">
                                    权重
                                  </div>
                                  <p className="text-sm text-zinc-300">
                                    {ind.weight != null ? ind.weight.toFixed(4) : "-"}
                                  </p>
                                </div>
                                {/* 阈值 */}
                                <div>
                                  <div className="text-xs text-zinc-500 uppercase tracking-wider font-semibold mb-2">
                                    阈值
                                  </div>
                                  {ind.thresholds ? (
                                    <div className="space-y-1">
                                      {Object.entries(ind.thresholds).map(([key, val]) => (
                                        <div key={key} className="text-sm">
                                          <span
                                            className={cn(
                                              "font-medium",
                                              key === "red"
                                                ? "text-red-400"
                                                : key === "yellow"
                                                  ? "text-amber-400"
                                                  : key === "green"
                                                    ? "text-emerald-400"
                                                    : "text-zinc-400"
                                            )}
                                          >
                                            {key}:
                                          </span>{" "}
                                          <span className="text-zinc-300">
                                            {String(val)}
                                          </span>
                                        </div>
                                      ))}
                                    </div>
                                  ) : (
                                    <p className="text-sm text-zinc-500">-</p>
                                  )}
                                </div>
                              </div>
                              {/* 数据源代码 */}
                              {ind.source_symbol && (
                                <div className="mt-4 pt-4 border-t border-[var(--border-subtle)]">
                                  <span className="text-xs text-zinc-500 uppercase tracking-wider font-semibold">
                                    数据源代码:
                                  </span>{" "}
                                  <span className="text-sm text-zinc-300 font-mono">
                                    {ind.source_symbol}
                                  </span>
                                </div>
                              )}
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })
                )}
              </tbody>
            </table>

            {/* 底部统计 */}
            <div className="px-5 py-3 border-t border-[var(--border-subtle)] text-xs text-zinc-500">
              显示 {filteredIndicators.length} / {indicators.length} 个指标
              {activeModule !== "All" && ` (筛选: ${activeModule})`}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
