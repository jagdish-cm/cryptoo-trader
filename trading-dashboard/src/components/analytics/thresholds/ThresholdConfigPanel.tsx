/**
 * Threshold configuration panel component for adjusting execution thresholds
 */

import React, { useState, useCallback } from "react";
import {
  CogIcon,
  CheckIcon,
  XMarkIcon,
  ExclamationTriangleIcon,
} from "@heroicons/react/24/outline";
import { BaseComponentProps } from "../../../types/common/base";

export interface ThresholdConfig {
  minConfidence: number;
  minTechnical: number;
  minSentiment: number;
  minFusionScore: number;
  maxRiskScore: number;
  minVolumeScore: number;
}

interface ThresholdConfigPanelProps extends BaseComponentProps {
  config: ThresholdConfig;
  onConfigChange: (config: ThresholdConfig) => void;
  onSave: () => void;
  onCancel: () => void;
  loading?: boolean;
  error?: string | null;
  marketRegime: string;
  onMarketRegimeChange: (regime: string) => void;
}

/**
 * Individual threshold input component
 */
const ThresholdInput: React.FC<{
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  description?: string;
  isRisk?: boolean;
}> = ({
  label,
  value,
  onChange,
  min = 0,
  max = 1,
  step = 0.01,
  description,
  isRisk = false,
}) => {
  const [inputValue, setInputValue] = useState(value.toString());
  const [isValid, setIsValid] = useState(true);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = e.target.value;
      setInputValue(newValue);

      const numValue = parseFloat(newValue);
      const valid = !isNaN(numValue) && numValue >= min && numValue <= max;
      setIsValid(valid);

      if (valid) {
        onChange(numValue);
      }
    },
    [onChange, min, max]
  );

  const handleBlur = useCallback(() => {
    if (!isValid) {
      setInputValue(value.toString());
      setIsValid(true);
    }
  }, [isValid, value]);

  return (
    <div className='space-y-2'>
      <label className='block text-sm font-medium text-gray-700 dark:text-gray-300'>
        {label}
      </label>
      <div className='relative'>
        <input
          type='number'
          value={inputValue}
          onChange={handleChange}
          onBlur={handleBlur}
          min={min}
          max={max}
          step={step}
          className={`w-full px-3 py-2 border rounded-md text-sm ${
            isValid
              ? "border-gray-300 dark:border-gray-600 focus:ring-primary-500 focus:border-primary-500"
              : "border-red-300 dark:border-red-600 focus:ring-red-500 focus:border-red-500"
          } bg-white dark:bg-gray-700 text-gray-900 dark:text-white`}
        />
        {!isValid && (
          <ExclamationTriangleIcon className='absolute right-2 top-2 h-4 w-4 text-red-500' />
        )}
      </div>
      {description && (
        <p className='text-xs text-gray-500 dark:text-gray-400'>
          {description}
        </p>
      )}
      <div className='flex justify-between text-xs text-gray-400'>
        <span>Min: {min}</span>
        <span>Current: {(value * 100).toFixed(1)}%</span>
        <span>Max: {max}</span>
      </div>
    </div>
  );
};
/**
 * Threshold configuration panel component
 */
export const ThresholdConfigPanel: React.FC<ThresholdConfigPanelProps> = ({
  config,
  onConfigChange,
  onSave,
  onCancel,
  loading = false,
  error = null,
  marketRegime,
  onMarketRegimeChange,
  className = "",
  testId,
}) => {
  const [hasChanges, setHasChanges] = useState(false);
  const [originalConfig] = useState(config);

  const handleConfigChange = useCallback(
    (key: keyof ThresholdConfig, value: number) => {
      const newConfig = { ...config, [key]: value };
      onConfigChange(newConfig);

      // Check if there are changes
      const changed = Object.keys(newConfig).some(
        (k) =>
          newConfig[k as keyof ThresholdConfig] !==
          originalConfig[k as keyof ThresholdConfig]
      );
      setHasChanges(changed);
    },
    [config, onConfigChange, originalConfig]
  );

  const handleReset = useCallback(() => {
    onConfigChange(originalConfig);
    setHasChanges(false);
  }, [onConfigChange, originalConfig]);

  return (
    <div
      className={`bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 ${className}`}
      data-testid={testId}
    >
      {/* Header */}
      <div className='flex items-center justify-between mb-6'>
        <div className='flex items-center space-x-2'>
          <CogIcon className='h-6 w-6 text-primary-600 dark:text-primary-400' />
          <h3 className='text-lg font-semibold text-gray-900 dark:text-white'>
            Threshold Configuration
          </h3>
        </div>

        {/* Market Regime Selector */}
        <div className='flex items-center space-x-2'>
          <label className='text-sm text-gray-600 dark:text-gray-400'>
            Market Regime:
          </label>
          <select
            value={marketRegime}
            onChange={(e) => onMarketRegimeChange(e.target.value)}
            className='px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white'
          >
            <option value='trending'>Trending</option>
            <option value='range'>Range</option>
            <option value='volatile'>Volatile</option>
          </select>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className='mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md'>
          <div className='flex items-center space-x-2'>
            <ExclamationTriangleIcon className='h-4 w-4 text-red-600 dark:text-red-400' />
            <span className='text-sm text-red-800 dark:text-red-200'>
              {error}
            </span>
          </div>
        </div>
      )}

      {/* Configuration Grid */}
      <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-6'>
        <ThresholdInput
          label='Minimum Confidence'
          value={config.minConfidence}
          onChange={(value) => handleConfigChange("minConfidence", value)}
          description='Minimum AI confidence required for trade execution'
        />

        <ThresholdInput
          label='Minimum Technical Score'
          value={config.minTechnical}
          onChange={(value) => handleConfigChange("minTechnical", value)}
          description='Minimum technical analysis score required'
        />

        <ThresholdInput
          label='Minimum Sentiment Score'
          value={config.minSentiment}
          onChange={(value) => handleConfigChange("minSentiment", value)}
          description='Minimum sentiment analysis score required'
        />

        <ThresholdInput
          label='Minimum Fusion Score'
          value={config.minFusionScore}
          onChange={(value) => handleConfigChange("minFusionScore", value)}
          description='Minimum combined technical + sentiment score'
        />

        <ThresholdInput
          label='Maximum Risk Score'
          value={config.maxRiskScore}
          onChange={(value) => handleConfigChange("maxRiskScore", value)}
          description='Maximum acceptable risk level'
          isRisk={true}
        />

        <ThresholdInput
          label='Minimum Volume Score'
          value={config.minVolumeScore}
          onChange={(value) => handleConfigChange("minVolumeScore", value)}
          description='Minimum volume confirmation required'
        />
      </div>

      {/* Action Buttons */}
      <div className='flex items-center justify-between pt-4 border-t border-gray-200 dark:border-gray-700'>
        <div className='flex items-center space-x-2'>
          {hasChanges && (
            <span className='text-sm text-amber-600 dark:text-amber-400'>
              Unsaved changes
            </span>
          )}
        </div>

        <div className='flex items-center space-x-3'>
          <button
            onClick={handleReset}
            disabled={!hasChanges || loading}
            className='px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed'
          >
            Reset
          </button>

          <button
            onClick={onCancel}
            disabled={loading}
            className='px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed'
          >
            <XMarkIcon className='h-4 w-4 mr-1 inline' />
            Cancel
          </button>

          <button
            onClick={onSave}
            disabled={!hasChanges || loading}
            className='px-4 py-2 text-sm font-medium text-white bg-primary-600 border border-transparent rounded-md hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center'
          >
            {loading ? (
              <div className='animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2' />
            ) : (
              <CheckIcon className='h-4 w-4 mr-1' />
            )}
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
};

export default ThresholdConfigPanel;
