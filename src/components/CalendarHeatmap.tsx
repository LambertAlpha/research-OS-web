/**
 * [INPUT]: (records, selectedDate, onDateSelect) - 历史记录数组、当前选中日期、日期选择回调。
 * [OUTPUT]: (<div>) - 月历热力图，格子按 risk_light 着色（绿/黄/红），含月份导航、图例、月度统计。
 * [POS]: 位于 /components，被 History 页面引用。替换原列表视图，提供日历热力图展示风险趋势。
 *
 * [PROTOCOL]:
 * 1. 一旦本文件逻辑变更，必须同步更新此 Header。
 * 2. 更新后必须上浮检查 /src/components/.folder.md 的描述是否依然准确。
 */
"use client";

import { useState, useMemo, useCallback } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { WEEKDAYS, getDaysInMonth, getFirstDayOfWeek, toDateStr } from "@/lib/calendar";
import type { HistoryRecord } from "@/types/api";

interface CalendarHeatmapProps {
  records: HistoryRecord[];
  selectedDate?: string;
  onDateSelect: (date: string) => void;
}

const RISK_COLORS: Record<string, string> = {
  green: "bg-emerald-500/30 hover:bg-emerald-500/40",
  yellow: "bg-amber-500/30 hover:bg-amber-500/40",
  red: "bg-red-500/30 hover:bg-red-500/40",
};

const RISK_LABELS: { key: string; label: string; className: string }[] = [
  { key: "none", label: "无数据", className: "bg-zinc-800/40" },
  { key: "green", label: "低风险", className: "bg-emerald-500/30" },
  { key: "yellow", label: "中等风险", className: "bg-amber-500/30" },
  { key: "red", label: "高风险", className: "bg-red-500/30" },
];

export function CalendarHeatmap({ records, selectedDate, onDateSelect }: CalendarHeatmapProps) {
  const now = new Date();
  const [viewYear, setViewYear] = useState(now.getFullYear());
  const [viewMonth, setViewMonth] = useState(now.getMonth());

  // O(1) 查找：dateStr → HistoryRecord
  const recordMap = useMemo(() => {
    const map = new Map<string, HistoryRecord>();
    for (const r of records) {
      const dateStr = r.data_ts?.split("T")[0];
      if (dateStr) map.set(dateStr, r);
    }
    return map;
  }, [records]);

  // 当月统计
  const monthStats = useMemo(() => {
    const prefix = `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}`;
    let total = 0, green = 0, yellow = 0, red = 0;
    for (const [dateStr, r] of recordMap) {
      if (!dateStr.startsWith(prefix)) continue;
      total++;
      if (r.risk_light === "green") green++;
      else if (r.risk_light === "yellow") yellow++;
      else if (r.risk_light === "red") red++;
    }
    return { total, green, yellow, red };
  }, [recordMap, viewYear, viewMonth]);

  const prevMonth = useCallback(() => {
    setViewMonth((m) => {
      if (m === 0) { setViewYear((y) => y - 1); return 11; }
      return m - 1;
    });
  }, []);

  const nextMonth = useCallback(() => {
    setViewMonth((m) => {
      if (m === 11) { setViewYear((y) => y + 1); return 0; }
      return m + 1;
    });
  }, []);

  const daysInMonth = getDaysInMonth(viewYear, viewMonth);
  const firstDay = getFirstDayOfWeek(viewYear, viewMonth);
  const today = toDateStr(now.getFullYear(), now.getMonth(), now.getDate());

  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  return (
    <div className="relative rounded-2xl overflow-hidden bg-gradient-to-br from-zinc-900/80 to-zinc-950/80 border border-zinc-800/50 backdrop-blur-xl">
      <div className="absolute top-0 left-0 right-0 h-0.5 opacity-50 bg-gradient-to-r from-transparent via-amber-500 to-transparent" />

      {/* 月份导航 */}
      <div className="p-4 border-b border-zinc-800/50 flex items-center justify-between">
        <button
          onClick={prevMonth}
          className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <span className="text-sm font-medium text-zinc-200">
          {viewYear}年{viewMonth + 1}月
        </span>
        <button
          onClick={nextMonth}
          className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* 日历网格 */}
      <div className="p-4">
        {/* 星期标题 */}
        <div className="grid grid-cols-7 gap-1 mb-1">
          {WEEKDAYS.map((w) => (
            <div key={w} className="text-center text-xs text-zinc-500 font-medium py-1">
              {w}
            </div>
          ))}
        </div>

        {/* 日期格子 */}
        <div className="grid grid-cols-7 gap-1">
          {cells.map((day, i) => {
            if (day === null) {
              return <div key={`empty-${i}`} className="aspect-square" />;
            }

            const dateStr = toDateStr(viewYear, viewMonth, day);
            const record = recordMap.get(dateStr);
            const riskLight = record?.risk_light;
            const isSelected = dateStr === selectedDate;
            const isToday = dateStr === today;
            const isFuture = dateStr > today;

            return (
              <button
                key={dateStr}
                onClick={() => record && onDateSelect(dateStr)}
                disabled={isFuture || !record}
                className={cn(
                  "aspect-square rounded-lg text-xs font-medium transition-all duration-150 flex items-center justify-center",
                  isFuture
                    ? "text-zinc-700 cursor-not-allowed"
                    : record && riskLight && RISK_COLORS[riskLight]
                    ? cn(RISK_COLORS[riskLight], "cursor-pointer text-zinc-200")
                    : record
                    ? "bg-zinc-700/30 hover:bg-zinc-700/40 cursor-pointer text-zinc-300"
                    : "text-zinc-600 cursor-default",
                  isSelected && "ring-2 ring-amber-400/60",
                  isToday && !isSelected && "ring-1 ring-zinc-500"
                )}
              >
                {day}
              </button>
            );
          })}
        </div>
      </div>

      {/* 图例 */}
      <div className="px-4 pb-3 flex items-center gap-3 flex-wrap">
        {RISK_LABELS.map(({ key, label, className }) => (
          <div key={key} className="flex items-center gap-1.5">
            <span className={cn("w-3 h-3 rounded-sm", className)} />
            <span className="text-xs text-zinc-500">{label}</span>
          </div>
        ))}
      </div>

      {/* 月度统计 */}
      <div className="px-4 pb-4">
        <div className="rounded-xl bg-zinc-800/30 p-3 grid grid-cols-4 gap-2 text-center">
          <div>
            <div className="text-lg font-semibold text-zinc-200">{monthStats.total}</div>
            <div className="text-xs text-zinc-500">运行次数</div>
          </div>
          <div>
            <div className="text-lg font-semibold text-emerald-400">{monthStats.green}</div>
            <div className="text-xs text-zinc-500">绿灯</div>
          </div>
          <div>
            <div className="text-lg font-semibold text-amber-400">{monthStats.yellow}</div>
            <div className="text-xs text-zinc-500">黄灯</div>
          </div>
          <div>
            <div className="text-lg font-semibold text-red-400">{monthStats.red}</div>
            <div className="text-xs text-zinc-500">红灯</div>
          </div>
        </div>
      </div>
    </div>
  );
}
