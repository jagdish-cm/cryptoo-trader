/**
 * Trading controls component for managing trading configuration and actions
 */

import React from "react";
import {
  CheckCircleIcon,
  ExclamationTriangleIcon,
  CogIcon,
} from "@heroicons/react/24/outline";
import { BaseComponentProps } from "../../../types/common/base";

interface TradingControlsProps extends BaseComponentProps {
  autoTradingEnabled: boolean;
  onToggleAutoTrading: () => void;
  maxPositions?: number;
  riskPerTrade?: number;
  emergencyStop?: boolean;
  onEmergencyStop?: () => void;
  onOpenSettings?: () => void;
}

/**
 * Trading controls component
 */
export const TradingControls: React.FC<TradingControlsProps> = ({
  autoTradingEnabled,
  onToggleAutoTrading,
  maxPositions = 10,
  riskPerTrade = 2,
  emergencyStop = false,
  onEmergencyStop,
  onOpenSettings,
  className = "",
  testId,
}) => {
  return (
    <div
      className={`bg-white dark:bg-gray-800 rounded-lg shadow p-6 ${className}`}
      data-testid={testId}
    >
      <div className='flex items-center justify-between mb-6'>
        <h2 className='text-lg font-medium text-gray-900 dark:text-white'>
          Trading Controls
        </h2>
        {onOpenSettings && (
          <button
            onClick={onOpenSettings}
            className='p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors'
            title='Open Trading Settings'
          >
            <CogIcon className='h-5 w-5' />
          </button>
        )}
      </div>

      <div className='grid grid-cols-1 md:grid-cols-2 gap-6'>
        {/* Auto Trading Toggle */}
        <div className='space-y-3'>
          <div className='flex items-center justify-between'>
            <span className='text-sm font-medium text-gray-700 dark:text-gray-300'>
              Auto Trading
            </span>
            <button
              onClick={onToggleAutoTrading}
              disabled={emergencyStop}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                autoTradingEnabled && !emergencyStop
                  ? "bg-primary-600"
                  : "bg-gray-200 dark:bg-gray-700"
              } ${emergencyStop ? "opacity-50 cursor-not-allowed" : ""}`}
              title={
                emergencyStop
                  ? "Emergency stop is active"
                  : "Toggle Auto Trading"
              }
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  autoTradingEnabled && !emergencyStop
                    ? "translate-x-6"
                    : "translate-x-1"
                }`}
              />
            </button>
          </div>

          <div className='flex items-center space-x-2'>
            {emergencyStop ? (
              <>
                <ExclamationTriangleIcon className='h-5 w-5 text-red-500' />
                <span className='text-sm font-medium text-red-600 dark:text-red-400'>
                  Emergency Stop Active
                </span>
              </>
            ) : autoTradingEnabled ? (
              <>
                <CheckCircleIcon className='h-5 w-5 text-green-500' />
                <span className='text-sm font-medium text-green-600 dark:text-green-400'>
                  Active
                </span>
              </>
            ) : (
              <>
                <ExclamationTriangleIcon className='h-5 w-5 text-yellow-500' />
                <span className='text-sm font-medium text-yellow-600 dark:text-yellow-400'>
                  Paused
                </span>
              </>
            )}
          </div>
        </div>

        {/* Emergency Stop */}
        <div className='space-y-3'>
          <div className='flex items-center justify-between'>
            <span className='text-sm font-medium text-gray-700 dark:text-gray-300'>
              Emergency Controls
            </span>
          </div>

          {onEmergencyStop && (
            <button
              onClick={onEmergencyStop}
              className='w-full px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-md transition-colors'
            >
              Emergency Stop All Trading
            </button>
          )}
        </div>
      </div>

      {/* Trading Configuration Summary */}
      <div className='mt-6 pt-6 border-t border-gray-200 dark:border-gray-700'>
        <h3 className='text-sm font-medium text-gray-700 dark:text-gray-300 mb-3'>
          Current Configuration
        </h3>

        <div className='grid grid-cols-2 md:grid-cols-4 gap-4 text-center'>
          <div>
            <div className='text-lg font-semibold text-gray-900 dark:text-white'>
              {maxPositions}
            </div>
            <div className='text-xs text-gray-500 dark:text-gray-400'>
              Max Positions
            </div>
          </div>

          <div>
            <div className='text-lg font-semibold text-gray-900 dark:text-white'>
              {riskPerTrade}%
            </div>
            <div className='text-xs text-gray-500 dark:text-gray-400'>
              Risk Per Trade
            </div>
          </div>

          <div>
            <div
              className={`text-lg font-semibold ${
                autoTradingEnabled && !emergencyStop
                  ? "text-green-600 dark:text-green-400"
                  : "text-gray-500 dark:text-gray-400"
              }`}
            >
              {autoTradingEnabled && !emergencyStop ? "ON" : "OFF"}
            </div>
            <div className='text-xs text-gray-500 dark:text-gray-400'>
              Auto Trading
            </div>
          </div>

          <div>
            <div
              className={`text-lg font-semibold ${
                emergencyStop
                  ? "text-red-600 dark:text-red-400"
                  : "text-green-600 dark:text-green-400"
              }`}
            >
              {emergencyStop ? "STOP" : "OK"}
            </div>
            <div className='text-xs text-gray-500 dark:text-gray-400'>
              System Status
            </div>
          </div>
        </div>
      </div>

      {/* Status Messages */}
      {emergencyStop && (
        <div className='mt-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md'>
          <div className='flex items-center space-x-2'>
            <ExclamationTriangleIcon className='h-4 w-4 text-red-600 dark:text-red-400' />
            <span className='text-sm text-red-800 dark:text-red-200'>
              Emergency stop is active. All trading has been halted.
            </span>
          </div>
        </div>
      )}

      {!autoTradingEnabled && !emergencyStop && (
        <div className='mt-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-md'>
          <div className='flex items-center space-x-2'>
            <ExclamationTriangleIcon className='h-4 w-4 text-yellow-600 dark:text-yellow-400' />
            <span className='text-sm text-yellow-800 dark:text-yellow-200'>
              Auto trading is paused. Signals will not be executed
              automatically.
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

export default TradingControls;
