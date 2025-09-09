/**
 * Custom hook for managing execution threshold data
 */

import { useMemo, useState, useCallback, useEffect } from "react";
import {
  useGetExecutionThresholdsQuery,
  useGetThresholdPerformanceQuery,
} from "../../store/api/tradingApi";
import { AIDecision } from "../../types";

export interface ThresholdAnalysis {
  thresholds: Record<string, number>;
  performance: {
    totalDecisions: number;
    executedCount: number;
    rejectedCount: number;
    executionRate: number;
    thresholdEffectiveness: number;
    avgExecutedConfidence: number;
    avgRejectedConfidence: number;
  };
  recentDecisions: {
    executed: AIDecision[];
    rejected: AIDecision[];
  };
}

export interface UseThresholdDataParams {
  strategyMode?: string;
  marketRegime?: string;
  aiDecisions?: AIDecision[];
}

export interface UseThresholdDataReturn {
  data: ThresholdAnalysis | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

/**
 * Hook for fetching and analyzing execution threshold data
 */
export const useThresholdData = ({
  strategyMode = "dual_mode",
  marketRegime = "range",
  aiDecisions = [],
}: UseThresholdDataParams = {}): UseThresholdDataReturn => {
  const {
    data: thresholdData,
    isLoading: thresholdsLoading,
    error: thresholdsError,
    refetch: refetchThresholds,
  } = useGetExecutionThresholdsQuery({
    strategyMode,
    marketRegime,
  });

  const {
    data: performanceData,
    isLoading: performanceLoading,
    error: performanceError,
    refetch: refetchPerformance,
  } = useGetThresholdPerformanceQuery({});

  const loading = thresholdsLoading || performanceLoading;
  const error = thresholdsError || performanceError;

  const analysisData = useMemo((): ThresholdAnalysis | null => {
    if (!thresholdData || !performanceData) {
      return null;
    }

    // Analyze recent decisions
    const recentDecisions = aiDecisions.slice(0, 10);
    const executedDecisions = recentDecisions.filter(
      (d) => d.executionDecision === "EXECUTED"
    );
    const rejectedDecisions = recentDecisions.filter(
      (d) => d.executionDecision === "REJECTED"
    );

    return {
      thresholds: thresholdData.thresholds || {},
      performance: {
        totalDecisions: performanceData.total_decisions || 0,
        executedCount: performanceData.executed_count || 0,
        rejectedCount: performanceData.rejected_count || 0,
        executionRate: performanceData.execution_rate || 0,
        thresholdEffectiveness: performanceData.threshold_effectiveness || 0,
        avgExecutedConfidence: performanceData.avg_executed_confidence || 0,
        avgRejectedConfidence: performanceData.avg_rejected_confidence || 0,
      },
      recentDecisions: {
        executed: executedDecisions,
        rejected: rejectedDecisions,
      },
    };
  }, [thresholdData, performanceData, aiDecisions]);

  const refetch = () => {
    refetchThresholds();
    refetchPerformance();
  };

  return {
    data: analysisData,
    loading,
    error: error ? String(error) : null,
    refetch,
  };
};

/**
 * Hook for analyzing threshold score comparisons
 */
export const useThresholdAnalysis = (decision: AIDecision | null) => {
  return useMemo(() => {
    if (!decision) {
      return null;
    }

    const { reasoning, executionThresholds } = decision;

    if (!executionThresholds) {
      return null;
    }

    // Calculate fusion score
    const fusionScore =
      reasoning.technicalScore * 0.6 + reasoning.sentimentScore * 0.4;

    // Calculate risk score (inverse of confidence with some adjustment)
    const riskScore = Math.min(
      1.0,
      Math.max(0.0, (1.0 - decision.confidence) * 1.1)
    );

    // Simulate volume score based on confidence
    const volumeScore = 0.3 + decision.confidence * 0.4;

    const scoreComparisons = [
      {
        label: "Confidence",
        score: decision.confidence,
        threshold: executionThresholds.minConfidence || 0.6,
        passed:
          decision.confidence >= (executionThresholds.minConfidence || 0.6),
      },
      {
        label: "Technical Score",
        score: reasoning.technicalScore,
        threshold: executionThresholds.minTechnical || 0.5,
        passed:
          reasoning.technicalScore >= (executionThresholds.minTechnical || 0.5),
      },
      {
        label: "Sentiment Score",
        score: reasoning.sentimentScore,
        threshold: executionThresholds.minSentiment || 0.4,
        passed:
          reasoning.sentimentScore >= (executionThresholds.minSentiment || 0.4),
      },
      {
        label: "Fusion Score",
        score: fusionScore,
        threshold: executionThresholds.minFusionScore || 0.6,
        passed: fusionScore >= (executionThresholds.minFusionScore || 0.6),
      },
      {
        label: "Risk Score",
        score: riskScore,
        threshold: 0.8, // Max risk threshold
        passed: riskScore <= 0.8,
        isRisk: true,
      },
      {
        label: "Volume Score",
        score: volumeScore,
        threshold: 0.3,
        passed: volumeScore >= 0.3,
      },
    ];

    const allPassed = scoreComparisons.every((comparison) => comparison.passed);
    const passedCount = scoreComparisons.filter(
      (comparison) => comparison.passed
    ).length;

    return {
      scoreComparisons,
      allPassed,
      passedCount,
      totalCount: scoreComparisons.length,
      passRate: passedCount / scoreComparisons.length,
    };
  }, [decision]);
};
/**
 * Hook for managing threshold configuration
 */
export const useThresholdConfig = (
  initialConfig?: Partial<ThresholdConfig>
) => {
  const [config, setConfig] = useState<ThresholdConfig>({
    minConfidence: 0.6,
    minTechnical: 0.5,
    minSentiment: 0.4,
    minFusionScore: 0.6,
    maxRiskScore: 0.8,
    minVolumeScore: 0.3,
    ...initialConfig,
  });

  const [hasChanges, setHasChanges] = useState(false);
  const [originalConfig] = useState(config);

  const updateConfig = useCallback(
    (newConfig: Partial<ThresholdConfig>) => {
      setConfig((prev) => {
        const updated = { ...prev, ...newConfig };
        const changed = Object.keys(updated).some(
          (key) =>
            updated[key as keyof ThresholdConfig] !==
            originalConfig[key as keyof ThresholdConfig]
        );
        setHasChanges(changed);
        return updated;
      });
    },
    [originalConfig]
  );

  const resetConfig = useCallback(() => {
    setConfig(originalConfig);
    setHasChanges(false);
  }, [originalConfig]);

  const validateConfig = useCallback(
    (configToValidate: ThresholdConfig): string[] => {
      const errors: string[] = [];

      if (
        configToValidate.minConfidence < 0 ||
        configToValidate.minConfidence > 1
      ) {
        errors.push("Minimum confidence must be between 0 and 1");
      }

      if (
        configToValidate.minTechnical < 0 ||
        configToValidate.minTechnical > 1
      ) {
        errors.push("Minimum technical score must be between 0 and 1");
      }

      if (
        configToValidate.minSentiment < 0 ||
        configToValidate.minSentiment > 1
      ) {
        errors.push("Minimum sentiment score must be between 0 and 1");
      }

      if (
        configToValidate.minFusionScore < 0 ||
        configToValidate.minFusionScore > 1
      ) {
        errors.push("Minimum fusion score must be between 0 and 1");
      }

      if (
        configToValidate.maxRiskScore < 0 ||
        configToValidate.maxRiskScore > 1
      ) {
        errors.push("Maximum risk score must be between 0 and 1");
      }

      if (
        configToValidate.minVolumeScore < 0 ||
        configToValidate.minVolumeScore > 1
      ) {
        errors.push("Minimum volume score must be between 0 and 1");
      }

      // Logical validations
      if (
        configToValidate.minFusionScore >
        Math.max(configToValidate.minTechnical, configToValidate.minSentiment)
      ) {
        errors.push(
          "Fusion score threshold should not exceed individual component thresholds"
        );
      }

      return errors;
    },
    []
  );

  const isValid = useMemo(() => {
    return validateConfig(config).length === 0;
  }, [config, validateConfig]);

  return {
    config,
    hasChanges,
    isValid,
    updateConfig,
    resetConfig,
    validateConfig: () => validateConfig(config),
  };
};

export interface ThresholdConfig {
  minConfidence: number;
  minTechnical: number;
  minSentiment: number;
  minFusionScore: number;
  maxRiskScore: number;
  minVolumeScore: number;
}

/**
 * Hook for threshold performance history
 */
export const useThresholdPerformanceHistory = (days: number = 30) => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchHistoricalData = async () => {
      try {
        setLoading(true);
        setError(null);

        // Fetch real historical threshold performance data
        const response = await fetch(
          `/api/thresholds/performance-history?days=${days}`
        );
        if (!response.ok) {
          throw new Error("Failed to fetch threshold performance history");
        }

        const historicalData = await response.json();
        setData(historicalData);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to fetch historical data"
        );
        setData([]); // Set empty array when API fails
      } finally {
        setLoading(false);
      }
    };

    fetchHistoricalData();
  }, [days]);

  return {
    data,
    loading,
    error,
  };
};
