/**
 * [INPUT]: 页面加载时自动请求 /api/model/history，用户可选择查看详情或运行新模型。
 * [OUTPUT]: (JSX) - 运行历史页面，含历史记录列表、触发规则表格、告警信息列表、运行元数据摘要。
 * [POS]: 历史路由 (/history)。从数据库获取历史记录，展示 ModelOutput 中的 triggered_rules 和 alerts。
 *
 * [PROTOCOL]:
 * 1. 一旦本文件逻辑变更，必须同步更新此 Header。
 * 2. 更新后必须上浮检查 /src/app/history/.folder.md 的描述是否依然准确。
 */
"use client";

import { useState, useCallback, useEffect } from "react";
import { Header } from "@/components/Header";
import apiClient from "@/lib/api";
import { cn } from "@/lib/utils";
import type { ModelOutput, HistoryRecord } from "@/types/api";
import { History, Search, AlertTriangle, BarChart3, Clock, ChevronRight, RefreshCw } from "lucide-react";

export default function HistoryPage() {
  const [isRunning, setIsRunning] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [historyRecords, setHistoryRecords] = useState<HistoryRecord[]>([]);
  const [selectedRecord, setSelectedRecord] = useState<HistoryRecord | null>(null);
  const [modelOutput, setModelOutput] = useState<ModelOutput | null>(null);

  // 加载历史记录
  const loadHistory = useCallback(async () => {
    setIsLoadingHistory(true);
    try {
      const response = await apiClient.getHistory(30);
      setHistoryRecords(response.records);
    } catch (error) {
      console.error("Failed to load history:", error);
    } finally {
      setIsLoadingHistory(false);
    }
  }, []);

  // 页面加载时获取历史记录
  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  // 加载特定记录的详情
  const loadRecordDetail = useCallback(async (record: HistoryRecord) => {
    setSelectedRecord(record);
    setIsLoadingDetail(true);
    try {
      const output = await apiClient.getOutputById(record.run_id);
      setModelOutput(output);
    } catch (error) {
      console.error("Failed to load record detail:", error);
      setModelOutput(null);
    } finally {
      setIsLoadingDetail(false);
    }
  }, []);

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

  // 格式化时间
  const formatTime = (ts: string) => {
    const date = new Date(ts);
    return date.toLocaleString("zh-CN", {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

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
          {/* 左侧：历史记录列表 */}
          <div className="col-span-4">
            <div className="relative rounded-2xl overflow-hidden bg-gradient-to-br from-zinc-900/80 to-zinc-950/80 border border-zinc-800/50 backdrop-blur-xl">
              <div className="absolute top-0 left-0 right-0 h-0.5 opacity-50 bg-gradient-to-r from-transparent via-amber-500 to-transparent" />

              <div className="p-4 border-b border-zinc-800/50 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-amber-400" />
                  <span className="text-sm font-medium text-zinc-200">历史记录</span>
                  <span className="text-xs text-zinc-500">({historyRecords.length})</span>
                </div>
                <button
                  onClick={loadHistory}
                  disabled={isLoadingHistory}
                  className="p-1.5 rounded-lg hover:bg-zinc-800/50 transition-colors disabled:opacity-50"
                >
                  <RefreshCw className={cn("w-4 h-4 text-zinc-400", isLoadingHistory && "animate-spin")} />
                </button>
              </div>

              <div className="max-h-[600px] overflow-y-auto">
                {isLoadingHistory ? (
                  <div className="p-8 text-center text-zinc-500">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2" />
                    加载中...
                  </div>
                ) : historyRecords.length === 0 ? (
                  <div className="p-8 text-center text-zinc-500">
                    暂无历史记录
                  </div>
                ) : (
                  <div className="divide-y divide-zinc-800/30">
                    {historyRecords.map((record) => (
                      <button
                        key={record.run_id}
                        onClick={() => loadRecordDetail(record)}
                        className={cn(
                          "w-full p-4 text-left transition-colors hover:bg-zinc-800/30",
                          selectedRecord?.run_id === record.run_id && "bg-zinc-800/50"
                        )}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-mono text-zinc-500">
                            {record.run_id.slice(0, 8)}...
                          </span>
                          <span className={cn(
                            "text-xs px-2 py-0.5 rounded-full border",
                            getRiskLightStyle(record.risk_light)
                          )}>
                            {record.risk_light || "N/A"}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="text-sm text-zinc-200">{formatTime(record.run_ts)}</div>
                            <div className="text-xs text-zinc-500 mt-1">
                              {record.model_type} · {record.execution_time_ms}ms
                            </div>
                          </div>
                          <ChevronRight className="w-4 h-4 text-zinc-600" />
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* 右侧：详情展示 */}
          <div className="col-span-8">
            {isLoadingDetail ? (
              <div className="flex flex-col items-center justify-center py-24">
                <RefreshCw className="w-8 h-8 text-amber-400 animate-spin mb-4" />
                <p className="text-zinc-500">加载详情...</p>
              </div>
            ) : !modelOutput ? (
              <div className="flex flex-col items-center justify-center py-24">
                <div className="relative mb-6">
                  <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-amber-500/20 to-orange-600/20 flex items-center justify-center border border-amber-500/20">
                    <History className="w-12 h-12 text-amber-400 animate-float" />
                  </div>
                  <div className="absolute inset-0 rounded-2xl bg-amber-500/10 blur-xl" />
                </div>
                <h2 className="text-xl font-semibold text-zinc-200 mb-2">
                  {historyRecords.length > 0 ? "选择一条记录查看详情" : "暂无数据"}
                </h2>
                <p className="text-zinc-500 text-sm">
                  {historyRecords.length > 0
                    ? "点击左侧列表中的记录"
                    : "点击「运行模型」按钮生成数据"}
                </p>
              </div>
            ) : (
              <>
                {/* 触发规则 */}
                <div className="mb-8">
                  <h2 className="section-title">
                    <Search className="w-5 h-5 text-cyan-400" />
                    {selectedRecord ? "触发的规则" : "本次触发的规则"}
                  </h2>

                  {Object.keys(modelOutput.triggered_rules).length > 0 ? (
                    <div className="relative rounded-2xl overflow-hidden bg-gradient-to-br from-zinc-900/80 to-zinc-950/80 border border-zinc-800/50 backdrop-blur-xl">
                      <div className="absolute top-0 left-0 right-0 h-0.5 opacity-50 bg-gradient-to-r from-transparent via-cyan-500 to-transparent" />
                      <table className="w-full">
                        <thead>
                          <tr className="border-b border-zinc-800/50">
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
                            ([name, data]: [string, any], i) => (
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
                                  {String(data?.condition || "").slice(0, 60)}
                                </td>
                                <td className="py-4 px-5 text-sm text-zinc-400">
                                  {String(data?.result || "").slice(0, 40)}
                                </td>
                              </tr>
                            )
                          )}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="relative rounded-2xl p-8 text-center bg-gradient-to-br from-zinc-900/80 to-zinc-950/80 border border-zinc-800/50 backdrop-blur-xl text-zinc-500">
                      <div className="absolute top-0 left-0 right-0 h-0.5 opacity-50 bg-gradient-to-r from-transparent via-zinc-600 to-transparent" />
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
                            "relative rounded-xl p-4 overflow-hidden backdrop-blur-xl",
                            alert.level === "CRITICAL"
                              ? "bg-red-500/10 border border-red-500/30"
                              : "bg-amber-500/10 border border-amber-500/30"
                          )}
                        >
                          <div
                            className={cn(
                              "absolute top-0 left-0 right-0 h-0.5 opacity-50",
                              alert.level === "CRITICAL"
                                ? "bg-gradient-to-r from-transparent via-red-500 to-transparent"
                                : "bg-gradient-to-r from-transparent via-amber-500 to-transparent"
                            )}
                          />
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
                    <div className="relative rounded-2xl p-8 text-center bg-gradient-to-br from-zinc-900/80 to-zinc-950/80 border border-emerald-500/20 backdrop-blur-xl text-emerald-400">
                      <div className="absolute top-0 left-0 right-0 h-0.5 opacity-50 bg-gradient-to-r from-transparent via-emerald-500 to-transparent" />
                      暂无告警
                    </div>
                  )}
                </div>

                <div className="divider" />

                {/* 运行信息 */}
                <div className="mb-8">
                  <h2 className="section-title">
                    <BarChart3 className="w-5 h-5 text-cyan-400" />
                    运行信息
                  </h2>
                  <div className="relative rounded-2xl p-5 overflow-hidden bg-gradient-to-br from-zinc-900/80 to-zinc-950/80 border border-zinc-800/50 backdrop-blur-xl">
                    <div className="absolute top-0 left-0 right-0 h-0.5 opacity-50 bg-gradient-to-r from-transparent via-cyan-500 to-transparent" />
                    <div className="grid grid-cols-4 gap-6">
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
                          className="text-sm text-cyan-400 mt-2 font-medium"
                          style={{ textShadow: "0 0 10px rgba(6, 182, 212, 0.5)" }}
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
      </div>
    </div>
  );
}
