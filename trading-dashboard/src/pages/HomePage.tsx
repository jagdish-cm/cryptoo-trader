import React from "react";
import {
  ChartBarIcon,
  CurrencyDollarIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  CpuChipIcon,
  CheckCircleIcon,
} from "@heroicons/react/24/outline";

// Import Redux hooks and API
import {
  useGetPortfolioQuery,
  useGetPositionsQuery,
  useGetSignalsQuery,
  useGetPerformanceMetricsQuery,
  useGetSystemStatusQuery,
} from "../store/api/tradingApi";

import { TradeDirection, SignalStrength } from "../types";

const HomePage: React.FC = () => {
  // Use RTK Query hooks to fetch data
  const { data: portfolio, isLoading: portfolioLoading } =
    useGetPortfolioQuery();
  const { data: positions, isLoading: positionsLoading } =
    useGetPositionsQuery();
  const { data: signalsData, isLoading: signalsLoading } = useGetSignalsQuery();
  const { data: metrics, isLoading: metricsLoading } =
    useGetPerformanceMetricsQuery({ period: "30d" });
  const { isLoading: systemLoading } = useGetSystemStatusQuery();

  // Extract signals from the signals data structure
  const signals = signalsData?.active_signals || [];

  // Loading state
  const isLoading =
    portfolioLoading ||
    positionsLoading ||
    signalsLoading ||
    metricsLoading ||
    systemLoading;

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
    }).format(value);
  };

  const formatPercentage = (value: number) => {
    return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
  };

  const getDirectionIcon = (direction: TradeDirection) => {
    return direction === TradeDirection.LONG ? (
      <ArrowTrendingUpIcon className='h-4 w-4 text-success-500' />
    ) : (
      <ArrowTrendingDownIcon className='h-4 w-4 text-danger-500' />
    );
  };

  const getSignalStrengthColor = (strength: SignalStrength) => {
    switch (strength) {
      case SignalStrength.VERY_STRONG:
        return "text-success-600 bg-success-100 dark:text-success-400 dark:bg-success-900/20";
      case SignalStrength.STRONG:
        return "text-success-600 bg-success-100 dark:text-success-400 dark:bg-success-900/20";
      case SignalStrength.MODERATE:
        return "text-warning-600 bg-warning-100 dark:text-warning-400 dark:bg-warning-900/20";
      default:
        return "text-gray-600 bg-gray-100 dark:text-gray-400 dark:bg-gray-800";
    }
  };

  // Show loading state
  if (isLoading) {
    return (
      <div className='flex items-center justify-center h-64'>
        <div className='animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600'></div>
        <span className='ml-3 text-gray-600 dark:text-gray-400'>
          Loading dashboard...
        </span>
      </div>
    );
  }

  return (
    <div className='space-y-6'>
      {/* Portfolio Overview */}
      <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6'>
        <div className='bg-white dark:bg-gray-800 rounded-lg shadow p-6'>
          <div className='flex items-center'>
            <div className='flex-shrink-0'>
              <CurrencyDollarIcon className='h-8 w-8 text-primary-600' />
            </div>
            <div className='ml-4'>
              <p className='text-sm font-medium text-gray-500 dark:text-gray-400'>
                Portfolio Value
              </p>
              <p className='text-2xl font-semibold text-gray-900 dark:text-white'>
                {portfolio ? formatCurrency(portfolio.totalValue) : "$0.00"}
              </p>
            </div>
          </div>
        </div>

        <div className='bg-white dark:bg-gray-800 rounded-lg shadow p-6'>
          <div className='flex items-center'>
            <div className='flex-shrink-0'>
              <ChartBarIcon className='h-8 w-8 text-success-600' />
            </div>
            <div className='ml-4'>
              <p className='text-sm font-medium text-gray-500 dark:text-gray-400'>
                Daily P&L
              </p>
              <p
                className={`text-2xl font-semibold ${
                  (portfolio?.dailyPnL || 0) >= 0
                    ? "text-success-600 dark:text-success-400"
                    : "text-danger-600 dark:text-danger-400"
                }`}
              >
                {portfolio ? formatCurrency(portfolio.dailyPnL) : "$0.00"}
              </p>
            </div>
          </div>
        </div>

        <div className='bg-white dark:bg-gray-800 rounded-lg shadow p-6'>
          <div className='flex items-center'>
            <div className='flex-shrink-0'>
              <ArrowTrendingUpIcon className='h-8 w-8 text-primary-600' />
            </div>
            <div className='ml-4'>
              <p className='text-sm font-medium text-gray-500 dark:text-gray-400'>
                Win Rate
              </p>
              <p className='text-2xl font-semibold text-gray-900 dark:text-white'>
                {metrics ? formatPercentage(metrics.winRate) : "0.00%"}
              </p>
            </div>
          </div>
        </div>

        <div className='bg-white dark:bg-gray-800 rounded-lg shadow p-6'>
          <div className='flex items-center'>
            <div className='flex-shrink-0'>
              <CpuChipIcon className='h-8 w-8 text-primary-600' />
            </div>
            <div className='ml-4'>
              <p className='text-sm font-medium text-gray-500 dark:text-gray-400'>
                Active Positions
              </p>
              <p className='text-2xl font-semibold text-gray-900 dark:text-white'>
                {positions?.length || 0}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className='grid grid-cols-1 lg:grid-cols-2 gap-6'>
        {/* Active Positions */}
        <div className='bg-white dark:bg-gray-800 rounded-lg shadow'>
          <div className='px-6 py-4 border-b border-gray-200 dark:border-gray-700'>
            <h3 className='text-lg font-medium text-gray-900 dark:text-white'>
              Active Positions
            </h3>
          </div>
          <div className='p-6'>
            {!positions || positions.length === 0 ? (
              <p className='text-gray-500 dark:text-gray-400 text-center py-8'>
                No active positions
              </p>
            ) : (
              <div className='space-y-4'>
                {positions.map((position) => (
                  <div
                    key={position.id}
                    className='flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg'
                  >
                    <div className='flex items-center space-x-3'>
                      {getDirectionIcon(position.direction as TradeDirection)}
                      <div>
                        <p className='font-medium text-gray-900 dark:text-white'>
                          {position.symbol}
                        </p>
                        <p className='text-sm text-gray-500 dark:text-gray-400'>
                          {position.direction} • {position.quantity} @{" "}
                          {formatCurrency(position.entryPrice)}
                        </p>
                      </div>
                    </div>
                    <div className='text-right'>
                      <p
                        className={`font-medium ${
                          position.unrealizedPnL >= 0
                            ? "text-success-600 dark:text-success-400"
                            : "text-danger-600 dark:text-danger-400"
                        }`}
                      >
                        {formatCurrency(position.unrealizedPnL)}
                      </p>
                      <p className='text-sm text-gray-500 dark:text-gray-400'>
                        {formatCurrency(position.currentPrice)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Recent Signals */}
        <div className='bg-white dark:bg-gray-800 rounded-lg shadow'>
          <div className='px-6 py-4 border-b border-gray-200 dark:border-gray-700'>
            <h3 className='text-lg font-medium text-gray-900 dark:text-white'>
              Recent Signals
            </h3>
          </div>
          <div className='p-6'>
            {signals.length === 0 ? (
              <p className='text-gray-500 dark:text-gray-400 text-center py-8'>
                No recent signals
              </p>
            ) : (
              <div className='space-y-4'>
                {signals.map((signal) => (
                  <div
                    key={signal.id}
                    className='flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg'
                  >
                    <div className='flex items-center space-x-3'>
                      {getDirectionIcon(signal.direction as TradeDirection)}
                      <div>
                        <p className='font-medium text-gray-900 dark:text-white'>
                          {signal.symbol}
                        </p>
                        <p className='text-sm text-gray-500 dark:text-gray-400'>
                          {signal.reasoning}
                        </p>
                      </div>
                    </div>
                    <div className='text-right'>
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getSignalStrengthColor(signal.strength)}`}
                      >
                        {signal.strength}
                      </span>
                      <p className='text-sm text-gray-500 dark:text-gray-400 mt-1'>
                        {Math.round(signal.confidence * 100)}% confidence
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Performance Metrics */}
      <div className='bg-white dark:bg-gray-800 rounded-lg shadow'>
        <div className='px-6 py-4 border-b border-gray-200 dark:border-gray-700'>
          <h3 className='text-lg font-medium text-gray-900 dark:text-white'>
            Performance Metrics
          </h3>
        </div>
        <div className='p-6'>
          <div className='grid grid-cols-2 md:grid-cols-4 gap-6'>
            <div className='text-center'>
              <p className='text-2xl font-semibold text-gray-900 dark:text-white'>
                {metrics ? formatPercentage(metrics.totalReturn) : "0.00%"}
              </p>
              <p className='text-sm text-gray-500 dark:text-gray-400'>
                Total Return
              </p>
            </div>
            <div className='text-center'>
              <p className='text-2xl font-semibold text-gray-900 dark:text-white'>
                {metrics ? metrics.sharpeRatio.toFixed(2) : "0.00"}
              </p>
              <p className='text-sm text-gray-500 dark:text-gray-400'>
                Sharpe Ratio
              </p>
            </div>
            <div className='text-center'>
              <p className='text-2xl font-semibold text-gray-900 dark:text-white'>
                {metrics ? formatPercentage(metrics.maxDrawdown) : "0.00%"}
              </p>
              <p className='text-sm text-gray-500 dark:text-gray-400'>
                Max Drawdown
              </p>
            </div>
            <div className='text-center'>
              <p className='text-2xl font-semibold text-gray-900 dark:text-white'>
                {metrics ? metrics.totalTrades : 0}
              </p>
              <p className='text-sm text-gray-500 dark:text-gray-400'>
                Total Trades
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* System Status */}
      <div className='bg-white dark:bg-gray-800 rounded-lg shadow'>
        <div className='px-6 py-4 border-b border-gray-200 dark:border-gray-700'>
          <h3 className='text-lg font-medium text-gray-900 dark:text-white'>
            System Status
          </h3>
        </div>
        <div className='p-6'>
          <div className='flex items-center space-x-4'>
            <CheckCircleIcon className='h-8 w-8 text-success-500' />
            <div>
              <p className='font-medium text-gray-900 dark:text-white'>
                System Running
              </p>
              <p className='text-sm text-gray-500 dark:text-gray-400'>
                All components operational • Processing BTC/USDT • Technical
                Analysis phase
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HomePage;
