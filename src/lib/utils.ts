/**
 * [INPUT]: 各函数接收不同参数：cn() 接收 ClassValue[]，getRiskLight*() 接收 risk 字符串，format*() 接收原始值。
 * [OUTPUT]: 格式化后的字符串（CSS 类名、颜色值、中文标签、数字格式）。
 * [POS]: 位于 /lib，被所有页面和组件引用。纯函数工具集，提供 Tailwind 类合并、风险灯号映射、闸门颜色映射、日期/数字格式化。
 *
 * [PROTOCOL]:
 * 1. 一旦本文件逻辑变更，必须同步更新此 Header。
 * 2. 更新后必须上浮检查 /src/lib/.folder.md 的描述是否依然准确。
 */
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function getRiskLightColor(risk?: string | null): string {
  if (!risk) return "#64748b";
  switch (risk.toLowerCase()) {
    case "green":
      return "#22c55e";
    case "yellow":
      return "#eab308";
    case "red":
      return "#ef4444";
    default:
      return "#64748b";
  }
}

export function getRiskLightBg(risk?: string | null): string {
  if (!risk) return "bg-slate-500/20";
  switch (risk.toLowerCase()) {
    case "green":
      return "bg-green-500/20";
    case "yellow":
      return "bg-yellow-500/20";
    case "red":
      return "bg-red-500/20";
    default:
      return "bg-slate-500/20";
  }
}

export function getRiskLightLabel(risk?: string | null): string {
  if (!risk) return "未知";
  switch (risk.toLowerCase()) {
    case "green":
      return "低风险";
    case "yellow":
      return "中等风险";
    case "red":
      return "高风险";
    default:
      return "未知";
  }
}

export function getGateStatusColor(status?: string | null): string {
  if (!status) return "#64748b";
  switch (status.toLowerCase()) {
    case "open":
      return "#22c55e";
    case "closed":
      return "#ef4444";
    case "warning":
    case "pending":
      return "#eab308";
    default:
      return "#64748b";
  }
}

export function formatDate(date: string | Date): string {
  return new Date(date).toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function formatNumber(num: number, decimals: number = 2): string {
  return num.toFixed(decimals);
}
