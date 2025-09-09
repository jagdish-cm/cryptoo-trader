/**
 * Trading signal-related type definitions
 */

import { TradeDirection } from "./common";

export interface TradingSignal {
  id: string;
  symbol: string;
  direction: TradeDirection;
  confidence: number;
  strength: SignalStrength;
  entryPrice: number;
  stopLoss: number;
  takeProfitLevels: number[];
  setupType: SetupType;
  timestamp: Date;
  reasoning: string;
}

export const SignalStrength = {
  WEAK: "WEAK",
  MODERATE: "MODERATE",
  STRONG: "STRONG",
  VERY_STRONG: "VERY_STRONG",
} as const;

export type SignalStrength =
  (typeof SignalStrength)[keyof typeof SignalStrength];

export const SetupType = {
  LONG_SUPPORT: "LONG_SUPPORT",
  SHORT_RESISTANCE: "SHORT_RESISTANCE",
  BREAKOUT: "BREAKOUT",
  REVERSAL: "REVERSAL",
} as const;

export type SetupType = (typeof SetupType)[keyof typeof SetupType];

export interface SignalFilter {
  symbol?: string;
  direction?: TradeDirection;
  strength?: SignalStrength;
  setupType?: SetupType;
  minConfidence?: number;
  maxConfidence?: number;
  dateRange?: {
    start: Date;
    end: Date;
  };
}

export interface SignalPerformance {
  signalId: string;
  symbol: string;
  direction: TradeDirection;
  confidence: number;
  actualOutcome: "WIN" | "LOSS" | "PENDING";
  expectedReturn: number;
  actualReturn: number;
  accuracy: number;
  executionTime: Date;
}

export interface SignalAnalytics {
  totalSignals: number;
  executedSignals: number;
  successfulSignals: number;
  accuracy: number;
  avgConfidence: number;
  avgReturn: number;
  bestPerformingSetup: SetupType;
  worstPerformingSetup: SetupType;
}
