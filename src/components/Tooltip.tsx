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

  // 优先从字典获取,否则使用自定义内容
  const info: IndicatorInfo | null = indicatorKey
    ? getIndicatorInfo(indicatorKey)
    : customContent || null;

  // 确保在客户端渲染
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // 计算 Tooltip 位置
  const updatePosition = () => {
    if (!triggerRef.current) return;

    const rect = triggerRef.current.getBoundingClientRect();
    const tooltipWidth = 320; // w-80 = 320px
    const tooltipHeight = 300; // 估算高度
    const gap = 12; // 间距

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

    // 边界检测,防止超出视口
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

  // Hover 事件处理
  const handleMouseEnter = () => {
    setIsVisible(true);
    updatePosition();
  };

  const handleMouseLeave = () => {
    setIsVisible(false);
  };

  // 监听滚动和窗口大小变化
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
        "fixed z-[9999] opacity-0 invisible transition-all duration-300 pointer-events-none",
        isVisible && "opacity-100 visible"
      )}
      style={{
        top: `${position.top}px`,
        left: `${position.left}px`,
      }}
    >
      <div
        className={cn(
          "w-80 rounded-xl p-4 shadow-2xl",
          "bg-zinc-900/95 backdrop-blur-xl",
          "border border-cyan-500/30",
          "text-left"
        )}
      >
        {/* 顶部渐变线 */}
        <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-cyan-500 to-transparent opacity-60" />

        {/* 标题 */}
        <div className="text-sm font-bold text-cyan-400 mb-2 flex items-center gap-2">
          <Eye className="w-4 h-4" />
          {info.name}
        </div>

        {/* 描述 */}
        <div className="text-sm text-zinc-300 mb-3 leading-relaxed">
          {info.description}
        </div>

        {/* 公式 (如果有) */}
        {info.formula && (
          <div className="mb-3">
            <div className="text-xs text-zinc-500 uppercase tracking-wider mb-1">
              计算公式
            </div>
            <div className="text-xs text-zinc-400 font-mono bg-zinc-950/50 rounded px-2 py-1.5 border border-zinc-800">
              {info.formula}
            </div>
          </div>
        )}

        {/* 阈值 (如果有) */}
        {info.thresholds && (
          <div className="mb-3">
            <div className="text-xs text-zinc-500 uppercase tracking-wider mb-1">
              关键阈值
            </div>
            <div className="text-xs text-zinc-300 leading-relaxed">
              {info.thresholds}
            </div>
          </div>
        )}

        {/* 业务意义 */}
        {info.businessMeaning && (
          <div>
            <div className="text-xs text-zinc-500 uppercase tracking-wider mb-1">
              💡 业务含义
            </div>
            <div className="text-xs text-amber-400/90 leading-relaxed font-medium">
              {info.businessMeaning}
            </div>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <>
      {/* Eye 图标 - 触发器 */}
      <div
        ref={triggerRef}
        className={cn("relative inline-block", className)}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        <div
          className={cn(
            "flex items-center justify-center w-5 h-5 rounded-md",
            "text-zinc-500 hover:text-cyan-400",
            "transition-all duration-300 cursor-help",
            "hover:bg-cyan-500/10"
          )}
        >
          <Eye className="w-4 h-4" />
        </div>
      </div>

      {/* Portal: Tooltip 渲染到 body */}
      {isMounted && typeof document !== "undefined" && createPortal(tooltipContent, document.body)}
    </>
  );
}
