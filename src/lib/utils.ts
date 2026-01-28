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
