import React, { useState, Suspense } from "react";
import { useTradingData } from "../hooks/trading/useTradingData";
import { useTradingActions } from "./hooks/trading/useTradingActions";
import { useTradingConfig } from "./hooks/trading/useTradingConfig";
import { LoadingState } from "../components/ui/feedback/EmptyStates";

// Lazy load heavy trading components
const PositionsPanel = React.lazy(
  () => import("../components/trading/positions/PositionsPanel")
);
const SignalsPanel = React.lazy(
  () => import("../components/trading/signals/SignalsPanel")
);
const MarketDataPanel = React.lazy(
  () => import("../components/trading/market-data/MarketDataPanel")
);
const TradingControls = React.lazy(
  () => import("../components/trading/controls/TradingControls")
);
const TradingExecutionPanel = React.lazy(
  () => import("../components/trading/execution/TradingExecutionPanel")
);
const LiveAnalysisPanel = React.lazy(
  () => import("../components/trading/analysis/LiveAnalysisPanel")
);
const LivePriceTicker = React.lazy(
  () => import("../components/trading/market-data/LivePriceTicker")
);
const RiskMonitor = React.lazy(
  () => import("../components/trading/risk/RiskMonitor")
);

const TradingPage: React.FC = () => {
  const [selectedSymbol, setSelectedSymbol] = useState("BTC/USDT");

  // Use our new custom hooks
  const {
    data: tradingData,
    loading,
    error,
  } = useTradingData(["BTC/USDT", "ETH/USDT"]);
  const { config } = useTradingConfig();
  const { closePosition, executeSignal, toggleAutoTrading, emergencyStop } =
    useTradingActions();

  if (loading) {
    return <LoadingState message='Loading trading data...' />;
  }

  const handleClosePosition = async (positionId: string) => {
    try {
      await closePosition(positionId);
    } catch (error) {
      console.error("Failed to close position:", error);
    }
  };

  const handleExecuteSignal = (signalId: string) => {
    executeSignal(signalId);
  };

  const handleToggleAutoTrading = async () => {
    try {
      await toggleAutoTrading(config.autoTrading);
    } catch (error) {
      console.error("Failed to toggle auto trading:", error);
    }
  };

  const handleEmergencyStop = async () => {
    try {
      await emergencyStop();
    } catch (error) {
      console.error("Failed to activate emergency stop:", error);
    }
  };

  return (
    <div className='space-y-6'>
      {/* Trading Controls */}
      <Suspense
        fallback={
          <div className='h-20 bg-gray-100 dark:bg-gray-700 rounded-lg animate-pulse'></div>
        }
      >
        <TradingControls
          autoTradingEnabled={config.autoTrading}
          onToggleAutoTrading={handleToggleAutoTrading}
          maxPositions={config.maxPositions}
          riskPerTrade={config.riskPerTrade}
          emergencyStop={config.emergencyStop}
          onEmergencyStop={handleEmergencyStop}
        />
      </Suspense>

      {/* Live AI Analysis Panel - Featured prominently */}
      <div className='bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-lg p-1'>
        <Suspense
          fallback={
            <div className='h-64 bg-gray-100 dark:bg-gray-700 rounded-lg animate-pulse'></div>
          }
        >
          <LiveAnalysisPanel />
        </Suspense>
      </div>

      <div className='grid grid-cols-1 lg:grid-cols-3 gap-6'>
        {/* Market Data */}
        <div className='lg:col-span-1 space-y-4'>
          {/* Live Price Ticker */}
          <Suspense
            fallback={
              <div className='h-48 bg-gray-100 dark:bg-gray-700 rounded-lg animate-pulse'></div>
            }
          >
            <LivePriceTicker symbols={["BTC/USDT", "ETH/USDT"]} />
          </Suspense>

          {/* Market Data Panel */}
          <Suspense
            fallback={
              <div className='h-64 bg-gray-100 dark:bg-gray-700 rounded-lg animate-pulse'></div>
            }
          >
            <MarketDataPanel
              marketData={tradingData.marketData.data}
              selectedSymbol={selectedSymbol}
              onSymbolSelect={setSelectedSymbol}
              loading={loading}
              error={error}
            />
          </Suspense>
        </div>

        {/* Chart Placeholder */}
        <div className='lg:col-span-2'>
          <div className='bg-white dark:bg-gray-800 rounded-lg shadow'>
            <div className='px-6 py-4 border-b border-gray-200 dark:border-gray-700'>
              <h3 className='text-lg font-medium text-gray-900 dark:text-white'>
                {selectedSymbol} Chart
              </h3>
            </div>
            <div className='p-6'>
              <div className='h-96 bg-gray-50 dark:bg-gray-700 rounded-lg flex items-center justify-center'>
                <div className='text-center'>
                  <div className='text-gray-500 dark:text-gray-400'>
                    Chart component will be implemented here
                  </div>
                  <p className='text-sm text-gray-400 dark:text-gray-500 mt-2'>
                    TradingView or custom chart integration
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Trading Execution Panel */}
      <Suspense
        fallback={
          <div className='h-64 bg-gray-100 dark:bg-gray-700 rounded-lg animate-pulse'></div>
        }
      >
        <TradingExecutionPanel />
      </Suspense>

      <div className='grid grid-cols-1 lg:grid-cols-3 gap-6'>
        {/* Active Positions */}
        <Suspense
          fallback={
            <div className='h-64 bg-gray-100 dark:bg-gray-700 rounded-lg animate-pulse'></div>
          }
        >
          <PositionsPanel
            positions={tradingData.positions.data}
            onClosePosition={handleClosePosition}
            loading={loading}
            error={error}
          />
        </Suspense>

        {/* Trading Signals */}
        <Suspense
          fallback={
            <div className='h-64 bg-gray-100 dark:bg-gray-700 rounded-lg animate-pulse'></div>
          }
        >
          <SignalsPanel
            signals={tradingData.signals.data}
            onExecuteSignal={handleExecuteSignal}
            autoTradingEnabled={config.autoTrading}
            loading={loading}
            error={error}
          />
        </Suspense>

        {/* Risk Monitor */}
        <Suspense
          fallback={
            <div className='h-64 bg-gray-100 dark:bg-gray-700 rounded-lg animate-pulse'></div>
          }
        >
          <RiskMonitor />
        </Suspense>
      </div>
    </div>
  );
};

export default TradingPage;
