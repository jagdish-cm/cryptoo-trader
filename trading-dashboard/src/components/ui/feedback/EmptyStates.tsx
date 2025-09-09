/**
 * Reusable empty state components
 */

import React from "react";
import {
  ChartBarIcon,
  CurrencyDollarIcon,
  ExclamationTriangleIcon,
  SignalIcon,
  ClockIcon,
} from "@heroicons/react/24/outline";
import { BaseComponentProps } from "../../../types/common/base";

interface EmptyStateProps extends BaseComponentProps {
  icon?: React.ComponentType<{ className?: string }>;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

/**
 * Generic empty state component
 */
export const EmptyState: React.FC<EmptyStateProps> = ({
  icon: Icon = ExclamationTriangleIcon,
  title,
  description,
  action,
  className = "",
  testId,
}) => (
  <div className={`text-center py-8 ${className}`} data-testid={testId}>
    <Icon className='mx-auto h-12 w-12 text-gray-400' />
    <h3 className='mt-2 text-sm font-medium text-gray-900 dark:text-white'>
      {title}
    </h3>
    {description && (
      <p className='mt-1 text-sm text-gray-500 dark:text-gray-400'>
        {description}
      </p>
    )}
    {action && (
      <button
        onClick={action.onClick}
        className='mt-4 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500'
      >
        {action.label}
      </button>
    )}
  </div>
);

/**
 * Empty positions state
 */
export const EmptyPositions: React.FC<{ className?: string }> = ({
  className = "",
}) => (
  <EmptyState
    icon={ChartBarIcon}
    title='No Active Positions'
    description='Start trading to see your positions here'
    className={className}
    testId='empty-positions'
  />
);

/**
 * Empty trade history state
 */
export const EmptyTradeHistory: React.FC<{ className?: string }> = ({
  className = "",
}) => (
  <EmptyState
    icon={ChartBarIcon}
    title='No Trade History'
    description='Complete some trades to see performance metrics and history'
    className={`py-12 ${className}`}
    testId='empty-trade-history'
  />
);

/**
 * Empty performance metrics state
 */
export const EmptyPerformanceMetrics: React.FC<{ className?: string }> = ({
  className = "",
}) => (
  <EmptyState
    icon={CurrencyDollarIcon}
    title='No Performance Data'
    description='Performance metrics will appear after trading activity'
    className={className}
    testId='empty-performance-metrics'
  />
);

/**
 * Empty signals state
 */
export const EmptySignals: React.FC<{ className?: string }> = ({
  className = "",
}) => (
  <EmptyState
    icon={SignalIcon}
    title='No Active Signals'
    description='Trading signals will appear here when generated'
    className={className}
    testId='empty-signals'
  />
);

/**
 * Empty AI decisions state
 */
export const EmptyAIDecisions: React.FC<{ className?: string }> = ({
  className = "",
}) => (
  <EmptyState
    icon={ClockIcon}
    title='No AI Decisions'
    description='AI trading decisions will appear here as they are made'
    className={className}
    testId='empty-ai-decisions'
  />
);

/**
 * Market data error state
 */
export const MarketDataError: React.FC<{
  onRetry: () => void;
  className?: string;
}> = ({ onRetry, className = "" }) => (
  <EmptyState
    icon={ExclamationTriangleIcon}
    title='Market Data Unavailable'
    description='Unable to load market data. Check your connection.'
    action={{
      label: "Retry",
      onClick: onRetry,
    }}
    className={className}
    testId='market-data-error'
  />
);

/**
 * Generic loading state
 */
export const LoadingState: React.FC<{
  message?: string;
  className?: string;
}> = ({ message = "Loading...", className = "" }) => (
  <div className={`flex items-center justify-center h-64 ${className}`}>
    <div className='animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600'></div>
    <span className='ml-3 text-gray-600 dark:text-gray-400'>{message}</span>
  </div>
);

/**
 * Generic error state
 */
export const ErrorState: React.FC<{
  title?: string;
  message: string;
  onRetry?: () => void;
  className?: string;
}> = ({ title = "Something went wrong", message, onRetry, className = "" }) => (
  <EmptyState
    icon={ExclamationTriangleIcon}
    title={title}
    description={message}
    action={
      onRetry
        ? {
            label: "Try Again",
            onClick: onRetry,
          }
        : undefined
    }
    className={className}
    testId='error-state'
  />
);
