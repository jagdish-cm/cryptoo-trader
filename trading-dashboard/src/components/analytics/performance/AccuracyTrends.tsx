/**
 * Accuracy trends component for tracking AI model performance over time
 */

import React, { useState, useMemo } from "react";
import {
  ChartBarIcon,
  CalendarIcon,
  ArrowTrendingUpIcon as TrendingUpIcon,
  ArrowTrendingDownIcon as TrendingDownIcon,
  ArrowsPointingOutIcon,
} from "@heroicons/react/24/outline";
import { BaseComponentProps } from "../../../types/common/base";
import { AIDecision } from "../../../types";

interface AccuracyTrendsProps extends BaseComponentProps {
  decisions: AIDecision[];
  loading?: boolean;
  error?: string | null;
}

interface TrendDataPoint {
  date: string;
  accuracy: number;
  precision: number;
  recall: number;
  totalDecisions: number;
  successfulDecisions: number;
}

/**
 * Calculate accuracy trends over time
 */
const calculateAccuracyTrends = (
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
      const successfulDecisions = periodDecisions.filter(
        (d) => d.outcome?.result === "SUCCESS"
      );
      const highConfidenceDecisions = periodDecisions.filter(
        (d) => d.confidence >= 0.8
      );
      const successfulHighConfidence = highConfidenceDecisions.filter(
        (d) => d.outcome?.result === "SUCCESS"
      );

      const accuracy =
        (successfulDecisions.length / periodDecisions.length) * 100;
      const precision =
        highConfidenceDecisions.length > 0
          ? (successfulHighConfidence.length / highConfidenceDecisions.length) *
            100
          : 0;
      const recall =
        (successfulDecisions.length / periodDecisions.length) * 100;

      return {
        date,
        accuracy,
        precision,
        recall,
        totalDecisions: periodDecisions.length,
        successfulDecisions: successfulDecisions.length,
      };
    })
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
};

/**
 * Accuracy trends component
 */
export const AccuracyTrends: React.FC<AccuracyTrendsProps> = ({
  decisions,
  loading = false,
  error = null,
  className = "",
  testId,
}) => {
  const [timeRange, setTimeRange] = useState<"24h" | "7d" | "30d">("7d");
  const [selectedMetric, setSelectedMetric] = useState<
    "accuracy" | "precision" | "recall"
  >("accuracy");
  const [isFullscreen, setIsFullscreen] = useState(false);

  const trendData = useMemo(
    () => calculateAccuracyTrends(decisions, timeRange),
    [decisions, timeRange]
  );

  const currentAccuracy =
    trendData.length > 0 ? trendData[trendData.length - 1].accuracy : 0;
  const previousAccuracy =
    trendData.length > 1
      ? trendData[trendData.length - 2].accuracy
      : currentAccuracy;
  const accuracyTrend = currentAccuracy - previousAccuracy;

  if (loading) {
    return (
      <div
        className={`bg-white dark:bg-gray-800 rounded-lg shadow ${className}`}
        data-testid={testId}
      >
        <div className='px-6 py-4 border-b border-gray-200 dark:border-gray-700'>
          <h3 className='text-lg font-medium text-gray-900 dark:text-white'>
            Accuracy Trends
          </h3>
        </div>
        <div className='p-6'>
          <div className='h-64 bg-gray-50 dark:bg-gray-700 rounded-lg animate-pulse'></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div
        className={`bg-white dark:bg-gray-800 rounded-lg shadow ${className}`}
        data-testid={testId}
      >
        <div className='px-6 py-4 border-b border-gray-200 dark:border-gray-700'>
          <h3 className='text-lg font-medium text-gray-900 dark:text-white'>
            Accuracy Trends
          </h3>
        </div>
        <div className='p-6'>
          <div className='text-center text-red-600 dark:text-red-400'>
            <p>Error loading accuracy trends: {error}</p>
          </div>
        </div>
      </div>
    );
  }

  const maxValue = Math.max(
    ...trendData.map((d) => Math.max(d.accuracy, d.precision, d.recall))
  );

  return (
    <div
      className={`bg-white dark:bg-gray-800 rounded-lg shadow ${className} ${isFullscreen ? "fixed inset-4 z-50" : ""}`}
      data-testid={testId}
    >
      {/* Header */}
      <div className='px-6 py-4 border-b border-gray-200 dark:border-gray-700'>
        <div className='flex items-center justify-between'>
          <div>
            <h3 className='text-lg font-medium text-gray-900 dark:text-white'>
              Accuracy Trends
            </h3>
            <div className='flex items-center space-x-4 mt-1'>
              <div className='flex items-center space-x-2'>
                <span className='text-2xl font-bold text-gray-900 dark:text-white'>
                  {currentAccuracy.toFixed(1)}%
                </span>
                <div
                  className={`flex items-center space-x-1 ${
                    accuracyTrend >= 0
                      ? "text-green-600 dark:text-green-400"
                      : "text-red-600 dark:text-red-400"
                  }`}
                >
                  {accuracyTrend >= 0 ? (
                    <TrendingUpIcon className='h-4 w-4' />
                  ) : (
                    <TrendingDownIcon className='h-4 w-4' />
                  )}
                  <span className='text-sm font-medium'>
                    {Math.abs(accuracyTrend).toFixed(1)}%
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className='flex items-center space-x-4'>
            {/* Time Range Selector */}
            <div className='flex items-center space-x-2'>
              <CalendarIcon className='h-4 w-4 text-gray-400' />
              <select
                value={timeRange}
                onChange={(e) =>
                  setTimeRange(e.target.value as "24h" | "7d" | "30d")
                }
                className='px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white'
              >
                <option value='24h'>Last 24 Hours</option>
                <option value='7d'>Last 7 Days</option>
                <option value='30d'>Last 30 Days</option>
              </select>
            </div>

            {/* Metric Selector */}
            <select
              value={selectedMetric}
              onChange={(e) =>
                setSelectedMetric(
                  e.target.value as "accuracy" | "precision" | "recall"
                )
              }
              className='px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white'
            >
              <option value='accuracy'>Accuracy</option>
              <option value='precision'>Precision</option>
              <option value='recall'>Recall</option>
            </select>

            {/* Fullscreen Toggle */}
            <button
              onClick={() => setIsFullscreen(!isFullscreen)}
              className='p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors'
              title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
            >
              <ArrowsPointingOutIcon className='h-4 w-4' />
            </button>
          </div>
        </div>
      </div>

      <div className='p-6'>
        {trendData.length === 0 ? (
          <div className='text-center py-8 text-gray-500 dark:text-gray-400'>
            <ChartBarIcon className='mx-auto h-12 w-12 mb-4' />
            <p>No trend data available</p>
            <p className='text-sm mt-1'>
              Accuracy trends will appear as decisions are processed
            </p>
          </div>
        ) : (
          <>
            {/* Chart Description */}
            <div className='mb-4'>
              <p className='text-sm text-gray-600 dark:text-gray-400'>
                {selectedMetric.charAt(0).toUpperCase() +
                  selectedMetric.slice(1)}{" "}
                trend over {timeRange}({trendData.length} data points)
              </p>
            </div>

            {/* Line Chart */}
            <div className='h-64 bg-gray-50 dark:bg-gray-700 rounded-lg p-4 relative'>
              <div className='absolute inset-4'>
                <svg className='w-full h-full'>
                  {/* Grid lines */}
                  {[0, 25, 50, 75, 100].map((percent) => (
                    <line
                      key={percent}
                      x1='0'
                      y1={`${percent}%`}
                      x2='100%'
                      y2={`${percent}%`}
                      stroke='currentColor'
                      strokeWidth='1'
                      className='text-gray-300 dark:text-gray-600'
                      opacity='0.3'
                    />
                  ))}

                  {/* Trend line */}
                  {trendData.length > 1 && (
                    <polyline
                      fill='none'
                      stroke='currentColor'
                      strokeWidth='3'
                      className='text-primary-600 dark:text-primary-400'
                      points={trendData
                        .map((point, index) => {
                          const x = (index / (trendData.length - 1)) * 100;
                          const y =
                            100 - (point[selectedMetric] / maxValue) * 100;
                          return `${x},${y}`;
                        })
                        .join(" ")}
                    />
                  )}

                  {/* Data points */}
                  {trendData.map((point, index) => {
                    const x = (index / Math.max(trendData.length - 1, 1)) * 100;
                    const y = 100 - (point[selectedMetric] / maxValue) * 100;
                    return (
                      <circle
                        key={index}
                        cx={`${x}%`}
                        cy={`${y}%`}
                        r='4'
                        fill='currentColor'
                        className='text-primary-600 dark:text-primary-400'
                        data-tooltip={`${point.date}: ${point[selectedMetric].toFixed(1)}%`}
                      />
                    );
                  })}
                </svg>

                {/* Y-axis labels */}
                <div className='absolute left-0 top-0 h-full flex flex-col justify-between text-xs text-gray-500 dark:text-gray-400'>
                  <span>{maxValue.toFixed(0)}%</span>
                  <span>{(maxValue * 0.75).toFixed(0)}%</span>
                  <span>{(maxValue * 0.5).toFixed(0)}%</span>
                  <span>{(maxValue * 0.25).toFixed(0)}%</span>
                  <span>0%</span>
                </div>
              </div>
            </div>

            {/* Data Summary */}
            <div className='mt-6 grid grid-cols-1 md:grid-cols-3 gap-4'>
              <div className='text-center p-4 bg-green-50 dark:bg-green-900/20 rounded-lg'>
                <div className='text-2xl font-bold text-green-600 dark:text-green-400'>
                  {Math.max(...trendData.map((d) => d.accuracy)).toFixed(1)}%
                </div>
                <div className='text-sm text-gray-600 dark:text-gray-400'>
                  Peak Accuracy
                </div>
              </div>

              <div className='text-center p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg'>
                <div className='text-2xl font-bold text-blue-600 dark:text-blue-400'>
                  {(
                    trendData.reduce((sum, d) => sum + d.accuracy, 0) /
                    trendData.length
                  ).toFixed(1)}
                  %
                </div>
                <div className='text-sm text-gray-600 dark:text-gray-400'>
                  Average Accuracy
                </div>
              </div>

              <div className='text-center p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg'>
                <div className='text-2xl font-bold text-purple-600 dark:text-purple-400'>
                  {trendData.reduce((sum, d) => sum + d.totalDecisions, 0)}
                </div>
                <div className='text-sm text-gray-600 dark:text-gray-400'>
                  Total Decisions
                </div>
              </div>
            </div>

            {/* Trend Analysis */}
            <div className='mt-6 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg'>
              <h5 className='text-sm font-medium text-gray-900 dark:text-white mb-2'>
                Trend Analysis
              </h5>
              <div className='text-sm text-gray-600 dark:text-gray-400 space-y-1'>
                {accuracyTrend > 5 && (
                  <p className='text-green-600 dark:text-green-400'>
                    • Strong upward trend in accuracy (+
                    {accuracyTrend.toFixed(1)}%)
                  </p>
                )}
                {accuracyTrend < -5 && (
                  <p className='text-red-600 dark:text-red-400'>
                    • Declining accuracy trend ({accuracyTrend.toFixed(1)}%)
                  </p>
                )}
                {Math.abs(accuracyTrend) <= 5 && (
                  <p>
                    • Stable accuracy performance (±
                    {Math.abs(accuracyTrend).toFixed(1)}%)
                  </p>
                )}
                <p>• Data points analyzed: {trendData.length}</p>
                <p>
                  • Time period:{" "}
                  {timeRange === "24h"
                    ? "Hourly"
                    : timeRange === "7d"
                      ? "Daily"
                      : "Weekly"}{" "}
                  intervals
                </p>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default AccuracyTrends;
