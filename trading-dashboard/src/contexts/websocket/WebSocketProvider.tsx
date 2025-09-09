/**
 * WebSocket provider component that manages WebSocket connection and state
 */

import React, { useEffect, useReducer, ReactNode } from "react";
import { useAppDispatch } from "../../store/hooks";
import {
  WebSocketClient,
  getWebSocketClient,
} from "../../services/websocket/WebSocketClient";
import { createWebSocketEventHandlers } from "../../services/websocket/WebSocketEventHandlers";
import {
  createSubscriptionManager,
  WebSocketSubscriptionManager,
} from "../../services/websocket/WebSocketSubscriptions";
import { WebSocketContextProvider } from "./WebSocketContext";
import {
  webSocketReducer,
  initialWebSocketState,
  WebSocketAction,
} from "./websocketReducer";

interface WebSocketProviderProps {
  children: ReactNode;
  autoConnect?: boolean;
  config?: {
    url?: string;
    reconnectAttempts?: number;
    reconnectDelay?: number;
    timeout?: number;
  };
}

export const WebSocketProvider: React.FC<WebSocketProviderProps> = ({
  children,
  autoConnect = true,
  config = {},
}) => {
  const [state, dispatch] = useReducer(webSocketReducer, initialWebSocketState);
  const reduxDispatch = useAppDispatch();

  // Initialize WebSocket client and subscription manager
  const client = getWebSocketClient(config);
  const subscriptionManager = createSubscriptionManager(client);

  // Setup WebSocket event handlers
  useEffect(() => {
    const handlers = createWebSocketEventHandlers(reduxDispatch, dispatch);

    // Enhanced handlers with subscription management
    const enhancedHandlers = {
      ...handlers,
      onConnect: () => {
        dispatch({
          type: "CONNECTED",
          subscriptions: client.currentSubscriptions,
        });

        // Subscribe to essential channels
        subscriptionManager.subscribeToEssentialChannels();

        // Call original handler
        handlers.onConnect?.();
      },
      onDisconnect: (reason: string) => {
        dispatch({ type: "DISCONNECTED", reason });
        handlers.onDisconnect?.(reason);
      },
      onError: (error: Error) => {
        dispatch({ type: "ERROR", error: error.message });
        handlers.onError?.(error);
      },
    };

    client.setHandlers(enhancedHandlers);
  }, [client, reduxDispatch, subscriptionManager]);

  // Auto-connect on mount
  useEffect(() => {
    if (autoConnect && !state.isConnected && !state.isConnecting) {
      connect();
    }
  }, [autoConnect, state.isConnected, state.isConnecting]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      client.disconnect();
    };
  }, [client]);

  const connect = async (): Promise<void> => {
    if (state.isConnected || state.isConnecting) {
      return;
    }

    dispatch({ type: "CONNECTING" });

    try {
      await client.connect();
    } catch (error) {
      dispatch({
        type: "ERROR",
        error: error instanceof Error ? error.message : "Connection failed",
      });
      throw error;
    }
  };

  const disconnect = (): void => {
    client.disconnect();
    dispatch({ type: "DISCONNECTED", reason: "Manual disconnect" });
  };

  const subscribe = (channel: string): void => {
    if (subscriptionManager.subscribe(channel)) {
      dispatch({ type: "SUBSCRIBE", channel });
    }
  };

  const unsubscribe = (channel: string): void => {
    if (subscriptionManager.unsubscribe(channel)) {
      dispatch({ type: "UNSUBSCRIBE", channel });
    }
  };

  return (
    <WebSocketContextProvider
      client={client}
      state={state}
      connect={connect}
      disconnect={disconnect}
      subscribe={subscribe}
      unsubscribe={unsubscribe}
    >
      {children}
    </WebSocketContextProvider>
  );
};
