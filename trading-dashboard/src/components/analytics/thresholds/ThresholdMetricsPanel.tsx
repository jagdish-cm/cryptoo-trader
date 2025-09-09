/**
 * Threshold metrics panel component for displaying performance overview
 */

import React from "react";
import {
  CheckCircleIcon,
  XCircleIcon,
  ChartBarIcon,
  ShieldCheckIcon,
} from "@heroicons/react/24/outline";
import { BaseComponentProps } from "../../../types/common/base";
import { LoadingState } from "../../ui/feedback/EmptyStates";

export interface ThresholdMetrics {
  totalDecisions: number;
  executedCount: number;
  rejectedCount: number;
  executionRate: number;
  thresholdEffectiveness: number;
  avgExecutedConfidence: number;
  avgRejectedConfidence: number;
}

interface ThresholdMetricsPanelProps extends BaseComponentProps {
  metrics: ThresholdMetrics | null;
  loading?: boolean;
  error?: string | null;
}

/**
 * Individual metric card component
 */
const MetricCard: React.FC<{
  title: string;
  value: string | number;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  description?: string;
}> = ({ title, value, icon: Icon, color, description }) => (
  <div className={`text-center p-3 ${color} rounded-lg`}>
    <div className='flex items-center justify-center mb-2'>
      <Icon className='h-5 w-5 mr-2' />
      <div className='text-2xl font-bold'>{value}</div>
    </div>
    <div className='text-sm font-medium'>{title}</div>
    {description && (
      <div className='text-xs opacity-75 mt-1'>{description}</div>
    )}
  </div>
);

/**
 * Threshold metrics panel component
 */
export const ThresholdMetricsPanel: React.FC<ThresholdMetricsPanelProps> = ({
  metrics,
  loading = false,
  error = null,
  className = "",
  testId,
}) => {
  if (loading) {
    return (
      <div
        className={`bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 ${className}`}
      >
        <LoadingState message='Loading threshold metrics...' />
      </div>
    );
  }

  if (error) {
    return (
      <div
        className={`bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 ${className}`}
      >
        <div className='text-center text-red-600 dark:text-red-400'>
          <XCircleIcon className='h-8 w-8 mx-auto mb-2' />
          <p>Error loading metrics: {error}</p>
        </div>
      </div>
    );
  }

  if (!metrics) {
    return (
      <div
        className={`bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 ${className}`}
      >
        <div className='text-center text-gray-500 dark:text-gray-400'>
          <ShieldCheckIcon className='h-8 w-8 mx-auto mb-2' />
          <p>No threshold metrics available</p>
        </div>
      </div>
    );
  }

  const formatPercentage = (value: number): string => {
    return `${(value * 100).toFixed(1)}%`;
  };

  return (
    <div
      className={`bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 ${className}`}
      data-testid={testId}
    >
      {/* Header */}
      <div className='flex items-center justify-between mb-6'>
        <div className='flex items-center space-x-2'>
          <ShieldCheckIcon className='h-6 w-6 text-primary-600 dark:text-primary-400' />
          <h3 className='text-lg font-semibold text-gray-900 dark:text-white'>
            Performance Overview
          </h3>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className='grid grid-cols-1 md:grid-cols-4 gap-4 mb-6'>
        <MetricCard
          title='Total Decisions'
          value={metrics.totalDecisions}
          icon={ChartBarIcon}
          color='bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white'
          description='All AI decisions made'
        />

        <MetricCard
          title='Executed'
          value={metrics.executedCount}
          icon={CheckCircleIcon}
          color='bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400'
          description='Trades that passed thresholds'
        />

        <MetricCard
          title='Rejected'
          value={metrics.rejectedCount}
          icon={XCircleIcon}
          color='bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400'
          description='Trades blocked by thresholds'
        />

        <MetricCard
          title='Execution Rate'
          value={formatPercentage(metrics.executionRate)}
          icon={ShieldCheckIcon}
          color='bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
          description='Percentage of executed trades'
        />
      </div>

      {/* Detailed Metrics */}
      <div className='grid grid-cols-1 md:grid-cols-3 gap-6'>
        <div className='text-center'>
          <div className='text-3xl font-bold text-blue-600 dark:text-blue-400 mb-2'>
            {formatPercentage(metrics.thresholdEffectiveness)}
          </div>
          <div className='text-sm text-gray-500 dark:text-gray-400'>
            Threshold Effectiveness
          </div>
          <div className='text-xs text-gray-400 dark:text-gray-500 mt-1'>
            Higher confidence gap between executed vs rejected
          </div>
        </div>

        <div className='text-center'>
          <div className='text-3xl font-bold text-green-600 dark:text-green-400 mb-2'>
            {formatPercentage(metrics.avgExecutedConfidence)}
          </div>
          <div className='text-sm text-gray-500 dark:text-gray-400'>
            Avg Executed Confidence
          </div>
          <div className='text-xs text-gray-400 dark:text-gray-500 mt-1'>
            Average confidence of executed trades
          </div>
        </div>

        <div className='text-center'>
          <div className='text-3xl font-bold text-red-600 dark:text-red-400 mb-2'>
            {formatPercentage(metrics.avgRejectedConfidence)}
          </div>
          <div className='text-sm text-gray-500 dark:text-gray-400'>
            Avg Rejected Confidence
          </div>
          <div className='text-xs text-gray-400 dark:text-gray-500 mt-1'>
            Average confidence of rejected trades
          </div>
        </div>
      </div>

      {/* Insight */}
      <div className='mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg'>
        <div className='text-sm text-blue-800 dark:text-blue-200'>
          <strong>Insight:</strong>{" "}
          {metrics.thresholdEffectiveness > 0.3
            ? "Thresholds are effectively filtering trades - executed trades have significantly higher confidence than rejected ones."
            : "Thresholds may need adjustment - the confidence gap between executed and rejected trades is small."}
        </div>
      </div>
    </div>
  );
};

export default ThresholdMetricsPanel;
