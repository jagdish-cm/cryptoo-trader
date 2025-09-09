# Development Guide

This guide provides comprehensive information for developers working on the Trading Dashboard frontend application.

## 🚀 Getting Started

### Prerequisites

- Node.js 18+ (LTS recommended)
- npm 9+ or yarn 1.22+
- Git 2.30+
- VS Code (recommended) with extensions:
  - TypeScript and JavaScript Language Features
  - ES7+ React/Redux/React-Native snippets
  - Tailwind CSS IntelliSense
  - Auto Rename Tag
  - Bracket Pair Colorizer

### Initial Setup

```bash
# Clone the repository
git clone <repository-url>
cd trading-dashboard

# Install dependencies
npm install

# Copy environment file
cp .env.example .env

# Start development server
npm run dev
```

## 📁 Project Structure Deep Dive

### Component Organization

```
components/
├── analytics/           # AI analytics and performance components
│   ├── AIDecisionOverview.tsx
│   ├── AIDecisionsList.tsx
│   ├── charts/         # Chart components
│   ├── decisions/      # Decision-related components
│   └── performance/    # Performance analysis components
├── config/             # Configuration panels
├── dashboard/          # Dashboard layout and navigation
├── portfolio/          # Portfolio management components
├── trading/            # Trading operations components
│   ├── controls/       # Trading control panels
│   ├── market-data/    # Market data displays
│   ├── positions/      # Position management
│   └── signals/        # Trading signals
└── ui/                 # Generic, reusable UI components
    ├── data-display/   # Tables, cards, metrics
    ├── feedback/       # Loading, error, empty states
    └── forms/          # Form inputs and validation
```

### Hook Organization

```
hooks/
├── ai/                 # AI analytics hooks
├── api/                # API data fetching hooks
├── config/             # Configuration hooks
├── performance/        # Performance monitoring hooks
├── portfolio/          # Portfolio management hooks
├── trading/            # Trading operations hooks
├── ui/                 # UI interaction hooks
└── websocket/          # WebSocket subscription hooks
```

## 🛠️ Development Patterns

### Component Development

#### 1. Component Structure

```tsx
/**
 * @fileoverview Brief description of the component's purpose
 */

import React from "react";
import { BaseComponentProps } from "../../types/common/base";

interface ComponentProps extends BaseComponentProps {
  // Component-specific props
}

/**
 * Component description with usage examples
 *
 * @param props - Component props
 * @returns JSX element
 */
export const Component: React.FC<ComponentProps> = React.memo(
  ({ className = "", testId, ...props }) => {
    // Component implementation

    return (
      <div className={className} data-testid={testId}>
        {/* Component content */}
      </div>
    );
  }
);

Component.displayName = "Component";

export default Component;
```

#### 2. Custom Hook Pattern

```tsx
/**
 * Custom hook for [specific functionality]
 *
 * @param options - Hook configuration options
 * @returns Hook return object
 */
export const useCustomHook = (options: HookOptions = {}) => {
  const [state, setState] = useState(initialState);

  const stableCallback = useStableCallback(
    (param) => {
      // Implementation
    },
    [dependencies]
  );

  const expensiveValue = useExpensiveMemo(
    () => expensiveCalculation(state),
    [state],
    "hook-calculation"
  );

  return {
    state,
    stableCallback,
    expensiveValue,
  };
};
```

### Performance Best Practices

#### 1. Memoization

```tsx
// Use React.memo for pure components
export const PureComponent = React.memo(({ data }) => {
  return <div>{data.value}</div>;
});

// Use useExpensiveMemo for expensive calculations
const expensiveResult = useExpensiveMemo(
  () => complexCalculation(data),
  [data],
  "expensive-calculation"
);

// Use useStableCallback for stable references
const handleClick = useStableCallback(
  (item) => {
    onItemClick(item);
  },
  [onItemClick]
);
```

#### 2. Lazy Loading

```tsx
// Page-level lazy loading
const LazyPage = React.lazy(() => import("./LazyPage"));

// Component-level lazy loading with Suspense
<Suspense fallback={<LoadingFallback />}>
  <LazyComponent />
</Suspense>;
```

#### 3. WebSocket Optimization

```tsx
// Use optimized WebSocket hooks
const { subscribe, getCachedData } = useOptimizedWebSocket(
  client,
  "market-data",
  {
    throttle: 1000,
    cache: true,
    cacheTTL: 30000,
  }
);

// Subscribe with cleanup
useEffect(() => {
  const unsubscribe = subscribe((data) => {
    setMarketData(data);
  });

  return unsubscribe;
}, [subscribe]);
```

### State Management

#### 1. Redux Patterns

```tsx
// Use memoized selectors
const portfolioData = useSelector(selectPortfolioData);
const portfolioMetrics = useSelector(selectPortfolioMetrics);

// Use RTK Query for API calls
const { data, loading, error } = useGetPortfolioQuery();
```

#### 2. Local State Management

```tsx
// Keep state local when possible
const [localState, setLocalState] = useState(initialValue);

// Use context for shared state
const { theme, toggleTheme } = useTheme();
```

## 🎨 Styling Guidelines

### Tailwind CSS Patterns

#### 1. Component Styling

```tsx
// Use consistent spacing and sizing
<div className='p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700'>
  <h2 className='text-lg font-medium text-gray-900 dark:text-white mb-4'>
    Title
  </h2>
  <div className='space-y-4'>{/* Content */}</div>
</div>
```

#### 2. Responsive Design

```tsx
// Mobile-first approach
<div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'>
  {/* Grid items */}
</div>
```

#### 3. Dark Mode Support

```tsx
// Always include dark mode variants
<button className='bg-white dark:bg-gray-800 text-gray-900 dark:text-white border border-gray-300 dark:border-gray-600'>
  Button
</button>
```

### Color Palette

```css
/* Primary colors */
--color-primary-50: #eff6ff;
--color-primary-500: #3b82f6;
--color-primary-900: #1e3a8a;

/* Success colors */
--color-success-50: #f0fdf4;
--color-success-500: #22c55e;
--color-success-900: #14532d;

/* Error colors */
--color-error-50: #fef2f2;
--color-error-500: #ef4444;
--color-error-900: #7f1d1d;
```

## 🧪 Testing Guidelines

### Unit Testing

```tsx
import { render, screen, fireEvent } from "@testing-library/react";
import { renderWithProviders } from "../utils/testing/renderWithProviders";
import { Component } from "./Component";

describe("Component", () => {
  it("renders correctly", () => {
    renderWithProviders(<Component />);
    expect(screen.getByText("Expected Text")).toBeInTheDocument();
  });

  it("handles user interactions", () => {
    const onClickMock = jest.fn();
    renderWithProviders(<Component onClick={onClickMock} />);

    fireEvent.click(screen.getByRole("button"));
    expect(onClickMock).toHaveBeenCalled();
  });
});
```

### Integration Testing

```tsx
describe("Portfolio Integration", () => {
  it("displays portfolio data correctly", async () => {
    const mockData = mockPortfolioData();

    renderWithProviders(<PortfolioPage />, {
      preloadedState: {
        portfolio: mockData,
      },
    });

    await waitFor(() => {
      expect(screen.getByText("Portfolio Value")).toBeInTheDocument();
    });
  });
});
```

### Performance Testing

```tsx
describe("Performance", () => {
  it("renders large lists efficiently", () => {
    const largeDataset = generateLargeDataset(1000);
    const { rerender } = renderWithProviders(<DataTable data={largeDataset} />);

    // Measure render time
    const startTime = performance.now();
    rerender(<DataTable data={largeDataset} />);
    const endTime = performance.now();

    expect(endTime - startTime).toBeLessThan(100); // Should render in <100ms
  });
});
```

## 🔧 Development Tools

### VS Code Configuration

```json
// .vscode/settings.json
{
  "typescript.preferences.importModuleSpecifier": "relative",
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "tailwindCSS.experimental.classRegex": [
    ["clsx\\(([^)]*)\\)", "(?:'|\"|`)([^']*)(?:'|\"|`)"]
  ]
}
```

### ESLint Configuration

```json
// .eslintrc.json
{
  "extends": [
    "@typescript-eslint/recommended",
    "plugin:react/recommended",
    "plugin:react-hooks/recommended"
  ],
  "rules": {
    "react/react-in-jsx-scope": "off",
    "@typescript-eslint/no-unused-vars": "error",
    "react-hooks/exhaustive-deps": "warn"
  }
}
```

## 🐛 Troubleshooting

### Common Issues

#### 1. TypeScript Errors

```bash
# Clear TypeScript cache
rm -rf node_modules/.cache
npm run type-check

# Check for circular dependencies
npx madge --circular --extensions ts,tsx src/
```

#### 2. Performance Issues

```tsx
// Use React DevTools Profiler
// Check for unnecessary re-renders
console.log("Component rendered:", componentName);

// Monitor expensive calculations
const result = useExpensiveMemo(
  () => expensiveFunction(),
  [deps],
  "debug-name"
);
```

#### 3. WebSocket Connection Issues

```tsx
// Check connection status
const { state } = useWebSocketContext();
console.log("WebSocket state:", state.connectionState);

// Monitor subscription count
const stats = subscriptionManager.getStats();
console.log("Active subscriptions:", stats.activeSubscriptions);
```

#### 4. Bundle Size Issues

```bash
# Analyze bundle size
npm run build
npx vite-bundle-analyzer dist

# Check for duplicate dependencies
npx npm-check-duplicates
```

### Debugging Tips

#### 1. Component Debugging

```tsx
// Add debug props
interface DebugProps {
  debug?: boolean;
}

const Component: React.FC<Props & DebugProps> = ({ debug, ...props }) => {
  if (debug) {
    console.log("Component props:", props);
  }

  return <div>{/* Component content */}</div>;
};
```

#### 2. Performance Debugging

```tsx
// Use performance monitoring
const { startMeasurement, endMeasurement } =
  usePerformanceMonitor("component-render");

useEffect(() => {
  startMeasurement();
  // Expensive operation
  endMeasurement();
}, []);
```

#### 3. State Debugging

```tsx
// Redux DevTools
// Enable in development
const store = configureStore({
  reducer: rootReducer,
  devTools: process.env.NODE_ENV !== "production",
});
```

## 📈 Performance Monitoring

### Built-in Monitoring

```tsx
// Component render monitoring
const ComponentWithMonitoring = React.memo(() => {
  const renderCount = useRef(0);
  renderCount.current++;

  if (process.env.NODE_ENV === "development") {
    console.log(`Component rendered ${renderCount.current} times`);
  }

  return <div>Content</div>;
});
```

### Bundle Analysis

```bash
# Regular bundle analysis
npm run build
npm run analyze

# Check for code splitting effectiveness
ls -la dist/assets/
```

## 🚀 Deployment

### Build Process

```bash
# Production build
npm run build

# Preview production build
npm run preview

# Type checking
npm run type-check

# Linting
npm run lint
```

### Environment Configuration

```env
# Development
VITE_API_BASE_URL=http://localhost:8000
VITE_WEBSOCKET_URL=ws://localhost:8001
VITE_ENABLE_MOCK_DATA=true

# Production
VITE_API_BASE_URL=https://api.trading-dashboard.com
VITE_WEBSOCKET_URL=wss://ws.trading-dashboard.com
VITE_ENABLE_MOCK_DATA=false
```

## 📚 Additional Resources

### Documentation

- [React Documentation](https://react.dev/)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)
- [Redux Toolkit Documentation](https://redux-toolkit.js.org/)

### Tools

- [React DevTools](https://chrome.google.com/webstore/detail/react-developer-tools/)
- [Redux DevTools](https://chrome.google.com/webstore/detail/redux-devtools/)
- [Vite Documentation](https://vitejs.dev/)

### Best Practices

- [React Best Practices](https://react.dev/learn/thinking-in-react)
- [TypeScript Best Practices](https://typescript-eslint.io/rules/)
- [Performance Best Practices](https://web.dev/performance/)

---

This guide is a living document. Please contribute improvements and updates as the project evolves.
