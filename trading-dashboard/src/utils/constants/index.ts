/**
 * Application-wide constants and configuration values
 */

// Trading constants
export const TRADING_CONSTANTS = {
  MIN_POSITION_SIZE: 0.001,
  MAX_POSITION_SIZE: 1000000,
  MIN_STOP_LOSS_PERCENTAGE: 0.1,
  MAX_STOP_LOSS_PERCENTAGE: 50,
  MIN_TAKE_PROFIT_PERCENTAGE: 0.1,
  MAX_TAKE_PROFIT_PERCENTAGE: 1000,
  DEFAULT_RISK_PER_TRADE: 2,
  DEFAULT_MAX_POSITIONS: 10,
  MIN_CONFIDENCE_THRESHOLD: 0.1,
  MAX_CONFIDENCE_THRESHOLD: 1.0,
} as const;

// UI constants
export const UI_CONSTANTS = {
  DEFAULT_PAGE_SIZE: 20,
  MAX_PAGE_SIZE: 100,
  DEBOUNCE_DELAY: 300,
  ANIMATION_DURATION: 200,
  TOAST_DURATION: 5000,
  POLLING_INTERVAL: 30000,
} as const;

// Chart constants
export const CHART_CONSTANTS = {
  DEFAULT_TIMEFRAME: "1h",
  AVAILABLE_TIMEFRAMES: ["1m", "5m", "15m", "1h", "4h", "1d", "1w"] as const,
  DEFAULT_CHART_HEIGHT: 400,
  MIN_CHART_HEIGHT: 200,
  MAX_CHART_HEIGHT: 800,
} as const;

// WebSocket constants
export const WEBSOCKET_CONSTANTS = {
  RECONNECT_ATTEMPTS: 5,
  RECONNECT_DELAY: 1000,
  CONNECTION_TIMEOUT: 10000,
  HEARTBEAT_INTERVAL: 30000,
} as const;

// API constants
export const API_CONSTANTS = {
  REQUEST_TIMEOUT: 30000,
  RETRY_ATTEMPTS: 3,
  RETRY_DELAY: 1000,
  CACHE_DURATION: 300000, // 5 minutes
} as const;

// Validation constants
export const VALIDATION_CONSTANTS = {
  MIN_PASSWORD_LENGTH: 8,
  MAX_PASSWORD_LENGTH: 128,
  MIN_USERNAME_LENGTH: 3,
  MAX_USERNAME_LENGTH: 50,
  MAX_SYMBOL_LENGTH: 20,
  MAX_DESCRIPTION_LENGTH: 500,
} as const;

// Color constants for consistent theming
export const COLOR_CONSTANTS = {
  SUCCESS: "#10B981",
  ERROR: "#EF4444",
  WARNING: "#F59E0B",
  INFO: "#3B82F6",
  PRIMARY: "#6366F1",
  SECONDARY: "#6B7280",
  POSITIVE: "#10B981",
  NEGATIVE: "#EF4444",
  NEUTRAL: "#6B7280",
} as const;

// Trading direction constants
export const DIRECTION = {
  LONG: "LONG",
  SHORT: "SHORT",
} as const;

// Position status constants
export const POSITION_STATUS = {
  OPEN: "OPEN",
  CLOSED: "CLOSED",
  CLOSING: "CLOSING",
} as const;

// Signal strength constants
export const SIGNAL_STRENGTH = {
  WEAK: "WEAK",
  MODERATE: "MODERATE",
  STRONG: "STRONG",
  VERY_STRONG: "VERY_STRONG",
} as const;

// Setup type constants
export const SETUP_TYPE = {
  LONG_SUPPORT: "LONG_SUPPORT",
  SHORT_RESISTANCE: "SHORT_RESISTANCE",
  BREAKOUT: "BREAKOUT",
  REVERSAL: "REVERSAL",
} as const;

// Trading phase constants
export const TRADING_PHASE = {
  DATA_INGESTION: "DATA_INGESTION",
  REGIME_ANALYSIS: "REGIME_ANALYSIS",
  TECHNICAL_ANALYSIS: "TECHNICAL_ANALYSIS",
  SENTIMENT_ANALYSIS: "SENTIMENT_ANALYSIS",
  SIGNAL_FUSION: "SIGNAL_FUSION",
  RISK_MANAGEMENT: "RISK_MANAGEMENT",
  TRADE_EXECUTION: "TRADE_EXECUTION",
} as const;

// Decision type constants
export const DECISION_TYPE = {
  SIGNAL_GENERATION: "SIGNAL_GENERATION",
  RISK_VALIDATION: "RISK_VALIDATION",
  TRADE_EXECUTION: "TRADE_EXECUTION",
  POSITION_MANAGEMENT: "POSITION_MANAGEMENT",
} as const;

// System status constants
export const SYSTEM_STATUS = {
  RUNNING: "RUNNING",
  STOPPED: "STOPPED",
  ERROR: "ERROR",
  STARTING: "STARTING",
} as const;

// Message type constants
export const MESSAGE_TYPE = {
  MARKET_DATA: "market_data",
  PORTFOLIO_UPDATE: "portfolio_update",
  POSITION_UPDATE: "position_update",
  TRADE_EXECUTED: "trade_executed",
  SIGNAL_GENERATED: "signal_generated",
  AI_DECISION: "ai_decision",
  SYSTEM_STATUS: "system_status",
  REGIME_CHANGE: "regime_change",
} as const;

// Notification type constants
export const NOTIFICATION_TYPE = {
  TRADE_EXECUTED: "TRADE_EXECUTED",
  SIGNAL_GENERATED: "SIGNAL_GENERATED",
  POSITION_CLOSED: "POSITION_CLOSED",
  SYSTEM_ERROR: "SYSTEM_ERROR",
  EMERGENCY_EXIT: "EMERGENCY_EXIT",
} as const;

// Panel type constants
export const PANEL_TYPE = {
  CHART: "CHART",
  POSITIONS: "POSITIONS",
  ACTIVITY_FEED: "ACTIVITY_FEED",
  PORTFOLIO: "PORTFOLIO",
  AI_DECISIONS: "AI_DECISIONS",
  PERFORMANCE: "PERFORMANCE",
} as const;

// Timeframe constants
export const TIMEFRAME = {
  "1m": "1m",
  "5m": "5m",
  "15m": "15m",
  "1h": "1h",
  "4h": "4h",
  "1d": "1d",
  "1w": "1w",
} as const;

// Indicator type constants
export const INDICATOR_TYPE = {
  SMA: "SMA",
  EMA: "EMA",
  RSI: "RSI",
  MACD: "MACD",
  BOLLINGER_BANDS: "BOLLINGER_BANDS",
  VOLUME: "VOLUME",
} as const;

// Default configuration values
export const DEFAULT_CONFIG = {
  THEME: "dark",
  LANGUAGE: "en",
  TIMEZONE: "UTC",
  CURRENCY: "USD",
  DECIMAL_PLACES: 2,
  CHART_THEME: "dark",
  AUTO_REFRESH: true,
  SOUND_ENABLED: true,
  NOTIFICATIONS_ENABLED: true,
} as const;

// Error codes
export const ERROR_CODES = {
  VALIDATION_REQUIRED: "VALIDATION_REQUIRED",
  VALIDATION_EMAIL_FORMAT: "VALIDATION_EMAIL_FORMAT",
  VALIDATION_NUMBER_RANGE: "VALIDATION_NUMBER_RANGE",
  VALIDATION_MIN_NUMBER: "VALIDATION_MIN_NUMBER",
  VALIDATION_MAX_NUMBER: "VALIDATION_MAX_NUMBER",
  VALIDATION_MIN_LENGTH: "VALIDATION_MIN_LENGTH",
  VALIDATION_MAX_LENGTH: "VALIDATION_MAX_LENGTH",
  VALIDATION_SYMBOL_FORMAT: "VALIDATION_SYMBOL_FORMAT",
  VALIDATION_PERCENTAGE_RANGE: "VALIDATION_PERCENTAGE_RANGE",
  VALIDATION_POSITIVE_NUMBER: "VALIDATION_POSITIVE_NUMBER",
  VALIDATION_DATE_RANGE: "VALIDATION_DATE_RANGE",
  VALIDATION_FUTURE_DATE: "VALIDATION_FUTURE_DATE",
  NETWORK_ERROR: "NETWORK_ERROR",
  API_ERROR: "API_ERROR",
  WEBSOCKET_ERROR: "WEBSOCKET_ERROR",
  AUTHENTICATION_ERROR: "AUTHENTICATION_ERROR",
  AUTHORIZATION_ERROR: "AUTHORIZATION_ERROR",
  NOT_FOUND_ERROR: "NOT_FOUND_ERROR",
  SERVER_ERROR: "SERVER_ERROR",
} as const;

// Export type definitions for constants
export type TradingDirection = (typeof DIRECTION)[keyof typeof DIRECTION];
export type PositionStatus =
  (typeof POSITION_STATUS)[keyof typeof POSITION_STATUS];
export type SignalStrength =
  (typeof SIGNAL_STRENGTH)[keyof typeof SIGNAL_STRENGTH];
export type SetupType = (typeof SETUP_TYPE)[keyof typeof SETUP_TYPE];
export type TradingPhase = (typeof TRADING_PHASE)[keyof typeof TRADING_PHASE];
export type DecisionType = (typeof DECISION_TYPE)[keyof typeof DECISION_TYPE];
export type SystemStatus = (typeof SYSTEM_STATUS)[keyof typeof SYSTEM_STATUS];
export type MessageType = (typeof MESSAGE_TYPE)[keyof typeof MESSAGE_TYPE];
export type NotificationType =
  (typeof NOTIFICATION_TYPE)[keyof typeof NOTIFICATION_TYPE];
export type PanelType = (typeof PANEL_TYPE)[keyof typeof PANEL_TYPE];
export type Timeframe = (typeof TIMEFRAME)[keyof typeof TIMEFRAME];
export type IndicatorType =
  (typeof INDICATOR_TYPE)[keyof typeof INDICATOR_TYPE];
export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];
