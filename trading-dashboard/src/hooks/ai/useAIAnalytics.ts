/**
 * Comprehensive hook for AI analytics combining decisions and performance data
 */

import { useMemo, useState, useEffect } from "react";
import { useAIDecisions } from "./useAIDecisions";
import { useAIPerformance } from "./useAIPerformance";
import { AIDecision, SentimentAnalysis } from "../../types";

interface UseAIAnalyticsOptions {
  autoRefresh?: boolean;
  refreshInterval?: number;
  timeRange?: "24h" | "7d" | "30d";
}

interface UseAIAnalyticsReturn {
  // Decisions data
  decisions: AIDecision[];
  filteredDecisions: AIDecision[];
  decisionsLoading: boolean;
  decisionsError: string | null;

  // Performance data
  overallMetrics: any;
  modelPerformances: any[];
  accuracyTrends: any[];
  performanceLoading: boolean;
  performanceError: string | null;

  // Sentiment data (mock for now)
  sentimentData: SentimentAnalysis[];

  // Combined analytics
  totalDecisions: number;
  executionRate: number;
  averageConfidence: number;
  performanceTrend: "improving" | "declining" | "stable";

  // Actions
  refresh: () => void;
  executeDecision: (decisionId: string) => Promise<void>;
  rejectDecision: (decisionId: string, reason: string) => Promise<void>;

  // Filters
  filters: any;
  setFilters: (filters: any) => void;
  clearFilters: () => void;
  availableSymbols: string[];
  availableTypes: string[];

  // Performance controls
  timeRange: string;
  setTimeRange: (range: "24h" | "7d" | "30d") => void;
  getBestPerformingModel: () => any;
  getWorstPerformingModel: () => any;
}

import { api } from "../../services/api/tradingApi";

/**
 * Fetch real sentiment analysis data from the API
 */
const fetchSentimentData = async (
  symbols: string[]
): Promise<SentimentAnalysis[]> => {
  try {
    const symbolsString = symbols.join(",");
    const sentimentData =
      await api.analytics.getSentimentAnalysis(symbolsString);
    return sentimentData.map((data) => ({
      symbol: data.symbol,
      sentiment: data.sentiment,
      confidence: data.confidence,
      newsImpact: data.newsImpact,
      socialImpact: data.socialImpact,
      processingTime: data.processingTime,
      timestamp: new Date(data.timestamp),
      keyFactors: data.keyFactors,
    }));
  } catch (error) {
    console.warn("Failed to fetch sentiment data:", error);
    // Return empty array instead of mock data when API fails
    return [];
  }
};

/**
 * Comprehensive AI analytics hook
 */
export const useAIAnalytics = (
  options: UseAIAnalyticsOptions = {}
): UseAIAnalyticsReturn => {
  const {
    autoRefresh = true,
    refreshInterval = 30000,
    timeRange: initialTimeRange = "7d",
  } = options;

  // Use decisions hook
  const {
    decisions,
    filteredDecisions,
    loading: decisionsLoading,
    error: decisionsError,
    filters,
    setFilters,
    clearFilters,
    refresh: refreshDecisions,
    executeDecision,
    rejectDecision,
    availableSymbols,
    availableTypes,
    executionRate,
    averageConfidence,
    totalDecisions,
  } = useAIDecisions({
    autoRefresh,
    refreshInterval,
  });

  // Use performance hook
  const {
    overallMetrics,
    modelPerformances,
    accuracyTrends,
    loading: performanceLoading,
    error: performanceError,
    timeRange,
    setTimeRange,
    refresh: refreshPerformance,
    getBestPerformingModel,
    getWorstPerformingModel,
    getPerformanceTrend,
  } = useAIPerformance(decisions, {
    timeRange: initialTimeRange,
    autoRefresh,
    refreshInterval,
  });

  // State for sentiment data
  const [sentimentData, setSentimentData] = useState<SentimentAnalysis[]>([]);
  const [sentimentLoading, setSentimentLoading] = useState(false);
  const [sentimentError, setSentimentError] = useState<string | null>(null);

  // Fetch real sentiment data
  useEffect(() => {
    const fetchSentiment = async () => {
      if (availableSymbols.length === 0) return;

      try {
        setSentimentLoading(true);
        setSentimentError(null);
        const data = await fetchSentimentData(availableSymbols);
        setSentimentData(data);
      } catch (error) {
        setSentimentError(
          error instanceof Error
            ? error.message
            : "Failed to fetch sentiment data"
        );
        setSentimentData([]);
      } finally {
        setSentimentLoading(false);
      }
    };

    fetchSentiment();
  }, [availableSymbols]);

  // Combined refresh function
  const refresh = () => {
    refreshDecisions();
    refreshPerformance();
  };

  // Get performance trend
  const performanceTrend = getPerformanceTrend();

  return {
    // Decisions data
    decisions,
    filteredDecisions,
    decisionsLoading,
    decisionsError,

    // Performance data
    overallMetrics,
    modelPerformances,
    accuracyTrends,
    performanceLoading,
    performanceError,

    // Sentiment data
    sentimentData,

    // Combined analytics
    totalDecisions,
    executionRate,
    averageConfidence,
    performanceTrend,

    // Actions
    refresh,
    executeDecision,
    rejectDecision,

    // Filters
    filters,
    setFilters,
    clearFilters,
    availableSymbols,
    availableTypes,

    // Performance controls
    timeRange,
    setTimeRange,
    getBestPerformingModel,
    getWorstPerformingModel,
  };
};

export default useAIAnalytics;
