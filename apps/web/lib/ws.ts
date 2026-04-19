type WsEventType =
  | "chat:message"
  | "chat:tool_call"
  | "chat:stream"
  | "chat:error"
  | "execution:node_start"
  | "execution:node_complete"
  | "execution:node_error"
  | "execution:complete"
  | "execution:error";

interface WsEvent {
  type: WsEventType;
  payload: unknown;
  timestamp: string;
}

type EventHandler = (event: WsEvent) => void;

class WebSocketClient {
  private ws: WebSocket | null = null;
  private url: string;
  private handlers: Map<string, Set<EventHandler>> = new Map();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;

  constructor(baseUrl: string) {
    this.url = baseUrl;
  }

  connect(path: string, token: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const wsUrl = `${this.url}${path}?token=${token}`;
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        this.reconnectAttempts = 0;
        resolve();
      };

      this.ws.onmessage = (event) => {
        try {
          const data: WsEvent = JSON.parse(event.data);
          this.emit(data.type, data);
          this.emit("*", data); // wildcard handler
        } catch {
          console.error("Failed to parse WebSocket message:", event.data);
        }
      };

      this.ws.onerror = (error) => {
        console.error("WebSocket error:", error);
        reject(error);
      };

      this.ws.onclose = () => {
        this.attemptReconnect(path, token);
      };
    });
  }

  private attemptReconnect(path: string, token: string) {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
      setTimeout(() => {
        this.connect(path, token).catch(console.error);
      }, delay);
    }
  }

  send(data: { type: string; payload: unknown }) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }

  on(eventType: string, handler: EventHandler) {
    if (!this.handlers.has(eventType)) {
      this.handlers.set(eventType, new Set());
    }
    this.handlers.get(eventType)!.add(handler);
  }

  off(eventType: string, handler: EventHandler) {
    this.handlers.get(eventType)?.delete(handler);
  }

  private emit(eventType: string, event: WsEvent) {
    this.handlers.get(eventType)?.forEach((handler) => handler(event));
  }

  disconnect() {
    this.maxReconnectAttempts = 0; // prevent reconnection
    this.ws?.close();
    this.ws = null;
    this.handlers.clear();
  }

  get isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }
}

const WS_BASE = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:8000";
export const wsClient = new WebSocketClient(WS_BASE);
export default wsClient;
