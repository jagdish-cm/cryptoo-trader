/**
 * UI component-related type definitions
 */

import { BaseComponentProps } from "../common/base";

// Chart types
export interface ChartConfig {
  symbol: string;
  timeframe: Timeframe;
  indicators: IndicatorConfig[];
  theme: "light" | "dark";
  autoScale: boolean;
}

export interface IndicatorConfig {
  type: IndicatorType;
  parameters: Record<string, unknown>;
  visible: boolean;
  color: string;
}

export const Timeframe = {
  "1m": "1m",
  "5m": "5m",
  "15m": "15m",
  "1h": "1h",
  "4h": "4h",
  "1d": "1d",
  "1w": "1w",
} as const;

export type Timeframe = (typeof Timeframe)[keyof typeof Timeframe];

export const IndicatorType = {
  SMA: "SMA",
  EMA: "EMA",
  RSI: "RSI",
  MACD: "MACD",
  BOLLINGER_BANDS: "BOLLINGER_BANDS",
  VOLUME: "VOLUME",
} as const;

export type IndicatorType = (typeof IndicatorType)[keyof typeof IndicatorType];

// Dashboard configuration
export interface DashboardConfig {
  theme: "light" | "dark" | "auto";
  layout: LayoutConfig;
  notifications: NotificationConfig;
  charts: ChartConfig;
}

export interface LayoutConfig {
  panels: PanelConfig[];
  sidebarCollapsed: boolean;
}

export interface PanelConfig {
  id: string;
  type: PanelType;
  title: string;
  position: GridPosition;
  size: PanelSize;
  visible: boolean;
  settings: Record<string, unknown>;
}

export const PanelType = {
  CHART: "CHART",
  POSITIONS: "POSITIONS",
  ACTIVITY_FEED: "ACTIVITY_FEED",
  PORTFOLIO: "PORTFOLIO",
  AI_DECISIONS: "AI_DECISIONS",
  PERFORMANCE: "PERFORMANCE",
} as const;

export type PanelType = (typeof PanelType)[keyof typeof PanelType];

export interface GridPosition {
  x: number;
  y: number;
}

export interface PanelSize {
  width: number;
  height: number;
}

// Notification configuration
export interface NotificationConfig {
  enabled: boolean;
  types: NotificationType[];
  sound: boolean;
  desktop: boolean;
  email: boolean;
}

export const NotificationType = {
  TRADE_EXECUTED: "TRADE_EXECUTED",
  SIGNAL_GENERATED: "SIGNAL_GENERATED",
  POSITION_CLOSED: "POSITION_CLOSED",
  SYSTEM_ERROR: "SYSTEM_ERROR",
  EMERGENCY_EXIT: "EMERGENCY_EXIT",
} as const;

export type NotificationType =
  (typeof NotificationType)[keyof typeof NotificationType];

// Table component types
export interface TableColumn<T> {
  key: keyof T;
  title: string;
  sortable?: boolean;
  filterable?: boolean;
  render?: (value: T[keyof T], record: T) => React.ReactNode;
  width?: number;
  align?: "left" | "center" | "right";
}

export interface TableProps<T> extends BaseComponentProps {
  data: T[];
  columns: TableColumn<T>[];
  loading?: boolean;
  pagination?: {
    current: number;
    pageSize: number;
    total: number;
    onChange: (page: number, pageSize: number) => void;
  };
  onRowClick?: (record: T) => void;
  rowKey: keyof T;
}

// Modal component types
export interface ModalProps extends BaseComponentProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  size?: "sm" | "md" | "lg" | "xl";
  closable?: boolean;
  maskClosable?: boolean;
  children: React.ReactNode;
}

// Form component types
export interface FormFieldProps extends BaseComponentProps {
  label?: string;
  required?: boolean;
  error?: string;
  helperText?: string;
  disabled?: boolean;
}

export interface SelectOption<T = string> {
  label: string;
  value: T;
  disabled?: boolean;
}

// Chart component types
export interface ChartProps extends BaseComponentProps {
  data: unknown[];
  config: ChartConfig;
  height?: number;
  loading?: boolean;
  error?: string;
}

// Metric card types
export interface MetricCardProps extends BaseComponentProps {
  title: string;
  value: string | number;
  change?: number;
  changeType?: "positive" | "negative" | "neutral";
  icon?: React.ComponentType;
  loading?: boolean;
  format?: "currency" | "percentage" | "number";
}
