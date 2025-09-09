import React, { useState, useMemo, useCallback } from "react";
import {
  CheckCircleIcon,
  XMarkIcon,
  ClockIcon,
  FunnelIcon,
  MagnifyingGlassIcon,
} from "@heroicons/react/24/outline";
import { AIDecision } from "../../types";
import DecisionCard from "./DecisionCard";
import FilterButtons from "../ui/FilterButtons";
import PaginationControls from "../ui/PaginationControls";
import {
  useExpensiveMemo,
  useStableCallback,
} from "../../utils/performance/memoization";

interface AIDecisionsListProps {
  decisions: AIDecision[];
  onDecisionClick: (decision: AIDecision) => void;
  className?: string;
}

const AIDecisionsList: React.FC<AIDecisionsListProps> = React.memo(
  ({ decisions, onDecisionClick, className = "" }) => {
    const [currentPage, setCurrentPage] = useState(1);
    const [executionFilter, setExecutionFilter] = useState<string>("all");
    const [searchTerm, setSearchTerm] = useState("");
    const [sortBy, setSortBy] = useState<"timestamp" | "confidence" | "symbol">(
      "timestamp"
    );
    const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
    const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
    const itemsPerPage = 8;

    const filterOptions = [
      { key: "all", label: "All", icon: null },
      { key: "executed", label: "Executed", icon: CheckCircleIcon },
      { key: "rejected", label: "Rejected", icon: XMarkIcon },
      { key: "pending", label: "Pending", icon: ClockIcon },
    ];

    const getFilterCount = (filterKey: string) => {
      if (filterKey === "all") return decisions.length;

      return decisions.filter((d) => {
        if (filterKey === "executed") return d.executionDecision === "EXECUTED";
        if (filterKey === "rejected") return d.executionDecision === "REJECTED";
        if (filterKey === "pending")
          return !d.executionDecision || d.executionDecision === "PENDING";
        return true;
      }).length;
    };

    // Optimized callbacks with useStableCallback
    const handleFilterChange = useStableCallback((filterKey: string) => {
      setExecutionFilter(filterKey);
      setCurrentPage(1); // Reset to first page when filtering
    }, []);

    const handleSortChange = useStableCallback(
      (field: "timestamp" | "confidence" | "symbol") => {
        if (sortBy === field) {
          setSortOrder(sortOrder === "asc" ? "desc" : "asc");
        } else {
          setSortBy(field);
          setSortOrder("desc");
        }
        setCurrentPage(1);
      },
      [sortBy, sortOrder]
    );

    const handleSearchChange = useStableCallback((value: string) => {
      setSearchTerm(value);
      setCurrentPage(1);
    }, []);

    const handleDecisionClick = useStableCallback(
      (decision: AIDecision) => {
        onDecisionClick(decision);
      },
      [onDecisionClick]
    );

    // Apply filters and search with expensive memo
    const filteredAndSearchedDecisions = useExpensiveMemo(() => {
      let filtered = decisions;

      // Apply execution filter
      if (executionFilter !== "all") {
        filtered = filtered.filter((d) => {
          if (executionFilter === "executed")
            return d.executionDecision === "EXECUTED";
          if (executionFilter === "rejected")
            return d.executionDecision === "REJECTED";
          if (executionFilter === "pending")
            return !d.executionDecision || d.executionDecision === "PENDING";
          return true;
        });
      }

      // Apply search filter
      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase();
        filtered = filtered.filter(
          (d) =>
            d.symbol.toLowerCase().includes(searchLower) ||
            d.type.toLowerCase().includes(searchLower) ||
            (d.reasoning?.summary &&
              d.reasoning.summary.toLowerCase().includes(searchLower))
        );
      }

      // Apply sorting
      filtered.sort((a, b) => {
        let aValue: any, bValue: any;

        switch (sortBy) {
          case "timestamp":
            aValue = new Date(a.timestamp).getTime();
            bValue = new Date(b.timestamp).getTime();
            break;
          case "confidence":
            aValue = a.confidence;
            bValue = b.confidence;
            break;
          case "symbol":
            aValue = a.symbol;
            bValue = b.symbol;
            break;
          default:
            aValue = new Date(a.timestamp).getTime();
            bValue = new Date(b.timestamp).getTime();
        }

        if (aValue < bValue) return sortOrder === "asc" ? -1 : 1;
        if (aValue > bValue) return sortOrder === "asc" ? 1 : -1;
        return 0;
      });

      return filtered;
    }, [decisions, executionFilter, searchTerm, sortBy, sortOrder]);

    // Pagination logic
    const totalPages = Math.ceil(
      filteredAndSearchedDecisions.length / itemsPerPage
    );
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const currentDecisions = filteredAndSearchedDecisions.slice(
      startIndex,
      endIndex
    );

    // Calculate success rate
    const executedCount = decisions.filter(
      (d) => d.executionDecision === "EXECUTED"
    ).length;
    const totalWithDecision = decisions.filter(
      (d) => d.executionDecision && d.executionDecision !== "PENDING"
    ).length;
    const successRate =
      totalWithDecision > 0
        ? Math.round((executedCount / totalWithDecision) * 100)
        : 0;

    const getSuccessRateColor = (rate: number) => {
      if (rate >= 30) return "text-green-600 dark:text-green-400";
      if (rate >= 15) return "text-yellow-600 dark:text-yellow-400";
      return "text-red-600 dark:text-red-400";
    };

    return (
      <div
        className={`bg-white dark:bg-gray-800 rounded-lg shadow ${className}`}
      >
        <div className='px-6 py-4 border-b border-gray-200 dark:border-gray-700'>
          <div className='flex items-center justify-between mb-4'>
            <h3 className='text-lg font-medium text-gray-900 dark:text-white'>
              Recent AI Decisions
            </h3>
            <div className='text-sm text-gray-500 dark:text-gray-400'>
              {decisions.length} total decisions
            </div>
          </div>

          {/* Search and Advanced Filters Toggle */}
          <div className='flex items-center justify-between mb-4'>
            <div className='flex items-center space-x-4'>
              {/* Search */}
              <div className='relative'>
                <MagnifyingGlassIcon className='absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400' />
                <input
                  type='text'
                  placeholder='Search decisions...'
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setCurrentPage(1);
                  }}
                  className='pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 w-64'
                />
              </div>

              {/* Advanced Filters Toggle */}
              <button
                onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                className={`flex items-center space-x-2 px-3 py-2 text-sm rounded-md transition-colors ${
                  showAdvancedFilters
                    ? "bg-primary-100 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300"
                    : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                }`}
              >
                <FunnelIcon className='h-4 w-4' />
                <span>Filters</span>
              </button>
            </div>

            {/* Sort Controls */}
            <div className='flex items-center space-x-2'>
              <span className='text-sm text-gray-500 dark:text-gray-400'>
                Sort by:
              </span>
              {(["timestamp", "confidence", "symbol"] as const).map((field) => (
                <button
                  key={field}
                  onClick={() => handleSortChange(field)}
                  className={`px-2 py-1 text-xs rounded transition-colors ${
                    sortBy === field
                      ? "bg-primary-100 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300"
                      : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                  }`}
                >
                  {field === "timestamp"
                    ? "Time"
                    : field === "confidence"
                      ? "Confidence"
                      : "Symbol"}
                  {sortBy === field && (
                    <span className='ml-1'>
                      {sortOrder === "asc" ? "↑" : "↓"}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Filter Buttons with Success Rate */}
          <div className='flex items-center justify-between'>
            <FilterButtons
              filters={filterOptions}
              activeFilter={executionFilter}
              onFilterChange={handleFilterChange}
              getFilterCount={getFilterCount}
            />

            {/* Execution Success Rate */}
            <div className='text-sm text-gray-500 dark:text-gray-400'>
              <span className='flex items-center space-x-1'>
                <span>Success Rate:</span>
                <span
                  className={`font-semibold ${getSuccessRateColor(successRate)}`}
                >
                  {successRate}%
                </span>
                <span className='text-xs'>
                  ({executedCount}/{totalWithDecision})
                </span>
              </span>
            </div>
          </div>

          {/* Results Summary */}
          {(searchTerm || executionFilter !== "all") && (
            <div className='mt-3 text-sm text-gray-600 dark:text-gray-400'>
              Showing {filteredAndSearchedDecisions.length} of{" "}
              {decisions.length} decisions
              {searchTerm && <span> matching "{searchTerm}"</span>}
              {executionFilter !== "all" && (
                <span> with status "{executionFilter}"</span>
              )}
            </div>
          )}
        </div>

        <div className='p-6'>
          <div className='space-y-4'>
            {currentDecisions.map((decision) => (
              <DecisionCard
                key={decision.id}
                decision={decision}
                onClick={() => onDecisionClick(decision)}
              />
            ))}
          </div>

          <PaginationControls
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={filteredAndSearchedDecisions.length}
            itemsPerPage={itemsPerPage}
            onPageChange={setCurrentPage}
          />
        </div>
      </div>
    );
  }
);

AIDecisionsList.displayName = "AIDecisionsList";

export default AIDecisionsList;
