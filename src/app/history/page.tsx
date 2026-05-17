/**
 * [INPUT]: 页面加载时自动请求 /api/model/history（180天）和 /api/alerts/history，用户通过日历热力图选择日期查看详情。
 * [OUTPUT]: (JSX) - 运行历史页面，上半部分：左侧日历热力图（按 risk_light 着色），右侧触发规则表格、告警信息列表、运行元数据摘要。下半部分：告警历史时间线。
 * [POS]: 历史路由 (/history)。从数据库获取历史记录，展示 ModelOutput 中的 triggered_rules 和 alerts，以及 alert_history 表的告警记录。
 *
 * [PROTOCOL]:
 * 1. 一旦本文件逻辑变更，必须同步更新此 Header。
 * 2. 更新后必须上浮检查 /src/app/history/.folder.md 的描述是否依然准确。
 */
"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import { Header } from "@/components/Header";
import { CalendarHeatmap } from "@/components/CalendarHeatmap";
import apiClient from "@/lib/api";
import { cn, formatDate, formatDateTime } from "@/lib/utils";
import type { ModelOutput, HistoryRecord, AlertRecord } from "@/types/api";
import { History, Search, AlertTriangle, BarChart3, RefreshCw, Bell } from "lucide-react";

// P1-4：告警状态机展示样式（NEW/ONGOING/ESCALATED/RESOLVED）
const ALERT_STATE_STYLE: Record<string, { label: string; cls: string }> = {
  NEW: { label: "新", cls: "bg-blue-500/20 text-blue-400 border-blue-500/30" },
  ONGOING: { label: "持续", cls: "bg-amber-500/20 text-amber-400 border-amber-500/30" },
  ESCALATED: { label: "升级", cls: "bg-red-500/20 text-red-400 border-red-500/30" },
  RESOLVED: { label: "已解除", cls: "bg-zinc-600/20 text-zinc-500 border-zinc-600/30" },
};

// 告警状态徽章（旧 schema 无 alert_state 时不渲染）
function AlertStateBadge({ state }: { state?: string }) {
  if (!state) return null;
  const style = ALERT_STATE_STYLE[state];
  if (!style) return null;
  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border",
        style.cls
      )}
    >
      {style.label}
    </span>
  );
}

export default function HistoryPage() {
  const [isRunning, setIsRunning] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [historyRecords, setHistoryRecords] = useState<HistoryRecord[]>([]);
  const [selectedRecord, setSelectedRecord] = useState<HistoryRecord | null>(null);
  const [modelOutput, setModelOutput] = useState<ModelOutput | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | undefined>();
  const [alertHistory, setAlertHistory] = useState<AlertRecord[]>([]);
  const [isLoadingAlerts, setIsLoadingAlerts] = useState(true);

  // 从历史记录中提取可用日期
  const availableDates = useMemo(
    () => [...new Set(historyRecords.map((r) => r.data_ts?.split("T")[0]).filter((d): d is string => !!d))],
    [historyRecords]
  );

  // 日期选择回调
  const handleDateSelect = useCallback(
    async (date: string) => {
      setSelectedDate(date);

      const record = historyRecords.find(
        (r) => r.data_ts.split("T")[0] === date
      );
      if (!record) {
        setSelectedRecord(null);
        setModelOutput(null);
        return; // 无历史数据，仅切换日期
      }

      setSelectedRecord(record);
      setIsLoadingDetail(true);
      try {
        const output = await apiClient.getOutputById(record.run_id);
        setModelOutput(output);
      } catch (error) {
        console.error("Failed to load output for date:", error);
        setModelOutput(null);
      } finally {
        setIsLoadingDetail(false);
      }
    },
    [historyRecords]
  );

  // 加载历史记录
  const loadHistory = useCallback(async () => {
    setIsLoadingHistory(true);
    try {
      const response = await apiClient.getHistory(180);
      setHistoryRecords(response.records);
    } catch (error) {
      console.error("Failed to load history:", error);
    } finally {
      setIsLoadingHistory(false);
    }
  }, []);

  // 加载告警历史
  const loadAlertHistory = useCallback(async () => {
    setIsLoadingAlerts(true);
    try {
      const response = await apiClient.getAlertHistory();
      setAlertHistory(response.alerts);
    } catch (error) {
      console.error("Failed to load alert history:", error);
    } finally {
      setIsLoadingAlerts(false);
    }
  }, []);

  // 页面加载时获取历史记录和告警历史
  useEffect(() => {
    loadHistory();
    loadAlertHistory();
  }, [loadHistory, loadAlertHistory]);

  const handleRunModel = useCallback(async (date?: string) => {
    setIsRunning(true);
    try {
      const output = await apiClient.runModel(date);
      setModelOutput(output);
      setSelectedRecord(null);
      // 运行后刷新历史记录
      await loadHistory();
    } catch (error) {
      console.error("Failed to run model:", error);
    } finally {
      setIsRunning(false);
    }
  }, [loadHistory]);



  // 获取风险灯颜色样式
  const getRiskLightStyle = (light?: string | null) => {
    switch (light) {
      case "green":
        return "bg-emerald-500/20 text-emerald-400 border-emerald-500/30";
      case "yellow":
        return "bg-amber-500/20 text-amber-400 border-amber-500/30";
      case "red":
        return "bg-red-500/20 text-red-400 border-red-500/30";
      default:
        return "bg-zinc-500/20 text-zinc-400 border-zinc-500/30";
    }
  };

  return (
    <div className="min-h-screen">
      <Header
        onRunModel={handleRunModel}
        isLoading={isRunning}
        lastUpdate={modelOutput?.run_ts}
        availableDates={availableDates}
        onDateSelect={handleDateSelect}
        selectedDate={selectedDate}
      />

      <div className="p-6">
        {/* 页面标题 */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-1">
            <div className="p-2 rounded-lg bg-amber-500/10">
              <History className="w-5 h-5 text-amber-400" />
            </div>
            <h1 className="text-2xl font-bold text-zinc-100">运行历史</h1>
          </div>
          <p className="text-zinc-500 text-sm ml-12">
            模型触发规则与告警记录
          </p>
        </div>

        <div className="grid grid-cols-12 gap-6">
          {/* 左侧：日历热力图 */}
          <div className="col-span-12 lg:col-span-5">
            {isLoadingHistory ? (
              <div className="relative rounded-[14px] overflow-hidden bg-[var(--bg-card)] border border-[var(--border-subtle)] p-8 text-center text-zinc-500">
                <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2" />
                加载中...
              </div>
            ) : (
              <CalendarHeatmap
                records={historyRecords}
                selectedDate={selectedDate}
                onDateSelect={handleDateSelect}
              />
            )}
          </div>

          {/* 右侧：详情展示 */}
          <div className="col-span-12 lg:col-span-7">
            {isLoadingDetail ? (
              <div className="flex flex-col items-center justify-center py-24">
                <RefreshCw className="w-8 h-8 text-amber-400 animate-spin mb-4" />
                <p className="text-zinc-500">加载详情...</p>
              </div>
            ) : !modelOutput ? (
              <div className="flex flex-col items-center justify-center py-24">
                <div className="relative mb-6">
                  <div className="w-24 h-24 rounded-[14px] bg-amber-500/10 flex items-center justify-center border border-amber-500/20">
                    <History className="w-12 h-12 text-amber-400" />
                  </div>
                </div>
                <h2 className="text-xl font-semibold text-zinc-200 mb-2">
                  {historyRecords.length > 0 ? "选择日期查看详情" : "暂无数据"}
                </h2>
                <p className="text-zinc-500 text-sm">
                  {historyRecords.length > 0
                    ? "点击日历中有色日期查看详情"
                    : "点击「运行模型」按钮生成数据"}
                </p>
              </div>
            ) : (
              <>
                {/* 触发规则 */}
                <div className="mb-8">
                  <h2 className="section-title">
                    <Search className="w-5 h-5 text-zinc-400" />
                    {selectedRecord ? "触发的规则" : "本次触发的规则"}
                  </h2>

                  {Object.keys(modelOutput.triggered_rules).length > 0 ? (
                    <div className="relative rounded-[14px] overflow-hidden bg-[var(--bg-card)] border border-[var(--border-subtle)]">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b border-[var(--border-subtle)]">
                            <th className="text-left py-4 px-5 text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                              规则名称
                            </th>
                            <th className="text-left py-4 px-5 text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                              触发条件
                            </th>
                            <th className="text-left py-4 px-5 text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                              执行结果
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {Object.entries(modelOutput.triggered_rules).map(
                            ([name, data]: [string, unknown], i) => (
                              <tr
                                key={name}
                                className={cn(
                                  "border-b border-zinc-800/30 transition-colors duration-200 hover:bg-zinc-800/20",
                                  i % 2 === 0 ? "bg-zinc-900/30" : ""
                                )}
                              >
                                <td className="py-4 px-5 text-sm text-zinc-200 font-medium">
                                  {name}
                                </td>
                                <td className="py-4 px-5 text-sm text-zinc-400">
                                  {String((data as Record<string, unknown>)?.condition || "").slice(0, 60)}
                                </td>
                                <td className="py-4 px-5 text-sm text-zinc-400">
                                  {String((data as Record<string, unknown>)?.result || "").slice(0, 40)}
                                </td>
                              </tr>
                            )
                          )}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="relative rounded-[14px] p-8 text-center bg-[var(--bg-card)] border border-[var(--border-subtle)] text-zinc-500">
                      暂无触发的规则
                    </div>
                  )}
                </div>

                <div className="divider" />

                {/* 告警信息 */}
                <div className="mb-8">
                  <h2 className="section-title">
                    <AlertTriangle className="w-5 h-5 text-amber-400" />
                    告警信息
                  </h2>

                  {modelOutput.alerts.length > 0 ? (
                    <div className="space-y-3">
                      {modelOutput.alerts.map((alert, i) => (
                        <div
                          key={i}
                          className={cn(
                            "relative rounded-[14px] p-4 overflow-hidden",
                            alert.level === "CRITICAL"
                              ? "bg-red-500/10 border border-red-500/30"
                              : "bg-amber-500/10 border border-amber-500/30"
                          )}
                        >
                          <div
                            className={cn(
                              "font-semibold text-sm flex items-center gap-2",
                              alert.level === "CRITICAL"
                                ? "text-red-400"
                                : "text-amber-400"
                            )}
                          >
                            <span
                              className={cn(
                                "w-2 h-2 rounded-full animate-pulse",
                                alert.level === "CRITICAL"
                                  ? "bg-red-500"
                                  : "bg-amber-500"
                              )}
                            />
                            [{alert.type}]
                          </div>
                          <div className="text-zinc-300 text-sm mt-2">
                            {alert.message}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="relative rounded-[14px] p-8 text-center bg-[var(--bg-card)] border border-emerald-500/20 text-emerald-400">
                      暂无告警
                    </div>
                  )}
                </div>

                <div className="divider" />

                {/* 运行信息 */}
                <div className="mb-8">
                  <h2 className="section-title">
                    <BarChart3 className="w-5 h-5 text-zinc-400" />
                    运行信息
                  </h2>
                  <div className="relative rounded-[14px] p-5 overflow-hidden bg-[var(--bg-card)] border border-[var(--border-subtle)]">
                    <div className="grid grid-cols-5 gap-6">
                      <div>
                        <div className="text-xs text-zinc-500 uppercase tracking-wider font-semibold">
                          数据日期
                        </div>
                        <div className="text-sm text-zinc-100 mt-2 font-medium">
                          {modelOutput.data_ts ? formatDate(modelOutput.data_ts) : "N/A"}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-zinc-500 uppercase tracking-wider font-semibold">
                          Run ID
                        </div>
                        <div className="text-sm text-zinc-300 font-mono mt-2">
                          {modelOutput.run_id.slice(0, 8)}...
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-zinc-500 uppercase tracking-wider font-semibold">
                          模型版本
                        </div>
                        <div className="text-sm text-zinc-300 mt-2">
                          {modelOutput.model_version}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-zinc-500 uppercase tracking-wider font-semibold">
                          执行时间
                        </div>
                        <div
                          className="text-sm text-zinc-400 mt-2 font-medium"
                        >
                          {modelOutput.execution_time_ms}ms
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-zinc-500 uppercase tracking-wider font-semibold">
                          状态
                        </div>
                        <div className="mt-2">
                          <span
                            className={cn(
                              "badge",
                              modelOutput.status === "SUCCESS"
                                ? "badge-success"
                                : "badge-danger"
                            )}
                          >
                            {modelOutput.status}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* 告警历史区域 */}
        <div className="mt-8">
          <h2 className="section-title">
            <Bell className="w-5 h-5 text-amber-400" />
            告警历史
          </h2>

          {isLoadingAlerts ? (
            <div className="relative rounded-[14px] overflow-hidden bg-[var(--bg-card)] border border-[var(--border-subtle)] p-8 text-center text-zinc-500">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2" />
              加载告警历史...
            </div>
          ) : alertHistory.length === 0 ? (
            <div className="relative rounded-[14px] p-8 text-center bg-[var(--bg-card)] border border-emerald-500/20 text-emerald-400">
              暂无告警记录
            </div>
          ) : (
            <div className="relative rounded-[14px] overflow-hidden bg-[var(--bg-card)] border border-[var(--border-subtle)]">
              <div className="divide-y divide-zinc-800/30">
                {alertHistory.map((alert) => (
                  <div
                    key={alert.alert_id}
                    className={cn(
                      "flex items-start gap-4 px-5 py-4 transition-colors duration-200",
                      alert.alert_level === "CRITICAL"
                        ? "bg-red-500/5 hover:bg-red-500/10"
                        : alert.alert_level === "WARNING"
                          ? "bg-amber-500/5 hover:bg-amber-500/10"
                          : "hover:bg-[var(--bg-card-hover)]",
                      alert.alert_state === "RESOLVED" && "opacity-50"
                    )}
                  >
                    {/* 时间线指示器 */}
                    <div className="flex flex-col items-center pt-1">
                      <span
                        className={cn(
                          "w-3 h-3 rounded-full shrink-0",
                          alert.alert_level === "CRITICAL"
                            ? "bg-red-500"
                            : alert.alert_level === "WARNING"
                              ? "bg-amber-500"
                              : "bg-zinc-400"
                        )}
                      />
                      <div className="w-px h-full bg-[var(--border-subtle)] mt-1" />
                    </div>

                    {/* 告警内容 */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-1">
                        <span
                          className={cn(
                            "inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold border",
                            alert.alert_level === "CRITICAL"
                              ? "bg-red-500/20 text-red-400 border-red-500/30"
                              : alert.alert_level === "WARNING"
                                ? "bg-amber-500/20 text-amber-400 border-amber-500/30"
                                : "bg-zinc-500/20 text-zinc-400 border-zinc-500/30"
                          )}
                        >
                          {alert.alert_level}
                        </span>
                        <span className="text-xs text-zinc-500 font-mono">
                          [{alert.alert_type}]
                        </span>
                        <AlertStateBadge state={alert.alert_state} />
                        {alert.occurrence_count != null && alert.occurrence_count > 1 && (
                          <span
                            className="text-xs text-zinc-500 font-mono"
                            title="60 分钟去重窗口内合并的重复次数"
                          >
                            × {alert.occurrence_count}
                          </span>
                        )}
                        <span className="text-xs text-zinc-600 ml-auto shrink-0">
                          {alert.alert_ts ? formatDateTime(alert.alert_ts) : "-"}
                        </span>
                      </div>
                      <p className="text-sm text-zinc-300">
                        {alert.alert_message}
                      </p>
                      {alert.trigger_rule && (
                        <p className="text-xs text-zinc-500 mt-1">
                          触发规则: {alert.trigger_rule}
                        </p>
                      )}
                    </div>

                    {/* 确认状态 */}
                    <div className="shrink-0 pt-1">
                      {alert.acknowledged ? (
                        <span className="text-xs text-emerald-500">已确认</span>
                      ) : (
                        <span className="text-xs text-zinc-600">未确认</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
