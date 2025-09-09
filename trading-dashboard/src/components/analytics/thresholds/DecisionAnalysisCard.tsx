/**
 * Decision analysis card component for displaying individual AI decision details
 */

import React, { useState } from "react";
import {
  CheckCircleIcon,
  XCircleIcon,
  ExclamationTriangleIcon,
  ChevronDownIcon,
  ChevronUpIcon,
} from "@heroicons/react/24/outline";
import { AIDecision } from "../../../types";
import { BaseComponentProps } from "../../../types/common/base";
import { formatTradingTimestamp } from "../../../utils/formatting/tradingFormatters";
import { getExecutionStatusIcon } from "../../../utils/ui/iconUtils";

interface DecisionAnalysisCardProps extends BaseComponentProps {
  decision: AIDecision;
  isExecuted: boolean;
  showDetails?: boolean;
}

interface ScoreComparison {
  label: string;
  score: number;
  threshold: number;
  passed: boolean;
  margin: number;
  isRisk?: boolean;
}

/**
 * Score status utility functions
 */
const getScoreStatus = (
  score: number,
  threshold: number,
  isRisk: boolean = false
) => {
  const passed = isRisk ? score <= threshold : score >= threshold;
  const margin = isRisk ? threshold - score : score - threshold;

  return {
    passed,
    margin,
    status: passed ? "pass" : Math.abs(margin) < 0.1 ? "close" : "fail",
  };
};

const getStatusColor = (status: string) => {
  switch (status) {
    case "pass":
      return "text-green-600 dark:text-green-400";
    case "close":
      return "text-yellow-600 dark:text-yellow-400";
    case "fail":
      return "text-red-600 dark:text-red-400";
    default:
      return "text-gray-600 dark:text-gray-400";
  }
};

const getStatusBg = (status: string) => {
  switch (status) {
    case "pass":
      return "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800";
    case "close":
      return "bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800";
    case "fail":
      return "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800";
    default:
      return "bg-gray-50 dark:bg-gray-900/20 border-gray-200 dark:border-gray-800";
  }
};

/**
 * Threshold bar component for visualizing score vs threshold
 */
const ThresholdBar: React.FC<{
  label: string;
  score: number;
  threshold: number;
  isRisk?: boolean;
  unit?: string;
}> = ({ label, score, threshold, isRisk = false, unit = "%" }) => {
  const status = getScoreStatus(score, threshold, isRisk);
  const scorePercentage = Math.min(100, Math.max(0, score * 100));
  const thresholdPercentage = Math.min(100, Math.max(0, threshold * 100));

  return (
    <div className={`p-3 rounded-lg border ${getStatusBg(status.status)}`}>
      <div className='flex items-center justify-between mb-2'>
        <div className='flex items-center space-x-2'>
          <span className='text-sm font-medium text-gray-900 dark:text-white'>
            {label}
          </span>
          {status.passed ? (
            <CheckCircleIcon className='h-4 w-4 text-green-600 dark:text-green-400' />
          ) : (
            <XCircleIcon className='h-4 w-4 text-red-600 dark:text-red-400' />
          )}
        </div>
        <div className='text-right'>
          <div
            className={`text-sm font-semibold ${getStatusColor(status.status)}`}
          >
            {scorePercentage.toFixed(1)}
            {unit}
          </div>
          <div className='text-xs text-gray-500 dark:text-gray-400'>
            vs {thresholdPercentage.toFixed(1)}
            {unit}
          </div>
        </div>
      </div>

      <div className='relative'>
        <div className='w-full bg-gray-200 dark:bg-gray-600 rounded-full h-2'>
          <div
            className={`h-2 rounded-full transition-all duration-300 ${
              status.passed
                ? "bg-green-500 dark:bg-green-400"
                : status.status === "close"
                  ? "bg-yellow-500 dark:bg-yellow-400"
                  : "bg-red-500 dark:bg-red-400"
            }`}
            style={{ width: `${scorePercentage}%` }}
          />
        </div>

        {/* Threshold line */}
        <div
          className='absolute top-0 w-0.5 h-2 bg-gray-800 dark:bg-gray-200'
          style={{ left: `${thresholdPercentage}%` }}
        />
        <div
          className='absolute -top-1 text-xs text-gray-600 dark:text-gray-400 transform -translate-x-1/2'
          style={{ left: `${thresholdPercentage}%` }}
        >
          ▼
        </div>
      </div>

      <div className='mt-2 flex items-center justify-between text-xs'>
        <span className='text-gray-500 dark:text-gray-400'>
          {isRisk ? "Max allowed" : "Min required"}:{" "}
          {thresholdPercentage.toFixed(1)}
          {unit}
        </span>
        <span className={`font-medium ${getStatusColor(status.status)}`}>
          {status.margin >= 0 ? "+" : ""}
          {(status.margin * 100).toFixed(1)}
          {unit}
        </span>
      </div>
    </div>
  );
};

/**
 * Decision analysis card component
 */
export const DecisionAnalysisCard: React.FC<DecisionAnalysisCardProps> = ({
  decision,
  isExecuted,
  showDetails = false,
  className = "",
  testId,
}) => {
  const [expanded, setExpanded] = useState(showDetails);
  const rejectionReasons = decision.rejectionReasons || [];

  // Calculate derived scores
  const fusionScore =
    decision.reasoning.technicalScore * 0.6 +
    decision.reasoning.sentimentScore * 0.4;
  const riskScore = Math.min(
    1.0,
    Math.max(0.0, (1.0 - decision.confidence) * 1.1)
  );
  const volumeScore = 0.3 + decision.confidence * 0.4; // Simulated volume score

  const scoreComparisons: ScoreComparison[] = [
    {
      label: "Confidence",
      score: decision.confidence,
      threshold: decision.executionThresholds?.minConfidence || 0.6,
      passed:
        decision.confidence >=
        (decision.executionThresholds?.minConfidence || 0.6),
      margin:
        decision.confidence -
        (decision.executionThresholds?.minConfidence || 0.6),
    },
    {
      label: "Technical Score",
      score: decision.reasoning.technicalScore,
      threshold: decision.executionThresholds?.minTechnical || 0.5,
      passed:
        decision.reasoning.technicalScore >=
        (decision.executionThresholds?.minTechnical || 0.5),
      margin:
        decision.reasoning.technicalScore -
        (decision.executionThresholds?.minTechnical || 0.5),
    },
    {
      label: "Sentiment Score",
      score: decision.reasoning.sentimentScore,
      threshold: decision.executionThresholds?.minSentiment || 0.4,
      passed:
        decision.reasoning.sentimentScore >=
        (decision.executionThresholds?.minSentiment || 0.4),
      margin:
        decision.reasoning.sentimentScore -
        (decision.executionThresholds?.minSentiment || 0.4),
    },
    {
      label: "Fusion Score",
      score: fusionScore,
      threshold: decision.executionThresholds?.minFusionScore || 0.6,
      passed:
        fusionScore >= (decision.executionThresholds?.minFusionScore || 0.6),
      margin:
        fusionScore - (decision.executionThresholds?.minFusionScore || 0.6),
    },
    {
      label: "Risk Score",
      score: riskScore,
      threshold: 0.8,
      passed: riskScore <= 0.8,
      margin: 0.8 - riskScore,
      isRisk: true,
    },
    {
      label: "Volume Score",
      score: volumeScore,
      threshold: 0.3,
      passed: volumeScore >= 0.3,
      margin: volumeScore - 0.3,
    },
  ];

  return (
    <div
      className={`p-4 rounded-lg border ${
        isExecuted
          ? "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800"
          : "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800"
      } ${className}`}
      data-testid={testId}
    >
      {/* Header */}
      <div className='flex items-center justify-between mb-3'>
        <div className='flex items-center space-x-2'>
          <span className='font-medium text-gray-900 dark:text-white'>
            {decision.symbol}
          </span>
          {getExecutionStatusIcon(decision.executionDecision || "PENDING")}
        </div>
        <div className='text-right'>
          <div
            className={`text-sm font-semibold ${
              isExecuted
                ? "text-green-600 dark:text-green-400"
                : "text-red-600 dark:text-red-400"
            }`}
          >
            {isExecuted ? "EXECUTED" : "REJECTED"}
          </div>
          {decision.executionProbability && (
            <div className='text-xs text-gray-500 dark:text-gray-400'>
              {(decision.executionProbability * 100).toFixed(0)}% probability
            </div>
          )}
        </div>
      </div>

      {/* Basic Metrics */}
      <div className='grid grid-cols-2 gap-3 mb-3'>
        <div className='text-center'>
          <div className='text-xs text-gray-500 dark:text-gray-400'>
            Confidence
          </div>
          <div className='font-medium text-gray-900 dark:text-white'>
            {(decision.confidence * 100).toFixed(1)}%
          </div>
        </div>
        <div className='text-center'>
          <div className='text-xs text-gray-500 dark:text-gray-400'>
            Technical
          </div>
          <div className='font-medium text-gray-900 dark:text-white'>
            {(decision.reasoning.technicalScore * 100).toFixed(1)}%
          </div>
        </div>
      </div>

      {/* Rejection Reasons */}
      {!isExecuted && rejectionReasons.length > 0 && (
        <div className='mt-3 p-2 bg-red-100 dark:bg-red-900/30 rounded'>
          <div className='text-xs font-medium text-red-800 dark:text-red-200 mb-1'>
            Rejection Reasons:
          </div>
          <div className='space-y-1'>
            {rejectionReasons.map((reason: string, idx: number) => (
              <div
                key={idx}
                className='text-xs text-red-700 dark:text-red-300 flex items-center'
              >
                <ExclamationTriangleIcon className='h-3 w-3 mr-1 flex-shrink-0' />
                {reason}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Expand/Collapse Button */}
      <button
        onClick={() => setExpanded(!expanded)}
        className='w-full mt-3 flex items-center justify-center space-x-1 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors'
      >
        <span>{expanded ? "Hide Details" : "Show Details"}</span>
        {expanded ? (
          <ChevronUpIcon className='h-4 w-4' />
        ) : (
          <ChevronDownIcon className='h-4 w-4' />
        )}
      </button>

      {/* Detailed Analysis */}
      {expanded && (
        <div className='mt-4 space-y-3'>
          <div className='text-sm font-medium text-gray-900 dark:text-white mb-2'>
            Threshold Analysis
          </div>
          <div className='grid grid-cols-1 md:grid-cols-2 gap-3'>
            {scoreComparisons.map((comparison) => (
              <ThresholdBar
                key={comparison.label}
                label={comparison.label}
                score={comparison.score}
                threshold={comparison.threshold}
                isRisk={comparison.isRisk}
              />
            ))}
          </div>
        </div>
      )}

      {/* Timestamp */}
      <div className='mt-3 text-xs text-gray-500 dark:text-gray-400'>
        {formatTradingTimestamp(decision.timestamp)}
      </div>
    </div>
  );
};

export default DecisionAnalysisCard;
