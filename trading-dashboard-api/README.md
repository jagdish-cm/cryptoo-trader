# Trading Dashboard API

This is the FastAPI backend that connects the AI Trading System to the React dashboard frontend.

## Architecture

```
AI Trading System (PostgreSQL + Redis)
    ↓ (Data Bridge)
FastAPI Backend (REST API + WebSocket)
    ↓ (HTTP + WebSocket)
React Frontend (Dashboard)
```

## Setup and Running

### 1. Install Dependencies

```bash
cd trading-dashboard-api
pip install -r requirements.txt
```

### 2. Start the API Server

```bash
python start_api.py
```

The API will be available at:

- **REST API**: http://localhost:8000/api
- **WebSocket**: ws://localhost:8000/ws
- **API Documentation**: http://localhost:8000/docs
- **Health Check**: http://localhost:8000/health

### 3. Start the Data Bridge (Optional)

To sync real data from the AI trading system:

```bash
python data_bridge.py
```

### 4. Start the Frontend

```bash
cd ../trading-dashboard
npm run dev
```

The dashboard will be available at http://localhost:3000

## API Endpoints

### System Management

- `GET /api/system/status` - Get system status
- `POST /api/system/start` - Start trading system
- `POST /api/system/stop` - Stop trading system
- `POST /api/system/emergency-stop` - Emergency stop

### Trading Data

- `GET /api/portfolio` - Get portfolio information
- `GET /api/positions` - Get open positions
- `GET /api/trades/history` - Get trade history
- `GET /api/signals` - Get trading signals

### Market Data

- `GET /api/market/{symbol}/price` - Get latest price
- `GET /api/analytics/performance` - Get performance metrics

### WebSocket Events

The WebSocket connection supports real-time updates for:

- `system_status` - System status changes
- `portfolio_update` - Portfolio value updates
- `position_update` - Position changes
- `trade_executed` - New trades
- `signal_generated` - New trading signals
- `ai_decision` - AI decision updates
- `regime_change` - Market regime changes

## Environment Variables

Create a `.env` file in the trading-dashboard directory:

```env
VITE_API_URL=http://localhost:8000/api
VITE_WS_URL=ws://localhost:8000/ws
```

## Development

The API server runs with auto-reload enabled, so changes to the code will automatically restart the server.

For debugging, you can access the interactive API documentation at http://localhost:8000/docs
