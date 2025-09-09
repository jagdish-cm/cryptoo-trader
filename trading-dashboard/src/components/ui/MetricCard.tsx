/**
 * @fileoverview MetricCard component for displaying key performance indicators and metrics
 * with trend indicators, customizable styling, and interactive features.
 *
 * @example
 * ```tsx
 * import { MetricCard } from './components/ui/MetricCard';
 * import { CurrencyDollarIcon } from '@heroicons/react/24/outline';
 *
 * // Basic usage
 * <MetricCard
 *   title="Total Revenue"
 *   value="$125,430"
 *   change={12.5}
 *   changeType="percentage"
 *   icon={CurrencyDollarIcon}
 *   color="success"
 * />
 *
 * // With custom trend and click handler
 * <MetricCard
 *   title="Active Users"
 *   value={1250}
 *   subtitle="Last 30 days"
 *   trend="up"
 *   size="lg"
 *   onClick={() => console.log('Metric clicked')}
 *   tooltip="Click to view detailed analytics"
 * />
 * ```
 */

import React from "react";
import {
  ArrowTrendingUpIcon as TrendingUpIcon,
  ArrowTrendingDownIcon as TrendingDownIcon,
  MinusIcon,
  InformationCircleIcon,
} from "@heroicons/react/24/outline";
import { BaseComponentProps } from "../../types/common/base";

/**
 * Props interface for the MetricCard component
 *
 * @interface MetricCardProps
 * @extends {BaseComponentProps}
 */
export interface MetricCardProps extends BaseComponentProps {
  /** The main title/label for the metric */
  title: string;

  /** The primary value to display (can be string for formatted values or number) */
  value: string | number;

  /** Optional subtitle text displayed below the value */
  subtitle?: string;

  /** Numeric change value for trend calculation (positive = up, negative = down, 0 = neutral) */
  change?: number;

  /** How to format and display the change value */
  changeType?: "percentage" | "absolute" | "custom";

  /** Custom label for the change value (used with changeType="custom") */
  changeLabel?: string;

  /** Override automatic trend calculation based on change value */
  trend?: "up" | "down" | "neutral";

  /** Optional icon component to display (should accept className prop) */
  icon?: React.ComponentType<{ className?: string }>;

  /** Custom color class for the icon */
  iconColor?: string;

  /** Custom color class for the value text */
  valueColor?: string;

  /** Color theme for the card styling */
  color?: "default" | "success" | "warning" | "error" | "info";

  /** Size variant affecting padding, text sizes, and icon sizes */
  size?: "sm" | "md" | "lg";

  /** Show loading state with skeleton animation */
  loading?: boolean;

  /** Tooltip text shown on hover */
  tooltip?: string;

  /** Click handler for interactive cards */
  onClick?: () => void;
}

/**
 * MetricCard component for displaying key performance indicators and metrics.
 *
 * This component provides a flexible way to display metrics with optional trend indicators,
 * icons, and interactive features. It supports multiple color themes, sizes, and loading states.
 *
 * @component
 * @param {MetricCardProps} props - The component props
 * @param {string} props.title - The main title/label for the metric
 * @param {string | number} props.value - The primary value to display
 * @param {string} [props.subtitle] - Optional subtitle text
 * @param {number} [props.change] - Numeric change value for trend calculation
 * @param {"percentage" | "absolute" | "custom"} [props.changeType="percentage"] - How to format the change value
 * @param {string} [props.changeLabel] - Custom label for the change value
 * @param {"up" | "down" | "neutral"} [props.trend] - Override automatic trend calculation
 * @param {React.ComponentType} [props.icon] - Optional icon component
 * @param {"default" | "success" | "warning" | "error" | "info"} [props.color="default"] - Color theme
 * @param {"sm" | "md" | "lg"} [props.size="md"] - Size variant
 * @param {boolean} [props.loading=false] - Show loading state
 * @param {string} [props.tooltip] - Tooltip text
 * @param {() => void} [props.onClick] - Click handler
 * @param {string} [props.className=""] - Additional CSS classes
 * @param {string} [props.testId] - Test ID for testing
 *
 * @returns {JSX.Element} The rendered MetricCard component
 *
 * @example
 * // Basic metric card
 * <MetricCard
 *   title="Revenue"
 *   value="$125,430"
 *   change={12.5}
 *   icon={CurrencyDollarIcon}
 * />
 *
 * @example
 * // Interactive metric card with custom styling
 * <MetricCard
 *   title="Active Users"
 *   value={1250}
 *   subtitle="Last 30 days"
 *   color="success"
 *   size="lg"
 *   onClick={() => navigate('/users')}
 *   tooltip="Click to view user details"
 * />
 */
export const MetricCard: React.FC<MetricCardProps> = React.memo(
  ({
    title,
    value,
    subtitle,
    change,
    changeType = "percentage",
    changeLabel,
    trend,
    icon: Icon,
    iconColor,
    valueColor,
    color = "default",
    size = "md",
    loading = false,
    tooltip,
    onClick,
    className = "",
    testId,
  }) => {
    // Determine trend from change if not explicitly provided
    const actualTrend =
      trend ||
      (change !== undefined
        ? change > 0
          ? "up"
          : change < 0
            ? "down"
            : "neutral"
        : "neutral");

    // Size classes
    const sizeClasses = {
      sm: "p-4",
      md: "p-6",
      lg: "p-8",
    };

    const titleSizeClasses = {
      sm: "text-sm",
      md: "text-sm",
      lg: "text-base",
    };

    const valueSizeClasses = {
      sm: "text-xl",
      md: "text-2xl",
      lg: "text-3xl",
    };

    const iconSizeClasses = {
      sm: "h-5 w-5",
      md: "h-6 w-6",
      lg: "h-8 w-8",
    };

    // Color classes
    const colorClasses = {
      default: "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700",
      success:
        "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800",
      warning:
        "bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800",
      error: "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800",
      info: "bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800",
    };

    const textColorClasses = {
      default: "text-gray-900 dark:text-white",
      success: "text-green-900 dark:text-green-100",
      warning: "text-yellow-900 dark:text-yellow-100",
      error: "text-red-900 dark:text-red-100",
      info: "text-blue-900 dark:text-blue-100",
    };

    const iconColorClasses = {
      default: "text-gray-600 dark:text-gray-400",
      success: "text-green-600 dark:text-green-400",
      warning: "text-yellow-600 dark:text-yellow-400",
      error: "text-red-600 dark:text-red-400",
      info: "text-blue-600 dark:text-blue-400",
    };

    // Trend classes
    const trendClasses = {
      up: "text-green-600 dark:text-green-400",
      down: "text-red-600 dark:text-red-400",
      neutral: "text-gray-600 dark:text-gray-400",
    };

    // Format change value
    const formatChange = (changeValue: number) => {
      const absValue = Math.abs(changeValue);
      switch (changeType) {
        case "percentage":
          return `${changeValue >= 0 ? "+" : ""}${changeValue.toFixed(2)}%`;
        case "absolute":
          return `${changeValue >= 0 ? "+" : ""}${absValue.toLocaleString()}`;
        case "custom":
          return changeLabel || changeValue.toString();
        default:
          return changeValue.toString();
      }
    };

    // Get trend icon
    const getTrendIcon = () => {
      switch (actualTrend) {
        case "up":
          return <TrendingUpIcon className='h-4 w-4' />;
        case "down":
          return <TrendingDownIcon className='h-4 w-4' />;
        case "neutral":
          return <MinusIcon className='h-4 w-4' />;
        default:
          return null;
      }
    };

    const cardClasses = [
      "rounded-lg border shadow-sm transition-all duration-200",
      sizeClasses[size],
      colorClasses[color],
      onClick ? "cursor-pointer hover:shadow-md hover:scale-105" : "",
      loading ? "animate-pulse" : "",
      className,
    ]
      .filter(Boolean)
      .join(" ");

    if (loading) {
      return (
        <div className={cardClasses} data-testid={testId}>
          <div className='space-y-3'>
            <div className='h-4 bg-gray-200 dark:bg-gray-700 rounded w-2/3'></div>
            <div className='h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/2'></div>
            <div className='h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/3'></div>
          </div>
        </div>
      );
    }

    return (
      <div
        className={cardClasses}
        onClick={onClick}
        data-testid={testId}
        title={tooltip}
      >
        <div className='flex items-start justify-between'>
          <div className='flex-1'>
            {/* Title */}
            <div className='flex items-center space-x-2 mb-2'>
              <p
                className={`font-medium ${titleSizeClasses[size]} text-gray-600 dark:text-gray-400`}
              >
                {title}
              </p>
              {tooltip && (
                <InformationCircleIcon
                  className='h-4 w-4 text-gray-400'
                  title={tooltip}
                />
              )}
            </div>

            {/* Value */}
            <p
              className={`font-bold ${valueSizeClasses[size]} ${valueColor || textColorClasses[color]} mb-1`}
            >
              {typeof value === "number" ? value.toLocaleString() : value}
            </p>

            {/* Subtitle */}
            {subtitle && (
              <p className='text-xs text-gray-500 dark:text-gray-400 mb-2'>
                {subtitle}
              </p>
            )}

            {/* Change Indicator */}
            {change !== undefined && (
              <div
                className={`flex items-center space-x-1 text-sm ${trendClasses[actualTrend]}`}
              >
                {getTrendIcon()}
                <span className='font-medium'>{formatChange(change)}</span>
                {changeLabel && changeType !== "custom" && (
                  <span className='text-gray-500 dark:text-gray-400'>
                    {changeLabel}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Icon */}
          {Icon && (
            <div
              className={`flex-shrink-0 ${color === "default" ? "bg-gray-100 dark:bg-gray-700" : "bg-white/50 dark:bg-black/20"} rounded-lg p-2`}
            >
              <Icon
                className={`${iconSizeClasses[size]} ${iconColor || iconColorClasses[color]}`}
              />
            </div>
          )}
        </div>
      </div>
    );
  }
);

MetricCard.displayName = "MetricCard";

export default MetricCard;
