/**
 * [INPUT]: (endpoint, options?) - API 端点路径和请求配置。
 * [OUTPUT]: (Promise<T>) - 类型安全的 API 响应数据，或抛出 Error。
 * [POS]: 位于 /lib，被所有页面组件引用。单例 ApiClient 封装所有后端 API 调用，通过 Next.js rewrite 代理转发请求。
 *
 * [PROTOCOL]:
 * 1. 一旦本文件逻辑变更，必须同步更新此 Header。
 * 2. 更新后必须上浮检查 /src/lib/.folder.md 的描述是否依然准确。
 */
import type {
  ApiResponse,
  ModelOutput,
  MarketData,
  LiquidityOutput,
  MacroOutput,
  EquityOutput,
  HealthCheck,
  HistoryResponse,
  GateStatus,
} from "@/types/api";

/**
 * 深度清理 API 响应中可能存在的枚举对象
 * Python 枚举序列化后可能包含 _name_, _value_ 等属性
 */
function sanitizeEnumObjects(obj: unknown): unknown {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(sanitizeEnumObjects);
  }

  if (typeof obj === "object") {
    const record = obj as Record<string, unknown>;

    // 检测 Python 枚举对象的特征
    if ("_value_" in record && "_name_" in record) {
      // 返回枚举的值
      return record._value_;
    }

    // 递归处理所有属性
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(record)) {
      // 跳过私有属性
      if (key.startsWith("_")) {
        continue;
      }
      result[key] = sanitizeEnumObjects(value);
    }
    return result;
  }

  return obj;
}

// 使用相对路径，让 Vercel rewrites 代理到后端
// 本地开发时会请求 localhost:3000/api，Next.js 代理到后端
// 生产环境请求 vercel.app/api，Vercel 代理到后端
const API_BASE_URL = "";

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string = API_BASE_URL) {
    this.baseUrl = baseUrl;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...(options.headers as Record<string, string>),
    };

    // 写操作需要 API Key 认证
    if (options.method === "POST" || options.method === "PUT" || options.method === "DELETE") {
      const apiKey = process.env.NEXT_PUBLIC_API_KEY;
      if (apiKey) {
        headers["X-API-Key"] = apiKey;
      }
    }

    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.status} ${response.statusText}`);
    }

    const result: ApiResponse<T> = await response.json();

    if (!result.success) {
      throw new Error(result.error || "Unknown error");
    }

    // 清理可能存在的 Python 枚举对象
    return sanitizeEnumObjects(result.data) as T;
  }

  /**
   * 健康检查
   */
  async healthCheck(): Promise<HealthCheck> {
    return this.request("/api/health");
  }

  /**
   * 运行模型（返回完整输出）
   */
  async runModel(dataDate?: string): Promise<ModelOutput> {
    const params = dataDate ? `?data_date=${dataDate}` : "";
    return this.request(`/api/model/run${params}`, { method: "POST" });
  }

  /**
   * 获取最新模型输出
   */
  async getLatestOutput(): Promise<ModelOutput> {
    return this.request("/api/model/latest");
  }

  /**
   * 获取流动性模型输出 (v3.0)
   */
  async getLiquidityOutput(): Promise<LiquidityOutput> {
    return this.request("/api/liquidity");
  }

  /**
   * 获取宏观模型输出 (v4.0)
   */
  async getMacroOutput(): Promise<MacroOutput> {
    return this.request("/api/macro");
  }

  /**
   * 获取市场数据
   */
  async getMarketData(symbol: string): Promise<MarketData> {
    return this.request(`/api/market-data/${symbol}`);
  }

  /**
   * 列出可用的市场数据符号
   */
  async listSymbols(): Promise<{ symbols: string[]; count: number }> {
    return this.request("/api/market-data");
  }

  /**
   * 获取模型运行历史记录（从数据库）
   */
  async getHistory(days: number = 30, modelType?: string): Promise<HistoryResponse> {
    const params = new URLSearchParams({ days: String(days) });
    if (modelType) {
      params.append("model_type", modelType);
    }
    return this.request(`/api/model/history?${params.toString()}`);
  }

  /**
   * 获取美股模型输出
   */
  async getEquityOutput(): Promise<EquityOutput | null> {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const res = await this.request<any>("/api/equity");
      if (res?.equity) {
        const d = res;
        const equity = d.equity;
        return {
          run_id: d.run_id || "",
          run_ts: d.run_ts || "",
          data_ts: (d.data_ts || "").replace(" ", "T"),
          model_version: d.model_version || "",
          regime: equity.regime || { code: "TRANSITION", name: "转换期" },
          modules: equity.modules || [],
          weighted_score: equity.weighted_score ?? 0,
          allocation: equity.allocation || { equity_pct: 50, bond_pct: 25, cash_pct: 25 },
          sector_bias: equity.sector_bias || { overweight: [], underweight: [] },
          risk_management: {
            drawdown_pct: equity.risk_management?.spx_drawdown_pct ?? equity.risk_management?.drawdown_pct ?? 0,
            level: equity.risk_management?.label ?? equity.risk_management?.level ?? "NORMAL",
            action: equity.risk_management?.action ?? "正常",
          },
          report_summary: d.report_summary || "",
          alerts: d.alerts || [],
          triggered_rules: d.triggered_rules || {},
        };
      }
      return null;
    } catch {
      return null;
    }
  }

  /**
   * 根据 run_id 获取特定的模型运行结果（从数据库）
   * 后端返回扁平的数据库格式，需要转换为前端 ModelOutput 嵌套结构
   */
  async getOutputById(runId: string): Promise<ModelOutput> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const raw: any = await this.request(`/api/model/output/${runId}`);

    // 如果已经是嵌套格式（有 liquidity 字段），直接返回
    if (raw.liquidity && typeof raw.liquidity === "object" && "liquidity_score" in raw.liquidity) {
      return raw as ModelOutput;
    }

    // 从扁平数据库格式转换为前端嵌套格式
    const layer1 = raw.layer1_output?.details || {};
    const layer2 = raw.layer2_output || {};
    const layer3 = raw.layer3_output || {};
    const correction = raw.correction_output || {};
    const liquidityDetails = raw.layer1_output?.liquidity_details || {};

    // 构造 Layer3 gates 数组
    const gateEntries = Object.values(layer3).filter(
      (v): v is Record<string, unknown> => typeof v === "object" && v !== null && "gate_name" in v
    );
    const gates: GateStatus[] = gateEntries.map((g) => ({
      name: String(g.gate_name || ""),
      status: String(g.status || "unknown") as GateStatus["status"],
      value: (g.indicator_value ?? null) as GateStatus["value"],
      threshold: (g.threshold ?? null) as GateStatus["threshold"],
      message: g.action ? String(g.action) : null,
      priority: typeof g.priority === "number" ? g.priority : null,
    }));

    // 判断宏观状态
    const macroStateRule = raw.triggered_rules?.macro_state;
    const stateCode = macroStateRule?.result?.state || "C";
    const stateName = macroStateRule?.result?.name || "";

    const macroStateConditions: Record<string, string> = {};
    if (macroStateRule?.input_values) {
      for (const [k, v] of Object.entries(macroStateRule.input_values)) {
        macroStateConditions[k] = String(v);
      }
    }

    // 构造执行矩阵 — action_output 可能为 null，做防御处理
    const action = raw.action_output || {};

    const liquidity: LiquidityOutput = {
      liquidity_score: raw.liquidity_score ?? 0,
      risk_light: raw.risk_light ?? "unknown",
      leverage_coef: raw.leverage_coef ?? 0,
      forbidden_strategies: raw.forbidden_strategies ?? [],
      component_scores: liquidityDetails.component_scores ?? [],
      hard_stop_triggered: liquidityDetails.hard_stop_triggered ?? false,
      hard_stop_reason: liquidityDetails.hard_stop_reason ?? null,
      supply_texture_adjustment: liquidityDetails.supply_texture_adjustment ?? 0,
      rrp_buffer_amplified: liquidityDetails.rrp_buffer_amplified ?? false,
    };

    const macro: MacroOutput = {
      macro_state: {
        code: stateCode,
        name: stateName,
        conditions: macroStateConditions,
      },
      layer1: {
        policy_path: {
          state: layer1.policy_path_state ?? "",
          label: layer1.policy_path_label ?? "",
          interpretation: layer1.policy_path_interpretation ?? "",
          delta_2y: layer1.delta_2y ?? 0,
        },
        curve_structure: {
          curve_2s10s: layer1.curve_2s10s ?? 0,
          curve_10s30s: layer1.curve_10s30s ?? 0,
          direction_state: layer1.curve_direction ?? "",
          direction_label: layer1.curve_direction_label ?? "",
          curve_30y_direction: layer1.curve_30y_direction ?? "",
        },
        real_be: {
          state: layer1.real_be_state ?? "",
          interpretation: layer1.real_be_interpretation ?? "",
          equity_impact: layer1.equity_impact ?? "",
          delta_real: layer1.delta_real ?? 0,
          delta_be: layer1.delta_be ?? 0,
        },
        term_premium: {
          state: layer1.tp_state ?? "",
          warning: layer1.tp_warning ?? false,
        },
      },
      layer2: {
        correlation: {
          corr_20d: layer2.corr_20d?.indicator_value ?? 0,
          corr_60d: layer2.corr_60d?.indicator_value ?? 0,
          state_20d: layer2.corr_20d?.status === "open"
            ? (layer2.corr_20d?.indicator_value > 0.3 ? "positive" : layer2.corr_20d?.indicator_value < -0.3 ? "negative" : "neutral")
            : "neutral",
          state_60d: layer2.corr_60d?.status === "open"
            ? (layer2.corr_60d?.indicator_value > 0.3 ? "positive" : layer2.corr_60d?.indicator_value < -0.3 ? "negative" : "neutral")
            : "neutral",
          is_conflicting: layer2.is_conflicting ?? false,
          narrative_state: layer2.narrative_state ?? "transition",
        },
      },
      layer3: {
        gates,
        any_gate_closed: gates.some((g) => g.status === "closed"),
      },
      execution_matrix: {
        rates_action: action.rates_action ?? "N/A",
        rates_instruments: action.rates_instruments ?? [],
        rates_confidence: action.rates_confidence ?? "LOW",
        equity_sector_bias: action.equity_sector_bias ?? "N/A",
        equity_sectors: action.equity_sectors ?? [],
        hedge_required: action.hedge_required ?? false,
        hedge_type: action.hedge_type ?? null,
        hedge_instruments: action.hedge_instruments ?? null,
        short_vol_allowed: action.short_vol_allowed ?? false,
        short_vol_constraints: action.short_vol_constraints ?? null,
      },
      correction: {
        level: correction.level ?? "NONE",
        reason: correction.reason ?? "",
        triggered_conditions: correction.triggered_conditions ?? [],
        suggested_action: correction.suggested_action ?? "",
      },
    };

    return {
      run_id: raw.run_id,
      run_ts: raw.run_ts,
      data_ts: raw.data_ts,
      model_version: raw.model_version,
      liquidity,
      macro,
      report_summary: raw.report_summary ?? "",
      alerts: raw.alerts ?? [],
      triggered_rules: raw.triggered_rules ?? {},
      execution_time_ms: raw.execution_time_ms ?? 0,
      status: raw.status ?? "UNKNOWN",
    };
  }
}

export const apiClient = new ApiClient();
export default apiClient;
