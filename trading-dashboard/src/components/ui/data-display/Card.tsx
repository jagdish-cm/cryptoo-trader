/**
 * Reusable card component for consistent data presentation
 */

import React from "react";
import { BaseComponentProps } from "../../../types/common/base";

export interface CardProps extends BaseComponentProps {
  title?: string;
  subtitle?: string;
  extra?: React.ReactNode;
  children: React.ReactNode;
  actions?: React.ReactNode;
  size?: "sm" | "md" | "lg";
  variant?: "default" | "outlined" | "elevated" | "filled";
  hoverable?: boolean;
  loading?: boolean;
  bodyStyle?: React.CSSProperties;
  headStyle?: React.CSSProperties;
}

/**
 * Card component for consistent data presentation
 */
export const Card: React.FC<CardProps> = React.memo(
  ({
    title,
    subtitle,
    extra,
    children,
    actions,
    size = "md",
    variant = "default",
    hoverable = false,
    loading = false,
    bodyStyle,
    headStyle,
    className = "",
    testId,
  }) => {
    // Size classes
    const sizeClasses = {
      sm: "text-sm",
      md: "text-base",
      lg: "text-lg",
    };

    const paddingClasses = {
      sm: "p-4",
      md: "p-6",
      lg: "p-8",
    };

    const headerPaddingClasses = {
      sm: "px-4 py-3",
      md: "px-6 py-4",
      lg: "px-8 py-5",
    };

    // Variant classes
    const variantClasses = {
      default:
        "bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700",
      outlined: "bg-transparent border-2 border-gray-300 dark:border-gray-600",
      elevated: "bg-white dark:bg-gray-800 shadow-lg border-0",
      filled: "bg-gray-50 dark:bg-gray-700 border-0",
    };

    const cardClasses = [
      "rounded-lg transition-all duration-200",
      sizeClasses[size],
      variantClasses[variant],
      hoverable ? "hover:shadow-md hover:-translate-y-1 cursor-pointer" : "",
      loading ? "animate-pulse" : "",
      className,
    ]
      .filter(Boolean)
      .join(" ");

    const hasHeader = title || subtitle || extra;

    if (loading) {
      return (
        <div className={cardClasses} data-testid={testId}>
          {hasHeader && (
            <div
              className={`border-b border-gray-200 dark:border-gray-700 ${headerPaddingClasses[size]}`}
            >
              <div className='space-y-2'>
                <div className='h-5 bg-gray-200 dark:bg-gray-600 rounded w-1/3'></div>
                <div className='h-3 bg-gray-200 dark:bg-gray-600 rounded w-1/2'></div>
              </div>
            </div>
          )}
          <div className={paddingClasses[size]}>
            <div className='space-y-4'>
              <div className='h-4 bg-gray-200 dark:bg-gray-600 rounded'></div>
              <div className='h-4 bg-gray-200 dark:bg-gray-600 rounded w-5/6'></div>
              <div className='h-4 bg-gray-200 dark:bg-gray-600 rounded w-4/6'></div>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className={cardClasses} data-testid={testId}>
        {/* Header */}
        {hasHeader && (
          <div
            className={`border-b border-gray-200 dark:border-gray-700 ${headerPaddingClasses[size]}`}
            style={headStyle}
          >
            <div className='flex items-center justify-between'>
              <div className='flex-1 min-w-0'>
                {title && (
                  <h3 className='text-lg font-medium text-gray-900 dark:text-white truncate'>
                    {title}
                  </h3>
                )}
                {subtitle && (
                  <p className='mt-1 text-sm text-gray-600 dark:text-gray-400 truncate'>
                    {subtitle}
                  </p>
                )}
              </div>
              {extra && <div className='flex-shrink-0 ml-4'>{extra}</div>}
            </div>
          </div>
        )}

        {/* Body */}
        <div className={paddingClasses[size]} style={bodyStyle}>
          {children}
        </div>

        {/* Actions */}
        {actions && (
          <div
            className={`border-t border-gray-200 dark:border-gray-700 ${headerPaddingClasses[size]}`}
          >
            <div className='flex items-center justify-end space-x-3'>
              {actions}
            </div>
          </div>
        )}
      </div>
    );
  }
);

Card.displayName = "Card";

/**
 * Card.Meta component for additional metadata
 */
export const CardMeta: React.FC<{
  avatar?: React.ReactNode;
  title?: React.ReactNode;
  description?: React.ReactNode;
  className?: string;
}> = ({ avatar, title, description, className = "" }) => (
  <div className={`flex items-start space-x-3 ${className}`}>
    {avatar && <div className='flex-shrink-0'>{avatar}</div>}
    <div className='flex-1 min-w-0'>
      {title && (
        <div className='text-sm font-medium text-gray-900 dark:text-white'>
          {title}
        </div>
      )}
      {description && (
        <div className='text-sm text-gray-600 dark:text-gray-400 mt-1'>
          {description}
        </div>
      )}
    </div>
  </div>
);

/**
 * Card.Grid component for grid layouts
 */
export const CardGrid: React.FC<{
  children: React.ReactNode;
  cols?: 1 | 2 | 3 | 4 | 6;
  gap?: "sm" | "md" | "lg";
  className?: string;
}> = ({ children, cols = 3, gap = "md", className = "" }) => {
  const colsClasses = {
    1: "grid-cols-1",
    2: "grid-cols-1 md:grid-cols-2",
    3: "grid-cols-1 md:grid-cols-2 lg:grid-cols-3",
    4: "grid-cols-1 md:grid-cols-2 lg:grid-cols-4",
    6: "grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6",
  };

  const gapClasses = {
    sm: "gap-4",
    md: "gap-6",
    lg: "gap-8",
  };

  return (
    <div
      className={`grid ${colsClasses[cols]} ${gapClasses[gap]} ${className}`}
    >
      {children}
    </div>
  );
};

// Attach sub-components
const CardWithSubComponents = Card as typeof Card & {
  Meta: typeof CardMeta;
  Grid: typeof CardGrid;
};

CardWithSubComponents.Meta = CardMeta;
CardWithSubComponents.Grid = CardGrid;

export default CardWithSubComponents;
