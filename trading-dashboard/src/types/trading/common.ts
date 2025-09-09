/**
 * Common trading-related type definitions
 */

// Trading direction constants and types
export const TradeDirection = {
  LONG: "LONG",
  SHORT: "SHORT",
} as const;

export type TradeDirection =
  (typeof TradeDirection)[keyof typeof TradeDirection];

// Trading phase constants and types
export const TradingPhase = {
  DATA_INGESTION: "DATA_INGESTION",
  REGIME_ANALYSIS: "REGIME_ANALYSIS",
  TECHNICAL_ANALYSIS: "TECHNICAL_ANALYSIS",
  SENTIMENT_ANALYSIS: "SENTIMENT_ANALYSIS",
  SIGNAL_FUSION: "SIGNAL_FUSION",
  RISK_MANAGEMENT: "RISK_MANAGEMENT",
  TRADE_EXECUTION: "TRADE_EXECUTION",
} as const;

export type TradingPhase = (typeof TradingPhase)[keyof typeof TradingPhase];

// Market data interface
export interface MarketData {
  symbol: string;
  price: number;
  change24h: number;
  volume24h: number;
  high24h: number;
  low24h: number;
  timestamp: Date;
}

// Market regime interface
export interface MarketRegime {
  current: "bull" | "bear" | "range" | "unknown";
  confidence: number;
  trendStrength: "weak" | "moderate" | "strong";
  volatility: "low" | "moderate" | "high";
  lastUpdate: string;
  bitcoinAnalysis?: {
    trend: string;
    support: number;
    resistance: number;
  };
}

// Sentiment analysis interface
export interface SentimentAnalysis {
  symbol: string;
  sentiment: "POSITIVE" | "NEGATIVE" | "NEUTRAL";
  confidence: number;
  keyFactors: string[];
  newsImpact: number;
  socialImpact: number;
  processingTime: number;
  timestamp: Date;
}

// AI Decision types
export const DecisionType = {
  SIGNAL_GENERATION: "SIGNAL_GENERATION",
  RISK_VALIDATION: "RISK_VALIDATION",
  TRADE_EXECUTION: "TRADE_EXECUTION",
  POSITION_MANAGEMENT: "POSITION_MANAGEMENT",
} as const;

export type DecisionType = (typeof DecisionType)[keyof typeof DecisionType];

export interface DecisionReasoning {
  technicalScore: number;
  sentimentScore: number;
  eventImpact: number;
  finalConfidence: number;
  riskFactors: string[];
  summary?: string;
  technicalIndicators?: string[];
  marketSentiment?: string;
  modelVersion?: string;
}

export interface DecisionFactor {
  type: string;
  value: number;
  weight: number;
  description: string;
}

export interface DecisionOutcome {
  action: string;
  result: "SUCCESS" | "FAILURE" | "PENDING";
  details: string;
}

export interface AIDecision {
  id: string;
  timestamp: Date;
  type: DecisionType;
  symbol: string;
  confidence: number;
  reasoning: DecisionReasoning;
  factors: DecisionFactor[];
  outcome: DecisionOutcome;
  // Execution threshold properties
  executionDecision?: "EXECUTED" | "REJECTED" | "PENDING";
  executionProbability?: number;
  rejectionReasons?: string[];
  executionThresholds?: {
    minConfidence?: number;
    minTechnical?: number;
    minSentiment?: number;
    minFusionScore?: number;
  };
  scoreVsThresholds?: Record<string, any>;
  thresholdAnalysis?: Record<string, any>;
}

// System status interface
export interface SystemStatus {
  status: "RUNNING" | "STOPPED" | "ERROR" | "STARTING";
  uptime: number;
  lastHeartbeat: Date;
  activeConnections: number;
  processingSymbol?: string;
  currentPhase: TradingPhase;
  errors: SystemError[];
}

export interface SystemError {
  id: string;
  timestamp: Date;
  level: "ERROR" | "WARNING" | "CRITICAL";
  message: string;
  component: string;
  details?: unknown;
}
