/**
 * Trading Execution Panel
 * Provides controls for executing trades and managing positions
 */

import React, { useState, useEffect } from "react";
import {
  PlayIcon,
  StopIcon,
  ExclamationTriangleIcon,
  ChartBarIcon,
  ClockIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { api } from "../../../services/api/tradingApi";

interface ActivePosition {
  id: string;
  symbol: string;
  direction: "LONG" | "SHORT";
  entryPrice: number;
  currentPrice: number;
  quantity: number;
  unrealizedPnL: number;
  stopLoss?: number;
  takeProfitLevels: number[];
  status: string;
  createdAt: string;
  updatedAt: string;
}

interface ActiveOrder {
  id: string;
  symbol: string;
  type: string;
  side: string;
  quantity: number;
  price?: number;
  filled: number;
  remaining: number;
  status: string;
  createdAt: string;
  updatedAt: string;
}

interface TradingExecutionPanelProps {
  className?: string;
}

export const TradingExecutionPanel: React.FC<TradingExecutionPanelProps> = ({
  className = "",
}) => {
  const [activePositions, setActivePositions] = useState<ActivePosition[]>([]);
  const [activeOrders, setActiveOrders] = useState<ActiveOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [executingAction, setExecutingAction] = useState<string | null>(null);

  // Fetch active positions and orders
  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Only fetch positions since orders endpoint is not yet implemented
      const positionsResponse = await api.portfolio.getPositions();
      setActivePositions(positionsResponse || []);

      // Set empty orders array since orders management is not yet implemented
      setActiveOrders([]);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to fetch trading data"
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();

    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);

  // Execute a trading signal
  const executeSignal = async (signalData: unknown) => {
    try {
      setExecutingAction("execute_signal");

      const result = await api.trading.executeSignal(signalData);

      if (result.decision === "EXECUTE") {
        alert(
          `Signal executed successfully! Position ID: ${result.position_id}`
        );
        await fetchData(); // Refresh data
      } else {
        alert(`Signal rejected: ${result.reason}`);
      }
    } catch (err) {
      alert(
        `Failed to execute signal: ${err instanceof Error ? err.message : "Unknown error"}`
      );
    } finally {
      setExecutingAction(null);
    }
  };

  // Close a position
  const closePosition = async (
    positionId: string,
    reason: string = "MANUAL_CLOSE"
  ) => {
    try {
      setExecutingAction(`close_${positionId}`);

      const result = await api.trading.closePosition(positionId, reason);
      alert(`Position closed successfully: ${result.message}`);

      await fetchData(); // Refresh data
    } catch (err) {
      alert(
        `Failed to close position: ${err instanceof Error ? err.message : "Unknown error"}`
      );
    } finally {
      setExecutingAction(null);
    }
  };

  // Cancel an order (placeholder - backend endpoint not yet implemented)
  const cancelOrder = async (orderId: string) => {
    try {
      setExecutingAction(`cancel_${orderId}`);

      // TODO: Implement when backend supports order cancellation
      alert(`Order cancellation not yet implemented in backend`);

      await fetchData(); // Refresh data
    } catch (err) {
      alert(
        `Failed to cancel order: ${err instanceof Error ? err.message : "Unknown error"}`
      );
    } finally {
      setExecutingAction(null);
    }
  };

  // Emergency stop all positions
  const emergencyStop = async () => {
    if (
      !confirm(
        "Are you sure you want to execute an emergency stop? This will close ALL active positions immediately."
      )
    ) {
      return;
    }

    try {
      setExecutingAction("emergency_stop");

      const result = await api.trading.emergencyStop();
      alert(`Emergency stop executed: ${result.message}`);

      await fetchData(); // Refresh data
    } catch (err) {
      alert(
        `Emergency stop failed: ${err instanceof Error ? err.message : "Unknown error"}`
      );
    } finally {
      setExecutingAction(null);
    }
  };

  // Demo signal execution (for testing)
  const executeDemoSignal = () => {
    const demoSignal = {
      id: `demo_${Date.now()}`,
      symbol: "BTC/USDT",
      signal_type: "BUY_SIGNAL",
      confidence: 0.85,
      technical_score: 0.8,
      sentiment_score: 0.7,
      stop_loss_pct: 0.05,
      take_profit_levels: [0.05, 0.1],
      reasoning: {
        summary: "Strong bullish signal detected",
        technicalScore: 0.8,
        sentimentScore: 0.7,
      },
      factors: [
        {
          type: "technical",
          value: 0.8,
          weight: 0.6,
          description: "Technical analysis",
        },
        {
          type: "sentiment",
          value: 0.7,
          weight: 0.4,
          description: "Market sentiment",
        },
      ],
    };

    executeSignal(demoSignal);
  };

  if (loading) {
    return (
      <div
        className={`bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 ${className}`}
      >
        <div className='animate-pulse'>
          <div className='h-6 bg-gray-200 dark:bg-gray-700 rounded mb-4'></div>
          <div className='space-y-3'>
            <div className='h-4 bg-gray-200 dark:bg-gray-700 rounded'></div>
            <div className='h-4 bg-gray-200 dark:bg-gray-700 rounded'></div>
            <div className='h-4 bg-gray-200 dark:bg-gray-700 rounded'></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 ${className}`}
    >
      {/* Header */}
      <div className='flex items-center justify-between mb-6'>
        <div className='flex items-center space-x-3'>
          <ChartBarIcon className='h-6 w-6 text-blue-600' />
          <h3 className='text-lg font-semibold text-gray-900 dark:text-white'>
            Trading Execution
          </h3>
        </div>

        {/* Emergency Stop Button */}
        <button
          onClick={emergencyStop}
          disabled={executingAction === "emergency_stop"}
          className='flex items-center space-x-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed'
        >
          <ExclamationTriangleIcon className='h-4 w-4' />
          <span>Emergency Stop</span>
          {executingAction === "emergency_stop" && (
            <div className='animate-spin rounded-full h-4 w-4 border-b-2 border-white'></div>
          )}
        </button>
      </div>

      {error && (
        <div className='mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg'>
          <p className='text-red-800 dark:text-red-200'>{error}</p>
        </div>
      )}

      {/* Demo Controls */}
      <div className='mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg'>
        <h4 className='text-sm font-medium text-blue-800 dark:text-blue-200 mb-2'>
          Demo Trading
        </h4>
        <button
          onClick={executeDemoSignal}
          disabled={executingAction === "execute_signal"}
          className='flex items-center space-x-2 px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50'
        >
          <PlayIcon className='h-4 w-4' />
          <span>Execute Demo BTC Signal</span>
          {executingAction === "execute_signal" && (
            <div className='animate-spin rounded-full h-4 w-4 border-b-2 border-white'></div>
          )}
        </button>
      </div>

      {/* Active Positions */}
      <div className='mb-6'>
        <h4 className='text-md font-medium text-gray-900 dark:text-white mb-3'>
          Active Positions ({activePositions.length})
        </h4>

        {activePositions.length === 0 ? (
          <div className='text-center py-8 text-gray-500 dark:text-gray-400'>
            No active positions
          </div>
        ) : (
          <div className='space-y-3'>
            {activePositions.map((position) => (
              <div
                key={position.id}
                className='flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg'
              >
                <div className='flex-1'>
                  <div className='flex items-center space-x-3'>
                    <span className='font-medium text-gray-900 dark:text-white'>
                      {position.symbol}
                    </span>
                    <span
                      className={`px-2 py-1 text-xs rounded-full ${
                        position.direction === "LONG"
                          ? "bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400"
                          : "bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400"
                      }`}
                    >
                      {position.direction}
                    </span>
                  </div>
                  <div className='mt-1 text-sm text-gray-600 dark:text-gray-400'>
                    Entry: ${position.entryPrice.toFixed(2)} | Current: $
                    {position.currentPrice.toFixed(2)} | Qty:{" "}
                    {position.quantity} | P&L:{" "}
                    <span
                      className={
                        position.unrealizedPnL >= 0
                          ? "text-green-600"
                          : "text-red-600"
                      }
                    >
                      ${position.unrealizedPnL.toFixed(2)}
                    </span>
                  </div>
                </div>

                <button
                  onClick={() => closePosition(position.id)}
                  disabled={executingAction === `close_${position.id}`}
                  className='flex items-center space-x-1 px-3 py-1 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50'
                >
                  <StopIcon className='h-4 w-4' />
                  <span>Close</span>
                  {executingAction === `close_${position.id}` && (
                    <div className='animate-spin rounded-full h-3 w-3 border-b-2 border-white'></div>
                  )}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Active Orders */}
      <div>
        <h4 className='text-md font-medium text-gray-900 dark:text-white mb-3'>
          Active Orders ({activeOrders.length})
        </h4>

        {activeOrders.length === 0 ? (
          <div className='text-center py-8 text-gray-500 dark:text-gray-400'>
            No active orders
          </div>
        ) : (
          <div className='space-y-3'>
            {activeOrders.map((order) => (
              <div
                key={order.id}
                className='flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg'
              >
                <div className='flex-1'>
                  <div className='flex items-center space-x-3'>
                    <span className='font-medium text-gray-900 dark:text-white'>
                      {order.symbol}
                    </span>
                    <span className='px-2 py-1 text-xs bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400 rounded-full'>
                      {order.type} {order.side}
                    </span>
                  </div>
                  <div className='mt-1 text-sm text-gray-600 dark:text-gray-400'>
                    Qty: {order.quantity} |
                    {order.price && ` Price: $${order.price.toFixed(2)} |`}
                    Filled: {order.filled} | Remaining: {order.remaining}
                  </div>
                </div>

                <button
                  onClick={() => cancelOrder(order.id)}
                  disabled={executingAction === `cancel_${order.id}`}
                  className='flex items-center space-x-1 px-3 py-1 bg-gray-600 text-white rounded-md hover:bg-gray-700 disabled:opacity-50'
                >
                  <XMarkIcon className='h-4 w-4' />
                  <span>Cancel</span>
                  {executingAction === `cancel_${order.id}` && (
                    <div className='animate-spin rounded-full h-3 w-3 border-b-2 border-white'></div>
                  )}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Refresh Button */}
      <div className='mt-6 flex justify-center'>
        <button
          onClick={fetchData}
          disabled={loading}
          className='flex items-center space-x-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50'
        >
          <ClockIcon className='h-4 w-4' />
          <span>Refresh Data</span>
          {loading && (
            <div className='animate-spin rounded-full h-4 w-4 border-b-2 border-white'></div>
          )}
        </button>
      </div>
    </div>
  );
};

export default TradingExecutionPanel;
