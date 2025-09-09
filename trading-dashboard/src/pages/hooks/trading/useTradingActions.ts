/**
 * Custom hook for trading actions and mutations
 */

import { useCallback } from "react";
import {
  useClosePositionMutation,
  useUpdateTradingConfigMutation,
} from "../../../store/api/tradingApi";

export interface UseTradingActionsReturn {
  closePosition: (positionId: string) => Promise<void>;
  updateTradingConfig: (config: Partial<any>) => Promise<void>;
  executeSignal: (signalId: string) => void;
  toggleAutoTrading: (currentState: boolean) => Promise<void>;
  emergencyStop: () => Promise<void>;
  loading: {
    closePosition: boolean;
    updateConfig: boolean;
  };
  errors: {
    closePosition: string | null;
    updateConfig: string | null;
  };
}

/**
 * Hook for trading actions and mutations
 */
export const useTradingActions = (): UseTradingActionsReturn => {
  const [
    closePositionMutation,
    { isLoading: closePositionLoading, error: closePositionError },
  ] = useClosePositionMutation();
  const [
    updateConfigMutation,
    { isLoading: updateConfigLoading, error: updateConfigError },
  ] = useUpdateTradingConfigMutation();

  const closePosition = useCallback(
    async (positionId: string) => {
      try {
        await closePositionMutation(positionId).unwrap();
        console.log(`Position ${positionId} closed successfully`);
      } catch (error) {
        console.error("Failed to close position:", error);
        throw error;
      }
    },
    [closePositionMutation]
  );

  const updateTradingConfig = useCallback(
    async (config: Partial<any>) => {
      try {
        await updateConfigMutation(config).unwrap();
        console.log("Trading config updated successfully");
      } catch (error) {
        console.error("Failed to update trading config:", error);
        throw error;
      }
    },
    [updateConfigMutation]
  );

  const executeSignal = useCallback((signalId: string) => {
    console.log("Executing signal:", signalId);
    // Implementation would send execute signal request to backend
    // This would typically be another mutation
  }, []);

  const toggleAutoTrading = useCallback(
    async (currentState: boolean) => {
      try {
        await updateTradingConfig({ autoTrading: !currentState });
      } catch (error) {
        console.error("Failed to toggle auto trading:", error);
        throw error;
      }
    },
    [updateTradingConfig]
  );

  const emergencyStop = useCallback(async () => {
    try {
      await updateTradingConfig({
        autoTrading: false,
        emergencyStop: true,
      });
      console.log("Emergency stop activated");
    } catch (error) {
      console.error("Failed to activate emergency stop:", error);
      throw error;
    }
  }, [updateTradingConfig]);

  return {
    closePosition,
    updateTradingConfig,
    executeSignal,
    toggleAutoTrading,
    emergencyStop,
    loading: {
      closePosition: closePositionLoading,
      updateConfig: updateConfigLoading,
    },
    errors: {
      closePosition: closePositionError ? String(closePositionError) : null,
      updateConfig: updateConfigError ? String(updateConfigError) : null,
    },
  };
};

export default useTradingActions;
