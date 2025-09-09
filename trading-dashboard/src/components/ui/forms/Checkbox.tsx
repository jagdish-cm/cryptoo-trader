/**
 * Reusable checkbox component with validation support
 */

import React, { forwardRef } from "react";
import {
  CheckIcon,
  MinusIcon,
  ExclamationCircleIcon,
} from "@heroicons/react/24/outline";
import { BaseComponentProps } from "../../../types/common/base";

export interface CheckboxProps
  extends BaseComponentProps,
    Omit<React.InputHTMLAttributes<HTMLInputElement>, "size"> {
  label?: string;
  description?: string;
  error?: string;
  size?: "sm" | "md" | "lg";
  variant?: "default" | "card";
  indeterminate?: boolean;
  required?: boolean;
  loading?: boolean;
}

/**
 * Checkbox component with validation and accessibility features
 */
export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
  (
    {
      label,
      description,
      error,
      size = "md",
      variant = "default",
      indeterminate = false,
      required = false,
      loading = false,
      disabled = false,
      checked = false,
      className = "",
      testId,
      id,
      ...props
    },
    ref
  ) => {
    const checkboxId =
      id || `checkbox-${Math.random().toString(36).substr(2, 9)}`;
    const hasError = Boolean(error);

    // Size classes
    const sizeClasses = {
      sm: "h-4 w-4",
      md: "h-5 w-5",
      lg: "h-6 w-6",
    };

    const iconSizeClasses = {
      sm: "h-3 w-3",
      md: "h-4 w-4",
      lg: "h-5 w-5",
    };

    const textSizeClasses = {
      sm: "text-sm",
      md: "text-sm",
      lg: "text-base",
    };

    // Checkbox classes
    const checkboxClasses = [
      "rounded border-2 transition-all duration-200",
      "focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50",
      sizeClasses[size],
      hasError
        ? "border-red-300 dark:border-red-600"
        : "border-gray-300 dark:border-gray-600",
      checked || indeterminate
        ? hasError
          ? "bg-red-500 border-red-500 text-white"
          : "bg-blue-500 border-blue-500 text-white"
        : "bg-white dark:bg-gray-800",
      disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer",
      loading ? "animate-pulse" : "",
    ]
      .filter(Boolean)
      .join(" ");

    const containerClasses = [
      variant === "card"
        ? "p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
        : "",
      disabled ? "cursor-not-allowed" : "cursor-pointer",
      className,
    ]
      .filter(Boolean)
      .join(" ");

    return (
      <div className={containerClasses} data-testid={testId}>
        <div className='flex items-start'>
          {/* Checkbox */}
          <div className='flex items-center h-5'>
            <div className='relative'>
              <input
                ref={ref}
                id={checkboxId}
                type='checkbox'
                checked={checked}
                disabled={disabled || loading}
                className='sr-only'
                {...props}
              />
              <div
                className={checkboxClasses}
                onClick={() => {
                  if (!disabled && !loading) {
                    const event = new MouseEvent("click", { bubbles: true });
                    if (typeof ref !== "function" && ref?.current) {
                      ref.current.dispatchEvent(event);
                    }
                  }
                }}
              >
                {/* Check/Indeterminate Icon */}
                {(checked || indeterminate) && (
                  <div className='flex items-center justify-center h-full'>
                    {indeterminate ? (
                      <MinusIcon className={iconSizeClasses[size]} />
                    ) : (
                      <CheckIcon className={iconSizeClasses[size]} />
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Label and Description */}
          {(label || description) && (
            <div className='ml-3 flex-1'>
              {label && (
                <label
                  htmlFor={checkboxId}
                  className={`font-medium cursor-pointer ${textSizeClasses[size]} ${
                    hasError
                      ? "text-red-700 dark:text-red-400"
                      : "text-gray-900 dark:text-white"
                  } ${disabled ? "cursor-not-allowed opacity-50" : ""}`}
                >
                  {label}
                  {required && <span className='text-red-500 ml-1'>*</span>}
                </label>
              )}
              {description && (
                <p
                  className={`mt-1 text-gray-600 dark:text-gray-400 ${
                    size === "sm" ? "text-xs" : "text-sm"
                  } ${disabled ? "opacity-50" : ""}`}
                >
                  {description}
                </p>
              )}
            </div>
          )}

          {/* Error Icon */}
          {hasError && (
            <div className='ml-2'>
              <ExclamationCircleIcon className='h-5 w-5 text-red-400' />
            </div>
          )}
        </div>

        {/* Error Message */}
        {error && (
          <div className='mt-2 ml-8'>
            <p className='text-sm text-red-600 dark:text-red-400 flex items-center'>
              <ExclamationCircleIcon className='h-4 w-4 mr-1' />
              {error}
            </p>
          </div>
        )}
      </div>
    );
  }
);

Checkbox.displayName = "Checkbox";

export default Checkbox;
