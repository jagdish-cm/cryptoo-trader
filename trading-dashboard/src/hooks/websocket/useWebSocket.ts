/**
 * Custom hook for using WebSocket functionality
 */

import { useCallback, useEffect } from "react";
import { useWebSocketContext } from "../../contexts/websocket/WebSocketContext";

export interface UseWebSocketReturn {
  isConnected: boolean;
  isConnecting: boolean;
  error: string | null;
  lastHeartbeat: Date | null;
  subscriptions: string[];
  reconnectAttempts: number;
  connect: () => Promise<void>;
  disconnect: () => void;
  subscribe: (channel: string) => void;
  unsubscribe: (channel: string) => void;
  connectionStats: {
    isConnected: boolean;
    reconnectAttempts: number;
    subscriptions: number;
    queuedMessages: number;
  };
}

/**
 * Hook for accessing WebSocket functionality
 */
export const useWebSocket = (): UseWebSocketReturn => {
  const context = useWebSocketContext();

  const connectionStats = context.client.getConnectionStats();

  return {
    isConnected: context.state.isConnected,
    isConnecting: context.state.isConnecting,
    error: context.state.error,
    lastHeartbeat: context.state.lastHeartbeat,
    subscriptions: context.state.subscriptions,
    reconnectAttempts: context.state.reconnectAttempts,
    connect: context.connect,
    disconnect: context.disconnect,
    subscribe: context.subscribe,
    unsubscribe: context.unsubscribe,
    connectionStats,
  };
};

/**
 * Hook for subscribing to WebSocket channels with automatic cleanup
 */
export const useWebSocketSubscription = (
  channel: string,
  enabled: boolean = true
): {
  isSubscribed: boolean;
  subscribe: () => void;
  unsubscribe: () => void;
} => {
  const { subscribe, unsubscribe, subscriptions } = useWebSocket();

  const isSubscribed = subscriptions.includes(channel);

  const handleSubscribe = useCallback(() => {
    if (!isSubscribed) {
      subscribe(channel);
    }
  }, [subscribe, channel, isSubscribed]);

  const handleUnsubscribe = useCallback(() => {
    if (isSubscribed) {
      unsubscribe(channel);
    }
  }, [unsubscribe, channel, isSubscribed]);

  // Auto-subscribe when enabled
  useEffect(() => {
    if (enabled && !isSubscribed) {
      handleSubscribe();
    }
  }, [enabled, isSubscribed, handleSubscribe]);

  // Auto-unsubscribe on unmount
  useEffect(() => {
    return () => {
      if (isSubscribed) {
        handleUnsubscribe();
      }
    };
  }, [isSubscribed, handleUnsubscribe]);

  return {
    isSubscribed,
    subscribe: handleSubscribe,
    unsubscribe: handleUnsubscribe,
  };
};

/**
 * Hook for WebSocket connection status with callbacks
 */
export const useWebSocketStatus = (callbacks?: {
  onConnect?: () => void;
  onDisconnect?: () => void;
  onError?: (error: string) => void;
}) => {
  const { isConnected, isConnecting, error } = useWebSocket();

  useEffect(() => {
    if (isConnected && callbacks?.onConnect) {
      callbacks.onConnect();
    }
  }, [isConnected, callbacks?.onConnect]);

  useEffect(() => {
    if (!isConnected && !isConnecting && callbacks?.onDisconnect) {
      callbacks.onDisconnect();
    }
  }, [isConnected, isConnecting, callbacks?.onDisconnect]);

  useEffect(() => {
    if (error && callbacks?.onError) {
      callbacks.onError(error);
    }
  }, [error, callbacks?.onError]);

  return {
    isConnected,
    isConnecting,
    error,
    status: isConnected
      ? "connected"
      : isConnecting
        ? "connecting"
        : error
          ? "error"
          : "disconnected",
  };
};

export default useWebSocket;
