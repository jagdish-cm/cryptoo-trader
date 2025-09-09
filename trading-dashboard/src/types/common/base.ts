/**
 * Base component interfaces and utility types for consistent patterns
 */

export interface BaseComponentProps {
  className?: string;
  testId?: string;
}

export interface DataComponentProps<T> extends BaseComponentProps {
  data: T;
  loading?: boolean;
  error?: string | null;
}

export interface InteractiveComponentProps extends BaseComponentProps {
  disabled?: boolean;
  onClick?: () => void;
}

export interface FormComponentProps extends BaseComponentProps {
  disabled?: boolean;
  required?: boolean;
  error?: string;
  helperText?: string;
}

// Hook return type patterns
export interface DataHookReturn<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export interface MutationHookReturn<T, P> {
  mutate: (params: P) => Promise<T>;
  loading: boolean;
  error: string | null;
}

// Common utility types
export type Size = "xs" | "sm" | "md" | "lg" | "xl";
export type Variant =
  | "primary"
  | "secondary"
  | "success"
  | "warning"
  | "error"
  | "info";
export type Status = "idle" | "loading" | "success" | "error";

// Generic API response wrapper
export interface ApiResponse<T> {
  data: T;
  success: boolean;
  message?: string;
  timestamp: string;
}

// Pagination types
export interface PaginationParams {
  page: number;
  limit: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// Filter types
export interface FilterOption<T = string> {
  label: string;
  value: T;
  count?: number;
}

export interface DateRange {
  start: Date;
  end: Date;
}

// Error types
export interface AppError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
  timestamp: Date;
}

export interface ValidationError {
  field: string;
  message: string;
  code: string;
}
