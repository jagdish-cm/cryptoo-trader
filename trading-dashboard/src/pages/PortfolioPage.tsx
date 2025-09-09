/**
 * Portfolio page component - refactored for better organization and performance
 */

import React, { useState } from "react";
import {
  ArrowPathIcon,
  Cog6ToothIcon,
  ChartBarIcon,
  ExclamationTriangleIcon,
} from "@heroicons/react/24/outline";
import { Position } from "../types";
import { usePortfolioData } from "../hooks/portfolio/usePortfolioData";
import { usePortfolioActions } from "../hooks/portfolio/usePortfolioActions";
// Portfolio components will be implemented
// import { PortfolioSummary } from "../components/portfolio/PortfolioSummary";
// import { PositionsTable } from "../components/portfolio/PositionsTable";
// import { PerformanceChart } from "../components/portfolio/PerformanceChart";
import { LoadingState } from "../components/ui/feedback/LoadingState";
import { useStableCallback } from "../utils/performance/memoization";

/**
 * Position details modal component
 */
const PositionDetailsModal: React.FC<{
  position: Position | null;
  isOpen: boolean;
  onClose: () => void;
  onClosePosition: (positionId: string) => Promise<void>;
}> = React.memo(({ position, isOpen, onClose, onClosePosition }) => {
  const [isClosing, setIsClosing] = useState(false);

  const handleClosePosition = async () => {
    if (!position) return;

    setIsClosing(true);
    try {
      await onClosePosition(position.id);
      onClose();
    } catch (error) {
      // Error is handled by the hook
    } finally {
      setIsClosing(false);
    }
  };

  if (!isOpen || !position) return null;

  return (
    <div className='fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50'>
      <div className='bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto'>
        <div className='px-6 py-4 border-b border-gray-200 dark:border-gray-700'>
          <div className='flex items-center justify-between'>
            <h3 className='text-lg font-medium text-gray-900 dark:text-white'>
              Position Details - {position.symbol}
            </h3>
            <button
              onClick={onClose}
              className='text-gray-400 hover:text-gray-600 dark:hover:text-gray-200'
            >
              <span className='sr-only'>Close</span>
              <svg
                className='h-6 w-6'
                fill='none'
                viewBox='0 0 24 24'
                stroke='currentColor'
              >
                <path
                  strokeLinecap='round'
                  strokeLinejoin='round'
                  strokeWidth={2}
                  d='M6 18L18 6M6 6l12 12'
                />
              </svg>
            </button>
          </div>
        </div>

        <div className='p-6 space-y-6'>
          {/* Position Overview */}
          <div className='grid grid-cols-2 gap-4'>
            <div>
              <label className='text-sm font-medium text-gray-600 dark:text-gray-400'>
                Symbol
              </label>
              <p className='text-lg font-semibold text-gray-900 dark:text-white'>
                {position.symbol}
              </p>
            </div>
            <div>
              <label className='text-sm font-medium text-gray-600 dark:text-gray-400'>
                Side
              </label>
              <p className='text-lg font-semibold text-gray-900 dark:text-white'>
                {position.direction}
              </p>
            </div>
            <div>
              <label className='text-sm font-medium text-gray-600 dark:text-gray-400'>
                Quantity
              </label>
              <p className='text-lg font-semibold text-gray-900 dark:text-white'>
                {position.quantity.toLocaleString()}
              </p>
            </div>
            <div>
              <label className='text-sm font-medium text-gray-600 dark:text-gray-400'>
                Average Price
              </label>
              <p className='text-lg font-semibold text-gray-900 dark:text-white'>
                ${position.entryPrice.toFixed(2)}
              </p>
            </div>
            <div>
              <label className='text-sm font-medium text-gray-600 dark:text-gray-400'>
                Current Price
              </label>
              <p className='text-lg font-semibold text-gray-900 dark:text-white'>
                ${position.currentPrice.toFixed(2)}
              </p>
            </div>
            <div>
              <label className='text-sm font-medium text-gray-600 dark:text-gray-400'>
                Market Value
              </label>
              <p className='text-lg font-semibold text-gray-900 dark:text-white'>
                ${(position.quantity * position.currentPrice).toLocaleString()}
              </p>
            </div>
          </div>

          {/* P&L Information */}
          <div className='bg-gray-50 dark:bg-gray-700 rounded-lg p-4'>
            <h4 className='text-sm font-medium text-gray-600 dark:text-gray-400 mb-3'>
              Profit & Loss
            </h4>
            <div className='grid grid-cols-2 gap-4'>
              <div>
                <label className='text-sm text-gray-600 dark:text-gray-400'>
                  Unrealized P&L
                </label>
                <p
                  className={`text-xl font-bold ${
                    position.unrealizedPnL >= 0
                      ? "text-green-600 dark:text-green-400"
                      : "text-red-600 dark:text-red-400"
                  }`}
                >
                  ${position.unrealizedPnL.toLocaleString()}
                </p>
              </div>
              <div>
                <label className='text-sm text-gray-600 dark:text-gray-400'>
                  Return %
                </label>
                <p
                  className={`text-xl font-bold ${
                    position.unrealizedPnL >= 0
                      ? "text-green-600 dark:text-green-400"
                      : "text-red-600 dark:text-red-400"
                  }`}
                >
                  {position.entryPrice > 0
                    ? (
                        ((position.currentPrice - position.entryPrice) /
                          position.entryPrice) *
                        100
                      ).toFixed(2)
                    : "0.00"}
                  %
                </p>
              </div>
            </div>
          </div>

          {/* Entry Information */}
          <div>
            <label className='text-sm font-medium text-gray-600 dark:text-gray-400'>
              Entry Date
            </label>
            <p className='text-gray-900 dark:text-white'>
              {new Date(position.createdAt).toLocaleString()}
            </p>
          </div>

          {/* Actions */}
          <div className='flex space-x-3 pt-4 border-t border-gray-200 dark:border-gray-700'>
            <button
              onClick={handleClosePosition}
              disabled={isClosing}
              className='flex-1 bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors'
            >
              {isClosing ? "Closing..." : "Close Position"}
            </button>
            <button
              onClick={onClose}
              className='flex-1 bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-200 px-4 py-2 rounded-md hover:bg-gray-400 dark:hover:bg-gray-500 transition-colors'
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
});

PositionDetailsModal.displayName = "PositionDetailsModal";

/**
 * Portfolio page component
 */
export const PortfolioPage: React.FC = () => {
  const [timeRange, setTimeRange] = useState<
    "1D" | "1W" | "1M" | "3M" | "6M" | "1Y" | "ALL"
  >("1M");
  const [selectedPosition, setSelectedPosition] = useState<Position | null>(
    null
  );
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Portfolio data hook
  const {
    portfolio,
    performanceData,
    loading: portfolioLoading,
    error: portfolioError,
    refresh,
    closePosition: closePositionData,
  } = usePortfolioData({
    autoRefresh: true,
    refreshInterval: 30000,
  });

  // Portfolio actions hook
  const {
    loading: actionsLoading,
    error: actionsError,
    closePosition: closePositionAction,
  } = usePortfolioActions({
    onPositionClosed: (positionId) => {
      console.log(`Position ${positionId} closed successfully`);
      refresh(); // Refresh portfolio data after closing position
    },
    onError: (error) => {
      console.error("Portfolio action error:", error);
    },
  });

  // Stable callbacks with useStableCallback
  const handleViewPositionDetails = useStableCallback((position: Position) => {
    setSelectedPosition(position);
    setIsModalOpen(true);
  }, []);

  const handleCloseModal = useStableCallback(() => {
    setIsModalOpen(false);
    setSelectedPosition(null);
  }, []);

  const handleClosePosition = useStableCallback(
    async (positionId: string) => {
      try {
        await closePositionAction(positionId);
        await closePositionData(positionId);
      } catch (error) {
        // Error handling is done by the hooks
      }
    },
    [closePositionAction, closePositionData]
  );

  // Memoized time range change handler
  const handleTimeRangeChange = useStableCallback(
    (newTimeRange: "1D" | "1W" | "1M" | "3M" | "6M" | "1Y" | "ALL") => {
      setTimeRange(newTimeRange);
    },
    []
  );

  const isLoading = portfolioLoading || actionsLoading;
  const error = portfolioError || actionsError;

  if (isLoading && portfolio.positions.length === 0) {
    return (
      <div className='min-h-screen bg-gray-50 dark:bg-gray-900'>
        <LoadingState message='Loading portfolio data...' />
      </div>
    );
  }

  return (
    <div className='min-h-screen bg-gray-50 dark:bg-gray-900'>
      <div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8'>
        {/* Header */}
        <div className='mb-8'>
          <div className='flex items-center justify-between'>
            <div>
              <h1 className='text-3xl font-bold text-gray-900 dark:text-white'>
                Portfolio
              </h1>
              <p className='mt-1 text-sm text-gray-600 dark:text-gray-400'>
                Monitor your positions and portfolio performance
              </p>
            </div>

            <div className='flex items-center space-x-4'>
              {/* Refresh Button */}
              <button
                onClick={refresh}
                disabled={isLoading}
                className='inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors'
              >
                <ArrowPathIcon
                  className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`}
                />
                Refresh
              </button>

              {/* Settings Button */}
              <button className='inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors'>
                <Cog6ToothIcon className='h-4 w-4 mr-2' />
                Settings
              </button>
            </div>
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <div className='mb-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4'>
            <div className='flex items-center'>
              <ExclamationTriangleIcon className='h-5 w-5 text-red-400 mr-3' />
              <div className='text-red-800 dark:text-red-200'>
                <strong>Error:</strong> {error}
              </div>
            </div>
          </div>
        )}

        {/* Portfolio Summary */}
        <div className='mb-8'>
          <div className='bg-white dark:bg-gray-800 rounded-lg shadow p-6'>
            <h3 className='text-lg font-medium text-gray-900 dark:text-white mb-4'>
              Portfolio Summary
            </h3>
            <p className='text-gray-600 dark:text-gray-400'>
              Portfolio components will be implemented here.
            </p>
          </div>
        </div>

        {/* Performance Chart */}
        <div className='mb-8'>
          <div className='bg-white dark:bg-gray-800 rounded-lg shadow p-6'>
            <h3 className='text-lg font-medium text-gray-900 dark:text-white mb-4'>
              Performance Chart
            </h3>
            <p className='text-gray-600 dark:text-gray-400'>
              Performance chart will be implemented here.
            </p>
          </div>
        </div>

        {/* Positions Table */}
        <div className='mb-8'>
          <div className='bg-white dark:bg-gray-800 rounded-lg shadow p-6'>
            <h3 className='text-lg font-medium text-gray-900 dark:text-white mb-4'>
              Positions Table
            </h3>
            <p className='text-gray-600 dark:text-gray-400'>
              Positions table will be implemented here.
            </p>
          </div>
        </div>

        {/* Position Details Modal */}
        <PositionDetailsModal
          position={selectedPosition}
          isOpen={isModalOpen}
          onClose={handleCloseModal}
          onClosePosition={handleClosePosition}
        />

        {/* Empty State */}
        {!portfolioLoading && portfolio.positions.length === 0 && (
          <div className='text-center py-12'>
            <ChartBarIcon className='mx-auto h-12 w-12 text-gray-400 mb-4' />
            <h3 className='text-lg font-medium text-gray-900 dark:text-white mb-2'>
              No Positions
            </h3>
            <p className='text-gray-600 dark:text-gray-400 mb-6'>
              You don't have any open positions yet. Start trading to see your
              portfolio here.
            </p>
            <button className='inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 transition-colors'>
              Start Trading
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default PortfolioPage;
