/**
 * Position-related type definitions
 */

import { TradeDirection } from "./common";

export interface Position {
  id: string;
  symbol: string;
  direction: TradeDirection;
  entryPrice: number;
  currentPrice: number;
  quantity: number;
  unrealizedPnL: number;
  realizedPnL: number;
  stopLoss?: number;
  takeProfitLevels: number[];
  status: PositionStatus;
  createdAt: Date;
  updatedAt: Date;
}

export const PositionStatus = {
  OPEN: "OPEN",
  CLOSED: "CLOSED",
  CLOSING: "CLOSING",
} as const;

export type PositionStatus =
  (typeof PositionStatus)[keyof typeof PositionStatus];

export interface PositionUpdate {
  positionId: string;
  currentPrice: number;
  unrealizedPnL: number;
  timestamp: Date;
}

export interface PositionFilter {
  symbol?: string;
  direction?: TradeDirection;
  status?: PositionStatus;
  minPnL?: number;
  maxPnL?: number;
  dateRange?: {
    start: Date;
    end: Date;
  };
}

export interface PositionSummary {
  totalPositions: number;
  openPositions: number;
  totalUnrealizedPnL: number;
  totalRealizedPnL: number;
  bestPerformer: Position | null;
  worstPerformer: Position | null;
}
