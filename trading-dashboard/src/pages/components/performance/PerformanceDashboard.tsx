/**
 * Performance dashboard layout component for organizing performance analysis panels
 */

import React, { useState, useCallback } from "react";
import {
  CalendarIcon,
  DocumentArrowDownIcon,
  FunnelIcon,
} from "@heroicons/react/24/outline";
import { BaseComponentProps } from "../../../types/common/base";
import { Trade, PerformanceMetrics } from "../../../types";

interface PerformanceDashboardProps extends BaseComponentProps {
  trades: Trade[];
  metrics: PerformanceMetrics;
  timeRange: string;
  onTimeRangeChange: (range: string) => void;
  onExportData?: () => void;
  loading?: boolean;
  error?: string | null;
}

/**
 * Time range selector component
 */
const TimeRangeSelector: React.FC<{
  selectedRange: string;
  onRangeChange: (range: string) => void;
}> = ({ selectedRange, onRangeChange }) => {
  const timeRanges = [
    { value: "1d", label: "1D" },
    { value: "7d", label: "7D" },
    { value: "30d", label: "30D" },
    { value: "90d", label: "90D" },
    { value: "all", label: "ALL" },
  ];

  return (
    <div className='flex items-center space-x-2'>
      <CalendarIcon className='h-4 w-4 text-gray-500 dark:text-gray-400' />
      <div className='flex items-center space-x-1'>
        {timeRanges.map((range) => (
          <button
            key={range.value}
            onClick={() => onRangeChange(range.value)}
            className={`px-3 py-1 text-sm rounded-md transition-colors ${
              selectedRange === range.value
                ? "bg-primary-600 text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
            }`}
          >
            {range.label}
          </button>
        ))}
      </div>
    </div>
  );
};

/**
 * Performance summary cards component
 */
const PerformanceSummaryCards: React.FC<{
  metrics: PerformanceMetrics;
}> = ({ metrics }) => {
  const summaryCards = [
    {
      title: "Total Return",
      value: `${metrics.totalReturn >= 0 ? "+" : ""}${metrics.totalReturn.toFixed(2)}%`,
      icon: metrics.totalReturn >= 0 ? "📈" : "📉",
      color:
        metrics.totalReturn >= 0
          ? "text-green-600 dark:text-green-400"
          : "text-red-600 dark:text-red-400",
      bgColor:
        metrics.totalReturn >= 0
          ? "bg-green-50 dark:bg-green-900/20"
          : "bg-red-50 dark:bg-red-900/20",
    },
    {
      title: "Win Rate",
      value: `${metrics.winRate.toFixed(1)}%`,
      icon: "🎯",
      color:
        metrics.winRate >= 60
          ? "text-green-600 dark:text-green-400"
          : metrics.winRate >= 40
            ? "text-yellow-600 dark:text-yellow-400"
            : "text-red-600 dark:text-red-400",
      bgColor: "bg-blue-50 dark:bg-blue-900/20",
    },
    {
      title: "Sharpe Ratio",
      value: metrics.sharpeRatio.toFixed(2),
      icon: "⚖️",
      color:
        metrics.sharpeRatio >= 1
          ? "text-green-600 dark:text-green-400"
          : "text-gray-600 dark:text-gray-400",
      bgColor: "bg-purple-50 dark:bg-purple-900/20",
    },
    {
      title: "Max Drawdown",
      value: `${metrics.maxDrawdown.toFixed(2)}%`,
      icon: "📊",
      color: "text-red-600 dark:text-red-400",
      bgColor: "bg-orange-50 dark:bg-orange-900/20",
    },
  ];

  return (
    <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6'>
      {summaryCards.map((card, index) => (
        <div key={index} className={`${card.bgColor} rounded-lg shadow p-6`}>
          <div className='flex items-center'>
            <div className='flex-shrink-0'>
              <span className='text-2xl'>{card.icon}</span>
            </div>
            <div className='ml-4'>
              <p className='text-sm font-medium text-gray-500 dark:text-gray-400'>
                {card.title}
              </p>
              <p className={`text-2xl font-semibold ${card.color}`}>
                {card.value}
              </p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

/**
 * Performance dashboard layout component
 */
export const PerformanceDashboard: React.FC<PerformanceDashboardProps> = ({
  trades,
  metrics,
  timeRange,
  onTimeRangeChange,
  onExportData,
  loading = false,
  error = null,
  className = "",
  testId,
}) => {
  const [viewMode, setViewMode] = useState<"overview" | "detailed">("overview");

  const handleExport = useCallback(() => {
    if (onExportData) {
      onExportData();
    } else {
      // Default export functionality
      const dataToExport = {
        metrics,
        trades: trades.slice(0, 100), // Limit for performance
        exportDate: new Date().toISOString(),
        timeRange,
      };

      const blob = new Blob([JSON.stringify(dataToExport, null, 2)], {
        type: "application/json",
      });

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `performance-report-${timeRange}-${new Date().toISOString().split("T")[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  }, [onExportData, metrics, trades, timeRange]);

  if (loading) {
    return (
      <div
        className={`flex items-center justify-center h-64 ${className}`}
        data-testid={testId}
      >
        <div className='animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600'></div>
        <span className='ml-3 text-gray-600 dark:text-gray-400'>
          Loading performance data...
        </span>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`text-center py-12 ${className}`} data-testid={testId}>
        <div className='text-red-600 dark:text-red-400'>
          <p>Error loading performance data: {error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${className}`} data-testid={testId}>
      {/* Header with Controls */}
      <div className='flex items-center justify-between'>
        <h2 className='text-2xl font-bold text-gray-900 dark:text-white'>
          Performance Analytics
        </h2>

        <div className='flex items-center space-x-4'>
          {/* View Mode Toggle */}
          <div className='flex items-center space-x-2'>
            <FunnelIcon className='h-4 w-4 text-gray-500 dark:text-gray-400' />
            <select
              value={viewMode}
              onChange={(e) =>
                setViewMode(e.target.value as "overview" | "detailed")
              }
              className='px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white'
            >
              <option value='overview'>Overview</option>
              <option value='detailed'>Detailed</option>
            </select>
          </div>

          {/* Time Range Selector */}
          <TimeRangeSelector
            selectedRange={timeRange}
            onRangeChange={onTimeRangeChange}
          />

          {/* Export Button */}
          <button
            onClick={handleExport}
            className='flex items-center space-x-2 px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-md hover:bg-primary-700 transition-colors'
            title='Export Performance Report'
          >
            <DocumentArrowDownIcon className='h-4 w-4' />
            <span>Export</span>
          </button>
        </div>
      </div>

      {/* Performance Summary Cards */}
      <PerformanceSummaryCards metrics={metrics} />

      {/* Quick Stats */}
      <div className='bg-white dark:bg-gray-800 rounded-lg shadow p-6'>
        <h3 className='text-lg font-medium text-gray-900 dark:text-white mb-4'>
          Trading Summary ({timeRange.toUpperCase()})
        </h3>

        <div className='grid grid-cols-2 md:grid-cols-4 gap-6 text-center'>
          <div>
            <div className='text-2xl font-bold text-gray-900 dark:text-white'>
              {trades.length}
            </div>
            <div className='text-sm text-gray-500 dark:text-gray-400'>
              Total Trades
            </div>
          </div>

          <div>
            <div className='text-2xl font-bold text-green-600 dark:text-green-400'>
              {trades.filter((t) => t.realizedPnL > 0).length}
            </div>
            <div className='text-sm text-gray-500 dark:text-gray-400'>
              Winning Trades
            </div>
          </div>

          <div>
            <div className='text-2xl font-bold text-red-600 dark:text-red-400'>
              {trades.filter((t) => t.realizedPnL < 0).length}
            </div>
            <div className='text-sm text-gray-500 dark:text-gray-400'>
              Losing Trades
            </div>
          </div>

          <div>
            <div className='text-2xl font-bold text-blue-600 dark:text-blue-400'>
              {trades.length > 0
                ? (
                    trades.reduce((sum, t) => sum + t.realizedPnL, 0) /
                    trades.length
                  ).toFixed(2)
                : "0.00"}
            </div>
            <div className='text-sm text-gray-500 dark:text-gray-400'>
              Avg Trade P&L
            </div>
          </div>
        </div>
      </div>

      {/* Content Area - Will be filled by child components */}
      <div className='space-y-6'>
        {/* Performance chart and detailed panels will be rendered here */}
        <div className='text-center py-8 text-gray-500 dark:text-gray-400'>
          <p>Performance panels will be implemented in the following tasks</p>
          <p className='text-sm mt-2'>
            Charts, trade history, and detailed metrics will appear here
          </p>
        </div>
      </div>
    </div>
  );
};

export default PerformanceDashboard;
