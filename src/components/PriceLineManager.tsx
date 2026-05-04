/**
 * [INPUT]: { lines, onAdd, onRemove }
 * [OUTPUT]: per-pane popover — 添加 priceLine（value+label+color）+ 列表 + 删除
 * [POS]: 位于 /components，被 EditablePane 引用（每个 pane 独立 PriceLineManager）。
 *        让用户能在图表上画水平线标支撑/阻力位 — 行业调研 #2 必做 ROI 的最简单 v1。
 *
 * [PROTOCOL]:
 * 1. 自身管理 popover open + 表单 state；ESC / 外部点击关闭。
 * 2. 不发起 API 请求；lines 由父组件传入；新增/删除通过 callback 通知。
 * 3. value 必填且 finite；label 1-30 字符。
 * 4. 颜色 5 选 1，对应 lightweight-charts createPriceLine 显示色。
 */
"use client";

import { useEffect, useRef, useState } from "react";
import { Minus, Plus, Trash2, X } from "lucide-react";
import type { PriceLine } from "@/lib/workspace-state";
import { PRICE_LINE_COLOR_HEX } from "@/lib/workspace-state";

interface PriceLineManagerProps {
  lines: PriceLine[];
  onAdd: (value: number, label: string, color: PriceLine["color"]) => void;
  onRemove: (id: string) => void;
}

const COLOR_OPTS: PriceLine["color"][] = ["purple", "green", "amber", "red", "blue"];

export function PriceLineManager({ lines, onAdd, onRemove }: PriceLineManagerProps) {
  const [open, setOpen] = useState(false);
  const [valueStr, setValueStr] = useState("");
  const [label, setLabel] = useState("");
  const [color, setColor] = useState<PriceLine["color"]>("purple");
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
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
    const value = parseFloat(valueStr);
    const trimmedLabel = label.trim();
    if (!Number.isFinite(value)) return;
    if (trimmedLabel.length === 0 || trimmedLabel.length > 30) return;
    onAdd(value, trimmedLabel, color);
    setValueStr("");
    setLabel("");
    setColor("purple"); // review-driven：reset color 避免下条 line 误用上次选择
  };

  return (
    <div ref={wrapperRef} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className={
          "flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-xs transition-colors " +
          (lines.length > 0
            ? "border-[var(--border-subtle)] bg-[var(--bg-elevated)] text-[var(--text-primary)]"
            : "border-[var(--border-subtle)] bg-[var(--bg-card)] text-[var(--text-secondary)] hover:bg-[var(--bg-card-hover)] hover:text-[var(--text-primary)]")
        }
        title="价格线（标支撑/阻力位）"
      >
        <Minus className="h-3 w-3" />
        线{lines.length > 0 && ` (${lines.length})`}
      </button>

      {open && (
        <div className="absolute right-0 top-full z-30 mt-1 w-72 overflow-hidden rounded-lg border border-[var(--border-visible)] bg-[var(--bg-card)] shadow-2xl">
          <div className="flex items-center justify-between border-b border-[var(--border-subtle)] px-3 py-2 text-[10px] uppercase tracking-wider text-[var(--text-faint)]">
            <span>价格线（支撑/阻力位）</span>
            <button
              onClick={() => setOpen(false)}
              className="rounded p-0.5 text-[var(--text-faint)] hover:text-[var(--text-primary)]"
            >
              <X className="h-3 w-3" />
            </button>
          </div>

          {/* 添加 form */}
          <div className="space-y-2 border-b border-[var(--border-subtle)] p-3">
            <div className="flex gap-2">
              <input
                type="number"
                step="any"
                value={valueStr}
                onChange={(e) => setValueStr(e.target.value)}
                placeholder="价格值（如 80000）"
                className="flex-1 rounded-md border border-[var(--border-subtle)] bg-[var(--bg-inset)] px-2 py-1 text-xs text-[var(--text-primary)] placeholder-[var(--text-faint)] outline-none"
              />
              <div className="flex gap-1 rounded-md border border-[var(--border-subtle)] bg-[var(--bg-inset)] p-0.5">
                {COLOR_OPTS.map((c) => (
                  <button
                    key={c}
                    onClick={() => setColor(c)}
                    className={
                      "h-5 w-5 rounded transition-all " +
                      (color === c
                        ? "ring-1 ring-[var(--text-primary)] ring-offset-1 ring-offset-[var(--bg-inset)]"
                        : "")
                    }
                    style={{ backgroundColor: PRICE_LINE_COLOR_HEX[c] }}
                    title={c}
                  />
                ))}
              </div>
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={label}
                placeholder="标签（如：支撑位 / Q4 阻力）"
                maxLength={30}
                onChange={(e) => setLabel(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleAdd();
                }}
                className="flex-1 rounded-md border border-[var(--border-subtle)] bg-[var(--bg-inset)] px-2 py-1 text-xs text-[var(--text-primary)] placeholder-[var(--text-faint)] outline-none"
              />
              <button
                onClick={handleAdd}
                disabled={!valueStr || label.trim().length === 0}
                className="flex items-center gap-1 rounded-md border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-2 py-1 text-xs text-[var(--text-primary)] hover:bg-[var(--bg-card-hover)] disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Plus className="h-3 w-3" />
                添加
              </button>
            </div>
          </div>

          {/* 现有列表 */}
          <ul className="max-h-56 overflow-y-auto py-1">
            {lines.length === 0 && (
              <li className="px-3 py-3 text-center text-[11px] text-[var(--text-muted)]">
                暂无价格线
              </li>
            )}
            {lines.map((l) => (
              <li
                key={l.id}
                className="group flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-[var(--bg-card-hover)]"
              >
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-sm"
                  style={{ backgroundColor: PRICE_LINE_COLOR_HEX[l.color] }}
                />
                <span className="font-mono text-[10px] text-[var(--text-faint)]">
                  {l.value}
                </span>
                <span className="flex-1 truncate text-[var(--text-secondary)]">
                  {l.label}
                </span>
                <button
                  onClick={() => onRemove(l.id)}
                  className="rounded p-0.5 text-[var(--text-faint)] opacity-0 transition-opacity hover:text-[var(--status-red)] group-hover:opacity-100"
                  title="删除"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
