import React, { useState } from "react";
import {
  CheckCircleIcon,
  XMarkIcon,
  ClockIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  InformationCircleIcon,
  ExclamationTriangleIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  ChartBarIcon,
  CpuChipIcon,
} from "@heroicons/react/24/outline";
import { AIDecision } from "../../types";

interface DecisionCardProps {
  decision: AIDecision;
  onClick: () => void;
  className?: string;
}

const DecisionCard: React.FC<DecisionCardProps> = ({
  decision,
  onClick,
  className = "",
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const getTradeDirectionIcon = (type: string) => {
    if (type.includes("BUY")) {
      return (
        <ArrowTrendingUpIcon className='h-4 w-4 text-green-600 dark:text-green-400' />
      );
    } else if (type.includes("SELL")) {
      return (
        <ArrowTrendingDownIcon className='h-4 w-4 text-red-600 dark:text-red-400' />
      );
    } else {
      return (
        <InformationCircleIcon className='h-4 w-4 text-blue-600 dark:text-blue-400' />
      );
    }
  };

  const getExecutionStatusBadge = () => {
    if (decision.executionDecision === "EXECUTED") {
      return (
        <span className='inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'>
          <CheckCircleIcon className='h-3 w-3 mr-1' />
          EXECUTED
        </span>
      );
    } else if (decision.executionDecision === "REJECTED") {
      return (
        <span className='inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'>
          <XMarkIcon className='h-3 w-3 mr-1' />
          REJECTED
        </span>
      );
    } else {
      return (
        <span className='inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-400'>
          <ClockIcon className='h-3 w-3 mr-1' />
          PENDING
        </span>
      );
    }
  };

  const getCardBackgroundClass = () => {
    if (decision.executionDecision === "EXECUTED") {
      return "bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-800";
    } else if (decision.executionDecision === "REJECTED") {
      return "bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-800";
    } else {
      return "bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600";
    }
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return "text-green-600 dark:text-green-400";
    if (confidence >= 0.6) return "text-yellow-600 dark:text-yellow-400";
    return "text-red-600 dark:text-red-400";
  };

  const formatTimestamp = (timestamp: string | Date) => {
    try {
      const date = new Date(timestamp);
      const istOptions: Intl.DateTimeFormatOptions = {
        timeZone: "Asia/Kolkata",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      };
      return date.toLocaleString("en-IN", istOptions);
    } catch {
      return "Invalid time";
    }
  };

  return (
    <div
      className={`p-4 rounded-lg border cursor-pointer transition-all duration-200 hover:shadow-md ${getCardBackgroundClass()} ${className}`}
      onClick={onClick}
    >
      {/* Header with Symbol, Type, and Execution Status */}
      <div className='flex items-center justify-between mb-3'>
        <div className='flex items-center space-x-3'>
          <div className='flex items-center space-x-2'>
            {getTradeDirectionIcon(decision.type)}
            <span className='font-semibold text-gray-900 dark:text-white text-lg'>
              {decision.symbol}
            </span>
          </div>
          <div className='flex items-center space-x-2'>
            <span className='text-sm text-gray-600 dark:text-gray-400'>
              {decision.type.replace("_", " ")}
            </span>
            {getExecutionStatusBadge()}
          </div>
        </div>
        <div className='text-right'>
          <div
            className={`text-lg font-bold ${getConfidenceColor(decision.confidence)}`}
          >
            {Math.round(decision.confidence * 100)}%
          </div>
          <div className='text-xs text-gray-500 dark:text-gray-400'>
            Confidence
          </div>
        </div>
      </div>

      {/* Scores Grid with Threshold Indicators */}
      <div className='grid grid-cols-3 gap-4 mb-3'>
        <div className='text-center p-2 bg-white dark:bg-gray-800 rounded'>
          <div className='flex items-center justify-center space-x-1 mb-1'>
            <p className='text-xs text-gray-500 dark:text-gray-400'>
              Technical
            </p>
            {decision.executionThresholds?.minTechnical &&
              (decision.reasoning.technicalScore >=
              (decision.executionThresholds?.minTechnical ?? 0.5) ? (
                <CheckCircleIcon className='h-3 w-3 text-green-500' />
              ) : (
                <XMarkIcon className='h-3 w-3 text-red-500' />
              ))}
          </div>
          <p className='font-semibold text-gray-900 dark:text-white'>
            {Math.round(decision.reasoning.technicalScore * 100)}%
          </p>
          {decision.executionThresholds?.minTechnical && (
            <p className='text-xs text-gray-400'>
              vs{" "}
              {Math.round(
                (decision.executionThresholds?.minTechnical ?? 0.5) * 100
              )}
              %
            </p>
          )}
        </div>
        <div className='text-center p-2 bg-white dark:bg-gray-800 rounded'>
          <div className='flex items-center justify-center space-x-1 mb-1'>
            <p className='text-xs text-gray-500 dark:text-gray-400'>
              Sentiment
            </p>
            {decision.executionThresholds?.minSentiment &&
              (decision.reasoning.sentimentScore >=
              (decision.executionThresholds?.minSentiment ?? 0.4) ? (
                <CheckCircleIcon className='h-3 w-3 text-green-500' />
              ) : (
                <XMarkIcon className='h-3 w-3 text-red-500' />
              ))}
          </div>
          <p className='font-semibold text-gray-900 dark:text-white'>
            {Math.round(decision.reasoning.sentimentScore * 100)}%
          </p>
          {decision.executionThresholds?.minSentiment && (
            <p className='text-xs text-gray-400'>
              vs{" "}
              {Math.round(
                (decision.executionThresholds?.minSentiment ?? 0.4) * 100
              )}
              %
            </p>
          )}
        </div>
        <div className='text-center p-2 bg-white dark:bg-gray-800 rounded'>
          <div className='flex items-center justify-center space-x-1 mb-1'>
            <p className='text-xs text-gray-500 dark:text-gray-400'>Overall</p>
            {decision.executionThresholds?.minConfidence &&
              (decision.confidence >=
              (decision.executionThresholds?.minConfidence ?? 0.6) ? (
                <CheckCircleIcon className='h-3 w-3 text-green-500' />
              ) : (
                <XMarkIcon className='h-3 w-3 text-red-500' />
              ))}
          </div>
          <p className='font-semibold text-gray-900 dark:text-white'>
            {Math.round(decision.confidence * 100)}%
          </p>
          {decision.executionThresholds?.minConfidence && (
            <p className='text-xs text-gray-400'>
              vs{" "}
              {Math.round(
                (decision.executionThresholds?.minConfidence ?? 0.6) * 100
              )}
              %
            </p>
          )}
        </div>
      </div>

      {/* Footer with Rejection Reasons, Expand Button, and Timestamp */}
      <div className='flex items-center justify-between'>
        <div className='flex items-center space-x-2'>
          {decision.rejectionReasons &&
            decision.rejectionReasons.length > 0 && (
              <div className='flex items-center space-x-1'>
                <ExclamationTriangleIcon className='h-4 w-4 text-amber-500' />
                <span className='text-xs text-amber-700 dark:text-amber-400'>
                  {decision.rejectionReasons.length} issue
                  {decision.rejectionReasons.length > 1 ? "s" : ""}
                </span>
              </div>
            )}
          {decision.executionProbability && (
            <span className='text-xs text-blue-600 dark:text-blue-400'>
              {Math.round(decision.executionProbability * 100)}% exec
              probability
            </span>
          )}
        </div>

        <div className='flex items-center space-x-2'>
          <span className='text-xs text-gray-500 dark:text-gray-400'>
            {formatTimestamp(decision.timestamp)}
          </span>

          {/* Expand/Collapse Button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              setIsExpanded(!isExpanded);
            }}
            className='p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors'
            title={isExpanded ? "Collapse details" : "Expand details"}
          >
            {isExpanded ? (
              <ChevronUpIcon className='h-4 w-4' />
            ) : (
              <ChevronDownIcon className='h-4 w-4' />
            )}
          </button>
        </div>
      </div>

      {/* Expanded Details */}
      {isExpanded && (
        <div className='mt-4 pt-4 border-t border-gray-200 dark:border-gray-600 space-y-4'>
          {/* Detailed Analysis */}
          <div>
            <h4 className='text-sm font-medium text-gray-900 dark:text-white mb-2 flex items-center'>
              <ChartBarIcon className='h-4 w-4 mr-1' />
              Detailed Analysis
            </h4>
            <div className='grid grid-cols-1 md:grid-cols-2 gap-3 text-xs'>
              <div className='bg-white dark:bg-gray-800 p-3 rounded'>
                <div className='font-medium text-gray-700 dark:text-gray-300 mb-1'>
                  Technical Indicators
                </div>
                <div className='space-y-1'>
                  <div className='flex justify-between'>
                    <span className='text-gray-500 dark:text-gray-400'>
                      Score:
                    </span>
                    <span className='font-medium'>
                      {Math.round(decision.reasoning.technicalScore * 100)}%
                    </span>
                  </div>
                  {decision.reasoning.technicalIndicators && (
                    <div className='flex justify-between'>
                      <span className='text-gray-500 dark:text-gray-400'>
                        Indicators:
                      </span>
                      <span className='font-medium'>
                        {decision.reasoning.technicalIndicators.length}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <div className='bg-white dark:bg-gray-800 p-3 rounded'>
                <div className='font-medium text-gray-700 dark:text-gray-300 mb-1'>
                  Sentiment Analysis
                </div>
                <div className='space-y-1'>
                  <div className='flex justify-between'>
                    <span className='text-gray-500 dark:text-gray-400'>
                      Score:
                    </span>
                    <span className='font-medium'>
                      {Math.round(decision.reasoning.sentimentScore * 100)}%
                    </span>
                  </div>
                  {decision.reasoning.marketSentiment && (
                    <div className='flex justify-between'>
                      <span className='text-gray-500 dark:text-gray-400'>
                        Market:
                      </span>
                      <span className='font-medium capitalize'>
                        {decision.reasoning.marketSentiment}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Execution Thresholds Comparison */}
          {decision.executionThresholds && (
            <div>
              <h4 className='text-sm font-medium text-gray-900 dark:text-white mb-2 flex items-center'>
                <CpuChipIcon className='h-4 w-4 mr-1' />
                Threshold Analysis
              </h4>
              <div className='bg-white dark:bg-gray-800 p-3 rounded text-xs'>
                <div className='grid grid-cols-3 gap-4'>
                  <div className='text-center'>
                    <div className='font-medium text-gray-700 dark:text-gray-300 mb-1'>
                      Technical
                    </div>
                    <div
                      className={`text-lg font-bold ${
                        decision.reasoning.technicalScore >=
                        (decision.executionThresholds?.minTechnical ?? 0.5)
                          ? "text-green-600 dark:text-green-400"
                          : "text-red-600 dark:text-red-400"
                      }`}
                    >
                      {Math.round(decision.reasoning.technicalScore * 100)}%
                    </div>
                    <div className='text-gray-500 dark:text-gray-400'>
                      vs{" "}
                      {Math.round(
                        (decision.executionThresholds?.minTechnical ?? 0.5) *
                          100
                      )}
                      % required
                    </div>
                  </div>

                  <div className='text-center'>
                    <div className='font-medium text-gray-700 dark:text-gray-300 mb-1'>
                      Sentiment
                    </div>
                    <div
                      className={`text-lg font-bold ${
                        decision.reasoning.sentimentScore >=
                        (decision.executionThresholds?.minSentiment ?? 0.4)
                          ? "text-green-600 dark:text-green-400"
                          : "text-red-600 dark:text-red-400"
                      }`}
                    >
                      {Math.round(decision.reasoning.sentimentScore * 100)}%
                    </div>
                    <div className='text-gray-500 dark:text-gray-400'>
                      vs{" "}
                      {Math.round(
                        (decision.executionThresholds?.minSentiment ?? 0.4) *
                          100
                      )}
                      % required
                    </div>
                  </div>

                  <div className='text-center'>
                    <div className='font-medium text-gray-700 dark:text-gray-300 mb-1'>
                      Overall
                    </div>
                    <div
                      className={`text-lg font-bold ${
                        decision.confidence >=
                        (decision.executionThresholds?.minConfidence ?? 0.6)
                          ? "text-green-600 dark:text-green-400"
                          : "text-red-600 dark:text-red-400"
                      }`}
                    >
                      {Math.round(decision.confidence * 100)}%
                    </div>
                    <div className='text-gray-500 dark:text-gray-400'>
                      vs{" "}
                      {Math.round(
                        (decision.executionThresholds?.minConfidence ?? 0.6) *
                          100
                      )}
                      % required
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Rejection Reasons Details */}
          {decision.rejectionReasons &&
            decision.rejectionReasons.length > 0 && (
              <div>
                <h4 className='text-sm font-medium text-gray-900 dark:text-white mb-2 flex items-center'>
                  <ExclamationTriangleIcon className='h-4 w-4 mr-1 text-amber-500' />
                  Rejection Reasons
                </h4>
                <div className='bg-red-50 dark:bg-red-900/20 p-3 rounded'>
                  <ul className='space-y-1 text-xs'>
                    {decision.rejectionReasons.map((reason, index) => (
                      <li key={index} className='flex items-start space-x-2'>
                        <span className='text-red-500 mt-0.5'>•</span>
                        <span className='text-red-700 dark:text-red-300'>
                          {reason}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

          {/* Decision Summary */}
          {decision.reasoning?.summary && (
            <div>
              <h4 className='text-sm font-medium text-gray-900 dark:text-white mb-2'>
                AI Reasoning Summary
              </h4>
              <div className='bg-blue-50 dark:bg-blue-900/20 p-3 rounded text-xs text-blue-800 dark:text-blue-200'>
                {decision.reasoning.summary}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className='flex items-center justify-between pt-2 border-t border-gray-200 dark:border-gray-600'>
            <div className='flex items-center space-x-2'>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onClick();
                }}
                className='px-3 py-1 text-xs bg-primary-100 text-primary-700 dark:bg-primary-900/20 dark:text-primary-300 rounded hover:bg-primary-200 dark:hover:bg-primary-900/30 transition-colors'
              >
                View Full Details
              </button>

              {decision.executionDecision === "PENDING" && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    // Handle manual execution
                    console.log("Manual execution requested for:", decision.id);
                  }}
                  className='px-3 py-1 text-xs bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-300 rounded hover:bg-green-200 dark:hover:bg-green-900/30 transition-colors'
                >
                  Execute Manually
                </button>
              )}
            </div>

            <div className='text-xs text-gray-500 dark:text-gray-400'>
              Decision ID: {decision.id.slice(-8)}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DecisionCard;
