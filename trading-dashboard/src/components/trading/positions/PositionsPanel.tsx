/**
 * Positions panel component for displaying and managing active positions
 */

import React, { useState, useMemo } from "react";
import {
  XMarkIcon,
  MagnifyingGlassIcon,
  FunnelIcon,
} from "@heroicons/react/24/outline";
import { Position } from "../../../types";
import { BaseComponentProps } from "../../../types/common/base";
import { EmptyPositions } from "../../ui/feedback/EmptyStates";
import { getDirectionIcon, getPnLIcon } from "../../../utils/ui/iconUtils";
import { formatCurrency, formatPercentage } from "../../../utils/formatting";
import { useFiltering } from "../../../hooks/ui/useFiltering";

interface PositionsPanelProps extends BaseComponentProps {
  positions: Position[];
  onClosePosition: (positionId: string) => void;
  loading?: boolean;
  error?: string | null;
}

/**
 * Individual position card component
 */
const PositionCard: React.FC<{
  position: Position;
  onClose: (positionId: string) => void;
}> = ({ position, onClose }) => {
  const pnlColor =
    position.unrealizedPnL >= 0
      ? "text-green-600 dark:text-green-400"
      : "text-red-600 dark:text-red-400";

  const handleClose = () => {
    if (
      window.confirm(
        `Are you sure you want to close the ${position.symbol} position?`
      )
    ) {
      onClose(position.id);
    }
  };

  return (
    <div className='p-4 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600'>
      <div className='flex items-center justify-between mb-3'>
        <div className='flex items-center space-x-3'>
          {getDirectionIcon(position.direction)}
          <div>
            <p className='font-medium text-gray-900 dark:text-white'>
              {position.symbol}
            </p>
            <p className='text-sm text-gray-500 dark:text-gray-400'>
              {position.direction} • {position.quantity}
            </p>
          </div>
        </div>
        <button
          onClick={handleClose}
          className='p-1 text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors'
          title='Close Position'
        >
          <XMarkIcon className='h-4 w-4' />
        </button>
      </div>

      <div className='grid grid-cols-2 gap-4 text-sm'>
        <div>
          <p className='text-gray-500 dark:text-gray-400'>Entry</p>
          <p className='font-medium text-gray-900 dark:text-white'>
            {formatCurrency(position.entryPrice)}
          </p>
        </div>
        <div>
          <p className='text-gray-500 dark:text-gray-400'>Current</p>
          <p className='font-medium text-gray-900 dark:text-white'>
            {formatCurrency(position.currentPrice)}
          </p>
        </div>
        <div>
          <p className='text-gray-500 dark:text-gray-400'>Stop Loss</p>
          <p className='font-medium text-gray-900 dark:text-white'>
            {position.stopLoss ? formatCurrency(position.stopLoss) : "Not set"}
          </p>
        </div>
        <div>
          <p className='text-gray-500 dark:text-gray-400'>P&L</p>
          <div className='flex items-center space-x-1'>
            {getPnLIcon(position.unrealizedPnL)}
            <p className={`font-medium ${pnlColor}`}>
              {formatCurrency(position.unrealizedPnL)}
            </p>
          </div>
        </div>
      </div>

      {/* Take Profit Levels */}
      {position.takeProfitLevels && position.takeProfitLevels.length > 0 && (
        <div className='mt-3 pt-3 border-t border-gray-200 dark:border-gray-600'>
          <p className='text-xs text-gray-500 dark:text-gray-400 mb-1'>
            Take Profit Levels:
          </p>
          <div className='flex flex-wrap gap-1'>
            {position.takeProfitLevels.map((level, index) => (
              <span
                key={index}
                className='px-2 py-1 text-xs bg-blue-100 dark:bg-blue-900/20 text-blue-800 dark:text-blue-200 rounded'
              >
                {formatCurrency(level)}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Position Age */}
      <div className='mt-2 text-xs text-gray-400 dark:text-gray-500'>
        Opened: {new Date(position.createdAt).toLocaleDateString()}
      </div>
    </div>
  );
};

/**
 * Position filter component
 */
const PositionFilters: React.FC<{
  searchTerm: string;
  onSearchChange: (term: string) => void;
  selectedDirection: string;
  onDirectionChange: (direction: string) => void;
  selectedStatus: string;
  onStatusChange: (status: string) => void;
}> = ({
  searchTerm,
  onSearchChange,
  selectedDirection,
  onDirectionChange,
  selectedStatus,
  onStatusChange,
}) => (
  <div className='flex flex-col sm:flex-row gap-3 mb-4'>
    {/* Search */}
    <div className='relative flex-1'>
      <MagnifyingGlassIcon className='absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400' />
      <input
        type='text'
        placeholder='Search positions...'
        value={searchTerm}
        onChange={(e) => onSearchChange(e.target.value)}
        className='w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400'
      />
    </div>

    {/* Direction Filter */}
    <select
      value={selectedDirection}
      onChange={(e) => onDirectionChange(e.target.value)}
      className='px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white'
    >
      <option value=''>All Directions</option>
      <option value='LONG'>Long</option>
      <option value='SHORT'>Short</option>
    </select>

    {/* Status Filter */}
    <select
      value={selectedStatus}
      onChange={(e) => onStatusChange(e.target.value)}
      className='px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white'
    >
      <option value=''>All Status</option>
      <option value='OPEN'>Open</option>
      <option value='CLOSING'>Closing</option>
    </select>
  </div>
);

/**
 * Positions panel component
 */
export const PositionsPanel: React.FC<PositionsPanelProps> = ({
  positions,
  onClosePosition,
  loading = false,
  error = null,
  className = "",
  testId,
}) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedDirection, setSelectedDirection] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("");

  // Filter positions
  const filteredPositions = useMemo(() => {
    return positions.filter((position) => {
      const matchesSearch =
        !searchTerm ||
        position.symbol.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesDirection =
        !selectedDirection || position.direction === selectedDirection;
      const matchesStatus =
        !selectedStatus || position.status === selectedStatus;

      return matchesSearch && matchesDirection && matchesStatus;
    });
  }, [positions, searchTerm, selectedDirection, selectedStatus]);

  // Calculate summary metrics
  const summary = useMemo(() => {
    const totalPnL = positions.reduce((sum, pos) => sum + pos.unrealizedPnL, 0);
    const longPositions = positions.filter(
      (pos) => pos.direction === "LONG"
    ).length;
    const shortPositions = positions.filter(
      (pos) => pos.direction === "SHORT"
    ).length;
    const profitablePositions = positions.filter(
      (pos) => pos.unrealizedPnL > 0
    ).length;

    return {
      totalPnL,
      longPositions,
      shortPositions,
      profitablePositions,
      totalPositions: positions.length,
    };
  }, [positions]);

  if (loading) {
    return (
      <div
        className={`bg-white dark:bg-gray-800 rounded-lg shadow ${className}`}
        data-testid={testId}
      >
        <div className='px-6 py-4 border-b border-gray-200 dark:border-gray-700'>
          <h3 className='text-lg font-medium text-gray-900 dark:text-white'>
            Active Positions
          </h3>
        </div>
        <div className='p-6'>
          <div className='flex items-center justify-center h-32'>
            <div className='animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600'></div>
            <span className='ml-3 text-gray-600 dark:text-gray-400'>
              Loading positions...
            </span>
          </div>
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
            Active Positions
          </h3>
        </div>
        <div className='p-6'>
          <div className='text-center text-red-600 dark:text-red-400'>
            <p>Error loading positions: {error}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`bg-white dark:bg-gray-800 rounded-lg shadow ${className}`}
      data-testid={testId}
    >
      {/* Header with Summary */}
      <div className='px-6 py-4 border-b border-gray-200 dark:border-gray-700'>
        <div className='flex items-center justify-between mb-3'>
          <h3 className='text-lg font-medium text-gray-900 dark:text-white'>
            Active Positions
          </h3>
          <div className='flex items-center space-x-2'>
            <FunnelIcon className='h-4 w-4 text-gray-400' />
            <span className='text-sm text-gray-500 dark:text-gray-400'>
              {filteredPositions.length} of {positions.length}
            </span>
          </div>
        </div>

        {/* Summary Stats */}
        <div className='grid grid-cols-4 gap-4 text-center'>
          <div>
            <div
              className={`text-sm font-medium ${
                summary.totalPnL >= 0
                  ? "text-green-600 dark:text-green-400"
                  : "text-red-600 dark:text-red-400"
              }`}
            >
              {formatCurrency(summary.totalPnL)}
            </div>
            <div className='text-xs text-gray-500 dark:text-gray-400'>
              Total P&L
            </div>
          </div>
          <div>
            <div className='text-sm font-medium text-green-600 dark:text-green-400'>
              {summary.longPositions}
            </div>
            <div className='text-xs text-gray-500 dark:text-gray-400'>Long</div>
          </div>
          <div>
            <div className='text-sm font-medium text-red-600 dark:text-red-400'>
              {summary.shortPositions}
            </div>
            <div className='text-xs text-gray-500 dark:text-gray-400'>
              Short
            </div>
          </div>
          <div>
            <div className='text-sm font-medium text-blue-600 dark:text-blue-400'>
              {summary.profitablePositions}
            </div>
            <div className='text-xs text-gray-500 dark:text-gray-400'>
              Profitable
            </div>
          </div>
        </div>
      </div>

      <div className='p-6'>
        {positions.length === 0 ? (
          <EmptyPositions />
        ) : (
          <>
            {/* Filters */}
            <PositionFilters
              searchTerm={searchTerm}
              onSearchChange={setSearchTerm}
              selectedDirection={selectedDirection}
              onDirectionChange={setSelectedDirection}
              selectedStatus={selectedStatus}
              onStatusChange={setSelectedStatus}
            />

            {/* Positions List */}
            {filteredPositions.length === 0 ? (
              <div className='text-center py-8 text-gray-500 dark:text-gray-400'>
                <p>No positions match the current filters</p>
              </div>
            ) : (
              <div className='space-y-4'>
                {filteredPositions.map((position) => (
                  <PositionCard
                    key={position.id}
                    position={position}
                    onClose={onClosePosition}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default PositionsPanel;
