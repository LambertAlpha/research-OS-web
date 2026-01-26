"use client";

import { useState } from "react";
import { RefreshCw, Calendar, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

interface HeaderProps {
  onRunModel: (date?: string) => Promise<void>;
  isLoading?: boolean;
  lastUpdate?: string;
}

export function Header({ onRunModel, isLoading, lastUpdate }: HeaderProps) {
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);

  const handleRun = () => {
    onRunModel(date);
  };

  return (
    <header className="sticky top-0 z-10 bg-[#050508]/80 backdrop-blur-xl border-b border-cyan-500/10">
      {/* 顶部渐变线 */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-cyan-500/30 to-transparent" />

      <div className="px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-zinc-100 flex items-center gap-2">
              <Zap className="w-4 h-4 text-cyan-400" />
              Dashboard
            </h2>
            {lastUpdate && (
              <p className="text-xs text-zinc-500 mt-0.5">
                最后更新:{" "}
                <span className="text-zinc-400">
                  {new Date(lastUpdate).toLocaleString("zh-CN")}
                </span>
              </p>
            )}
          </div>

          <div className="flex items-center gap-4">
            {/* 日期选择器 */}
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-zinc-900/50 border border-zinc-800/50 backdrop-blur-sm">
              <Calendar className="w-4 h-4 text-cyan-400/70" />
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                max={new Date().toISOString().split("T")[0]}
                className="bg-transparent border-none text-sm text-zinc-300 focus:outline-none w-32 [color-scheme:dark]"
              />
            </div>

            {/* 运行按钮 */}
            <button
              onClick={handleRun}
              disabled={isLoading}
              className={cn(
                "group relative flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium text-sm transition-all duration-300 overflow-hidden",
                "bg-gradient-to-r from-cyan-500 to-blue-600 text-white",
                "hover:shadow-lg hover:shadow-cyan-500/25",
                "disabled:opacity-50 disabled:cursor-not-allowed"
              )}
            >
              {/* 光效动画 */}
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />

              <RefreshCw
                className={cn(
                  "w-4 h-4 relative z-10",
                  isLoading && "animate-spin"
                )}
              />
              <span className="relative z-10">
                {isLoading ? "运行中..." : "运行模型"}
              </span>

              {/* 边框辉光 */}
              {!isLoading && (
                <div className="absolute inset-0 rounded-xl border border-cyan-400/50 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              )}
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
