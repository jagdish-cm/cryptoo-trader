/**
 * Custom hooks for trading data management
 */

import { useMemo } from "react";
import { useAppSelector } from "../../store/hooks";
import {
  useGetPositionsQuery,
  useGetSignalsQuery,
  useGetMarketDataQuery,
  useGetTradingConfigQuery,
} from "../../store/api/tradingApi";
import { RootState } from "../../store";
import { MarketData, Position, TradingSignal } from "../../types";

export interface TradingDataSummary {
  positions: {
    data: Position[];
    totalCount: number;
    openCount: number;
    totalUnrealizedPnL: number;
    bestPerformer: Position | null;
    worstPerformer: Position | null;
  };
  signals: {
    data: TradingSignal[];
    activeCount: number;
    avgConfidence: number;
    strongSignals: TradingSignal[];
  };
  marketData: {
    data: MarketData[];
    lastUpdated: Date | null;
    symbols: string[];
  };
  config: {
    autoTrading: boolean;
    maxPositions: number;
    riskPerTrade: number;
    emergencyStop: boolean;
  };
}

/**
 * Hook for comprehensive trading data
 */
export const useTradingData = (
  symbols: string[] = ["BTC/USDT", "ETH/USDT"]
) => {
  // API queries
  const {
    data: positionsData,
    isLoading: positionsLoading,
    error: positionsError,
  } = useGetPositionsQuery();
  const {
    data: signalsData,
    isLoading: signalsLoading,
    error: signalsError,
  } = useGetSignalsQuery();
  const {
    data: marketDataResponse,
    isLoading: marketLoading,
    error: marketError,
  } = useGetMarketDataQuery(symbols, {
    pollingInterval: 30000,
    refetchOnMountOrArgChange: true,
  });
  const {
    data: tradingConfig,
    isLoading: configLoading,
    error: configError,
  } = useGetTradingConfigQuery();

  // Redux state
  const recentTrades = useAppSelector(
    (state: RootState) => state.portfolio.recentTrades
  );

  const loading =
    positionsLoading || signalsLoading || marketLoading || configLoading;
  const error = positionsError || signalsError || marketError || configError;

  const tradingData = useMemo((): TradingDataSummary => {
    // Process positions
    const positions = positionsData || [];
    const openPositions = positions.filter((p) => p.status === "OPEN");
    const totalUnrealizedPnL = positions.reduce(
      (sum, p) => sum + p.unrealizedPnL,
      0
    );

    const sortedByPnL = [...positions].sort(
      (a, b) => b.unrealizedPnL - a.unrealizedPnL
    );
    const bestPerformer = sortedByPnL[0] || null;
    const worstPerformer = sortedByPnL[sortedByPnL.length - 1] || null;

    // Process signals
    const allSignals = signalsData?.active_signals || [];
    const strongSignals = allSignals.filter(
      (s) => s.strength === "STRONG" || s.strength === "VERY_STRONG"
    );
    const avgConfidence =
      allSignals.length > 0
        ? allSignals.reduce((sum, s) => sum + s.confidence, 0) /
          allSignals.length
        : 0;

    // Process market data
    const marketData: MarketData[] = marketDataResponse
      ? Object.entries(marketDataResponse).map(([symbol, data]) => ({
          ...data,
          symbol,
          timestamp: new Date(data.timestamp),
        }))
      : [];

    const lastUpdated =
      marketData.length > 0
        ? new Date(Math.max(...marketData.map((d) => d.timestamp.getTime())))
        : null;

    return {
      positions: {
        data: positions,
        totalCount: positions.length,
        openCount: openPositions.length,
        totalUnrealizedPnL,
        bestPerformer,
        worstPerformer,
      },
      signals: {
        data: allSignals,
        activeCount: allSignals.length,
        avgConfidence,
        strongSignals,
      },
      marketData: {
        data: marketData,
        lastUpdated,
        symbols,
      },
      config: {
        autoTrading: tradingConfig?.autoTrading ?? false,
        maxPositions: tradingConfig?.maxPositions ?? 10,
        riskPerTrade: tradingConfig?.riskPerTrade ?? 2,
        emergencyStop: tradingConfig?.emergencyStop ?? false,
      },
    };
  }, [positionsData, signalsData, marketDataResponse, tradingConfig, symbols]);

  return {
    data: tradingData,
    loading,
    error: error ? String(error) : null,
    recentTrades,
  };
};

/**
 * Hook for position management
 */
export const usePositionManagement = () => {
  const { data } = useTradingData();

  const positionsBySymbol = useMemo(() => {
    const grouped = data.positions.data.reduce(
      (acc, position) => {
        if (!acc[position.symbol]) {
          acc[position.symbol] = [];
        }
        acc[position.symbol].push(position);
        return acc;
      },
      {} as Record<string, Position[]>
    );

    return grouped;
  }, [data.positions.data]);

  const positionMetrics = useMemo(() => {
    const { data: positions } = data.positions;

    const longPositions = positions.filter((p) => p.direction === "LONG");
    const shortPositions = positions.filter((p) => p.direction === "SHORT");

    const profitablePositions = positions.filter((p) => p.unrealizedPnL > 0);
    const losingPositions = positions.filter((p) => p.unrealizedPnL < 0);

    return {
      longCount: longPositions.length,
      shortCount: shortPositions.length,
      profitableCount: profitablePositions.length,
      losingCount: losingPositions.length,
      avgPnL:
        positions.length > 0
          ? positions.reduce((sum, p) => sum + p.unrealizedPnL, 0) /
            positions.length
          : 0,
    };
  }, [data.positions.data]);

  return {
    positions: data.positions.data,
    positionsBySymbol,
    metrics: positionMetrics,
    summary: data.positions,
  };
};

/**
 * Hook for signal analysis
 */
export const useSignalAnalysis = () => {
  const { data } = useTradingData();

  const signalsByStrength = useMemo(() => {
    const grouped = data.signals.data.reduce(
      (acc, signal) => {
        if (!acc[signal.strength]) {
          acc[signal.strength] = [];
        }
        acc[signal.strength].push(signal);
        return acc;
      },
      {} as Record<string, TradingSignal[]>
    );

    return grouped;
  }, [data.signals.data]);

  const signalsBySymbol = useMemo(() => {
    const grouped = data.signals.data.reduce(
      (acc, signal) => {
        if (!acc[signal.symbol]) {
          acc[signal.symbol] = [];
        }
        acc[signal.symbol].push(signal);
        return acc;
      },
      {} as Record<string, TradingSignal[]>
    );

    return grouped;
  }, [data.signals.data]);

  const signalMetrics = useMemo(() => {
    const { data: signals } = data.signals;

    const longSignals = signals.filter((s) => s.direction === "LONG");
    const shortSignals = signals.filter((s) => s.direction === "SHORT");

    const highConfidenceSignals = signals.filter((s) => s.confidence > 0.8);
    const recentSignals = signals.filter((s) => {
      const signalTime = new Date(s.timestamp);
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      return signalTime > oneHourAgo;
    });

    return {
      longCount: longSignals.length,
      shortCount: shortSignals.length,
      highConfidenceCount: highConfidenceSignals.length,
      recentCount: recentSignals.length,
      avgConfidence: data.signals.avgConfidence,
    };
  }, [data.signals]);

  return {
    signals: data.signals.data,
    signalsByStrength,
    signalsBySymbol,
    metrics: signalMetrics,
    summary: data.signals,
  };
};
