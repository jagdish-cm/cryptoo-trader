/**
 * Custom hook for managing AI decisions data and operations
 */

import { useState, useEffect, useMemo, useCallback } from "react";
import { AIDecision, DecisionType } from "../../types";
import { api, AIDecisionAPI } from "../../services/api/tradingApi";

interface DecisionFilters {
  searchTerm: string;
  symbol: string;
  type: string;
  status: string;
  confidenceRange: [number, number];
  dateRange: {
    start?: string;
    end?: string;
  };
}

interface UseAIDecisionsOptions {
  autoRefresh?: boolean;
  refreshInterval?: number;
  initialFilters?: Partial<DecisionFilters>;
}

interface UseAIDecisionsReturn {
  // Data
  decisions: AIDecision[];
  filteredDecisions: AIDecision[];
  loading: boolean;
  error: string | null;

  // Filters
  filters: DecisionFilters;
  setFilters: (filters: Partial<DecisionFilters>) => void;
  clearFilters: () => void;

  // Actions
  refresh: () => void;
  executeDecision: (decisionId: string) => Promise<void>;
  rejectDecision: (decisionId: string, reason: string) => Promise<void>;

  // Metadata
  availableSymbols: string[];
  availableTypes: string[];

  // Statistics
  executionRate: number;
  averageConfidence: number;
  totalDecisions: number;
}

const defaultFilters: DecisionFilters = {
  searchTerm: "",
  symbol: "",
  type: "",
  status: "",
  confidenceRange: [0, 100],
  dateRange: {},
};

/**
 * Transform API decision data to frontend AIDecision interface
 */
const transformAPIDecision = (apiDecision: AIDecisionAPI): AIDecision => ({
  id: apiDecision.id,
  symbol: apiDecision.symbol,
  type: apiDecision.type as DecisionType,
  confidence: apiDecision.confidence,
  timestamp: new Date(apiDecision.timestamp),
  reasoning: {
    summary:
      apiDecision.reasoning?.summary || `AI analysis for ${apiDecision.symbol}`,
    technicalScore: apiDecision.technicalScore || 0,
    sentimentScore: apiDecision.sentimentScore || 0,
    eventImpact: apiDecision.eventImpact || 0,
    finalConfidence: apiDecision.confidence,
    riskFactors: apiDecision.reasoning?.riskFactors || [],
    marketSentiment: apiDecision.reasoning?.marketSentiment || "neutral",
    technicalIndicators: apiDecision.reasoning?.technicalIndicators || [],
    modelVersion: apiDecision.reasoning?.modelVersion || "Unknown",
  },
  factors: [
    {
      type: "technical",
      value: apiDecision.technicalScore || 0,
      weight: 0.6,
      description: "Technical analysis score",
    },
    {
      type: "sentiment",
      value: apiDecision.sentimentScore || 0,
      weight: 0.4,
      description: "Market sentiment score",
    },
  ],
  executionDecision: apiDecision.executionDecision,
  executionThresholds: {
    minConfidence: apiDecision.executionThresholds?.minConfidence || 0.7,
    minTechnical: apiDecision.executionThresholds?.minTechnical || 0.6,
    minSentiment: apiDecision.executionThresholds?.minSentiment || 0.5,
  },
  outcome: {
    action:
      apiDecision.outcome?.action ||
      apiDecision.type.toLowerCase().replace("_", " "),
    result: apiDecision.outcome?.result || "PENDING",
    details: apiDecision.outcome?.details || "Decision outcome pending",
  },
  rejectionReasons: apiDecision.rejectionReasons || undefined,
  executionProbability: apiDecision.executionProbability || 0,
});

/**
 * Hook for managing AI decisions
 */
export const useAIDecisions = (
  options: UseAIDecisionsOptions = {}
): UseAIDecisionsReturn => {
  const {
    autoRefresh = false,
    refreshInterval = 30000,
    initialFilters = {},
  } = options;

  const [decisions, setDecisions] = useState<AIDecision[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFiltersState] = useState<DecisionFilters>({
    ...defaultFilters,
    ...initialFilters,
  });

  // Fetch decisions data
  const fetchDecisions = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch real AI decisions from backend API
      const apiDecisions = await api.analytics.getAIDecisions(50);
      const transformedDecisions = apiDecisions.map(transformAPIDecision);
      setDecisions(transformedDecisions);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to fetch AI decisions"
      );
      // Set empty array when API fails instead of showing mock data
      setDecisions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial data fetch
  useEffect(() => {
    fetchDecisions();
  }, [fetchDecisions]);

  // Auto-refresh
  useEffect(() => {
    if (autoRefresh && refreshInterval > 0) {
      const interval = setInterval(fetchDecisions, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [autoRefresh, refreshInterval, fetchDecisions]);

  // Get unique values for filters
  const availableSymbols = useMemo(() => {
    return Array.from(new Set(decisions.map((d) => d.symbol))).sort();
  }, [decisions]);

  const availableTypes = useMemo(() => {
    return Array.from(new Set(decisions.map((d) => d.type))).sort();
  }, [decisions]);

  // Filter decisions
  const filteredDecisions = useMemo(() => {
    return decisions.filter((decision) => {
      // Search term filter
      if (filters.searchTerm) {
        const searchLower = filters.searchTerm.toLowerCase();
        const matchesSearch =
          decision.symbol.toLowerCase().includes(searchLower) ||
          decision.type.toLowerCase().includes(searchLower) ||
          (decision.reasoning?.summary &&
            decision.reasoning.summary.toLowerCase().includes(searchLower));
        if (!matchesSearch) return false;
      }

      // Symbol filter
      if (filters.symbol && decision.symbol !== filters.symbol) {
        return false;
      }

      // Type filter
      if (filters.type && decision.type !== filters.type) {
        return false;
      }

      // Status filter
      if (filters.status) {
        if (
          filters.status === "EXECUTED" &&
          decision.executionDecision !== "EXECUTED"
        )
          return false;
        if (
          filters.status === "REJECTED" &&
          decision.executionDecision !== "REJECTED"
        )
          return false;
        if (
          filters.status === "PENDING" &&
          decision.executionDecision !== "PENDING" &&
          decision.executionDecision
        )
          return false;
      }

      // Confidence range filter
      const confidencePercent = decision.confidence * 100;
      if (
        confidencePercent < filters.confidenceRange[0] ||
        confidencePercent > filters.confidenceRange[1]
      ) {
        return false;
      }

      // Date range filter
      if (filters.dateRange.start) {
        const decisionDate = new Date(decision.timestamp);
        const startDate = new Date(filters.dateRange.start);
        if (decisionDate < startDate) return false;
      }
      if (filters.dateRange.end) {
        const decisionDate = new Date(decision.timestamp);
        const endDate = new Date(filters.dateRange.end);
        if (decisionDate > endDate) return false;
      }

      return true;
    });
  }, [decisions, filters]);

  // Calculate statistics
  const executionRate = useMemo(() => {
    if (decisions.length === 0) return 0;
    const executed = decisions.filter(
      (d) => d.executionDecision === "EXECUTED"
    ).length;
    return Math.round((executed / decisions.length) * 100);
  }, [decisions]);

  const averageConfidence = useMemo(() => {
    if (decisions.length === 0) return 0;
    const totalConfidence = decisions.reduce((sum, d) => sum + d.confidence, 0);
    return Math.round((totalConfidence / decisions.length) * 100);
  }, [decisions]);

  // Actions
  const setFilters = useCallback((newFilters: Partial<DecisionFilters>) => {
    setFiltersState((prev) => ({ ...prev, ...newFilters }));
  }, []);

  const clearFilters = useCallback(() => {
    setFiltersState(defaultFilters);
  }, []);

  const refresh = useCallback(() => {
    fetchDecisions();
  }, [fetchDecisions]);

  const executeDecision = useCallback(
    async (decisionId: string) => {
      try {
        // Find the decision to execute
        const decision = decisions.find((d) => d.id === decisionId);
        if (!decision) {
          throw new Error("Decision not found");
        }

        // Convert AI decision to trading signal format
        const signalData = {
          id: decision.id,
          symbol: decision.symbol,
          signal_type: decision.type, // Use the actual decision type from the API
          confidence: decision.confidence,
          technical_score: decision.reasoning.technicalScore,
          sentiment_score: decision.reasoning.sentimentScore,
          stop_loss_pct: 0.05, // 5% stop loss
          take_profit_levels: [0.05, 0.1], // 5% and 10% take profit
          reasoning: decision.reasoning,
          factors: decision.factors,
        };

        // Execute the signal via trading API
        const result = await api.trading.executeSignal(signalData);

        if (result.decision === "EXECUTE") {
          // Update decision status locally
          setDecisions((prev) =>
            prev.map((d) =>
              d.id === decisionId ? { ...d, executionDecision: "EXECUTED" } : d
            )
          );

          // Show success message
          alert(
            `Signal executed successfully! Position ID: ${result.position_id}`
          );
        } else {
          // Show rejection reason
          alert(`Signal execution rejected: ${result.reason}`);
        }
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to execute decision"
        );
      }
    },
    [decisions]
  );

  const rejectDecision = useCallback(
    async (decisionId: string, reason: string) => {
      try {
        // Make API call to reject decision
        const response = await fetch(
          `http://localhost:8000/api/analytics/ai-decisions/${decisionId}/reject`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ reason }),
          }
        );

        if (!response.ok) {
          throw new Error(
            `Failed to reject decision: ${response.status} ${response.statusText}`
          );
        }

        // Update decision status locally
        setDecisions((prev) =>
          prev.map((d) =>
            d.id === decisionId
              ? {
                  ...d,
                  executionDecision: "REJECTED",
                  rejectionReasons: [...(d.rejectionReasons || []), reason],
                }
              : d
          )
        );
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to reject decision"
        );
      }
    },
    []
  );

  return {
    // Data
    decisions,
    filteredDecisions,
    loading,
    error,

    // Filters
    filters,
    setFilters,
    clearFilters,

    // Actions
    refresh,
    executeDecision,
    rejectDecision,

    // Metadata
    availableSymbols,
    availableTypes,

    // Statistics
    executionRate,
    averageConfidence,
    totalDecisions: decisions.length,
  };
};

export default useAIDecisions;
