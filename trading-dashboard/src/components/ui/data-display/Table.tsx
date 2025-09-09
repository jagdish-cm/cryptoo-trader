/**
 * Reusable table component with sorting, filtering, and pagination
 */

import React, { useState, useMemo, useCallback } from "react";
import {
  ChevronUpIcon,
  ChevronDownIcon,
  MagnifyingGlassIcon,
  FunnelIcon,
  ArrowsUpDownIcon,
} from "@heroicons/react/24/outline";
import { BaseComponentProps } from "../../../types/common/base";
// PaginationControls component will be implemented inline

export interface TableColumn<T = any> {
  key: string;
  title: string;
  dataIndex?: keyof T;
  render?: (value: any, record: T, index: number) => React.ReactNode;
  sortable?: boolean;
  filterable?: boolean;
  width?: string | number;
  align?: "left" | "center" | "right";
  fixed?: "left" | "right";
}

export interface TableProps<T = any> extends BaseComponentProps {
  columns: TableColumn<T>[];
  data: T[];
  loading?: boolean;
  error?: string | null;
  pagination?: {
    current: number;
    pageSize: number;
    total: number;
    showSizeChanger?: boolean;
    showQuickJumper?: boolean;
    onChange: (page: number, pageSize: number) => void;
  };
  rowKey?: keyof T | ((record: T) => string);
  onRow?: (
    record: T,
    index: number
  ) => {
    onClick?: () => void;
    onDoubleClick?: () => void;
    className?: string;
  };
  emptyText?: string;
  size?: "sm" | "md" | "lg";
  bordered?: boolean;
  striped?: boolean;
  hoverable?: boolean;
  sticky?: boolean;
}

type SortOrder = "asc" | "desc" | null;

/**
 * Table component with advanced features
 */
export const Table = <T extends Record<string, any>>({
  columns,
  data,
  loading = false,
  error = null,
  pagination,
  rowKey = "id",
  onRow,
  emptyText = "No data available",
  size = "md",
  bordered = false,
  striped = false,
  hoverable = true,
  sticky = false,
  className = "",
  testId,
}: TableProps<T>) => {
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortOrder, setSortOrder] = useState<SortOrder>(null);
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [searchTerm, setSearchTerm] = useState("");

  // Size classes
  const sizeClasses = {
    sm: "text-xs",
    md: "text-sm",
    lg: "text-base",
  };

  const cellPaddingClasses = {
    sm: "px-3 py-2",
    md: "px-4 py-3",
    lg: "px-6 py-4",
  };

  // Get row key
  const getRowKey = useCallback(
    (record: T, index: number): string => {
      if (typeof rowKey === "function") {
        return rowKey(record);
      }
      return record[rowKey]?.toString() || index.toString();
    },
    [rowKey]
  );

  // Handle sorting
  const handleSort = useCallback(
    (columnKey: string) => {
      if (sortColumn === columnKey) {
        setSortOrder(
          sortOrder === "asc" ? "desc" : sortOrder === "desc" ? null : "asc"
        );
        if (sortOrder === "desc") {
          setSortColumn(null);
        }
      } else {
        setSortColumn(columnKey);
        setSortOrder("asc");
      }
    },
    [sortColumn, sortOrder]
  );

  // Filter and sort data
  const processedData = useMemo(() => {
    let result = [...data];

    // Apply search filter
    if (searchTerm) {
      result = result.filter((record) =>
        Object.values(record).some((value) =>
          value?.toString().toLowerCase().includes(searchTerm.toLowerCase())
        )
      );
    }

    // Apply column filters
    Object.entries(filters).forEach(([columnKey, filterValue]) => {
      if (filterValue) {
        result = result.filter((record) => {
          const column = columns.find((col) => col.key === columnKey);
          const value = column?.dataIndex
            ? record[column.dataIndex]
            : record[columnKey];
          return value
            ?.toString()
            .toLowerCase()
            .includes(filterValue.toLowerCase());
        });
      }
    });

    // Apply sorting
    if (sortColumn && sortOrder) {
      result.sort((a, b) => {
        const column = columns.find((col) => col.key === sortColumn);
        const aValue = column?.dataIndex ? a[column.dataIndex] : a[sortColumn];
        const bValue = column?.dataIndex ? b[column.dataIndex] : b[sortColumn];

        if (aValue === bValue) return 0;

        let comparison = 0;
        if (typeof aValue === "number" && typeof bValue === "number") {
          comparison = aValue - bValue;
        } else {
          comparison = String(aValue).localeCompare(String(bValue));
        }

        return sortOrder === "asc" ? comparison : -comparison;
      });
    }

    return result;
  }, [data, searchTerm, filters, sortColumn, sortOrder, columns]);

  // Render cell content
  const renderCell = useCallback(
    (column: TableColumn<T>, record: T, index: number) => {
      if (column.render) {
        const value = column.dataIndex
          ? record[column.dataIndex]
          : record[column.key];
        return column.render(value, record, index);
      }

      const value = column.dataIndex
        ? record[column.dataIndex]
        : record[column.key];
      return value?.toString() || "";
    },
    []
  );

  // Get sort icon
  const getSortIcon = useCallback(
    (columnKey: string) => {
      if (sortColumn !== columnKey) {
        return <ArrowsUpDownIcon className='h-4 w-4 text-gray-400' />;
      }

      if (sortOrder === "asc") {
        return <ChevronUpIcon className='h-4 w-4 text-blue-600' />;
      }

      if (sortOrder === "desc") {
        return <ChevronDownIcon className='h-4 w-4 text-blue-600' />;
      }

      return <ArrowsUpDownIcon className='h-4 w-4 text-gray-400' />;
    },
    [sortColumn, sortOrder]
  );

  // Table classes
  const tableClasses = [
    "min-w-full divide-y divide-gray-200 dark:divide-gray-700",
    sizeClasses[size],
    className,
  ]
    .filter(Boolean)
    .join(" ");

  const containerClasses = [
    "bg-white dark:bg-gray-800 shadow rounded-lg overflow-hidden",
    bordered ? "border border-gray-200 dark:border-gray-700" : "",
  ]
    .filter(Boolean)
    .join(" ");

  if (loading) {
    return (
      <div className={containerClasses} data-testid={testId}>
        <div className='p-8'>
          <div className='animate-pulse space-y-4'>
            <div className='h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/4'></div>
            {[...Array(5)].map((_, i) => (
              <div
                key={i}
                className='h-4 bg-gray-200 dark:bg-gray-700 rounded'
              ></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={containerClasses} data-testid={testId}>
        <div className='p-8 text-center'>
          <div className='text-red-600 dark:text-red-400'>
            <p className='font-medium'>Error loading data</p>
            <p className='text-sm mt-1'>{error}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={containerClasses} data-testid={testId}>
      {/* Table Controls */}
      <div className='px-6 py-4 border-b border-gray-200 dark:border-gray-700'>
        <div className='flex items-center justify-between'>
          <div className='flex items-center space-x-4'>
            {/* Search */}
            <div className='relative'>
              <MagnifyingGlassIcon className='absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400' />
              <input
                type='text'
                placeholder='Search...'
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className='pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400'
              />
            </div>

            {/* Filter indicator */}
            {Object.values(filters).some(Boolean) && (
              <div className='flex items-center text-sm text-blue-600 dark:text-blue-400'>
                <FunnelIcon className='h-4 w-4 mr-1' />
                Filtered
              </div>
            )}
          </div>

          <div className='text-sm text-gray-600 dark:text-gray-400'>
            {processedData.length}{" "}
            {processedData.length === 1 ? "item" : "items"}
          </div>
        </div>
      </div>

      {/* Table */}
      <div
        className={`overflow-x-auto ${sticky ? "max-h-96 overflow-y-auto" : ""}`}
      >
        {processedData.length === 0 ? (
          <div className='text-center py-12'>
            <div className='text-gray-500 dark:text-gray-400'>
              <div className='text-6xl mb-4'>📊</div>
              <p className='text-lg font-medium mb-2'>No Data</p>
              <p>{emptyText}</p>
            </div>
          </div>
        ) : (
          <table className={tableClasses}>
            {/* Header */}
            <thead
              className={`bg-gray-50 dark:bg-gray-700 ${sticky ? "sticky top-0 z-10" : ""}`}
            >
              <tr>
                {columns.map((column) => (
                  <th
                    key={column.key}
                    className={`
                      ${cellPaddingClasses[size]}
                      text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider
                      ${column.sortable ? "cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors" : ""}
                      ${column.align === "center" ? "text-center" : column.align === "right" ? "text-right" : ""}
                      ${column.width ? `w-${column.width}` : ""}
                    `}
                    style={
                      typeof column.width === "number"
                        ? { width: column.width }
                        : undefined
                    }
                    onClick={
                      column.sortable ? () => handleSort(column.key) : undefined
                    }
                  >
                    <div className='flex items-center space-x-1'>
                      <span>{column.title}</span>
                      {column.sortable && getSortIcon(column.key)}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>

            {/* Body */}
            <tbody
              className={`bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700 ${striped ? "divide-y-0" : ""}`}
            >
              {processedData.map((record, index) => {
                const rowProps = onRow?.(record, index) || {};
                const key = getRowKey(record, index);

                return (
                  <tr
                    key={key}
                    className={`
                      ${striped && index % 2 === 1 ? "bg-gray-50 dark:bg-gray-700" : ""}
                      ${hoverable ? "hover:bg-gray-50 dark:hover:bg-gray-700" : ""}
                      ${rowProps.onClick ? "cursor-pointer" : ""}
                      ${rowProps.className || ""}
                      transition-colors
                    `}
                    onClick={rowProps.onClick}
                    onDoubleClick={rowProps.onDoubleClick}
                  >
                    {columns.map((column) => (
                      <td
                        key={column.key}
                        className={`
                          ${cellPaddingClasses[size]}
                          whitespace-nowrap text-gray-900 dark:text-white
                          ${column.align === "center" ? "text-center" : column.align === "right" ? "text-right" : ""}
                        `}
                      >
                        {renderCell(column, record, index)}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {pagination && processedData.length > 0 && (
        <div className='px-6 py-4 border-t border-gray-200 dark:border-gray-700'>
          <div className='flex items-center justify-between'>
            <div className='text-sm text-gray-600 dark:text-gray-400'>
              Showing {(pagination.current - 1) * pagination.pageSize + 1} to{" "}
              {Math.min(
                pagination.current * pagination.pageSize,
                pagination.total
              )}{" "}
              of {pagination.total} results
            </div>
            <div className='flex items-center space-x-2'>
              <button
                onClick={() =>
                  pagination.onChange(
                    pagination.current - 1,
                    pagination.pageSize
                  )
                }
                disabled={pagination.current <= 1}
                className='px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-gray-700'
              >
                Previous
              </button>
              <span className='text-sm text-gray-600 dark:text-gray-400'>
                Page {pagination.current} of{" "}
                {Math.ceil(pagination.total / pagination.pageSize)}
              </span>
              <button
                onClick={() =>
                  pagination.onChange(
                    pagination.current + 1,
                    pagination.pageSize
                  )
                }
                disabled={
                  pagination.current >=
                  Math.ceil(pagination.total / pagination.pageSize)
                }
                className='px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-gray-700'
              >
                Next
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Table;
