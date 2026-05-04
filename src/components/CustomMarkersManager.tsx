/**
 * [INPUT]: { markers, onAdd, onRemove }
 * [OUTPUT]: 工具栏 popover — 列表当前 customMarkers + 添加 form（date/label/severity）
 * [POS]: 位于 /components，被 ChartsToolbar 引用。
 *        让用户在图表上自定义标注（政策日 / 个人买卖点 / 重要事件），
 *        区别于后端 events 端点的"模型推理事件"。
 *
 * [PROTOCOL]:
 * 1. 自身管理 popover open 状态 + 添加 form 状态。
 * 2. 不发起 API 请求；markers 由父组件传入；新增/删除通过 callback 通知父组件。
 * 3. 添加 form 校验：date 必填且不超出今天；label 1-40 字符（不强制非空但 trim）。
 */
"use client";

import { useEffect, useRef, useState } from "react";
import { Bookmark, Plus, Trash2, X } from "lucide-react";
import type { CustomMarker } from "@/lib/workspace-state";

interface CustomMarkersManagerProps {
  markers: CustomMarker[];
  onAdd: (ts: string, label: string, severity: CustomMarker["severity"]) => void;
  onRemove: (id: string) => void;
}

const SEVERITY_OPTS: { id: CustomMarker["severity"]; label: string; color: string }[] = [
  { id: "info", label: "信息", color: "#3b82f6" },
  { id: "warning", label: "警告", color: "#eab308" },
  { id: "critical", label: "重要", color: "#ef4444" },
];

export function CustomMarkersManager({
  markers,
  onAdd,
  onRemove,
}: CustomMarkersManagerProps) {
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState("");
  const [label, setLabel] = useState("");
  const [severity, setSeverity] = useState<CustomMarker["severity"]>("info");
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    // review-driven：底部文案承诺 ESC 关闭，需补 keydown 监听
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const handleAdd = () => {
    const trimmedLabel = label.trim();
    if (!date || trimmedLabel.length === 0) return;
    if (trimmedLabel.length > 40) return;
    onAdd(date, trimmedLabel, severity);
    // 清表单（保留 date 方便连续输入）
    setLabel("");
  };

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div ref={wrapperRef} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className={
          "flex items-center gap-1 rounded-md border px-2 py-1 text-xs transition-colors " +
          (markers.length > 0
            ? "border-[var(--border-subtle)] bg-[var(--bg-elevated)] text-[var(--text-primary)]"
            : "border-[var(--border-subtle)] bg-[var(--bg-inset)] text-[var(--text-muted)] hover:text-[var(--text-primary)]")
        }
        title="管理用户自定义事件标记（政策日 / 买卖点 / 重要事件）"
      >
        <Bookmark className="h-3 w-3" />
        标记 {markers.length > 0 && `(${markers.length})`}
      </button>

      {open && (
        <div className="absolute right-0 top-full z-30 mt-1 w-80 overflow-hidden rounded-lg border border-[var(--border-visible)] bg-[var(--bg-card)] shadow-2xl">
          <div className="border-b border-[var(--border-subtle)] px-3 py-2 text-[10px] uppercase tracking-wider text-[var(--text-faint)]">
            自定义事件标记
          </div>

          {/* 添加 form */}
          <div className="space-y-2 border-b border-[var(--border-subtle)] p-3">
            <div className="flex gap-2">
              <input
                type="date"
                value={date}
                max={today}
                onChange={(e) => setDate(e.target.value)}
                className="rounded-md border border-[var(--border-subtle)] bg-[var(--bg-inset)] px-2 py-1 text-xs text-[var(--text-primary)] outline-none"
              />
              <select
                value={severity}
                onChange={(e) =>
                  setSeverity(e.target.value as CustomMarker["severity"])
                }
                className="rounded-md border border-[var(--border-subtle)] bg-[var(--bg-inset)] px-2 py-1 text-xs text-[var(--text-primary)] outline-none"
              >
                {SEVERITY_OPTS.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={label}
                placeholder="标签（如：FOMC 决议 / 关税恐慌）"
                maxLength={40}
                onChange={(e) => setLabel(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleAdd();
                }}
                className="flex-1 rounded-md border border-[var(--border-subtle)] bg-[var(--bg-inset)] px-2 py-1 text-xs text-[var(--text-primary)] placeholder-[var(--text-faint)] outline-none"
              />
              <button
                onClick={handleAdd}
                disabled={!date || label.trim().length === 0}
                className="flex items-center gap-1 rounded-md border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-2 py-1 text-xs text-[var(--text-primary)] hover:bg-[var(--bg-card-hover)] disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Plus className="h-3 w-3" />
                添加
              </button>
            </div>
          </div>

          {/* 现有列表 */}
          <ul className="max-h-64 overflow-y-auto py-1">
            {markers.length === 0 && (
              <li className="px-3 py-3 text-center text-[11px] text-[var(--text-muted)]">
                暂无自定义标记
              </li>
            )}
            {[...markers]
              .sort((a, b) => b.ts.localeCompare(a.ts))
              .map((m) => {
                const sevColor =
                  SEVERITY_OPTS.find((s) => s.id === m.severity)?.color ??
                  "#3b82f6";
                return (
                  <li key={m.id} className="group flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-[var(--bg-card-hover)]">
                    <span
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{ backgroundColor: sevColor }}
                    />
                    <span className="font-mono text-[10px] text-[var(--text-faint)]">
                      {m.ts}
                    </span>
                    <span className="flex-1 truncate text-[var(--text-secondary)]">
                      {m.label}
                    </span>
                    <button
                      onClick={() => onRemove(m.id)}
                      className="rounded p-0.5 text-[var(--text-faint)] opacity-0 transition-opacity hover:text-[var(--status-red)] group-hover:opacity-100"
                      title="删除"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </li>
                );
              })}
          </ul>
          <div className="border-t border-[var(--border-subtle)] px-3 py-1.5 text-[10px] text-[var(--text-faint)]">
            ESC 或点外部关闭
            <button
              onClick={() => setOpen(false)}
              className="float-right rounded p-0.5 text-[var(--text-faint)] hover:text-[var(--text-primary)]"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
