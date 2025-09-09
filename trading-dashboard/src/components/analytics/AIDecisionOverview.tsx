import React from "react";
import {
  CpuChipIcon,
  ChartBarIcon,
  ClockIcon,
  CheckCircleIcon,
  XMarkIcon,
  ExclamationTriangleIcon,
} from "@heroicons/react/24/outline";
import MetricCard from "../ui/MetricCard";
import { AIDecision, SentimentAnalysis } from "../../types";

interface AIDecisionOverviewProps {
  decisions: AIDecision[];
  sentimentData: SentimentAnalysis[];
  className?: string;
}

const AIDecisionOverview: React.FC<AIDecisionOverviewProps> = ({
  decisions,
  sentimentData,
  className = "",
}) => {
  const calculateExecutionRate = (decisions: AIDecision[]): number => {
    if (!decisions || decisions.length === 0) return 0;

    const executedDecisions = decisions.filter(
      (decision) => decision.executionDecision === "EXECUTED"
    );

    return Math.round((executedDecisions.length / decisions.length) * 100);
  };

  const calculateAverageConfidence = (decisions: AIDecision[]): number => {
    if (!decisions || decisions.length === 0) return 0;

    const totalConfidence = decisions.reduce(
      (sum, decision) => sum + decision.confidence,
      0
    );

    return Math.round((totalConfidence / decisions.length) * 100);
  };

  const calculateAverageProcessingTime = (
    sentimentData: SentimentAnalysis[]
  ): string => {
    if (!sentimentData || sentimentData.length === 0) return "0s";

    const totalTime = sentimentData.reduce(
      (sum, data) => sum + (data.processingTime || 0),
      0
    );
    const avgTime = totalTime / sentimentData.length;

    if (avgTime < 1000) {
      return `${Math.round(avgTime)}ms`;
    } else {
      return `${(avgTime / 1000).toFixed(1)}s`;
    }
  };

  const getDecisionCounts = (decisions: AIDecision[]) => {
    const executed = decisions.filter(
      (d) => d.executionDecision === "EXECUTED"
    ).length;
    const rejected = decisions.filter(
      (d) => d.executionDecision === "REJECTED"
    ).length;
    const pending = decisions.filter(
      (d) => !d.executionDecision || d.executionDecision === "PENDING"
    ).length;

    return { executed, rejected, pending };
  };

  const executionRate = calculateExecutionRate(decisions);
  const avgConfidence = calculateAverageConfidence(decisions);
  const avgProcessingTime = calculateAverageProcessingTime(sentimentData);
  const { executed, rejected, pending } = getDecisionCounts(decisions);

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Main Metrics */}
      <div className='grid grid-cols-1 md:grid-cols-4 gap-6'>
        <MetricCard
          title='Total Decisions'
          value={decisions.length}
          icon={CpuChipIcon}
          iconColor='text-primary-600'
          subtitle={`${decisions.length} decisions processed`}
        />

        <MetricCard
          title='Execution Rate'
          value={`${executionRate}%`}
          icon={ChartBarIcon}
          iconColor='text-success-600'
          valueColor={
            executionRate >= 50
              ? "text-success-600 dark:text-success-400"
              : "text-warning-600 dark:text-warning-400"
          }
          subtitle={`${executed} of ${decisions.length} executed`}
        />

        <MetricCard
          title='Avg Confidence'
          value={`${avgConfidence}%`}
          icon={CheckCircleIcon}
          iconColor='text-blue-600'
          valueColor={
            avgConfidence >= 70
              ? "text-green-600 dark:text-green-400"
              : avgConfidence >= 50
                ? "text-yellow-600 dark:text-yellow-400"
                : "text-red-600 dark:text-red-400"
          }
          subtitle='Average decision confidence'
        />

        <MetricCard
          title='Processing Time'
          value={avgProcessingTime}
          icon={ClockIcon}
          iconColor='text-purple-600'
          subtitle='Average analysis time'
        />
      </div>

      {/* Decision Breakdown */}
      <div className='bg-white dark:bg-gray-800 rounded-lg shadow p-6'>
        <h3 className='text-lg font-medium text-gray-900 dark:text-white mb-4'>
          Decision Breakdown
        </h3>
        <div className='grid grid-cols-1 md:grid-cols-3 gap-6'>
          {/* Executed */}
          <div className='text-center p-4 bg-green-50 dark:bg-green-900/20 rounded-lg'>
            <div className='flex items-center justify-center mb-2'>
              <CheckCircleIcon className='h-8 w-8 text-green-600 dark:text-green-400' />
            </div>
            <div className='text-2xl font-bold text-green-600 dark:text-green-400'>
              {executed}
            </div>
            <div className='text-sm text-gray-600 dark:text-gray-400'>
              Executed Decisions
            </div>
            <div className='text-xs text-green-600 dark:text-green-400 mt-1'>
              {decisions.length > 0
                ? Math.round((executed / decisions.length) * 100)
                : 0}
              % of total
            </div>
          </div>

          {/* Rejected */}
          <div className='text-center p-4 bg-red-50 dark:bg-red-900/20 rounded-lg'>
            <div className='flex items-center justify-center mb-2'>
              <XMarkIcon className='h-8 w-8 text-red-600 dark:text-red-400' />
            </div>
            <div className='text-2xl font-bold text-red-600 dark:text-red-400'>
              {rejected}
            </div>
            <div className='text-sm text-gray-600 dark:text-gray-400'>
              Rejected Decisions
            </div>
            <div className='text-xs text-red-600 dark:text-red-400 mt-1'>
              {decisions.length > 0
                ? Math.round((rejected / decisions.length) * 100)
                : 0}
              % of total
            </div>
          </div>

          {/* Pending */}
          <div className='text-center p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg'>
            <div className='flex items-center justify-center mb-2'>
              <ExclamationTriangleIcon className='h-8 w-8 text-yellow-600 dark:text-yellow-400' />
            </div>
            <div className='text-2xl font-bold text-yellow-600 dark:text-yellow-400'>
              {pending}
            </div>
            <div className='text-sm text-gray-600 dark:text-gray-400'>
              Pending Decisions
            </div>
            <div className='text-xs text-yellow-600 dark:text-yellow-400 mt-1'>
              {decisions.length > 0
                ? Math.round((pending / decisions.length) * 100)
                : 0}
              % of total
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AIDecisionOverview;
