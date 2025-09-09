# Frontend Refactoring Design Document

## Overview

This design document outlines a comprehensive refactoring strategy for the trading dashboard frontend application. The refactoring will transform the current monolithic file structure into a well-organized, maintainable, and scalable architecture following enterprise-level software engineering practices.

### Current State Analysis

Based on file size analysis, the following files require immediate refactoring:

- `ExecutionThresholdVisualization.tsx` (570 lines) - Complex analytics component
- `PerformancePage.tsx` (501 lines) - Large page component with multiple concerns
- `TradingPage.tsx` (493 lines) - Complex trading interface
- `AIAnalyticsPage.tsx` (410 lines) - Analytics dashboard
- `WebSocketContext.tsx` (393 lines) - Complex context provider
- `ConfigPage.tsx` (373 lines) - Configuration interface
- `types/index.ts` (351 lines) - Monolithic type definitions

### Refactoring Principles

1. **Single Responsibility Principle**: Each file should have one clear purpose
2. **Separation of Concerns**: Business logic, presentation, and data management should be separated
3. **Composition over Inheritance**: Use component composition for flexibility
4. **DRY (Don't Repeat Yourself)**: Extract common patterns into reusable utilities
5. **Explicit Dependencies**: Clear import/export structure with proper typing

## Architecture

### New Directory Structure

```
src/
├── components/
│   ├── analytics/
│   │   ├── charts/                    # Chart-specific components
│   │   ├── metrics/                   # Metric display components
│   │   ├── thresholds/               # Execution threshold components
│   │   └── decisions/                # AI decision components
│   ├── trading/
│   │   ├── positions/                # Position management components
│   │   ├── signals/                  # Trading signal components
│   │   ├── orders/                   # Order management components
│   │   └── market-data/              # Market data display components
│   ├── dashboard/
│   │   ├── layout/                   # Layout components
│   │   ├── status/                   # System status components
│   │   └── navigation/               # Navigation components
│   ├── ui/
│   │   ├── forms/                    # Form components
│   │   ├── data-display/             # Data display components
│   │   ├── feedback/                 # Loading, error, empty states
│   │   └── controls/                 # Interactive controls
│   └── common/                       # Shared components
├── hooks/
│   ├── api/                          # API-specific hooks
│   ├── websocket/                    # WebSocket hooks
│   ├── trading/                      # Trading-specific hooks
│   └── ui/                           # UI-specific hooks
├── services/
│   ├── websocket/                    # WebSocket service modules
│   ├── api/                          # API service modules
│   └── utils/                        # Service utilities
├── store/
│   ├── api/                          # RTK Query APIs
│   ├── slices/                       # Redux slices
│   ├── middleware/                   # Custom middleware
│   └── selectors/                    # Reusable selectors
├── types/
│   ├── api/                          # API-related types
│   ├── trading/                      # Trading-specific types
│   ├── ui/                           # UI component types
│   └── common/                       # Shared types
├── utils/
│   ├── formatting/                   # Data formatting utilities
│   ├── validation/                   # Validation utilities
│   ├── calculations/                 # Business calculation utilities
│   └── constants/                    # Application constants
├── contexts/
│   ├── websocket/                    # WebSocket context modules
│   └── theme/                        # Theme context modules
└── pages/
    ├── components/                   # Page-specific components
    └── hooks/                        # Page-specific hooks
```

## Components and Interfaces

### 1. Analytics Components Refactoring

#### ExecutionThresholdVisualization (570 lines → Multiple files)

**New Structure:**

```
components/analytics/thresholds/
├── ExecutionThresholdVisualization.tsx     (~150 lines)
├── ThresholdMetricsPanel.tsx               (~120 lines)
├── DecisionAnalysisCard.tsx                (~100 lines)
├── ThresholdConfigPanel.tsx                (~100 lines)
├── PerformanceChart.tsx                    (~100 lines)
└── hooks/
    ├── useThresholdData.ts                 (~50 lines)
    └── useThresholdAnalysis.ts             (~50 lines)
```

**Key Interfaces:**

```typescript
// components/analytics/thresholds/types.ts
export interface ThresholdVisualizationProps {
  aiDecisions: AIDecision[];
  className?: string;
}

export interface ThresholdMetrics {
  executionRate: number;
  rejectionRate: number;
  averageConfidence: number;
  performanceScore: number;
}

export interface DecisionAnalysis {
  decision: AIDecision;
  thresholdComparison: ThresholdComparison;
  riskAssessment: RiskAssessment;
}
```

#### AI Analytics Components

**New Structure:**

```
components/analytics/decisions/
├── AIDecisionOverview.tsx                  (~80 lines)
├── AIDecisionsList.tsx                     (~150 lines)
├── DecisionCard.tsx                        (~150 lines)
├── DecisionFilters.tsx                     (~80 lines)
└── DecisionMetrics.tsx                     (~100 lines)

components/analytics/performance/
├── AIModelPerformance.tsx                  (~130 lines)
├── PerformanceMetrics.tsx                  (~80 lines)
├── ModelComparisonChart.tsx                (~100 lines)
└── AccuracyTrends.tsx                      (~90 lines)
```

### 2. Page Components Refactoring

#### TradingPage (493 lines → Modular structure)

**New Structure:**

```
pages/TradingPage.tsx                       (~100 lines)
pages/components/trading/
├── TradingDashboard.tsx                    (~120 lines)
├── PositionsPanel.tsx                      (~100 lines)
├── SignalsPanel.tsx                        (~100 lines)
├── MarketDataPanel.tsx                     (~80 lines)
└── TradingControls.tsx                     (~90 lines)

pages/hooks/trading/
├── useTradingData.ts                       (~60 lines)
├── useTradingActions.ts                    (~50 lines)
└── useTradingConfig.ts                     (~40 lines)
```

#### PerformancePage (501 lines → Modular structure)

**New Structure:**

```
pages/PerformancePage.tsx                   (~100 lines)
pages/components/performance/
├── PerformanceDashboard.tsx                (~120 lines)
├── TradeHistoryPanel.tsx                   (~100 lines)
├── MetricsPanel.tsx                        (~100 lines)
├── ChartsPanel.tsx                         (~100 lines)
└── PerformanceFilters.tsx                  (~80 lines)

pages/hooks/performance/
├── usePerformanceData.ts                   (~60 lines)
├── useTradeHistory.ts                      (~50 lines)
└── usePerformanceMetrics.ts                (~40 lines)
```

### 3. Context and Service Refactoring

#### WebSocketContext (393 lines → Modular structure)

**New Structure:**

```
contexts/websocket/
├── WebSocketContext.tsx                    (~100 lines)
├── WebSocketProvider.tsx                   (~120 lines)
├── useWebSocket.ts                         (~80 lines)
└── websocketReducer.ts                     (~90 lines)

services/websocket/
├── WebSocketClient.ts                      (~150 lines)
├── WebSocketEventHandlers.ts               (~100 lines)
├── WebSocketSubscriptions.ts               (~80 lines)
└── WebSocketUtils.ts                       (~60 lines)
```

### 4. Type System Refactoring

#### types/index.ts (351 lines → Domain-specific modules)

**New Structure:**

```
types/
├── index.ts                                (~50 lines - re-exports)
├── trading/
│   ├── positions.ts                        (~80 lines)
│   ├── trades.ts                           (~60 lines)
│   ├── signals.ts                          (~50 lines)
│   └── portfolio.ts                        (~70 lines)
├── api/
│   ├── requests.ts                         (~60 lines)
│   ├── responses.ts                        (~80 lines)
│   └── websocket.ts                        (~50 lines)
├── ui/
│   ├── components.ts                       (~60 lines)
│   ├── forms.ts                            (~40 lines)
│   └── charts.ts                           (~50 lines)
└── common/
    ├── enums.ts                            (~40 lines)
    ├── utilities.ts                        (~30 lines)
    └── constants.ts                        (~20 lines)
```

## Data Models

### Component Props Interfaces

```typescript
// Standardized component prop patterns
export interface BaseComponentProps {
  className?: string;
  testId?: string;
}

export interface DataComponentProps<T> extends BaseComponentProps {
  data: T;
  loading?: boolean;
  error?: string | null;
}

export interface InteractiveComponentProps extends BaseComponentProps {
  disabled?: boolean;
  onClick?: () => void;
}
```

### Hook Return Types

```typescript
// Standardized hook return patterns
export interface DataHookReturn<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export interface MutationHookReturn<T, P> {
  mutate: (params: P) => Promise<T>;
  loading: boolean;
  error: string | null;
}
```

## Error Handling

### Error Boundary Strategy

```typescript
// utils/error-handling/ErrorBoundary.tsx
export interface ErrorBoundaryProps {
  fallback?: React.ComponentType<ErrorFallbackProps>;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  children: React.ReactNode;
}

// utils/error-handling/errorUtils.ts
export interface ErrorHandlingUtils {
  formatError: (error: unknown) => string;
  logError: (error: Error, context?: string) => void;
  isNetworkError: (error: unknown) => boolean;
  isValidationError: (error: unknown) => boolean;
}
```

### Loading and Empty States

```typescript
// components/ui/feedback/LoadingState.tsx
export interface LoadingStateProps extends BaseComponentProps {
  size?: "sm" | "md" | "lg";
  message?: string;
}

// components/ui/feedback/EmptyState.tsx
export interface EmptyStateProps extends BaseComponentProps {
  icon?: React.ComponentType;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}
```

## Testing Strategy

### Component Testing Structure

```typescript
// Each component will have corresponding test files
components/analytics/thresholds/
├── ExecutionThresholdVisualization.test.tsx
├── ThresholdMetricsPanel.test.tsx
├── DecisionAnalysisCard.test.tsx
└── __mocks__/
    └── thresholdData.ts

// Test utilities for common patterns
utils/testing/
├── renderWithProviders.tsx
├── mockData.ts
├── testUtils.ts
└── customMatchers.ts
```

### Hook Testing

```typescript
// hooks/api/__tests__/
├── useThresholdData.test.ts
├── useTradingData.test.ts
└── usePerformanceData.test.ts

// Testing custom hooks with proper mocking
import { renderHook } from '@testing-library/react';
import { useThresholdData } from '../useThresholdData';
```

### Integration Testing

```typescript
// pages/__tests__/integration/
├── TradingPage.integration.test.tsx
├── PerformancePage.integration.test.tsx
└── AIAnalyticsPage.integration.test.tsx
```

## Performance Optimizations

### Code Splitting Strategy

```typescript
// Lazy loading for page components
const TradingPage = lazy(() => import("./pages/TradingPage"));
const PerformancePage = lazy(() => import("./pages/PerformancePage"));
const AIAnalyticsPage = lazy(() => import("./pages/AIAnalyticsPage"));

// Component-level code splitting for heavy components
const ExecutionThresholdVisualization = lazy(
  () =>
    import("./components/analytics/thresholds/ExecutionThresholdVisualization")
);
```

### Memoization Strategy

```typescript
// utils/performance/memoization.ts
export const memoizeComponent = <P extends object>(
  Component: React.ComponentType<P>
): React.ComponentType<P> => React.memo(Component);

export const memoizeSelector = <T, R>(
  selector: (state: T) => R
): ((state: T) => R) => createSelector([selector], (result) => result);
```

### Bundle Analysis

```typescript
// Build-time bundle analysis configuration
// webpack-bundle-analyzer integration
// Performance budgets for each module
const performanceBudgets = {
  maxAssetSize: 250000,
  maxEntrypointSize: 250000,
  hints: "warning",
};
```

## Migration Strategy

### Phase 1: Type System Refactoring

1. Split `types/index.ts` into domain-specific modules
2. Update all imports across the codebase
3. Ensure TypeScript compilation passes

### Phase 2: Utility and Service Extraction

1. Extract common utilities from large files
2. Refactor WebSocket service and context
3. Create reusable hooks

### Phase 3: Component Decomposition

1. Refactor `ExecutionThresholdVisualization` component
2. Break down page components into smaller modules
3. Extract common UI patterns

### Phase 4: Testing and Documentation

1. Add comprehensive tests for new modules
2. Update documentation and README files
3. Performance testing and optimization

### Phase 5: Final Integration and Cleanup

1. Remove unused code and dependencies
2. Final performance optimization
3. Code review and quality assurance
