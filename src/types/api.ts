/**
 * [INPUT]: N/A — 纯类型定义文件，无运行时输入。
 * [OUTPUT]: TypeScript 接口/类型导出 — ApiResponse, GateStatus, LiquidityOutput(v3.0), MacroOutput(v4.0), ModelOutput(v2.0), MarketData 等。
 * [POS]: 位于 /types，被 lib/api.ts 和所有页面/组件引用。前后端数据契约的唯一真相源，与后端 Python 模型输出结构一一对应。
 *
 * [PROTOCOL]:
 * 1. 一旦本文件逻辑变更，必须同步更新此 Header。
 * 2. 更新后必须上浮检查 /src/types/.folder.md 的描述是否依然准确。
 */
// API 响应包装类型
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

// 门控状态 (匹配后端 GateResponse)
export interface GateStatus {
  name: string;
  status: "open" | "closed" | "caution" | "warning" | "unknown";
  value: number | boolean | Record<string, unknown> | null;
  threshold: number | string | Record<string, unknown> | null;
  message: string | null;
  priority?: number | null;
}

// 告警信息
export interface Alert {
  level: "CRITICAL" | "WARNING" | "INFO";
  type: string;
  message: string;
}

// ============================================================================
// 流动性模型 v3.0 类型
// ============================================================================

// 流动性分项得分
export interface LiquidityComponentScore {
  name: string;
  weight: number;
  score: number;
  label: string;
  value?: number | null;
}

// 流动性模型输出
export interface LiquidityOutput {
  liquidity_score: number;
  risk_light: "green" | "yellow" | "red" | "unknown";
  leverage_coef: number;
  forbidden_strategies: string[];
  // 分项得分
  component_scores: LiquidityComponentScore[];
  // 一票否决
  hard_stop_triggered: boolean;
  hard_stop_reason?: string | null;
  // Supply Texture 修正
  supply_texture_adjustment: number;
  // RRP 缓冲放大器
  rrp_buffer_amplified: boolean;
}

// ============================================================================
// 宏观模型 v4.0 类型
// ============================================================================

// 政策路径
export interface PolicyPath {
  state: string;
  label: string;
  interpretation: string;
  delta_2y: number;
}

// 曲线结构
export interface CurveStructure {
  curve_2s10s: number;
  curve_10s30s: number;
  direction_state: string;
  direction_label: string;
  curve_30y_direction: string;
}

// Real/BE 分析
export interface RealBe {
  state: string;
  interpretation: string;
  equity_impact: string;
  delta_real: number;
  delta_be: number;
}

// 期限溢价
export interface TermPremium {
  state: string;
  warning: boolean;
}

// Layer 1: 利率结构
export interface Layer1 {
  policy_path: PolicyPath;
  curve_structure: CurveStructure;
  real_be: RealBe;
  term_premium: TermPremium;
}

// 相关性
export interface Correlation {
  corr_20d: number;
  corr_60d: number;
  state_20d: string;
  state_60d: string;
  is_conflicting: boolean;
  narrative_state: string;
}

// Layer 2: 叙事校验
export interface Layer2 {
  correlation: Correlation;
}

// Layer 3: 风险闸门
export interface Layer3 {
  gates: GateStatus[];
  any_gate_closed: boolean;
}

// 宏观状态 (A/B/C/D)
export interface MacroState {
  code: string;
  name: string;
  conditions: Record<string, string>;
}

// 执行矩阵
export interface ExecutionMatrix {
  rates_action: string;
  rates_instruments: string[];
  rates_confidence: string;
  equity_sector_bias: string;
  equity_sectors: string[];
  hedge_required: boolean;
  hedge_type: string | null;
  hedge_instruments: string[] | null;
  short_vol_allowed: boolean;
  short_vol_constraints: string | null;
}

// 纠错系统
export interface Correction {
  level: string;
  reason: string;
  triggered_conditions: string[];
  suggested_action: string;
}

// 宏观模型输出
export interface MacroOutput {
  macro_state: MacroState;
  layer1: Layer1;
  layer2: Layer2;
  layer3: Layer3;
  execution_matrix: ExecutionMatrix;
  correction: Correction;
}

// ============================================================================
// 模型完整输出 (匹配后端 ModelOutputResponse v2.0)
// ============================================================================
export interface ModelOutput {
  run_id: string;
  run_ts: string;
  data_ts: string;
  model_version: string;
  // 流动性输出 v3.0
  liquidity: LiquidityOutput;
  // 宏观输出 v4.0
  macro: MacroOutput;
  // 报告
  report_summary: string;
  // 告警
  alerts: Alert[];
  // 触发规则
  triggered_rules: Record<string, unknown>;
  // 执行时间
  execution_time_ms: number;
  status: string;
}

// ============================================================================
// 兼容旧版本的类型（向后兼容）
// ============================================================================
export interface LegacyModelOutput {
  run_id: string;
  run_ts: string;
  data_ts: string;
  model_version: string;
  risk_light: "green" | "yellow" | "red" | "unknown";
  liquidity_score: number;
  leverage_coef: number;
  forbidden_strategies: string[];
  gates: GateStatus[];
  execution_matrix: ExecutionMatrix | null;
  report_summary: string;
  alerts: Alert[];
  triggered_rules: Record<string, unknown>;
  execution_time_ms: number;
  status: string;
}

// 原始数据点
export interface RawDataPoint {
  ts: string;
  value: number;
}

// 市场数据
export interface MarketData {
  symbol: string;
  data: RawDataPoint[];
  latest: RawDataPoint;
}

// 符号信息
export interface SymbolInfo {
  symbol: string;
  description: string;
}

// 健康检查响应
export interface HealthCheck {
  status: string;
  version: string;
  models?: {
    liquidity: string;
    macro: string;
  };
  timestamp: string;
}

// ============================================================================
// 历史记录类型
// ============================================================================

// 历史记录条目（从数据库返回的简化格式）
export interface HistoryRecord {
  run_id: string;
  run_ts: string;
  data_ts: string;
  model_type: string;
  model_version: string;
  status: string;
  execution_time_ms: number;
  risk_light?: string | null;
  liquidity_score?: number | null;
  leverage_coef?: number | null;
}

// 历史记录响应
export interface HistoryResponse {
  total: number;
  days: number;
  records: HistoryRecord[];
}
