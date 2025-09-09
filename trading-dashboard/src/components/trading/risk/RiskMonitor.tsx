import React, { useState, useEffect } from "react";
import {
  ExclamationTriangleIcon,
  ShieldCheckIcon,
  ChartBarIcon,
} from "@heroicons/react/24/outline";

interface RiskMetrics {
  portfolioRisk: number;
  maxDrawdown: number;
  volatility: number;
  exposureByAsset: Record<string, number>;
  riskLevel: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  warnings: string[];
}

const RiskMonitor: React.FC = () => {
  const [riskMetrics, setRiskMetrics] = useState<RiskMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchRiskMetrics = async () => {
      try {
        // Simulate risk calculation based on portfolio data
        const portfolioResponse = await fetch(
          "http://localhost:8000/api/portfolio"
        );
        const positionsResponse = await fetch(
          "http://localhost:8000/api/positions"
        );

        if (portfolioResponse.ok && positionsResponse.ok) {
          const portfolio = await portfolioResponse.json();
          const positions = await positionsResponse.json();

          // Calculate risk metrics
          const totalValue = portfolio.totalValue || 100000;
          const totalUnrealizedPnL = positions.reduce(
            (sum: number, pos: any) => sum + pos.unrealizedPnL,
            0
          );
          const portfolioRisk =
            (Math.abs(totalUnrealizedPnL) / totalValue) * 100;

          // Calculate exposure by asset
          const exposureByAsset: Record<string, number> = {};
          positions.forEach((pos: any) => {
            const exposure =
              ((pos.quantity * pos.currentPrice) / totalValue) * 100;
            exposureByAsset[pos.symbol] = exposure;
          });

          // Determine risk level
          let riskLevel: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" = "LOW";
          const warnings: string[] = [];

          if (portfolioRisk > 15) {
            riskLevel = "CRITICAL";
            warnings.push(
              "Portfolio risk exceeds 15% - Consider reducing positions"
            );
          } else if (portfolioRisk > 10) {
            riskLevel = "HIGH";
            warnings.push("High portfolio risk detected - Monitor closely");
          } else if (portfolioRisk > 5) {
            riskLevel = "MEDIUM";
            warnings.push("Moderate risk levels - Within acceptable range");
          }

          // Check for concentration risk
          Object.entries(exposureByAsset).forEach(([symbol, exposure]) => {
            if (exposure > 20) {
              warnings.push(
                `High concentration in ${symbol} (${exposure.toFixed(1)}%)`
              );
              if (riskLevel === "LOW") riskLevel = "MEDIUM";
            }
          });

          setRiskMetrics({
            portfolioRisk,
            maxDrawdown: Math.abs(portfolio.maxDrawdown || 0),
            volatility: Math.random() * 5 + 2, // Simulated volatility
            exposureByAsset,
            riskLevel,
            warnings,
          });
        }
      } catch (error) {
        console.error("Error fetching risk metrics:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchRiskMetrics();
    const interval = setInterval(fetchRiskMetrics, 5000); // Update every 5 seconds

    return () => clearInterval(interval);
  }, []);

  const getRiskLevelColor = (level: string) => {
    switch (level) {
      case "LOW":
        return "text-green-600 bg-green-100 dark:text-green-400 dark:bg-green-900/20";
      case "MEDIUM":
        return "text-yellow-600 bg-yellow-100 dark:text-yellow-400 dark:bg-yellow-900/20";
      case "HIGH":
        return "text-orange-600 bg-orange-100 dark:text-orange-400 dark:bg-orange-900/20";
      case "CRITICAL":
        return "text-red-600 bg-red-100 dark:text-red-400 dark:bg-red-900/20";
      default:
        return "text-gray-600 bg-gray-100 dark:text-gray-400 dark:bg-gray-800";
    }
  };

  const getRiskIcon = (level: string) => {
    switch (level) {
      case "LOW":
        return <ShieldCheckIcon className='h-5 w-5 text-green-500' />;
      case "MEDIUM":
        return <ChartBarIcon className='h-5 w-5 text-yellow-500' />;
      case "HIGH":
      case "CRITICAL":
        return <ExclamationTriangleIcon className='h-5 w-5 text-red-500' />;
      default:
        return <ShieldCheckIcon className='h-5 w-5 text-gray-500' />;
    }
  };

  if (isLoading) {
    return (
      <div className='bg-white dark:bg-gray-800 rounded-lg shadow p-6'>
        <div className='animate-pulse'>
          <div className='h-4 bg-gray-300 dark:bg-gray-600 rounded w-32 mb-4'></div>
          <div className='space-y-3'>
            <div className='h-3 bg-gray-300 dark:bg-gray-600 rounded'></div>
            <div className='h-3 bg-gray-300 dark:bg-gray-600 rounded w-5/6'></div>
            <div className='h-3 bg-gray-300 dark:bg-gray-600 rounded w-4/6'></div>
          </div>
        </div>
      </div>
    );
  }

  if (!riskMetrics) {
    return (
      <div className='bg-white dark:bg-gray-800 rounded-lg shadow p-6'>
        <div className='text-center text-gray-500 dark:text-gray-400'>
          Unable to load risk metrics
        </div>
      </div>
    );
  }

  return (
    <div className='bg-white dark:bg-gray-800 rounded-lg shadow'>
      <div className='px-6 py-4 border-b border-gray-200 dark:border-gray-700'>
        <div className='flex items-center justify-between'>
          <h3 className='text-lg font-medium text-gray-900 dark:text-white'>
            Risk Monitor
          </h3>
          <div className='flex items-center space-x-2'>
            {getRiskIcon(riskMetrics.riskLevel)}
            <span
              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getRiskLevelColor(
                riskMetrics.riskLevel
              )}`}
            >
              {riskMetrics.riskLevel} RISK
            </span>
          </div>
        </div>
      </div>

      <div className='p-6 space-y-6'>
        {/* Risk Metrics Grid */}
        <div className='grid grid-cols-2 gap-4'>
          <div className='text-center'>
            <div className='text-2xl font-bold text-gray-900 dark:text-white'>
              {riskMetrics.portfolioRisk.toFixed(1)}%
            </div>
            <div className='text-sm text-gray-500 dark:text-gray-400'>
              Portfolio Risk
            </div>
          </div>
          <div className='text-center'>
            <div className='text-2xl font-bold text-gray-900 dark:text-white'>
              {riskMetrics.maxDrawdown.toFixed(1)}%
            </div>
            <div className='text-sm text-gray-500 dark:text-gray-400'>
              Max Drawdown
            </div>
          </div>
        </div>

        {/* Asset Exposure */}
        {Object.keys(riskMetrics.exposureByAsset).length > 0 && (
          <div>
            <h4 className='text-sm font-medium text-gray-900 dark:text-white mb-3'>
              Asset Exposure
            </h4>
            <div className='space-y-2'>
              {Object.entries(riskMetrics.exposureByAsset).map(
                ([symbol, exposure]) => (
                  <div
                    key={symbol}
                    className='flex items-center justify-between'
                  >
                    <span className='text-sm text-gray-600 dark:text-gray-400'>
                      {symbol}
                    </span>
                    <div className='flex items-center space-x-2'>
                      <div className='w-20 bg-gray-200 dark:bg-gray-700 rounded-full h-2'>
                        <div
                          className={`h-2 rounded-full ${
                            exposure > 20
                              ? "bg-red-500"
                              : exposure > 10
                                ? "bg-yellow-500"
                                : "bg-green-500"
                          }`}
                          style={{ width: `${Math.min(exposure, 100)}%` }}
                        ></div>
                      </div>
                      <span className='text-sm font-medium text-gray-900 dark:text-white w-12 text-right'>
                        {exposure.toFixed(1)}%
                      </span>
                    </div>
                  </div>
                )
              )}
            </div>
          </div>
        )}

        {/* Risk Warnings */}
        {riskMetrics.warnings.length > 0 && (
          <div>
            <h4 className='text-sm font-medium text-gray-900 dark:text-white mb-3'>
              Risk Alerts
            </h4>
            <div className='space-y-2'>
              {riskMetrics.warnings.map((warning, index) => (
                <div
                  key={index}
                  className={`flex items-start space-x-2 p-3 rounded-lg ${
                    riskMetrics.riskLevel === "CRITICAL"
                      ? "bg-red-50 dark:bg-red-900/20"
                      : riskMetrics.riskLevel === "HIGH"
                        ? "bg-orange-50 dark:bg-orange-900/20"
                        : "bg-yellow-50 dark:bg-yellow-900/20"
                  }`}
                >
                  <ExclamationTriangleIcon
                    className={`h-4 w-4 mt-0.5 ${
                      riskMetrics.riskLevel === "CRITICAL"
                        ? "text-red-500"
                        : riskMetrics.riskLevel === "HIGH"
                          ? "text-orange-500"
                          : "text-yellow-500"
                    }`}
                  />
                  <span className='text-sm text-gray-700 dark:text-gray-300'>
                    {warning}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Risk Score Visualization */}
        <div>
          <div className='flex items-center justify-between mb-2'>
            <span className='text-sm font-medium text-gray-900 dark:text-white'>
              Overall Risk Score
            </span>
            <span className='text-sm text-gray-500 dark:text-gray-400'>
              {riskMetrics.portfolioRisk.toFixed(1)}/20
            </span>
          </div>
          <div className='w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3'>
            <div
              className={`h-3 rounded-full transition-all duration-300 ${
                riskMetrics.portfolioRisk > 15
                  ? "bg-red-500"
                  : riskMetrics.portfolioRisk > 10
                    ? "bg-orange-500"
                    : riskMetrics.portfolioRisk > 5
                      ? "bg-yellow-500"
                      : "bg-green-500"
              }`}
              style={{
                width: `${Math.min((riskMetrics.portfolioRisk / 20) * 100, 100)}%`,
              }}
            ></div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RiskMonitor;
