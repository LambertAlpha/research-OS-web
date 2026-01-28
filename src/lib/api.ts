import type {
  ApiResponse,
  ModelOutput,
  MarketData,
  LiquidityOutput,
  MacroOutput,
  HealthCheck,
} from "@/types/api";

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
    const response = await fetch(url, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...options.headers,
      },
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.status} ${response.statusText}`);
    }

    const result: ApiResponse<T> = await response.json();

    if (!result.success) {
      throw new Error(result.error || "Unknown error");
    }

    return result.data as T;
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
}

export const apiClient = new ApiClient();
export default apiClient;
