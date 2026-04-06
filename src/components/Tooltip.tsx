/**
 * [INPUT]: (indicatorKey | customContent, placement?) - 指标 key 或自定义内容,可选位置参数
 * [OUTPUT]: (JSX) - Eye 图标 + Hover 弹出的解释面板,使用 Portal 避免被父容器裁剪
 * [POS]: 位于 /components,被所有需要解释的组件引用。提供统一的悬浮解释 UI。
 *
 * [PROTOCOL]:
 * 1. 优先使用 indicatorKey 从字典自动获取信息
 * 2. 当字典中没有时,可使用 customContent 自定义
 * 3. 保持视觉简洁,只在 hover 时显示
 * 4. 使用 Portal + 绝对定位避免被父容器的 overflow 裁剪
 */
"use client";

import { useState, useRef, useEffect } from "react";
// @ts-expect-error - Next.js 自动提供 react-dom 类型
import { createPortal } from "react-dom";
import { Eye } from "lucide-react";
import { getIndicatorInfo, type IndicatorInfo } from "@/lib/indicators";
import { cn } from "@/lib/utils";

interface TooltipProps {
  indicatorKey?: string;
  customContent?: {
    name: string;
    description: string;
    formula?: string;
    thresholds?: string;
    businessMeaning?: string;
  };
  placement?: "top" | "bottom" | "left" | "right";
  className?: string;
}

export function Tooltip({
  indicatorKey,
  customContent,
  placement = "right",
  className,
}: TooltipProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const [isMounted, setIsMounted] = useState(false);
  const triggerRef = useRef<HTMLDivElement>(null);

  const info: IndicatorInfo | null = indicatorKey
    ? getIndicatorInfo(indicatorKey)
    : customContent || null;

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const updatePosition = () => {
    if (!triggerRef.current) return;

    const rect = triggerRef.current.getBoundingClientRect();
    const tooltipWidth = 300;
    const tooltipHeight = 280;
    const gap = 10;

    let top = 0;
    let left = 0;

    switch (placement) {
      case "top":
        top = rect.top - tooltipHeight - gap + window.scrollY;
        left = rect.left + rect.width / 2 - tooltipWidth / 2 + window.scrollX;
        break;
      case "bottom":
        top = rect.bottom + gap + window.scrollY;
        left = rect.left + rect.width / 2 - tooltipWidth / 2 + window.scrollX;
        break;
      case "left":
        top = rect.top + rect.height / 2 - tooltipHeight / 2 + window.scrollY;
        left = rect.left - tooltipWidth - gap + window.scrollX;
        break;
      case "right":
      default:
        top = rect.top + rect.height / 2 - tooltipHeight / 2 + window.scrollY;
        left = rect.right + gap + window.scrollX;
        break;
    }

    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    if (left < 10) left = 10;
    if (left + tooltipWidth > viewportWidth - 10) {
      left = viewportWidth - tooltipWidth - 10;
    }
    if (top < 10) top = 10;
    if (top + tooltipHeight > viewportHeight - 10) {
      top = viewportHeight - tooltipHeight - 10;
    }

    setPosition({ top, left });
  };

  const handleMouseEnter = () => {
    setIsVisible(true);
    updatePosition();
  };

  const handleMouseLeave = () => {
    setIsVisible(false);
  };

  useEffect(() => {
    if (!isVisible) return;

    const handleUpdate = () => {
      updatePosition();
    };

    window.addEventListener("scroll", handleUpdate, true);
    window.addEventListener("resize", handleUpdate);

    return () => {
      window.removeEventListener("scroll", handleUpdate, true);
      window.removeEventListener("resize", handleUpdate);
    };
  }, [isVisible]);

  if (!info) {
    return null;
  }

  const tooltipContent = (
    <div
      className={cn(
        "fixed z-[9999] opacity-0 invisible transition-all duration-150 pointer-events-none",
        isVisible && "opacity-100 visible"
      )}
      style={{
        top: `${position.top}px`,
        left: `${position.left}px`,
      }}
    >
      <div className="w-[300px] rounded-xl p-4 shadow-2xl shadow-black/40 bg-[var(--bg-elevated)] border border-[var(--border-visible)] text-left">
        {/* 标题 */}
        <div className="text-sm font-medium text-zinc-200 mb-2 flex items-center gap-2">
          <Eye className="w-3.5 h-3.5 text-[var(--text-muted)]" />
          {info.name}
        </div>

        {/* 描述 */}
        <div className="text-[13px] text-[var(--text-secondary)] mb-3 leading-relaxed">
          {info.description}
        </div>

        {/* 公式 */}
        {info.formula && (
          <div className="mb-3">
            <div className="text-[10px] text-[var(--text-faint)] uppercase tracking-wider mb-1">
              计算公式
            </div>
            <div className="text-xs text-[var(--text-muted)] font-mono bg-[var(--bg-inset)] rounded px-2 py-1.5 border border-[var(--border-subtle)]">
              {info.formula}
            </div>
          </div>
        )}

        {/* 阈值 */}
        {info.thresholds && (
          <div className="mb-3">
            <div className="text-[10px] text-[var(--text-faint)] uppercase tracking-wider mb-1">
              关键阈值
            </div>
            <div className="text-xs text-[var(--text-secondary)] leading-relaxed">
              {info.thresholds}
            </div>
          </div>
        )}

        {/* 业务意义 */}
        {info.businessMeaning && (
          <div>
            <div className="text-[10px] text-[var(--text-faint)] uppercase tracking-wider mb-1">
              业务含义
            </div>
            <div className="text-xs text-amber-400/70 leading-relaxed">
              {info.businessMeaning}
            </div>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <>
      <div
        ref={triggerRef}
        className={cn("relative inline-block", className)}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        <div className="flex items-center justify-center w-4 h-4 rounded text-[var(--text-faint)] hover:text-[var(--text-muted)] transition-colors duration-100 cursor-help">
          <Eye className="w-3.5 h-3.5" />
        </div>
      </div>

      {isMounted && typeof document !== "undefined" && createPortal(tooltipContent, document.body)}
    </>
  );
}
