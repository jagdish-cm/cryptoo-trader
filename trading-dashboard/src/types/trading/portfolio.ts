/**
 * Portfolio-related type definitions
 */

import { Position } from "./positions";

export interface Portfolio {
  totalValue: number;
  availableBalance: number;
  positions: Position[];
  dailyPnL: number;
  totalPnL: number;
  maxDrawdown: number;
  lastUpdated: Date;
  // Additional properties used in hooks
  totalCost?: number;
  dayChange?: number;
  dayChangePercent?: number;
  availableCash?: number;
}

export interface PerformanceMetrics {
  totalReturn: number;
  dailyPnL: number;
  winRate: number;
  sharpeRatio: number;
  maxDrawdown: number;
  volatility: number;
  totalTrades: number;
  avgTradeReturn: number;
}

export interface PortfolioSnapshot {
  timestamp: Date;
  totalValue: number;
  availableBalance: number;
  unrealizedPnL: number;
  realizedPnL: number;
  positionCount: number;
  dailyReturn: number;
}

export interface RiskMetrics {
  valueAtRisk: number;
  expectedShortfall: number;
  beta: number;
  alpha: number;
  informationRatio: number;
  trackingError: number;
  maxDrawdown: number;
  calmarRatio: number;
}

export interface PortfolioAllocation {
  symbol: string;
  allocation: number; // percentage
  value: number;
  unrealizedPnL: number;
  weight: number;
}

export interface TradingConfig {
  autoTrading: boolean;
  maxPositions: number;
  riskPerTrade: number;
  emergencyStop: boolean;
  allowedSymbols: string[];
  maxLeverage: number;
  stopLossPercentage: number;
  takeProfitPercentage: number;
}
