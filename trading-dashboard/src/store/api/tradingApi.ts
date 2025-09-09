import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import type {
  Portfolio,
  Position,
  Trade,
  TradingSignal,
  MarketData,
  SystemStatus,
  PerformanceMetrics,
  AIDecision,
  SentimentAnalysis,
  TradingConfig,
  NotificationConfig,
} from "../../types";

// Define the base URL for the API
const baseUrl = import.meta.env.VITE_API_URL || "http://localhost:8000/api";

export const tradingApi = createApi({
  reducerPath: "tradingApi",
  baseQuery: fetchBaseQuery({
    baseUrl,
    prepareHeaders: (headers) => {
      // Add authentication headers if needed
      const token = localStorage.getItem("authToken");
      if (token) {
        headers.set("authorization", `Bearer ${token}`);
      }
      return headers;
    },
  }),
  tagTypes: [
    "Portfolio",
    "Positions",
    "Trades",
    "Signals",
    "MarketData",
    "SystemStatus",
    "Performance",
    "AIDecisions",
    "Sentiment",
    "ExecutionThresholds",
    "ThresholdPerformance",
    "Config",
  ],
  endpoints: (builder) => ({
    // System Status
    getSystemStatus: builder.query<SystemStatus, void>({
      query: () => "/system/status",
      providesTags: ["SystemStatus"],
    }),

    // Portfolio and Positions
    getPortfolio: builder.query<Portfolio, void>({
      query: () => "/portfolio",
      providesTags: ["Portfolio"],
    }),

    getPositions: builder.query<Position[], void>({
      query: () => "/positions",
      providesTags: ["Positions"],
    }),

    closePosition: builder.mutation<void, string>({
      query: (positionId) => ({
        url: `/positions/${positionId}/close`,
        method: "POST",
      }),
      invalidatesTags: ["Positions", "Portfolio"],
    }),

    // Trading History
    getTradeHistory: builder.query<
      { trades: Trade[]; summary: any },
      { limit?: number; offset?: number }
    >({
      query: ({ limit = 50, offset = 0 }) =>
        `/trades/history?limit=${limit}&offset=${offset}`,
      providesTags: ["Trades"],
    }),

    // Trading Signals
    getSignals: builder.query<
      {
        active_signals: TradingSignal[];
        signal_history: TradingSignal[];
        market_regime: any;
      },
      void
    >({
      query: () => "/signals",
      providesTags: ["Signals"],
    }),

    // Market Data
    getMarketData: builder.query<Record<string, MarketData>, string[]>({
      query: (symbols) => `/market/data?symbols=${symbols.join(",")}`,
      providesTags: ["MarketData"],
    }),

    getMarketHistory: builder.query<
      any[],
      { symbol: string; timeframe: string; limit?: number }
    >({
      query: ({ symbol, timeframe, limit = 1000 }) =>
        `/market/${symbol}/history?timeframe=${timeframe}&limit=${limit}`,
      providesTags: ["MarketData"],
    }),

    // Performance Analytics
    getPerformanceMetrics: builder.query<
      PerformanceMetrics,
      { period?: string }
    >({
      query: ({ period = "30d" }) => `/analytics/performance?period=${period}`,
      providesTags: ["Performance"],
    }),

    getAnalytics: builder.query<any, { timeframe?: string }>({
      query: ({ timeframe = "24h" }) => `/analytics?timeframe=${timeframe}`,
      providesTags: ["Performance"],
    }),

    // AI Decisions and Sentiment
    getAIDecisions: builder.query<AIDecision[], { limit?: number }>({
      query: ({ limit = 50 }) => `/analytics/ai-decisions?limit=${limit}`,
      providesTags: ["AIDecisions"],
    }),

    getSentimentAnalysis: builder.query<SentimentAnalysis[], string[]>({
      query: (symbols) => `/analytics/sentiment?symbols=${symbols.join(",")}`,
      providesTags: ["Sentiment"],
    }),

    // Execution Thresholds
    getExecutionThresholds: builder.query<
      any,
      { strategyMode?: string; marketRegime?: string }
    >({
      query: ({ strategyMode = "dual_mode", marketRegime = "range" } = {}) =>
        `/analytics/execution-thresholds?strategy_mode=${strategyMode}&market_regime=${marketRegime}`,
      providesTags: ["ExecutionThresholds"],
    }),

    getThresholdPerformance: builder.query<any, { days?: number }>({
      query: ({ days = 7 } = {}) =>
        `/analytics/threshold-performance?days=${days}`,
      providesTags: ["ThresholdPerformance"],
    }),

    // Configuration
    getTradingConfig: builder.query<TradingConfig, void>({
      query: () => "/config/trading",
      providesTags: ["Config"],
    }),

    updateTradingConfig: builder.mutation<
      TradingConfig,
      Partial<TradingConfig>
    >({
      query: (config) => ({
        url: "/config/trading",
        method: "PUT",
        body: config,
      }),
      invalidatesTags: ["Config"],
    }),

    getNotificationConfig: builder.query<NotificationConfig, void>({
      query: () => "/config/notifications",
      providesTags: ["Config"],
    }),

    updateNotificationConfig: builder.mutation<
      NotificationConfig,
      Partial<NotificationConfig>
    >({
      query: (config) => ({
        url: "/config/notifications",
        method: "PUT",
        body: config,
      }),
      invalidatesTags: ["Config"],
    }),

    // System Control
    startSystem: builder.mutation<void, void>({
      query: () => ({
        url: "/system/start",
        method: "POST",
      }),
      invalidatesTags: ["SystemStatus"],
    }),

    stopSystem: builder.mutation<void, void>({
      query: () => ({
        url: "/system/stop",
        method: "POST",
      }),
      invalidatesTags: ["SystemStatus"],
    }),

    emergencyStop: builder.mutation<void, void>({
      query: () => ({
        url: "/system/emergency-stop",
        method: "POST",
      }),
      invalidatesTags: ["SystemStatus", "Positions", "Portfolio"],
    }),

    // Manual Trading
    placeTrade: builder.mutation<
      any,
      { symbol: string; direction: string; quantity: number; price?: number }
    >({
      query: (tradeData) => ({
        url: "/trades/place",
        method: "POST",
        body: tradeData,
      }),
      invalidatesTags: ["Positions", "Portfolio", "Trades"],
    }),
  }),
});

// Export hooks for usage in functional components
export const {
  useGetSystemStatusQuery,
  useGetPortfolioQuery,
  useGetPositionsQuery,
  useClosePositionMutation,
  useGetTradeHistoryQuery,
  useGetSignalsQuery,
  useGetMarketDataQuery,
  useGetMarketHistoryQuery,
  useGetPerformanceMetricsQuery,
  useGetAnalyticsQuery,
  useGetAIDecisionsQuery,
  useGetSentimentAnalysisQuery,
  useGetExecutionThresholdsQuery,
  useGetThresholdPerformanceQuery,
  useGetTradingConfigQuery,
  useUpdateTradingConfigMutation,
  useGetNotificationConfigQuery,
  useUpdateNotificationConfigMutation,
  useStartSystemMutation,
  useStopSystemMutation,
  useEmergencyStopMutation,
  usePlaceTradeMutation,
} = tradingApi;
