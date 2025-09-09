import React from "react";
import {
  CheckCircleIcon,
  ExclamationTriangleIcon,
  XCircleIcon,
  PlayIcon,
  StopIcon,
  WifiIcon,
  NoSymbolIcon,
} from "@heroicons/react/24/outline";
import { useAppSelector } from "../../store/hooks";
import { useWebSocket } from "../../contexts/WebSocketContext";
import {
  useStartSystemMutation,
  useStopSystemMutation,
  useEmergencyStopMutation,
} from "../../store/api/tradingApi";
import type { RootState } from "../../store";

const SystemStatusBar: React.FC = () => {
  const { state: wsState } = useWebSocket();
  const systemStatus = useAppSelector(
    (state: RootState) => state.system.status
  );
  const portfolio = useAppSelector(
    (state: RootState) => state.portfolio.currentPortfolio
  );
  const positions = useAppSelector(
    (state: RootState) => state.portfolio.positions
  );
  const connected = useAppSelector(
    (state: RootState) => state.system.connected
  );

  const [startSystem] = useStartSystemMutation();
  const [stopSystem] = useStopSystemMutation();
  const [emergencyStop] = useEmergencyStopMutation();

  // Use real data or fallback to defaults
  const status = systemStatus?.status || "STOPPED";
  const uptime = systemStatus?.uptime ? systemStatus.uptime * 1000 : 0; // Convert to milliseconds
  const portfolioValue = portfolio?.totalValue || 0;
  const dailyPnL = portfolio?.dailyPnL || 0;
  const activePositions = positions.filter((p) => p.status === "OPEN").length;
  const processingSymbol = systemStatus?.processingSymbol;
  const currentPhase = systemStatus?.currentPhase || "DATA_INGESTION";

  const handleStartSystem = async () => {
    try {
      await startSystem().unwrap();
    } catch (error) {
      console.error("Failed to start system:", error);
    }
  };

  const handleStopSystem = async () => {
    try {
      await stopSystem().unwrap();
    } catch (error) {
      console.error("Failed to stop system:", error);
    }
  };

  const handleEmergencyStop = async () => {
    if (
      window.confirm(
        "Are you sure you want to perform an emergency stop? This will close all positions immediately."
      )
    ) {
      try {
        await emergencyStop().unwrap();
      } catch (error) {
        console.error("Failed to perform emergency stop:", error);
      }
    }
  };

  const formatUptime = (ms: number) => {
    const hours = Math.floor(ms / (1000 * 60 * 60));
    const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m`;
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
    }).format(value);
  };

  const getStatusIcon = () => {
    switch (status) {
      case "RUNNING":
        return <CheckCircleIcon className='h-5 w-5 text-success-500' />;
      case "STOPPED":
        return <StopIcon className='h-5 w-5 text-gray-500' />;
      case "ERROR":
        return <XCircleIcon className='h-5 w-5 text-danger-500' />;
      default:
        return <ExclamationTriangleIcon className='h-5 w-5 text-warning-500' />;
    }
  };

  const getStatusColor = () => {
    switch (status) {
      case "RUNNING":
        return "text-success-600 dark:text-success-400";
      case "STOPPED":
        return "text-gray-600 dark:text-gray-400";
      case "ERROR":
        return "text-danger-600 dark:text-danger-400";
      default:
        return "text-warning-600 dark:text-warning-400";
    }
  };

  const formatPhase = (phase: string) => {
    return phase
      .replace(/_/g, " ")
      .toLowerCase()
      .replace(/\b\w/g, (l) => l.toUpperCase());
  };

  return (
    <div className='flex items-center space-x-6 text-sm'>
      {/* System Status */}
      <div className='flex items-center space-x-2'>
        {getStatusIcon()}
        <span className={`font-medium ${getStatusColor()}`}>{status}</span>
        <span className='text-gray-500 dark:text-gray-400'>
          {formatUptime(uptime)}
        </span>
      </div>

      {/* Portfolio Value */}
      <div className='hidden sm:flex items-center space-x-2'>
        <span className='text-gray-500 dark:text-gray-400'>Portfolio:</span>
        <span className='font-medium text-gray-900 dark:text-white'>
          {formatCurrency(portfolioValue)}
        </span>
        <span
          className={`font-medium ${dailyPnL >= 0 ? "text-success-600 dark:text-success-400" : "text-danger-600 dark:text-danger-400"}`}
        >
          {dailyPnL >= 0 ? "+" : ""}
          {formatCurrency(dailyPnL)}
        </span>
      </div>

      {/* Active Positions */}
      <div className='hidden md:flex items-center space-x-2'>
        <span className='text-gray-500 dark:text-gray-400'>Positions:</span>
        <span className='font-medium text-gray-900 dark:text-white'>
          {activePositions}
        </span>
      </div>

      {/* Current Processing */}
      {status === "RUNNING" && processingSymbol && (
        <div className='hidden lg:flex items-center space-x-2'>
          <div className='flex items-center space-x-1'>
            <div className='w-2 h-2 bg-primary-500 rounded-full animate-pulse'></div>
            <span className='text-gray-500 dark:text-gray-400'>
              Processing:
            </span>
          </div>
          <span className='font-medium text-gray-900 dark:text-white'>
            {processingSymbol}
          </span>
          <span className='text-xs text-gray-400 dark:text-gray-500'>
            {formatPhase(currentPhase)}
          </span>
        </div>
      )}

      {/* WebSocket Connection Status */}
      <div className='flex items-center space-x-1'>
        {wsState.isConnected ? (
          <WifiIcon
            className='h-4 w-4 text-success-500'
            title='Connected to real-time data'
          />
        ) : (
          <NoSymbolIcon
            className='h-4 w-4 text-danger-500'
            title='Disconnected from real-time data'
          />
        )}
      </div>

      {/* Control Buttons */}
      <div className='flex items-center space-x-2'>
        {status === "RUNNING" ? (
          <>
            <button
              onClick={handleStopSystem}
              className='p-1.5 text-gray-500 hover:text-danger-600 dark:text-gray-400 dark:hover:text-danger-400 transition-colors'
              title='Stop System'
            >
              <StopIcon className='h-4 w-4' />
            </button>
            <button
              onClick={handleEmergencyStop}
              className='p-1.5 text-danger-500 hover:text-danger-700 dark:text-danger-400 dark:hover:text-danger-300 transition-colors'
              title='Emergency Stop (Close All Positions)'
            >
              <XCircleIcon className='h-4 w-4' />
            </button>
          </>
        ) : (
          <button
            onClick={handleStartSystem}
            className='p-1.5 text-gray-500 hover:text-success-600 dark:text-gray-400 dark:hover:text-success-400 transition-colors'
            title='Start System'
          >
            <PlayIcon className='h-4 w-4' />
          </button>
        )}
      </div>
    </div>
  );
};

export default SystemStatusBar;
