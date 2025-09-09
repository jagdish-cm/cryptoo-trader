/**
 * Trading dashboard layout component for organizing trading panels
 */

import React, { useState, useCallback } from "react";
import { BaseComponentProps } from "../../../types/common/base";
import { MarketData, Position, TradingSignal } from "../../../types";

interface TradingDashboardProps extends BaseComponentProps {
  selectedSymbol: string;
  onSymbolChange: (symbol: string) => void;
  marketData: MarketData[];
  positions: Position[];
  signals: TradingSignal[];
  autoTradingEnabled: boolean;
  onToggleAutoTrading: () => void;
  onClosePosition: (positionId: string) => void;
  onExecuteSignal: (signalId: string) => void;
  loading?: boolean;
  error?: string | null;
  onRetryMarketData?: () => void;
}

/**
 * Trading dashboard layout with responsive grid
 */
export const TradingDashboard: React.FC<TradingDashboardProps> = ({
  selectedSymbol,
  onSymbolChange,
  marketData,
  positions,
  signals,
  autoTradingEnabled,
  onToggleAutoTrading,
  onClosePosition,
  onExecuteSignal,
  loading = false,
  error = null,
  onRetryMarketData,
  className = "",
  testId,
}) => {
  const [panelSizes, setPanelSizes] = useState({
    marketData: "normal",
    chart: "normal",
    positions: "normal",
    signals: "normal",
  });

  const handlePanelResize = useCallback((panel: string, size: string) => {
    setPanelSizes((prev) => ({ ...prev, [panel]: size }));
  }, []);

  // Keyboard shortcuts for common actions
  React.useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      // Ctrl/Cmd + T for toggle auto trading
      if ((event.ctrlKey || event.metaKey) && event.key === "t") {
        event.preventDefault();
        onToggleAutoTrading();
      }

      // Ctrl/Cmd + R for refresh market data
      if ((event.ctrlKey || event.metaKey) && event.key === "r") {
        event.preventDefault();
        onRetryMarketData?.();
      }
    };

    window.addEventListener("keydown", handleKeyPress);
    return () => window.removeEventListener("keydown", handleKeyPress);
  }, [onToggleAutoTrading, onRetryMarketData]);

  if (loading) {
    return (
      <div
        className={`flex items-center justify-center h-64 ${className}`}
        data-testid={testId}
      >
        <div className='animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600'></div>
        <span className='ml-3 text-gray-600 dark:text-gray-400'>
          Loading trading data...
        </span>
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${className}`} data-testid={testId}>
      {/* Trading Controls Header */}
      <div className='bg-white dark:bg-gray-800 rounded-lg shadow p-6'>
        <div className='flex items-center justify-between'>
          <h2 className='text-lg font-medium text-gray-900 dark:text-white'>
            Trading Controls
          </h2>
          <div className='flex items-center space-x-4'>
            <div className='flex items-center space-x-2'>
              <span className='text-sm text-gray-500 dark:text-gray-400'>
                Auto Trading:
              </span>
              <button
                onClick={onToggleAutoTrading}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  autoTradingEnabled
                    ? "bg-primary-600"
                    : "bg-gray-200 dark:bg-gray-700"
                }`}
                title='Toggle Auto Trading (Ctrl+T)'
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    autoTradingEnabled ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </button>
            </div>
            <div className='flex items-center space-x-2'>
              <div
                className={`w-2 h-2 rounded-full ${
                  autoTradingEnabled
                    ? "bg-green-500 animate-pulse"
                    : "bg-yellow-500"
                }`}
              />
              <span
                className={`text-sm font-medium ${
                  autoTradingEnabled
                    ? "text-green-600 dark:text-green-400"
                    : "text-yellow-600 dark:text-yellow-400"
                }`}
              >
                {autoTradingEnabled ? "Active" : "Paused"}
              </span>
            </div>
          </div>
        </div>

        {/* Quick Stats */}
        <div className='mt-4 grid grid-cols-1 md:grid-cols-4 gap-4'>
          <div className='text-center'>
            <div className='text-2xl font-bold text-gray-900 dark:text-white'>
              {positions.length}
            </div>
            <div className='text-sm text-gray-500 dark:text-gray-400'>
              Active Positions
            </div>
          </div>
          <div className='text-center'>
            <div className='text-2xl font-bold text-blue-600 dark:text-blue-400'>
              {signals.length}
            </div>
            <div className='text-sm text-gray-500 dark:text-gray-400'>
              Active Signals
            </div>
          </div>
          <div className='text-center'>
            <div className='text-2xl font-bold text-green-600 dark:text-green-400'>
              {marketData.length}
            </div>
            <div className='text-sm text-gray-500 dark:text-gray-400'>
              Market Pairs
            </div>
          </div>
          <div className='text-center'>
            <div className='text-2xl font-bold text-purple-600 dark:text-purple-400'>
              {selectedSymbol}
            </div>
            <div className='text-sm text-gray-500 dark:text-gray-400'>
              Selected Pair
            </div>
          </div>
        </div>
      </div>

      {/* Main Trading Grid */}
      <div className='grid grid-cols-1 lg:grid-cols-3 gap-6'>
        {/* Market Data Panel - Will be replaced with MarketDataPanel component */}
        <div
          className={`lg:col-span-1 ${panelSizes.marketData === "expanded" ? "lg:col-span-2" : ""}`}
        >
          <div className='bg-white dark:bg-gray-800 rounded-lg shadow'>
            <div className='px-6 py-4 border-b border-gray-200 dark:border-gray-700'>
              <div className='flex items-center justify-between'>
                <h3 className='text-lg font-medium text-gray-900 dark:text-white'>
                  Market Data
                </h3>
                <button
                  onClick={() =>
                    handlePanelResize(
                      "marketData",
                      panelSizes.marketData === "expanded"
                        ? "normal"
                        : "expanded"
                    )
                  }
                  className='text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
                >
                  {panelSizes.marketData === "expanded" ? "Collapse" : "Expand"}
                </button>
              </div>
            </div>
            <div className='p-6'>
              {/* Market data content will be moved to MarketDataPanel */}
              <div className='text-center py-8 text-gray-500 dark:text-gray-400'>
                <p>Market data panel will be implemented here</p>
              </div>
            </div>
          </div>
        </div>

        {/* Chart Panel - Will be replaced with chart component */}
        <div
          className={`lg:col-span-2 ${panelSizes.marketData === "expanded" ? "lg:col-span-1" : ""}`}
        >
          <div className='bg-white dark:bg-gray-800 rounded-lg shadow'>
            <div className='px-6 py-4 border-b border-gray-200 dark:border-gray-700'>
              <h3 className='text-lg font-medium text-gray-900 dark:text-white'>
                {selectedSymbol} Chart
              </h3>
            </div>
            <div className='p-6'>
              <div className='h-96 bg-gray-50 dark:bg-gray-700 rounded-lg flex items-center justify-center'>
                <div className='text-center'>
                  <div className='text-gray-500 dark:text-gray-400'>
                    Chart component will be implemented here
                  </div>
                  <p className='text-sm text-gray-400 dark:text-gray-500 mt-2'>
                    TradingView or custom chart integration
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Positions and Signals Grid */}
      <div className='grid grid-cols-1 lg:grid-cols-2 gap-6'>
        {/* Positions Panel - Will be replaced with PositionsPanel component */}
        <div className='bg-white dark:bg-gray-800 rounded-lg shadow'>
          <div className='px-6 py-4 border-b border-gray-200 dark:border-gray-700'>
            <h3 className='text-lg font-medium text-gray-900 dark:text-white'>
              Active Positions
            </h3>
          </div>
          <div className='p-6'>
            {/* Positions content will be moved to PositionsPanel */}
            <div className='text-center py-8 text-gray-500 dark:text-gray-400'>
              <p>Positions panel will be implemented here</p>
            </div>
          </div>
        </div>

        {/* Signals Panel - Will be replaced with SignalsPanel component */}
        <div className='bg-white dark:bg-gray-800 rounded-lg shadow'>
          <div className='px-6 py-4 border-b border-gray-200 dark:border-gray-700'>
            <h3 className='text-lg font-medium text-gray-900 dark:text-white'>
              Trading Signals
            </h3>
          </div>
          <div className='p-6'>
            {/* Signals content will be moved to SignalsPanel */}
            <div className='text-center py-8 text-gray-500 dark:text-gray-400'>
              <p>Signals panel will be implemented here</p>
            </div>
          </div>
        </div>
      </div>

      {/* Keyboard Shortcuts Help */}
      <div className='text-xs text-gray-400 dark:text-gray-500 text-center'>
        Keyboard shortcuts: Ctrl+T (Toggle Auto Trading), Ctrl+R (Refresh Market
        Data)
      </div>
    </div>
  );
};

export default TradingDashboard;
