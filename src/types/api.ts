// API 响应包装类型
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

// 门控状态 (匹配后端 GateResponse)
export interface GateStatus {
  name: string;
  status: "open" | "closed" | "warning" | "unknown";
  value: number | boolean | Record<string, unknown> | null;
  threshold: number | string | Record<string, unknown> | null;
  message: string | null;
}

// 告警信息
export interface Alert {
  level: "CRITICAL" | "WARNING" | "INFO";
  type: string;
  message: string;
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
  hedge_instruments: string[];
  short_vol_allowed: boolean;
  short_vol_constraints: string | null;
}

// 模型输出 (匹配后端 ModelOutputResponse)
export interface ModelOutput {
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
