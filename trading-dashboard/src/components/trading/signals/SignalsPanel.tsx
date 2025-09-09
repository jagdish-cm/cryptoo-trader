/**
 * Signals panel component for displaying and managing trading signals
 */

import React, { useState, useMemo } from "react";
import {
  MagnifyingGlassIcon,
  FunnelIcon,
  ClockIcon,
} from "@heroicons/react/24/outline";
import { TradingSignal } from "../../../types";
import { BaseComponentProps } from "../../../types/common/base";
import { EmptySignals } from "../../ui/feedback/EmptyStates";
import {
  getDirectionIcon,
  getSignalStrengthIcon,
} from "../../../utils/ui/iconUtils";
import {
  formatCurrency,
  formatTradingTimestamp,
} from "../../../utils/formatting/tradingFormatters";
import { getSignalStrengthColor } from "../../../utils/formatting/tradingFormatters";

interface SignalsPanelProps extends BaseComponentProps {
  signals: TradingSignal[];
  onExecuteSignal: (signalId: string) => void;
  autoTradingEnabled: boolean;
  loading?: boolean;
  error?: string | null;
}

/**
 * Individual signal card component
 */
const SignalCard: React.FC<{
  signal: TradingSignal;
  onExecute: (signalId: string) => void;
  autoTradingEnabled: boolean;
}> = ({ signal, onExecute, autoTradingEnabled }) => {
  const handleExecute = () => {
    if (
      window.confirm(`Execute ${signal.direction} signal for ${signal.symbol}?`)
    ) {
      onExecute(signal.id);
    }
  };

  const isHighConfidence = signal.confidence > 0.8;
  const isRecentSignal =
    new Date(signal.timestamp) > new Date(Date.now() - 60 * 60 * 1000); // 1 hour

  return (
    <div className='p-4 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600'>
      <div className='flex items-center justify-between mb-3'>
        <div className='flex items-center space-x-3'>
          {getDirectionIcon(signal.direction)}
          <div>
            <div className='flex items-center space-x-2'>
              <p className='font-medium text-gray-900 dark:text-white'>
                {signal.symbol}
              </p>
              {isHighConfidence && (
                <span className='px-1.5 py-0.5 text-xs bg-yellow-100 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-200 rounded'>
                  HIGH
                </span>
              )}
              {isRecentSignal && (
                <span className='px-1.5 py-0.5 text-xs bg-blue-100 dark:bg-blue-900/20 text-blue-800 dark:text-blue-200 rounded'>
                  NEW
                </span>
              )}
            </div>
            <div className='flex items-center space-x-2 mt-1'>
              {getSignalStrengthIcon(signal.strength)}
              <span
                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getSignalStrengthColor(signal.strength)}`}
              >
                {signal.strength}
              </span>
            </div>
          </div>
        </div>
        <button
          onClick={handleExecute}
          disabled={!autoTradingEnabled}
          className={`px-3 py-1 text-sm rounded transition-colors ${
            autoTradingEnabled
              ? "bg-primary-600 text-white hover:bg-primary-700"
              : "bg-gray-300 dark:bg-gray-600 text-gray-500 dark:text-gray-400 cursor-not-allowed"
          }`}
          title={
            autoTradingEnabled ? "Execute Signal" : "Auto trading is disabled"
          }
        >
          Execute
        </button>
      </div>

      <div className='grid grid-cols-2 gap-4 text-sm mb-3'>
        <div>
          <p className='text-gray-500 dark:text-gray-400'>Entry Price</p>
          <p className='font-medium text-gray-900 dark:text-white'>
            {formatCurrency(signal.entryPrice)}
          </p>
        </div>
        <div>
          <p className='text-gray-500 dark:text-gray-400'>Confidence</p>
          <div className='flex items-center space-x-2'>
            <p className='font-medium text-gray-900 dark:text-white'>
              {Math.round(signal.confidence * 100)}%
            </p>
            <div className='flex-1 bg-gray-200 dark:bg-gray-600 rounded-full h-2'>
              <div
                className={`h-2 rounded-full transition-all duration-300 ${
                  signal.confidence > 0.8
                    ? "bg-green-500"
                    : signal.confidence > 0.6
                      ? "bg-yellow-500"
                      : "bg-red-500"
                }`}
                style={{ width: `${signal.confidence * 100}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Stop Loss and Take Profit */}
      <div className='grid grid-cols-2 gap-4 text-sm mb-3'>
        <div>
          <p className='text-gray-500 dark:text-gray-400'>Stop Loss</p>
          <p className='font-medium text-red-600 dark:text-red-400'>
            {formatCurrency(signal.stopLoss)}
          </p>
        </div>
        <div>
          <p className='text-gray-500 dark:text-gray-400'>Take Profit</p>
          <div className='space-y-1'>
            {signal.takeProfitLevels.slice(0, 2).map((level, index) => (
              <p
                key={index}
                className='font-medium text-green-600 dark:text-green-400 text-xs'
              >
                TP{index + 1}: {formatCurrency(level)}
              </p>
            ))}
            {signal.takeProfitLevels.length > 2 && (
              <p className='text-xs text-gray-500 dark:text-gray-400'>
                +{signal.takeProfitLevels.length - 2} more
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Setup Type and Reasoning */}
      <div className='mb-3'>
        <div className='flex items-center space-x-2 mb-1'>
          <span className='px-2 py-1 text-xs bg-blue-100 dark:bg-blue-900/20 text-blue-800 dark:text-blue-200 rounded'>
            {signal.setupType}
          </span>
        </div>
        <p className='text-xs text-gray-600 dark:text-gray-400 line-clamp-2'>
          {signal.reasoning}
        </p>
      </div>

      {/* Timestamp */}
      <div className='flex items-center justify-between text-xs text-gray-500 dark:text-gray-400'>
        <div className='flex items-center space-x-1'>
          <ClockIcon className='h-3 w-3' />
          <span>{formatTradingTimestamp(signal.timestamp)}</span>
        </div>
        <div className='text-right'>
          Risk/Reward:{" "}
          {(
            (signal.takeProfitLevels[0] - signal.entryPrice) /
            (signal.entryPrice - signal.stopLoss)
          ).toFixed(2)}
        </div>
      </div>
    </div>
  );
};

/**
 * Signal filter component
 */
const SignalFilters: React.FC<{
  searchTerm: string;
  onSearchChange: (term: string) => void;
  selectedDirection: string;
  onDirectionChange: (direction: string) => void;
  selectedStrength: string;
  onStrengthChange: (strength: string) => void;
  selectedSetup: string;
  onSetupChange: (setup: string) => void;
}> = ({
  searchTerm,
  onSearchChange,
  selectedDirection,
  onDirectionChange,
  selectedStrength,
  onStrengthChange,
  selectedSetup,
  onSetupChange,
}) => (
  <div className='flex flex-col sm:flex-row gap-3 mb-4'>
    {/* Search */}
    <div className='relative flex-1'>
      <MagnifyingGlassIcon className='absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400' />
      <input
        type='text'
        placeholder='Search signals...'
        value={searchTerm}
        onChange={(e) => onSearchChange(e.target.value)}
        className='w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400'
      />
    </div>

    {/* Direction Filter */}
    <select
      value={selectedDirection}
      onChange={(e) => onDirectionChange(e.target.value)}
      className='px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white'
    >
      <option value=''>All Directions</option>
      <option value='LONG'>Long</option>
      <option value='SHORT'>Short</option>
    </select>

    {/* Strength Filter */}
    <select
      value={selectedStrength}
      onChange={(e) => onStrengthChange(e.target.value)}
      className='px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white'
    >
      <option value=''>All Strengths</option>
      <option value='VERY_STRONG'>Very Strong</option>
      <option value='STRONG'>Strong</option>
      <option value='MODERATE'>Moderate</option>
      <option value='WEAK'>Weak</option>
    </select>

    {/* Setup Filter */}
    <select
      value={selectedSetup}
      onChange={(e) => onSetupChange(e.target.value)}
      className='px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white'
    >
      <option value=''>All Setups</option>
      <option value='BREAKOUT'>Breakout</option>
      <option value='REVERSAL'>Reversal</option>
      <option value='LONG_SUPPORT'>Long Support</option>
      <option value='SHORT_RESISTANCE'>Short Resistance</option>
    </select>
  </div>
);

/**
 * Signals panel component
 */
export const SignalsPanel: React.FC<SignalsPanelProps> = ({
  signals,
  onExecuteSignal,
  autoTradingEnabled,
  loading = false,
  error = null,
  className = "",
  testId,
}) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedDirection, setSelectedDirection] = useState("");
  const [selectedStrength, setSelectedStrength] = useState("");
  const [selectedSetup, setSelectedSetup] = useState("");

  // Filter signals
  const filteredSignals = useMemo(() => {
    return signals.filter((signal) => {
      const matchesSearch =
        !searchTerm ||
        signal.symbol.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesDirection =
        !selectedDirection || signal.direction === selectedDirection;
      const matchesStrength =
        !selectedStrength || signal.strength === selectedStrength;
      const matchesSetup = !selectedSetup || signal.setupType === selectedSetup;

      return (
        matchesSearch && matchesDirection && matchesStrength && matchesSetup
      );
    });
  }, [signals, searchTerm, selectedDirection, selectedStrength, selectedSetup]);

  // Calculate summary metrics
  const summary = useMemo(() => {
    const highConfidenceSignals = signals.filter(
      (s) => s.confidence > 0.8
    ).length;
    const strongSignals = signals.filter(
      (s) => s.strength === "STRONG" || s.strength === "VERY_STRONG"
    ).length;
    const longSignals = signals.filter((s) => s.direction === "LONG").length;
    const shortSignals = signals.filter((s) => s.direction === "SHORT").length;
    const avgConfidence =
      signals.length > 0
        ? signals.reduce((sum, s) => sum + s.confidence, 0) / signals.length
        : 0;

    return {
      highConfidenceSignals,
      strongSignals,
      longSignals,
      shortSignals,
      avgConfidence,
      totalSignals: signals.length,
    };
  }, [signals]);

  if (loading) {
    return (
      <div
        className={`bg-white dark:bg-gray-800 rounded-lg shadow ${className}`}
        data-testid={testId}
      >
        <div className='px-6 py-4 border-b border-gray-200 dark:border-gray-700'>
          <h3 className='text-lg font-medium text-gray-900 dark:text-white'>
            Trading Signals
          </h3>
        </div>
        <div className='p-6'>
          <div className='flex items-center justify-center h-32'>
            <div className='animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600'></div>
            <span className='ml-3 text-gray-600 dark:text-gray-400'>
              Loading signals...
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
            Trading Signals
          </h3>
        </div>
        <div className='p-6'>
          <div className='text-center text-red-600 dark:text-red-400'>
            <p>Error loading signals: {error}</p>
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
      {/* Header with Summary */}
      <div className='px-6 py-4 border-b border-gray-200 dark:border-gray-700'>
        <div className='flex items-center justify-between mb-3'>
          <h3 className='text-lg font-medium text-gray-900 dark:text-white'>
            Trading Signals
          </h3>
          <div className='flex items-center space-x-2'>
            <FunnelIcon className='h-4 w-4 text-gray-400' />
            <span className='text-sm text-gray-500 dark:text-gray-400'>
              {filteredSignals.length} of {signals.length}
            </span>
          </div>
        </div>

        {/* Summary Stats */}
        <div className='grid grid-cols-4 gap-4 text-center'>
          <div>
            <div className='text-sm font-medium text-blue-600 dark:text-blue-400'>
              {Math.round(summary.avgConfidence * 100)}%
            </div>
            <div className='text-xs text-gray-500 dark:text-gray-400'>
              Avg Confidence
            </div>
          </div>
          <div>
            <div className='text-sm font-medium text-green-600 dark:text-green-400'>
              {summary.strongSignals}
            </div>
            <div className='text-xs text-gray-500 dark:text-gray-400'>
              Strong
            </div>
          </div>
          <div>
            <div className='text-sm font-medium text-purple-600 dark:text-purple-400'>
              {summary.longSignals}
            </div>
            <div className='text-xs text-gray-500 dark:text-gray-400'>Long</div>
          </div>
          <div>
            <div className='text-sm font-medium text-orange-600 dark:text-orange-400'>
              {summary.shortSignals}
            </div>
            <div className='text-xs text-gray-500 dark:text-gray-400'>
              Short
            </div>
          </div>
        </div>

        {/* Auto Trading Status */}
        {!autoTradingEnabled && (
          <div className='mt-3 p-2 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded'>
            <p className='text-xs text-yellow-800 dark:text-yellow-200'>
              Auto trading is disabled. Enable it to execute signals
              automatically.
            </p>
          </div>
        )}
      </div>

      <div className='p-6'>
        {signals.length === 0 ? (
          <EmptySignals />
        ) : (
          <>
            {/* Filters */}
            <SignalFilters
              searchTerm={searchTerm}
              onSearchChange={setSearchTerm}
              selectedDirection={selectedDirection}
              onDirectionChange={setSelectedDirection}
              selectedStrength={selectedStrength}
              onStrengthChange={setSelectedStrength}
              selectedSetup={selectedSetup}
              onSetupChange={setSelectedSetup}
            />

            {/* Signals List */}
            {filteredSignals.length === 0 ? (
              <div className='text-center py-8 text-gray-500 dark:text-gray-400'>
                <p>No signals match the current filters</p>
              </div>
            ) : (
              <div className='space-y-4'>
                {filteredSignals.map((signal) => (
                  <SignalCard
                    key={signal.id}
                    signal={signal}
                    onExecute={onExecuteSignal}
                    autoTradingEnabled={autoTradingEnabled}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default SignalsPanel;
