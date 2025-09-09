/**
 * Formatting utilities for consistent data display
 */

/**
 * Formats a number as currency
 */
export const formatCurrency = (
  value: number,
  currency: string = "USD",
  locale: string = "en-US"
): string => {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
};

/**
 * Formats a number as percentage
 */
export const formatPercentage = (
  value: number,
  decimals: number = 2,
  showSign: boolean = true
): string => {
  const formatted = value.toFixed(decimals);
  return showSign && value >= 0 ? `+${formatted}%` : `${formatted}%`;
};

/**
 * Formats large numbers with appropriate suffixes (K, M, B)
 */
export const formatLargeNumber = (
  value: number,
  decimals: number = 2
): string => {
  if (Math.abs(value) >= 1e9) {
    return `${(value / 1e9).toFixed(decimals)}B`;
  } else if (Math.abs(value) >= 1e6) {
    return `${(value / 1e6).toFixed(decimals)}M`;
  } else if (Math.abs(value) >= 1e3) {
    return `${(value / 1e3).toFixed(decimals)}K`;
  }
  return value.toFixed(decimals);
};

/**
 * Formats volume numbers
 */
export const formatVolume = (value: number): string => {
  return formatLargeNumber(value, 2);
};

/**
 * Formats a date for display
 */
export const formatDate = (
  date: Date | string,
  options: Intl.DateTimeFormatOptions = {
    year: "numeric",
    month: "short",
    day: "numeric",
  }
): string => {
  try {
    const dateObj = typeof date === "string" ? new Date(date) : date;
    if (isNaN(dateObj.getTime())) {
      return "Invalid Date";
    }
    return dateObj.toLocaleDateString("en-US", options);
  } catch (error) {
    console.error("Date formatting error:", error, date);
    return "Invalid Date";
  }
};

/**
 * Formats a date and time for display
 */
export const formatDateTime = (
  date: Date | string,
  options: Intl.DateTimeFormatOptions = {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }
): string => {
  try {
    const dateObj = typeof date === "string" ? new Date(date) : date;
    if (isNaN(dateObj.getTime())) {
      return "Invalid Date";
    }
    return dateObj.toLocaleString("en-US", options);
  } catch (error) {
    console.error("DateTime formatting error:", error, date);
    return "Invalid Date";
  }
};

/**
 * Formats time duration in minutes to human readable format
 */
export const formatDuration = (minutes: number): string => {
  if (minutes < 60) {
    return `${Math.round(minutes)}m`;
  } else if (minutes < 1440) {
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = Math.round(minutes % 60);
    return remainingMinutes > 0
      ? `${hours}h ${remainingMinutes}m`
      : `${hours}h`;
  } else {
    const days = Math.floor(minutes / 1440);
    const remainingHours = Math.floor((minutes % 1440) / 60);
    return remainingHours > 0 ? `${days}d ${remainingHours}h` : `${days}d`;
  }
};

/**
 * Formats a number with specified decimal places
 */
export const formatNumber = (
  value: number,
  decimals: number = 2,
  locale: string = "en-US"
): string => {
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
};

/**
 * Formats a price with appropriate decimal places based on value
 */
export const formatPrice = (value: number): string => {
  if (value >= 1000) {
    return formatNumber(value, 2);
  } else if (value >= 1) {
    return formatNumber(value, 4);
  } else if (value >= 0.01) {
    return formatNumber(value, 6);
  } else {
    return formatNumber(value, 8);
  }
};

/**
 * Truncates text to specified length with ellipsis
 */
export const truncateText = (text: string, maxLength: number): string => {
  if (text.length <= maxLength) {
    return text;
  }
  return text.substring(0, maxLength - 3) + "...";
};

/**
 * Capitalizes the first letter of a string
 */
export const capitalize = (text: string): string => {
  return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
};

/**
 * Converts camelCase or snake_case to Title Case
 */
export const toTitleCase = (text: string): string => {
  return text
    .replace(/([A-Z])/g, " $1")
    .replace(/_/g, " ")
    .replace(/^./, (str) => str.toUpperCase())
    .trim();
};
