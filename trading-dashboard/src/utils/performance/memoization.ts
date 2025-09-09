/**
 * @fileoverview Performance optimization utilities for memoization and expensive calculations.
 *
 * This module provides a comprehensive set of utilities for optimizing React component performance:
 * - Custom hooks for expensive calculations with debugging
 * - Stable callback references to prevent unnecessary re-renders
 * - Debounced and throttled callbacks for high-frequency events
 * - Memoization utilities for expensive calculations outside React
 * - Performance monitoring and measurement tools
 * - Trading-specific memoized calculations
 *
 * @example
 * ```tsx
 * import {
 *   useExpensiveMemo,
 *   useStableCallback,
 *   useDebouncedCallback,
 *   tradingCalculations
 * } from './utils/performance/memoization';
 *
 * function TradingComponent({ positions, trades }) {
 *   // Expensive calculation with debugging
 *   const portfolioMetrics = useExpensiveMemo(
 *     () => calculateComplexMetrics(positions),
 *     [positions],
 *     'portfolio-metrics'
 *   );
 *
 *   // Stable callback to prevent child re-renders
 *   const handlePositionClick = useStableCallback((position) => {
 *     onPositionSelect(position);
 *   }, [onPositionSelect]);
 *
 *   // Debounced search to reduce API calls
 *   const handleSearch = useDebouncedCallback((query) => {
 *     searchPositions(query);
 *   }, 300, [searchPositions]);
 *
 *   // Memoized trading calculation
 *   const totalPnL = tradingCalculations.calculatePnL(positions);
 *
 *   return (
 *     <div>
 *       <SearchInput onChange={handleSearch} />
 *       <PortfolioSummary metrics={portfolioMetrics} />
 *       <PositionsList positions={positions} onPositionClick={handlePositionClick} />
 *     </div>
 *   );
 * }
 * ```
 *
 * @since 1.0.0
 */

import { useMemo, useCallback, useRef, useEffect } from "react";

/**
 * Custom hook for memoizing expensive calculations with performance debugging.
 *
 * This hook extends React's useMemo with performance monitoring capabilities.
 * In development mode, it logs warnings for calculations that take longer than 10ms.
 *
 * @template T - The type of the memoized value
 * @param {() => T} factory - Function that performs the expensive calculation
 * @param {React.DependencyList} deps - Dependencies array for memoization
 * @param {string} [debugName] - Optional name for performance debugging logs
 * @returns {T} The memoized result of the factory function
 *
 * @example
 * ```tsx
 * const expensiveResult = useExpensiveMemo(
 *   () => {
 *     // Expensive calculation here
 *     return positions.reduce((acc, pos) => acc + calculateMetrics(pos), {});
 *   },
 *   [positions],
 *   'portfolio-metrics'
 * );
 * ```
 *
 * @since 1.0.0
 */
export const useExpensiveMemo = <T>(
  factory: () => T,
  deps: React.DependencyList,
  debugName?: string
): T => {
  const startTime = useRef<number | undefined>(undefined);

  return useMemo(() => {
    if (debugName && process.env.NODE_ENV === "development") {
      startTime.current = performance.now();
    }

    const result = factory();

    if (
      debugName &&
      process.env.NODE_ENV === "development" &&
      startTime.current
    ) {
      const endTime = performance.now();
      const duration = endTime - startTime.current;
      if (duration > 10) {
        // Log if calculation takes more than 10ms
        console.log(
          `🐌 Expensive calculation "${debugName}" took ${duration.toFixed(2)}ms`
        );
      }
    }

    return result;
  }, deps);
};

/**
 * Custom hook for memoizing callbacks with stable references
 */
export const useStableCallback = <T extends (...args: any[]) => any>(
  callback: T,
  deps: React.DependencyList
): T => {
  return useCallback(callback, deps);
};

/**
 * Custom hook for debounced callbacks
 */
export const useDebouncedCallback = <T extends (...args: any[]) => any>(
  callback: T,
  delay: number,
  deps: React.DependencyList
): T => {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  return useCallback(
    ((...args: Parameters<T>) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      timeoutRef.current = setTimeout(() => {
        callback(...args);
      }, delay);
    }) as T,
    [...deps, delay]
  );
};

/**
 * Custom hook for throttled callbacks
 */
export const useThrottledCallback = <T extends (...args: any[]) => any>(
  callback: T,
  delay: number,
  deps: React.DependencyList
): T => {
  const lastCallRef = useRef<number>(0);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  return useCallback(
    ((...args: Parameters<T>) => {
      const now = Date.now();
      const timeSinceLastCall = now - lastCallRef.current;

      if (timeSinceLastCall >= delay) {
        lastCallRef.current = now;
        callback(...args);
      } else {
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        }

        timeoutRef.current = setTimeout(() => {
          lastCallRef.current = Date.now();
          callback(...args);
        }, delay - timeSinceLastCall);
      }
    }) as T,
    [...deps, delay]
  );
};

/**
 * Memoization utility for expensive calculations outside of React components
 */
class MemoCache<K, V> {
  private cache = new Map<string, { value: V; timestamp: number }>();
  private maxSize: number;
  private ttl: number; // Time to live in milliseconds

  constructor(maxSize = 100, ttl = 5 * 60 * 1000) {
    // Default 5 minutes TTL
    this.maxSize = maxSize;
    this.ttl = ttl;
  }

  private getKey(key: K): string {
    return typeof key === "string" ? key : JSON.stringify(key);
  }

  private isExpired(timestamp: number): boolean {
    return Date.now() - timestamp > this.ttl;
  }

  private evictExpired(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (this.isExpired(entry.timestamp)) {
        this.cache.delete(key);
      }
    }
  }

  private evictOldest(): void {
    if (this.cache.size >= this.maxSize) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) {
        this.cache.delete(oldestKey);
      }
    }
  }

  get(key: K): V | undefined {
    const keyStr = this.getKey(key);
    const entry = this.cache.get(keyStr);

    if (!entry) return undefined;

    if (this.isExpired(entry.timestamp)) {
      this.cache.delete(keyStr);
      return undefined;
    }

    return entry.value;
  }

  set(key: K, value: V): void {
    this.evictExpired();
    this.evictOldest();

    const keyStr = this.getKey(key);
    this.cache.set(keyStr, {
      value,
      timestamp: Date.now(),
    });
  }

  has(key: K): boolean {
    return this.get(key) !== undefined;
  }

  clear(): void {
    this.cache.clear();
  }

  size(): number {
    this.evictExpired();
    return this.cache.size;
  }
}

/**
 * Create a memoized function with caching
 */
export const createMemoizedFunction = <Args extends any[], Return>(
  fn: (...args: Args) => Return,
  options: {
    maxSize?: number;
    ttl?: number;
    keyGenerator?: (...args: Args) => string;
  } = {}
): ((...args: Args) => Return) => {
  const cache = new MemoCache<string, Return>(options.maxSize, options.ttl);
  const keyGenerator =
    options.keyGenerator || ((...args: Args) => JSON.stringify(args));

  return (...args: Args): Return => {
    const key = keyGenerator(...args);

    if (cache.has(key)) {
      return cache.get(key)!;
    }

    const result = fn(...args);
    cache.set(key, result);
    return result;
  };
};

/**
 * Performance monitoring utilities
 */
export class PerformanceMonitor {
  private static measurements = new Map<string, number[]>();

  static startMeasurement(name: string): () => void {
    const startTime = performance.now();

    return () => {
      const endTime = performance.now();
      const duration = endTime - startTime;

      if (!this.measurements.has(name)) {
        this.measurements.set(name, []);
      }

      const measurements = this.measurements.get(name)!;
      measurements.push(duration);

      // Keep only last 100 measurements
      if (measurements.length > 100) {
        measurements.shift();
      }

      if (process.env.NODE_ENV === "development") {
        console.log(`⏱️ ${name}: ${duration.toFixed(2)}ms`);
      }
    };
  }

  static getStats(name: string): {
    count: number;
    average: number;
    min: number;
    max: number;
    latest: number;
  } | null {
    const measurements = this.measurements.get(name);
    if (!measurements || measurements.length === 0) {
      return null;
    }

    const count = measurements.length;
    const sum = measurements.reduce((a, b) => a + b, 0);
    const average = sum / count;
    const min = Math.min(...measurements);
    const max = Math.max(...measurements);
    const latest = measurements[measurements.length - 1];

    return { count, average, min, max, latest };
  }

  static getAllStats(): Record<
    string,
    ReturnType<typeof PerformanceMonitor.getStats>
  > {
    const stats: Record<
      string,
      ReturnType<typeof PerformanceMonitor.getStats>
    > = {};

    for (const [name] of this.measurements) {
      stats[name] = this.getStats(name);
    }

    return stats;
  }

  static clear(name?: string): void {
    if (name) {
      this.measurements.delete(name);
    } else {
      this.measurements.clear();
    }
  }
}

/**
 * Hook for performance monitoring
 */
export const usePerformanceMonitor = (name: string, enabled = true) => {
  const endMeasurementRef = useRef<(() => void) | null>(null);

  const startMeasurement = useCallback(() => {
    if (!enabled) return;
    endMeasurementRef.current = PerformanceMonitor.startMeasurement(name);
  }, [name, enabled]);

  const endMeasurement = useCallback(() => {
    if (endMeasurementRef.current) {
      endMeasurementRef.current();
      endMeasurementRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      // Cleanup on unmount
      if (endMeasurementRef.current) {
        endMeasurementRef.current();
      }
    };
  }, []);

  return { startMeasurement, endMeasurement };
};

/**
 * Trading-specific memoized calculations
 */
export const tradingCalculations = {
  // Memoized P&L calculation
  calculatePnL: createMemoizedFunction(
    (
      positions: Array<{
        quantity: number;
        averagePrice: number;
        currentPrice: number;
      }>
    ) => {
      return positions.reduce((total, position) => {
        return (
          total +
          (position.currentPrice - position.averagePrice) * position.quantity
        );
      }, 0);
    },
    { maxSize: 50, ttl: 30000 } // Cache for 30 seconds
  ),

  // Memoized portfolio value calculation
  calculatePortfolioValue: createMemoizedFunction(
    (
      positions: Array<{ quantity: number; currentPrice: number }>,
      cash: number
    ) => {
      const positionsValue = positions.reduce((total, position) => {
        return total + position.quantity * position.currentPrice;
      }, 0);
      return positionsValue + cash;
    },
    { maxSize: 50, ttl: 30000 }
  ),

  // Memoized performance metrics calculation
  calculatePerformanceMetrics: createMemoizedFunction(
    (trades: Array<{ pnl: number; entryDate: string; exitDate: string }>) => {
      if (trades.length === 0) {
        return {
          totalPnL: 0,
          winRate: 0,
          averageWin: 0,
          averageLoss: 0,
          sharpeRatio: 0,
          maxDrawdown: 0,
        };
      }

      const totalPnL = trades.reduce((sum, trade) => sum + trade.pnl, 0);
      const winningTrades = trades.filter((trade) => trade.pnl > 0);
      const losingTrades = trades.filter((trade) => trade.pnl < 0);

      const winRate = (winningTrades.length / trades.length) * 100;
      const averageWin =
        winningTrades.length > 0
          ? winningTrades.reduce((sum, trade) => sum + trade.pnl, 0) /
            winningTrades.length
          : 0;
      const averageLoss =
        losingTrades.length > 0
          ? Math.abs(
              losingTrades.reduce((sum, trade) => sum + trade.pnl, 0) /
                losingTrades.length
            )
          : 0;

      // Simplified Sharpe ratio calculation
      const returns = trades.map((trade) => trade.pnl);
      const avgReturn =
        returns.reduce((sum, ret) => sum + ret, 0) / returns.length;
      const variance =
        returns.reduce((sum, ret) => sum + Math.pow(ret - avgReturn, 2), 0) /
        returns.length;
      const stdDev = Math.sqrt(variance);
      const sharpeRatio = stdDev > 0 ? avgReturn / stdDev : 0;

      // Simplified max drawdown calculation
      let peak = 0;
      let maxDrawdown = 0;
      let runningPnL = 0;

      for (const trade of trades) {
        runningPnL += trade.pnl;
        if (runningPnL > peak) {
          peak = runningPnL;
        }
        const drawdown = peak - runningPnL;
        if (drawdown > maxDrawdown) {
          maxDrawdown = drawdown;
        }
      }

      return {
        totalPnL,
        winRate,
        averageWin,
        averageLoss,
        sharpeRatio,
        maxDrawdown,
      };
    },
    { maxSize: 20, ttl: 60000 } // Cache for 1 minute
  ),
};
