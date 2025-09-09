/**
 * WebSocket-related type definitions
 */

import {
  MarketData,
  AIDecision,
  SystemStatus,
  MarketRegime,
} from "../trading/common";
import { Position } from "../trading/positions";
import { Trade } from "../trading/trades";
import { TradingSignal } from "../trading/signals";
import { Portfolio } from "../trading/portfolio";

// WebSocket message types
export const MessageType = {
  MARKET_DATA: "market_data",
  PORTFOLIO_UPDATE: "portfolio_update",
  POSITION_UPDATE: "position_update",
  TRADE_EXECUTED: "trade_executed",
  SIGNAL_GENERATED: "signal_generated",
  AI_DECISION: "ai_decision",
  SYSTEM_STATUS: "system_status",
  REGIME_CHANGE: "regime_change",
  PONG: "pong",
} as const;

export type MessageType = (typeof MessageType)[keyof typeof MessageType];

// WebSocket message interface
export interface WebSocketMessage {
  type: MessageType;
  channel: string;
  data: unknown;
  timestamp: number;
  id: string;
}

// Specific message data types
export interface MarketDataMessage extends WebSocketMessage {
  type: typeof MessageType.MARKET_DATA;
  data: MarketData;
}

export interface PortfolioUpdateMessage extends WebSocketMessage {
  type: typeof MessageType.PORTFOLIO_UPDATE;
  data: Portfolio;
}

export interface PositionUpdateMessage extends WebSocketMessage {
  type: typeof MessageType.POSITION_UPDATE;
  data: Position;
}

export interface TradeExecutedMessage extends WebSocketMessage {
  type: typeof MessageType.TRADE_EXECUTED;
  data: Trade;
}

export interface SignalGeneratedMessage extends WebSocketMessage {
  type: typeof MessageType.SIGNAL_GENERATED;
  data: TradingSignal;
}

export interface AIDecisionMessage extends WebSocketMessage {
  type: typeof MessageType.AI_DECISION;
  data: AIDecision;
}

export interface SystemStatusMessage extends WebSocketMessage {
  type: typeof MessageType.SYSTEM_STATUS;
  data: SystemStatus;
}

export interface RegimeChangeMessage extends WebSocketMessage {
  type: typeof MessageType.REGIME_CHANGE;
  data: MarketRegime;
}

// Union type for all message types
export type TypedWebSocketMessage =
  | MarketDataMessage
  | PortfolioUpdateMessage
  | PositionUpdateMessage
  | TradeExecutedMessage
  | SignalGeneratedMessage
  | AIDecisionMessage
  | SystemStatusMessage
  | RegimeChangeMessage;

// WebSocket configuration
export interface WebSocketConfig {
  url: string;
  reconnectAttempts: number;
  reconnectDelay: number;
  timeout: number;
}

// WebSocket event handlers
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

// WebSocket subscription types
export interface WebSocketSubscription {
  channel: string;
  params?: Record<string, unknown>;
  active: boolean;
  lastMessage?: Date;
}

// WebSocket state
export interface WebSocketState {
  isConnected: boolean;
  isConnecting: boolean;
  error: string | null;
  lastHeartbeat: Date | null;
  subscriptions: string[];
  reconnectAttempts: number;
}
