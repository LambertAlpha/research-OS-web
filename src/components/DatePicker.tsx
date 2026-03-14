/**
 * [INPUT]: (selectedDate, availableDates, onDateSelect) - 当前选中日期、有数据的日期列表、日期选择回调。
 * [OUTPUT]: (<div>) - 点击展开的日历面板，含月份网格、有数据日期 cyan 圆点标记、选中高亮、月份切换箭头。
 * [POS]: 位于 /components，被 Header 组件引用。替换原生 date input，提供智能日历选择器。
 *
 * [PROTOCOL]:
 * 1. 一旦本文件逻辑变更，必须同步更新此 Header。
 * 2. 更新后必须上浮检查 /src/components/.folder.md 的描述是否依然准确。
 */
"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { ChevronLeft, ChevronRight, Calendar } from "lucide-react";
import { cn } from "@/lib/utils";
import { WEEKDAYS, getDaysInMonth, getFirstDayOfWeek, toDateStr } from "@/lib/calendar";

interface DatePickerProps {
  selectedDate?: string; // YYYY-MM-DD
  availableDates: string[]; // YYYY-MM-DD[]
  onDateSelect: (date: string) => void;
}

export function DatePicker({
  selectedDate,
  availableDates,
  onDateSelect,
}: DatePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Parse selected date to initialize viewMonth
  const initDate = selectedDate ? new Date(selectedDate) : new Date();
  const [viewYear, setViewYear] = useState(initDate.getFullYear());
  const [viewMonth, setViewMonth] = useState(initDate.getMonth());

  // Build a Set for O(1) lookup
  const availableSet = useRef(new Set<string>());
  useEffect(() => {
    availableSet.current = new Set(availableDates);
  }, [availableDates]);

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [isOpen]);

  const prevMonth = useCallback(() => {
    setViewMonth((m) => {
      if (m === 0) {
        setViewYear((y) => y - 1);
        return 11;
      }
      return m - 1;
    });
  }, []);

  const nextMonth = useCallback(() => {
    setViewMonth((m) => {
      if (m === 11) {
        setViewYear((y) => y + 1);
        return 0;
      }
      return m + 1;
    });
  }, []);

  const handleDayClick = useCallback(
    (dateStr: string) => {
      onDateSelect(dateStr);
      setIsOpen(false);
    },
    [onDateSelect]
  );

  // Calendar grid
  const daysInMonth = getDaysInMonth(viewYear, viewMonth);
  const firstDay = getFirstDayOfWeek(viewYear, viewMonth);
  const today = new Date().toISOString().split("T")[0]!;

  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  // Display label for the trigger button
  const displayLabel = selectedDate || today;

  return (
    <div ref={containerRef} className="relative">
      {/* Trigger */}
      <button
        onClick={() => setIsOpen((o) => !o)}
        className="flex items-center gap-2 px-3 py-2 rounded-xl bg-zinc-900/50 border border-zinc-800/50 backdrop-blur-sm hover:border-cyan-500/30 transition-colors"
      >
        <Calendar className="w-4 h-4 text-cyan-400/70" />
        <span className="text-sm text-zinc-300">{displayLabel}</span>
      </button>

      {/* Dropdown calendar */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-2 z-50 w-72 rounded-xl bg-zinc-900/95 border border-zinc-700/50 backdrop-blur-xl shadow-2xl shadow-black/50 p-3">
          {/* Month navigation */}
          <div className="flex items-center justify-between mb-3">
            <button
              onClick={prevMonth}
              className="p-1 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-sm font-medium text-zinc-200">
              {viewYear}年{viewMonth + 1}月
            </span>
            <button
              onClick={nextMonth}
              className="p-1 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Weekday headers */}
          <div className="grid grid-cols-7 gap-0.5 mb-1">
            {WEEKDAYS.map((w) => (
              <div
                key={w}
                className="text-center text-xs text-zinc-500 font-medium py-1"
              >
                {w}
              </div>
            ))}
          </div>

          {/* Days grid */}
          <div className="grid grid-cols-7 gap-0.5">
            {cells.map((day, i) => {
              if (day === null) {
                return <div key={`empty-${i}`} className="h-9" />;
              }

              const dateStr = toDateStr(viewYear, viewMonth, day);
              const hasData = availableSet.current.has(dateStr);
              const isSelected = dateStr === selectedDate;
              const isToday = dateStr === today;
              const isFuture = dateStr > today;

              return (
                <button
                  key={dateStr}
                  onClick={() => !isFuture && handleDayClick(dateStr)}
                  disabled={isFuture}
                  className={cn(
                    "relative h-9 rounded-lg text-xs font-medium transition-all duration-150 flex flex-col items-center justify-center",
                    isFuture
                      ? "text-zinc-700 cursor-not-allowed"
                      : hasData
                      ? "text-zinc-200 hover:bg-cyan-500/20 cursor-pointer"
                      : "text-zinc-500 hover:bg-zinc-800 cursor-pointer",
                    isSelected &&
                      "bg-cyan-500/30 text-cyan-300 ring-1 ring-cyan-500/50",
                    isToday && !isSelected && "ring-1 ring-zinc-600"
                  )}
                >
                  <span>{day}</span>
                  {/* Data indicator dot */}
                  {hasData && (
                    <span className="absolute bottom-0.5 w-1 h-1 rounded-full bg-cyan-400" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

    </div>
  );
}
