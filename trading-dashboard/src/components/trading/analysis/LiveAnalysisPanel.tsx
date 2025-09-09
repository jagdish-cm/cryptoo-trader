import React, { useState, useEffect } from "react";
import {
  CpuChipIcon,
  ChartBarIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  ArrowPathIcon,
} from "@heroicons/react/24/outline";

interface AnalysisStatus {
  phase: string;
  current_symbol: string | null;
  progress: number;
  message: string;
  started_at: string;
  estimated_completion: string | null;
  details: Record<string, unknown>;
  next_analysis_time: string;
  is_running: boolean;
  seconds_remaining?: number; // Added for timezone-safe countdown
}

interface MarketRegime {
  current: string;
  confidence: number;
  last_updated: string;
}

interface AIDecision {
  id: string;
  timestamp: string;
  symbol: string;
  decision_type: string;
  confidence: number;
  reasoning: string;
  factors: string[];
  outcome: string;
  // Trade execution details (when executed)
  entry_price?: number;
  stop_loss?: number;
  stop_loss_percentage?: number;
  stop_loss_reasoning?: string;
  take_profit_1?: number;
  take_profit_reasoning?: string;
}

const LiveAnalysisPanel: React.FC = () => {
  const [analysisStatus, setAnalysisStatus] = useState<AnalysisStatus | null>(
    null
  );
  const [marketRegime, setMarketRegime] = useState<MarketRegime | null>(null);
  const [recentDecisions, setRecentDecisions] = useState<AIDecision[]>([]);
  const [nextAnalysisCountdown, setNextAnalysisCountdown] = useState<number>(0);

  // Fetch initial data
  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch analysis status
        const statusResponse = await fetch(
          "http://localhost:8000/api/analysis/status"
        );
        if (statusResponse.ok) {
          const status = await statusResponse.json();
          setAnalysisStatus(status);
        }

        // Fetch market regime
        const regimeResponse = await fetch(
          "http://localhost:8000/api/analysis/market-regime"
        );
        if (regimeResponse.ok) {
          const regime = await regimeResponse.json();
          setMarketRegime(regime);
        }

        // Fetch recent decisions
        const decisionsResponse = await fetch(
          "http://localhost:8000/api/analysis/decisions?limit=5"
        );
        if (decisionsResponse.ok) {
          const decisions = await decisionsResponse.json();
          setRecentDecisions(decisions.decisions || []);
        }
      } catch (error) {
        console.error("Error fetching analysis data:", error);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 3000); // Update every 3 seconds

    return () => clearInterval(interval);
  }, []);

  // Countdown timer for next analysis - Use backend-calculated seconds_remaining for accuracy
  useEffect(() => {
    // If backend provides seconds_remaining, use that directly (more reliable)
    if (analysisStatus?.seconds_remaining !== undefined) {
      setNextAnalysisCountdown(analysisStatus.seconds_remaining);
      console.log(
        `Backend countdown: ${analysisStatus.seconds_remaining} seconds remaining`
      );
      return;
    }

    // Fallback to frontend calculation if backend doesn't provide seconds_remaining
    if (!analysisStatus?.next_analysis_time) {
      setNextAnalysisCountdown(0);
      return;
    }

    const updateCountdown = () => {
      try {
        const nextTime = new Date(analysisStatus.next_analysis_time).getTime();
        const now = new Date().getTime();

        // Debug logging
        console.log("Frontend Countdown Debug:", {
          next_analysis_time: analysisStatus.next_analysis_time,
          nextTime,
          now,
          isValidTime: !isNaN(nextTime),
        });

        // Check if the time is valid
        if (isNaN(nextTime)) {
          console.warn(
            "Invalid next_analysis_time:",
            analysisStatus.next_analysis_time
          );
          setNextAnalysisCountdown(0);
          return;
        }

        const diff = Math.max(0, Math.floor((nextTime - now) / 1000));
        setNextAnalysisCountdown(diff);

        console.log(`Frontend countdown updated: ${diff} seconds remaining`);
      } catch (error) {
        console.error("Error updating countdown:", error);
        setNextAnalysisCountdown(0);
      }
    };

    // Update immediately
    updateCountdown();

    // Then update every second
    const interval = setInterval(updateCountdown, 1000);

    return () => clearInterval(interval);
  }, [analysisStatus?.next_analysis_time, analysisStatus?.seconds_remaining]);

  // Also update countdown every second when using backend seconds_remaining
  useEffect(() => {
    if (
      analysisStatus?.seconds_remaining !== undefined &&
      nextAnalysisCountdown > 0
    ) {
      const interval = setInterval(() => {
        setNextAnalysisCountdown((prev) => Math.max(0, prev - 1));
      }, 1000);

      return () => clearInterval(interval);
    }
  }, [analysisStatus?.seconds_remaining, nextAnalysisCountdown]);

  const getPhaseIcon = (phase: string) => {
    switch (phase) {
      case "market_scan":
        return <ChartBarIcon className='h-5 w-5 text-blue-500' />;
      case "technical_analysis":
        return <CpuChipIcon className='h-5 w-5 text-purple-500' />;
      case "sentiment_analysis":
        return <ExclamationTriangleIcon className='h-5 w-5 text-yellow-500' />;
      case "risk_assessment":
        return <ExclamationTriangleIcon className='h-5 w-5 text-red-500' />;
      case "signal_generation":
        return (
          <ArrowPathIcon className='h-5 w-5 text-green-500 animate-spin' />
        );
      case "decision_making":
        return <CheckCircleIcon className='h-5 w-5 text-green-500' />;
      default:
        return <ClockIcon className='h-5 w-5 text-gray-500' />;
    }
  };

  const getPhaseLabel = (phase: string) => {
    switch (phase) {
      case "market_scan":
        return "Market Scanning";
      case "technical_analysis":
        return "Technical Analysis";
      case "sentiment_analysis":
        return "Sentiment Analysis";
      case "risk_assessment":
        return "Risk Assessment";
      case "signal_generation":
        return "Signal Generation";
      case "decision_making":
        return "Decision Making";
      case "idle":
        return "Idle";
      default:
        return "Unknown";
    }
  };

  const getRegimeColor = (regime: string) => {
    switch (regime.toLowerCase()) {
      case "bull":
        return "text-green-600 bg-green-100 dark:text-green-400 dark:bg-green-900/20";
      case "bear":
        return "text-red-600 bg-red-100 dark:text-red-400 dark:bg-red-900/20";
      case "range":
        return "text-yellow-600 bg-yellow-100 dark:text-yellow-400 dark:bg-yellow-900/20";
      default:
        return "text-gray-600 bg-gray-100 dark:text-gray-400 dark:bg-gray-800";
    }
  };

  const getOutcomeColor = (outcome: string) => {
    if (outcome.includes("SIGNAL_GENERATED")) {
      return "text-green-600 bg-green-100 dark:text-green-400 dark:bg-green-900/20";
    } else if (outcome.includes("REJECTED")) {
      return "text-red-600 bg-red-100 dark:text-red-400 dark:bg-red-900/20";
    } else if (outcome.includes("DEFERRED")) {
      return "text-yellow-600 bg-yellow-100 dark:text-yellow-400 dark:bg-yellow-900/20";
    }
    return "text-gray-600 bg-gray-100 dark:text-gray-400 dark:bg-gray-800";
  };

  const formatCountdown = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div className='space-y-6'>
      {/* Current Analysis Status */}
      <div className='bg-white dark:bg-gray-800 rounded-lg shadow p-6'>
        <div className='flex items-center justify-between mb-4'>
          <h3 className='text-lg font-medium text-gray-900 dark:text-white'>
            AI Analysis Status
          </h3>
          <div className='flex items-center space-x-2'>
            {analysisStatus?.is_running ? (
              <div className='flex items-center space-x-2'>
                <div className='w-2 h-2 bg-green-500 rounded-full animate-pulse'></div>
                <span className='text-sm text-green-600 dark:text-green-400'>
                  Active
                </span>
              </div>
            ) : (
              <div className='flex items-center space-x-2'>
                <div className='w-2 h-2 bg-gray-500 rounded-full'></div>
                <span className='text-sm text-gray-600 dark:text-gray-400'>
                  Idle
                </span>
              </div>
            )}
          </div>
        </div>

        {analysisStatus && (
          <div className='space-y-4'>
            {/* Current Phase */}
            <div className='flex items-center space-x-3'>
              {getPhaseIcon(analysisStatus.phase)}
              <div className='flex-1'>
                <div className='flex items-center justify-between'>
                  <span className='font-medium text-gray-900 dark:text-white'>
                    {getPhaseLabel(analysisStatus.phase)}
                  </span>
                  <span className='text-sm text-gray-500 dark:text-gray-400'>
                    {analysisStatus.progress.toFixed(0)}%
                  </span>
                </div>
                <p className='text-sm text-gray-600 dark:text-gray-400 mt-1'>
                  {analysisStatus.message}
                </p>
                {analysisStatus.current_symbol && (
                  <p className='text-sm font-medium text-blue-600 dark:text-blue-400 mt-1'>
                    Analyzing: {analysisStatus.current_symbol}
                  </p>
                )}
              </div>
            </div>

            {/* Progress Bar */}
            <div className='w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2'>
              <div
                className='bg-blue-600 h-2 rounded-full transition-all duration-300'
                style={{ width: `${analysisStatus.progress}%` }}
              ></div>
            </div>

            {/* Next Analysis Countdown */}
            {analysisStatus.phase === "idle" && (
              <div className='flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg'>
                <span className='text-sm text-gray-600 dark:text-gray-400'>
                  Next analysis in:
                </span>
                <span className='text-lg font-mono font-bold text-blue-600 dark:text-blue-400'>
                  {nextAnalysisCountdown > 0
                    ? formatCountdown(nextAnalysisCountdown)
                    : "Starting soon..."}
                </span>
              </div>
            )}

            {/* Analysis Details */}
            {analysisStatus.details &&
              Object.keys(analysisStatus.details).length > 0 && (
                <div className='grid grid-cols-2 gap-4 text-sm'>
                  {Object.entries(analysisStatus.details).map(
                    ([key, value]) => (
                      <div key={key} className='flex justify-between'>
                        <span className='text-gray-600 dark:text-gray-400 capitalize'>
                          {key.replace(/_/g, " ")}:
                        </span>
                        <span className='font-medium text-gray-900 dark:text-white'>
                          {Array.isArray(value)
                            ? value.join(", ")
                            : String(value)}
                        </span>
                      </div>
                    )
                  )}
                </div>
              )}
          </div>
        )}
      </div>

      {/* Market Regime */}
      {marketRegime && (
        <div className='bg-white dark:bg-gray-800 rounded-lg shadow p-6'>
          <h3 className='text-lg font-medium text-gray-900 dark:text-white mb-4'>
            Market Regime
          </h3>
          <div className='flex items-center justify-between'>
            <div className='flex items-center space-x-3'>
              <span
                className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getRegimeColor(
                  marketRegime.current
                )}`}
              >
                {marketRegime.current.toUpperCase()}
              </span>
              <span className='text-sm text-gray-600 dark:text-gray-400'>
                {(marketRegime.confidence * 100).toFixed(0)}% confidence
              </span>
            </div>
            <div className='text-right'>
              <p className='text-xs text-gray-500 dark:text-gray-400'>
                Updated:{" "}
                {new Date(marketRegime.last_updated).toLocaleTimeString()}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Recent AI Decisions */}
      <div className='bg-white dark:bg-gray-800 rounded-lg shadow p-6'>
        <h3 className='text-lg font-medium text-gray-900 dark:text-white mb-4'>
          Recent AI Decisions
        </h3>
        <div className='space-y-4'>
          {recentDecisions.length === 0 ? (
            <p className='text-gray-500 dark:text-gray-400 text-center py-4'>
              No recent decisions
            </p>
          ) : (
            recentDecisions.map((decision) => (
              <div
                key={decision.id}
                className='border border-gray-200 dark:border-gray-700 rounded-lg p-4'
              >
                <div className='flex items-start justify-between mb-2'>
                  <div className='flex items-center space-x-2'>
                    <span className='font-medium text-gray-900 dark:text-white'>
                      {decision.symbol}
                    </span>
                    <span
                      className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getOutcomeColor(
                        decision.outcome
                      )}`}
                    >
                      {decision.outcome.replace(/_/g, " ")}
                    </span>
                    {/* Show trade direction for executed signals */}
                    {decision.outcome.includes("SIGNAL_GENERATED") && (
                      <span
                        className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-medium ${
                          decision.outcome.includes("LONG")
                            ? "bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400"
                            : "bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400"
                        }`}
                      >
                        {decision.outcome.includes("LONG") ? "LONG" : "SHORT"}
                      </span>
                    )}
                  </div>
                  <div className='text-right'>
                    <p className='text-sm font-medium text-gray-900 dark:text-white'>
                      {(decision.confidence * 100).toFixed(0)}%
                    </p>
                    <p className='text-xs text-gray-500 dark:text-gray-400'>
                      {new Date(decision.timestamp).toLocaleTimeString()}
                    </p>
                  </div>
                </div>
                <p className='text-sm text-gray-600 dark:text-gray-400 mb-2'>
                  {decision.reasoning}
                </p>

                {/* Show trade execution details for executed signals */}
                {decision.outcome.includes("EXECUTED") && (
                  <div className='mt-3 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg'>
                    <div className='grid grid-cols-2 gap-3 text-xs'>
                      <div>
                        <span className='text-gray-500 dark:text-gray-400'>
                          Entry Price:
                        </span>
                        <span className='ml-1 font-medium text-gray-900 dark:text-white'>
                          ${decision.entry_price || "N/A"}
                        </span>
                      </div>
                      <div>
                        <span className='text-gray-500 dark:text-gray-400'>
                          Stop Loss:
                        </span>
                        <span className='ml-1 font-medium text-red-600 dark:text-red-400'>
                          ${decision.stop_loss || "N/A"}
                        </span>
                      </div>
                      <div>
                        <span className='text-gray-500 dark:text-gray-400'>
                          Stop %:
                        </span>
                        <span className='ml-1 font-medium text-red-600 dark:text-red-400'>
                          {decision.stop_loss_percentage
                            ? `${decision.stop_loss_percentage.toFixed(2)}%`
                            : "N/A"}
                        </span>
                      </div>
                      <div>
                        <span className='text-gray-500 dark:text-gray-400'>
                          Take Profit:
                        </span>
                        <span className='ml-1 font-medium text-green-600 dark:text-green-400'>
                          ${decision.take_profit_1 || "N/A"}
                        </span>
                      </div>
                    </div>
                    {decision.stop_loss_reasoning && (
                      <div className='mt-2 text-xs text-gray-600 dark:text-gray-400'>
                        <span className='font-medium'>Stop Loss Strategy:</span>{" "}
                        {decision.stop_loss_reasoning}
                      </div>
                    )}
                  </div>
                )}

                {decision.factors.length > 0 && (
                  <div className='flex flex-wrap gap-1 mt-2'>
                    {decision.factors.map((factor, index) => (
                      <span
                        key={index}
                        className='inline-flex items-center px-2 py-1 rounded-md text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                      >
                        {factor}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default LiveAnalysisPanel;
