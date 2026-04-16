/**
 * [INPUT]: 无 props，自动从 /api/scheduler/batches 获取数据。
 * [OUTPUT]: (<section>) - 数据调度状态面板，展示 4 个批次的运行时间、状态、下次更新时间。
 * [POS]: 可复用组件，可在 Settings 等页面引入。当前暂无页面引用，保留备用。
 */
"use client";

import { useState, useEffect } from "react";
import apiClient from "@/lib/api";
import type { SchedulerBatchesResponse, BatchStatus } from "@/types/api";
import { Clock, CheckCircle2, XCircle, Calendar, Loader2 } from "lucide-react";

// 批次配置映射
const BATCH_CONFIG: Record<string, { label: string; color: string; icon: string }> = {
  daily: { label: "Daily", color: "#06b6d4", icon: "D" },
  weekly: { label: "Weekly", color: "#10b981", icon: "W" },
  monthly: { label: "Monthly", color: "#a855f7", icon: "M" },
  event: { label: "Event", color: "#f59e0b", icon: "E" },
};

// 解析 cron 表达式为人类可读的调度说明
function describeCron(cron: string | null, tz: string | null): string {
  if (!cron) return "Manual trigger";
  const parts = cron.split(" ");
  if (parts.length < 5) return cron;

  const [min = "0", hour = "0", dom = "*", , dow = "*"] = parts;
  const tzLabel = tz === "America/New_York" ? "ET" : tz === "Asia/Shanghai" ? "CST" : tz || "";

  const time = `${hour}:${min.padStart(2, "0")} ${tzLabel}`;
  const dayNames: Record<string, string> = {
    "0": "Sunday", "1": "Monday", "2": "Tuesday", "3": "Wednesday",
    "4": "Thursday", "5": "Friday", "6": "Saturday", "7": "Sunday",
  };

  // 日频 (Mon-Fri)
  if (dow === "1-5") return `Weekdays ${time}`;
  // 特定星期
  if (dayNames[dow]) return `${dayNames[dow]} ${time}`;
  // 月频
  if (dom !== "*") return `${dom}th of month ${time}`;

  return time;
}

function formatTimestamp(ts: string): string {
  try {
    const d = new Date(ts);
    return d.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: "Asia/Shanghai",
    });
  } catch {
    return ts;
  }
}

export function ScheduleStatus() {
  const [data, setData] = useState<SchedulerBatchesResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiClient.getSchedulerBatches()
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="rounded-[14px] p-6 bg-[var(--bg-card)] border border-[var(--border-subtle)]">
        <div className="flex items-center gap-2 text-zinc-500">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span className="text-sm">Loading schedule...</span>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const batches = Object.entries(data.batches);
  const freshness = data.freshness_summary;

  return (
    <div className="space-y-4">
      {/* 批次状态网格 */}
      <div className="grid grid-cols-4 gap-3">
        {batches.map(([name, batch]) => {
          const cfg = BATCH_CONFIG[name] || { label: name, color: "#6b7280", icon: "?" };
          const lastRun = batch.last_run;
          const schedule = describeCron(batch.config.cron, batch.config.timezone);
          const groups = batch.config.indicator_groups;

          return (
            <div
              key={name}
              className="relative rounded-[14px] p-4 overflow-hidden bg-[var(--bg-card)] border border-[var(--border-subtle)]"
            >
              {/* 顶部状态指示 */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span
                    className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold text-white"
                    style={{ backgroundColor: cfg.color }}
                  >
                    {cfg.icon}
                  </span>
                  <span className="text-sm font-medium text-zinc-200">{cfg.label}</span>
                </div>
                {lastRun ? (
                  lastRun.success ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  ) : (
                    <XCircle className="w-4 h-4 text-red-400" />
                  )
                ) : (
                  <Clock className="w-4 h-4 text-zinc-600" />
                )}
              </div>

              {/* 调度时间 */}
              <div className="text-[11px] text-zinc-500 mb-2 flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                {schedule}
              </div>

              {/* 上次运行 */}
              {lastRun ? (
                <div className="text-[11px] space-y-0.5">
                  <div className="text-zinc-400">
                    Last: {formatTimestamp(lastRun.started_at)}
                  </div>
                  <div className="text-zinc-500">
                    {lastRun.indicators_fetched} indicators, {lastRun.duration_ms}ms
                  </div>
                  {lastRun.model_triggered && (
                    <div className="text-emerald-400/80">Model triggered</div>
                  )}
                  {lastRun.error && (
                    <div className="text-red-400/80 truncate" title={lastRun.error}>
                      {lastRun.error}
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-[11px] text-zinc-600">Not yet run</div>
              )}

              {/* 数据组 */}
              {groups.length > 0 && (
                <div className="mt-2 pt-2 border-t border-zinc-800/50">
                  <div className="flex flex-wrap gap-1">
                    {groups.map((g) => (
                      <span
                        key={g}
                        className="px-1.5 py-0.5 rounded text-[9px] bg-zinc-800/80 text-zinc-400"
                      >
                        {g.replace(/_/g, " ")}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* 数据新鲜度汇总 */}
      {freshness.total > 0 && (
        <div className="flex items-center gap-4 px-2 text-[11px] text-zinc-500">
          <span>Data Freshness:</span>
          <span className="text-emerald-400">{freshness.fresh} fresh</span>
          <span className="text-amber-400">{freshness.stale} stale</span>
          {freshness.error > 0 && (
            <span className="text-red-400">{freshness.error} error</span>
          )}
        </div>
      )}
    </div>
  );
}
