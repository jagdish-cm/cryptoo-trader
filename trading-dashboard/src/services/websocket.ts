import type {
  WebSocketMessage,
  MarketData,
  Position,
  Trade,
  TradingSignal,
  SystemStatus,
  AIDecision,
  Portfolio,
  MarketRegime,
} from "../types";

export interface WebSocketConfig {
  url: string;
  reconnectAttempts: number;
  reconnectDelay: number;
  timeout: number;
}

export interface WebSocketEventHandlers {
  onConnect?: () => void;
  onDisconnect?: (reason: string) => void;
  onError?: (error: Error) => void;
  onMarketData?: (data: MarketData) => void;
  onPortfolioUpdate?: (data: Portfolio) => void;
  onPositionUpdate?: (data: Position) => void;
  onTradeExecuted?: (data: Trade) => void;
  onSignalGenerated?: (data: TradingSignal) => void;
  onAIDecision?: (data: AIDecision) => void;
  onSystemStatus?: (data: SystemStatus) => void;
  onRegimeChange?: (data: MarketRegime) => void;
}

export class WebSocketClient {
  private socket: WebSocket | null = null;
  private config: WebSocketConfig;
  private handlers: WebSocketEventHandlers = {};
  private reconnectAttempts = 0;
  private isConnecting = false;
  private subscriptions = new Set<string>();
  private reconnectTimer: NodeJS.Timeout | null = null;

  constructor(config: WebSocketConfig) {
    this.config = config;
  }

  /**
   * Connect to WebSocket server
   */
  async connect(): Promise<void> {
    if (this.socket?.readyState === WebSocket.OPEN || this.isConnecting) {
      return;
    }

    this.isConnecting = true;

    try {
      // Convert ws:// to http:// for the WebSocket URL
      const wsUrl = this.config.url
        .replace("http://", "ws://")
        .replace("https://", "wss://");
      this.socket = new WebSocket(wsUrl);

      this.setupEventHandlers();

      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error("Connection timeout"));
        }, this.config.timeout);

        this.socket!.onopen = () => {
          clearTimeout(timeout);
          this.isConnecting = false;
          this.reconnectAttempts = 0;
          console.log("WebSocket connected");
          this.handlers.onConnect?.();
          resolve();
        };

        this.socket!.onerror = (error) => {
          clearTimeout(timeout);
          this.isConnecting = false;
          console.error("WebSocket connection error:", error);
          this.handlers.onError?.(new Error("WebSocket connection failed"));
          reject(error);
        };
      });
    } catch (error) {
      this.isConnecting = false;
      throw error;
    }
  }

  /**
   * Disconnect from WebSocket server
   */
  disconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
    this.subscriptions.clear();
  }

  /**
   * Set event handlers
   */
  setHandlers(handlers: WebSocketEventHandlers): void {
    this.handlers = { ...this.handlers, ...handlers };
  }

  /**
   * Subscribe to a data channel
   */
  subscribe(channel: string): void {
    if (this.socket?.readyState !== WebSocket.OPEN) {
      console.warn("Cannot subscribe: WebSocket not connected");
      return;
    }

    const message = JSON.stringify({
      type: "subscribe",
      channel: channel,
    });

    this.socket.send(message);
    this.subscriptions.add(channel);
    console.log(`Subscribed to channel: ${channel}`);
  }

  /**
   * Unsubscribe from a data channel
   */
  unsubscribe(channel: string): void {
    if (this.socket?.readyState !== WebSocket.OPEN) {
      return;
    }

    const message = JSON.stringify({
      type: "unsubscribe",
      channel: channel,
    });

    this.socket.send(message);
    this.subscriptions.delete(channel);
    console.log(`Unsubscribed from channel: ${channel}`);
  }

  /**
   * Send a message to the server
   */
  send(message: WebSocketMessage): void {
    if (this.socket?.readyState !== WebSocket.OPEN) {
      console.warn("Cannot send message: WebSocket not connected");
      return;
    }

    this.socket.send(JSON.stringify(message));
  }

  /**
   * Get connection status
   */
  get isConnected(): boolean {
    return this.socket?.readyState === WebSocket.OPEN;
  }

  /**
   * Get current subscriptions
   */
  get currentSubscriptions(): string[] {
    return Array.from(this.subscriptions);
  }

  /**
   * Setup WebSocket event handlers
   */
  private setupEventHandlers(): void {
    if (!this.socket) return;

    this.socket.onclose = (event) => {
      console.log(
        "WebSocket disconnected:",
        event.reason || "Connection closed"
      );
      this.handlers.onDisconnect?.(event.reason || "Connection closed");

      // Attempt to reconnect if not manually closed
      if (
        event.code !== 1000 &&
        this.reconnectAttempts < this.config.reconnectAttempts
      ) {
        this.attemptReconnect();
      }
    };

    this.socket.onerror = (error) => {
      console.error("WebSocket error:", error);
      this.handlers.onError?.(new Error("WebSocket error occurred"));
    };

    this.socket.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        console.log("Received WebSocket message:", message);
        this.handleMessage(message);
      } catch (error) {
        console.error("Error parsing WebSocket message:", error);
        this.handlers.onError?.(error as Error);
      }
    };
  }

  /**
   * Attempt to reconnect to WebSocket server
   */
  private attemptReconnect(): void {
    if (this.reconnectTimer) {
      return; // Already attempting to reconnect
    }

    this.reconnectAttempts++;
    const delay =
      this.config.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);

    console.log(
      `Attempting to reconnect (${this.reconnectAttempts}/${this.config.reconnectAttempts}) in ${delay}ms`
    );

    this.reconnectTimer = setTimeout(async () => {
      this.reconnectTimer = null;

      try {
        await this.connect();

        // Re-subscribe to all channels after reconnection
        this.subscriptions.forEach((channel) => {
          this.subscribe(channel);
        });

        console.log("WebSocket reconnected successfully");
      } catch (error) {
        console.error("Reconnection failed:", error);

        if (this.reconnectAttempts < this.config.reconnectAttempts) {
          this.attemptReconnect();
        } else {
          console.error("Max reconnection attempts reached");
          this.handlers.onError?.(
            new Error("Failed to reconnect after maximum attempts")
          );
        }
      }
    }, delay);
  }

  /**
   * Handle incoming WebSocket messages
   */
  private handleMessage(message: WebSocketMessage): void {
    try {
      switch (message.type) {
        case "market_data":
          this.handlers.onMarketData?.(message.data as MarketData);
          break;
        case "portfolio_update":
          this.handlers.onPortfolioUpdate?.(message.data as Portfolio);
          break;
        case "position_update":
          this.handlers.onPositionUpdate?.(message.data as Position);
          break;
        case "trade_executed":
          this.handlers.onTradeExecuted?.(message.data as Trade);
          break;
        case "signal_generated":
          this.handlers.onSignalGenerated?.(message.data as TradingSignal);
          break;
        case "ai_decision":
          this.handlers.onAIDecision?.(message.data as AIDecision);
          break;
        case "system_status":
          this.handlers.onSystemStatus?.(message.data as SystemStatus);
          break;
        case "regime_change":
          this.handlers.onRegimeChange?.(message.data as MarketRegime);
          break;
        default:
          console.warn("Unknown message type:", message.type);
      }
    } catch (error) {
      console.error("Error handling WebSocket message:", error);
      this.handlers.onError?.(error as Error);
    }
  }
}

// Default WebSocket configuration
export const defaultWebSocketConfig: WebSocketConfig = {
  url: import.meta.env.VITE_WS_URL || "ws://localhost:8000/ws",
  reconnectAttempts: 5,
  reconnectDelay: 1000,
  timeout: 10000,
};

// Singleton WebSocket client instance
let webSocketClient: WebSocketClient | null = null;

export const getWebSocketClient = (): WebSocketClient => {
  if (!webSocketClient) {
    webSocketClient = new WebSocketClient(defaultWebSocketConfig);
  }
  return webSocketClient;
};
