# Trading Dashboard - Frontend Application

A modern, high-performance React-based trading dashboard with real-time data visualization, portfolio management, and AI-powered analytics.

## 🚀 Features

- **Real-time Trading Data**: Live market data, positions, and portfolio updates via WebSocket
- **AI Analytics**: Advanced AI decision tracking and performance analysis
- **Portfolio Management**: Comprehensive portfolio overview with performance metrics
- **Performance Optimization**: Code splitting, lazy loading, and memoization for optimal performance
- **Responsive Design**: Mobile-first design with dark mode support
- **Type Safety**: Full TypeScript implementation with strict type checking

## 📁 Project Structure

```
src/
├── components/           # Reusable UI components
│   ├── analytics/       # Analytics-specific components
│   ├── config/          # Configuration panels
│   ├── dashboard/       # Dashboard layout components
│   ├── portfolio/       # Portfolio management components
│   ├── trading/         # Trading-specific components
│   └── ui/              # Generic UI components
│       ├── data-display/    # Tables, cards, metrics
│       ├── feedback/        # Loading, error states
│       └── forms/           # Form inputs and validation
├── contexts/            # React contexts
│   └── websocket/       # WebSocket connection management
├── hooks/               # Custom React hooks
│   ├── ai/              # AI analytics hooks
│   ├── api/             # API data fetching hooks
│   ├── config/          # Configuration hooks
│   ├── performance/     # Performance monitoring hooks
│   ├── portfolio/       # Portfolio management hooks
│   ├── trading/         # Trading operations hooks
│   ├── ui/              # UI interaction hooks
│   └── websocket/       # WebSocket subscription hooks
├── pages/               # Page components
│   └── components/      # Page-specific components
├── services/            # External service integrations
│   ├── api/             # REST API clients
│   └── websocket/       # WebSocket clients and utilities
├── store/               # Redux store configuration
│   ├── api/             # RTK Query API definitions
│   ├── selectors/       # Memoized selectors
│   └── slices/          # Redux slices
├── types/               # TypeScript type definitions
│   ├── api/             # API response types
│   ├── common/          # Shared types
│   ├── trading/         # Trading-specific types
│   └── ui/              # UI component types
└── utils/               # Utility functions
    ├── calculations/    # Mathematical calculations
    ├── constants/       # Application constants
    ├── error-handling/  # Error utilities
    ├── formatting/      # Data formatting utilities
    ├── performance/     # Performance optimization utilities
    ├── preloading/      # Component preloading utilities
    ├── testing/         # Testing utilities
    ├── ui/              # UI helper utilities
    └── validation/      # Data validation utilities
```

## 🛠️ Development Setup

### Prerequisites

- Node.js 18+
- npm or yarn
- TypeScript 4.9+

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd trading-dashboard

# Install dependencies
npm install

# Start development server
npm run dev
```

### Available Scripts

```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run preview      # Preview production build
npm run test         # Run tests
npm run test:watch   # Run tests in watch mode
npm run lint         # Run ESLint
npm run type-check   # Run TypeScript type checking
```

## 🏗️ Architecture

### Component Architecture

The application follows a modular component architecture with clear separation of concerns:

- **Pages**: Top-level route components that orchestrate data and layout
- **Components**: Reusable UI components organized by domain
- **Hooks**: Custom hooks for data fetching, state management, and side effects
- **Services**: External integrations and API clients
- **Utils**: Pure utility functions and helpers

### State Management

- **Redux Toolkit**: Global state management with RTK Query for API caching
- **React Context**: WebSocket connections and theme management
- **Local State**: Component-specific state with React hooks

### Performance Optimizations

- **Code Splitting**: Lazy loading of pages and heavy components
- **Memoization**: React.memo, useMemo, and useCallback for preventing unnecessary re-renders
- **WebSocket Optimization**: Throttling, debouncing, and batching of real-time updates
- **Bundle Optimization**: Tree shaking and dynamic imports

## 📚 Component Documentation

### Core Components

#### MetricCard

Displays key performance indicators with trend visualization.

```tsx
import { MetricCard } from "./components/ui/MetricCard";

<MetricCard
  title='Total Revenue'
  value='$125,430'
  change={12.5}
  changeType='percentage'
  icon={CurrencyDollarIcon}
  color='success'
  size='md'
  onClick={() => navigate("/revenue")}
/>;
```

#### Table

Advanced data table with sorting, filtering, and pagination.

```tsx
import { Table } from "./components/ui/data-display/Table";

<Table
  columns={columns}
  data={positions}
  pagination={{
    current: 1,
    pageSize: 10,
    total: positions.length,
    onChange: handlePageChange,
  }}
  onRow={(record) => ({
    onClick: () => handleRowClick(record),
  })}
/>;
```

### Custom Hooks

#### usePortfolioData

Comprehensive portfolio data management with real-time updates.

```tsx
import { usePortfolioData } from "./hooks/portfolio/usePortfolioData";

const {
  portfolio,
  performanceData,
  loading,
  error,
  totalPnL,
  profitablePositions,
  refresh,
  closePosition,
} = usePortfolioData({
  autoRefresh: true,
  refreshInterval: 30000,
});
```

#### useOptimizedWebSocket

Optimized WebSocket subscriptions with caching and throttling.

```tsx
import { useOptimizedWebSocket } from "./services/websocket/WebSocketOptimizations";

const { subscribe, unsubscribe, getCachedData } = useOptimizedWebSocket(
  websocketClient,
  "market-data",
  {
    throttle: 1000,
    cache: true,
    cacheTTL: 30000,
  }
);
```

## 🎨 Styling

### Design System

- **Tailwind CSS**: Utility-first CSS framework
- **Dark Mode**: System preference detection with manual toggle
- **Responsive Design**: Mobile-first approach with breakpoint-specific styles
- **Color Palette**: Consistent color scheme for trading applications

### Component Variants

Components support multiple variants for consistent styling:

- **Sizes**: `sm`, `md`, `lg`
- **Colors**: `default`, `success`, `warning`, `error`, `info`
- **Variants**: `default`, `outlined`, `filled`, `elevated`

## 🧪 Testing

### Testing Strategy

- **Unit Tests**: Component logic and utility functions
- **Integration Tests**: Component interactions and data flow
- **Performance Tests**: Optimization effectiveness
- **E2E Tests**: Critical user workflows

### Testing Utilities

```tsx
import { renderWithProviders } from "./utils/testing/renderWithProviders";
import { mockData } from "./utils/testing/mockData";

test("renders portfolio summary correctly", () => {
  const { getByText } = renderWithProviders(
    <PortfolioSummary portfolio={mockData.portfolio} />
  );

  expect(getByText("Total Value")).toBeInTheDocument();
});
```

## 🚀 Performance

### Optimization Techniques

1. **Code Splitting**: Lazy loading reduces initial bundle size
2. **Memoization**: Prevents unnecessary re-renders and calculations
3. **WebSocket Optimization**: Efficient real-time data handling
4. **Bundle Analysis**: Regular monitoring of bundle size and dependencies

### Performance Monitoring

```tsx
import { usePerformanceMonitor } from "./utils/performance/memoization";

const { startMeasurement, endMeasurement } = usePerformanceMonitor(
  "portfolio-calculation"
);

// Measure expensive operations
startMeasurement();
const result = expensiveCalculation();
endMeasurement();
```

## 🔧 Configuration

### Environment Variables

```env
VITE_API_BASE_URL=http://localhost:8000
VITE_WEBSOCKET_URL=ws://localhost:8001
VITE_ENABLE_MOCK_DATA=false
VITE_LOG_LEVEL=info
```

### Build Configuration

- **Vite**: Fast build tool with HMR
- **TypeScript**: Strict type checking
- **ESLint**: Code quality and consistency
- **Prettier**: Code formatting

## 📈 Monitoring

### Performance Metrics

- Bundle size analysis
- Component render performance
- WebSocket message throughput
- Memory usage tracking

### Error Tracking

- Error boundaries for graceful error handling
- Performance monitoring for slow operations
- WebSocket connection monitoring

## 🤝 Contributing

### Development Guidelines

1. **Type Safety**: All code must be fully typed
2. **Performance**: Consider performance implications of changes
3. **Testing**: Write tests for new features and bug fixes
4. **Documentation**: Update documentation for API changes
5. **Code Style**: Follow established patterns and conventions

### Code Review Checklist

- [ ] TypeScript compilation passes
- [ ] All tests pass
- [ ] Performance impact considered
- [ ] Documentation updated
- [ ] Accessibility requirements met
- [ ] Mobile responsiveness verified

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🆘 Support

For questions and support:

1. Check the documentation
2. Search existing issues
3. Create a new issue with detailed information
4. Contact the development team

---

Built with ❤️ using React, TypeScript, and modern web technologies.
