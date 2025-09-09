/**
 * Custom hook for managing performance metrics data
 */

import { useState, useEffect, useMemo } from "react";
import { PerformanceMetrics, Trade } from "../../types";

interface UsePerformanceMetricsOptions {
  timeRange?: string;
  refreshInterval?: number;
}

interface UsePerformanceMetricsReturn {
  metrics: PerformanceMetrics | null;
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

/**
 * Calculate performance metrics from trades data
 */
const calculateMetrics = (trades: Trade[]): PerformanceMetrics => {
  if (trades.length === 0) {
    return {
      totalReturn: 0,
      dailyPnL: 0,
      winRate: 0,
      totalTrades: 0,
      sharpeRatio: 0,
      maxDrawdown: 0,
      volatility: 0,
      avgTradeReturn: 0,
    };
  }

  const totalPnL = trades.reduce((sum, trade) => sum + trade.realizedPnL, 0);
  const winningTrades = trades.filter((trade) => trade.realizedPnL > 0);
  const winRate = (winningTrades.length / trades.length) * 100;

  // Calculate daily P&L (trades from today)
  const today = new Date().toISOString().split("T")[0];
  const todayTrades = trades.filter(
    (trade) => trade.exitTime.toISOString().split("T")[0] === today
  );
  const dailyPnL = todayTrades.reduce(
    (sum, trade) => sum + trade.realizedPnL,
    0
  );

  // Calculate returns for each trade
  const returns = trades.map(
    (trade) => (trade.realizedPnL / (trade.entryPrice * trade.quantity)) * 100
  );

  const totalReturn = returns.reduce((sum, ret) => sum + ret, 0);
  const avgTradeReturn = totalReturn / trades.length;

  // Calculate volatility (standard deviation of returns)
  const meanReturn = avgTradeReturn;
  const variance =
    returns.reduce((sum, ret) => sum + Math.pow(ret - meanReturn, 2), 0) /
    returns.length;
  const volatility = Math.sqrt(variance);

  // Calculate Sharpe ratio (assuming risk-free rate of 2%)
  const riskFreeRate = 2;
  const sharpeRatio =
    volatility > 0 ? (avgTradeReturn - riskFreeRate) / volatility : 0;

  // Calculate maximum drawdown
  let peak = 0;
  let maxDrawdown = 0;
  let runningPnL = 0;

  trades.forEach((trade) => {
    runningPnL += trade.realizedPnL;
    if (runningPnL > peak) {
      peak = runningPnL;
    }
    const drawdown = ((runningPnL - peak) / Math.max(peak, 1)) * 100;
    if (drawdown < maxDrawdown) {
      maxDrawdown = drawdown;
    }
  });

  return {
    totalReturn,
    dailyPnL,
    winRate,
    totalTrades: trades.length,
    sharpeRatio,
    maxDrawdown,
    volatility,
    avgTradeReturn,
  };
};

/**
 * Hook for managing performance metrics
 */
export const usePerformanceMetrics = (
  trades: Trade[],
  options: UsePerformanceMetricsOptions = {}
): UsePerformanceMetricsReturn => {
  const { timeRange = "all", refreshInterval } = options;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filter trades based on time range
  const filteredTrades = useMemo(() => {
    if (timeRange === "all") return trades;

    const now = new Date();
    const cutoffDate = new Date();

    switch (timeRange) {
      case "1d":
        cutoffDate.setDate(now.getDate() - 1);
        break;
      case "7d":
        cutoffDate.setDate(now.getDate() - 7);
        break;
      case "30d":
        cutoffDate.setDate(now.getDate() - 30);
        break;
      case "90d":
        cutoffDate.setDate(now.getDate() - 90);
        break;
      case "1y":
        cutoffDate.setFullYear(now.getFullYear() - 1);
        break;
      default:
        return trades;
    }

    return trades.filter((trade) => new Date(trade.exitTime) >= cutoffDate);
  }, [trades, timeRange]);

  // Calculate metrics
  const metrics = useMemo(() => {
    try {
      setError(null);
      return calculateMetrics(filteredTrades);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to calculate metrics"
      );
      return null;
    }
  }, [filteredTrades]);

  // Refresh function
  const refresh = () => {
    setLoading(true);
    // Simulate async operation
    setTimeout(() => {
      setLoading(false);
    }, 100);
  };

  // Auto-refresh if interval is set
  useEffect(() => {
    if (refreshInterval && refreshInterval > 0) {
      const interval = setInterval(refresh, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [refreshInterval]);

  return {
    metrics,
    loading,
    error,
    refresh,
  };
};

export default usePerformanceMetrics;
