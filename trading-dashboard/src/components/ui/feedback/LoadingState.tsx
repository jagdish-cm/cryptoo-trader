/**
 * Enhanced loading state components with different sizes and animations
 */

import React from "react";
import { BaseComponentProps } from "../../../types/common/base";

interface LoadingStateProps extends BaseComponentProps {
  message?: string;
  size?: "sm" | "md" | "lg" | "xl";
  variant?: "spinner" | "dots" | "pulse" | "skeleton";
  fullScreen?: boolean;
}

interface SkeletonProps extends BaseComponentProps {
  lines?: number;
  avatar?: boolean;
  width?: string;
  height?: string;
}

/**
 * Spinner loading component
 */
const SpinnerLoader: React.FC<{
  size: "sm" | "md" | "lg" | "xl";
  className?: string;
}> = ({ size, className = "" }) => {
  const sizeClasses = {
    sm: "h-4 w-4",
    md: "h-8 w-8",
    lg: "h-12 w-12",
    xl: "h-16 w-16",
  };

  return (
    <div
      className={`animate-spin rounded-full border-b-2 border-primary-600 ${sizeClasses[size]} ${className}`}
    />
  );
};

/**
 * Dots loading animation
 */
const DotsLoader: React.FC<{
  size: "sm" | "md" | "lg" | "xl";
  className?: string;
}> = ({ size, className = "" }) => {
  const dotSizes = {
    sm: "w-1 h-1",
    md: "w-2 h-2",
    lg: "w-3 h-3",
    xl: "w-4 h-4",
  };

  const dotSize = dotSizes[size];

  return (
    <div className={`flex space-x-1 ${className}`}>
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className={`${dotSize} bg-primary-600 rounded-full animate-pulse`}
          style={{
            animationDelay: `${i * 0.2}s`,
            animationDuration: "1s",
          }}
        />
      ))}
    </div>
  );
};

/**
 * Pulse loading animation
 */
const PulseLoader: React.FC<{
  size: "sm" | "md" | "lg" | "xl";
  className?: string;
}> = ({ size, className = "" }) => {
  const sizeClasses = {
    sm: "h-4 w-4",
    md: "h-8 w-8",
    lg: "h-12 w-12",
    xl: "h-16 w-16",
  };

  return (
    <div className={`relative ${className}`}>
      <div
        className={`${sizeClasses[size]} bg-primary-600 rounded-full animate-ping absolute`}
      />
      <div
        className={`${sizeClasses[size]} bg-primary-600 rounded-full animate-pulse`}
      />
    </div>
  );
};

/**
 * Skeleton loading component
 */
export const Skeleton: React.FC<SkeletonProps> = ({
  lines = 3,
  avatar = false,
  width = "w-full",
  height = "h-4",
  className = "",
  testId,
}) => (
  <div className={`animate-pulse ${className}`} data-testid={testId}>
    {avatar && (
      <div className='flex items-center space-x-4 mb-4'>
        <div className='rounded-full bg-gray-300 dark:bg-gray-600 h-10 w-10' />
        <div className='flex-1 space-y-2'>
          <div className='h-4 bg-gray-300 dark:bg-gray-600 rounded w-3/4' />
          <div className='h-3 bg-gray-300 dark:bg-gray-600 rounded w-1/2' />
        </div>
      </div>
    )}
    <div className='space-y-3'>
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className={`${height} bg-gray-300 dark:bg-gray-600 rounded ${
            i === lines - 1 ? "w-2/3" : width
          }`}
        />
      ))}
    </div>
  </div>
);

/**
 * Card skeleton for loading cards
 */
export const CardSkeleton: React.FC<BaseComponentProps> = ({
  className = "",
  testId,
}) => (
  <div
    className={`bg-white dark:bg-gray-800 rounded-lg shadow p-6 ${className}`}
    data-testid={testId}
  >
    <Skeleton lines={4} avatar />
  </div>
);

/**
 * Table skeleton for loading tables
 */
export const TableSkeleton: React.FC<{
  rows?: number;
  columns?: number;
  className?: string;
  testId?: string;
}> = ({ rows = 5, columns = 4, className = "", testId }) => (
  <div className={`animate-pulse ${className}`} data-testid={testId}>
    {/* Header */}
    <div
      className='grid gap-4 mb-4'
      style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}
    >
      {Array.from({ length: columns }).map((_, i) => (
        <div key={i} className='h-4 bg-gray-300 dark:bg-gray-600 rounded' />
      ))}
    </div>

    {/* Rows */}
    <div className='space-y-3'>
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div
          key={rowIndex}
          className='grid gap-4'
          style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}
        >
          {Array.from({ length: columns }).map((_, colIndex) => (
            <div
              key={colIndex}
              className='h-4 bg-gray-200 dark:bg-gray-700 rounded'
            />
          ))}
        </div>
      ))}
    </div>
  </div>
);

/**
 * Chart skeleton for loading charts
 */
export const ChartSkeleton: React.FC<{
  height?: string;
  className?: string;
  testId?: string;
}> = ({ height = "h-64", className = "", testId }) => (
  <div
    className={`animate-pulse bg-gray-50 dark:bg-gray-700 rounded-lg ${height} ${className}`}
    data-testid={testId}
  >
    <div className='flex items-end justify-between h-full p-4 space-x-2'>
      {Array.from({ length: 8 }).map((_, i) => (
        <div
          key={i}
          className='bg-gray-300 dark:bg-gray-600 rounded-t'
          style={{
            height: `${Math.random() * 60 + 20}%`,
            width: "100%",
          }}
        />
      ))}
    </div>
  </div>
);

/**
 * Main loading state component
 */
export const LoadingState: React.FC<LoadingStateProps> = ({
  message = "Loading...",
  size = "md",
  variant = "spinner",
  fullScreen = false,
  className = "",
  testId,
}) => {
  const renderLoader = () => {
    switch (variant) {
      case "dots":
        return <DotsLoader size={size} />;
      case "pulse":
        return <PulseLoader size={size} />;
      case "skeleton":
        return <Skeleton lines={3} />;
      default:
        return <SpinnerLoader size={size} />;
    }
  };

  const containerClasses = fullScreen
    ? "fixed inset-0 bg-white dark:bg-gray-900 bg-opacity-75 dark:bg-opacity-75 flex items-center justify-center z-50"
    : "flex items-center justify-center py-8";

  if (variant === "skeleton") {
    return (
      <div className={`${className}`} data-testid={testId}>
        {renderLoader()}
      </div>
    );
  }

  return (
    <div className={`${containerClasses} ${className}`} data-testid={testId}>
      <div className='text-center'>
        {renderLoader()}
        {message && (
          <p className='mt-3 text-sm text-gray-600 dark:text-gray-400'>
            {message}
          </p>
        )}
      </div>
    </div>
  );
};

/**
 * Inline loading component for buttons and small spaces
 */
export const InlineLoader: React.FC<{
  size?: "sm" | "md";
  className?: string;
}> = ({ size = "sm", className = "" }) => (
  <SpinnerLoader size={size} className={className} />
);

/**
 * Page loading component
 */
export const PageLoader: React.FC<{
  message?: string;
  className?: string;
}> = ({ message = "Loading page...", className = "" }) => (
  <LoadingState
    message={message}
    size='lg'
    variant='spinner'
    fullScreen
    className={className}
    testId='page-loader'
  />
);

export default LoadingState;
