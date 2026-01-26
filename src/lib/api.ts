import type { ApiResponse, ModelOutput, MarketData } from "@/types/api";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

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

  async healthCheck(): Promise<{ status: string; version: string }> {
    return this.request("/api/health");
  }

  async runModel(dataDate?: string): Promise<ModelOutput> {
    const params = dataDate ? `?data_date=${dataDate}` : "";
    return this.request(`/api/model/run${params}`, { method: "POST" });
  }

  async getLatestOutput(): Promise<ModelOutput> {
    return this.request("/api/model/latest");
  }

  async getMarketData(symbol: string): Promise<MarketData> {
    return this.request(`/api/market-data/${symbol}`);
  }

  async listSymbols(): Promise<{ symbols: string[]; count: number }> {
    return this.request("/api/market-data");
  }
}

export const apiClient = new ApiClient();
export default apiClient;
