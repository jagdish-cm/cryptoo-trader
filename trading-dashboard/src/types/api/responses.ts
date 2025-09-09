/**
 * API response type definitions
 */

import { ApiResponse, PaginatedResponse } from "../common/base";
import { Position } from "../trading/positions";
import { Trade } from "../trading/trades";
import { TradingSignal } from "../trading/signals";
import { Portfolio, PerformanceMetrics } from "../trading/portfolio";
import { MarketData, AIDecision, SystemStatus } from "../trading/common";

// Generic API responses
export interface SuccessResponse {
  success: true;
  message?: string;
  timestamp: string;
}

export interface ErrorResponse {
  success: false;
  error: string;
  code?: string;
  details?: Record<string, unknown>;
  timestamp: string;
}

// Trading API responses
export interface GetPositionsResponse extends ApiResponse<Position[]> {
  summary: {
    totalPositions: number;
    openPositions: number;
    totalUnrealizedPnL: number;
  };
}

export interface GetTradeHistoryResponse
  extends ApiResponse<PaginatedResponse<Trade>> {
  analytics: {
    totalTrades: number;
    winRate: number;
    totalPnL: number;
    avgTradeReturn: number;
  };
}

export interface GetMarketDataResponse
  extends ApiResponse<Record<string, MarketData>> {
  lastUpdated: string;
  source: string;
}

export interface GetSignalsResponse
  extends ApiResponse<{
    active_signals: TradingSignal[];
    historical_signals: TradingSignal[];
  }> {
  summary: {
    totalSignals: number;
    activeSignals: number;
    avgConfidence: number;
  };
}

export interface GetPortfolioResponse extends ApiResponse<Portfolio> {
  riskMetrics: {
    valueAtRisk: number;
    maxDrawdown: number;
    sharpeRatio: number;
  };
}

export interface GetPerformanceMetricsResponse
  extends ApiResponse<PerformanceMetrics> {
  period: string;
  benchmarkComparison?: {
    portfolioReturn: number;
    benchmarkReturn: number;
    alpha: number;
    beta: number;
  };
}

export interface GetAIDecisionsResponse
  extends ApiResponse<PaginatedResponse<AIDecision>> {
  analytics: {
    totalDecisions: number;
    executedDecisions: number;
    avgConfidence: number;
    successRate: number;
  };
}

export interface GetSystemStatusResponse extends ApiResponse<SystemStatus> {
  healthCheck: {
    database: boolean;
    websocket: boolean;
    marketData: boolean;
    aiEngine: boolean;
  };
}

export interface GetTradingConfigResponse
  extends ApiResponse<{
    autoTrading: boolean;
    maxPositions: number;
    riskPerTrade: number;
    emergencyStop: boolean;
    allowedSymbols: string[];
  }> {
  lastUpdated: string;
}

export interface ExecuteTradeResponse
  extends ApiResponse<{
    tradeId: string;
    status: "PENDING" | "EXECUTED" | "REJECTED";
    executionPrice?: number;
    executionTime?: string;
    reason?: string;
  }> {
  fees: number;
  estimatedPnL?: number;
}

export interface GetExecutionThresholdsResponse
  extends ApiResponse<{
    thresholds: {
      min_confidence?: number;
      min_technical_score?: number;
      min_sentiment_score?: number;
      min_fusion_score?: number;
      max_risk_score?: number;
      min_volume_score?: number;
    };
    strategy_mode: string;
    market_regime: string;
  }> {
  lastUpdated: string;
}

export interface GetThresholdPerformanceResponse
  extends ApiResponse<{
    total_decisions: number;
    executed_count: number;
    rejected_count: number;
    execution_rate: number;
    threshold_effectiveness: number;
    avg_executed_confidence: number;
    avg_rejected_confidence: number;
  }> {
  period: string;
}
