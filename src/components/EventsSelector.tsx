/**
 * [INPUT]: { eventTypes, enabled, defaultRecommended, onChange }
 * [OUTPUT]: 工具栏中的 popover 选择器，列出 catalog 9 类事件类型，按需勾选
 * [POS]: 位于 /components，被 ChartsToolbar 引用。是 M5 升级——把 M4 的二态 toggle
 *        升级成 multi-select，让用户精确控制图表上想叠加哪些事件 markers。
 *
 * [PROTOCOL]:
 * 1. 自身管理 popover open/close + outside-click 关闭。
 * 2. 不发起 API 请求；eventTypes 由父组件从 catalog 传入。
 * 3. enabled 是当前选中的事件类型 ID 数组；onChange 给父组件下一个值（不可变）。
 * 4. 三个快捷操作：全选 / 推荐（DEFAULT_ENABLED_EVENT_TYPES）/ 全清。
 */
"use client";

import { useEffect, useRef, useState } from "react";
import { Bell, BellOff } from "lucide-react";
import type { ChartEventType } from "@/types/api";

interface EventsSelectorProps {
  eventTypes: ChartEventType[];
  enabled: string[];
  defaultRecommended: string[];
  onChange: (next: string[]) => void;
}

const SEVERITY_COLOR: Record<string, string> = {
  critical: "#ef4444",
  warning: "#eab308",
  info: "#3b82f6",
};

export function EventsSelector({
  eventTypes,
  enabled,
  defaultRecommended,
  onChange,
}: EventsSelectorProps) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const total = eventTypes.length;
  const enabledSet = new Set(enabled);
  const count = enabled.length;
  const anyOn = count > 0;

  const toggle = (id: string) => {
    if (enabledSet.has(id)) {
      onChange(enabled.filter((x) => x !== id));
    } else {
      onChange([...enabled, id]);
    }
  };

  return (
    <div ref={wrapperRef} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className={
          "flex items-center gap-1 rounded-md border px-2 py-1 text-xs transition-colors " +
          (anyOn
            ? "border-[var(--border-subtle)] bg-[var(--bg-elevated)] text-[var(--text-primary)]"
            : "border-[var(--border-subtle)] bg-[var(--bg-inset)] text-[var(--text-muted)] hover:text-[var(--text-primary)]")
        }
        title="选择要叠加到图表的事件类型；空选 = 不显示任何 markers"
      >
        {anyOn ? <Bell className="h-3 w-3" /> : <BellOff className="h-3 w-3" />}
        事件 {count}/{total}
      </button>

      {open && (
        <div className="absolute right-0 top-full z-30 mt-1 w-80 overflow-hidden rounded-lg border border-[var(--border-visible)] bg-[var(--bg-card)] shadow-2xl">
          <div className="flex items-center justify-between border-b border-[var(--border-subtle)] px-3 py-2">
            <span className="text-[10px] uppercase tracking-wider text-[var(--text-faint)]">
              选择事件类型
            </span>
            <div className="flex gap-2 text-[11px]">
              <button
                onClick={() => onChange(eventTypes.map((t) => t.id))}
                className="text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              >
                全选
              </button>
              <span className="text-[var(--text-faint)]">·</span>
              <button
                onClick={() => onChange([...defaultRecommended])}
                className="text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              >
                推荐
              </button>
              <span className="text-[var(--text-faint)]">·</span>
              <button
                onClick={() => onChange([])}
                className="text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              >
                全清
              </button>
            </div>
          </div>
          {/* 引导：信号 indicator vs markers 的定位差异 */}
          <div className="border-b border-[var(--border-subtle)] bg-[rgba(168,85,247,0.05)] px-3 py-2 text-[11px] leading-relaxed text-[var(--text-secondary)]">
            <span className="text-[var(--text-faint)]">💡 提示：</span>
            想看「灯号 / 体制 / BTC 信号」<b className="text-[var(--text-primary)]">当前是什么</b>
            ？拖 <span className="font-mono text-[#a855f7]">🚦 SIG_*</span> 信号
            indicator 到 pane 看连续状态。Markers 仅标记<b className="text-[var(--text-primary)]">瞬时转换</b>。
          </div>
          <ul className="max-h-80 overflow-y-auto py-1">
            {eventTypes.map((t) => {
              const isOn = enabledSet.has(t.id);
              const sevColor =
                SEVERITY_COLOR[t.default_severity] ?? "var(--text-faint)";
              return (
                <li key={t.id}>
                  <button
                    onClick={() => toggle(t.id)}
                    className="flex w-full items-center gap-2 px-3 py-1.5 text-left hover:bg-[var(--bg-card-hover)]"
                  >
                    <span
                      className={
                        "flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded border " +
                        (isOn
                          ? "border-[var(--text-primary)] bg-[var(--text-primary)]"
                          : "border-[var(--border-visible)] bg-transparent")
                      }
                    >
                      {isOn && (
                        <svg
                          width="9"
                          height="9"
                          viewBox="0 0 12 12"
                          fill="none"
                          xmlns="http://www.w3.org/2000/svg"
                        >
                          <path
                            d="M2 6.5L4.5 9L10 3"
                            stroke="#08080a"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      )}
                    </span>
                    <span
                      className="inline-block h-1.5 w-1.5 shrink-0 rounded-full"
                      style={{ backgroundColor: sevColor }}
                      title={`severity: ${t.default_severity}`}
                    />
                    <span
                      className={
                        "flex-1 text-xs " +
                        (isOn
                          ? "text-[var(--text-primary)]"
                          : "text-[var(--text-secondary)]")
                      }
                    >
                      {t.name}
                    </span>
                    <span className="text-[10px] text-[var(--text-faint)]">
                      {t.model || "any"}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
