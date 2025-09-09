/**
 * Error Boundary component for catching and handling React errors
 */

import React, { Component, ErrorInfo, ReactNode } from "react";
import { ExclamationTriangleIcon } from "@heroicons/react/24/outline";
import { BaseComponentProps } from "../../../types/common/base";
import {
  logError,
  formatError,
} from "../../../utils/error-handling/errorUtils";

interface ErrorFallbackProps {
  error: string;
  errorInfo?: string;
  onRetry?: () => void;
}

interface ErrorBoundaryProps extends BaseComponentProps {
  fallback?: React.ComponentType<ErrorFallbackProps>;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: string | null;
  errorInfo: string | null;
}

/**
 * Default error fallback component
 */
const DefaultErrorFallback: React.FC<ErrorFallbackProps> = ({
  error,
  errorInfo,
  onRetry,
}) => (
  <div className='min-h-[200px] flex items-center justify-center p-6'>
    <div className='text-center max-w-md'>
      <ExclamationTriangleIcon className='h-12 w-12 text-red-500 mx-auto mb-4' />
      <h3 className='text-lg font-semibold text-gray-900 dark:text-white mb-2'>
        Something went wrong
      </h3>
      <p className='text-sm text-gray-600 dark:text-gray-400 mb-4'>{error}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className='inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500'
        >
          Try Again
        </button>
      )}
      {process.env.NODE_ENV === "development" && errorInfo && (
        <details className='mt-4 text-left'>
          <summary className='cursor-pointer text-sm text-gray-500 hover:text-gray-700'>
            Error Details (Development)
          </summary>
          <pre className='mt-2 text-xs text-gray-600 bg-gray-100 dark:bg-gray-800 p-2 rounded overflow-auto max-h-32'>
            {errorInfo}
          </pre>
        </details>
      )}
    </div>
  </div>
);

/**
 * Error Boundary component that catches JavaScript errors anywhere in the child component tree
 */
export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return {
      hasError: true,
      error: formatError(error),
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log the error
    logError(error, "ErrorBoundary");

    // Update state with error info
    this.setState({
      errorInfo: errorInfo.componentStack || null,
    });

    // Call custom error handler if provided
    this.props.onError?.(error, errorInfo);
  }

  handleRetry = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  render() {
    if (this.state.hasError) {
      const FallbackComponent = this.props.fallback || DefaultErrorFallback;

      return (
        <div className={this.props.className} data-testid={this.props.testId}>
          <FallbackComponent
            error={this.state.error || "An unexpected error occurred"}
            errorInfo={this.state.errorInfo || undefined}
            onRetry={this.handleRetry}
          />
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * Higher-order component for wrapping components with error boundary
 */
export const withErrorBoundary = <P extends object>(
  Component: React.ComponentType<P>,
  fallback?: React.ComponentType<ErrorFallbackProps>
) => {
  const WrappedComponent = (props: P) => (
    <ErrorBoundary fallback={fallback}>
      <Component {...props} />
    </ErrorBoundary>
  );

  WrappedComponent.displayName = `withErrorBoundary(${Component.displayName || Component.name})`;

  return WrappedComponent;
};

export default ErrorBoundary;
