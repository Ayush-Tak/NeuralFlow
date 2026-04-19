const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

type HttpMethod = "GET" | "POST" | "PUT" | "DELETE" | "PATCH";

interface RequestOptions {
  method?: HttpMethod;
  body?: unknown;
  headers?: Record<string, string>;
  token?: string;
}

class ApiClient {
  private baseUrl: string;
  private token: string | null = null;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  setToken(token: string) {
    this.token = token;
  }

  clearToken() {
    this.token = null;
  }

  private async request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
    const { method = "GET", body, headers = {}, token } = options;
    const authToken = token || this.token;

    const config: RequestInit = {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
        ...headers,
      },
    };

    if (body && method !== "GET") {
      config.body = JSON.stringify(body);
    }

    const response = await fetch(`${this.baseUrl}${endpoint}`, config);

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: "Request failed" }));
      throw new Error(error.detail || `HTTP ${response.status}`);
    }

    const text = await response.text();
    if (!text) return {} as T;
    return JSON.parse(text);
  }

  // Health
  health() {
    return this.request<{ status: string; version: string }>("/api/health");
  }

  // Auth
  getGoogleLoginUrl() {
    return `${this.baseUrl}/auth/google/login`;
  }

  getGithubLoginUrl() {
    return `${this.baseUrl}/auth/github/login`;
  }

  getMe() {
    return this.request<{
      id: string;
      email: string;
      name: string;
      avatar_url: string | null;
      has_google: boolean;
      has_github: boolean;
    }>("/auth/me");
  }

  // Flows
  listFlows() {
    return this.request<Array<{
      id: string;
      name: string;
      description: string;
      status: string;
      nodes: unknown[];
      edges: unknown[];
      created_at: string;
      updated_at: string;
      execution_count: number;
    }>>("/flows");
  }

  getFlow(id: string) {
    return this.request<{
      id: string;
      name: string;
      description: string;
      status: string;
      nodes: unknown[];
      edges: unknown[];
    }>(`/flows/${id}`);
  }

  createFlow(data: { name: string; description?: string; nodes?: unknown[]; edges?: unknown[] }) {
    return this.request("/flows", { method: "POST", body: data });
  }

  updateFlow(id: string, data: { name?: string; description?: string; nodes?: unknown[]; edges?: unknown[]; status?: string }) {
    return this.request(`/flows/${id}`, { method: "PUT", body: data });
  }

  deleteFlow(id: string) {
    return this.request(`/flows/${id}`, { method: "DELETE" });
  }

  disconnectIntegration(provider: string) {
    return this.request(`/auth/integrations/${provider}`, { method: "DELETE" });
  }
}

export const api = new ApiClient(API_BASE);
export default api;
