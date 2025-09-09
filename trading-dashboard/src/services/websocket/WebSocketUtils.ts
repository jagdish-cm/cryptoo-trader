/**
 * WebSocket utility functions for connection management and error handling
 */

import { WebSocketConfig } from "../../types/api/websocket";

/**
 * Default WebSocket configuration
 */
export const defaultWebSocketConfig: WebSocketConfig = {
  url: import.meta.env.VITE_WS_URL || "ws://localhost:8000/ws",
  reconnectAttempts: 5,
  reconnectDelay: 1000,
  timeout: 10000,
};

/**
 * Validates WebSocket URL format
 */
export const validateWebSocketUrl = (url: string): boolean => {
  try {
    const urlObj = new URL(url);
    return urlObj.protocol === "ws:" || urlObj.protocol === "wss:";
  } catch {
    return false;
  }
};

/**
 * Converts HTTP URL to WebSocket URL
 */
export const convertToWebSocketUrl = (url: string): string => {
  return url.replace("http://", "ws://").replace("https://", "wss://");
};

/**
 * Calculates exponential backoff delay for reconnection attempts
 */
export const calculateReconnectDelay = (
  attempt: number,
  baseDelay: number = 1000,
  maxDelay: number = 30000
): number => {
  const delay = baseDelay * Math.pow(2, attempt - 1);
  return Math.min(delay, maxDelay);
};

/**
 * Checks if WebSocket error is recoverable
 */
export const isRecoverableError = (error: Event | Error): boolean => {
  if (error instanceof Error) {
    // Network errors are usually recoverable
    return (
      error.message.includes("network") ||
      error.message.includes("connection") ||
      error.message.includes("timeout")
    );
  }

  if ("code" in error && typeof error.code === "number") {
    // WebSocket close codes that indicate recoverable errors
    const recoverableCodes = [
      1006, // Abnormal closure
      1011, // Server error
      1012, // Service restart
      1013, // Try again later
      1014, // Bad gateway
    ];
    return recoverableCodes.includes(error.code);
  }

  return true; // Default to recoverable for unknown errors
};

/**
 * Gets human-readable error message from WebSocket close event
 */
export const getCloseEventMessage = (event: CloseEvent): string => {
  const { code, reason } = event;

  if (reason) {
    return reason;
  }

  // Standard WebSocket close codes
  switch (code) {
    case 1000:
      return "Normal closure";
    case 1001:
      return "Going away";
    case 1002:
      return "Protocol error";
    case 1003:
      return "Unsupported data";
    case 1005:
      return "No status received";
    case 1006:
      return "Abnormal closure";
    case 1007:
      return "Invalid frame payload data";
    case 1008:
      return "Policy violation";
    case 1009:
      return "Message too big";
    case 1010:
      return "Mandatory extension";
    case 1011:
      return "Internal server error";
    case 1012:
      return "Service restart";
    case 1013:
      return "Try again later";
    case 1014:
      return "Bad gateway";
    case 1015:
      return "TLS handshake";
    default:
      return `Unknown error (code: ${code})`;
  }
};

/**
 * Creates a WebSocket connection with timeout
 */
export const createWebSocketWithTimeout = (
  url: string,
  timeout: number = 10000
): Promise<WebSocket> => {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url);

    const timeoutId = setTimeout(() => {
      ws.close();
      reject(new Error(`WebSocket connection timeout after ${timeout}ms`));
    }, timeout);

    ws.onopen = () => {
      clearTimeout(timeoutId);
      resolve(ws);
    };

    ws.onerror = (error) => {
      clearTimeout(timeoutId);
      reject(new Error("WebSocket connection failed"));
    };
  });
};

/**
 * Validates WebSocket message format
 */
export const validateWebSocketMessage = (data: unknown): boolean => {
  if (typeof data !== "object" || data === null) {
    return false;
  }

  const message = data as Record<string, unknown>;

  // Check required fields
  const requiredFields = ["type", "channel", "data", "timestamp", "id"];
  return requiredFields.every((field) => field in message);
};

/**
 * Sanitizes WebSocket message data for logging
 */
export const sanitizeMessageForLogging = (message: unknown): unknown => {
  if (typeof message !== "object" || message === null) {
    return message;
  }

  const sanitized = { ...(message as Record<string, unknown>) };

  // Remove sensitive fields
  const sensitiveFields = ["password", "token", "apiKey", "secret"];
  sensitiveFields.forEach((field) => {
    if (field in sanitized) {
      sanitized[field] = "[REDACTED]";
    }
  });

  return sanitized;
};

/**
 * Generates unique message ID
 */
export const generateMessageId = (): string => {
  return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

/**
 * Checks if WebSocket is in a connected state
 */
export const isWebSocketConnected = (ws: WebSocket | null): boolean => {
  return ws !== null && ws.readyState === WebSocket.OPEN;
};

/**
 * Checks if WebSocket is in a connecting state
 */
export const isWebSocketConnecting = (ws: WebSocket | null): boolean => {
  return ws !== null && ws.readyState === WebSocket.CONNECTING;
};

/**
 * Gets WebSocket ready state as string
 */
export const getWebSocketReadyState = (ws: WebSocket | null): string => {
  if (!ws) return "NULL";

  switch (ws.readyState) {
    case WebSocket.CONNECTING:
      return "CONNECTING";
    case WebSocket.OPEN:
      return "OPEN";
    case WebSocket.CLOSING:
      return "CLOSING";
    case WebSocket.CLOSED:
      return "CLOSED";
    default:
      return "UNKNOWN";
  }
};

/**
 * Creates a heartbeat mechanism for WebSocket connection
 */
export const createHeartbeat = (
  ws: WebSocket,
  interval: number = 30000,
  onTimeout?: () => void
): { start: () => void; stop: () => void } => {
  let heartbeatInterval: NodeJS.Timeout | null = null;
  let timeoutId: NodeJS.Timeout | null = null;

  const start = () => {
    if (heartbeatInterval) return;

    heartbeatInterval = setInterval(() => {
      if (isWebSocketConnected(ws)) {
        // Send ping message
        ws.send(
          JSON.stringify({
            type: "ping",
            timestamp: Date.now(),
          })
        );

        // Set timeout for pong response
        timeoutId = setTimeout(() => {
          console.warn("WebSocket heartbeat timeout");
          onTimeout?.();
        }, 5000);
      }
    }, interval);
  };

  const stop = () => {
    if (heartbeatInterval) {
      clearInterval(heartbeatInterval);
      heartbeatInterval = null;
    }

    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
  };

  // Handle pong messages
  const originalOnMessage = ws.onmessage;
  ws.onmessage = (event) => {
    try {
      const message = JSON.parse(event.data);
      if (message.type === "pong" && timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
    } catch {
      // Ignore parsing errors for heartbeat
    }

    // Call original message handler
    originalOnMessage?.call(ws, event);
  };

  return { start, stop };
};
