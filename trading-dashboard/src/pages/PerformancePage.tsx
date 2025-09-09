import React, { Suspense } from "react";

// Lazy load heavy performance components
// Performance components will be implemented
// const PerformanceDashboard = React.lazy(() => import("./components/performance/PerformanceDashboard"));
// const TradeHistoryPanel = React.lazy(() => import("../components/trading/history/TradeHistoryPanel"));
// const MetricsPanel = React.lazy(() => import("../components/analytics/performance/MetricsPanel"));
// const ChartsPanel = React.lazy(() => import("../components/analytics/charts/ChartsPanel"));
import { usePerformanceData } from "../hooks/performance/usePerformanceData";
import { useTradeHistory } from "../hooks/performance/useTradeHistory";
import { usePerformanceMetrics } from "../hooks/performance/usePerformanceMetrics";

const PerformancePage: React.FC = () => {
  // Use the new performance data hook
  const { metrics, trades, loading, error, refresh, setTimeRange, timeRange } =
    usePerformanceData({
      timeRange: "30d",
      autoRefresh: true,
      refreshInterval: 30000,
    });

  // Use trade history hook for advanced filtering and pagination
  const tradeHistory = useTradeHistory(trades, {
    initialPageSize: 10,
  });

  // Use performance metrics hook for additional calculations
  const performanceMetrics = usePerformanceMetrics(trades, {
    timeRange,
  });

  // Handle export functionality
  const handleExportReport = () => {
    const reportData = {
      timeRange,
      metrics,
      trades: trades.length,
      generatedAt: new Date().toISOString(),
    };

    const blob = new Blob([JSON.stringify(reportData, null, 2)], {
      type: "application/json",
    });

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `performance-report-${timeRange}-${new Date().toISOString().split("T")[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className='space-y-6'>
      {/* Performance Dashboard Header */}
      <div className='bg-white dark:bg-gray-800 rounded-lg shadow p-6'>
        <h2 className='text-xl font-semibold text-gray-900 dark:text-white mb-4'>
          Performance Dashboard
        </h2>
        <p className='text-gray-600 dark:text-gray-400'>
          Performance components will be implemented here.
        </p>
      </div>

      {/* Main Content Grid */}
      <div className='grid grid-cols-1 xl:grid-cols-3 gap-6'>
        {/* Performance Metrics - Takes 1 column */}
        <div className='xl:col-span-1'>
          <div className='bg-white dark:bg-gray-800 rounded-lg shadow p-6'>
            <h3 className='text-lg font-medium text-gray-900 dark:text-white mb-4'>
              Performance Metrics
            </h3>
            <p className='text-gray-600 dark:text-gray-400'>
              Metrics panel will be implemented here.
            </p>
          </div>
        </div>

        {/* Performance Charts - Takes 2 columns */}
        <div className='xl:col-span-2'>
          <div className='bg-white dark:bg-gray-800 rounded-lg shadow p-6'>
            <h3 className='text-lg font-medium text-gray-900 dark:text-white mb-4'>
              Performance Charts
            </h3>
            <p className='text-gray-600 dark:text-gray-400'>
              Charts panel will be implemented here.
            </p>
          </div>
        </div>
      </div>

      {/* Trade History Panel - Full width */}
      <div className='bg-white dark:bg-gray-800 rounded-lg shadow p-6'>
        <h3 className='text-lg font-medium text-gray-900 dark:text-white mb-4'>
          Trade History
        </h3>
        <p className='text-gray-600 dark:text-gray-400'>
          Trade history panel will be implemented here.
        </p>
      </div>
    </div>
  );
};

export default PerformancePage;
