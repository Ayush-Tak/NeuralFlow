// ============================================
// NeuralFlow — Shared Type Definitions
// ============================================

// ---------- Flow Types ----------

export type NodeType =
  | "trigger"
  | "ai-agent"
  | "google-calendar"
  | "gmail"
  | "github";

export type TriggerType = "manual" | "webhook" | "schedule";

export type NodeStatus = "idle" | "running" | "success" | "error" | "skipped";

export type FlowStatus = "draft" | "active" | "paused" | "error";

export type ExecutionStatus = "pending" | "running" | "completed" | "failed" | "cancelled";

export interface FlowNodePosition {
  x: number;
  y: number;
}

export interface FlowNodeData {
  label: string;
  type: NodeType;
  config: Record<string, unknown>;
  description?: string;
}

export interface FlowNode {
  id: string;
  type: NodeType;
  position: FlowNodePosition;
  data: FlowNodeData;
}

export interface FlowEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
}

export interface Flow {
  id: string;
  name: string;
  description: string;
  status: FlowStatus;
  nodes: FlowNode[];
  edges: FlowEdge[];
  userId: string;
  createdAt: string;
  updatedAt: string;
}

// ---------- Execution Types ----------

export interface NodeExecutionResult {
  nodeId: string;
  status: NodeStatus;
  output: unknown;
  error?: string;
  startedAt: string;
  completedAt?: string;
  durationMs?: number;
}

export interface FlowExecution {
  id: string;
  flowId: string;
  status: ExecutionStatus;
  nodeResults: NodeExecutionResult[];
  triggeredBy: "manual" | "schedule" | "webhook";
  startedAt: string;
  completedAt?: string;
}

// ---------- Chat Types ----------

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  toolCalls?: ToolCallInfo[];
  timestamp: string;
}

export interface ToolCallInfo {
  id: string;
  toolName: string;
  serverName: string;
  status: "calling" | "success" | "error";
  input?: Record<string, unknown>;
  output?: unknown;
  error?: string;
}

// ---------- Integration Types ----------

export type IntegrationType = "google" | "github";

export type IntegrationStatus = "connected" | "disconnected" | "error" | "expired";

export interface Integration {
  type: IntegrationType;
  status: IntegrationStatus;
  connectedAt?: string;
  email?: string;
  username?: string;
  scopes?: string[];
}

// ---------- User Types ----------

export interface User {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string;
  integrations: Integration[];
  createdAt: string;
}

// ---------- API Response Types ----------

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  total: number;
  page: number;
  pageSize: number;
}

// ---------- WebSocket Event Types ----------

export type WsEventType =
  | "chat:message"
  | "chat:tool_call"
  | "chat:stream"
  | "chat:error"
  | "execution:node_start"
  | "execution:node_complete"
  | "execution:node_error"
  | "execution:complete"
  | "execution:error";

export interface WsEvent<T = unknown> {
  type: WsEventType;
  payload: T;
  timestamp: string;
}

// ---------- Node Config Types ----------

export interface TriggerNodeConfig {
  triggerType: TriggerType;
  cronExpression?: string;
  webhookPath?: string;
}

export interface AIAgentNodeConfig {
  prompt: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  tools?: string[];
}

export interface GoogleCalendarNodeConfig {
  action: "list_events" | "create_event" | "delete_event";
  date?: string;
  maxResults?: number;
  title?: string;
  startTime?: string;
  endTime?: string;
}

export interface GmailNodeConfig {
  action: "list_emails" | "read_email" | "send_email";
  query?: string;
  to?: string;
  subject?: string;
  body?: string;
  maxResults?: number;
}

export interface GitHubNodeConfig {
  action: "list_repos" | "list_issues" | "create_issue" | "list_prs";
  repo?: string;
  state?: "open" | "closed" | "all";
  title?: string;
  body?: string;
}
