/**
 * Custom hook for managing trade history data and operations
 */

import { useState, useMemo, useCallback } from "react";
import { Trade } from "../../types";

interface TradeFilters {
  searchTerm: string;
  direction: string;
  symbol: string;
  exitReason: string;
  pnlFilter: "all" | "profitable" | "losses";
  dateRange: {
    start?: string;
    end?: string;
  };
}

interface SortConfig {
  key: keyof Trade;
  order: "asc" | "desc";
}

interface UseTradeHistoryOptions {
  initialPageSize?: number;
  initialFilters?: Partial<TradeFilters>;
  initialSort?: SortConfig;
}

interface UseTradeHistoryReturn {
  // Data
  filteredTrades: Trade[];
  paginatedTrades: Trade[];
  totalTrades: number;

  // Filters
  filters: TradeFilters;
  setFilters: (filters: Partial<TradeFilters>) => void;
  clearFilters: () => void;

  // Sorting
  sortConfig: SortConfig;
  setSortConfig: (config: SortConfig) => void;

  // Pagination
  currentPage: number;
  totalPages: number;
  pageSize: number;
  setCurrentPage: (page: number) => void;
  setPageSize: (size: number) => void;

  // Actions
  exportTrades: (format: "csv" | "json") => void;

  // Metadata
  availableSymbols: string[];
  availableExitReasons: string[];
}

const defaultFilters: TradeFilters = {
  searchTerm: "",
  direction: "",
  symbol: "",
  exitReason: "",
  pnlFilter: "all",
  dateRange: {},
};

const defaultSort: SortConfig = {
  key: "exitTime",
  order: "desc",
};

/**
 * Hook for managing trade history
 */
export const useTradeHistory = (
  trades: Trade[],
  options: UseTradeHistoryOptions = {}
): UseTradeHistoryReturn => {
  const {
    initialPageSize = 20,
    initialFilters = {},
    initialSort = defaultSort,
  } = options;

  // State
  const [filters, setFiltersState] = useState<TradeFilters>({
    ...defaultFilters,
    ...initialFilters,
  });
  const [sortConfig, setSortConfig] = useState<SortConfig>(initialSort);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(initialPageSize);

  // Get unique values for filter options
  const availableSymbols = useMemo(() => {
    return Array.from(new Set(trades.map((trade) => trade.symbol))).sort();
  }, [trades]);

  const availableExitReasons = useMemo(() => {
    return Array.from(new Set(trades.map((trade) => trade.exitReason))).sort();
  }, [trades]);

  // Filter trades
  const filteredTrades = useMemo(() => {
    return trades.filter((trade) => {
      // Search term filter
      if (filters.searchTerm) {
        const searchLower = filters.searchTerm.toLowerCase();
        const matchesSearch =
          trade.symbol.toLowerCase().includes(searchLower) ||
          trade.setupType.toLowerCase().includes(searchLower) ||
          trade.exitReason.toLowerCase().includes(searchLower);
        if (!matchesSearch) return false;
      }

      // Direction filter
      if (filters.direction && trade.direction !== filters.direction) {
        return false;
      }

      // Symbol filter
      if (filters.symbol && trade.symbol !== filters.symbol) {
        return false;
      }

      // Exit reason filter
      if (filters.exitReason && trade.exitReason !== filters.exitReason) {
        return false;
      }

      // P&L filter
      if (filters.pnlFilter === "profitable" && trade.realizedPnL <= 0) {
        return false;
      }
      if (filters.pnlFilter === "losses" && trade.realizedPnL >= 0) {
        return false;
      }

      // Date range filter
      if (filters.dateRange.start) {
        const tradeDate = new Date(trade.exitTime);
        const startDate = new Date(filters.dateRange.start);
        if (tradeDate < startDate) return false;
      }
      if (filters.dateRange.end) {
        const tradeDate = new Date(trade.exitTime);
        const endDate = new Date(filters.dateRange.end);
        if (tradeDate > endDate) return false;
      }

      return true;
    });
  }, [trades, filters]);

  // Sort trades
  const sortedTrades = useMemo(() => {
    return [...filteredTrades].sort((a, b) => {
      const aValue = a[sortConfig.key];
      const bValue = b[sortConfig.key];

      let comparison = 0;
      if (aValue < bValue) {
        comparison = -1;
      } else if (aValue > bValue) {
        comparison = 1;
      }

      return sortConfig.order === "desc" ? -comparison : comparison;
    });
  }, [filteredTrades, sortConfig]);

  // Calculate pagination
  const totalTrades = sortedTrades.length;
  const totalPages = Math.ceil(totalTrades / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const paginatedTrades = sortedTrades.slice(startIndex, endIndex);

  // Update filters
  const setFilters = useCallback((newFilters: Partial<TradeFilters>) => {
    setFiltersState((prev) => ({ ...prev, ...newFilters }));
    setCurrentPage(1); // Reset to first page when filters change
  }, []);

  // Clear filters
  const clearFilters = useCallback(() => {
    setFiltersState(defaultFilters);
    setCurrentPage(1);
  }, []);

  // Update page size
  const handleSetPageSize = useCallback((size: number) => {
    setPageSize(size);
    setCurrentPage(1); // Reset to first page when page size changes
  }, []);

  // Export trades
  const exportTrades = useCallback(
    (format: "csv" | "json") => {
      const dataToExport = filteredTrades;

      if (format === "csv") {
        // Convert to CSV
        const headers = [
          "Symbol",
          "Direction",
          "Quantity",
          "Entry Price",
          "Exit Price",
          "Entry Time",
          "Exit Time",
          "Realized P&L",
          "Fees",
          "Setup Type",
          "Exit Reason",
        ];

        const csvContent = [
          headers.join(","),
          ...dataToExport.map((trade) =>
            [
              trade.symbol,
              trade.direction,
              trade.quantity,
              trade.entryPrice,
              trade.exitPrice,
              trade.entryTime,
              trade.exitTime,
              trade.realizedPnL,
              trade.fees,
              trade.setupType,
              trade.exitReason,
            ].join(",")
          ),
        ].join("\n");

        const blob = new Blob([csvContent], { type: "text/csv" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `trade-history-${new Date().toISOString().split("T")[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } else {
        // Export as JSON
        const jsonContent = JSON.stringify(dataToExport, null, 2);
        const blob = new Blob([jsonContent], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `trade-history-${new Date().toISOString().split("T")[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
    },
    [filteredTrades]
  );

  return {
    // Data
    filteredTrades: sortedTrades,
    paginatedTrades,
    totalTrades,

    // Filters
    filters,
    setFilters,
    clearFilters,

    // Sorting
    sortConfig,
    setSortConfig,

    // Pagination
    currentPage,
    totalPages,
    pageSize,
    setCurrentPage,
    setPageSize: handleSetPageSize,

    // Actions
    exportTrades,

    // Metadata
    availableSymbols,
    availableExitReasons,
  };
};

export default useTradeHistory;
