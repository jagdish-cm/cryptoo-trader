/**
 * Fallback component for lazy-loaded components
 */

import React from "react";
import { LoadingState } from "./LoadingState";

export interface LazyLoadFallbackProps {
  message?: string;
  size?: "sm" | "md" | "lg";
  showSpinner?: boolean;
}

/**
 * Fallback component shown while lazy components are loading
 */
export const LazyLoadFallback: React.FC<LazyLoadFallbackProps> = ({
  message = "Loading page...",
  size = "md",
  showSpinner = true,
}) => {
  return (
    <div className='min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center'>
      <div className='text-center'>
        {showSpinner && (
          <div className='mb-4'>
            <div className='animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto'></div>
          </div>
        )}
        <LoadingState
          message={message}
          size={size}
          className='bg-transparent'
        />
      </div>
    </div>
  );
};

export default LazyLoadFallback;
