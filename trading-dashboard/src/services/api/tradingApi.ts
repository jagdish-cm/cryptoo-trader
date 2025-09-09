/**
 * Trading Dashboard API Service
 * Centralized API calls to the backend trading system
 */

const API_BASE_URL = "http://localhost:8000";

// Types for API responses
export interface SystemStatus {
  status: string;
  uptime: number;
  lastHeartbeat: string;
  activeConnections: number;
  processingSymbol: string | null;
  currentPhase: string;
  errors: Array<{ type: string; message: string }>;
  systemMetrics: {
    cpuUsage: number;
    memoryUsage: number;
    diskUsage: number;
    databaseConnected: boolean;
    redisConnected: boolean;
  };
}

export interface Portfolio {
  totalValue: number;
  availableBalance: number;
  positions: Position[];
  dailyPnL: number;
  totalPnL: number;
  maxDrawdown: number;
  lastUpdated: string;
}

export interface Position {
  id: string;
  symbol: string;
  direction: "LONG" | "SHORT";
  entryPrice: number;
  currentPrice: number;
  quantity: number;
  unrealizedPnL: number;
  realizedPnL?: number;
  stopLoss?: number;
  takeProfitLevels: number[];
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface Trade {
  id: string;
  positionId: string;
  symbol: string;
  direction: "LONG" | "SHORT";
  entryPrice: number;
  exitPrice: number;
  quantity: number;
  entryTime: string;
  exitTime: string;
  realizedPnL: number;
  fees: number;
  exitReason: string;
  setupType?: string;
}

export interface TradeHistory {
  trades: Trade[];
  total: number;
  limit: number;
  offset: number;
}

export interface AIDecisionAPI {
  id: string;
  timestamp: string;
  type: string;
  symbol: string;
  confidence: number;
  technicalScore: number;
  sentimentScore: number;
  eventImpact: number;
  reasoning: any;
  factors: any;
  outcome: any;
  executionDecision: "EXECUTED" | "REJECTED" | "PENDING";
  executionProbability: number;
  rejectionReasons: string[];
  executionThresholds: {
    minConfidence: number;
    minTechnical: number;
    minSentiment: number;
  };
}

export interface MarketData {
  symbol: string;
  price: number;
  change24h: number;
  volume24h: number;
  high24h: number;
  low24h: number;
  timestamp: string;
}

export interface PerformanceMetrics {
  totalTrades: number;
  winRate: number;
  totalReturn: number;
  sharpeRatio: number;
  maxDrawdown: number;
  avgTradeReturn: number;
  profitFactor: number;
  period: string;
}

export interface ExecutionThresholds {
  strategy_mode: string;
  market_regime: string;
  thresholds: {
    min_confidence: number;
    min_technical_score: number;
    min_sentiment_score: number;
    min_fusion_score: number;
    max_risk_score: number;
    min_volume_score: number;
  };
  updated_at: string;
}

export interface SentimentData {
  symbol: string;
  sentiment: "POSITIVE" | "NEGATIVE" | "NEUTRAL";
  confidence: number;
  newsImpact: number;
  socialImpact: number;
  processingTime: number;
  timestamp: string;
  keyFactors: string[];
}

// API Error handling
class APIError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
    this.name = "APIError";
  }
}

const handleResponse = async (response: Response) => {
  if (!response.ok) {
    const errorText = await response.text();
    throw new APIError(
      response.status,
      `API Error ${response.status}: ${errorText}`
    );
  }
  return response.json();
};

// System API
export const systemApi = {
  getStatus: async (): Promise<SystemStatus> => {
    const response = await fetch(`${API_BASE_URL}/api/system/status`);
    return handleResponse(response);
  },

  start: async (): Promise<{ message: string }> => {
    const response = await fetch(`${API_BASE_URL}/api/system/start`, {
      method: "POST",
    });
    return handleResponse(response);
  },

  stop: async (): Promise<{ message: string }> => {
    const response = await fetch(`${API_BASE_URL}/api/system/stop`, {
      method: "POST",
    });
    return handleResponse(response);
  },

  emergencyStop: async (): Promise<{ message: string }> => {
    const response = await fetch(`${API_BASE_URL}/api/system/emergency-stop`, {
      method: "POST",
    });
    return handleResponse(response);
  },
};

// Portfolio API
export const portfolioApi = {
  getPortfolio: async (): Promise<Portfolio> => {
    const response = await fetch(`${API_BASE_URL}/api/portfolio`);
    return handleResponse(response);
  },

  getPositions: async (): Promise<Position[]> => {
    const response = await fetch(`${API_BASE_URL}/api/positions`);
    return handleResponse(response);
  },

  getPerformanceHistory: async (days: number = 30) => {
    const response = await fetch(
      `${API_BASE_URL}/api/portfolio/performance-history?days=${days}`
    );
    return handleResponse(response);
  },

  closePosition: async (positionId: string) => {
    const response = await fetch(
      `${API_BASE_URL}/api/portfolio/positions/${positionId}/close`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
    return handleResponse(response);
  },
};

// Trading API
export const tradingApi = {
  getTradeHistory: async (
    limit: number = 50,
    offset: number = 0
  ): Promise<TradeHistory> => {
    const response = await fetch(
      `${API_BASE_URL}/api/trades/history?limit=${limit}&offset=${offset}`
    );
    return handleResponse(response);
  },

  getSignals: async () => {
    const response = await fetch(`${API_BASE_URL}/api/signals`);
    return handleResponse(response);
  },

  // New trading execution endpoints
  executeSignal: async (signalData: any) => {
    const response = await fetch(`${API_BASE_URL}/api/trading/execute-signal`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(signalData),
    });
    return handleResponse(response);
  },

  getActivePositions: async () => {
    const response = await fetch(
      `${API_BASE_URL}/api/trading/positions/active`
    );
    return handleResponse(response);
  },

  closePosition: async (positionId: string, reason?: string) => {
    const response = await fetch(
      `${API_BASE_URL}/api/trading/positions/${positionId}/close`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ reason: reason || "MANUAL_CLOSE" }),
      }
    );
    return handleResponse(response);
  },

  emergencyStop: async () => {
    const response = await fetch(`${API_BASE_URL}/api/trading/emergency-stop`, {
      method: "POST",
    });
    return handleResponse(response);
  },

  // Note: Order management endpoints not yet implemented in backend
  // getActiveOrders and cancelOrder will be added when backend supports them
};

// Analytics API
export const analyticsApi = {
  getPerformanceMetrics: async (
    period: string = "30d"
  ): Promise<PerformanceMetrics> => {
    const response = await fetch(
      `${API_BASE_URL}/api/analytics/performance?period=${period}`
    );
    return handleResponse(response);
  },

  getAIDecisions: async (limit: number = 50): Promise<AIDecisionAPI[]> => {
    const response = await fetch(
      `${API_BASE_URL}/api/analytics/ai-decisions?limit=${limit}`
    );
    return handleResponse(response);
  },

  getSentimentAnalysis: async (symbols: string): Promise<SentimentData[]> => {
    const response = await fetch(
      `${API_BASE_URL}/api/analytics/sentiment?symbols=${symbols}`
    );
    return handleResponse(response);
  },

  getExecutionThresholds: async (
    strategyMode: string = "dual_mode",
    marketRegime: string = "range"
  ): Promise<ExecutionThresholds> => {
    const response = await fetch(
      `${API_BASE_URL}/api/analytics/execution-thresholds?strategy_mode=${strategyMode}&market_regime=${marketRegime}`
    );
    return handleResponse(response);
  },

  getThresholdPerformance: async (days: number = 7) => {
    const response = await fetch(
      `${API_BASE_URL}/api/analytics/threshold-performance?days=${days}`
    );
    return handleResponse(response);
  },
};

// Market Data API
export const marketApi = {
  getMarketData: async (
    symbols: string
  ): Promise<Record<string, MarketData>> => {
    const response = await fetch(
      `${API_BASE_URL}/api/market/data?symbols=${symbols}`
    );
    return handleResponse(response);
  },

  getLatestPrice: async (
    symbol: string
  ): Promise<{ symbol: string; price: number; timestamp: string }> => {
    const response = await fetch(`${API_BASE_URL}/api/market/${symbol}/price`);
    return handleResponse(response);
  },
};

// Configuration API
export const configApi = {
  getTradingConfig: async () => {
    const response = await fetch(`${API_BASE_URL}/api/config/trading`);
    return handleResponse(response);
  },

  updateTradingConfig: async (config: unknown) => {
    const response = await fetch(`${API_BASE_URL}/api/config/trading`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(config),
    });
    return handleResponse(response);
  },

  getNotificationConfig: async () => {
    const response = await fetch(`${API_BASE_URL}/api/config/notifications`);
    return handleResponse(response);
  },

  updateNotificationConfig: async (config: unknown) => {
    const response = await fetch(`${API_BASE_URL}/api/config/notifications`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(config),
    });
    return handleResponse(response);
  },
};

// Health check
export const healthApi = {
  check: async () => {
    const response = await fetch(`${API_BASE_URL}/health`);
    return handleResponse(response);
  },
};

// Export all APIs
export const api = {
  system: systemApi,
  portfolio: portfolioApi,
  trading: tradingApi,
  analytics: analyticsApi,
  market: marketApi,
  config: configApi,
  health: healthApi,
};

export default api;
