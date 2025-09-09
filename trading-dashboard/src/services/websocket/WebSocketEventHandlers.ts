/**
 * WebSocket event handlers for processing different message types
 */

import { Dispatch } from "react";
import {
  MarketData,
  Position,
  Trade,
  TradingSignal,
  SystemStatus,
  AIDecision,
  Portfolio,
  MarketRegime,
} from "../../types";
import { WebSocketAction } from "../../contexts/websocket/websocketReducer";

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

/**
 * Creates WebSocket event handlers with Redux dispatch integration
 */
export const createWebSocketEventHandlers = (
  reduxDispatch: any,
  wsDispatch: Dispatch<WebSocketAction>
): WebSocketEventHandlers => ({
  onConnect: () => {
    console.log("WebSocket connected");

    // Show connection notification
    reduxDispatch({
      type: "dashboard/addNotification",
      payload: {
        type: "success",
        title: "Connected",
        message: "Real-time data connection established",
      },
    });
  },

  onDisconnect: (reason: string) => {
    console.log("WebSocket disconnected:", reason);
    wsDispatch({ type: "DISCONNECTED", reason });

    // Show disconnection notification
    reduxDispatch({
      type: "dashboard/addNotification",
      payload: {
        type: "warning",
        title: "Disconnected",
        message: `Connection lost: ${reason}`,
      },
    });
  },

  onError: (error: Error) => {
    console.error("WebSocket error:", error);
    wsDispatch({ type: "ERROR", error: error.message });

    // Show error notification
    reduxDispatch({
      type: "dashboard/addNotification",
      payload: {
        type: "error",
        title: "Connection Error",
        message: error.message,
      },
    });
  },

  onMarketData: (data: MarketData) => {
    // Update market data in Redux store
    reduxDispatch({
      type: "system/handleWebSocketMessage",
      payload: {
        type: "market_data",
        data,
      },
    });

    wsDispatch({ type: "HEARTBEAT" });
  },

  onPortfolioUpdate: (data: Portfolio) => {
    reduxDispatch({
      type: "portfolio/setPortfolio",
      payload: data,
    });

    wsDispatch({ type: "HEARTBEAT" });
  },

  onPositionUpdate: (data: Position) => {
    reduxDispatch({
      type: "portfolio/updatePosition",
      payload: data,
    });

    // Update position P&L if it's a price update
    if (data.unrealizedPnL !== undefined) {
      reduxDispatch({
        type: "portfolio/updatePositionPnL",
        payload: {
          positionId: data.id,
          unrealizedPnL: data.unrealizedPnL,
          currentPrice: data.currentPrice,
        },
      });
    }

    wsDispatch({ type: "HEARTBEAT" });
  },

  onTradeExecuted: (data: Trade) => {
    reduxDispatch({
      type: "portfolio/addTrade",
      payload: data,
    });

    // Show trade notification
    reduxDispatch({
      type: "dashboard/addNotification",
      payload: {
        type: data.realizedPnL > 0 ? "success" : "error",
        title: "Trade Executed",
        message: `${data.direction} ${data.symbol}: ${data.realizedPnL > 0 ? "+" : ""}${data.realizedPnL.toFixed(2)}`,
      },
    });

    wsDispatch({ type: "HEARTBEAT" });
  },

  onSignalGenerated: (data: TradingSignal) => {
    reduxDispatch({
      type: "system/addSignal",
      payload: data,
    });

    // Show signal notification for strong signals
    if (data.confidence > 0.7) {
      reduxDispatch({
        type: "dashboard/addNotification",
        payload: {
          type: "info",
          title: "Trading Signal",
          message: `${data.direction} ${data.symbol} - Confidence: ${(data.confidence * 100).toFixed(1)}%`,
        },
      });
    }

    wsDispatch({ type: "HEARTBEAT" });
  },

  onAIDecision: (data: AIDecision) => {
    reduxDispatch({
      type: "system/addDecision",
      payload: data,
    });

    wsDispatch({ type: "HEARTBEAT" });
  },

  onSystemStatus: (data: SystemStatus) => {
    reduxDispatch({
      type: "system/setSystemStatus",
      payload: data,
    });

    // Show status change notifications
    if (data.status === "ERROR") {
      reduxDispatch({
        type: "dashboard/addNotification",
        payload: {
          type: "error",
          title: "System Error",
          message: "Trading system encountered an error",
        },
      });
    } else if (data.status === "RUNNING") {
      reduxDispatch({
        type: "dashboard/addNotification",
        payload: {
          type: "success",
          title: "System Running",
          message: "Trading system is operational",
        },
      });
    }

    wsDispatch({ type: "HEARTBEAT" });
  },

  onRegimeChange: (data: MarketRegime) => {
    reduxDispatch({
      type: "system/handleWebSocketMessage",
      payload: {
        type: "regime_change",
        data,
      },
    });

    // Show regime change notification
    reduxDispatch({
      type: "dashboard/addNotification",
      payload: {
        type: "info",
        title: "Market Regime Change",
        message: `Market regime changed to ${data.current}`,
      },
    });

    wsDispatch({ type: "HEARTBEAT" });
  },
});
