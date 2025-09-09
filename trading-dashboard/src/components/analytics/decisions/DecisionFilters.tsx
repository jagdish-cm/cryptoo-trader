/**
 * Decision filters component for AI analytics
 */

import React from "react";

interface DecisionFiltersProps {
  searchTerm: string;
  onSearchChange: (term: string) => void;
  selectedSymbol: string;
  onSymbolChange: (symbol: string) => void;
  selectedType: string;
  onTypeChange: (type: string) => void;
  selectedStatus: string;
  onStatusChange: (status: string) => void;
  confidenceRange: [number, number];
  onConfidenceRangeChange: (range: [number, number]) => void;
  dateRange: { start?: string; end?: string };
  onDateRangeChange: (range: { start?: string; end?: string }) => void;
  availableSymbols: string[];
  availableTypes: string[];
  onClearFilters: () => void;
}

/**
 * Decision filters component for filtering AI decisions
 */
const DecisionFilters: React.FC<DecisionFiltersProps> = ({
  searchTerm,
  onSearchChange,
  selectedSymbol,
  onSymbolChange,
  selectedType,
  onTypeChange,
  selectedStatus,
  onStatusChange,
  confidenceRange,
  onConfidenceRangeChange,
  dateRange,
  onDateRangeChange,
  availableSymbols,
  availableTypes,
  onClearFilters,
}) => {
  return (
    <div className='bg-white dark:bg-gray-800 rounded-lg shadow p-6'>
      <div className='flex items-center justify-between mb-4'>
        <h3 className='text-lg font-medium text-gray-900 dark:text-white'>
          Advanced Filters
        </h3>
        <button
          onClick={onClearFilters}
          className='text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300'
        >
          Clear All
        </button>
      </div>

      <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4'>
        {/* Search */}
        <div>
          <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1'>
            Search
          </label>
          <input
            type='text'
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder='Search decisions...'
            className='w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400'
          />
        </div>

        {/* Symbol Filter */}
        <div>
          <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1'>
            Symbol
          </label>
          <select
            value={selectedSymbol}
            onChange={(e) => onSymbolChange(e.target.value)}
            className='w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white'
          >
            <option value=''>All Symbols</option>
            {availableSymbols.map((symbol) => (
              <option key={symbol} value={symbol}>
                {symbol}
              </option>
            ))}
          </select>
        </div>

        {/* Type Filter */}
        <div>
          <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1'>
            Type
          </label>
          <select
            value={selectedType}
            onChange={(e) => onTypeChange(e.target.value)}
            className='w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white'
          >
            <option value=''>All Types</option>
            {availableTypes.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </div>

        {/* Status Filter */}
        <div>
          <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1'>
            Status
          </label>
          <select
            value={selectedStatus}
            onChange={(e) => onStatusChange(e.target.value)}
            className='w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white'
          >
            <option value=''>All Status</option>
            <option value='executed'>Executed</option>
            <option value='rejected'>Rejected</option>
            <option value='pending'>Pending</option>
          </select>
        </div>
      </div>

      {/* Confidence Range */}
      <div className='mt-4'>
        <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'>
          Confidence Range: {confidenceRange[0]}% - {confidenceRange[1]}%
        </label>
        <div className='flex items-center space-x-4'>
          <input
            type='range'
            min='0'
            max='100'
            value={confidenceRange[0]}
            onChange={(e) =>
              onConfidenceRangeChange([
                parseInt(e.target.value),
                confidenceRange[1],
              ])
            }
            className='flex-1'
          />
          <input
            type='range'
            min='0'
            max='100'
            value={confidenceRange[1]}
            onChange={(e) =>
              onConfidenceRangeChange([
                confidenceRange[0],
                parseInt(e.target.value),
              ])
            }
            className='flex-1'
          />
        </div>
      </div>

      {/* Date Range */}
      <div className='mt-4 grid grid-cols-1 md:grid-cols-2 gap-4'>
        <div>
          <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1'>
            Start Date
          </label>
          <input
            type='date'
            value={dateRange.start || ""}
            onChange={(e) =>
              onDateRangeChange({ ...dateRange, start: e.target.value })
            }
            className='w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white'
          />
        </div>
        <div>
          <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1'>
            End Date
          </label>
          <input
            type='date'
            value={dateRange.end || ""}
            onChange={(e) =>
              onDateRangeChange({ ...dateRange, end: e.target.value })
            }
            className='w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white'
          />
        </div>
      </div>
    </div>
  );
};

export default DecisionFilters;
