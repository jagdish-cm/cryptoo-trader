import React, {
  createContext,
  useContext,
  useEffect,
  useReducer,
  ReactNode,
} from "react";
import {
  WebSocketClient,
  getWebSocketClient,
  WebSocketEventHandlers,
} from "../services/websocket";
import { useAppDispatch } from "../store/hooks";
import {
  setSystemStatus,
  setConnected,
  addSignal,
  addDecision,
  handleWebSocketMessage,
} from "../store/slices/systemSlice";
import {
  setPortfolio,
  updatePosition,
  addTrade,
  updatePortfolioValue,
  updatePositionPnL,
} from "../store/slices/portfolioSlice";
import { addNotification } from "../store/slices/dashboardSlice";
import type {
  MarketData,
  Position,
  Trade,
  TradingSignal,
  SystemStatus,
  AIDecision,
  Portfolio,
} from "../types";

interface WebSocketState {
  isConnected: boolean;
  isConnecting: boolean;
  error: string | null;
  lastHeartbeat: Date | null;
  subscriptions: string[];
}

type WebSocketAction =
  | { type: "CONNECTING" }
  | { type: "CONNECTED"; subscriptions: string[] }
  | { type: "DISCONNECTED"; reason: string }
  | { type: "ERROR"; error: string }
  | { type: "HEARTBEAT" }
  | { type: "SUBSCRIBE"; channel: string }
  | { type: "UNSUBSCRIBE"; channel: string };

const initialState: WebSocketState = {
  isConnected: false,
  isConnecting: false,
  error: null,
  lastHeartbeat: null,
  subscriptions: [],
};

function webSocketReducer(
  state: WebSocketState,
  action: WebSocketAction
): WebSocketState {
  switch (action.type) {
    case "CONNECTING":
      return {
        ...state,
        isConnecting: true,
        error: null,
      };
    case "CONNECTED":
      return {
        ...state,
        isConnected: true,
        isConnecting: false,
        error: null,
        subscriptions: action.subscriptions,
        lastHeartbeat: new Date(),
      };
    case "DISCONNECTED":
      return {
        ...state,
        isConnected: false,
        isConnecting: false,
        error: action.reason,
        subscriptions: [],
      };
    case "ERROR":
      return {
        ...state,
        isConnecting: false,
        error: action.error,
      };
    case "HEARTBEAT":
      return {
        ...state,
        lastHeartbeat: new Date(),
      };
    case "SUBSCRIBE":
      return {
        ...state,
        subscriptions: [...state.subscriptions, action.channel],
      };
    case "UNSUBSCRIBE":
      return {
        ...state,
        subscriptions: state.subscriptions.filter(
          (sub) => sub !== action.channel
        ),
      };
    default:
      return state;
  }
}

interface WebSocketContextValue {
  state: WebSocketState;
  client: WebSocketClient;
  connect: () => Promise<void>;
  disconnect: () => void;
  subscribe: (channel: string) => void;
  unsubscribe: (channel: string) => void;
}

const WebSocketContext = createContext<WebSocketContextValue | null>(null);

interface WebSocketProviderProps {
  children: ReactNode;
  autoConnect?: boolean;
}

export const WebSocketProvider: React.FC<WebSocketProviderProps> = ({
  children,
  autoConnect = true,
}) => {
  const [state, dispatch] = useReducer(webSocketReducer, initialState);
  const reduxDispatch = useAppDispatch();
  const client = getWebSocketClient();

  // Setup WebSocket event handlers
  useEffect(() => {
    const handlers: WebSocketEventHandlers = {
      onConnect: () => {
        dispatch({
          type: "CONNECTED",
          subscriptions: client.currentSubscriptions,
        });
        reduxDispatch(setConnected(true));

        // Subscribe to essential channels
        const essentialChannels = [
          "system_status",
          "portfolio_updates",
          "market_data",
          "trading_signals",
          "ai_decisions",
        ];

        essentialChannels.forEach((channel) => {
          client.subscribe(channel);
          dispatch({ type: "SUBSCRIBE", channel });
        });

        // Show connection notification
        reduxDispatch(
          addNotification({
            type: "success",
            title: "Connected",
            message: "Real-time data connection established",
          })
        );
      },

      onDisconnect: (reason: string) => {
        dispatch({ type: "DISCONNECTED", reason });
        reduxDispatch(setConnected(false));

        // Show disconnection notification
        reduxDispatch(
          addNotification({
            type: "warning",
            title: "Disconnected",
            message: `Connection lost: ${reason}`,
          })
        );
      },

      onError: (error: Error) => {
        dispatch({ type: "ERROR", error: error.message });

        // Show error notification
        reduxDispatch(
          addNotification({
            type: "error",
            title: "Connection Error",
            message: error.message,
          })
        );
      },

      onMarketData: (data: MarketData) => {
        // Update market data in Redux store
        reduxDispatch(
          handleWebSocketMessage({
            type: "market_data",
            data,
          })
        );

        dispatch({ type: "HEARTBEAT" });
      },

      onPortfolioUpdate: (data: Portfolio) => {
        reduxDispatch(setPortfolio(data));
        dispatch({ type: "HEARTBEAT" });
      },

      onPositionUpdate: (data: Position) => {
        reduxDispatch(updatePosition(data));

        // Update position P&L if it's a price update
        if (data.unrealizedPnL !== undefined) {
          reduxDispatch(
            updatePositionPnL({
              positionId: data.id,
              unrealizedPnL: data.unrealizedPnL,
              currentPrice: data.currentPrice,
            })
          );
        }

        dispatch({ type: "HEARTBEAT" });
      },

      onTradeExecuted: (data: Trade) => {
        reduxDispatch(addTrade(data));

        // Show trade notification
        reduxDispatch(
          addNotification({
            type: data.realizedPnL > 0 ? "success" : "error",
            title: "Trade Executed",
            message: `${data.direction} ${data.symbol}: ${data.realizedPnL > 0 ? "+" : ""}$${data.realizedPnL.toFixed(2)}`,
          })
        );

        dispatch({ type: "HEARTBEAT" });
      },

      onSignalGenerated: (data: TradingSignal) => {
        reduxDispatch(addSignal(data));

        // Show signal notification for strong signals
        if (data.confidence > 0.7) {
          reduxDispatch(
            addNotification({
              type: "info",
              title: "Trading Signal",
              message: `${data.direction} ${data.symbol} - Confidence: ${(data.confidence * 100).toFixed(1)}%`,
            })
          );
        }

        dispatch({ type: "HEARTBEAT" });
      },

      onAIDecision: (data: AIDecision) => {
        reduxDispatch(addDecision(data));
        dispatch({ type: "HEARTBEAT" });
      },

      onSystemStatus: (data: SystemStatus) => {
        reduxDispatch(setSystemStatus(data));

        // Show status change notifications
        if (data.status === "ERROR") {
          reduxDispatch(
            addNotification({
              type: "error",
              title: "System Error",
              message: "Trading system encountered an error",
            })
          );
        } else if (data.status === "RUNNING") {
          reduxDispatch(
            addNotification({
              type: "success",
              title: "System Running",
              message: "Trading system is operational",
            })
          );
        }

        dispatch({ type: "HEARTBEAT" });
      },

      onRegimeChange: (data: any) => {
        reduxDispatch(
          handleWebSocketMessage({
            type: "regime_change",
            data,
          })
        );

        // Show regime change notification
        reduxDispatch(
          addNotification({
            type: "info",
            title: "Market Regime Change",
            message: `Market regime changed to ${data.current}`,
          })
        );

        dispatch({ type: "HEARTBEAT" });
      },
    };

    client.setHandlers(handlers);
  }, [client, reduxDispatch]);

  // Auto-connect on mount
  useEffect(() => {
    if (autoConnect && !state.isConnected && !state.isConnecting) {
      connect();
    }
  }, [autoConnect]);

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
      dispatch({ type: "ERROR", error: (error as Error).message });
      throw error;
    }
  };

  const disconnect = (): void => {
    client.disconnect();
    dispatch({ type: "DISCONNECTED", reason: "Manual disconnect" });
  };

  const subscribe = (channel: string): void => {
    client.subscribe(channel);
    dispatch({ type: "SUBSCRIBE", channel });
  };

  const unsubscribe = (channel: string): void => {
    client.unsubscribe(channel);
    dispatch({ type: "UNSUBSCRIBE", channel });
  };

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

export const useWebSocket = (): WebSocketContextValue => {
  const context = useContext(WebSocketContext);
  if (!context) {
    throw new Error("useWebSocket must be used within a WebSocketProvider");
  }
  return context;
};

export default WebSocketContext;
