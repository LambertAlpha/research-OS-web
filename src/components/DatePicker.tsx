/**
 * [INPUT]: (selectedDate, availableDates, onDateSelect) - 当前选中日期、有数据的日期列表、日期选择回调。
 * [OUTPUT]: (<div>) - 点击展开的日历面板，含月份网格、有数据日期标记、选中高亮、月份切换。
 * [POS]: 位于 /components，被 Header 组件引用。
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
  selectedDate?: string;
  availableDates: string[];
  onDateSelect: (date: string) => void;
}

export function DatePicker({
  selectedDate,
  availableDates,
  onDateSelect,
}: DatePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const initDate = selectedDate ? new Date(selectedDate) : new Date();
  const [viewYear, setViewYear] = useState(initDate.getFullYear());
  const [viewMonth, setViewMonth] = useState(initDate.getMonth());

  const availableSet = useRef(new Set<string>());
  useEffect(() => {
    availableSet.current = new Set(availableDates);
  }, [availableDates]);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [isOpen]);

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

  const handleDayClick = useCallback(
    (dateStr: string) => { onDateSelect(dateStr); setIsOpen(false); },
    [onDateSelect]
  );

  const daysInMonth = getDaysInMonth(viewYear, viewMonth);
  const firstDay = getFirstDayOfWeek(viewYear, viewMonth);
  const today = new Date().toISOString().split("T")[0]!;

  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={() => setIsOpen((o) => !o)}
        className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--bg-card)] border border-[var(--border-subtle)] hover:bg-[var(--bg-card-hover)] transition-colors duration-100"
      >
        <Calendar className="w-3.5 h-3.5 text-[var(--text-faint)]" />
        <span className="text-[13px] text-[var(--text-muted)] tabular-nums">{selectedDate || today}</span>
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-2 z-50 w-72 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-visible)] shadow-2xl shadow-black/40 p-3">
          <div className="flex items-center justify-between mb-3">
            <button onClick={prevMonth} className="p-1 rounded hover:bg-[var(--bg-card)] text-[var(--text-muted)] transition-colors">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-sm font-medium text-zinc-300">{viewYear}年{viewMonth + 1}月</span>
            <button onClick={nextMonth} className="p-1 rounded hover:bg-[var(--bg-card)] text-[var(--text-muted)] transition-colors">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-7 gap-0.5 mb-1">
            {WEEKDAYS.map((w) => (
              <div key={w} className="text-center text-[10px] text-[var(--text-faint)] font-medium py-1">{w}</div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-0.5">
            {cells.map((day, i) => {
              if (day === null) return <div key={`e-${i}`} className="h-9" />;

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
                    "relative h-9 rounded-lg text-xs font-medium transition-colors duration-75 flex flex-col items-center justify-center",
                    isFuture ? "text-[var(--text-faint)]/30 cursor-not-allowed"
                      : hasData ? "text-zinc-300 hover:bg-[var(--bg-card)] cursor-pointer"
                      : "text-[var(--text-faint)] hover:bg-[var(--bg-card)] cursor-pointer",
                    isSelected && "bg-[var(--bg-card)] text-zinc-100 ring-1 ring-[var(--border-visible)]",
                    isToday && !isSelected && "ring-1 ring-[var(--border-subtle)]"
                  )}
                >
                  <span>{day}</span>
                  {hasData && <span className="absolute bottom-0.5 w-1 h-1 rounded-full bg-[var(--text-faint)]" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
