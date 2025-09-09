/**
 * System configuration panel component
 */

import React from "react";
import {
  ShieldCheckIcon,
  ServerIcon,
  ClockIcon,
  CircleStackIcon as DatabaseIcon,
  WifiIcon,
  ExclamationTriangleIcon,
} from "@heroicons/react/24/outline";
import { BaseComponentProps } from "../../types/common/base";

interface SystemConfig {
  apiEndpoint: string;
  websocketUrl: string;
  dataRetentionDays: number;
  logLevel: "DEBUG" | "INFO" | "WARN" | "ERROR";
  maxConcurrentConnections: number;
  enableSSL: boolean;
  autoReconnect: boolean;
  heartbeatInterval: number;
}

interface SystemConfigPanelProps extends BaseComponentProps {
  config: SystemConfig;
  onConfigChange: (key: keyof SystemConfig, value: any) => void;
  systemStatus: {
    version: string;
    uptime: string;
    lastUpdated: string;
    status: "operational" | "degraded" | "down";
    connections: number;
  };
  loading?: boolean;
  error?: string | null;
}

/**
 * Status indicator component
 */
const StatusIndicator: React.FC<{
  status: "operational" | "degraded" | "down";
  label: string;
}> = ({ status, label }) => {
  const getStatusColor = () => {
    switch (status) {
      case "operational":
        return "text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/20";
      case "degraded":
        return "text-yellow-600 dark:text-yellow-400 bg-yellow-100 dark:bg-yellow-900/20";
      case "down":
        return "text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/20";
      default:
        return "text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-800";
    }
  };

  return (
    <div
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor()}`}
    >
      <div
        className={`w-2 h-2 rounded-full mr-1.5 ${
          status === "operational"
            ? "bg-green-400"
            : status === "degraded"
              ? "bg-yellow-400"
              : "bg-red-400"
        }`}
      />
      {label}
    </div>
  );
};

/**
 * System configuration panel component
 */
export const SystemConfigPanel: React.FC<SystemConfigPanelProps> = ({
  config,
  onConfigChange,
  systemStatus,
  loading = false,
  error = null,
  className = "",
  testId,
}) => {
  if (loading) {
    return (
      <div
        className={`bg-white dark:bg-gray-800 rounded-lg shadow ${className}`}
        data-testid={testId}
      >
        <div className='px-6 py-4 border-b border-gray-200 dark:border-gray-700'>
          <div className='flex items-center space-x-2'>
            <ShieldCheckIcon className='h-5 w-5 text-primary-600' />
            <h3 className='text-lg font-medium text-gray-900 dark:text-white'>
              System Configuration
            </h3>
          </div>
        </div>
        <div className='p-6'>
          <div className='animate-pulse space-y-6'>
            {[...Array(5)].map((_, i) => (
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
        <div className='flex items-center justify-between'>
          <div className='flex items-center space-x-2'>
            <ShieldCheckIcon className='h-5 w-5 text-primary-600' />
            <h3 className='text-lg font-medium text-gray-900 dark:text-white'>
              System Configuration
            </h3>
          </div>
          <StatusIndicator
            status={systemStatus.status}
            label={systemStatus.status.toUpperCase()}
          />
        </div>
        {error && (
          <div className='mt-2 text-sm text-red-600 dark:text-red-400'>
            Error: {error}
          </div>
        )}
      </div>

      <div className='p-6 space-y-6'>
        {/* System Information */}
        <div className='grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg'>
          <div>
            <p className='text-sm text-gray-500 dark:text-gray-400'>Version</p>
            <p className='text-lg font-medium text-gray-900 dark:text-white'>
              {systemStatus.version}
            </p>
          </div>
          <div>
            <p className='text-sm text-gray-500 dark:text-gray-400'>Uptime</p>
            <p className='text-lg font-medium text-gray-900 dark:text-white'>
              {systemStatus.uptime}
            </p>
          </div>
          <div>
            <p className='text-sm text-gray-500 dark:text-gray-400'>
              Active Connections
            </p>
            <p className='text-lg font-medium text-gray-900 dark:text-white'>
              {systemStatus.connections}
            </p>
          </div>
        </div>

        {/* API Configuration */}
        <div>
          <label className='block text-sm font-medium text-gray-900 dark:text-white mb-2'>
            API Endpoint
          </label>
          <div className='relative'>
            <input
              type='url'
              value={config.apiEndpoint}
              onChange={(e) => onConfigChange("apiEndpoint", e.target.value)}
              placeholder='https://api.example.com'
              className='w-full px-3 py-2 pl-10 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent'
            />
            <ServerIcon className='absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400' />
          </div>
          <p className='text-sm text-gray-500 dark:text-gray-400 mt-1'>
            Base URL for API requests
          </p>
        </div>

        {/* WebSocket Configuration */}
        <div>
          <label className='block text-sm font-medium text-gray-900 dark:text-white mb-2'>
            WebSocket URL
          </label>
          <div className='relative'>
            <input
              type='url'
              value={config.websocketUrl}
              onChange={(e) => onConfigChange("websocketUrl", e.target.value)}
              placeholder='wss://ws.example.com'
              className='w-full px-3 py-2 pl-10 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent'
            />
            <WifiIcon className='absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400' />
          </div>
          <p className='text-sm text-gray-500 dark:text-gray-400 mt-1'>
            WebSocket endpoint for real-time data
          </p>
        </div>

        {/* Connection Settings */}
        <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
          <div>
            <label className='block text-sm font-medium text-gray-900 dark:text-white mb-2'>
              Max Concurrent Connections
            </label>
            <input
              type='number'
              min='1'
              max='100'
              value={config.maxConcurrentConnections}
              onChange={(e) =>
                onConfigChange(
                  "maxConcurrentConnections",
                  parseInt(e.target.value) || 1
                )
              }
              className='w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent'
            />
          </div>

          <div>
            <label className='block text-sm font-medium text-gray-900 dark:text-white mb-2'>
              Heartbeat Interval (seconds)
            </label>
            <input
              type='number'
              min='5'
              max='300'
              value={config.heartbeatInterval}
              onChange={(e) =>
                onConfigChange(
                  "heartbeatInterval",
                  parseInt(e.target.value) || 30
                )
              }
              className='w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent'
            />
          </div>
        </div>

        {/* Security Settings */}
        <div>
          <label className='block text-sm font-medium text-gray-900 dark:text-white mb-3'>
            Security Settings
          </label>
          <div className='space-y-3'>
            <div className='flex items-center justify-between'>
              <div>
                <span className='text-sm text-gray-900 dark:text-white'>
                  Enable SSL/TLS
                </span>
                <p className='text-sm text-gray-500 dark:text-gray-400'>
                  Encrypt all API communications
                </p>
              </div>
              <button
                onClick={() => onConfigChange("enableSSL", !config.enableSSL)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  config.enableSSL
                    ? "bg-primary-600"
                    : "bg-gray-200 dark:bg-gray-700"
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    config.enableSSL ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </button>
            </div>

            <div className='flex items-center justify-between'>
              <div>
                <span className='text-sm text-gray-900 dark:text-white'>
                  Auto Reconnect
                </span>
                <p className='text-sm text-gray-500 dark:text-gray-400'>
                  Automatically reconnect on connection loss
                </p>
              </div>
              <button
                onClick={() =>
                  onConfigChange("autoReconnect", !config.autoReconnect)
                }
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  config.autoReconnect
                    ? "bg-primary-600"
                    : "bg-gray-200 dark:bg-gray-700"
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    config.autoReconnect ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </button>
            </div>
          </div>
        </div>

        {/* Data Management */}
        <div>
          <label className='block text-sm font-medium text-gray-900 dark:text-white mb-2'>
            Data Retention Period
          </label>
          <div className='relative'>
            <input
              type='number'
              min='1'
              max='365'
              value={config.dataRetentionDays}
              onChange={(e) =>
                onConfigChange(
                  "dataRetentionDays",
                  parseInt(e.target.value) || 30
                )
              }
              className='w-full px-3 py-2 pr-16 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent'
            />
            <div className='absolute inset-y-0 right-0 flex items-center pr-3'>
              <span className='text-sm text-gray-500 dark:text-gray-400'>
                days
              </span>
            </div>
          </div>
          <p className='text-sm text-gray-500 dark:text-gray-400 mt-1'>
            How long to keep historical data (1-365 days)
          </p>
        </div>

        {/* Logging Configuration */}
        <div>
          <label className='block text-sm font-medium text-gray-900 dark:text-white mb-2'>
            Log Level
          </label>
          <select
            value={config.logLevel}
            onChange={(e) => onConfigChange("logLevel", e.target.value as any)}
            className='w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent'
          >
            <option value='DEBUG'>
              DEBUG - Detailed debugging information
            </option>
            <option value='INFO'>INFO - General information messages</option>
            <option value='WARN'>WARN - Warning messages only</option>
            <option value='ERROR'>ERROR - Error messages only</option>
          </select>
          <p className='text-sm text-gray-500 dark:text-gray-400 mt-1'>
            Controls the verbosity of system logs
          </p>
        </div>

        {/* System Actions */}
        <div className='pt-4 border-t border-gray-200 dark:border-gray-700'>
          <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
            <button className='flex items-center justify-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors'>
              <DatabaseIcon className='h-4 w-4' />
              <span>Clear Cache</span>
            </button>

            <button className='flex items-center justify-center space-x-2 px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors'>
              <ClockIcon className='h-4 w-4' />
              <span>Restart Services</span>
            </button>
          </div>

          <div className='mt-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg'>
            <div className='flex items-start space-x-2'>
              <ExclamationTriangleIcon className='h-4 w-4 text-yellow-600 dark:text-yellow-400 mt-0.5' />
              <div className='text-sm text-yellow-800 dark:text-yellow-200'>
                <p className='font-medium'>Important:</p>
                <p>
                  Changes to system configuration may require a service restart
                  to take effect.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SystemConfigPanel;
