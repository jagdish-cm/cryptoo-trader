/**
 * Custom hook for trading configuration management
 */

import { useMemo } from "react";
import { useGetTradingConfigQuery } from "../../../store/api/tradingApi";

export interface TradingConfigData {
  autoTrading: boolean;
  maxPositions: number;
  riskPerTrade: number;
  emergencyStop: boolean;
  allowedSymbols: string[];
}

export interface UseTradingConfigReturn {
  config: TradingConfigData;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

/**
 * Hook for managing trading configuration
 */
export const useTradingConfig = (): UseTradingConfigReturn => {
  const {
    data: tradingConfig,
    isLoading: configLoading,
    error: configError,
    refetch,
  } = useGetTradingConfigQuery();

  const config = useMemo(
    (): TradingConfigData => ({
      autoTrading: tradingConfig?.autoTrading ?? false,
      maxPositions: tradingConfig?.maxPositions ?? 10,
      riskPerTrade: tradingConfig?.riskPerTrade ?? 2,
      emergencyStop: tradingConfig?.emergencyStop ?? false,
      allowedSymbols: tradingConfig?.allowedSymbols ?? ["BTC/USDT", "ETH/USDT"],
    }),
    [tradingConfig]
  );

  return {
    config,
    loading: configLoading,
    error: configError ? String(configError) : null,
    refetch,
  };
};

export default useTradingConfig;
