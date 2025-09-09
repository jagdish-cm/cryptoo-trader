/**
 * Trade-related type definitions
 */

import { TradeDirection } from "./common";

export interface Trade {
  id: string;
  positionId: string;
  symbol: string;
  direction: TradeDirection;
  entryPrice: number;
  exitPrice: number;
  quantity: number;
  entryTime: Date;
  exitTime: Date;
  realizedPnL: number;
  fees: number;
  exitReason: string;
  setupType: string;
}

export interface TradeHistory {
  trades: Trade[];
  totalTrades: number;
  totalPnL: number;
  totalFees: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  avgTradeReturn: number;
  bestTrade: Trade | null;
  worstTrade: Trade | null;
}

export interface TradeFilter {
  symbol?: string;
  direction?: TradeDirection;
  setupType?: string;
  exitReason?: string;
  minPnL?: number;
  maxPnL?: number;
  dateRange?: {
    start: Date;
    end: Date;
  };
}

export interface TradeAnalytics {
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  avgWin: number;
  avgLoss: number;
  profitFactor: number;
  largestWin: number;
  largestLoss: number;
  avgTradeDuration: number;
  totalCommissions: number;
}

export interface TradeExecution {
  tradeId: string;
  symbol: string;
  direction: TradeDirection;
  quantity: number;
  price: number;
  timestamp: Date;
  executionType: "MARKET" | "LIMIT" | "STOP" | "STOP_LIMIT";
  status: "PENDING" | "FILLED" | "PARTIALLY_FILLED" | "CANCELLED" | "REJECTED";
}
