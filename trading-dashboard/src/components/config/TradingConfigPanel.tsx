/**
 * Trading configuration panel component
 */

import React from "react";
import {
  ChartBarIcon,
  ExclamationTriangleIcon,
  CurrencyDollarIcon,
  ShieldCheckIcon,
} from "@heroicons/react/24/outline";
import { BaseComponentProps } from "../../types/common/base";
import { TradingConfig } from "../../types";

interface TradingConfigPanelProps extends BaseComponentProps {
  config: TradingConfig;
  onConfigChange: (key: keyof TradingConfig, value: unknown) => void;
  onEmergencyStop: () => void;
  loading?: boolean;
  error?: string | null;
}

/**
 * Toggle switch component
 */
const ToggleSwitch: React.FC<{
  enabled: boolean;
  onChange: (enabled: boolean) => void;
  disabled?: boolean;
}> = ({ enabled, onChange, disabled = false }) => (
  <button
    onClick={() => !disabled && onChange(!enabled)}
    disabled={disabled}
    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
      enabled ? "bg-primary-600" : "bg-gray-200 dark:bg-gray-700"
    } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
  >
    <span
      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
        enabled ? "translate-x-6" : "translate-x-1"
      }`}
    />
  </button>
);

/**
 * Trading configuration panel component
 */
export const TradingConfigPanel: React.FC<TradingConfigPanelProps> = ({
  config,
  onConfigChange,
  onEmergencyStop,
  loading = false,
  error = null,
  className = "",
  testId,
}) => {
  const availableSymbols = ["BTC/USDT", "ETH/USDT"];

  const handleSymbolToggle = (symbol: string, checked: boolean) => {
    const newSymbols = checked
      ? [...config.allowedSymbols, symbol]
      : config.allowedSymbols.filter((s) => s !== symbol);
    onConfigChange("allowedSymbols", newSymbols);
  };

  if (loading) {
    return (
      <div
        className={`bg-white dark:bg-gray-800 rounded-lg shadow ${className}`}
        data-testid={testId}
      >
        <div className='px-6 py-4 border-b border-gray-200 dark:border-gray-700'>
          <div className='flex items-center space-x-2'>
            <ChartBarIcon className='h-5 w-5 text-primary-600' />
            <h3 className='text-lg font-medium text-gray-900 dark:text-white'>
              Trading Settings
            </h3>
          </div>
        </div>
        <div className='p-6'>
          <div className='animate-pulse space-y-6'>
            {[...Array(4)].map((_, i) => (
              <div
                key={i}
                className='h-16 bg-gray-200 dark:bg-gray-700 rounded'
              ></div>
            ))}
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
        <div className='flex items-center space-x-2'>
          <ChartBarIcon className='h-5 w-5 text-primary-600' />
          <h3 className='text-lg font-medium text-gray-900 dark:text-white'>
            Trading Settings
          </h3>
        </div>
        {error && (
          <div className='mt-2 text-sm text-red-600 dark:text-red-400'>
            Error: {error}
          </div>
        )}
      </div>

      <div className='p-6 space-y-6'>
        {/* Auto Trading Toggle */}
        <div className='flex items-center justify-between'>
          <div className='flex-1'>
            <div className='flex items-center space-x-2'>
              <label className='text-sm font-medium text-gray-900 dark:text-white'>
                Auto Trading
              </label>
              {config.emergencyStop && (
                <span className='inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'>
                  Emergency Stop Active
                </span>
              )}
            </div>
            <p className='text-sm text-gray-500 dark:text-gray-400'>
              Enable automatic trade execution based on AI signals
            </p>
          </div>
          <ToggleSwitch
            enabled={config.autoTrading && !config.emergencyStop}
            onChange={(enabled) => onConfigChange("autoTrading", enabled)}
            disabled={config.emergencyStop}
          />
        </div>

        {/* Max Positions */}
        <div>
          <label className='block text-sm font-medium text-gray-900 dark:text-white mb-2'>
            Maximum Concurrent Positions
          </label>
          <div className='relative'>
            <input
              type='number'
              min='1'
              max='20'
              value={config.maxPositions}
              onChange={(e) =>
                onConfigChange("maxPositions", parseInt(e.target.value) || 1)
              }
              className='w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent'
            />
            <div className='absolute inset-y-0 right-0 flex items-center pr-3'>
              <ChartBarIcon className='h-4 w-4 text-gray-400' />
            </div>
          </div>
          <p className='text-sm text-gray-500 dark:text-gray-400 mt-1'>
            Maximum number of positions that can be open simultaneously (1-20)
          </p>
        </div>

        {/* Risk Per Trade */}
        <div>
          <label className='block text-sm font-medium text-gray-900 dark:text-white mb-2'>
            Risk Per Trade
          </label>
          <div className='relative'>
            <input
              type='number'
              min='0.1'
              max='10'
              step='0.1'
              value={config.riskPerTrade}
              onChange={(e) =>
                onConfigChange(
                  "riskPerTrade",
                  parseFloat(e.target.value) || 0.1
                )
              }
              className='w-full px-3 py-2 pr-8 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent'
            />
            <div className='absolute inset-y-0 right-0 flex items-center pr-3'>
              <span className='text-sm text-gray-500 dark:text-gray-400'>
                %
              </span>
            </div>
          </div>
          <div className='flex items-center justify-between mt-1'>
            <p className='text-sm text-gray-500 dark:text-gray-400'>
              Percentage of portfolio to risk per trade (0.1% - 10%)
            </p>
            <div
              className={`text-xs font-medium ${
                config.riskPerTrade <= 1
                  ? "text-green-600 dark:text-green-400"
                  : config.riskPerTrade <= 3
                    ? "text-yellow-600 dark:text-yellow-400"
                    : "text-red-600 dark:text-red-400"
              }`}
            >
              {config.riskPerTrade <= 1
                ? "Conservative"
                : config.riskPerTrade <= 3
                  ? "Moderate"
                  : "Aggressive"}
            </div>
          </div>
        </div>

        {/* Position Size Calculator */}
        <div className='p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg'>
          <div className='flex items-center space-x-2 mb-2'>
            <CurrencyDollarIcon className='h-4 w-4 text-blue-600 dark:text-blue-400' />
            <h4 className='text-sm font-medium text-blue-800 dark:text-blue-200'>
              Position Size Calculator
            </h4>
          </div>
          <div className='text-sm text-blue-700 dark:text-blue-300'>
            <p>With current settings:</p>
            <ul className='mt-1 space-y-1'>
              <li>
                • Risk per trade: $
                {((10000 * config.riskPerTrade) / 100).toFixed(2)} (assuming
                $10k portfolio)
              </li>
              <li>
                • Max total risk: $
                {(
                  (10000 * config.riskPerTrade * config.maxPositions) /
                  100
                ).toFixed(2)}{" "}
                across all positions
              </li>
              <li>
                • Portfolio exposure:{" "}
                {(config.riskPerTrade * config.maxPositions).toFixed(1)}%
              </li>
            </ul>
          </div>
        </div>

        {/* Allowed Symbols */}
        <div>
          <label className='block text-sm font-medium text-gray-900 dark:text-white mb-3'>
            Allowed Trading Symbols
          </label>
          <div className='grid grid-cols-2 gap-2'>
            {availableSymbols.map((symbol) => (
              <label
                key={symbol}
                className='flex items-center p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors'
              >
                <input
                  type='checkbox'
                  checked={config.allowedSymbols.includes(symbol)}
                  onChange={(e) => handleSymbolToggle(symbol, e.target.checked)}
                  className='h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 dark:border-gray-600 rounded'
                />
                <span className='ml-2 text-sm text-gray-900 dark:text-white font-medium'>
                  {symbol}
                </span>
              </label>
            ))}
          </div>
          <p className='text-sm text-gray-500 dark:text-gray-400 mt-2'>
            Selected: {config.allowedSymbols.length} of{" "}
            {availableSymbols.length} symbols
          </p>
        </div>

        {/* Trading Hours */}
        <div>
          <label className='block text-sm font-medium text-gray-900 dark:text-white mb-3'>
            Trading Hours (UTC)
          </label>
          <div className='grid grid-cols-2 gap-4'>
            <div>
              <label className='block text-xs text-gray-500 dark:text-gray-400 mb-1'>
                Start Time
              </label>
              <input
                type='time'
                defaultValue='00:00'
                className='w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent'
              />
            </div>
            <div>
              <label className='block text-xs text-gray-500 dark:text-gray-400 mb-1'>
                End Time
              </label>
              <input
                type='time'
                defaultValue='23:59'
                className='w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent'
              />
            </div>
          </div>
          <p className='text-sm text-gray-500 dark:text-gray-400 mt-1'>
            Trading will only occur during these hours
          </p>
        </div>

        {/* Emergency Stop */}
        <div className='pt-4 border-t border-gray-200 dark:border-gray-700'>
          <div className='flex items-start space-x-3 p-4 bg-red-50 dark:bg-red-900/20 rounded-lg'>
            <ExclamationTriangleIcon className='h-5 w-5 text-red-600 dark:text-red-400 mt-0.5' />
            <div className='flex-1'>
              <h4 className='text-sm font-medium text-red-800 dark:text-red-200'>
                Emergency Controls
              </h4>
              <p className='text-sm text-red-700 dark:text-red-300 mt-1'>
                Use this to immediately stop all trading activity and close open
                positions
              </p>
              <button
                onClick={onEmergencyStop}
                className='mt-3 w-full flex items-center justify-center space-x-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium'
              >
                <ShieldCheckIcon className='h-4 w-4' />
                <span>Emergency Stop All Trading</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TradingConfigPanel;
