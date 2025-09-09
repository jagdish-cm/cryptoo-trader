/**
 * Reusable input component with validation support
 */

import React, { forwardRef, useState } from "react";
import {
  ExclamationCircleIcon,
  EyeIcon,
  EyeSlashIcon,
} from "@heroicons/react/24/outline";
import { BaseComponentProps } from "../../../types/common/base";

export interface InputProps
  extends BaseComponentProps,
    Omit<React.InputHTMLAttributes<HTMLInputElement>, "size"> {
  label?: string;
  error?: string;
  helperText?: string;
  leftIcon?: React.ComponentType<{ className?: string }>;
  rightIcon?: React.ComponentType<{ className?: string }>;
  size?: "sm" | "md" | "lg";
  variant?: "default" | "filled" | "outlined";
  required?: boolean;
  loading?: boolean;
}

/**
 * Input component with validation and accessibility features
 */
export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      label,
      error,
      helperText,
      leftIcon: LeftIcon,
      rightIcon: RightIcon,
      size = "md",
      variant = "default",
      required = false,
      loading = false,
      disabled = false,
      type = "text",
      className = "",
      testId,
      id,
      ...props
    },
    ref
  ) => {
    const [showPassword, setShowPassword] = useState(false);
    const [isFocused, setIsFocused] = useState(false);

    const inputId = id || `input-${Math.random().toString(36).substr(2, 9)}`;
    const isPassword = type === "password";
    const actualType = isPassword && showPassword ? "text" : type;
    const hasError = Boolean(error);

    // Size classes
    const sizeClasses = {
      sm: "px-3 py-2 text-sm",
      md: "px-4 py-2.5 text-sm",
      lg: "px-4 py-3 text-base",
    };

    // Variant classes
    const variantClasses = {
      default: `border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 ${
        hasError
          ? "border-red-300 dark:border-red-600 focus:border-red-500 focus:ring-red-500"
          : "focus:border-blue-500 focus:ring-blue-500"
      }`,
      filled: `border-0 bg-gray-100 dark:bg-gray-700 ${
        hasError
          ? "bg-red-50 dark:bg-red-900/20 focus:bg-red-50 dark:focus:bg-red-900/20"
          : "focus:bg-white dark:focus:bg-gray-800"
      }`,
      outlined: `border-2 bg-transparent ${
        hasError
          ? "border-red-300 dark:border-red-600 focus:border-red-500"
          : "border-gray-300 dark:border-gray-600 focus:border-blue-500"
      }`,
    };

    const inputClasses = [
      "w-full rounded-md transition-colors duration-200",
      "text-gray-900 dark:text-white",
      "placeholder-gray-500 dark:placeholder-gray-400",
      "focus:outline-none focus:ring-2 focus:ring-opacity-50",
      sizeClasses[size],
      variantClasses[variant],
      LeftIcon ? "pl-10" : "",
      RightIcon || isPassword ? "pr-10" : "",
      disabled ? "opacity-50 cursor-not-allowed" : "",
      loading ? "animate-pulse" : "",
      className,
    ]
      .filter(Boolean)
      .join(" ");

    return (
      <div className='w-full' data-testid={testId}>
        {/* Label */}
        {label && (
          <label
            htmlFor={inputId}
            className={`block text-sm font-medium mb-2 ${
              hasError
                ? "text-red-700 dark:text-red-400"
                : "text-gray-700 dark:text-gray-300"
            }`}
          >
            {label}
            {required && <span className='text-red-500 ml-1'>*</span>}
          </label>
        )}

        {/* Input Container */}
        <div className='relative'>
          {/* Left Icon */}
          {LeftIcon && (
            <div className='absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none'>
              <LeftIcon
                className={`h-5 w-5 ${
                  hasError
                    ? "text-red-400"
                    : isFocused
                      ? "text-blue-500"
                      : "text-gray-400"
                }`}
              />
            </div>
          )}

          {/* Input */}
          <input
            ref={ref}
            id={inputId}
            type={actualType}
            disabled={disabled || loading}
            className={inputClasses}
            onFocus={(e) => {
              setIsFocused(true);
              props.onFocus?.(e);
            }}
            onBlur={(e) => {
              setIsFocused(false);
              props.onBlur?.(e);
            }}
            {...props}
          />

          {/* Right Icon or Password Toggle */}
          {(RightIcon || isPassword || hasError) && (
            <div className='absolute inset-y-0 right-0 pr-3 flex items-center'>
              {hasError && (
                <ExclamationCircleIcon className='h-5 w-5 text-red-400' />
              )}
              {isPassword && !hasError && (
                <button
                  type='button'
                  onClick={() => setShowPassword(!showPassword)}
                  className='text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 focus:outline-none'
                  tabIndex={-1}
                >
                  {showPassword ? (
                    <EyeSlashIcon className='h-5 w-5' />
                  ) : (
                    <EyeIcon className='h-5 w-5' />
                  )}
                </button>
              )}
              {RightIcon && !hasError && !isPassword && (
                <RightIcon
                  className={`h-5 w-5 ${
                    isFocused ? "text-blue-500" : "text-gray-400"
                  }`}
                />
              )}
            </div>
          )}
        </div>

        {/* Helper Text or Error */}
        {(error || helperText) && (
          <div className='mt-2'>
            {error ? (
              <p className='text-sm text-red-600 dark:text-red-400 flex items-center'>
                <ExclamationCircleIcon className='h-4 w-4 mr-1' />
                {error}
              </p>
            ) : helperText ? (
              <p className='text-sm text-gray-600 dark:text-gray-400'>
                {helperText}
              </p>
            ) : null}
          </div>
        )}
      </div>
    );
  }
);

Input.displayName = "Input";

export default Input;
