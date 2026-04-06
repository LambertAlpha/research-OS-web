/**
 * [INPUT]: (onRunModel?, isLoading?, lastUpdate?, availableDates?, onDateSelect?, selectedDate?) - 所有 props 可选。
 * [OUTPUT]: (<header>) - 顶部粘性工具栏，含 DatePicker + 运行模型按钮 + 最后更新时间。
 * [POS]: 位于 /components，被所有页面组件引用。
 *
 * [PROTOCOL]:
 * 1. 一旦本文件逻辑变更，必须同步更新此 Header。
 * 2. 更新后必须上浮检查 /src/components/.folder.md 的描述是否依然准确。
 */
"use client";

import { RefreshCw } from "lucide-react";
import { cn, formatDateTime } from "@/lib/utils";
import { DatePicker } from "@/components/DatePicker";

interface HeaderProps {
  onRunModel?: (date?: string) => Promise<void>;
  isLoading?: boolean;
  lastUpdate?: string;
  dataAsOf?: string;
  availableDates?: string[];
  onDateSelect?: (date: string) => void;
  selectedDate?: string;
}

export function Header({
  onRunModel,
  isLoading,
  lastUpdate,
  dataAsOf,
  availableDates,
  onDateSelect,
  selectedDate,
}: HeaderProps = {}) {
  const handleRun = () => {
    onRunModel?.(selectedDate);
  };

  return (
    <header className="sticky top-0 z-10 bg-[var(--bg)]/95 backdrop-blur-sm border-b border-[var(--border-subtle)]">
      <div className="px-6 py-3">
        <div className="flex items-center justify-between">
          <div>
            {lastUpdate && (
              <p className="text-[11px] text-[var(--text-faint)]">
                最后更新{" "}
                <span className="text-[var(--text-muted)]">
                  {formatDateTime(lastUpdate)}
                </span>
                {dataAsOf && (
                  <>
                    {" "}&middot; 数据截至{" "}
                    <span className="text-[var(--text-muted)]">{dataAsOf}</span>
                  </>
                )}
              </p>
            )}
          </div>

          {onRunModel && (
            <div className="flex items-center gap-3">
              {availableDates && onDateSelect && (
                <DatePicker
                  selectedDate={selectedDate}
                  availableDates={availableDates}
                  onDateSelect={onDateSelect}
                />
              )}

              <button
                onClick={handleRun}
                disabled={isLoading}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-lg text-[13px] font-medium transition-opacity duration-100",
                  "bg-zinc-200 text-zinc-900 hover:opacity-90",
                  "disabled:opacity-30 disabled:cursor-not-allowed"
                )}
              >
                <RefreshCw
                  className={cn("w-3.5 h-3.5", isLoading && "animate-spin")}
                />
                {isLoading ? "运行中..." : "运行模型"}
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
