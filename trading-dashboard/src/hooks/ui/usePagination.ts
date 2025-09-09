/**
 * Custom hook for pagination functionality
 */

import { useState, useMemo, useCallback } from "react";

export interface PaginationConfig {
  initialPage?: number;
  initialPageSize?: number;
  pageSizeOptions?: number[];
}

export interface PaginationState {
  currentPage: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  startIndex: number;
  endIndex: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export interface PaginationActions {
  goToPage: (page: number) => void;
  goToNextPage: () => void;
  goToPreviousPage: () => void;
  goToFirstPage: () => void;
  goToLastPage: () => void;
  setPageSize: (size: number) => void;
  setTotalItems: (total: number) => void;
}

export interface UsePaginationReturn {
  state: PaginationState;
  actions: PaginationActions;
  paginatedData: <T>(data: T[]) => T[];
  getPageNumbers: () => number[];
}

/**
 * Hook for managing pagination state and actions
 */
export const usePagination = (
  totalItems: number = 0,
  config: PaginationConfig = {}
): UsePaginationReturn => {
  const {
    initialPage = 1,
    initialPageSize = 20,
    pageSizeOptions = [10, 20, 50, 100],
  } = config;

  const [currentPage, setCurrentPage] = useState(initialPage);
  const [pageSize, setPageSize] = useState(initialPageSize);
  const [totalItemsState, setTotalItemsState] = useState(totalItems);

  // Update total items when prop changes
  const effectiveTotalItems = totalItems || totalItemsState;

  const state = useMemo((): PaginationState => {
    const totalPages = Math.ceil(effectiveTotalItems / pageSize);
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = Math.min(startIndex + pageSize, effectiveTotalItems);

    return {
      currentPage,
      pageSize,
      totalItems: effectiveTotalItems,
      totalPages,
      startIndex,
      endIndex,
      hasNextPage: currentPage < totalPages,
      hasPreviousPage: currentPage > 1,
    };
  }, [currentPage, pageSize, effectiveTotalItems]);

  const actions = useMemo(
    (): PaginationActions => ({
      goToPage: (page: number) => {
        const clampedPage = Math.max(1, Math.min(page, state.totalPages));
        setCurrentPage(clampedPage);
      },

      goToNextPage: () => {
        if (state.hasNextPage) {
          setCurrentPage((prev) => prev + 1);
        }
      },

      goToPreviousPage: () => {
        if (state.hasPreviousPage) {
          setCurrentPage((prev) => prev - 1);
        }
      },

      goToFirstPage: () => {
        setCurrentPage(1);
      },

      goToLastPage: () => {
        setCurrentPage(state.totalPages);
      },

      setPageSize: (size: number) => {
        if (pageSizeOptions.includes(size)) {
          setPageSize(size);
          // Adjust current page to maintain position
          const currentStartIndex = (currentPage - 1) * pageSize;
          const newPage = Math.floor(currentStartIndex / size) + 1;
          setCurrentPage(newPage);
        }
      },

      setTotalItems: (total: number) => {
        setTotalItemsState(total);
        // Adjust current page if it's beyond the new total pages
        const newTotalPages = Math.ceil(total / pageSize);
        if (currentPage > newTotalPages) {
          setCurrentPage(Math.max(1, newTotalPages));
        }
      },
    }),
    [state, pageSize, currentPage, pageSizeOptions]
  );

  const paginatedData = useCallback(
    <T>(data: T[]): T[] => {
      return data.slice(state.startIndex, state.endIndex);
    },
    [state.startIndex, state.endIndex]
  );

  const getPageNumbers = useCallback((): number[] => {
    const { currentPage, totalPages } = state;
    const delta = 2; // Number of pages to show on each side of current page
    const range = [];
    const rangeWithDots = [];

    for (
      let i = Math.max(2, currentPage - delta);
      i <= Math.min(totalPages - 1, currentPage + delta);
      i++
    ) {
      range.push(i);
    }

    if (currentPage - delta > 2) {
      rangeWithDots.push(1, "...");
    } else {
      rangeWithDots.push(1);
    }

    rangeWithDots.push(...range);

    if (currentPage + delta < totalPages - 1) {
      rangeWithDots.push("...", totalPages);
    } else if (totalPages > 1) {
      rangeWithDots.push(totalPages);
    }

    return rangeWithDots.filter(
      (item, index, arr) =>
        (item !== arr[index - 1] && item !== 1) || index === 0
    ) as number[];
  }, [state]);

  return {
    state,
    actions,
    paginatedData,
    getPageNumbers,
  };
};

/**
 * Hook for server-side pagination
 */
export const useServerPagination = (
  fetchData: (page: number, pageSize: number) => void,
  config: PaginationConfig = {}
) => {
  const pagination = usePagination(0, config);

  const fetchPage = useCallback(
    (page: number) => {
      pagination.actions.goToPage(page);
      fetchData(page, pagination.state.pageSize);
    },
    [fetchData, pagination.actions, pagination.state.pageSize]
  );

  const fetchNextPage = useCallback(() => {
    if (pagination.state.hasNextPage) {
      const nextPage = pagination.state.currentPage + 1;
      fetchPage(nextPage);
    }
  }, [fetchPage, pagination.state]);

  const fetchPreviousPage = useCallback(() => {
    if (pagination.state.hasPreviousPage) {
      const prevPage = pagination.state.currentPage - 1;
      fetchPage(prevPage);
    }
  }, [fetchPage, pagination.state]);

  const changePageSize = useCallback(
    (size: number) => {
      pagination.actions.setPageSize(size);
      fetchData(1, size); // Reset to first page with new size
    },
    [fetchData, pagination.actions]
  );

  return {
    ...pagination,
    actions: {
      ...pagination.actions,
      goToPage: fetchPage,
      goToNextPage: fetchNextPage,
      goToPreviousPage: fetchPreviousPage,
      setPageSize: changePageSize,
    },
  };
};
