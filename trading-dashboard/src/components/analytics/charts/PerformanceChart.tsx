/**
 * Performance chart component for visualizing threshold effectiveness over time
 */

import React from "react";
import { ChartBarIcon } from "@heroicons/react/24/outline";
import { BaseComponentProps } from "../../../types/common/base";

export interface ChartDataPoint {
  timestamp: string;
  executionRate: number;
  avgConfidence: number;
  thresholdEffectiveness: number;
}

interface PerformanceChartProps extends BaseComponentProps {
  data: ChartDataPoint[];
  loading?: boolean;
  error?: string | null;
  height?: number;
}

/**
 * Simple chart placeholder component
 * In a real implementation, this would use a charting library like Chart.js, D3, or Recharts
 */
export const PerformanceChart: React.FC<PerformanceChartProps> = ({
  data,
  loading = false,
  error = null,
  height = 300,
  className = "",
  testId,
}) => {
  if (loading) {
    return (
      <div
        className={`bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 ${className}`}
        style={{ height }}
        data-testid={testId}
      >
        <div className='flex items-center justify-center h-full'>
          <div className='animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600'></div>
          <span className='ml-3 text-gray-600 dark:text-gray-400'>
            Loading chart...
          </span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div
        className={`bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 ${className}`}
        style={{ height }}
        data-testid={testId}
      >
        <div className='flex items-center justify-center h-full text-red-600 dark:text-red-400'>
          <ChartBarIcon className='h-8 w-8 mr-2' />
          <span>Error loading chart: {error}</span>
        </div>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div
        className={`bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 ${className}`}
        style={{ height }}
        data-testid={testId}
      >
        <div className='flex items-center justify-center h-full text-gray-500 dark:text-gray-400'>
          <ChartBarIcon className='h-12 w-12 mr-4' />
          <div className='text-center'>
            <h3 className='text-lg font-medium mb-2'>No Chart Data</h3>
            <p className='text-sm'>
              Performance data will appear here when available
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Simple visualization using CSS bars (placeholder for real chart)
  const maxValue = Math.max(
    ...data.map((d) =>
      Math.max(d.executionRate, d.avgConfidence, d.thresholdEffectiveness)
    )
  );

  return (
    <div
      className={`bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 ${className}`}
      data-testid={testId}
    >
      {/* Chart Header */}
      <div className='flex items-center justify-between mb-4'>
        <h3 className='text-lg font-medium text-gray-900 dark:text-white'>
          Threshold Performance Over Time
        </h3>
        <div className='flex items-center space-x-4 text-sm'>
          <div className='flex items-center space-x-1'>
            <div className='w-3 h-3 bg-blue-500 rounded'></div>
            <span className='text-gray-600 dark:text-gray-400'>
              Execution Rate
            </span>
          </div>
          <div className='flex items-center space-x-1'>
            <div className='w-3 h-3 bg-green-500 rounded'></div>
            <span className='text-gray-600 dark:text-gray-400'>
              Avg Confidence
            </span>
          </div>
          <div className='flex items-center space-x-1'>
            <div className='w-3 h-3 bg-purple-500 rounded'></div>
            <span className='text-gray-600 dark:text-gray-400'>
              Effectiveness
            </span>
          </div>
        </div>
      </div>

      {/* Simple Bar Chart Visualization */}
      <div className='space-y-4' style={{ height: height - 100 }}>
        {data.slice(-10).map((point, index) => (
          <div key={index} className='flex items-center space-x-2'>
            <div className='w-16 text-xs text-gray-500 dark:text-gray-400 truncate'>
              {new Date(point.timestamp).toLocaleDateString()}
            </div>
            <div className='flex-1 flex space-x-1'>
              {/* Execution Rate Bar */}
              <div className='flex-1'>
                <div className='bg-gray-200 dark:bg-gray-700 rounded-full h-4 relative'>
                  <div
                    className='bg-blue-500 h-4 rounded-full transition-all duration-300'
                    style={{
                      width: `${(point.executionRate / maxValue) * 100}%`,
                    }}
                  />
                  <span className='absolute inset-0 flex items-center justify-center text-xs text-white font-medium'>
                    {(point.executionRate * 100).toFixed(0)}%
                  </span>
                </div>
              </div>

              {/* Avg Confidence Bar */}
              <div className='flex-1'>
                <div className='bg-gray-200 dark:bg-gray-700 rounded-full h-4 relative'>
                  <div
                    className='bg-green-500 h-4 rounded-full transition-all duration-300'
                    style={{
                      width: `${(point.avgConfidence / maxValue) * 100}%`,
                    }}
                  />
                  <span className='absolute inset-0 flex items-center justify-center text-xs text-white font-medium'>
                    {(point.avgConfidence * 100).toFixed(0)}%
                  </span>
                </div>
              </div>

              {/* Threshold Effectiveness Bar */}
              <div className='flex-1'>
                <div className='bg-gray-200 dark:bg-gray-700 rounded-full h-4 relative'>
                  <div
                    className='bg-purple-500 h-4 rounded-full transition-all duration-300'
                    style={{
                      width: `${(point.thresholdEffectiveness / maxValue) * 100}%`,
                    }}
                  />
                  <span className='absolute inset-0 flex items-center justify-center text-xs text-white font-medium'>
                    {(point.thresholdEffectiveness * 100).toFixed(0)}%
                  </span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Chart Footer */}
      <div className='mt-4 pt-4 border-t border-gray-200 dark:border-gray-700'>
        <div className='text-center'>
          <p className='text-sm text-gray-500 dark:text-gray-400'>
            Chart component placeholder - In production, this would use a proper
            charting library
          </p>
          <p className='text-xs text-gray-400 dark:text-gray-500 mt-1'>
            TradingView, Chart.js, or D3.js integration recommended
          </p>
        </div>
      </div>
    </div>
  );
};

export default PerformanceChart;
