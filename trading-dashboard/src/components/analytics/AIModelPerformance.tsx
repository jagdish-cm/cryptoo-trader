import React, { useState } from "react";
import {
  CheckCircleIcon,
  LightBulbIcon,
  ChartBarIcon,
  ClockIcon,
  CpuChipIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
} from "@heroicons/react/24/outline";
import { AIDecision } from "../../types";
import ModelComparisonChart from "./performance/ModelComparisonChart";
import AccuracyTrends from "./performance/AccuracyTrends";

interface AIModelPerformanceProps {
  decisions: AIDecision[];
  className?: string;
}

const AIModelPerformance: React.FC<AIModelPerformanceProps> = ({
  decisions,
  className = "",
}) => {
  const [activeTab, setActiveTab] = useState<
    "overview" | "comparison" | "trends"
  >("overview");

  const calculateModelMetrics = (decisions: AIDecision[]) => {
    if (!decisions || decisions.length === 0) {
      return {
        accuracy: 0,
        precision: 0,
        recall: 0,
        f1Score: 0,
        avgResponseTime: "0s",
        totalDecisions: 0,
        successfulDecisions: 0,
        improvementRate: 0,
      };
    }

    const successfulDecisions = decisions.filter(
      (d) => d.outcome?.result === "SUCCESS"
    );
    const accuracy = (successfulDecisions.length / decisions.length) * 100;

    // Calculate precision based on high-confidence decisions that were successful
    const highConfidenceDecisions = decisions.filter(
      (d) => d.confidence >= 0.8
    );
    const successfulHighConfidence = highConfidenceDecisions.filter(
      (d) => d.outcome?.result === "SUCCESS"
    );
    const precision =
      highConfidenceDecisions.length > 0
        ? (successfulHighConfidence.length / highConfidenceDecisions.length) *
          100
        : 0;

    // Calculate recall based on successful decisions vs total opportunities
    const recall = accuracy; // Same as accuracy in this context

    // Calculate F1 Score
    const f1Score =
      precision + recall > 0
        ? (2 * precision * recall) / (precision + recall)
        : 0;

    // Calculate average response time from confidence scores (proxy for processing time)
    const avgConfidence =
      decisions.reduce((sum, d) => sum + d.confidence, 0) / decisions.length;
    const avgResponseTime = `${(1 + (1 - avgConfidence)).toFixed(1)}s`;

    // Calculate improvement rate (comparing recent vs older decisions)
    const midPoint = Math.floor(decisions.length / 2);
    const recentDecisions = decisions.slice(0, midPoint);
    const olderDecisions = decisions.slice(midPoint);

    const recentAccuracy =
      recentDecisions.length > 0
        ? (recentDecisions.filter((d) => d.outcome?.result === "SUCCESS")
            .length /
            recentDecisions.length) *
          100
        : 0;
    const olderAccuracy =
      olderDecisions.length > 0
        ? (olderDecisions.filter((d) => d.outcome?.result === "SUCCESS")
            .length /
            olderDecisions.length) *
          100
        : 0;

    const improvementRate = recentAccuracy - olderAccuracy;

    return {
      accuracy: Math.round(accuracy * 10) / 10,
      precision: Math.round(precision * 10) / 10,
      recall: Math.round(recall * 10) / 10,
      f1Score: Math.round(f1Score * 10) / 10,
      avgResponseTime,
      totalDecisions: decisions.length,
      successfulDecisions: successfulDecisions.length,
      improvementRate: Math.round(improvementRate * 10) / 10,
    };
  };

  const modelMetrics = calculateModelMetrics(decisions);

  const performanceMetrics = [
    {
      title: "Accuracy",
      value: `${modelMetrics.accuracy}%`,
      icon: CheckCircleIcon,
      bgColor: "bg-success-100 dark:bg-success-900/20",
      iconColor: "text-success-600 dark:text-success-400",
      trend: modelMetrics.improvementRate,
    },
    {
      title: "Precision",
      value: `${modelMetrics.precision}%`,
      icon: LightBulbIcon,
      bgColor: "bg-primary-100 dark:bg-primary-900/20",
      iconColor: "text-primary-600 dark:text-primary-400",
    },
    {
      title: "F1 Score",
      value: `${modelMetrics.f1Score}%`,
      icon: ChartBarIcon,
      bgColor: "bg-warning-100 dark:bg-warning-900/20",
      iconColor: "text-warning-600 dark:text-warning-400",
    },
    {
      title: "Avg Response",
      value: modelMetrics.avgResponseTime,
      icon: ClockIcon,
      bgColor: "bg-secondary-100 dark:bg-secondary-900/20",
      iconColor: "text-secondary-600 dark:text-secondary-400",
    },
  ];

  const tabs = [
    { key: "overview", label: "Overview", icon: CpuChipIcon },
    { key: "comparison", label: "Model Comparison", icon: ChartBarIcon },
    { key: "trends", label: "Accuracy Trends", icon: ArrowTrendingUpIcon },
  ];

  return (
    <div className={`bg-white dark:bg-gray-800 rounded-lg shadow ${className}`}>
      {/* Header with Tabs */}
      <div className='px-6 py-4 border-b border-gray-200 dark:border-gray-700'>
        <div className='flex items-center justify-between'>
          <h3 className='text-lg font-medium text-gray-900 dark:text-white'>
            AI Model Performance
          </h3>

          {/* Tab Navigation */}
          <div className='flex items-center space-x-1'>
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key as any)}
                  className={`flex items-center space-x-2 px-3 py-2 text-sm rounded-md transition-colors ${
                    activeTab === tab.key
                      ? "bg-primary-100 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300"
                      : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                  }`}
                >
                  <Icon className='h-4 w-4' />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className='p-6'>
        {/* Overview Tab */}
        {activeTab === "overview" && (
          <div className='space-y-6'>
            {/* Performance Metrics Grid */}
            <div className='grid grid-cols-1 md:grid-cols-4 gap-6'>
              {performanceMetrics.map((metric, index) => {
                const Icon = metric.icon;
                return (
                  <div key={index} className='text-center'>
                    <div
                      className={`flex items-center justify-center w-12 h-12 mx-auto mb-2 ${metric.bgColor} rounded-lg`}
                    >
                      <Icon className={`h-6 w-6 ${metric.iconColor}`} />
                    </div>
                    <div className='flex items-center justify-center space-x-2'>
                      <p className='text-2xl font-semibold text-gray-900 dark:text-white'>
                        {metric.value}
                      </p>
                      {metric.trend !== undefined && (
                        <div
                          className={`flex items-center space-x-1 ${
                            metric.trend >= 0
                              ? "text-green-600 dark:text-green-400"
                              : "text-red-600 dark:text-red-400"
                          }`}
                        >
                          {metric.trend >= 0 ? (
                            <ArrowTrendingUpIcon className='h-3 w-3' />
                          ) : (
                            <ArrowTrendingDownIcon className='h-3 w-3' />
                          )}
                          <span className='text-xs'>
                            {Math.abs(metric.trend).toFixed(1)}%
                          </span>
                        </div>
                      )}
                    </div>
                    <p className='text-sm text-gray-500 dark:text-gray-400'>
                      {metric.title}
                    </p>
                  </div>
                );
              })}
            </div>

            {/* Additional Statistics */}
            <div className='grid grid-cols-1 md:grid-cols-3 gap-6'>
              <div className='text-center p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg'>
                <div className='text-2xl font-bold text-blue-600 dark:text-blue-400'>
                  {modelMetrics.totalDecisions}
                </div>
                <div className='text-sm text-gray-600 dark:text-gray-400'>
                  Total Decisions
                </div>
              </div>

              <div className='text-center p-4 bg-green-50 dark:bg-green-900/20 rounded-lg'>
                <div className='text-2xl font-bold text-green-600 dark:text-green-400'>
                  {modelMetrics.successfulDecisions}
                </div>
                <div className='text-sm text-gray-600 dark:text-gray-400'>
                  Successful Decisions
                </div>
              </div>

              <div className='text-center p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg'>
                <div
                  className={`text-2xl font-bold ${
                    modelMetrics.improvementRate >= 0
                      ? "text-green-600 dark:text-green-400"
                      : "text-red-600 dark:text-red-400"
                  }`}
                >
                  {modelMetrics.improvementRate >= 0 ? "+" : ""}
                  {modelMetrics.improvementRate}%
                </div>
                <div className='text-sm text-gray-600 dark:text-gray-400'>
                  Improvement Rate
                </div>
              </div>
            </div>

            {/* Performance Insights */}
            <div className='p-4 bg-gray-50 dark:bg-gray-700 rounded-lg'>
              <h5 className='text-sm font-medium text-gray-900 dark:text-white mb-2'>
                Performance Insights
              </h5>
              <div className='text-sm text-gray-600 dark:text-gray-400 space-y-1'>
                {modelMetrics.accuracy >= 80 && (
                  <p className='text-green-600 dark:text-green-400'>
                    • Excellent accuracy performance ({modelMetrics.accuracy}%)
                  </p>
                )}
                {modelMetrics.precision >= 75 && (
                  <p className='text-blue-600 dark:text-blue-400'>
                    • High precision in confident decisions (
                    {modelMetrics.precision}%)
                  </p>
                )}
                {modelMetrics.improvementRate > 5 && (
                  <p className='text-green-600 dark:text-green-400'>
                    • Strong improvement trend (+{modelMetrics.improvementRate}
                    %)
                  </p>
                )}
                {modelMetrics.improvementRate < -5 && (
                  <p className='text-red-600 dark:text-red-400'>
                    • Performance decline detected (
                    {modelMetrics.improvementRate}%)
                  </p>
                )}
                <p>• Total decisions analyzed: {modelMetrics.totalDecisions}</p>
                <p>
                  • Success rate:{" "}
                  {(
                    (modelMetrics.successfulDecisions /
                      modelMetrics.totalDecisions) *
                    100
                  ).toFixed(1)}
                  %
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Model Comparison Tab */}
        {activeTab === "comparison" && (
          <ModelComparisonChart decisions={decisions} />
        )}

        {/* Accuracy Trends Tab */}
        {activeTab === "trends" && <AccuracyTrends decisions={decisions} />}
      </div>
    </div>
  );
};

export default AIModelPerformance;
