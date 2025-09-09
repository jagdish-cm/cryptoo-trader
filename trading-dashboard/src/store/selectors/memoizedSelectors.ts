/**
 * Memoized selectors for Redux state access
 */

import { createSelector } from "@reduxjs/toolkit";
import { RootState } from "../index";

// Base selectors
const selectDashboard = (state: RootState) => state.dashboard;
const selectPortfolio = (state: RootState) => state.portfolio;
const selectSystem = (state: RootState) => state.system;

// Memoized dashboard selectors
export const selectDashboardData = createSelector(
  [selectDashboard],
  (dashboard) => dashboard
);

export const selectActiveSymbols = createSelector(
  [selectDashboard],
  (dashboard) => [] // TODO: Add activeSymbols to DashboardState
);

export const selectMarketStatus = createSelector(
  [selectDashboard],
  (dashboard) => "OPEN" // TODO: Add marketStatus to DashboardState
);

// Memoized portfolio selectors
export const selectPortfolioData = createSelector(
  [selectPortfolio],
  (portfolio) => portfolio
);

export const selectPortfolioPositions = createSelector(
  [selectPortfolio],
  (portfolio) => portfolio.positions || []
);

export const selectPortfolioValue = createSelector(
  [selectPortfolioPositions],
  (positions) =>
    positions.reduce(
      (total, position) => total + position.quantity * position.currentPrice,
      0
    )
);

export const selectPortfolioPnL = createSelector(
  [selectPortfolioPositions],
  (positions) =>
    positions.reduce((total, position) => total + position.unrealizedPnL, 0)
);

export const selectProfitablePositions = createSelector(
  [selectPortfolioPositions],
  (positions) => positions.filter((position) => position.unrealizedPnL > 0)
);

export const selectLosingPositions = createSelector(
  [selectPortfolioPositions],
  (positions) => positions.filter((position) => position.unrealizedPnL < 0)
);

export const selectPortfolioMetrics = createSelector(
  [
    selectPortfolioValue,
    selectPortfolioPnL,
    selectProfitablePositions,
    selectLosingPositions,
  ],
  (totalValue, totalPnL, profitablePositions, losingPositions) => ({
    totalValue,
    totalPnL,
    profitableCount: profitablePositions.length,
    losingCount: losingPositions.length,
    winRate:
      profitablePositions.length + losingPositions.length > 0
        ? (profitablePositions.length /
            (profitablePositions.length + losingPositions.length)) *
          100
        : 0,
  })
);

// Memoized system selectors
export const selectSystemData = createSelector(
  [selectSystem],
  (system) => system
);

export const selectSystemStatus = createSelector(
  [selectSystem],
  (system) => system.status
);

export const selectSystemConnections = createSelector(
  [selectSystem],
  (system) => ({
    websocket: system.connected, // TODO: Add websocketConnected to SystemState
    api: system.connected, // TODO: Add apiConnected to SystemState
    exchange: system.connected, // TODO: Add exchangeConnected to SystemState
  })
);

// Complex memoized selectors
export const selectDashboardSummary = createSelector(
  [selectPortfolioMetrics, selectSystemConnections, selectMarketStatus],
  (portfolioMetrics, connections, marketStatus) => ({
    portfolio: portfolioMetrics,
    connections,
    marketStatus,
    isHealthy:
      connections.websocket && connections.api && marketStatus === "OPEN",
  })
);

// Performance-critical selectors with additional memoization
export const selectFilteredPositions = createSelector(
  [
    selectPortfolioPositions,
    (state: RootState, filters: { symbol?: string; profitable?: boolean }) =>
      filters,
  ],
  (positions, filters) => {
    let filtered = positions;

    if (filters.symbol) {
      filtered = filtered.filter((position) =>
        position.symbol.toLowerCase().includes(filters.symbol!.toLowerCase())
      );
    }

    if (filters.profitable !== undefined) {
      filtered = filtered.filter((position) =>
        filters.profitable
          ? position.unrealizedPnL > 0
          : position.unrealizedPnL <= 0
      );
    }

    return filtered;
  }
);

export const selectSortedPositions = createSelector(
  [
    selectPortfolioPositions,
    (state: RootState, sortBy: "symbol" | "value" | "pnl" | "pnlPercent") =>
      sortBy,
    (state: RootState, sortBy: string, sortOrder: "asc" | "desc") => sortOrder,
  ],
  (positions, sortBy, sortOrder) => {
    const sorted = [...positions].sort((a, b) => {
      let aValue: any, bValue: any;

      switch (sortBy) {
        case "symbol":
          aValue = a.symbol;
          bValue = b.symbol;
          break;
        case "value":
          aValue = a.quantity * a.currentPrice;
          bValue = b.quantity * b.currentPrice;
          break;
        case "pnl":
          aValue = a.unrealizedPnL;
          bValue = b.unrealizedPnL;
          break;
        case "pnlPercent":
          aValue =
            a.entryPrice > 0
              ? ((a.currentPrice - a.entryPrice) / a.entryPrice) * 100
              : 0;
          bValue =
            b.entryPrice > 0
              ? ((b.currentPrice - b.entryPrice) / b.entryPrice) * 100
              : 0;
          break;
        default:
          aValue = a.quantity * a.currentPrice;
          bValue = b.quantity * b.currentPrice;
      }

      if (typeof aValue === "string") {
        return sortOrder === "asc"
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue);
      }

      return sortOrder === "asc" ? aValue - bValue : bValue - aValue;
    });

    return sorted;
  }
);

// Selector factory for creating parameterized selectors
export const createPositionSelector = (positionId: string) =>
  createSelector([selectPortfolioPositions], (positions) =>
    positions.find((position) => position.id === positionId)
  );

// Selector for performance analytics
export const selectPerformanceAnalytics = createSelector(
  [selectPortfolioPositions],
  (positions) => {
    if (positions.length === 0) {
      return {
        totalPositions: 0,
        averagePosition: 0,
        largestPosition: null,
        smallestPosition: null,
        diversificationScore: 0,
      };
    }

    const values = positions.map((p) => p.quantity * p.currentPrice);
    const totalValue = values.reduce((sum, value) => sum + value, 0);
    const averagePosition = totalValue / positions.length;
    const largestPosition = positions.reduce((largest, current) => {
      const currentValue = current.quantity * current.currentPrice;
      const largestValue = largest.quantity * largest.currentPrice;
      return currentValue > largestValue ? current : largest;
    });
    const smallestPosition = positions.reduce((smallest, current) => {
      const currentValue = current.quantity * current.currentPrice;
      const smallestValue = smallest.quantity * smallest.currentPrice;
      return currentValue < smallestValue ? current : smallest;
    });

    // Simple diversification score based on position size distribution
    const variance =
      values.reduce(
        (sum, value) => sum + Math.pow(value - averagePosition, 2),
        0
      ) / positions.length;
    const standardDeviation = Math.sqrt(variance);
    const diversificationScore = Math.max(
      0,
      100 - (standardDeviation / averagePosition) * 100
    );

    return {
      totalPositions: positions.length,
      averagePosition,
      largestPosition,
      smallestPosition,
      diversificationScore: Math.round(diversificationScore),
    };
  }
);
