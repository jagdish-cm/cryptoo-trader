/**
 * Reusable select component with validation support
 */

import React, { forwardRef } from "react";
import {
  ChevronDownIcon,
  ExclamationCircleIcon,
} from "@heroicons/react/24/outline";
import { BaseComponentProps } from "../../../types/common/base";

export interface SelectOption {
  value: string | number;
  label: string;
  disabled?: boolean;
  group?: string;
}

export interface SelectProps
  extends BaseComponentProps,
    Omit<React.SelectHTMLAttributes<HTMLSelectElement>, "size"> {
  label?: string;
  error?: string;
  helperText?: string;
  options: SelectOption[];
  placeholder?: string;
  size?: "sm" | "md" | "lg";
  variant?: "default" | "filled" | "outlined";
  required?: boolean;
  loading?: boolean;
}

/**
 * Select component with validation and accessibility features
 */
export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  (
    {
      label,
      error,
      helperText,
      options,
      placeholder,
      size = "md",
      variant = "default",
      required = false,
      loading = false,
      disabled = false,
      className = "",
      testId,
      id,
      ...props
    },
    ref
  ) => {
    const selectId = id || `select-${Math.random().toString(36).substr(2, 9)}`;
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

    const selectClasses = [
      "w-full rounded-md transition-colors duration-200",
      "text-gray-900 dark:text-white",
      "focus:outline-none focus:ring-2 focus:ring-opacity-50",
      "appearance-none cursor-pointer",
      "pr-10", // Space for chevron icon
      sizeClasses[size],
      variantClasses[variant],
      disabled ? "opacity-50 cursor-not-allowed" : "",
      loading ? "animate-pulse" : "",
      className,
    ]
      .filter(Boolean)
      .join(" ");

    // Group options by group property
    const groupedOptions = options.reduce(
      (groups, option) => {
        const group = option.group || "default";
        if (!groups[group]) {
          groups[group] = [];
        }
        groups[group].push(option);
        return groups;
      },
      {} as Record<string, SelectOption[]>
    );

    const hasGroups =
      Object.keys(groupedOptions).length > 1 || !groupedOptions.default;

    return (
      <div className='w-full' data-testid={testId}>
        {/* Label */}
        {label && (
          <label
            htmlFor={selectId}
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

        {/* Select Container */}
        <div className='relative'>
          <select
            ref={ref}
            id={selectId}
            disabled={disabled || loading}
            className={selectClasses}
            {...props}
          >
            {placeholder && (
              <option value='' disabled>
                {placeholder}
              </option>
            )}

            {hasGroups
              ? // Render grouped options
                Object.entries(groupedOptions).map(
                  ([groupName, groupOptions]) =>
                    groupName === "default" ? (
                      groupOptions.map((option) => (
                        <option
                          key={option.value}
                          value={option.value}
                          disabled={option.disabled}
                        >
                          {option.label}
                        </option>
                      ))
                    ) : (
                      <optgroup key={groupName} label={groupName}>
                        {groupOptions.map((option) => (
                          <option
                            key={option.value}
                            value={option.value}
                            disabled={option.disabled}
                          >
                            {option.label}
                          </option>
                        ))}
                      </optgroup>
                    )
                )
              : // Render flat options
                options.map((option) => (
                  <option
                    key={option.value}
                    value={option.value}
                    disabled={option.disabled}
                  >
                    {option.label}
                  </option>
                ))}
          </select>

          {/* Chevron Icon */}
          <div className='absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none'>
            {hasError ? (
              <ExclamationCircleIcon className='h-5 w-5 text-red-400' />
            ) : (
              <ChevronDownIcon className='h-5 w-5 text-gray-400' />
            )}
          </div>
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

Select.displayName = "Select";

export default Select;
