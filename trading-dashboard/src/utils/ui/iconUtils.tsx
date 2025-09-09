/**
 * Icon utilities for consistent icon usage across components
 */

import React from "react";
import {
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  CheckCircleIcon,
  XCircleIcon,
  ExclamationTriangleIcon,
  ClockIcon,
  ChartBarIcon,
  CurrencyDollarIcon,
} from "@heroicons/react/24/outline";

import { TradeDirection, SignalStrength } from "../../types";

/**
 * Gets the appropriate icon for trade direction
 */
export const getDirectionIcon = (
  direction: TradeDirection | string
): React.ReactElement => {
  return direction === "LONG" || direction === TradeDirection.LONG ? (
    <ArrowTrendingUpIcon className='h-4 w-4 text-success-500' />
  ) : (
    <ArrowTrendingDownIcon className='h-4 w-4 text-danger-500' />
  );
};

/**
 * Gets the appropriate icon for trade direction with custom size
 */
export const getDirectionIconWithSize = (
  direction: TradeDirection | string,
  size: "sm" | "md" | "lg" = "md"
): React.ReactElement => {
  const sizeClasses = {
    sm: "h-3 w-3",
    md: "h-4 w-4",
    lg: "h-5 w-5",
  };

  const iconClass = `${sizeClasses[size]} ${
    direction === "LONG" || direction === TradeDirection.LONG
      ? "text-success-500"
      : "text-danger-500"
  }`;

  return direction === "LONG" || direction === TradeDirection.LONG ? (
    <ArrowTrendingUpIcon className={iconClass} />
  ) : (
    <ArrowTrendingDownIcon className={iconClass} />
  );
};

/**
 * Gets the appropriate icon for execution status
 */
export const getExecutionStatusIcon = (status: string): React.ReactElement => {
  switch (status) {
    case "EXECUTED":
      return <CheckCircleIcon className='h-4 w-4 text-success-500' />;
    case "REJECTED":
      return <XCircleIcon className='h-4 w-4 text-danger-500' />;
    case "PENDING":
      return <ClockIcon className='h-4 w-4 text-warning-500' />;
    default:
      return <ExclamationTriangleIcon className='h-4 w-4 text-gray-500' />;
  }
};

/**
 * Gets the appropriate icon for signal strength
 */
export const getSignalStrengthIcon = (
  strength: SignalStrength | string
): React.ReactElement => {
  const getIconColor = () => {
    switch (strength) {
      case "VERY_STRONG":
      case SignalStrength.VERY_STRONG:
        return "text-success-600";
      case "STRONG":
      case SignalStrength.STRONG:
        return "text-success-500";
      case "MODERATE":
      case SignalStrength.MODERATE:
        return "text-warning-500";
      default:
        return "text-gray-500";
    }
  };

  return <ChartBarIcon className={`h-4 w-4 ${getIconColor()}`} />;
};

/**
 * Gets the appropriate icon for P&L status
 */
export const getPnLIcon = (pnl: number): React.ReactElement => {
  if (pnl > 0) {
    return <ArrowTrendingUpIcon className='h-4 w-4 text-success-500' />;
  } else if (pnl < 0) {
    return <ArrowTrendingDownIcon className='h-4 w-4 text-danger-500' />;
  } else {
    return <CurrencyDollarIcon className='h-4 w-4 text-gray-500' />;
  }
};

/**
 * Gets status icon with custom styling
 */
export const getStatusIcon = (
  status: "success" | "error" | "warning" | "info",
  size: "sm" | "md" | "lg" = "md"
): React.ReactElement => {
  const sizeClasses = {
    sm: "h-3 w-3",
    md: "h-4 w-4",
    lg: "h-5 w-5",
  };

  const iconProps = {
    className: sizeClasses[size],
  };

  switch (status) {
    case "success":
      return (
        <CheckCircleIcon
          {...iconProps}
          className={`${iconProps.className} text-success-500`}
        />
      );
    case "error":
      return (
        <XCircleIcon
          {...iconProps}
          className={`${iconProps.className} text-danger-500`}
        />
      );
    case "warning":
      return (
        <ExclamationTriangleIcon
          {...iconProps}
          className={`${iconProps.className} text-warning-500`}
        />
      );
    case "info":
      return (
        <ExclamationTriangleIcon
          {...iconProps}
          className={`${iconProps.className} text-blue-500`}
        />
      );
    default:
      return (
        <ExclamationTriangleIcon
          {...iconProps}
          className={`${iconProps.className} text-gray-500`}
        />
      );
  }
};

/**
 * Icon component props interface
 */
export interface IconProps {
  size?: "sm" | "md" | "lg";
  className?: string;
}

/**
 * Reusable icon components with consistent styling
 */
export const TradingIcons = {
  Long: ({ size = "md", className = "" }: IconProps) => (
    <ArrowTrendingUpIcon
      className={`${getSizeClass(size)} text-success-500 ${className}`}
    />
  ),

  Short: ({ size = "md", className = "" }: IconProps) => (
    <ArrowTrendingDownIcon
      className={`${getSizeClass(size)} text-danger-500 ${className}`}
    />
  ),

  Success: ({ size = "md", className = "" }: IconProps) => (
    <CheckCircleIcon
      className={`${getSizeClass(size)} text-success-500 ${className}`}
    />
  ),

  Error: ({ size = "md", className = "" }: IconProps) => (
    <XCircleIcon
      className={`${getSizeClass(size)} text-danger-500 ${className}`}
    />
  ),

  Warning: ({ size = "md", className = "" }: IconProps) => (
    <ExclamationTriangleIcon
      className={`${getSizeClass(size)} text-warning-500 ${className}`}
    />
  ),

  Pending: ({ size = "md", className = "" }: IconProps) => (
    <ClockIcon
      className={`${getSizeClass(size)} text-warning-500 ${className}`}
    />
  ),
};

/**
 * Helper function to get size classes
 */
const getSizeClass = (size: "sm" | "md" | "lg"): string => {
  const sizeClasses = {
    sm: "h-3 w-3",
    md: "h-4 w-4",
    lg: "h-5 w-5",
  };
  return sizeClasses[size];
};
