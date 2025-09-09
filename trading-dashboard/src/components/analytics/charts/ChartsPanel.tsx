/**
 * Charts panel component for visualizing performance data
 */

import React, { useState } from "react";
import {
  ChartBarIcon,
  ArrowsPointingOutIcon,
  Cog6ToothIcon,
} from "@heroicons/react/24/outline";
import { BaseComponentProps } from "../../../types/common/base";
import { Trade, PerformanceMetrics } from "../../../types";
import { formatCurrency, formatPercentage } from "../../../utils/formatting";

interface ChartsPanelProps extends BaseComponentProps {
  trades: Trade[];
  metrics: PerformanceMetrics | null;
  loading?: boolean;
  error?: string | null;
}

/**
 * Chart type selector component
 */
const ChartTypeSelector: React.FC<{
  selectedChart: string;
  onChartChange: (chart: string) => void;
}> = ({ selectedChart, onChartChange }) => {
  const chartTypes = [
    { value: "equity", label: "Equity Curve" },
    { value: "drawdown", label: "Drawdown" },
    { value: "monthly", label: "Monthly Returns" },
    { value: "distribution", label: "P&L Distribution" },
  ];

  return (
    <div className='flex items-center space-x-2'>
      {chartTypes.map((chart) => (
        <button
          key={chart.value}
          onClick={() => onChartChange(chart.value)}
          className={`px-3 py-1 text-sm rounded transition-colors ${
            selectedChart === chart.value
              ? "bg-primary-100 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300"
              : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
          }`}
        >
          {chart.label}
        </button>
      ))}
    </div>
  );
};

/**
 * Simple equity curve chart component (placeholder)
 */
const EquityCurveChart: React.FC<{
  trades: Trade[];
}> = ({ trades }) => {
  // Calculate cumulative P&L for equity curve
  const equityData = trades.reduce(
    (acc, trade, index) => {
      const prevValue = index === 0 ? 10000 : acc[index - 1].value; // Starting with $10k
      acc.push({
        date: trade.exitTime.toISOString().split("T")[0],
        value: prevValue + trade.realizedPnL,
        pnl: trade.realizedPnL,
      });
      return acc;
    },
    [] as Array<{ date: string; value: number; pnl: number }>
  );

  const maxValue = Math.max(...equityData.map((d) => d.value));
  const minValue = Math.min(...equityData.map((d) => d.value));
  const range = maxValue - minValue;

  return (
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

          {/* Equity curve */}
          {equityData.length > 1 && (
            <polyline
              fill='none'
              stroke='currentColor'
              strokeWidth='2'
              className='text-blue-600 dark:text-blue-400'
              points={equityData
                .map((point, index) => {
                  const x = (index / (equityData.length - 1)) * 100;
                  const y = 100 - ((point.value - minValue) / range) * 100;
                  return `${x},${y}`;
                })
                .join(" ")}
            />
          )}
        </svg>

        {/* Y-axis labels */}
        <div className='absolute left-0 top-0 h-full flex flex-col justify-between text-xs text-gray-500 dark:text-gray-400'>
          <span>{formatCurrency(maxValue)}</span>
          <span>{formatCurrency((maxValue + minValue) / 2)}</span>
          <span>{formatCurrency(minValue)}</span>
        </div>
      </div>
    </div>
  );
};

/**
 * Simple drawdown chart component (placeholder)
 */
const DrawdownChart: React.FC<{
  trades: Trade[];
}> = ({ trades }) => {
  // Calculate running drawdown
  let peak = 10000; // Starting value
  let currentValue = 10000;

  const drawdownData = trades.map((trade) => {
    currentValue += trade.realizedPnL;
    if (currentValue > peak) {
      peak = currentValue;
    }
    const drawdown = ((currentValue - peak) / peak) * 100;
    return {
      date: trade.exitTime,
      drawdown: Math.min(0, drawdown),
    };
  });

  const maxDrawdown = Math.min(...drawdownData.map((d) => d.drawdown));

  return (
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

          {/* Drawdown area */}
          {drawdownData.length > 1 && (
            <>
              <polyline
                fill='none'
                stroke='currentColor'
                strokeWidth='2'
                className='text-red-600 dark:text-red-400'
                points={drawdownData
                  .map((point, index) => {
                    const x = (index / (drawdownData.length - 1)) * 100;
                    const y = 100 + (point.drawdown / maxDrawdown) * 100;
                    return `${x},${y}`;
                  })
                  .join(" ")}
              />
              <polygon
                fill='currentColor'
                className='text-red-600 dark:text-red-400'
                opacity='0.2'
                points={`0,100 ${drawdownData
                  .map((point, index) => {
                    const x = (index / (drawdownData.length - 1)) * 100;
                    const y = 100 + (point.drawdown / maxDrawdown) * 100;
                    return `${x},${y}`;
                  })
                  .join(" ")} 100,100`}
              />
            </>
          )}
        </svg>

        {/* Y-axis labels */}
        <div className='absolute left-0 top-0 h-full flex flex-col justify-between text-xs text-gray-500 dark:text-gray-400'>
          <span>0%</span>
          <span>{formatPercentage(maxDrawdown / 2)}</span>
          <span>{formatPercentage(maxDrawdown)}</span>
        </div>
      </div>
    </div>
  );
};

/**
 * Monthly returns chart component (placeholder)
 */
const MonthlyReturnsChart: React.FC<{
  trades: Trade[];
}> = ({ trades }) => {
  // Group trades by month and calculate monthly returns
  const monthlyData = trades.reduce(
    (acc, trade) => {
      const month = new Date(trade.exitTime).toISOString().slice(0, 7); // YYYY-MM
      if (!acc[month]) {
        acc[month] = 0;
      }
      acc[month] += trade.realizedPnL;
      return acc;
    },
    {} as Record<string, number>
  );

  const months = Object.keys(monthlyData).sort();
  const maxReturn = Math.max(...Object.values(monthlyData));
  const minReturn = Math.min(...Object.values(monthlyData));
  const range = maxReturn - minReturn;

  return (
    <div className='h-64 bg-gray-50 dark:bg-gray-700 rounded-lg p-4'>
      <div className='flex items-end justify-between h-full space-x-1'>
        {months.map((month) => {
          const value = monthlyData[month];
          const height = range > 0 ? Math.abs(value / range) * 80 : 20;
          const isPositive = value >= 0;

          return (
            <div key={month} className='flex-1 flex flex-col items-center'>
              <div
                className={`w-full rounded-t transition-all duration-300 ${
                  isPositive
                    ? "bg-green-500 dark:bg-green-400"
                    : "bg-red-500 dark:bg-red-400"
                }`}
                style={{ height: `${height}%` }}
                title={`${month}: ${formatCurrency(value)}`}
              />
              <div className='text-xs text-gray-500 dark:text-gray-400 mt-1 transform -rotate-45 origin-left'>
                {month.slice(-2)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

/**
 * P&L distribution chart component (placeholder)
 */
const PnLDistributionChart: React.FC<{
  trades: Trade[];
}> = ({ trades }) => {
  // Create histogram of P&L values
  const pnlValues = trades.map((t) => t.realizedPnL);
  const min = Math.min(...pnlValues);
  const max = Math.max(...pnlValues);
  const bucketCount = 10;
  const bucketSize = (max - min) / bucketCount;

  const buckets = Array.from({ length: bucketCount }, (_, i) => {
    const bucketMin = min + i * bucketSize;
    const bucketMax = min + (i + 1) * bucketSize;
    const count = pnlValues.filter(
      (v) => v >= bucketMin && v < bucketMax
    ).length;
    return {
      min: bucketMin,
      max: bucketMax,
      count,
      label: formatCurrency(bucketMin),
    };
  });

  const maxCount = Math.max(...buckets.map((b) => b.count));

  return (
    <div className='h-64 bg-gray-50 dark:bg-gray-700 rounded-lg p-4'>
      <div className='flex items-end justify-between h-full space-x-1'>
        {buckets.map((bucket, index) => {
          const height = maxCount > 0 ? (bucket.count / maxCount) * 80 : 0;
          const isPositive = bucket.min >= 0;

          return (
            <div key={index} className='flex-1 flex flex-col items-center'>
              <div
                className={`w-full rounded-t transition-all duration-300 ${
                  isPositive
                    ? "bg-green-500 dark:bg-green-400"
                    : "bg-red-500 dark:bg-red-400"
                }`}
                style={{ height: `${height}%` }}
                title={`${bucket.label}: ${bucket.count} trades`}
              />
              <div className='text-xs text-gray-500 dark:text-gray-400 mt-1 text-center'>
                {bucket.count}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

/**
 * Charts panel component
 */
export const ChartsPanel: React.FC<ChartsPanelProps> = ({
  trades,
  metrics,
  loading = false,
  error = null,
  className = "",
  testId,
}) => {
  const [selectedChart, setSelectedChart] = useState("equity");
  const [isFullscreen, setIsFullscreen] = useState(false);

  const renderChart = () => {
    if (trades.length === 0) {
      return (
        <div className='h-64 flex items-center justify-center text-gray-500 dark:text-gray-400'>
          <div className='text-center'>
            <ChartBarIcon className='mx-auto h-12 w-12 mb-4' />
            <p>No trade data available for charting</p>
            <p className='text-sm mt-1'>
              Complete some trades to see performance charts
            </p>
          </div>
        </div>
      );
    }

    switch (selectedChart) {
      case "equity":
        return <EquityCurveChart trades={trades} />;
      case "drawdown":
        return <DrawdownChart trades={trades} />;
      case "monthly":
        return <MonthlyReturnsChart trades={trades} />;
      case "distribution":
        return <PnLDistributionChart trades={trades} />;
      default:
        return <EquityCurveChart trades={trades} />;
    }
  };

  if (loading) {
    return (
      <div
        className={`bg-white dark:bg-gray-800 rounded-lg shadow ${className}`}
        data-testid={testId}
      >
        <div className='px-6 py-4 border-b border-gray-200 dark:border-gray-700'>
          <h3 className='text-lg font-medium text-gray-900 dark:text-white'>
            Performance Charts
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
            Performance Charts
          </h3>
        </div>
        <div className='p-6'>
          <div className='text-center text-red-600 dark:text-red-400'>
            <p>Error loading charts: {error}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`bg-white dark:bg-gray-800 rounded-lg shadow ${className} ${isFullscreen ? "fixed inset-4 z-50" : ""}`}
      data-testid={testId}
    >
      {/* Header */}
      <div className='px-6 py-4 border-b border-gray-200 dark:border-gray-700'>
        <div className='flex items-center justify-between'>
          <h3 className='text-lg font-medium text-gray-900 dark:text-white'>
            Performance Charts
          </h3>

          <div className='flex items-center space-x-4'>
            {/* Chart Type Selector */}
            <ChartTypeSelector
              selectedChart={selectedChart}
              onChartChange={setSelectedChart}
            />

            {/* Controls */}
            <div className='flex items-center space-x-2'>
              <button
                onClick={() => setIsFullscreen(!isFullscreen)}
                className='p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors'
                title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
              >
                <ArrowsPointingOutIcon className='h-4 w-4' />
              </button>

              <button
                className='p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors'
                title='Chart Settings'
              >
                <Cog6ToothIcon className='h-4 w-4' />
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className='p-6'>
        {/* Chart Description */}
        <div className='mb-4'>
          <p className='text-sm text-gray-600 dark:text-gray-400'>
            {selectedChart === "equity" &&
              "Track your portfolio value over time"}
            {selectedChart === "drawdown" &&
              "Monitor peak-to-trough declines in portfolio value"}
            {selectedChart === "monthly" &&
              "View monthly profit and loss performance"}
            {selectedChart === "distribution" &&
              "Analyze the distribution of trade outcomes"}
          </p>
        </div>

        {/* Chart */}
        {renderChart()}

        {/* Chart Stats */}
        {trades.length > 0 && metrics && (
          <div className='mt-6 grid grid-cols-1 md:grid-cols-4 gap-4 pt-4 border-t border-gray-200 dark:border-gray-700'>
            <div className='text-center'>
              <div className='text-lg font-semibold text-gray-900 dark:text-white'>
                {trades.length}
              </div>
              <div className='text-sm text-gray-500 dark:text-gray-400'>
                Total Trades
              </div>
            </div>

            <div className='text-center'>
              <div
                className={`text-lg font-semibold ${
                  metrics.totalReturn >= 0
                    ? "text-green-600 dark:text-green-400"
                    : "text-red-600 dark:text-red-400"
                }`}
              >
                {formatPercentage(metrics.totalReturn)}
              </div>
              <div className='text-sm text-gray-500 dark:text-gray-400'>
                Total Return
              </div>
            </div>

            <div className='text-center'>
              <div className='text-lg font-semibold text-blue-600 dark:text-blue-400'>
                {metrics.winRate.toFixed(1)}%
              </div>
              <div className='text-sm text-gray-500 dark:text-gray-400'>
                Win Rate
              </div>
            </div>

            <div className='text-center'>
              <div className='text-lg font-semibold text-purple-600 dark:text-purple-400'>
                {metrics.sharpeRatio.toFixed(2)}
              </div>
              <div className='text-sm text-gray-500 dark:text-gray-400'>
                Sharpe Ratio
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ChartsPanel;
