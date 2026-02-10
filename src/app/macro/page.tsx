/**
 * [INPUT]: 页面加载时自动获取最新模型输出，用户可点击"运行模型"刷新。
 * [OUTPUT]: (JSX) - 宏观模型 v4.0 详情页，含宏观状态(A/B/C/D)、纠错系统、Layer1 利率结构、Layer2 叙事校验、Layer3 闸门矩阵、Layer4 执行矩阵、市场指标图表。
 * [POS]: 宏观路由 (/macro)。专注展示 MacroOutput 四层结构，获取 DXY/HY_OAS/IG_OAS/VIX/SPX/US10Y 六种市场数据。
 *
 * [PROTOCOL]:
 * 1. 一旦本文件逻辑变更，必须同步更新此 Header。
 * 2. 更新后必须上浮检查 /src/app/macro/.folder.md 的描述是否依然准确。
 */
"use client";

import { useState, useCallback, useEffect } from "react";
import { Header } from "@/components/Header";
import { GateCard } from "@/components/GateCard";
import { Chart } from "@/components/Chart";
import { Tooltip } from "@/components/Tooltip";
import apiClient from "@/lib/api";
import { cn, formatNumber } from "@/lib/utils";
import type { ModelOutput, RawDataPoint } from "@/types/api";
import {
  Globe,
  BarChart3,
  Target,
  TrendingUp,
  Shield,
  LineChart,
  Activity,
  AlertTriangle,
  ArrowUpDown,
  Layers,
  Zap,
  RefreshCw,
} from "lucide-react";

export default function MacroPage() {
  const [isRunning, setIsRunning] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [modelOutput, setModelOutput] = useState<ModelOutput | null>(null);
  const [marketData, setMarketData] = useState<Record<string, RawDataPoint[]>>({});

  // 页面加载时获取最新数据
  useEffect(() => {
    const loadLatest = async () => {
      try {
        const output = await apiClient.getLatestOutput();
        setModelOutput(output);
      } catch {
        // 没有历史数据，需要用户运行模型
        console.log("No latest output available");
      } finally {
        setIsLoading(false);
      }
    };
    loadLatest();
  }, []);

  const handleRunModel = useCallback(async (date?: string) => {
    setIsRunning(true);
    try {
      const output = await apiClient.runModel(date);
      setModelOutput(output);

      // 获取宏观相关数据
      const symbols = ["DXY", "HY_OAS", "IG_OAS", "VIX", "SPX", "US10Y"];
      const dataPromises = symbols.map(async (symbol) => {
        try {
          const data = await apiClient.getMarketData(symbol);
          return { symbol, data: data.data };
        } catch {
          return { symbol, data: [] };
        }
      });

      const results = await Promise.all(dataPromises);
      const newMarketData: Record<string, RawDataPoint[]> = {};
      results.forEach(({ symbol, data }) => {
        newMarketData[symbol] = data;
      });
      setMarketData(newMarketData);
    } catch (error) {
      console.error("Failed to run model:", error);
    } finally {
      setIsRunning(false);
    }
  }, []);

  // 从新的响应结构中获取宏观数据
  const macro = modelOutput?.macro;
  const exec = macro?.execution_matrix;
  const layer1 = macro?.layer1;
  const layer2 = macro?.layer2;
  const layer3 = macro?.layer3;
  const correction = macro?.correction;
  const macroState = macro?.macro_state;

  // 宏观状态颜色映射
  const getStateColor = (code: string) => {
    switch (code) {
      case "A":
        return "#10b981"; // 绿色 - 增长
      case "B":
        return "#f59e0b"; // 黄色 - 折现率冲击
      case "C":
        return "#ef4444"; // 红色 - 衰退
      case "D":
        return "#8b5cf6"; // 紫色 - 通胀
      default:
        return "#6b7280"; // 灰色 - 过渡
    }
  };

  // 纠错档位颜色
  const getCorrectionColor = (level: string) => {
    switch (level) {
      case "A":
        return "#f59e0b";
      case "B":
        return "#f97316";
      case "C":
        return "#ef4444";
      default:
        return "#10b981";
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
            <div className="p-2 rounded-lg bg-purple-500/10">
              <Globe className="w-5 h-5 text-purple-400" />
            </div>
            <h1 className="text-2xl font-bold text-zinc-100">宏观模型 v4.0</h1>
          </div>
          <p className="text-zinc-500 text-sm ml-12">
            多维度市场信号分析 - Layer1 利率结构 + Layer2 叙事校验 + Layer3 风险闸门 + Layer4 执行矩阵
          </p>
        </div>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-24">
            <RefreshCw className="w-8 h-8 text-purple-400 animate-spin mb-4" />
            <p className="text-zinc-500">加载最新数据...</p>
          </div>
        ) : !modelOutput ? (
          <div className="flex flex-col items-center justify-center py-24">
            <div className="relative mb-6">
              <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-purple-500/20 to-pink-600/20 flex items-center justify-center border border-purple-500/20">
                <Globe className="w-12 h-12 text-purple-400 animate-float" />
              </div>
              <div className="absolute inset-0 rounded-2xl bg-purple-500/10 blur-xl" />
            </div>
            <h2 className="text-xl font-semibold text-zinc-200 mb-2">
              暂无数据
            </h2>
            <p className="text-zinc-500 text-sm">
              点击「运行模型」按钮开始分析
            </p>
          </div>
        ) : macro ? (
          <>
            {/* 宏观状态 (A/B/C/D) */}
            {macroState && (
              <div className="mb-8">
                <div
                  className="relative rounded-2xl p-6 overflow-hidden backdrop-blur-xl"
                  style={{
                    background: `linear-gradient(135deg, ${getStateColor(macroState.code)}15, transparent)`,
                    borderColor: `${getStateColor(macroState.code)}40`,
                    borderWidth: 1,
                  }}
                >
                  <div
                    className="absolute top-0 left-0 right-0 h-1"
                    style={{ backgroundColor: getStateColor(macroState.code) }}
                  />
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs text-zinc-500 uppercase tracking-wider mb-1">
                        当前宏观状态
                      </div>
                      <div className="flex items-center gap-3">
                        <span
                          className="text-4xl font-bold"
                          style={{ color: getStateColor(macroState.code) }}
                        >
                          {macroState.code}
                        </span>
                        <span className="text-xl text-zinc-200">{macroState.name}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-zinc-500 mb-2">触发条件</div>
                      {Object.entries(macroState.conditions).map(([key, value]) => (
                        <div key={key} className="text-sm text-zinc-400">
                          <span className="text-zinc-500">{key}:</span> {value}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 纠错系统 */}
            {correction && correction.level !== "NONE" && (
              <div className="mb-8">
                <div
                  className="relative rounded-xl p-4 overflow-hidden backdrop-blur-xl"
                  style={{
                    background: `${getCorrectionColor(correction.level)}15`,
                    borderColor: `${getCorrectionColor(correction.level)}40`,
                    borderWidth: 1,
                  }}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle
                      className="w-5 h-5"
                      style={{ color: getCorrectionColor(correction.level) }}
                    />
                    <span
                      className="font-semibold"
                      style={{ color: getCorrectionColor(correction.level) }}
                    >
                      纠错档位: {correction.level}
                    </span>
                  </div>
                  <div className="text-zinc-300 text-sm mb-2">{correction.reason}</div>
                  <div className="text-zinc-400 text-sm">
                    <strong>建议动作:</strong> {correction.suggested_action}
                  </div>
                </div>
              </div>
            )}

            <div className="divider" />

            {/* Layer 1: 利率结构 */}
            {layer1 && (
              <div className="mb-8">
                <h2 className="section-title">
                  <Layers className="w-5 h-5 text-cyan-400" />
                  Layer 1: 利率结构
                </h2>
                <div className="grid grid-cols-4 gap-4">
                  {/* 政策路径 */}
                  <div className="group relative rounded-xl p-4 overflow-hidden bg-gradient-to-br from-zinc-900/80 to-zinc-950/80 border border-zinc-800/50 backdrop-blur-xl">
                    <div className="text-xs text-zinc-500 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                      政策路径
                      <Tooltip indicatorKey="policy_path" placement="top" />
                    </div>
                    <div className="text-lg font-semibold text-zinc-200">
                      {layer1.policy_path.label}
                    </div>
                    <div className="text-sm text-zinc-400 mt-1">
                      Δ2Y: {formatNumber(layer1.policy_path.delta_2y, 1)}bp
                    </div>
                    <div className="text-xs text-zinc-500 mt-2">
                      {layer1.policy_path.interpretation}
                    </div>
                  </div>

                  {/* 曲线结构 */}
                  <div className="group relative rounded-xl p-4 overflow-hidden bg-gradient-to-br from-zinc-900/80 to-zinc-950/80 border border-zinc-800/50 backdrop-blur-xl">
                    <div className="text-xs text-zinc-500 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                      曲线形态
                      <Tooltip indicatorKey="curve_structure" placement="top" />
                    </div>
                    <div className="text-lg font-semibold text-zinc-200">
                      {layer1.curve_structure.direction_label}
                    </div>
                    <div className="text-sm text-zinc-400 mt-1">
                      10Y-2Y: {formatNumber(layer1.curve_structure.curve_2s10s, 0)}bp
                    </div>
                    <div className="text-sm text-zinc-400">
                      30Y-10Y: {formatNumber(layer1.curve_structure.curve_10s30s, 0)}bp
                    </div>
                  </div>

                  {/* Real/BE */}
                  <div className="group relative rounded-xl p-4 overflow-hidden bg-gradient-to-br from-zinc-900/80 to-zinc-950/80 border border-zinc-800/50 backdrop-blur-xl">
                    <div className="text-xs text-zinc-500 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                      Real/BE
                      <Tooltip indicatorKey="real_be" placement="top" />
                    </div>
                    <div className="text-lg font-semibold text-zinc-200">
                      {layer1.real_be.state.replace(/_/g, " ")}
                    </div>
                    <div className="text-sm text-zinc-400 mt-1">
                      ΔReal: {formatNumber(layer1.real_be.delta_real, 1)}bp
                    </div>
                    <div className="text-sm text-zinc-400">
                      ΔBE: {formatNumber(layer1.real_be.delta_be, 1)}bp
                    </div>
                    <div className="text-xs text-zinc-500 mt-2">
                      {layer1.real_be.equity_impact}
                    </div>
                  </div>

                  {/* 期限溢价 */}
                  <div
                    className={cn(
                      "group relative rounded-xl p-4 overflow-hidden bg-gradient-to-br from-zinc-900/80 to-zinc-950/80 border backdrop-blur-xl",
                      layer1.term_premium.warning
                        ? "border-amber-500/50"
                        : "border-zinc-800/50"
                    )}
                  >
                    <div className="text-xs text-zinc-500 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                      期限溢价
                      <Tooltip indicatorKey="term_premium" placement="top" />
                    </div>
                    <div
                      className={cn(
                        "text-lg font-semibold",
                        layer1.term_premium.warning ? "text-amber-400" : "text-zinc-200"
                      )}
                    >
                      {layer1.term_premium.state.replace(/_/g, " ")}
                    </div>
                    {layer1.term_premium.warning && (
                      <div className="flex items-center gap-1 mt-2 text-amber-400 text-sm">
                        <Zap className="w-4 h-4" />
                        警告
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            <div className="divider" />

            {/* Layer 2: 叙事校验 */}
            {layer2 && (
              <div className="mb-8">
                <h2 className="section-title">
                  <Activity className="w-5 h-5 text-cyan-400" />
                  Layer 2: 叙事校验
                </h2>
                <div className="grid grid-cols-3 gap-4">
                  {/* 20D 相关性 */}
                  <div className="group relative rounded-xl p-4 overflow-hidden bg-gradient-to-br from-zinc-900/80 to-zinc-950/80 border border-zinc-800/50 backdrop-blur-xl">
                    <div className="text-xs text-zinc-500 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                      Corr(SPX, Δ10Y) 20D
                      <Tooltip indicatorKey="corr_20d" placement="top" />
                    </div>
                    <div
                      className={cn(
                        "text-2xl font-bold",
                        layer2.correlation.corr_20d > 0.3
                          ? "text-green-400"
                          : layer2.correlation.corr_20d < -0.3
                          ? "text-red-400"
                          : "text-zinc-400"
                      )}
                    >
                      {formatNumber(layer2.correlation.corr_20d, 2)}
                    </div>
                    <div className="text-sm text-zinc-400 mt-1">
                      {layer2.correlation.state_20d === "positive"
                        ? "增长/再通胀信号"
                        : layer2.correlation.state_20d === "negative"
                        ? "折现率冲击"
                        : "混合状态"}
                    </div>
                  </div>

                  {/* 60D 相关性 */}
                  <div className="group relative rounded-xl p-4 overflow-hidden bg-gradient-to-br from-zinc-900/80 to-zinc-950/80 border border-zinc-800/50 backdrop-blur-xl">
                    <div className="text-xs text-zinc-500 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                      Corr(SPX, Δ10Y) 60D
                      <Tooltip indicatorKey="corr_60d" placement="top" />
                    </div>
                    <div
                      className={cn(
                        "text-2xl font-bold",
                        layer2.correlation.corr_60d > 0.3
                          ? "text-green-400"
                          : layer2.correlation.corr_60d < -0.3
                          ? "text-red-400"
                          : "text-zinc-400"
                      )}
                    >
                      {formatNumber(layer2.correlation.corr_60d, 2)}
                    </div>
                    <div className="text-sm text-zinc-400 mt-1">
                      {layer2.correlation.state_60d === "positive"
                        ? "增长/再通胀信号"
                        : layer2.correlation.state_60d === "negative"
                        ? "折现率冲击"
                        : "混合状态"}
                    </div>
                  </div>

                  {/* 叙事状态 */}
                  <div
                    className={cn(
                      "group relative rounded-xl p-4 overflow-hidden bg-gradient-to-br from-zinc-900/80 to-zinc-950/80 border backdrop-blur-xl",
                      layer2.correlation.is_conflicting
                        ? "border-amber-500/50"
                        : "border-zinc-800/50"
                    )}
                  >
                    <div className="text-xs text-zinc-500 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                      叙事状态
                      <Tooltip indicatorKey="narrative_state" placement="top" />
                    </div>
                    <div
                      className={cn(
                        "text-xl font-semibold",
                        layer2.correlation.narrative_state === "risk_on"
                          ? "text-green-400"
                          : layer2.correlation.narrative_state === "risk_off"
                          ? "text-red-400"
                          : "text-amber-400"
                      )}
                    >
                      {layer2.correlation.narrative_state === "risk_on"
                        ? "Risk-On"
                        : layer2.correlation.narrative_state === "risk_off"
                        ? "Risk-Off"
                        : "Transition"}
                    </div>
                    {layer2.correlation.is_conflicting && (
                      <div className="flex items-center gap-1 mt-2 text-amber-400 text-sm">
                        <ArrowUpDown className="w-4 h-4" />
                        20D/60D 符号冲突
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            <div className="divider" />

            {/* Layer 3: 闸门矩阵 */}
            {layer3 && (
              <div className="mb-8">
                <h2 className="section-title">
                  <span className="text-lg">🚦</span>
                  Layer 3: 闸门矩阵
                  {layer3.any_gate_closed && (
                    <span className="badge badge-danger ml-2">有闸门关闭</span>
                  )}
                </h2>
                <div className="grid grid-cols-5 gap-4">
                  {layer3.gates.map((gate) => (
                    <GateCard key={gate.name} gate={gate} />
                  ))}
                </div>
              </div>
            )}

            <div className="divider" />

            {/* Layer 4: 执行矩阵 */}
            {exec && (
              <div className="mb-8">
                <h2 className="section-title">
                  <Target className="w-5 h-5 text-cyan-400" />
                  Layer 4: 执行矩阵
                </h2>
                <div className="grid grid-cols-2 gap-4">
                  {/* 利率表达 */}
                  <div className="group relative rounded-2xl p-5 overflow-hidden transition-all duration-500 bg-gradient-to-br from-zinc-900/80 to-zinc-950/80 border border-zinc-800/50 hover:border-cyan-500/30 backdrop-blur-xl">
                    <div className="absolute top-0 left-0 right-0 h-0.5 opacity-50 bg-gradient-to-r from-transparent via-cyan-500 to-transparent" />
                    <div className="flex items-center gap-2 mb-3">
                      <Target className="w-4 h-4 text-cyan-400" />
                      <span className="text-xs text-zinc-500 font-semibold uppercase tracking-wider flex items-center gap-1.5">
                        利率表达
                        <Tooltip indicatorKey="rates_action" placement="top" />
                      </span>
                    </div>
                    <div className="text-lg text-zinc-200 font-medium mb-2">
                      {exec.rates_action}
                    </div>
                    <div className="text-sm text-zinc-400">
                      工具: {exec.rates_instruments.join(", ") || "N/A"}
                    </div>
                    <div className="text-sm text-zinc-400 mt-1 flex items-center gap-2">
                      置信度:{" "}
                      <span
                        className={cn(
                          "badge",
                          exec.rates_confidence === "HIGH"
                            ? "badge-success"
                            : exec.rates_confidence === "FORCED"
                            ? "badge-danger"
                            : "badge-warning"
                        )}
                      >
                        {exec.rates_confidence}
                      </span>
                    </div>
                  </div>

                  {/* 股票板块 */}
                  <div className="group relative rounded-2xl p-5 overflow-hidden transition-all duration-500 bg-gradient-to-br from-zinc-900/80 to-zinc-950/80 border border-zinc-800/50 hover:border-purple-500/30 backdrop-blur-xl">
                    <div className="absolute top-0 left-0 right-0 h-0.5 opacity-50 bg-gradient-to-r from-transparent via-purple-500 to-transparent" />
                    <div className="flex items-center gap-2 mb-3">
                      <TrendingUp className="w-4 h-4 text-purple-400" />
                      <span className="text-xs text-zinc-500 font-semibold uppercase tracking-wider flex items-center gap-1.5">
                        股票板块
                        <Tooltip indicatorKey="equity_sector" placement="top" />
                      </span>
                    </div>
                    <div className="text-lg text-zinc-200 font-medium mb-2">
                      {exec.equity_sector_bias}
                    </div>
                    <div className="text-sm text-zinc-400">
                      推荐板块: {exec.equity_sectors.join(", ") || "N/A"}
                    </div>
                  </div>

                  {/* 对冲要求 */}
                  <div className="group relative rounded-2xl p-5 overflow-hidden transition-all duration-500 bg-gradient-to-br from-zinc-900/80 to-zinc-950/80 border border-zinc-800/50 hover:border-amber-500/30 backdrop-blur-xl">
                    <div className="absolute top-0 left-0 right-0 h-0.5 opacity-50 bg-gradient-to-r from-transparent via-amber-500 to-transparent" />
                    <div className="flex items-center gap-2 mb-3">
                      <Shield className="w-4 h-4 text-amber-400" />
                      <span className="text-xs text-zinc-500 font-semibold uppercase tracking-wider flex items-center gap-1.5">
                        对冲要求
                        <Tooltip indicatorKey="hedge_required" placement="top" />
                      </span>
                    </div>
                    <div className="mb-2">
                      <span
                        className={cn(
                          "badge",
                          exec.hedge_required ? "badge-warning" : "badge-success"
                        )}
                      >
                        {exec.hedge_required ? "需要对冲" : "无需对冲"}
                      </span>
                    </div>
                    {exec.hedge_required && (
                      <>
                        <div className="text-sm text-zinc-400">
                          类型: {exec.hedge_type || "N/A"}
                        </div>
                        <div className="text-sm text-zinc-400 mt-1">
                          工具: {exec.hedge_instruments?.join(", ") || "N/A"}
                        </div>
                      </>
                    )}
                  </div>

                  {/* 卖波动许可 */}
                  <div className="group relative rounded-2xl p-5 overflow-hidden transition-all duration-500 bg-gradient-to-br from-zinc-900/80 to-zinc-950/80 border border-zinc-800/50 hover:border-pink-500/30 backdrop-blur-xl">
                    <div className="absolute top-0 left-0 right-0 h-0.5 opacity-50 bg-gradient-to-r from-transparent via-pink-500 to-transparent" />
                    <div className="flex items-center gap-2 mb-3">
                      <LineChart className="w-4 h-4 text-pink-400" />
                      <span className="text-xs text-zinc-500 font-semibold uppercase tracking-wider flex items-center gap-1.5">
                        卖波动许可
                        <Tooltip indicatorKey="short_vol" placement="top" />
                      </span>
                    </div>
                    <div className="mb-2">
                      <span
                        className={cn(
                          "badge",
                          exec.short_vol_allowed ? "badge-success" : "badge-danger"
                        )}
                      >
                        {exec.short_vol_allowed ? "允许" : "禁止"}
                      </span>
                    </div>
                    <div className="text-sm text-zinc-400">
                      {exec.short_vol_constraints || "无约束"}
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="divider" />

            {/* 市场指标图表 */}
            <div className="mb-8">
              <h2 className="section-title">
                <BarChart3 className="w-5 h-5 text-cyan-400" />
                市场指标
              </h2>
              <div className="grid grid-cols-2 gap-4">
                {marketData.SPX && marketData.SPX.length > 0 && (
                  <Chart
                    data={marketData.SPX}
                    title="S&P 500"
                    color="#10b981"
                  />
                )}
                {marketData.US10Y && marketData.US10Y.length > 0 && (
                  <Chart
                    data={marketData.US10Y}
                    title="10Y 国债收益率 (%)"
                    color="#06b6d4"
                    showArea={false}
                  />
                )}
                {marketData.DXY && marketData.DXY.length > 0 && (
                  <Chart
                    data={marketData.DXY}
                    title="美元指数 (DXY)"
                    color="#a855f7"
                  />
                )}
                {marketData.HY_OAS && marketData.HY_OAS.length > 0 && (
                  <Chart
                    data={marketData.HY_OAS}
                    title="高收益债 OAS (bp)"
                    color="#f97316"
                    showArea={false}
                    referenceLines={[
                      { y: 400, color: "#f59e0b", label: "关注" },
                      { y: 500, color: "#ef4444", label: "警告" },
                    ]}
                  />
                )}
                {marketData.VIX && marketData.VIX.length > 0 && (
                  <Chart
                    data={marketData.VIX}
                    title="VIX 恐慌指数"
                    color="#ec4899"
                    showArea={false}
                    referenceLines={[
                      { y: 20, color: "#f59e0b", label: "关注" },
                      { y: 30, color: "#ef4444", label: "恐慌" },
                    ]}
                  />
                )}
              </div>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
