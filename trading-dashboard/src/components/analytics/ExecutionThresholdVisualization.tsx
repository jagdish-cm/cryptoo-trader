import React, { useState, useMemo } from "react";
import { CogIcon, ChartBarIcon } from "@heroicons/react/24/outline";
import { AIDecision } from "../../types";
import {
  useThresholdData,
  useThresholdPerformanceHistory,
} from "../../hooks/api/useThresholdData";
import { LoadingState } from "../ui/feedback/EmptyStates";
import ThresholdMetricsPanel from "./thresholds/ThresholdMetricsPanel";
import DecisionAnalysisCard from "./thresholds/DecisionAnalysisCard";
import PerformanceChart from "./charts/PerformanceChart";

interface ExecutionThresholdVisualizationProps {
  aiDecisions: AIDecision[];
  className?: string;
}

const ExecutionThresholdVisualization: React.FC<
  ExecutionThresholdVisualizationProps
> = ({ aiDecisions, className = "" }) => {
  const [selectedRegime, setSelectedRegime] = useState("range");

  // Use our new custom hooks
  const {
    data: thresholdAnalysis,
    loading,
    error,
  } = useThresholdData({
    strategyMode: "dual_mode",
    marketRegime: selectedRegime,
    aiDecisions,
  });

  const { data: performanceHistory } = useThresholdPerformanceHistory(30);

  // Process data for components - ALWAYS call these hooks
  const recentDecisions = useMemo(
    () => aiDecisions.slice(0, 10),
    [aiDecisions]
  );
  const executedDecisions = useMemo(
    () => recentDecisions.filter((d) => d.executionDecision === "EXECUTED"),
    [recentDecisions]
  );
  const rejectedDecisions = useMemo(
    () => recentDecisions.filter((d) => d.executionDecision === "REJECTED"),
    [recentDecisions]
  );

  // Conditional rendering AFTER all hooks are called
  if (loading) {
    return (
      <LoadingState
        message='Loading threshold analysis...'
        className={className}
      />
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Threshold Metrics Panel */}
      <ThresholdMetricsPanel
        metrics={thresholdAnalysis?.performance || null}
        loading={loading}
        error={error}
      />

      {/* Performance Chart */}
      <PerformanceChart
        data={performanceHistory || []}
        loading={loading}
        error={error}
      />

      {/* Current Thresholds Summary */}
      <div className='bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6'>
        <div className='flex items-center space-x-2 mb-4'>
          <CogIcon className='h-5 w-5 text-gray-600 dark:text-gray-400' />
          <h4 className='text-lg font-medium text-gray-900 dark:text-white'>
            Current Execution Thresholds ({selectedRegime} market)
          </h4>
        </div>

        <div className='text-center py-8 text-gray-500 dark:text-gray-400'>
          <p>Threshold configuration and real-time scores</p>
          <p className='text-sm mt-2'>
            Individual threshold bars are now integrated into the decision
            analysis cards below
          </p>
        </div>
      </div>

      {/* Recent Execution Decisions */}
      <div className='grid grid-cols-1 lg:grid-cols-2 gap-6'>
        {/* Executed Trades */}
        <div className='bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6'>
          <div className='flex items-center space-x-2 mb-4'>
            <h4 className='text-lg font-medium text-gray-900 dark:text-white'>
              Recently Executed Trades
            </h4>
            <span className='px-2 py-1 text-xs bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-200 rounded-full'>
              {executedDecisions.length}
            </span>
          </div>

          <div className='space-y-3'>
            {executedDecisions.length > 0 ? (
              executedDecisions.map((decision) => (
                <DecisionAnalysisCard
                  key={decision.id}
                  decision={decision}
                  isExecuted={true}
                />
              ))
            ) : (
              <div className='text-center py-8 text-gray-500 dark:text-gray-400'>
                <p>No executed trades in recent decisions</p>
                <p className='text-sm'>
                  Trades will appear here when thresholds are met
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Rejected Trades */}
        <div className='bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6'>
          <div className='flex items-center space-x-2 mb-4'>
            <h4 className='text-lg font-medium text-gray-900 dark:text-white'>
              Recently Rejected Trades
            </h4>
            <span className='px-2 py-1 text-xs bg-red-100 dark:bg-red-900/20 text-red-800 dark:text-red-200 rounded-full'>
              {rejectedDecisions.length}
            </span>
          </div>

          <div className='space-y-3'>
            {rejectedDecisions.length > 0 ? (
              rejectedDecisions.map((decision) => (
                <DecisionAnalysisCard
                  key={decision.id}
                  decision={decision}
                  isExecuted={false}
                />
              ))
            ) : (
              <div className='text-center py-8 text-gray-500 dark:text-gray-400'>
                <p>No rejected trades in recent decisions</p>
                <p className='text-sm'>
                  Rejected trades will appear here with reasons
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Threshold Effectiveness */}
      <div className='bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6'>
        <div className='flex items-center space-x-2 mb-4'>
          <ChartBarIcon className='h-5 w-5 text-blue-600 dark:text-blue-400' />
          <h4 className='text-lg font-medium text-gray-900 dark:text-white'>
            Threshold Effectiveness
          </h4>
        </div>

        <div className='grid grid-cols-1 md:grid-cols-3 gap-6'>
          <div className='text-center'>
            <div className='text-3xl font-bold text-blue-600 dark:text-blue-400 mb-2'>
              {(
                (thresholdAnalysis?.performance?.thresholdEffectiveness || 0) *
                100
              ).toFixed(1)}
              %
            </div>
            <div className='text-sm text-gray-500 dark:text-gray-400'>
              Threshold Effectiveness
            </div>
            <div className='text-xs text-gray-400 dark:text-gray-500 mt-1'>
              Higher confidence gap between executed vs rejected
            </div>
          </div>

          <div className='text-center'>
            <div className='text-3xl font-bold text-green-600 dark:text-green-400 mb-2'>
              {(
                (thresholdAnalysis?.performance?.avgExecutedConfidence || 0) *
                100
              ).toFixed(1)}
              %
            </div>
            <div className='text-sm text-gray-500 dark:text-gray-400'>
              Avg Executed Confidence
            </div>
            <div className='text-xs text-gray-400 dark:text-gray-500 mt-1'>
              Average confidence of executed trades
            </div>
          </div>

          <div className='text-center'>
            <div className='text-3xl font-bold text-red-600 dark:text-red-400 mb-2'>
              {(
                (thresholdAnalysis?.performance?.avgRejectedConfidence || 0) *
                100
              ).toFixed(1)}
              %
            </div>
            <div className='text-sm text-gray-500 dark:text-gray-400'>
              Avg Rejected Confidence
            </div>
            <div className='text-xs text-gray-400 dark:text-gray-500 mt-1'>
              Average confidence of rejected trades
            </div>
          </div>
        </div>

        <div className='mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg'>
          <div className='text-sm text-blue-800 dark:text-blue-200'>
            <strong>Insight:</strong>{" "}
            {(thresholdAnalysis?.performance?.thresholdEffectiveness || 0) > 0.3
              ? "Thresholds are effectively filtering trades - executed trades have significantly higher confidence than rejected ones."
              : "Thresholds may need adjustment - the confidence gap between executed and rejected trades is small."}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ExecutionThresholdVisualization;
