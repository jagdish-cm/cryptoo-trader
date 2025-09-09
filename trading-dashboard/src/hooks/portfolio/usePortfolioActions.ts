/**
 * Custom hook for portfolio actions and operations
 */

import { useState, useCallback } from "react";
import { Position } from "../../types";

interface UsePortfolioActionsOptions {
  onPositionClosed?: (positionId: string) => void;
  onError?: (error: string) => void;
}

interface UsePortfolioActionsReturn {
  // State
  loading: boolean;
  error: string | null;

  // Actions
  closePosition: (positionId: string) => Promise<void>;
  closeMultiplePositions: (positionIds: string[]) => Promise<void>;
  adjustPosition: (positionId: string, newQuantity: number) => Promise<void>;
  setStopLoss: (positionId: string, stopLossPrice: number) => Promise<void>;
  setTakeProfit: (positionId: string, takeProfitPrice: number) => Promise<void>;

  // Bulk operations
  closeAllProfitable: (positions: Position[]) => Promise<void>;
  closeAllLosing: (positions: Position[]) => Promise<void>;

  // Risk management
  hedgePosition: (positionId: string, hedgeRatio: number) => Promise<void>;
  rebalancePortfolio: (
    targetAllocations: Record<string, number>
  ) => Promise<void>;
}

/**
 * Custom hook for portfolio actions
 */
export const usePortfolioActions = (
  options: UsePortfolioActionsOptions = {}
): UsePortfolioActionsReturn => {
  const { onPositionClosed, onError } = options;

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleError = useCallback(
    (err: unknown) => {
      const errorMessage =
        err instanceof Error ? err.message : "An unknown error occurred";
      setError(errorMessage);
      onError?.(errorMessage);
    },
    [onError]
  );

  const closePosition = useCallback(
    async (positionId: string) => {
      setLoading(true);
      setError(null);

      try {
        // Simulate API call delay
        await new Promise((resolve) => setTimeout(resolve, 1000));

        // In a real app, this would be an API call to close the position
        console.log(`Closing position: ${positionId}`);

        // Simulate potential failure
        if (Math.random() < 0.1) {
          throw new Error("Failed to close position due to market conditions");
        }

        onPositionClosed?.(positionId);
      } catch (err) {
        handleError(err);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [onPositionClosed, handleError]
  );

  const closeMultiplePositions = useCallback(
    async (positionIds: string[]) => {
      setLoading(true);
      setError(null);

      try {
        // Simulate API call delay
        await new Promise((resolve) => setTimeout(resolve, 1500));

        // In a real app, this would be a batch API call
        console.log(`Closing ${positionIds.length} positions:`, positionIds);

        // Simulate potential partial failure
        if (Math.random() < 0.2) {
          throw new Error(
            `Failed to close ${Math.floor(Math.random() * positionIds.length)} positions`
          );
        }

        positionIds.forEach((id) => onPositionClosed?.(id));
      } catch (err) {
        handleError(err);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [onPositionClosed, handleError]
  );

  const adjustPosition = useCallback(
    async (positionId: string, newQuantity: number) => {
      setLoading(true);
      setError(null);

      try {
        // Validate quantity
        if (newQuantity <= 0) {
          throw new Error("Quantity must be greater than zero");
        }

        // Simulate API call delay
        await new Promise((resolve) => setTimeout(resolve, 800));

        console.log(
          `Adjusting position ${positionId} to quantity: ${newQuantity}`
        );

        // Simulate potential failure
        if (Math.random() < 0.15) {
          throw new Error("Insufficient buying power to adjust position");
        }
      } catch (err) {
        handleError(err);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [handleError]
  );

  const setStopLoss = useCallback(
    async (positionId: string, stopLossPrice: number) => {
      setLoading(true);
      setError(null);

      try {
        // Validate stop loss price
        if (stopLossPrice <= 0) {
          throw new Error("Stop loss price must be greater than zero");
        }

        // Simulate API call delay
        await new Promise((resolve) => setTimeout(resolve, 600));

        console.log(
          `Setting stop loss for position ${positionId} at price: ${stopLossPrice}`
        );

        // Simulate potential failure
        if (Math.random() < 0.1) {
          throw new Error("Failed to set stop loss order");
        }
      } catch (err) {
        handleError(err);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [handleError]
  );

  const setTakeProfit = useCallback(
    async (positionId: string, takeProfitPrice: number) => {
      setLoading(true);
      setError(null);

      try {
        // Validate take profit price
        if (takeProfitPrice <= 0) {
          throw new Error("Take profit price must be greater than zero");
        }

        // Simulate API call delay
        await new Promise((resolve) => setTimeout(resolve, 600));

        console.log(
          `Setting take profit for position ${positionId} at price: ${takeProfitPrice}`
        );

        // Simulate potential failure
        if (Math.random() < 0.1) {
          throw new Error("Failed to set take profit order");
        }
      } catch (err) {
        handleError(err);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [handleError]
  );

  const closeAllProfitable = useCallback(
    async (positions: Position[]) => {
      const profitablePositions = positions.filter(
        (pos) => pos.unrealizedPnL > 0
      );

      if (profitablePositions.length === 0) {
        throw new Error("No profitable positions to close");
      }

      const positionIds = profitablePositions.map((pos) => pos.id);
      await closeMultiplePositions(positionIds);
    },
    [closeMultiplePositions]
  );

  const closeAllLosing = useCallback(
    async (positions: Position[]) => {
      const losingPositions = positions.filter((pos) => pos.unrealizedPnL < 0);

      if (losingPositions.length === 0) {
        throw new Error("No losing positions to close");
      }

      const positionIds = losingPositions.map((pos) => pos.id);
      await closeMultiplePositions(positionIds);
    },
    [closeMultiplePositions]
  );

  const hedgePosition = useCallback(
    async (positionId: string, hedgeRatio: number) => {
      setLoading(true);
      setError(null);

      try {
        // Validate hedge ratio
        if (hedgeRatio < 0 || hedgeRatio > 1) {
          throw new Error("Hedge ratio must be between 0 and 1");
        }

        // Simulate API call delay
        await new Promise((resolve) => setTimeout(resolve, 1200));

        console.log(`Hedging position ${positionId} with ratio: ${hedgeRatio}`);

        // Simulate potential failure
        if (Math.random() < 0.2) {
          throw new Error("Failed to create hedge position");
        }
      } catch (err) {
        handleError(err);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [handleError]
  );

  const rebalancePortfolio = useCallback(
    async (targetAllocations: Record<string, number>) => {
      setLoading(true);
      setError(null);

      try {
        // Validate allocations sum to 100%
        const totalAllocation = Object.values(targetAllocations).reduce(
          (sum, allocation) => sum + allocation,
          0
        );
        if (Math.abs(totalAllocation - 100) > 0.01) {
          throw new Error("Target allocations must sum to 100%");
        }

        // Simulate API call delay
        await new Promise((resolve) => setTimeout(resolve, 2000));

        console.log(
          "Rebalancing portfolio with target allocations:",
          targetAllocations
        );

        // Simulate potential failure
        if (Math.random() < 0.25) {
          throw new Error(
            "Failed to rebalance portfolio due to insufficient liquidity"
          );
        }
      } catch (err) {
        handleError(err);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [handleError]
  );

  return {
    // State
    loading,
    error,

    // Actions
    closePosition,
    closeMultiplePositions,
    adjustPosition,
    setStopLoss,
    setTakeProfit,

    // Bulk operations
    closeAllProfitable,
    closeAllLosing,

    // Risk management
    hedgePosition,
    rebalancePortfolio,
  };
};

export default usePortfolioActions;
