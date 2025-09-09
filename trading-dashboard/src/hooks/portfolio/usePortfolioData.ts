/**
 * @fileoverview Custom hook for managing portfolio data, performance metrics, and position analytics.
 *
 * This hook provides comprehensive portfolio management functionality including:
 * - Real-time portfolio data fetching and caching
 * - Performance metrics calculation
 * - Position analytics and insights
 * - Auto-refresh capabilities
 * - Error handling and loading states
 *
 * @example
 * ```tsx
 * import { usePortfolioData } from './hooks/portfolio/usePortfolioData';
 *
 * function PortfolioComponent() {
 *   const {
 *     portfolio,
 *     performanceData,
 *     loading,
 *     error,
 *     totalPnL,
 *     profitablePositions,
 *     refresh,
 *     closePosition
 *   } = usePortfolioData({
 *     autoRefresh: true,
 *     refreshInterval: 30000
 *   });
 *
 *   if (loading) return <LoadingSpinner />;
 *   if (error) return <ErrorMessage error={error} />;
 *
 *   return (
 *     <div>
 *       <h2>Portfolio Value: ${portfolio.totalValue.toLocaleString()}</h2>
 *       <p>Total P&L: ${totalPnL.toLocaleString()}</p>
 *       <p>Profitable Positions: {profitablePositions.length}</p>
 *     </div>
 *   );
 * }
 * ```
 */

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Portfolio,
  Position,
  TradeDirection,
  PositionStatus,
} from "../../types";
import { api } from "../../services/api/tradingApi";

/**
 * Represents a single data point in portfolio performance history
 *
 * @interface PerformanceDataPoint
 */
interface PerformanceDataPoint {
  /** ISO date string for the data point */
  date: string;
  /** Portfolio value at this point in time */
  value: number;
  /** Absolute change from previous data point */
  change: number;
  /** Percentage change from previous data point */
  changePercent: number;
}

/**
 * Configuration options for the usePortfolioData hook
 *
 * @interface UsePortfolioDataOptions
 */
interface UsePortfolioDataOptions {
  /** Enable automatic data refresh */
  autoRefresh?: boolean;
  /** Refresh interval in milliseconds (default: 30000ms) */
  refreshInterval?: number;
}

/**
 * Return type for the usePortfolioData hook
 *
 * @interface UsePortfolioDataReturn
 */
interface UsePortfolioDataReturn {
  // Portfolio data
  /** Current portfolio data including positions and cash */
  portfolio: Portfolio;
  /** Historical performance data points for charting */
  performanceData: PerformanceDataPoint[];

  // State
  /** Loading state indicator */
  loading: boolean;
  /** Error message if data fetching fails */
  error: string | null;

  // Actions
  /** Manually refresh portfolio data */
  refresh: () => void;
  /** Close a specific position by ID */
  closePosition: (positionId: string) => Promise<void>;

  // Performance metrics
  /** Total unrealized profit/loss across all positions */
  totalPnL: number;
  /** Total P&L as percentage of total cost basis */
  totalPnLPercentage: number;
  /** Today's portfolio value change */
  dayChange: number;
  /** Today's portfolio change as percentage */
  dayChangePercentage: number;

  // Position analytics
  /** Array of positions with positive P&L */
  profitablePositions: Position[];
  /** Array of positions with negative P&L */
  losingPositions: Position[];
  /** Position with highest current value */
  largestPosition: Position | null;
  /** Position with lowest current value */
  smallestPosition: Position | null;
}

/**
 * Fetch real performance data from API
 */
const fetchPerformanceData = async (): Promise<PerformanceDataPoint[]> => {
  try {
    const response = await api.portfolio.getPerformanceHistory();
    return response.map((point: unknown) => ({
      date: point.date,
      value: point.value,
      change: point.change,
      changePercent: point.changePercent,
    }));
  } catch (error) {
    console.error("Failed to fetch performance data:", error);
    return [];
  }
};

/**
 * Custom hook for comprehensive portfolio data management and analytics.
 *
 * This hook provides a complete solution for managing portfolio data including:
 * - Real-time data fetching with auto-refresh capabilities
 * - Performance metrics calculation (P&L, returns, analytics)
 * - Position management (close positions, analytics)
 * - Error handling and loading states
 * - Memoized calculations for optimal performance
 *
 * @hook
 * @param {UsePortfolioDataOptions} [options={}] - Configuration options for the hook
 * @param {boolean} [options.autoRefresh=true] - Enable automatic data refresh
 * @param {number} [options.refreshInterval=30000] - Refresh interval in milliseconds
 *
 * @returns {UsePortfolioDataReturn} Object containing portfolio data, state, actions, and analytics
 *
 * @example
 * ```tsx
 * // Basic usage with default options
 * const { portfolio, loading, error } = usePortfolioData();
 *
 * // With custom refresh settings
 * const portfolioData = usePortfolioData({
 *   autoRefresh: true,
 *   refreshInterval: 60000 // Refresh every minute
 * });
 *
 * // Using analytics data
 * const { totalPnL, profitablePositions, largestPosition } = usePortfolioData();
 * console.log(`Total P&L: $${totalPnL.toLocaleString()}`);
 * console.log(`Profitable positions: ${profitablePositions.length}`);
 *
 * // Handling position closure
 * const { closePosition } = usePortfolioData();
 * const handleClose = async (positionId: string) => {
 *   try {
 *     await closePosition(positionId);
 *     console.log('Position closed successfully');
 *   } catch (error) {
 *     console.error('Failed to close position:', error);
 *   }
 * };
 * ```
 *
 * @since 1.0.0
 */
export const usePortfolioData = (
  options: UsePortfolioDataOptions = {}
): UsePortfolioDataReturn => {
  const { autoRefresh = true, refreshInterval = 30000 } = options;

  const [portfolio, setPortfolio] = useState<Portfolio>({
    totalValue: 0,
    totalCost: 0,
    availableBalance: 0,
    availableCash: 0,
    positions: [],
    dailyPnL: 0,
    totalPnL: 0,
    maxDrawdown: 0,
    lastUpdated: new Date(),
    dayChange: 0,
    dayChangePercent: 0,
  });
  const [performanceData, setPerformanceData] = useState<
    PerformanceDataPoint[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // Fetch real portfolio data from backend API
      const portfolioData = await api.portfolio.getPortfolio();

      // Transform API response to match our Portfolio interface
      const transformedPortfolio: Portfolio = {
        totalValue: portfolioData.totalValue,
        totalCost: portfolioData.positions.reduce(
          (sum, pos) => sum + pos.entryPrice * pos.quantity,
          0
        ),
        availableBalance: portfolioData.availableBalance,
        availableCash: portfolioData.availableBalance,
        positions: portfolioData.positions.map((pos) => ({
          id: pos.id,
          symbol: pos.symbol,
          direction: pos.direction as TradeDirection,
          quantity: pos.quantity,
          entryPrice: pos.entryPrice,
          currentPrice: pos.currentPrice,
          unrealizedPnL: pos.unrealizedPnL,
          realizedPnL: pos.realizedPnL || 0,
          stopLoss: pos.stopLoss,
          takeProfitLevels: pos.takeProfitLevels,
          status: pos.status as PositionStatus,
          createdAt: new Date(pos.createdAt),
          updatedAt: new Date(pos.updatedAt),
        })),
        dailyPnL: portfolioData.dailyPnL,
        totalPnL: portfolioData.totalPnL,
        maxDrawdown: portfolioData.maxDrawdown,
        lastUpdated: new Date(portfolioData.lastUpdated),
        dayChange: portfolioData.dailyPnL,
        dayChangePercent:
          portfolioData.totalValue > 0
            ? (portfolioData.dailyPnL / portfolioData.totalValue) * 100
            : 0,
      };

      setPortfolio(transformedPortfolio);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to refresh portfolio data"
      );
      // Set empty portfolio when API fails instead of showing mock data
      setPortfolio({
        totalValue: 0,
        totalCost: 0,
        availableBalance: 0,
        availableCash: 0,
        positions: [],
        dailyPnL: 0,
        totalPnL: 0,
        maxDrawdown: 0,
        lastUpdated: new Date(),
        dayChange: 0,
        dayChangePercent: 0,
      });
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial data fetch
  useEffect(() => {
    refresh();
  }, [refresh]);

  // Fetch performance data when portfolio changes
  useEffect(() => {
    const loadPerformanceData = async () => {
      const data = await fetchPerformanceData();
      setPerformanceData(data);
    };

    if (portfolio.totalValue > 0) {
      loadPerformanceData();
    }
  }, [portfolio]);

  // Auto-refresh functionality
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      refresh();
    }, refreshInterval);

    return () => clearInterval(interval);
  }, [autoRefresh, refresh, refreshInterval]);

  const closePosition = useCallback(
    async (positionId: string) => {
      setLoading(true);
      setError(null);

      try {
        // Call real API to close position
        await api.portfolio.closePosition(positionId);

        // Refresh portfolio data to get updated state
        await refresh();
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to close position"
        );
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [refresh]
  );

  // Calculated metrics
  const totalPnL = useMemo(() => {
    return portfolio.totalValue - (portfolio.totalCost ?? 0);
  }, [portfolio.totalValue, portfolio.totalCost]);

  const totalPnLPercentage = useMemo(() => {
    return (portfolio.totalCost ?? 0) > 0
      ? (totalPnL / (portfolio.totalCost ?? 1)) * 100
      : 0;
  }, [totalPnL, portfolio.totalCost]);

  const dayChange = useMemo(() => {
    return portfolio.dayChange || 0;
  }, [portfolio.dayChange]);

  const dayChangePercentage = useMemo(() => {
    return portfolio.dayChangePercent || 0;
  }, [portfolio.dayChangePercent]);

  // Position analytics
  const profitablePositions = useMemo(() => {
    return portfolio.positions.filter((pos) => pos.unrealizedPnL > 0);
  }, [portfolio.positions]);

  const losingPositions = useMemo(() => {
    return portfolio.positions.filter((pos) => pos.unrealizedPnL < 0);
  }, [portfolio.positions]);

  const largestPosition = useMemo(() => {
    if (portfolio.positions.length === 0) return null;
    return portfolio.positions.reduce((largest, current) => {
      const currentValue = current.quantity * current.currentPrice;
      const largestValue = largest.quantity * largest.currentPrice;
      return currentValue > largestValue ? current : largest;
    });
  }, [portfolio.positions]);

  const smallestPosition = useMemo(() => {
    if (portfolio.positions.length === 0) return null;
    return portfolio.positions.reduce((smallest, current) => {
      const currentValue = current.quantity * current.currentPrice;
      const smallestValue = smallest.quantity * smallest.currentPrice;
      return currentValue < smallestValue ? current : smallest;
    });
  }, [portfolio.positions]);

  return {
    // Portfolio data
    portfolio,
    performanceData,

    // State
    loading,
    error,

    // Actions
    refresh,
    closePosition,

    // Performance metrics
    totalPnL,
    totalPnLPercentage,
    dayChange,
    dayChangePercentage,

    // Position analytics
    profitablePositions,
    losingPositions,
    largestPosition,
    smallestPosition,
  };
};

export default usePortfolioData;
