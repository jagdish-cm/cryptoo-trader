/**
 * Custom hook for managing AI performance metrics and analysis
 */

import { useState, useEffect, useMemo, useCallback } from "react";
import { AIDecision } from "../../types";

interface PerformanceMetrics {
  accuracy: number;
  precision: number;
  recall: number;
  f1Score: number;
  avgResponseTime: number;
  totalDecisions: number;
  successfulDecisions: number;
  improvementRate: number;
}

interface ModelPerformance {
  modelName: string;
  metrics: PerformanceMetrics;
  decisions: AIDecision[];
}

interface TrendDataPoint {
  date: string;
  accuracy: number;
  precision: number;
  recall: number;
  totalDecisions: number;
}

interface UseAIPerformanceOptions {
  timeRange?: "24h" | "7d" | "30d";
  autoRefresh?: boolean;
  refreshInterval?: number;
}

interface UseAIPerformanceReturn {
  // Overall metrics
  overallMetrics: PerformanceMetrics;

  // Model comparison
  modelPerformances: ModelPerformance[];

  // Trends
  accuracyTrends: TrendDataPoint[];

  // State
  loading: boolean;
  error: string | null;
  timeRange: string;

  // Actions
  setTimeRange: (range: "24h" | "7d" | "30d") => void;
  refresh: () => void;

  // Analysis
  getBestPerformingModel: () => ModelPerformance | null;
  getWorstPerformingModel: () => ModelPerformance | null;
  getPerformanceTrend: () => "improving" | "declining" | "stable";
}

/**
 * Calculate performance metrics from decisions
 */
const calculateMetrics = (decisions: AIDecision[]): PerformanceMetrics => {
  if (decisions.length === 0) {
    return {
      accuracy: 0,
      precision: 0,
      recall: 0,
      f1Score: 0,
      avgResponseTime: 0,
      totalDecisions: 0,
      successfulDecisions: 0,
      improvementRate: 0,
    };
  }

  const successfulDecisions = decisions.filter(
    (d) => d.outcome?.result === "SUCCESS"
  );
  const accuracy = (successfulDecisions.length / decisions.length) * 100;

  // Calculate precision based on high-confidence decisions that were successful
  const highConfidenceDecisions = decisions.filter((d) => d.confidence >= 0.8);
  const successfulHighConfidence = highConfidenceDecisions.filter(
    (d) => d.outcome?.result === "SUCCESS"
  );
  const precision =
    highConfidenceDecisions.length > 0
      ? (successfulHighConfidence.length / highConfidenceDecisions.length) * 100
      : 0;

  // Calculate recall (same as accuracy in this context)
  const recall = accuracy;

  // Calculate F1 Score
  const f1Score =
    precision + recall > 0
      ? (2 * precision * recall) / (precision + recall)
      : 0;

  // Calculate average response time (using confidence as proxy)
  const avgConfidence =
    decisions.reduce((sum, d) => sum + d.confidence, 0) / decisions.length;
  const avgResponseTime = (1 + (1 - avgConfidence)) * 1000; // Convert to ms

  // Calculate improvement rate
  const midPoint = Math.floor(decisions.length / 2);
  const recentDecisions = decisions.slice(0, midPoint);
  const olderDecisions = decisions.slice(midPoint);

  const recentAccuracy =
    recentDecisions.length > 0
      ? (recentDecisions.filter((d) => d.outcome?.result === "SUCCESS").length /
          recentDecisions.length) *
        100
      : 0;
  const olderAccuracy =
    olderDecisions.length > 0
      ? (olderDecisions.filter((d) => d.outcome?.result === "SUCCESS").length /
          olderDecisions.length) *
        100
      : 0;

  const improvementRate = recentAccuracy - olderAccuracy;

  return {
    accuracy,
    precision,
    recall,
    f1Score,
    avgResponseTime,
    totalDecisions: decisions.length,
    successfulDecisions: successfulDecisions.length,
    improvementRate,
  };
};

/**
 * Calculate accuracy trends over time
 */
const calculateTrends = (
  decisions: AIDecision[],
  timeRange: string
): TrendDataPoint[] => {
  if (decisions.length === 0) return [];

  // Group decisions by time period
  const groupedData = decisions.reduce(
    (acc, decision) => {
      const date = new Date(decision.timestamp);
      let key: string;

      switch (timeRange) {
        case "24h":
          key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")} ${String(date.getHours()).padStart(2, "0")}:00`;
          break;
        case "7d":
          key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
          break;
        case "30d":
          // Group by week
          const weekStart = new Date(date);
          weekStart.setDate(date.getDate() - date.getDay());
          key = `${weekStart.getFullYear()}-${String(weekStart.getMonth() + 1).padStart(2, "0")}-${String(weekStart.getDate()).padStart(2, "0")}`;
          break;
        default:
          key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
      }

      if (!acc[key]) {
        acc[key] = [];
      }
      acc[key].push(decision);
      return acc;
    },
    {} as Record<string, AIDecision[]>
  );

  // Calculate metrics for each time period
  return Object.entries(groupedData)
    .map(([date, periodDecisions]) => {
      const metrics = calculateMetrics(periodDecisions);
      return {
        date,
        accuracy: metrics.accuracy,
        precision: metrics.precision,
        recall: metrics.recall,
        totalDecisions: periodDecisions.length,
      };
    })
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
};

/**
 * Hook for managing AI performance data
 */
export const useAIPerformance = (
  decisions: AIDecision[],
  options: UseAIPerformanceOptions = {}
): UseAIPerformanceReturn => {
  const {
    timeRange: initialTimeRange = "7d",
    autoRefresh = false,
    refreshInterval = 30000,
  } = options;

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [timeRange, setTimeRangeState] = useState(initialTimeRange);

  // Calculate overall metrics
  const overallMetrics = useMemo(() => {
    return calculateMetrics(decisions);
  }, [decisions]);

  // Calculate model performances
  const modelPerformances = useMemo(() => {
    // Group decisions by model
    const modelGroups = decisions.reduce(
      (acc, decision) => {
        const modelName = decision.reasoning?.modelVersion || "Default Model";
        if (!acc[modelName]) {
          acc[modelName] = [];
        }
        acc[modelName].push(decision);
        return acc;
      },
      {} as Record<string, AIDecision[]>
    );

    return Object.entries(modelGroups).map(([modelName, modelDecisions]) => ({
      modelName,
      metrics: calculateMetrics(modelDecisions),
      decisions: modelDecisions,
    }));
  }, [decisions]);

  // Calculate accuracy trends
  const accuracyTrends = useMemo(() => {
    return calculateTrends(decisions, timeRange);
  }, [decisions, timeRange]);

  // Actions
  const setTimeRange = useCallback((range: "24h" | "7d" | "30d") => {
    setTimeRangeState(range);
  }, []);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Simulate refresh operation
      await new Promise((resolve) => setTimeout(resolve, 500));

      // In a real implementation, this would trigger a data refetch
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to refresh performance data"
      );
    } finally {
      setLoading(false);
    }
  }, []);

  // Analysis functions
  const getBestPerformingModel = useCallback((): ModelPerformance | null => {
    if (modelPerformances.length === 0) return null;

    return modelPerformances.reduce((best, current) =>
      current.metrics.accuracy > best.metrics.accuracy ? current : best
    );
  }, [modelPerformances]);

  const getWorstPerformingModel = useCallback((): ModelPerformance | null => {
    if (modelPerformances.length === 0) return null;

    return modelPerformances.reduce((worst, current) =>
      current.metrics.accuracy < worst.metrics.accuracy ? current : worst
    );
  }, [modelPerformances]);

  const getPerformanceTrend = useCallback(():
    | "improving"
    | "declining"
    | "stable" => {
    if (accuracyTrends.length < 2) return "stable";

    const recent = accuracyTrends.slice(-3); // Last 3 data points
    const older = accuracyTrends.slice(-6, -3); // Previous 3 data points

    if (recent.length === 0 || older.length === 0) return "stable";

    const recentAvg =
      recent.reduce((sum, d) => sum + d.accuracy, 0) / recent.length;
    const olderAvg =
      older.reduce((sum, d) => sum + d.accuracy, 0) / older.length;

    const difference = recentAvg - olderAvg;

    if (difference > 5) return "improving";
    if (difference < -5) return "declining";
    return "stable";
  }, [accuracyTrends]);

  // Auto-refresh
  useEffect(() => {
    if (autoRefresh && refreshInterval > 0) {
      const interval = setInterval(refresh, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [autoRefresh, refreshInterval, refresh]);

  return {
    // Overall metrics
    overallMetrics,

    // Model comparison
    modelPerformances,

    // Trends
    accuracyTrends,

    // State
    loading,
    error,
    timeRange,

    // Actions
    setTimeRange,
    refresh,

    // Analysis
    getBestPerformingModel,
    getWorstPerformingModel,
    getPerformanceTrend,
  };
};

export default useAIPerformance;
