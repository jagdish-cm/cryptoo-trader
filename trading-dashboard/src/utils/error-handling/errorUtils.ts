/**
 * Error handling utilities for consistent error management
 */

import { AppError } from "../../types/common/base";

export interface ErrorHandlingUtils {
  formatError: (error: unknown) => string;
  logError: (error: Error, context?: string) => void;
  isNetworkError: (error: unknown) => boolean;
  isValidationError: (error: unknown) => boolean;
}

/**
 * Formats an unknown error into a user-friendly string
 */
export const formatError = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  if (error && typeof error === "object" && "message" in error) {
    return String((error as { message: unknown }).message);
  }

  return "An unexpected error occurred";
};

/**
 * Logs an error with optional context
 */
export const logError = (error: Error, context?: string): void => {
  const errorInfo = {
    message: error.message,
    stack: error.stack,
    context,
    timestamp: new Date().toISOString(),
  };

  console.error("Application Error:", errorInfo);

  // In production, you might want to send this to an error tracking service
  // Example: Sentry.captureException(error, { extra: errorInfo });
};

/**
 * Checks if an error is a network-related error
 */
export const isNetworkError = (error: unknown): boolean => {
  if (error instanceof Error) {
    return (
      error.message.includes("fetch") ||
      error.message.includes("network") ||
      error.message.includes("connection") ||
      error.name === "NetworkError"
    );
  }

  return false;
};

/**
 * Checks if an error is a validation error
 */
export const isValidationError = (error: unknown): boolean => {
  if (error && typeof error === "object") {
    return (
      "code" in error &&
      typeof (error as { code: unknown }).code === "string" &&
      (error as { code: string }).code.startsWith("VALIDATION_")
    );
  }

  return false;
};

/**
 * Creates a standardized AppError object
 */
export const createAppError = (
  code: string,
  message: string,
  details?: Record<string, unknown>
): AppError => ({
  code,
  message,
  details,
  timestamp: new Date(),
});

/**
 * Error boundary helper for React components
 */
export const getErrorBoundaryFallback = (
  error: Error,
  errorInfo: React.ErrorInfo
) => {
  logError(error, "ErrorBoundary");

  return {
    hasError: true,
    error: formatError(error),
    errorInfo: errorInfo.componentStack,
  };
};

/**
 * Retry utility for failed operations
 */
export const withRetry = async <T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  delay: number = 1000
): Promise<T> => {
  let lastError: Error;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (attempt === maxRetries) {
        throw lastError;
      }

      // Wait before retrying
      await new Promise((resolve) => setTimeout(resolve, delay * attempt));
    }
  }

  throw lastError!;
};
