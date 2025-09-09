/**
 * Model comparison chart component for comparing different AI models
 */

import React, { useState } from "react";
import {
  ChartBarIcon,
  ArrowsRightLeftIcon,
  Cog6ToothIcon,
} from "@heroicons/react/24/outline";
import { BaseComponentProps } from "../../../types/common/base";
import { AIDecision } from "../../../types";

interface ModelMetrics {
  modelName: string;
  accuracy: number;
  precision: number;
  recall: number;
  f1Score: number;
  avgResponseTime: number;
  totalDecisions: number;
  successfulDecisions: number;
}

interface ModelComparisonChartProps extends BaseComponentProps {
  decisions: AIDecision[];
  loading?: boolean;
  error?: string | null;
}

/**
 * Calculate metrics for each model
 */
const calculateModelMetrics = (decisions: AIDecision[]): ModelMetrics[] => {
  // Group decisions by model (using reasoning type as proxy for model)
  const modelGroups = decisions.reduce(
    (acc, decision) => {
      const modelName = decision.reasoning?.modelVersion || "Default Model";
      if (!acc[modelName]) {
        acc[modelName] = [];
      }
      acc[modelName].push(decision);
      return acc;
    },
    {} as Record<string, AIDecision[]>
  );

  return Object.entries(modelGroups).map(([modelName, modelDecisions]) => {
    const successfulDecisions = modelDecisions.filter(
      (d) => d.outcome?.result === "SUCCESS"
    );
    const executedDecisions = modelDecisions.filter(
      (d) => d.executionDecision === "EXECUTED"
    );
    const highConfidenceDecisions = modelDecisions.filter(
      (d) => d.confidence >= 0.8
    );
    const successfulHighConfidence = highConfidenceDecisions.filter(
      (d) => d.outcome?.result === "SUCCESS"
    );

    const accuracy =
      modelDecisions.length > 0
        ? (successfulDecisions.length / modelDecisions.length) * 100
        : 0;

    const precision =
      highConfidenceDecisions.length > 0
        ? (successfulHighConfidence.length / highConfidenceDecisions.length) *
          100
        : 0;

    const recall =
      modelDecisions.length > 0
        ? (successfulDecisions.length / modelDecisions.length) * 100
        : 0;

    const f1Score =
      precision + recall > 0
        ? (2 * precision * recall) / (precision + recall)
        : 0;

    const avgResponseTime =
      modelDecisions.reduce((sum, d) => {
        // Use confidence as proxy for processing complexity
        return sum + (1 + (1 - d.confidence)) * 1000; // Convert to ms
      }, 0) / modelDecisions.length;

    return {
      modelName,
      accuracy,
      precision,
      recall,
      f1Score,
      avgResponseTime,
      totalDecisions: modelDecisions.length,
      successfulDecisions: successfulDecisions.length,
    };
  });
};

/**
 * Model comparison chart component
 */
export const ModelComparisonChart: React.FC<ModelComparisonChartProps> = ({
  decisions,
  loading = false,
  error = null,
  className = "",
  testId,
}) => {
  const [selectedMetric, setSelectedMetric] =
    useState<keyof ModelMetrics>("accuracy");
  const [chartType, setChartType] = useState<"bar" | "radar">("bar");

  const modelMetrics = calculateModelMetrics(decisions);
  const metrics = ["accuracy", "precision", "recall", "f1Score"] as const;

  if (loading) {
    return (
      <div
        className={`bg-white dark:bg-gray-800 rounded-lg shadow ${className}`}
        data-testid={testId}
      >
        <div className='px-6 py-4 border-b border-gray-200 dark:border-gray-700'>
          <h3 className='text-lg font-medium text-gray-900 dark:text-white'>
            Model Comparison
          </h3>
        </div>
        <div className='p-6'>
          <div className='h-64 bg-gray-50 dark:bg-gray-700 rounded-lg animate-pulse'></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div
        className={`bg-white dark:bg-gray-800 rounded-lg shadow ${className}`}
        data-testid={testId}
      >
        <div className='px-6 py-4 border-b border-gray-200 dark:border-gray-700'>
          <h3 className='text-lg font-medium text-gray-900 dark:text-white'>
            Model Comparison
          </h3>
        </div>
        <div className='p-6'>
          <div className='text-center text-red-600 dark:text-red-400'>
            <p>Error loading model comparison: {error}</p>
          </div>
        </div>
      </div>
    );
  }

  if (modelMetrics.length === 0) {
    return (
      <div
        className={`bg-white dark:bg-gray-800 rounded-lg shadow ${className}`}
        data-testid={testId}
      >
        <div className='px-6 py-4 border-b border-gray-200 dark:border-gray-700'>
          <h3 className='text-lg font-medium text-gray-900 dark:text-white'>
            Model Comparison
          </h3>
        </div>
        <div className='p-6'>
          <div className='text-center py-8 text-gray-500 dark:text-gray-400'>
            <ChartBarIcon className='mx-auto h-12 w-12 mb-4' />
            <p>No model data available for comparison</p>
            <p className='text-sm mt-1'>
              AI decisions will appear here once models are active
            </p>
          </div>
        </div>
      </div>
    );
  }

  const maxValue = Math.max(
    ...modelMetrics.map((m) => m[selectedMetric] as number)
  );

  return (
    <div
      className={`bg-white dark:bg-gray-800 rounded-lg shadow ${className}`}
      data-testid={testId}
    >
      {/* Header */}
      <div className='px-6 py-4 border-b border-gray-200 dark:border-gray-700'>
        <div className='flex items-center justify-between'>
          <h3 className='text-lg font-medium text-gray-900 dark:text-white'>
            Model Comparison
          </h3>

          <div className='flex items-center space-x-4'>
            {/* Metric Selector */}
            <select
              value={selectedMetric}
              onChange={(e) =>
                setSelectedMetric(e.target.value as keyof ModelMetrics)
              }
              className='px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white'
            >
              <option value='accuracy'>Accuracy</option>
              <option value='precision'>Precision</option>
              <option value='recall'>Recall</option>
              <option value='f1Score'>F1 Score</option>
            </select>

            {/* Chart Type Toggle */}
            <button
              onClick={() =>
                setChartType(chartType === "bar" ? "radar" : "bar")
              }
              className='p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors'
              title={`Switch to ${chartType === "bar" ? "radar" : "bar"} chart`}
            >
              <ArrowsRightLeftIcon className='h-4 w-4' />
            </button>

            <button
              className='p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors'
              title='Chart Settings'
            >
              <Cog6ToothIcon className='h-4 w-4' />
            </button>
          </div>
        </div>
      </div>

      <div className='p-6'>
        {/* Chart Description */}
        <div className='mb-4'>
          <p className='text-sm text-gray-600 dark:text-gray-400'>
            Comparing {selectedMetric} across {modelMetrics.length} AI model
            {modelMetrics.length !== 1 ? "s" : ""}
          </p>
        </div>

        {/* Bar Chart */}
        {chartType === "bar" && (
          <div className='h-64 bg-gray-50 dark:bg-gray-700 rounded-lg p-4'>
            <div className='flex items-end justify-between h-full space-x-2'>
              {modelMetrics.map((model, index) => {
                const value = model[selectedMetric] as number;
                const height = maxValue > 0 ? (value / maxValue) * 80 : 0;

                return (
                  <div
                    key={index}
                    className='flex-1 flex flex-col items-center'
                  >
                    <div
                      className='w-full bg-primary-500 dark:bg-primary-400 rounded-t transition-all duration-300 hover:bg-primary-600 dark:hover:bg-primary-300'
                      style={{ height: `${height}%` }}
                      title={`${model.modelName}: ${value.toFixed(1)}${selectedMetric === "avgResponseTime" ? "ms" : "%"}`}
                    />
                    <div className='text-xs text-gray-500 dark:text-gray-400 mt-2 text-center'>
                      <div className='font-medium'>{model.modelName}</div>
                      <div className='mt-1'>
                        {value.toFixed(1)}
                        {selectedMetric === "avgResponseTime" ? "ms" : "%"}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Radar Chart Placeholder */}
        {chartType === "radar" && (
          <div className='h-64 bg-gray-50 dark:bg-gray-700 rounded-lg p-4 flex items-center justify-center'>
            <div className='text-center text-gray-500 dark:text-gray-400'>
              <ChartBarIcon className='mx-auto h-12 w-12 mb-4' />
              <p>Radar chart visualization</p>
              <p className='text-sm mt-1'>Multi-dimensional model comparison</p>
            </div>
          </div>
        )}

        {/* Model Details Table */}
        <div className='mt-6 overflow-x-auto'>
          <table className='min-w-full divide-y divide-gray-200 dark:divide-gray-700'>
            <thead className='bg-gray-50 dark:bg-gray-700'>
              <tr>
                <th className='px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider'>
                  Model
                </th>
                <th className='px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider'>
                  Accuracy
                </th>
                <th className='px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider'>
                  Precision
                </th>
                <th className='px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider'>
                  Recall
                </th>
                <th className='px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider'>
                  F1 Score
                </th>
                <th className='px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider'>
                  Decisions
                </th>
              </tr>
            </thead>
            <tbody className='bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700'>
              {modelMetrics.map((model, index) => (
                <tr
                  key={index}
                  className='hover:bg-gray-50 dark:hover:bg-gray-700'
                >
                  <td className='px-4 py-2 whitespace-nowrap'>
                    <div className='text-sm font-medium text-gray-900 dark:text-white'>
                      {model.modelName}
                    </div>
                  </td>
                  <td className='px-4 py-2 whitespace-nowrap'>
                    <div className='text-sm text-gray-900 dark:text-white'>
                      {model.accuracy.toFixed(1)}%
                    </div>
                  </td>
                  <td className='px-4 py-2 whitespace-nowrap'>
                    <div className='text-sm text-gray-900 dark:text-white'>
                      {model.precision.toFixed(1)}%
                    </div>
                  </td>
                  <td className='px-4 py-2 whitespace-nowrap'>
                    <div className='text-sm text-gray-900 dark:text-white'>
                      {model.recall.toFixed(1)}%
                    </div>
                  </td>
                  <td className='px-4 py-2 whitespace-nowrap'>
                    <div className='text-sm text-gray-900 dark:text-white'>
                      {model.f1Score.toFixed(1)}%
                    </div>
                  </td>
                  <td className='px-4 py-2 whitespace-nowrap'>
                    <div className='text-sm text-gray-900 dark:text-white'>
                      {model.totalDecisions}
                    </div>
                    <div className='text-xs text-gray-500 dark:text-gray-400'>
                      {model.successfulDecisions} successful
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Performance Insights */}
        <div className='mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg'>
          <h5 className='text-sm font-medium text-blue-800 dark:text-blue-200 mb-2'>
            Performance Insights
          </h5>
          <div className='text-sm text-blue-700 dark:text-blue-300 space-y-1'>
            {modelMetrics.length > 1 && (
              <>
                <p>
                  • Best performing model:{" "}
                  {
                    modelMetrics.reduce((best, current) =>
                      current[selectedMetric] > best[selectedMetric]
                        ? current
                        : best
                    ).modelName
                  }
                </p>
                <p>
                  • Average {selectedMetric}:{" "}
                  {(
                    modelMetrics.reduce(
                      (sum, m) => sum + (m[selectedMetric] as number),
                      0
                    ) / modelMetrics.length
                  ).toFixed(1)}
                  {selectedMetric === "avgResponseTime" ? "ms" : "%"}
                </p>
              </>
            )}
            <p>
              • Total decisions analyzed:{" "}
              {modelMetrics.reduce((sum, m) => sum + m.totalDecisions, 0)}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ModelComparisonChart;
