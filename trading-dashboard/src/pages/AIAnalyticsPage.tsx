import React, { useState, Suspense } from "react";
import {
  CpuChipIcon,
  XMarkIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  InformationCircleIcon,
  CheckCircleIcon,
  ClockIcon,
  ShieldCheckIcon,
} from "@heroicons/react/24/outline";
import { AIDecision } from "../types";

// Lazy load heavy analytics components for better performance
const AIDecisionOverview = React.lazy(
  () => import("../components/analytics/AIDecisionOverview")
);
const AIDecisionsList = React.lazy(
  () => import("../components/analytics/AIDecisionsList")
);
const AIModelPerformance = React.lazy(
  () => import("../components/analytics/AIModelPerformance")
);
const ExecutionThresholdVisualization = React.lazy(
  () => import("../components/analytics/ExecutionThresholdVisualization")
);
const DecisionFilters = React.lazy(
  () => import("../components/analytics/decisions/DecisionFilters")
);

// Import new hooks
import { useAIAnalytics } from "../hooks/ai/useAIAnalytics";

const AIAnalyticsPage: React.FC = () => {
  // State management
  const [selectedDecision, setSelectedDecision] = useState<AIDecision | null>(
    null
  );
  const [showDecisionModal, setShowDecisionModal] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  // Use the comprehensive AI analytics hook
  const {
    decisions,
    filteredDecisions,
    decisionsLoading,
    decisionsError,
    sentimentData,
    overallMetrics,
    modelPerformances,
    accuracyTrends,
    performanceLoading,
    performanceError,
    totalDecisions,
    executionRate,
    averageConfidence,
    performanceTrend,
    refresh,
    executeDecision,
    rejectDecision,
    filters,
    setFilters,
    clearFilters,
    availableSymbols,
    availableTypes,
    timeRange,
    setTimeRange,
    getBestPerformingModel,
    getWorstPerformingModel,
  } = useAIAnalytics({
    autoRefresh: true,
    refreshInterval: 30000,
    timeRange: "7d",
  });

  const isLoading = decisionsLoading || performanceLoading;

  // Event handlers
  const handleDecisionClick = (decision: AIDecision) => {
    setSelectedDecision(decision);
    setShowDecisionModal(true);
  };

  const closeDecisionModal = () => {
    setShowDecisionModal(false);
    setSelectedDecision(null);
  };

  const closeSentimentModal = () => {
    setSelectedDecision(null);
  };

  // Helper functions
  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return "text-success-600 dark:text-success-400";
    if (confidence >= 0.6) return "text-warning-600 dark:text-warning-400";
    return "text-danger-600 dark:text-danger-400";
  };

  const getSentimentColor = (sentiment: string) => {
    switch (sentiment) {
      case "POSITIVE":
        return "text-success-600 bg-success-100 dark:text-success-400 dark:bg-success-900/20";
      case "NEGATIVE":
        return "text-danger-600 bg-danger-100 dark:text-danger-400 dark:bg-danger-900/20";
      default:
        return "text-gray-600 bg-gray-100 dark:text-gray-400 dark:bg-gray-800";
    }
  };

  const formatTimestamp = (timestamp: string | Date) => {
    try {
      const date = new Date(timestamp);
      const istOptions: Intl.DateTimeFormatOptions = {
        timeZone: "Asia/Kolkata",
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: true,
      };
      return date.toLocaleString("en-IN", istOptions);
    } catch {
      return "Invalid timestamp";
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <div className='flex items-center justify-center h-64'>
        <div className='animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600'></div>
        <span className='ml-3 text-gray-600 dark:text-gray-400'>
          Loading AI analytics data...
        </span>
      </div>
    );
  }

  // Empty state
  if (decisions.length === 0 && sentimentData.length === 0 && !isLoading) {
    return (
      <div className='space-y-6'>
        <div className='text-center py-12'>
          <CpuChipIcon className='mx-auto h-12 w-12 text-gray-400' />
          <h3 className='mt-2 text-sm font-medium text-gray-900 dark:text-white'>
            No AI Analytics Data
          </h3>
          <p className='mt-1 text-sm text-gray-500 dark:text-gray-400'>
            The AI trading system hasn't generated any decisions or sentiment
            analysis yet.
            {decisionsError && (
              <span className='block mt-2 text-red-600 dark:text-red-400'>
                Error loading AI decisions: {decisionsError}
              </span>
            )}
            {performanceError && (
              <span className='block mt-2 text-red-600 dark:text-red-400'>
                Error loading performance data: {performanceError}
              </span>
            )}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className='space-y-6'>
      {/* Page Header with Controls */}
      <div className='flex items-center justify-between'>
        <div>
          <h1 className='text-2xl font-bold text-gray-900 dark:text-white'>
            AI Analytics Dashboard
          </h1>
          <p className='text-sm text-gray-500 dark:text-gray-400 mt-1'>
            Monitor AI decision-making and performance metrics
          </p>
        </div>

        <div className='flex items-center space-x-4'>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center space-x-2 px-4 py-2 text-sm rounded-md transition-colors ${
              showFilters
                ? "bg-primary-100 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300"
                : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 border border-gray-300 dark:border-gray-600"
            }`}
          >
            <svg
              className='h-4 w-4'
              fill='none'
              viewBox='0 0 24 24'
              stroke='currentColor'
            >
              <path
                strokeLinecap='round'
                strokeLinejoin='round'
                strokeWidth={2}
                d='M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.707A1 1 0 013 7V4z'
              />
            </svg>
            <span>{showFilters ? "Hide Filters" : "Show Filters"}</span>
          </button>

          <button
            onClick={refresh}
            className='flex items-center space-x-2 px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-md hover:bg-primary-700 transition-colors'
          >
            <svg
              className='h-4 w-4'
              fill='none'
              viewBox='0 0 24 24'
              stroke='currentColor'
            >
              <path
                strokeLinecap='round'
                strokeLinejoin='round'
                strokeWidth={2}
                d='M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15'
              />
            </svg>
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* AI Decision Overview */}
      <Suspense
        fallback={
          <div className='h-32 bg-gray-100 dark:bg-gray-700 rounded-lg animate-pulse'></div>
        }
      >
        <AIDecisionOverview
          decisions={decisions}
          sentimentData={sentimentData}
        />
      </Suspense>

      {/* Advanced Filters */}
      {showFilters && (
        <Suspense
          fallback={
            <div className='h-20 bg-gray-100 dark:bg-gray-700 rounded-lg animate-pulse'></div>
          }
        >
          <DecisionFilters
            searchTerm={filters.searchTerm}
            onSearchChange={(term) => setFilters({ searchTerm: term })}
            selectedSymbol={filters.symbol}
            onSymbolChange={(symbol) => setFilters({ symbol })}
            selectedType={filters.type}
            onTypeChange={(type) => setFilters({ type })}
            selectedStatus={filters.status}
            onStatusChange={(status) => setFilters({ status })}
            confidenceRange={filters.confidenceRange}
            onConfidenceRangeChange={(range) =>
              setFilters({ confidenceRange: range })
            }
            dateRange={filters.dateRange}
            onDateRangeChange={(range) => setFilters({ dateRange: range })}
            availableSymbols={availableSymbols}
            availableTypes={availableTypes}
            onClearFilters={clearFilters}
          />
        </Suspense>
      )}

      <div className='grid grid-cols-1 lg:grid-cols-2 gap-6'>
        {/* Enhanced Recent AI Decisions with Pagination */}
        <Suspense
          fallback={
            <div className='h-64 bg-gray-100 dark:bg-gray-700 rounded-lg animate-pulse'></div>
          }
        >
          <AIDecisionsList
            decisions={decisions}
            onDecisionClick={handleDecisionClick}
          />
        </Suspense>

        {/* Sentiment Analysis */}
        <div className='bg-white dark:bg-gray-800 rounded-lg shadow'>
          <div className='px-6 py-4 border-b border-gray-200 dark:border-gray-700'>
            <h3 className='text-lg font-medium text-gray-900 dark:text-white'>
              Sentiment Analysis
            </h3>
          </div>
          <div className='p-6'>
            <div className='space-y-4'>
              {sentimentData.map((data, index) => (
                <div
                  key={index}
                  className='p-4 bg-gray-50 dark:bg-gray-700 rounded-lg'
                >
                  <div className='flex items-center justify-between mb-3'>
                    <span className='font-medium text-gray-900 dark:text-white'>
                      {data.symbol}
                    </span>
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getSentimentColor(data.sentiment)}`}
                    >
                      {data.sentiment}
                    </span>
                  </div>

                  <div className='grid grid-cols-2 gap-4 mb-3'>
                    <div>
                      <p className='text-sm text-gray-500 dark:text-gray-400'>
                        News Impact
                      </p>
                      <div className='w-full bg-gray-200 dark:bg-gray-600 rounded-full h-2'>
                        <div
                          className='bg-primary-600 h-2 rounded-full'
                          style={{ width: `${data.newsImpact * 100}%` }}
                        ></div>
                      </div>
                      <p className='text-xs text-gray-500 dark:text-gray-400 mt-1'>
                        {Math.round(data.newsImpact * 100)}%
                      </p>
                    </div>
                    <div>
                      <p className='text-sm text-gray-500 dark:text-gray-400'>
                        Social Impact
                      </p>
                      <div className='w-full bg-gray-200 dark:bg-gray-600 rounded-full h-2'>
                        <div
                          className='bg-secondary-600 h-2 rounded-full'
                          style={{ width: `${data.socialImpact * 100}%` }}
                        ></div>
                      </div>
                      <p className='text-xs text-gray-500 dark:text-gray-400 mt-1'>
                        {Math.round(data.socialImpact * 100)}%
                      </p>
                    </div>
                  </div>

                  <div className='flex items-center justify-between'>
                    <span
                      className={`font-medium ${getConfidenceColor(data.confidence)}`}
                    >
                      {Math.round(data.confidence * 100)}% confidence
                    </span>
                    <span className='text-xs text-gray-500 dark:text-gray-400'>
                      {data.processingTime}ms
                    </span>
                  </div>

                  <div className='mt-2'>
                    <p className='text-sm text-gray-500 dark:text-gray-400'>
                      Key Factors:
                    </p>
                    <div className='flex flex-wrap gap-1 mt-1'>
                      {data.keyFactors.map((factor, idx) => (
                        <span
                          key={idx}
                          className='inline-flex items-center px-2 py-1 rounded text-xs bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300'
                        >
                          {factor}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Execution Threshold Analysis */}
      <Suspense
        fallback={
          <div className='h-96 bg-gray-100 dark:bg-gray-700 rounded-lg animate-pulse'></div>
        }
      >
        <ExecutionThresholdVisualization aiDecisions={decisions} />
      </Suspense>

      {/* AI Model Performance */}
      <Suspense
        fallback={
          <div className='h-64 bg-gray-100 dark:bg-gray-700 rounded-lg animate-pulse'></div>
        }
      >
        <AIModelPerformance decisions={decisions} />
      </Suspense>

      {/* Enhanced AI Decision Modal */}
      {showDecisionModal && selectedDecision && (
        <div className='fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50'>
          <div className='bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto'>
            <div className='flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700'>
              <div className='flex items-center space-x-3'>
                {(() => {
                  const getTradeDirectionIcon = (type: string) => {
                    if (type.includes("BUY")) {
                      return (
                        <ArrowTrendingUpIcon className='h-6 w-6 text-green-600 dark:text-green-400' />
                      );
                    } else if (type.includes("SELL")) {
                      return (
                        <ArrowTrendingDownIcon className='h-6 w-6 text-red-600 dark:text-red-400' />
                      );
                    } else {
                      return (
                        <InformationCircleIcon className='h-6 w-6 text-blue-600 dark:text-blue-400' />
                      );
                    }
                  };

                  const getExecutionStatusBadge = (decision: AIDecision) => {
                    if (decision.executionDecision === "EXECUTED") {
                      return (
                        <span className='inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'>
                          <CheckCircleIcon className='h-4 w-4 mr-1' />
                          TRADE EXECUTED
                        </span>
                      );
                    } else if (decision.executionDecision === "REJECTED") {
                      return (
                        <span className='inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'>
                          <XMarkIcon className='h-4 w-4 mr-1' />
                          TRADE REJECTED
                        </span>
                      );
                    } else {
                      return (
                        <span className='inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-400'>
                          <ClockIcon className='h-4 w-4 mr-1' />
                          PENDING
                        </span>
                      );
                    }
                  };

                  return (
                    <>
                      {getTradeDirectionIcon(selectedDecision.type)}
                      <div>
                        <h3 className='text-xl font-bold text-gray-900 dark:text-white'>
                          {selectedDecision.symbol} -{" "}
                          {selectedDecision.type.replace("_", " ")}
                        </h3>
                        <div className='flex items-center space-x-2 mt-1'>
                          {getExecutionStatusBadge(selectedDecision)}
                          <span className='text-sm text-gray-500 dark:text-gray-400'>
                            {formatTimestamp(selectedDecision.timestamp)}
                          </span>
                        </div>
                      </div>
                    </>
                  );
                })()}
              </div>
              <button
                onClick={closeDecisionModal}
                className='text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'
              >
                <XMarkIcon className='h-6 w-6' />
              </button>
            </div>

            <div className='p-6'>
              <div className='text-center py-8'>
                <ShieldCheckIcon className='mx-auto h-12 w-12 text-gray-400' />
                <h3 className='mt-2 text-lg font-medium text-gray-900 dark:text-white'>
                  Decision Details
                </h3>
                <p className='mt-1 text-sm text-gray-500 dark:text-gray-400'>
                  Detailed analysis for {selectedDecision.symbol} decision
                </p>
                <div className='mt-4 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg'>
                  <div className='grid grid-cols-3 gap-4'>
                    <div className='text-center'>
                      <div className='text-lg font-semibold text-gray-900 dark:text-white'>
                        {Math.round(selectedDecision.confidence * 100)}%
                      </div>
                      <div className='text-sm text-gray-500 dark:text-gray-400'>
                        Confidence
                      </div>
                    </div>
                    <div className='text-center'>
                      <div className='text-lg font-semibold text-gray-900 dark:text-white'>
                        {Math.round(
                          selectedDecision.reasoning.technicalScore * 100
                        )}
                        %
                      </div>
                      <div className='text-sm text-gray-500 dark:text-gray-400'>
                        Technical
                      </div>
                    </div>
                    <div className='text-center'>
                      <div className='text-lg font-semibold text-gray-900 dark:text-white'>
                        {Math.round(
                          selectedDecision.reasoning.sentimentScore * 100
                        )}
                        %
                      </div>
                      <div className='text-sm text-gray-500 dark:text-gray-400'>
                        Sentiment
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AIAnalyticsPage;
