/**
 * Custom hooks for filtering and searching functionality
 */

import { useState, useMemo, useCallback } from "react";
import { FilterOption } from "../../types/common/base";

export interface FilterState<T = string> {
  [key: string]: T | T[] | null;
}

export interface FilterConfig<T> {
  key: keyof T;
  type: "text" | "select" | "multiselect" | "range" | "date" | "boolean";
  options?: FilterOption[];
  placeholder?: string;
  label?: string;
}

export interface UseFilteringReturn<T> {
  filters: FilterState;
  filteredData: T[];
  activeFilterCount: number;
  setFilter: (key: string, value: any) => void;
  clearFilter: (key: string) => void;
  clearAllFilters: () => void;
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  searchFields: (keyof T)[];
  setSearchFields: (fields: (keyof T)[]) => void;
}

/**
 * Hook for filtering and searching data
 */
export const useFiltering = <T extends Record<string, any>>(
  data: T[],
  filterConfigs: FilterConfig<T>[] = [],
  initialSearchFields: (keyof T)[] = []
): UseFilteringReturn<T> => {
  const [filters, setFilters] = useState<FilterState>({});
  const [searchTerm, setSearchTerm] = useState("");
  const [searchFields, setSearchFields] =
    useState<(keyof T)[]>(initialSearchFields);

  const setFilter = useCallback((key: string, value: any) => {
    setFilters((prev) => ({
      ...prev,
      [key]: value,
    }));
  }, []);

  const clearFilter = useCallback((key: string) => {
    setFilters((prev) => {
      const newFilters = { ...prev };
      delete newFilters[key];
      return newFilters;
    });
  }, []);

  const clearAllFilters = useCallback(() => {
    setFilters({});
    setSearchTerm("");
  }, []);

  const filteredData = useMemo(() => {
    let result = [...data];

    // Apply search filter
    if (searchTerm && searchFields.length > 0) {
      const lowercaseSearchTerm = searchTerm.toLowerCase();
      result = result.filter((item) =>
        searchFields.some((field) => {
          const value = item[field];
          if (value == null) return false;
          return String(value).toLowerCase().includes(lowercaseSearchTerm);
        })
      );
    }

    // Apply other filters
    Object.entries(filters).forEach(([key, value]) => {
      if (
        value == null ||
        value === "" ||
        (Array.isArray(value) && value.length === 0)
      ) {
        return;
      }

      const config = filterConfigs.find((c) => String(c.key) === key);
      if (!config) return;

      result = result.filter((item) => {
        const itemValue = item[config.key];

        switch (config.type) {
          case "text":
            return String(itemValue)
              .toLowerCase()
              .includes(String(value).toLowerCase());

          case "select":
            return itemValue === value;

          case "multiselect":
            return Array.isArray(value) && value.includes(itemValue);

          case "boolean":
            return Boolean(itemValue) === Boolean(value);

          case "range":
            if (Array.isArray(value) && value.length === 2) {
              const numValue = Number(itemValue);
              const minValue = Number(value[0]);
              const maxValue = Number(value[1]);
              return numValue >= minValue && numValue <= maxValue;
            }
            return true;

          case "date":
            if (Array.isArray(value) && value.length === 2) {
              const itemDate = new Date(itemValue);
              const startDate = new Date(value[0]);
              const endDate = new Date(value[1]);
              return itemDate >= startDate && itemDate <= endDate;
            }
            return true;

          default:
            return true;
        }
      });
    });

    return result;
  }, [data, filters, searchTerm, searchFields, filterConfigs]);

  const activeFilterCount = useMemo(() => {
    let count = 0;

    if (searchTerm) count++;

    Object.values(filters).forEach((value) => {
      if (
        value != null &&
        value !== "" &&
        (!Array.isArray(value) || value.length > 0)
      ) {
        count++;
      }
    });

    return count;
  }, [filters, searchTerm]);

  return {
    filters,
    filteredData,
    activeFilterCount,
    setFilter,
    clearFilter,
    clearAllFilters,
    searchTerm,
    setSearchTerm,
    searchFields,
    setSearchFields,
  };
};

/**
 * Hook for sorting data
 */
export const useSorting = <T extends Record<string, any>>(
  data: T[],
  initialSortKey?: keyof T,
  initialSortOrder: "asc" | "desc" = "asc"
) => {
  const [sortKey, setSortKey] = useState<keyof T | null>(
    initialSortKey || null
  );
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">(initialSortOrder);

  const sortedData = useMemo(() => {
    if (!sortKey) return data;

    return [...data].sort((a, b) => {
      const aValue = a[sortKey];
      const bValue = b[sortKey];

      // Handle null/undefined values
      if (aValue == null && bValue == null) return 0;
      if (aValue == null) return sortOrder === "asc" ? 1 : -1;
      if (bValue == null) return sortOrder === "asc" ? -1 : 1;

      // Handle different data types
      if (typeof aValue === "number" && typeof bValue === "number") {
        return sortOrder === "asc" ? aValue - bValue : bValue - aValue;
      }

      // Check if values are Date objects using type guards
      const isADate =
        typeof aValue === "object" && aValue !== null && "getTime" in aValue;
      const isBDate =
        typeof bValue === "object" && bValue !== null && "getTime" in bValue;

      if (isADate && isBDate) {
        const aTime = (aValue as Date).getTime();
        const bTime = (bValue as Date).getTime();
        return sortOrder === "asc" ? aTime - bTime : bTime - aTime;
      }

      // Handle date strings
      if (typeof aValue === "string" && typeof bValue === "string") {
        const aDate = new Date(aValue);
        const bDate = new Date(bValue);
        if (!isNaN(aDate.getTime()) && !isNaN(bDate.getTime())) {
          return sortOrder === "asc"
            ? aDate.getTime() - bDate.getTime()
            : bDate.getTime() - aDate.getTime();
        }
      }

      // String comparison
      const aStr = String(aValue).toLowerCase();
      const bStr = String(bValue).toLowerCase();

      if (sortOrder === "asc") {
        return aStr.localeCompare(bStr);
      } else {
        return bStr.localeCompare(aStr);
      }
    });
  }, [data, sortKey, sortOrder]);

  const handleSort = useCallback(
    (key: keyof T) => {
      if (sortKey === key) {
        // Toggle sort order if same key
        setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
      } else {
        // Set new sort key with ascending order
        setSortKey(key);
        setSortOrder("asc");
      }
    },
    [sortKey]
  );

  const clearSort = useCallback(() => {
    setSortKey(null);
    setSortOrder("asc");
  }, []);

  return {
    sortedData,
    sortKey,
    sortOrder,
    handleSort,
    clearSort,
    setSortKey,
    setSortOrder,
  };
};

/**
 * Combined hook for filtering, sorting, and pagination
 */
export const useDataTable = <T extends Record<string, any>>(
  data: T[],
  options: {
    filterConfigs?: FilterConfig<T>[];
    searchFields?: (keyof T)[];
    initialSortKey?: keyof T;
    initialSortOrder?: "asc" | "desc";
    pageSize?: number;
  } = {}
) => {
  const {
    filterConfigs = [],
    searchFields = [],
    initialSortKey,
    initialSortOrder = "asc",
    pageSize = 20,
  } = options;

  const filtering = useFiltering(data, filterConfigs, searchFields);
  const sorting = useSorting(
    filtering.filteredData,
    initialSortKey,
    initialSortOrder
  );

  // Note: Pagination would be imported from usePagination hook
  // const pagination = usePagination(sorting.sortedData.length, { initialPageSize: pageSize });

  return {
    // Data processing results
    processedData: sorting.sortedData,
    totalItems: sorting.sortedData.length,

    // Filtering
    ...filtering,

    // Sorting
    sortKey: sorting.sortKey,
    sortOrder: sorting.sortOrder,
    handleSort: sorting.handleSort,
    clearSort: sorting.clearSort,

    // Combined actions
    resetAll: () => {
      filtering.clearAllFilters();
      sorting.clearSort();
    },
  };
};
