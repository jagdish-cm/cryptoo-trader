/**
 * API request type definitions
 */

import { TradeDirection } from "../trading/common";
import { PaginationParams, DateRange } from "../common/base";

// Generic API request parameters
export interface BaseApiParams {
  timestamp?: number;
  requestId?: string;
}

// Trading API requests
export interface GetPositionsRequest extends BaseApiParams {
  symbol?: string;
  status?: string;
  limit?: number;
  offset?: number;
}

export interface GetTradeHistoryRequest
  extends BaseApiParams,
    PaginationParams {
  symbol?: string;
  direction?: TradeDirection;
  dateRange?: DateRange;
}

export interface GetMarketDataRequest extends BaseApiParams {
  symbols: string[];
  timeframe?: string;
}

export interface GetSignalsRequest extends BaseApiParams {
  symbol?: string;
  strength?: string;
  active?: boolean;
  limit?: number;
}

export interface ClosePositionRequest extends BaseApiParams {
  positionId: string;
  reason?: string;
}

export interface ExecuteTradeRequest extends BaseApiParams {
  symbol: string;
  direction: TradeDirection;
  quantity: number;
  orderType: "MARKET" | "LIMIT";
  price?: number;
  stopLoss?: number;
  takeProfit?: number;
}

export interface UpdateTradingConfigRequest extends BaseApiParams {
  autoTrading?: boolean;
  maxPositions?: number;
  riskPerTrade?: number;
  emergencyStop?: boolean;
  allowedSymbols?: string[];
}

export interface GetPerformanceMetricsRequest extends BaseApiParams {
  period: string;
  symbol?: string;
  includeDrawdown?: boolean;
}

export interface GetAIDecisionsRequest extends BaseApiParams, PaginationParams {
  symbol?: string;
  type?: string;
  confidence?: number;
  dateRange?: DateRange;
}

export interface GetExecutionThresholdsRequest extends BaseApiParams {
  strategyMode: string;
  marketRegime: string;
}

export interface GetThresholdPerformanceRequest extends BaseApiParams {
  period?: string;
  symbol?: string;
}
