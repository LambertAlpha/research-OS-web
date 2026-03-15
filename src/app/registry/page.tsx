/**
 * [INPUT]: 页面加载时自动请求 /api/model/registry，展示所有模型版本。
 * [OUTPUT]: (JSX) - 模型注册表页面，表格展示所有模型版本的状态、类型、生产标识。
 * [POS]: 路由 (/registry)。从数据库获取 model_version 表数据并展示。
 *
 * [PROTOCOL]:
 * 1. 一旦本文件逻辑变更，必须同步更新此 Header。
 * 2. 更新后必须上浮检查 /src/app/registry/.folder.md 的描述是否依然准确。
 */
"use client";

import { useState, useEffect } from "react";
import { Header } from "@/components/Header";
import apiClient from "@/lib/api";
import { cn, formatDateTime } from "@/lib/utils";
import type { ModelVersionRecord } from "@/types/api";
import { Database, RefreshCw } from "lucide-react";

/** 模型类型对应的颜色主题 */
const MODEL_TYPE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  Liquidity: { bg: "bg-cyan-500/10", text: "text-cyan-400", border: "border-cyan-500/30" },
  Macro: { bg: "bg-amber-500/10", text: "text-amber-400", border: "border-amber-500/30" },
  Equity: { bg: "bg-emerald-500/10", text: "text-emerald-400", border: "border-emerald-500/30" },
  Combined: { bg: "bg-violet-500/10", text: "text-violet-400", border: "border-violet-500/30" },
};

/** 状态对应的颜色 */
function getStatusStyle(status: string) {
  switch (status.toUpperCase()) {
    case "ACTIVE":
      return "bg-emerald-500/20 text-emerald-400 border-emerald-500/30";
    case "DEPRECATED":
      return "bg-amber-500/20 text-amber-400 border-amber-500/30";
    case "RETIRED":
      return "bg-red-500/20 text-red-400 border-red-500/30";
    case "DRAFT":
      return "bg-zinc-500/20 text-zinc-400 border-zinc-500/30";
    default:
      return "bg-zinc-500/20 text-zinc-400 border-zinc-500/30";
  }
}

export default function RegistryPage() {
  const [models, setModels] = useState<ModelVersionRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      setIsLoading(true);
      try {
        const response = await apiClient.getModelRegistry();
        setModels(response.models);
      } catch (err) {
        console.error("Failed to load model registry:", err);
        setError(err instanceof Error ? err.message : "Failed to load data");
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
  }, []);

  return (
    <div className="min-h-screen">
      <Header />

      <div className="p-6">
        {/* 页面标题 */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-1">
            <div className="p-2 rounded-lg bg-violet-500/10">
              <Database className="w-5 h-5 text-violet-400" />
            </div>
            <h1 className="text-2xl font-bold text-zinc-100">Model Registry</h1>
          </div>
          <p className="text-zinc-500 text-sm ml-12">
            模型版本注册表
          </p>
        </div>

        {/* 内容区域 */}
        {isLoading ? (
          <div className="relative rounded-2xl overflow-hidden bg-gradient-to-br from-zinc-900/80 to-zinc-950/80 border border-zinc-800/50 backdrop-blur-xl p-16 text-center text-zinc-500">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2" />
            加载中...
          </div>
        ) : error ? (
          <div className="relative rounded-2xl overflow-hidden bg-gradient-to-br from-zinc-900/80 to-zinc-950/80 border border-red-500/30 backdrop-blur-xl p-16 text-center text-red-400">
            {error}
          </div>
        ) : (
          <div className="relative rounded-2xl overflow-hidden bg-gradient-to-br from-zinc-900/80 to-zinc-950/80 border border-zinc-800/50 backdrop-blur-xl">
            <div className="absolute top-0 left-0 right-0 h-0.5 opacity-50 bg-gradient-to-r from-transparent via-violet-500 to-transparent" />
            <table className="w-full">
              <thead>
                <tr className="border-b border-zinc-800/50">
                  <th className="text-left py-4 px-5 text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                    模型类型
                  </th>
                  <th className="text-left py-4 px-5 text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                    版本号
                  </th>
                  <th className="text-left py-4 px-5 text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                    状态
                  </th>
                  <th className="text-left py-4 px-5 text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                    生产版本
                  </th>
                  <th className="text-left py-4 px-5 text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                    注册时间
                  </th>
                  <th className="text-left py-4 px-5 text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                    发布说明
                  </th>
                </tr>
              </thead>
              <tbody>
                {models.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-16 text-center text-zinc-500">
                      暂无模型版本记录
                    </td>
                  </tr>
                ) : (
                  models.map((model, i) => {
                    const typeColor = MODEL_TYPE_COLORS[model.model_type] ?? { bg: "bg-violet-500/10", text: "text-violet-400", border: "border-violet-500/30" };
                    return (
                      <tr
                        key={`${model.version_code}-${i}`}
                        className={cn(
                          "border-b border-zinc-800/30 transition-colors duration-200 hover:bg-zinc-800/20",
                          i % 2 === 0 ? "bg-zinc-900/30" : ""
                        )}
                      >
                        <td className="py-4 px-5">
                          <span
                            className={cn(
                              "inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium border",
                              typeColor.bg,
                              typeColor.text,
                              typeColor.border
                            )}
                          >
                            {model.model_type}
                          </span>
                        </td>
                        <td className="py-4 px-5 text-sm text-zinc-100 font-mono font-medium">
                          {model.version_code}
                        </td>
                        <td className="py-4 px-5">
                          <span
                            className={cn(
                              "inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium border",
                              getStatusStyle(model.status)
                            )}
                          >
                            {model.status}
                          </span>
                        </td>
                        <td className="py-4 px-5">
                          {model.is_production ? (
                            <div className="flex items-center gap-2">
                              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-lg shadow-emerald-500/50 animate-pulse" />
                              <span className="text-xs text-emerald-400 font-medium">
                                Production
                              </span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              <span className="w-2.5 h-2.5 rounded-full bg-zinc-600" />
                              <span className="text-xs text-zinc-500">-</span>
                            </div>
                          )}
                        </td>
                        <td className="py-4 px-5 text-sm text-zinc-400">
                          {model.created_at ? formatDateTime(model.created_at) : "-"}
                        </td>
                        <td className="py-4 px-5 text-sm text-zinc-500 max-w-xs truncate">
                          {model.release_notes || "-"}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
