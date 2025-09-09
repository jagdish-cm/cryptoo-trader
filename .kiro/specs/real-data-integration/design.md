# Design Document

## Overview

This design eliminates all mock data from the trading dashboard by implementing comprehensive real data integration. The system will connect to actual trading system databases, live market feeds, and real AI analytics services to provide authentic trading data across all dashboard pages.

## Architecture

### Data Flow Architecture

```
Trading System DB → Data Access Layer → API Endpoints → Frontend Components
Live Market Feeds → Market Data Service → Cache → WebSocket → Real-time Updates
AI Trading System → Decision Logger → Database → Analytics API → AI Analytics Page
```

### Component Integration

- **Backend API**: Remove all mock data generation, connect to real data sources
- **Data Bridge**: Enhanced to sync real trading data instead of generating mock data
- **Frontend Pages**: Updated to handle real data structures and empty states
- **WebSocket Service**: Stream real-time updates from actual trading operations

## Components and Interfaces

### Backend API Changes

#### Portfolio Service

```python
class RealPortfolioService:
    async def get_portfolio(self) -> Portfolio:
        # Query actual positions from trading system database
        positions = await self.db.get_active_positions()
        # Calculate real portfolio metrics from actual data
        return self.calculate_portfolio_metrics(positions)

    async def get_positions(self) -> List[Position]:
        # Return actual positions from database
        return await self.db.get_positions_with_current_prices()
```

#### Trade History Service

```python
class RealTradeHistoryService:
    async def get_trade_history(self, limit: int, offset: int) -> TradeHistory:
        # Query actual completed trades from database
        trades = await self.db.get_completed_trades(limit, offset)
        return TradeHistory(trades=trades, total=len(trades))

    async def calculate_performance_metrics(self, period: str) -> PerformanceMetrics:
        # Calculate real metrics from actual trade data
        trades = await self.db.get_trades_in_period(period)
        return self.compute_real_metrics(trades)
```

#### AI Analytics Service

```python
class RealAIAnalyticsService:
    async def get_ai_decisions(self, limit: int) -> List[AIDecision]:
        # Query actual AI decisions from decision log table
        return await self.db.get_ai_decision_history(limit)

    async def log_ai_decision(self, decision: AIDecision):
        # Log real AI decisions as they happen
        await self.db.insert_ai_decision(decision)
```

### Database Schema Extensions

#### AI Decision Logging Table

```sql
CREATE TABLE ai_decisions (
    id UUID PRIMARY KEY,
    timestamp TIMESTAMP NOT NULL,
    decision_type VARCHAR(50) NOT NULL,
    symbol VARCHAR(20) NOT NULL,
    confidence DECIMAL(5,3) NOT NULL,
    technical_score DECIMAL(5,3),
    sentiment_score DECIMAL(5,3),
    event_impact DECIMAL(5,3),
    reasoning JSONB,
    factors JSONB,
    outcome JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);
```

#### Market Data Cache Table

```sql
CREATE TABLE market_data_cache (
    symbol VARCHAR(20) PRIMARY KEY,
    price DECIMAL(15,8) NOT NULL,
    change_24h DECIMAL(10,4),
    volume_24h DECIMAL(20,2),
    high_24h DECIMAL(15,8),
    low_24h DECIMAL(15,8),
    last_updated TIMESTAMP NOT NULL
);
```

### Frontend Component Updates

#### Data Loading States

```typescript
interface DataState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  isEmpty: boolean;
}

// Replace mock data fallbacks with proper empty states
const useRealData = <T>(apiCall: () => Promise<T>) => {
  const [state, setState] = useState<DataState<T>>({
    data: null,
    loading: true,
    error: null,
    isEmpty: false,
  });

  // Handle real data loading without mock fallbacks
};
```

#### Empty State Components

```typescript
const EmptyPortfolio = () => (
  <div className='text-center py-12'>
    <h3>No Active Positions</h3>
    <p>Start trading to see your portfolio here</p>
  </div>
);

const EmptyTradeHistory = () => (
  <div className='text-center py-12'>
    <h3>No Trade History</h3>
    <p>Complete some trades to see performance metrics</p>
  </div>
);
```

## Data Models

### Real Portfolio Data Structure

```typescript
interface RealPortfolio {
  totalValue: number; // Calculated from actual positions
  availableBalance: number; // From trading account balance
  positions: RealPosition[]; // Actual open positions
  dailyPnL: number; // Calculated from real price changes
  totalPnL: number; // Sum of all realized + unrealized P&L
  lastUpdated: string; // Timestamp of last calculation
}

interface RealPosition {
  id: string;
  symbol: string;
  direction: "LONG" | "SHORT";
  entryPrice: number; // Actual entry price from trade
  currentPrice: number; // Live market price
  quantity: number; // Actual position size
  unrealizedPnL: number; // Calculated from current vs entry price
  entryTime: string; // Actual position open time
  stopLoss?: number; // Actual stop loss if set
  takeProfit?: number; // Actual take profit if set
}
```

### Real AI Decision Structure

```typescript
interface RealAIDecision {
  id: string;
  timestamp: string; // Actual decision timestamp
  type: string; // Real decision type from AI system
  symbol: string; // Symbol the decision was for
  confidence: number; // Actual confidence score
  reasoning: {
    technicalScore: number; // Real technical analysis score
    sentimentScore: number; // Real sentiment analysis score
    eventImpact: number; // Real event impact assessment
    riskFactors: string[]; // Actual identified risk factors
  };
  outcome: {
    action: string; // Actual action taken
    result: string; // Real outcome of the decision
    details: string; // Actual result details
  };
}
```

## Error Handling

### Data Unavailability Handling

```typescript
const DataErrorBoundary = ({ children, fallback }) => {
  // Handle cases where real data is unavailable
  // Show appropriate error messages instead of mock data
};

const NoDataAvailable = ({ message, retry }) => (
  <div className='text-center py-8'>
    <AlertCircle className='mx-auto h-12 w-12 text-gray-400' />
    <h3 className='mt-2 text-sm font-medium text-gray-900'>{message}</h3>
    <button onClick={retry} className='mt-4 btn-primary'>
      Retry Loading Data
    </button>
  </div>
);
```

### Connection Status Monitoring

```typescript
const useConnectionStatus = () => {
  // Monitor database and API connections
  // Show connection status in UI
  // Provide retry mechanisms for failed connections
};
```

## Testing Strategy

### Real Data Integration Tests

- **Database Integration Tests**: Verify actual data retrieval from trading system database
- **API Endpoint Tests**: Ensure all endpoints return real data without mock fallbacks
- **WebSocket Tests**: Verify real-time updates work with actual trading data
- **Empty State Tests**: Verify proper handling when no real data is available

### Data Validation Tests

- **Portfolio Calculation Tests**: Verify portfolio metrics calculated from real position data
- **Performance Metric Tests**: Ensure performance calculations use only actual trade data
- **AI Decision Tests**: Verify AI decisions are properly logged and retrieved

### Error Handling Tests

- **Database Failure Tests**: Verify proper error handling when database is unavailable
- **Market Data Failure Tests**: Test behavior when live market feeds are down
- **Empty Data Tests**: Ensure proper empty states when no trading data exists
