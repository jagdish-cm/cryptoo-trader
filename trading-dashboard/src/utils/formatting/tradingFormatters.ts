/**
 * Trading-specific formatting utilities
 */

import { TradeDirection, SignalStrength } from "../../types";
import { formatCurrency, formatPercentage } from "./index";

// Re-export commonly used formatters
export { formatCurrency, formatPercentage };

/**
 * Formats volume with appropriate suffix and currency symbol
 */
export const formatVolumeWithCurrency = (value: number): string => {
  if (value >= 1e9) {
    return `$${(value / 1e9).toFixed(2)}B`;
  } else if (value >= 1e6) {
    return `$${(value / 1e6).toFixed(2)}M`;
  } else if (value >= 1e3) {
    return `$${(value / 1e3).toFixed(2)}K`;
  }
  return formatCurrency(value);
};

/**
 * Gets color class for confidence levels
 */
export const getConfidenceColor = (confidence: number): string => {
  if (confidence >= 0.8) return "text-success-600 dark:text-success-400";
  if (confidence >= 0.6) return "text-warning-600 dark:text-warning-400";
  return "text-danger-600 dark:text-danger-400";
};

/**
 * Gets color class for sentiment
 */
export const getSentimentColor = (sentiment: string): string => {
  switch (sentiment) {
    case "POSITIVE":
      return "text-success-600 dark:text-success-400";
    case "NEGATIVE":
      return "text-danger-600 dark:text-danger-400";
    default:
      return "text-gray-600 dark:text-gray-400";
  }
};

/**
 * Gets color class for signal strength
 */
export const getSignalStrengthColor = (strength: SignalStrength): string => {
  switch (strength) {
    case "VERY_STRONG":
      return "text-success-600 bg-success-100 dark:text-success-400 dark:bg-success-900/20";
    case "STRONG":
      return "text-success-600 bg-success-100 dark:text-success-400 dark:bg-success-900/20";
    case "MODERATE":
      return "text-warning-600 bg-warning-100 dark:text-warning-400 dark:bg-warning-900/20";
    default:
      return "text-gray-600 bg-gray-100 dark:text-gray-400 dark:bg-gray-800";
  }
};

/**
 * Gets color class for exit reasons
 */
export const getExitReasonColor = (reason: string): string => {
  switch (reason) {
    case "Take Profit":
      return "text-success-600 bg-success-100 dark:text-success-400 dark:bg-success-900/20";
    case "Stop Loss":
      return "text-danger-600 bg-danger-100 dark:text-danger-400 dark:bg-danger-900/20";
    case "Emergency Exit":
      return "text-warning-600 bg-warning-100 dark:text-warning-400 dark:bg-warning-900/20";
    default:
      return "text-gray-600 bg-gray-100 dark:text-gray-400 dark:bg-gray-800";
  }
};

/**
 * Gets color class for P&L values
 */
export const getPnLColor = (pnl: number): string => {
  if (pnl > 0) return "text-success-600 dark:text-success-400";
  if (pnl < 0) return "text-danger-600 dark:text-danger-400";
  return "text-gray-600 dark:text-gray-400";
};

/**
 * Gets color class for percentage changes
 */
export const getChangeColor = (change: number): string => {
  if (change > 0) return "text-success-600 dark:text-success-400";
  if (change < 0) return "text-danger-600 dark:text-danger-400";
  return "text-gray-600 dark:text-gray-400";
};

/**
 * Formats timestamp for trading display (with IST timezone)
 */
export const formatTradingTimestamp = (timestamp: string | Date): string => {
  try {
    const date =
      typeof timestamp === "string" ? new Date(timestamp) : timestamp;
    if (isNaN(date.getTime())) {
      return "Invalid timestamp";
    }

    // Convert to Indian Standard Time (IST)
    const istOptions: Intl.DateTimeFormatOptions = {
      timeZone: "Asia/Kolkata",
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
    };

    return date.toLocaleString("en-IN", istOptions);
  } catch (error) {
    console.error("Timestamp formatting error:", error, timestamp);
    return "Invalid timestamp";
  }
};

/**
 * Formats trade duration in a human-readable format
 */
export const formatTradeDuration = (
  entryTime: Date | string,
  exitTime: Date | string
): string => {
  try {
    const entry =
      typeof entryTime === "string" ? new Date(entryTime) : entryTime;
    const exit = typeof exitTime === "string" ? new Date(exitTime) : exitTime;

    const durationMs = exit.getTime() - entry.getTime();
    const durationMinutes = Math.round(durationMs / (1000 * 60));

    if (durationMinutes < 60) {
      return `${durationMinutes}m`;
    } else if (durationMinutes < 1440) {
      const hours = Math.floor(durationMinutes / 60);
      const minutes = durationMinutes % 60;
      return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
    } else {
      const days = Math.floor(durationMinutes / 1440);
      const hours = Math.floor((durationMinutes % 1440) / 60);
      return hours > 0 ? `${days}d ${hours}h` : `${days}d`;
    }
  } catch (error) {
    console.error("Duration formatting error:", error);
    return "0m";
  }
};
