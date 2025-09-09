/**
 * Modular WebSocket client for trading application
 */

import {
  WebSocketConfig,
  WebSocketMessage,
  MarketData,
  Position,
  Trade,
  TradingSignal,
  SystemStatus,
  AIDecision,
  Portfolio,
  MarketRegime,
} from "../../types";
import { WebSocketEventHandlers } from "./WebSocketEventHandlers";
import {
  defaultWebSocketConfig,
  validateWebSocketUrl,
  convertToWebSocketUrl,
  calculateReconnectDelay,
  isRecoverableError,
  getCloseEventMessage,
  createWebSocketWithTimeout,
  validateWebSocketMessage,
  sanitizeMessageForLogging,
  generateMessageId,
  isWebSocketConnected,
  createHeartbeat,
} from "./WebSocketUtils";

export class WebSocketClient {
  private socket: WebSocket | null = null;
  private config: WebSocketConfig;
  private handlers: WebSocketEventHandlers = {};
  private reconnectAttempts = 0;
  private isConnecting = false;
  private subscriptions = new Set<string>();
  private reconnectTimer: NodeJS.Timeout | null = null;
  private heartbeat: { start: () => void; stop: () => void } | null = null;
  private messageQueue: WebSocketMessage[] = [];

  constructor(config: Partial<WebSocketConfig> = {}) {
    this.config = { ...defaultWebSocketConfig, ...config };

    // Validate and convert URL if needed
    if (!validateWebSocketUrl(this.config.url)) {
      this.config.url = convertToWebSocketUrl(this.config.url);
    }
  }

  /**
   * Connect to WebSocket server
   */
  async connect(): Promise<void> {
    if (isWebSocketConnected(this.socket) || this.isConnecting) {
      return;
    }

    this.isConnecting = true;

    try {
      console.log(`Connecting to WebSocket: ${this.config.url}`);

      this.socket = await createWebSocketWithTimeout(
        this.config.url,
        this.config.timeout
      );

      this.setupEventHandlers();
      this.setupHeartbeat();

      this.isConnecting = false;
      this.reconnectAttempts = 0;

      console.log("WebSocket connected successfully");
      this.handlers.onConnect?.();

      // Process queued messages
      this.processMessageQueue();
    } catch (error) {
      this.isConnecting = false;
      const errorMessage =
        error instanceof Error ? error.message : "Connection failed";
      console.error("WebSocket connection error:", errorMessage);
      this.handlers.onError?.(
        error instanceof Error ? error : new Error(errorMessage)
      );
      throw error;
    }
  }

  /**
   * Disconnect from WebSocket server
   */
  disconnect(): void {
    this.clearReconnectTimer();
    this.stopHeartbeat();

    if (this.socket) {
      this.socket.close(1000, "Manual disconnect");
      this.socket = null;
    }

    this.subscriptions.clear();
    this.messageQueue = [];
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
    if (!isWebSocketConnected(this.socket)) {
      console.warn("Cannot subscribe: WebSocket not connected");
      return;
    }

    const message: WebSocketMessage = {
      type: "subscribe" as any,
      channel,
      data: { channel },
      timestamp: Date.now(),
      id: generateMessageId(),
    };

    this.send(message);
    this.subscriptions.add(channel);
    console.log(`Subscribed to channel: ${channel}`);
  }

  /**
   * Unsubscribe from a data channel
   */
  unsubscribe(channel: string): void {
    if (!isWebSocketConnected(this.socket)) {
      return;
    }

    const message: WebSocketMessage = {
      type: "unsubscribe" as any,
      channel,
      data: { channel },
      timestamp: Date.now(),
      id: generateMessageId(),
    };

    this.send(message);
    this.subscriptions.delete(channel);
    console.log(`Unsubscribed from channel: ${channel}`);
  }

  /**
   * Send a message to the server
   */
  send(message: WebSocketMessage): void {
    if (!isWebSocketConnected(this.socket)) {
      console.warn(
        "Cannot send message: WebSocket not connected. Queuing message."
      );
      this.messageQueue.push(message);
      return;
    }

    try {
      const messageString = JSON.stringify(message);
      this.socket!.send(messageString);
      console.log(
        "Sent WebSocket message:",
        sanitizeMessageForLogging(message)
      );
    } catch (error) {
      console.error("Error sending WebSocket message:", error);
      this.handlers.onError?.(
        error instanceof Error ? error : new Error("Send failed")
      );
    }
  }

  /**
   * Get connection status
   */
  get isConnected(): boolean {
    return isWebSocketConnected(this.socket);
  }

  /**
   * Get current subscriptions
   */
  get currentSubscriptions(): string[] {
    return Array.from(this.subscriptions);
  }

  /**
   * Get connection statistics
   */
  getConnectionStats(): {
    isConnected: boolean;
    reconnectAttempts: number;
    subscriptions: number;
    queuedMessages: number;
  } {
    return {
      isConnected: this.isConnected,
      reconnectAttempts: this.reconnectAttempts,
      subscriptions: this.subscriptions.size,
      queuedMessages: this.messageQueue.length,
    };
  }

  /**
   * Setup WebSocket event handlers
   */
  private setupEventHandlers(): void {
    if (!this.socket) return;

    this.socket.onclose = (event) => {
      console.log("WebSocket closed:", getCloseEventMessage(event));
      this.stopHeartbeat();

      const reason = getCloseEventMessage(event);
      this.handlers.onDisconnect?.(reason);

      // Attempt to reconnect if not manually closed and error is recoverable
      if (
        event.code !== 1000 &&
        isRecoverableError(event) &&
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

        if (!validateWebSocketMessage(message)) {
          console.warn("Invalid WebSocket message format:", message);
          return;
        }

        console.log(
          "Received WebSocket message:",
          sanitizeMessageForLogging(message)
        );
        this.handleMessage(message);
      } catch (error) {
        console.error("Error parsing WebSocket message:", error);
        this.handlers.onError?.(
          error instanceof Error ? error : new Error("Message parsing failed")
        );
      }
    };
  }

  /**
   * Setup heartbeat mechanism
   */
  private setupHeartbeat(): void {
    if (!this.socket) return;

    this.heartbeat = createHeartbeat(
      this.socket,
      30000, // 30 seconds
      () => {
        console.warn("WebSocket heartbeat timeout - connection may be lost");
        this.socket?.close();
      }
    );

    this.heartbeat.start();
  }

  /**
   * Stop heartbeat mechanism
   */
  private stopHeartbeat(): void {
    if (this.heartbeat) {
      this.heartbeat.stop();
      this.heartbeat = null;
    }
  }

  /**
   * Process queued messages after connection
   */
  private processMessageQueue(): void {
    if (this.messageQueue.length === 0) return;

    console.log(`Processing ${this.messageQueue.length} queued messages`);

    const messages = [...this.messageQueue];
    this.messageQueue = [];

    messages.forEach((message) => {
      this.send(message);
    });
  }

  /**
   * Attempt to reconnect to WebSocket server
   */
  private attemptReconnect(): void {
    if (this.reconnectTimer) {
      return; // Already attempting to reconnect
    }

    this.reconnectAttempts++;
    const delay = calculateReconnectDelay(
      this.reconnectAttempts,
      this.config.reconnectDelay
    );

    console.log(
      `Attempting to reconnect (${this.reconnectAttempts}/${this.config.reconnectAttempts}) in ${delay}ms`
    );

    this.reconnectTimer = setTimeout(async () => {
      this.reconnectTimer = null;

      try {
        await this.connect();

        // Re-subscribe to all channels after reconnection
        const channelsToResubscribe = Array.from(this.subscriptions);
        this.subscriptions.clear();

        channelsToResubscribe.forEach((channel) => {
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
   * Clear reconnect timer
   */
  private clearReconnectTimer(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
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
        case "pong":
          // Heartbeat response - handled in heartbeat utility
          break;
        default:
          console.warn("Unknown message type:", message.type);
      }
    } catch (error) {
      console.error("Error handling WebSocket message:", error);
      this.handlers.onError?.(
        error instanceof Error ? error : new Error("Message handling failed")
      );
    }
  }
}

// Singleton WebSocket client instance
let webSocketClient: WebSocketClient | null = null;

export const getWebSocketClient = (
  config?: Partial<WebSocketConfig>
): WebSocketClient => {
  if (!webSocketClient) {
    webSocketClient = new WebSocketClient(config);
  }
  return webSocketClient;
};
