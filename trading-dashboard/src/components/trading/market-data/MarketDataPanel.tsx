/**
 * Market data panel component for displaying real-time market information
 */

import React, { useState } from "react";
import {
  ArrowPathIcon,
  ExclamationTriangleIcon,
} from "@heroicons/react/24/outline";
import { MarketData } from "../../../types";
import { BaseComponentProps } from "../../../types/common/base";
import { MarketDataError } from "../../ui/feedback/EmptyStates";
import { formatCurrency, formatPercentage } from "../../../utils/formatting";
import {
  formatVolumeWithCurrency,
  getChangeColor,
} from "../../../utils/formatting/tradingFormatters";

interface MarketDataPanelProps extends BaseComponentProps {
  marketData: MarketData[];
  selectedSymbol: string;
  onSymbolSelect: (symbol: string) => void;
  onRefresh?: () => void;
  loading?: boolean;
  error?: string | null;
}

/**
 * Individual market data card component
 */
const MarketDataCard: React.FC<{
  data: MarketData;
  isSelected: boolean;
  onClick: () => void;
}> = ({ data, isSelected, onClick }) => {
  const changeColor = getChangeColor(data.change24h);
  const isPositiveChange = data.change24h >= 0;

  return (
    <div
      className={`p-4 rounded-lg cursor-pointer transition-all duration-200 ${
        isSelected
          ? "bg-primary-50 dark:bg-primary-900/20 border-2 border-primary-200 dark:border-primary-800 shadow-md"
          : "bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 border border-gray-200 dark:border-gray-600"
      }`}
      onClick={onClick}
    >
      <div className='flex items-center justify-between mb-3'>
        <div>
          <div className='flex items-center space-x-2'>
            <p className='font-medium text-gray-900 dark:text-white text-lg'>
              {data.symbol}
            </p>
            {/* Live data indicator */}
            <div className='flex items-center space-x-1'>
              <div className='w-2 h-2 bg-green-500 rounded-full animate-pulse'></div>
              <span className='text-xs text-green-600 dark:text-green-400 font-medium'>
                LIVE
              </span>
            </div>
          </div>
          <p className='text-sm text-gray-500 dark:text-gray-400'>
            Vol: {formatVolumeWithCurrency(data.volume24h)}
          </p>
        </div>
        <div className='text-right'>
          <p className='font-bold text-xl text-gray-900 dark:text-white'>
            {formatCurrency(data.price)}
          </p>
          <div className='flex items-center space-x-1'>
            <span className={`text-sm font-medium ${changeColor}`}>
              {formatPercentage(data.change24h)}
            </span>
            <span className={`text-xs ${changeColor}`}>
              {isPositiveChange ? "↗" : "↘"}
            </span>
          </div>
        </div>
      </div>

      {/* Price Range */}
      <div className='space-y-2'>
        <div className='flex items-center justify-between text-xs text-gray-500 dark:text-gray-400'>
          <span>24h Range</span>
          <span>
            {formatCurrency(data.low24h)} - {formatCurrency(data.high24h)}
          </span>
        </div>

        {/* Price range bar */}
        <div className='relative'>
          <div className='w-full bg-gray-200 dark:bg-gray-600 rounded-full h-2'>
            {/* Current price indicator */}
            <div
              className='absolute top-0 w-1 h-2 bg-blue-500 rounded-full transform -translate-x-1/2'
              style={{
                left: `${((data.price - data.low24h) / (data.high24h - data.low24h)) * 100}%`,
              }}
            />
          </div>
        </div>
      </div>

      {/* Last updated */}
      <div className='mt-3 text-xs text-gray-400 dark:text-gray-500'>
        Updated: {new Date(data.timestamp).toLocaleTimeString()}
      </div>
    </div>
  );
};

/**
 * Market data panel component
 */
export const MarketDataPanel: React.FC<MarketDataPanelProps> = ({
  marketData,
  selectedSymbol,
  onSymbolSelect,
  onRefresh,
  loading = false,
  error = null,
  className = "",
  testId,
}) => {
  const [sortBy, setSortBy] = useState<
    "symbol" | "price" | "change" | "volume"
  >("symbol");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");

  const handleSort = (field: typeof sortBy) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortBy(field);
      setSortOrder("asc");
    }
  };

  const sortedMarketData = React.useMemo(() => {
    return [...marketData].sort((a, b) => {
      let aValue: number | string;
      let bValue: number | string;

      switch (sortBy) {
        case "symbol":
          aValue = a.symbol;
          bValue = b.symbol;
          break;
        case "price":
          aValue = a.price;
          bValue = b.price;
          break;
        case "change":
          aValue = a.change24h;
          bValue = b.change24h;
          break;
        case "volume":
          aValue = a.volume24h;
          bValue = b.volume24h;
          break;
        default:
          return 0;
      }

      if (typeof aValue === "string" && typeof bValue === "string") {
        return sortOrder === "asc"
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue);
      }

      if (typeof aValue === "number" && typeof bValue === "number") {
        return sortOrder === "asc" ? aValue - bValue : bValue - aValue;
      }

      return 0;
    });
  }, [marketData, sortBy, sortOrder]);

  if (loading) {
    return (
      <div
        className={`bg-white dark:bg-gray-800 rounded-lg shadow ${className}`}
        data-testid={testId}
      >
        <div className='px-6 py-4 border-b border-gray-200 dark:border-gray-700'>
          <h3 className='text-lg font-medium text-gray-900 dark:text-white'>
            Market Data
          </h3>
        </div>
        <div className='p-6'>
          <div className='flex items-center justify-center h-32'>
            <div className='animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600'></div>
            <span className='ml-3 text-gray-600 dark:text-gray-400'>
              Loading market data...
            </span>
          </div>
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
            Market Data
          </h3>
        </div>
        <div className='p-6'>
          <MarketDataError onRetry={onRefresh || (() => {})} />
        </div>
      </div>
    );
  }

  if (marketData.length === 0) {
    return (
      <div
        className={`bg-white dark:bg-gray-800 rounded-lg shadow ${className}`}
        data-testid={testId}
      >
        <div className='px-6 py-4 border-b border-gray-200 dark:border-gray-700'>
          <h3 className='text-lg font-medium text-gray-900 dark:text-white'>
            Market Data
          </h3>
        </div>
        <div className='p-6'>
          <div className='text-center py-8'>
            <ExclamationTriangleIcon className='mx-auto h-12 w-12 text-gray-400' />
            <h3 className='mt-2 text-sm font-medium text-gray-900 dark:text-white'>
              No Market Data
            </h3>
            <p className='mt-1 text-sm text-gray-500 dark:text-gray-400'>
              Market data is currently unavailable
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`bg-white dark:bg-gray-800 rounded-lg shadow ${className}`}
      data-testid={testId}
    >
      {/* Header */}
      <div className='px-6 py-4 border-b border-gray-200 dark:border-gray-700'>
        <div className='flex items-center justify-between'>
          <h3 className='text-lg font-medium text-gray-900 dark:text-white'>
            Market Data
          </h3>
          <div className='flex items-center space-x-2'>
            {onRefresh && (
              <button
                onClick={onRefresh}
                className='p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors'
                title='Refresh Market Data (Ctrl+R)'
              >
                <ArrowPathIcon className='h-4 w-4' />
              </button>
            )}
            <span className='text-sm text-gray-500 dark:text-gray-400'>
              {marketData.length} pairs
            </span>
          </div>
        </div>

        {/* Sort Controls */}
        <div className='mt-3 flex items-center space-x-2'>
          <span className='text-sm text-gray-500 dark:text-gray-400'>
            Sort by:
          </span>
          {(["symbol", "price", "change", "volume"] as const).map((field) => (
            <button
              key={field}
              onClick={() => handleSort(field)}
              className={`px-2 py-1 text-xs rounded transition-colors ${
                sortBy === field
                  ? "bg-primary-100 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300"
                  : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
              }`}
            >
              {field.charAt(0).toUpperCase() + field.slice(1)}
              {sortBy === field && (
                <span className='ml-1'>{sortOrder === "asc" ? "↑" : "↓"}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Market Data List */}
      <div className='p-6'>
        <div className='space-y-4'>
          {sortedMarketData.map((data) => (
            <MarketDataCard
              key={data.symbol}
              data={data}
              isSelected={selectedSymbol === data.symbol}
              onClick={() => onSymbolSelect(data.symbol)}
            />
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className='px-6 py-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50 rounded-b-lg'>
        <div className='flex items-center justify-between text-xs text-gray-500 dark:text-gray-400'>
          <span>Real-time market data</span>
          <span>Last update: {new Date().toLocaleTimeString()}</span>
        </div>
      </div>
    </div>
  );
};

export default MarketDataPanel;
