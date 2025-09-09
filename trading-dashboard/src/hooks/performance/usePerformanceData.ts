/**
 * Custom hook for managing performance data
 */

import { useState, useEffect, useCallback } from "react";
import { PerformanceMetrics, Trade } from "../../types";
import { api } from "../../services/api/tradingApi";

interface UsePerformanceDataOptions {
  timeRange?: string;
  autoRefresh?: boolean;
  refreshInterval?: number;
}

interface UsePerformanceDataReturn {
  metrics: PerformanceMetrics | null;
  trades: Trade[];
  loading: boolean;
  error: string | null;
  refresh: () => void;
  setTimeRange: (range: string) => void;
  timeRange: string;
}

export const usePerformanceData = (
  options: UsePerformanceDataOptions = {}
): UsePerformanceDataReturn => {
  const {
    timeRange: initialTimeRange = "30d",
    autoRefresh = false,
    refreshInterval = 30000, // 30 seconds
  } = options;

  const [metrics, setMetrics] = useState<PerformanceMetrics | null>(null);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState(initialTimeRange);

  const fetchPerformanceData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch real performance metrics and trade history from backend API
      const [performanceMetrics, tradeHistoryResponse] = await Promise.all([
        api.analytics.getPerformanceMetrics(timeRange),
        api.trading.getTradeHistory(200, 0), // Get more trades for better analysis
      ]);

      // Transform API trade data to match our Trade interface
      const transformedTrades: Trade[] = tradeHistoryResponse.trades.map(
        (trade) => ({
          id: trade.id,
          positionId: trade.positionId,
          symbol: trade.symbol,
          direction: trade.direction,
          quantity: trade.quantity,
          entryPrice: trade.entryPrice,
          exitPrice: trade.exitPrice,
          entryTime: new Date(trade.entryTime),
          exitTime: new Date(trade.exitTime),
          realizedPnL: trade.realizedPnL,
          fees: trade.fees,
          setupType: trade.setupType || "Unknown",
          exitReason: trade.exitReason,
        })
      );

      // Filter trades based on time range
      const now = new Date();
      const filteredTrades = transformedTrades.filter((trade) => {
        const tradeDate = new Date(trade.exitTime);
        const daysDiff = Math.floor(
          (now.getTime() - tradeDate.getTime()) / (1000 * 60 * 60 * 24)
        );

        switch (timeRange) {
          case "1d":
            return daysDiff <= 1;
          case "7d":
            return daysDiff <= 7;
          case "30d":
            return daysDiff <= 30;
          case "90d":
            return daysDiff <= 90;
          case "1y":
            return daysDiff <= 365;
          case "all":
            return true;
          default:
            return daysDiff <= 30;
        }
      });

      // Use real performance metrics from API
      const realMetrics: PerformanceMetrics = {
        totalReturn: performanceMetrics.totalReturn,
        dailyPnL:
          performanceMetrics.totalTrades > 0
            ? filteredTrades
                .filter((trade) => {
                  const today = new Date().toISOString().split("T")[0];
                  return trade.exitTime.toISOString().split("T")[0] === today;
                })
                .reduce((sum, trade) => sum + trade.realizedPnL, 0)
            : 0,
        winRate: performanceMetrics.winRate,
        totalTrades: filteredTrades.length,
        sharpeRatio: performanceMetrics.sharpeRatio,
        maxDrawdown: performanceMetrics.maxDrawdown,
        volatility: 0, // Calculate from trades if needed
        avgTradeReturn: performanceMetrics.avgTradeReturn,
      };

      setMetrics(realMetrics);
      setTrades(filteredTrades);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to fetch performance data"
      );
      // Set empty data when API fails instead of showing mock data
      setMetrics({
        totalReturn: 0,
        dailyPnL: 0,
        winRate: 0,
        totalTrades: 0,
        sharpeRatio: 0,
        maxDrawdown: 0,
        volatility: 0,
        avgTradeReturn: 0,
      });
      setTrades([]);
    } finally {
      setLoading(false);
    }
  }, [timeRange]);

  useEffect(() => {
    fetchPerformanceData();
  }, [fetchPerformanceData]);

  // Auto-refresh if enabled
  useEffect(() => {
    if (autoRefresh && refreshInterval > 0) {
      const interval = setInterval(fetchPerformanceData, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [autoRefresh, refreshInterval, fetchPerformanceData]);

  const refresh = useCallback(() => {
    fetchPerformanceData();
  }, [fetchPerformanceData]);

  return {
    metrics,
    trades,
    loading,
    error,
    refresh,
    setTimeRange,
    timeRange,
  };
};
