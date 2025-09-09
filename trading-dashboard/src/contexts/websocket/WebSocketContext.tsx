/**
 * WebSocket context for managing WebSocket connection state
 */

import React, { createContext, useContext, ReactNode } from "react";
import { WebSocketClient } from "../../services/websocket/WebSocketClient";
import { WebSocketState } from "./websocketReducer";

interface WebSocketContextValue {
  state: WebSocketState;
  client: WebSocketClient;
  connect: () => Promise<void>;
  disconnect: () => void;
  subscribe: (channel: string) => void;
  unsubscribe: (channel: string) => void;
}

const WebSocketContext = createContext<WebSocketContextValue | null>(null);

interface WebSocketContextProps {
  children: ReactNode;
  client: WebSocketClient;
  state: WebSocketState;
  connect: () => Promise<void>;
  disconnect: () => void;
  subscribe: (channel: string) => void;
  unsubscribe: (channel: string) => void;
}

export const WebSocketContextProvider: React.FC<WebSocketContextProps> = ({
  children,
  client,
  state,
  connect,
  disconnect,
  subscribe,
  unsubscribe,
}) => {
  const contextValue: WebSocketContextValue = {
    state,
    client,
    connect,
    disconnect,
    subscribe,
    unsubscribe,
  };

  return (
    <WebSocketContext.Provider value={contextValue}>
      {children}
    </WebSocketContext.Provider>
  );
};

export const useWebSocketContext = (): WebSocketContextValue => {
  const context = useContext(WebSocketContext);
  if (!context) {
    throw new Error(
      "useWebSocketContext must be used within a WebSocketProvider"
    );
  }
  return context;
};

export default WebSocketContext;
