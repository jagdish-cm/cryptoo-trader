import React from "react";

interface FilterOption {
  key: string;
  label: string;
  icon?: React.ComponentType<{ className?: string }> | null;
}

interface FilterButtonsProps {
  filters: FilterOption[];
  activeFilter: string;
  onFilterChange: (filterKey: string) => void;
  getFilterCount: (filterKey: string) => number;
  className?: string;
}

const FilterButtons: React.FC<FilterButtonsProps> = ({
  filters,
  activeFilter,
  onFilterChange,
  getFilterCount,
  className = "",
}) => {
  const getFilterButtonClass = (filterKey: string, isActive: boolean) => {
    const baseClass =
      "inline-flex items-center px-3 py-1.5 rounded-md text-sm font-medium transition-colors";

    if (!isActive) {
      return `${baseClass} bg-gray-50 text-gray-600 dark:bg-gray-700 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-600`;
    }

    switch (filterKey) {
      case "executed":
        return `${baseClass} bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400`;
      case "rejected":
        return `${baseClass} bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400`;
      case "pending":
        return `${baseClass} bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-400`;
      default:
        return `${baseClass} bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400`;
    }
  };

  return (
    <div className={`flex items-center space-x-2 ${className}`}>
      <span className='text-sm text-gray-500 dark:text-gray-400'>Filter:</span>
      <div className='flex items-center space-x-1'>
        {filters.map((filter) => {
          const Icon = filter.icon;
          const filteredCount = getFilterCount(filter.key);
          const isActive = activeFilter === filter.key;

          return (
            <button
              key={filter.key}
              onClick={() => onFilterChange(filter.key)}
              className={getFilterButtonClass(filter.key, isActive)}
            >
              {Icon && <Icon className='h-3 w-3 mr-1' />}
              {filter.label}
              <span className='ml-1 px-1.5 py-0.5 text-xs bg-white dark:bg-gray-800 rounded'>
                {filteredCount}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default FilterButtons;
