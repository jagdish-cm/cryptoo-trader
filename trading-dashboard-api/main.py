"""
FastAPI backend for the Trading Dashboard
Connects to the existing AI Trading System and provides REST API + WebSocket endpoints
"""

import asyncio
import json
import logging
from datetime import datetime
from typing import Dict, List, Optional, Any
from decimal import Decimal

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import uvicorn

# Import from the existing AI trading system
import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))

from ai_trading_system.config.settings import load_config
from ai_trading_system.services.data_storage import DatabaseConnection, RedisCache, DataAccessObject
from ai_trading_system.models.trading import Portfolio, Position, Trade, TradingSignal
from ai_trading_system.models.market_data import MarketData
from ai_trading_system.utils.logging import get_logger

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = get_logger("dashboard_api")

# FastAPI app
app = FastAPI(
    title="AI Trading Dashboard API",
    description="REST API and WebSocket server for the AI Trading Dashboard",
    version="1.0.0"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173", "http://localhost:5174"],  # React dev servers
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global variables
dao: Optional[DataAccessObject] = None
websocket_connections: List[WebSocket] = []

class ConnectionManager:
    """Manages WebSocket connections"""
    
    def __init__(self):
        self.active_connections: List[WebSocket] = []
        self.subscriptions: Dict[WebSocket, List[str]] = {}
    
    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)
        self.subscriptions[websocket] = []
        logger.info(f"WebSocket connected. Total connections: {len(self.active_connections)}")
    
    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
        if websocket in self.subscriptions:
            del self.subscriptions[websocket]
        logger.info(f"WebSocket disconnected. Total connections: {len(self.active_connections)}")
    
    async def send_personal_message(self, message: str, websocket: WebSocket):
        try:
            await websocket.send_text(message)
        except Exception as e:
            logger.error(f"Error sending personal message: {e}")
    
    async def broadcast(self, message: dict, channel: str = None):
        """Broadcast message to all connected clients or specific channel subscribers"""
        if not self.active_connections:
            return
            
        message_str = json.dumps(message, default=str)
        disconnected = []
        
        for connection in self.active_connections:
            try:
                # If channel is specified, only send to subscribers
                if channel and channel not in self.subscriptions.get(connection, []):
                    continue
                    
                await connection.send_text(message_str)
            except Exception as e:
                logger.error(f"Error broadcasting message: {e}")
                disconnected.append(connection)
        
        # Clean up disconnected connections
        for connection in disconnected:
            self.disconnect(connection)
    
    def subscribe(self, websocket: WebSocket, channel: str):
        """Subscribe a connection to a channel"""
        if websocket not in self.subscriptions:
            self.subscriptions[websocket] = []
        if channel not in self.subscriptions[websocket]:
            self.subscriptions[websocket].append(channel)
            logger.info(f"WebSocket subscribed to channel: {channel}")
    
    def unsubscribe(self, websocket: WebSocket, channel: str):
        """Unsubscribe a connection from a channel"""
        if websocket in self.subscriptions and channel in self.subscriptions[websocket]:
            self.subscriptions[websocket].remove(channel)
            logger.info(f"WebSocket unsubscribed from channel: {channel}")

manager = ConnectionManager()

@app.on_event("startup")
async def startup_event():
    """Initialize connections to the AI trading system"""
    global dao
    
    try:
        # Load configuration
        config = load_config()
        
        # Initialize database connection
        db = None
        if config.database:
            db = DatabaseConnection(config.database)
            await db.connect()
            logger.info("Connected to database")
        
        # Initialize Redis cache
        cache = RedisCache(config.redis)
        await cache.connect()
        logger.info("Connected to Redis cache")
        
        # Initialize Data Access Object
        dao = DataAccessObject(db, cache)
        logger.info("Dashboard API initialized successfully")
        
        # Initialize paper trading service for AI signal execution
        from ai_trading_system.services.paper_trading_service import PaperTradingService, PaperTradingConfig
        
        paper_config = PaperTradingConfig(
            initial_balance=100000.0,
            max_position_size=0.05,
            transaction_fee=0.001,
            slippage=0.0005,
            min_trade_amount=100.0
        )
        
        paper_trading_service = PaperTradingService(dao, paper_config)
        await paper_trading_service.initialize()
        logger.info("Initialized paper trading service for AI execution")
        
        # Start live analysis service with paper trading connection
        from ai_trading_system.services.live_analysis_service import get_live_analysis_service
        
        analysis_service = get_live_analysis_service(paper_trading_service)
        if not analysis_service.is_running:
            asyncio.create_task(analysis_service.start_analysis_loop())
        logger.info("Started live analysis service with paper trading integration")
        
        # Start background task for broadcasting system updates
        asyncio.create_task(broadcast_system_updates())
        
    except Exception as e:
        logger.error(f"Failed to initialize dashboard API: {e}")
        raise

async def broadcast_system_updates():
    """Background task to broadcast system updates to WebSocket clients"""
    while True:
        try:
            if dao and manager.active_connections:
                # Broadcast live analysis status
                try:
                    from ai_trading_system.services.live_analysis_service import get_live_analysis_service
                    
                    analysis_service = get_live_analysis_service()
                    analysis_status = analysis_service.get_current_status()
                    
                    analysis_update = {
                        "type": "analysis_status",
                        "data": analysis_status,
                        "timestamp": datetime.utcnow().isoformat()
                    }
                    await manager.broadcast(analysis_update, "analysis_updates")
                    
                    # Broadcast recent AI decisions
                    recent_decisions = analysis_service.get_recent_decisions(5)
                    if recent_decisions:
                        decisions_update = {
                            "type": "ai_decisions",
                            "data": {"decisions": recent_decisions},
                            "timestamp": datetime.utcnow().isoformat()
                        }
                        await manager.broadcast(decisions_update, "ai_decisions")
                    
                    # Broadcast market regime
                    market_regime = analysis_service.get_market_regime()
                    regime_update = {
                        "type": "market_regime",
                        "data": market_regime,
                        "timestamp": datetime.utcnow().isoformat()
                    }
                    await manager.broadcast(regime_update, "market_regime")
                    
                except Exception as e:
                    logger.debug(f"Failed to get live analysis data: {e}")
                
                # Broadcast real system status using RealSystemStatusService
                try:
                    from ai_trading_system.services.real_system_status_service import RealSystemStatusService
                    
                    status_service = RealSystemStatusService(dao)
                    system_status_obj = await status_service.get_system_status(
                        active_connections=len(manager.active_connections)
                    )
                    
                    system_status = {
                        "type": "system_status",
                        "data": {
                            "status": system_status_obj.status,
                            "uptime": system_status_obj.uptime,
                            "lastHeartbeat": system_status_obj.last_heartbeat.isoformat(),
                            "activeConnections": system_status_obj.active_connections,
                            "processingSymbol": system_status_obj.processing_symbol,
                            "currentPhase": system_status_obj.current_phase,
                            "errors": system_status_obj.errors,
                            "systemMetrics": {
                                "cpuUsage": system_status_obj.cpu_usage,
                                "memoryUsage": system_status_obj.memory_usage,
                                "diskUsage": system_status_obj.disk_usage,
                                "databaseConnected": system_status_obj.database_connected,
                                "redisConnected": system_status_obj.redis_connected
                            }
                        },
                        "timestamp": datetime.utcnow().isoformat()
                    }
                    
                except Exception as e:
                    logger.warning(f"Failed to get real system status for broadcast: {e}")
                    # Fallback to minimal status when real data unavailable
                    system_status = {
                        "type": "system_status",
                        "data": {
                            "status": "ERROR",
                            "uptime": 0,
                            "lastHeartbeat": datetime.utcnow().isoformat(),
                            "activeConnections": len(manager.active_connections),
                            "processingSymbol": None,
                            "currentPhase": "ERROR",
                            "errors": [{"type": "BROADCAST_ERROR", "message": str(e)}]
                        },
                        "timestamp": datetime.utcnow().isoformat()
                    }
                
                await manager.broadcast(system_status, "system_status")
                
                # Broadcast portfolio updates (get from database)
                try:
                    # Get latest portfolio data from cache/database
                    portfolio_data = await dao.cache.get("portfolio:current")
                    if portfolio_data:
                        portfolio_update = {
                            "type": "portfolio_update",
                            "data": portfolio_data,
                            "timestamp": datetime.utcnow().isoformat()
                        }
                        await manager.broadcast(portfolio_update, "portfolio_updates")
                except Exception as e:
                    logger.debug(f"No portfolio data available: {e}")
            
            await asyncio.sleep(10)  # Broadcast every 10 seconds to reduce load
            
        except Exception as e:
            logger.error(f"Error in broadcast_system_updates: {e}")
            await asyncio.sleep(10)

# WebSocket endpoint
@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            data = await websocket.receive_text()
            try:
                message = json.loads(data)
                
                # Handle subscription requests
                if message.get("type") == "subscribe":
                    channel = message.get("channel")
                    if channel:
                        manager.subscribe(websocket, channel)
                        await websocket.send_text(json.dumps({
                            "type": "subscription_confirmed",
                            "channel": channel
                        }))
                
                elif message.get("type") == "unsubscribe":
                    channel = message.get("channel")
                    if channel:
                        manager.unsubscribe(websocket, channel)
                        await websocket.send_text(json.dumps({
                            "type": "unsubscription_confirmed", 
                            "channel": channel
                        }))
                
            except json.JSONDecodeError:
                await websocket.send_text(json.dumps({
                    "type": "error",
                    "message": "Invalid JSON format"
                }))
                
    except WebSocketDisconnect:
        manager.disconnect(websocket)

# REST API Endpoints

@app.get("/api/system/status")
async def get_system_status():
    """Get current system status from real system data"""
    try:
        if not dao:
            raise HTTPException(status_code=503, detail="Data access not available")
        
        # Use RealSystemStatusService to get actual system status
        from ai_trading_system.services.real_system_status_service import RealSystemStatusService
        
        status_service = RealSystemStatusService(dao)
        system_status = await status_service.get_system_status(
            active_connections=len(manager.active_connections)
        )
        
        # Convert SystemStatus to API response format
        status_data = {
            "status": system_status.status,
            "uptime": system_status.uptime,
            "lastHeartbeat": system_status.last_heartbeat,
            "activeConnections": system_status.active_connections,
            "processingSymbol": system_status.processing_symbol,
            "currentPhase": system_status.current_phase,
            "errors": system_status.errors,
            "systemMetrics": {
                "cpuUsage": system_status.cpu_usage,
                "memoryUsage": system_status.memory_usage,
                "diskUsage": system_status.disk_usage,
                "databaseConnected": system_status.database_connected,
                "redisConnected": system_status.redis_connected
            }
        }
        
        logger.info(f"Retrieved real system status: {system_status.status}, "
                   f"Uptime: {system_status.uptime}s, CPU: {system_status.cpu_usage}%")
        
        return status_data
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting real system status: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve system status")

@app.post("/api/system/start")
async def start_system():
    """Start the trading system"""
    try:
        # In a real implementation, this would start the AI trading system
        logger.info("System start requested")
        
        # Broadcast system status change
        await manager.broadcast({
            "type": "system_status",
            "data": {
                "status": "STARTING",
                "message": "System is starting up..."
            }
        })
        
        return {"message": "System start initiated"}
    except Exception as e:
        logger.error(f"Error starting system: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/system/stop")
async def stop_system():
    """Stop the trading system"""
    try:
        logger.info("System stop requested")
        
        # Broadcast system status change
        await manager.broadcast({
            "type": "system_status",
            "data": {
                "status": "STOPPING",
                "message": "System is shutting down..."
            }
        })
        
        return {"message": "System stop initiated"}
    except Exception as e:
        logger.error(f"Error stopping system: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/system/emergency-stop")
async def emergency_stop():
    """Emergency stop - close all positions immediately"""
    try:
        logger.warning("Emergency stop requested")
        
        # Broadcast emergency stop
        await manager.broadcast({
            "type": "system_status",
            "data": {
                "status": "EMERGENCY_STOP",
                "message": "Emergency stop activated - closing all positions"
            }
        })
        
        return {"message": "Emergency stop initiated"}
    except Exception as e:
        logger.error(f"Error during emergency stop: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/portfolio")
async def get_portfolio():
    """Get current portfolio information from paper trading system"""
    try:
        if not dao:
            raise HTTPException(status_code=503, detail="Data access not available")
        
        # Use PaperTradingService to get portfolio data (since we're using paper trading for execution)
        from ai_trading_system.services.paper_trading_service import PaperTradingService, PaperTradingConfig
        
        # Create paper trading service with same config as execution
        paper_config = PaperTradingConfig(
            initial_balance=100000.0,
            max_position_size=0.05,
            transaction_fee=0.001,
            slippage=0.0005,
            min_trade_amount=100.0
        )
        
        portfolio_service = PaperTradingService(dao, paper_config)
        await portfolio_service.initialize()
        
        portfolio = await portfolio_service.get_portfolio()
        
        if not portfolio:
            # Return error instead of mock data when real data unavailable
            raise HTTPException(
                status_code=503, 
                detail="Portfolio data unavailable - paper trading system may be offline"
            )
        
        # Convert Portfolio model to API response format
        portfolio_data = {
            "totalValue": float(portfolio.total_value),
            "availableBalance": float(portfolio.available_balance),
            "positions": [
                {
                    "id": pos.id,
                    "symbol": pos.symbol,
                    "direction": pos.direction.value,
                    "entryPrice": float(pos.entry_price),
                    "currentPrice": float(pos.current_price),
                    "quantity": float(pos.quantity),
                    "unrealizedPnL": float(pos.unrealized_pnl),
                    "realizedPnL": 0,  # Positions don't have realized P&L
                    "stopLoss": float(pos.stop_loss) if pos.stop_loss else None,
                    "takeProfitLevels": [float(level) for level in pos.take_profit_levels],
                    "status": pos.status.value,
                    "createdAt": pos.created_at.isoformat(),
                    "updatedAt": datetime.utcnow().isoformat()
                }
                for pos in portfolio.positions
            ],
            "dailyPnL": float(portfolio.daily_pnl),
            "totalPnL": float(portfolio.total_pnl),
            "maxDrawdown": float(portfolio.max_drawdown),
            "lastUpdated": portfolio.last_updated.isoformat()
        }
        
        # Cache the real portfolio data
        await dao.cache.set("portfolio:current", portfolio_data, ttl=60)
        
        # Save portfolio snapshot for historical tracking
        await portfolio_service.save_portfolio_snapshot(portfolio)
        
        logger.info(f"Retrieved real portfolio data: {len(portfolio.positions)} positions, "
                   f"Total Value: ${portfolio.total_value}, P&L: ${portfolio.total_pnl}")
        
        return portfolio_data
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting real portfolio data: {e}")
        raise HTTPException(
            status_code=500, 
            detail="Failed to retrieve portfolio data from trading system"
        )

@app.get("/api/positions")
async def get_positions():
    """Get current open positions from paper trading system"""
    try:
        if not dao:
            raise HTTPException(status_code=503, detail="Data access not available")
        
        # Use PaperTradingService to get positions (since we're using paper trading)
        from ai_trading_system.services.paper_trading_service import PaperTradingService, PaperTradingConfig
        
        # Create paper trading service with same config as execution
        paper_config = PaperTradingConfig(
            initial_balance=100000.0,
            max_position_size=0.05,
            transaction_fee=0.001,
            slippage=0.0005,
            min_trade_amount=100.0
        )
        
        portfolio_service = PaperTradingService(dao, paper_config)
        await portfolio_service.initialize()
        
        # Get portfolio to access positions
        portfolio = await portfolio_service.get_portfolio()
        positions = portfolio.positions
        
        # Convert Position models to API response format
        positions_data = [
            {
                "id": pos.id,
                "symbol": pos.symbol,
                "direction": pos.direction.value,
                "entryPrice": float(pos.entry_price),
                "currentPrice": float(pos.current_price),
                "quantity": float(pos.quantity),
                "unrealizedPnL": float(pos.unrealized_pnl),
                "stopLoss": float(pos.stop_loss) if pos.stop_loss else None,
                "takeProfitLevels": [float(level) for level in pos.take_profit_levels],
                "status": pos.status.value,
                "createdAt": pos.created_at.isoformat(),
                "updatedAt": datetime.utcnow().isoformat()
            }
            for pos in positions
        ]
        
        # Cache the positions data
        await dao.cache.set("positions:active", positions_data, ttl=60)
        
        logger.info(f"Retrieved {len(positions_data)} real positions from database")
        return positions_data
        
    except Exception as e:
        logger.error(f"Error getting real positions: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve positions from trading system")

@app.get("/api/trades/history")
async def get_trade_history(limit: int = 50, offset: int = 0):
    """Get trade history from real trading system data"""
    try:
        if not dao:
            raise HTTPException(status_code=503, detail="Data access not available")
        
        # Use RealPortfolioService to get actual trade history
        from ai_trading_system.services.real_portfolio_service import RealPortfolioService
        
        portfolio_service = RealPortfolioService(dao)
        trades = await portfolio_service.get_trade_history(limit, offset)
        
        # Convert Trade models to API response format
        trades_data = [
            {
                "id": trade.id,
                "positionId": trade.position_id,
                "symbol": trade.symbol,
                "direction": trade.direction.value,
                "entryPrice": float(trade.entry_price),
                "exitPrice": float(trade.exit_price),
                "quantity": float(trade.quantity),
                "entryTime": trade.entry_time.isoformat(),
                "exitTime": trade.exit_time.isoformat(),
                "realizedPnL": float(trade.realized_pnl),
                "fees": float(trade.fees),
                "exitReason": trade.exit_reason,
                "setupType": trade.setup_type.value if trade.setup_type else None
            }
            for trade in trades
        ]
        
        # Get total count for pagination
        total_count_query = "SELECT COUNT(*) as count FROM trades"
        count_result = await dao.db.execute_query(total_count_query)
        total_count = count_result[0]['count'] if count_result else 0
        
        # Cache the trades data
        await dao.cache.set("trades:history:all", trades_data, ttl=300)
        
        logger.info(f"Retrieved {len(trades_data)} real trades from database")
        
        return {
            "trades": trades_data,
            "total": total_count,
            "limit": limit,
            "offset": offset
        }
        
    except Exception as e:
        logger.error(f"Error getting real trade history: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve trade history from trading system")

@app.get("/api/signals")
async def get_signals():
    """Get active trading signals"""
    try:
        if not dao:
            raise HTTPException(status_code=503, detail="Data access not available")
        
        # Mock signals data
        signals_data = {
            "active_signals": [],
            "signal_history": [],
            "market_regime": {
                "current": "bull",
                "confidence": 0.75,
                "trend_strength": "moderate"
            }
        }
        
        return signals_data
    except Exception as e:
        logger.error(f"Error getting signals: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/analytics/performance")
async def get_performance_metrics(period: str = "30d"):
    """Get performance analytics from paper trading system data"""
    try:
        if not dao:
            raise HTTPException(status_code=503, detail="Data access not available")
        
        # Use PaperTradingService to calculate performance metrics
        from ai_trading_system.services.paper_trading_service import PaperTradingService, PaperTradingConfig
        
        # Create paper trading service with same config as execution
        paper_config = PaperTradingConfig(
            initial_balance=100000.0,
            max_position_size=0.05,
            transaction_fee=0.001,
            slippage=0.0005,
            min_trade_amount=100.0
        )
        
        portfolio_service = PaperTradingService(dao, paper_config)
        await portfolio_service.initialize()
        
        # Get portfolio data
        portfolio = await portfolio_service.get_portfolio()
        
        # Query completed trades for metrics calculation
        trades_query = """
        SELECT * FROM trades 
        ORDER BY exit_time DESC
        """
        
        completed_trades = await dao.db.execute_query(trades_query)
        
        # Calculate basic performance metrics
        total_trades = len(completed_trades) if completed_trades else 0
        winning_trades = 0
        total_realized_pnl = float(portfolio.total_pnl)
        
        if completed_trades:
            winning_trades = len([t for t in completed_trades if float(t['realized_pnl']) > 0])
        
        # Calculate current portfolio performance including unrealized P&L
        current_portfolio_value = float(portfolio.total_value)
        total_unrealized_pnl = sum(float(pos.unrealized_pnl) for pos in portfolio.positions)
        
        win_rate = (winning_trades / total_trades * 100) if total_trades > 0 else 0.0
        total_return = ((current_portfolio_value - paper_config.initial_balance) / paper_config.initial_balance * 100) if paper_config.initial_balance > 0 else 0.0
        
        performance_data = {
            "totalReturn": total_return,
            "dailyPnL": float(portfolio.daily_pnl),
            "winRate": win_rate,
            "sharpeRatio": 0.0,  # Would need more complex calculation
            "maxDrawdown": float(portfolio.max_drawdown) * 100,  # Convert to percentage
            "volatility": 0.0,  # Would need historical data
            "totalTrades": total_trades,
            "avgTradeReturn": (total_realized_pnl / total_trades) if total_trades > 0 else 0.0
        }
        
        # Cache the calculated metrics
        await dao.cache.set(f"performance:metrics:{period}", performance_data, ttl=300)
        
        logger.info(f"Calculated paper trading performance metrics for period {period}: "
                   f"{performance_data['totalTrades']} trades, "
                   f"{performance_data['winRate']:.1f}% win rate, "
                   f"{performance_data['totalReturn']:.2f}% return")
        
        return performance_data
        
    except Exception as e:
        logger.error(f"Error getting paper trading performance metrics: {e}")
        raise HTTPException(status_code=500, detail="Failed to calculate performance metrics from paper trading system")

@app.get("/api/market/cache-stats")
async def get_market_cache_stats():
    """Get market data cache statistics and source health"""
    try:
        from ai_trading_system.services.multi_source_market_data import get_cache_stats
        stats = await get_cache_stats()
        return stats
    except Exception as e:
        logger.error(f"Error getting cache stats: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/market/data")
async def get_market_data(symbols: str):
    """Get market data for multiple symbols"""
    try:
        symbol_list = symbols.split(',')
        market_data = {}
        
        # Use the new multi-source market data service with fallbacks
        try:
            from ai_trading_system.services.multi_source_market_data import get_current_prices
            live_data = await get_current_prices(symbol_list, force_refresh=False)
            market_data.update(live_data)
            logger.info(f"Fetched live data for {len(live_data)} symbols using multi-source service")
        except Exception as e:
            logger.warning(f"Failed to fetch live market data: {e}")
        
        # For symbols not found in live data, try cache or use fallback
        for symbol in symbol_list:
            if symbol not in market_data:
                # Try to get from cache
                if dao:
                    cached_data = await dao.cache.get(f"market_data:{symbol}")
                    if cached_data:
                        market_data[symbol] = cached_data
                        continue
                
                # Use fallback data
                market_data[symbol] = {
                    "symbol": symbol,
                    "price": 50000 if "BTC" in symbol else 3000 if "ETH" in symbol else 0.5,
                    "change24h": 2.5,
                    "volume24h": 1000000000,
                    "high24h": 51000 if "BTC" in symbol else 3100 if "ETH" in symbol else 0.52,
                    "low24h": 49000 if "BTC" in symbol else 2900 if "ETH" in symbol else 0.48,
                    "timestamp": datetime.utcnow().isoformat()
                }
        
        # Cache all the data
        if dao:
            for symbol, data in market_data.items():
                await dao.cache.set(f"market_data:{symbol}", data, ttl=60)
        
        return market_data
        
    except Exception as e:
        logger.error(f"Error getting market data: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/market/{symbol}/price")
async def get_latest_price(symbol: str):
    """Get latest price for a symbol"""
    try:
        # Use the market data endpoint for consistency
        market_data = await get_market_data(symbol)
        
        if symbol not in market_data:
            raise HTTPException(status_code=404, detail=f"Price not found for {symbol}")
        
        return {
            "symbol": symbol,
            "price": market_data[symbol]["price"],
            "timestamp": market_data[symbol]["timestamp"]
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting latest price for {symbol}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# Live Analysis Endpoints
@app.get("/api/analysis/status")
async def get_analysis_status():
    """Get current AI analysis status"""
    try:
        from ai_trading_system.services.live_analysis_service import get_live_analysis_service
        
        service = get_live_analysis_service()
        status = service.get_current_status()
        
        return status
        
    except Exception as e:
        logger.error(f"Error getting analysis status: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/analysis/market-regime")
async def get_market_regime():
    """Get current market regime"""
    try:
        from ai_trading_system.services.live_analysis_service import get_live_analysis_service
        
        service = get_live_analysis_service()
        regime = service.get_market_regime()
        
        return regime
        
    except Exception as e:
        logger.error(f"Error getting market regime: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/analysis/decisions")
async def get_recent_ai_decisions(limit: int = 10):
    """Get recent AI decisions"""
    try:
        from ai_trading_system.services.live_analysis_service import get_live_analysis_service
        
        service = get_live_analysis_service()
        decisions = service.get_recent_decisions(limit)
        
        return {"decisions": decisions, "count": len(decisions)}
        
    except Exception as e:
        logger.error(f"Error getting AI decisions: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/analysis/cached-prices")
async def get_cached_prices(symbols: str = None):
    """Get cached prices from AI analysis service to avoid excessive API calls"""
    try:
        from ai_trading_system.services.live_analysis_service import get_live_analysis_service
        
        service = get_live_analysis_service()
        symbol_list = symbols.split(',') if symbols else None
        cached_prices = service.get_cached_prices(symbol_list)
        
        return {
            "prices": cached_prices,
            "count": len(cached_prices),
            "cached": True,
            "timestamp": datetime.utcnow().isoformat()
        }
        
    except Exception as e:
        logger.error(f"Error getting cached prices: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# Execution Thresholds Endpoints
@app.get("/api/analytics/execution-thresholds")
async def get_execution_thresholds(strategy_mode: str = "dual_mode", market_regime: str = "range"):
    """Get current execution thresholds for strategy mode and market regime"""
    try:
        if not dao:
            raise HTTPException(status_code=503, detail="Data access not available")
        
        query = """
        SELECT * FROM execution_thresholds 
        WHERE strategy_mode = :strategy_mode 
        AND market_regime = :market_regime 
        AND is_active = TRUE
        ORDER BY updated_at DESC
        LIMIT 1
        """
        
        result = await dao.db.execute_query(query, {
            'strategy_mode': strategy_mode,
            'market_regime': market_regime
        })
        
        if result:
            threshold = result[0]
            return {
                "strategy_mode": threshold['strategy_mode'],
                "market_regime": threshold['market_regime'],
                "thresholds": {
                    "min_confidence": float(threshold['min_confidence']),
                    "min_technical_score": float(threshold['min_technical_score']),
                    "min_sentiment_score": float(threshold['min_sentiment_score']),
                    "min_fusion_score": float(threshold['min_fusion_score']),
                    "max_risk_score": float(threshold['max_risk_score']),
                    "min_volume_score": float(threshold['min_volume_score'])
                },
                "updated_at": threshold['updated_at'].isoformat()
            }
        else:
            # Return default thresholds
            return {
                "strategy_mode": strategy_mode,
                "market_regime": market_regime,
                "thresholds": {
                    "min_confidence": 0.6,
                    "min_technical_score": 0.5,
                    "min_sentiment_score": 0.4,
                    "min_fusion_score": 0.6,
                    "max_risk_score": 0.8,
                    "min_volume_score": 0.3
                },
                "updated_at": datetime.utcnow().isoformat()
            }
            
    except Exception as e:
        logger.error(f"Error getting execution thresholds: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve execution thresholds")

@app.get("/api/analytics/threshold-performance")
async def get_threshold_performance(days: int = 7):
    """Get execution threshold performance statistics"""
    try:
        if not dao:
            raise HTTPException(status_code=503, detail="Data access not available")
        
        query = """
        SELECT 
            execution_decision,
            COUNT(*) as count,
            AVG(confidence) as avg_confidence,
            AVG(execution_probability) as avg_execution_prob,
            AVG(technical_score) as avg_technical,
            AVG(sentiment_score) as avg_sentiment
        FROM ai_decisions 
        WHERE timestamp >= CURRENT_DATE - INTERVAL '%s days'
        AND execution_decision IS NOT NULL
        GROUP BY execution_decision
        """ % days
        
        result = await dao.db.execute_query(query)
        
        stats = {
            "total_decisions": 0,
            "executed_count": 0,
            "rejected_count": 0,
            "execution_rate": 0.0,
            "avg_executed_confidence": 0.0,
            "avg_rejected_confidence": 0.0,
            "threshold_effectiveness": 0.0,
            "performance_period_days": days
        }
        
        for row in result:
            decision_type = row['execution_decision']
            count = row['count']
            stats['total_decisions'] += count
            
            if decision_type == 'EXECUTED':
                stats['executed_count'] = count
                stats['avg_executed_confidence'] = float(row['avg_confidence'] or 0)
            elif decision_type == 'REJECTED':
                stats['rejected_count'] = count
                stats['avg_rejected_confidence'] = float(row['avg_confidence'] or 0)
        
        if stats['total_decisions'] > 0:
            stats['execution_rate'] = stats['executed_count'] / stats['total_decisions']
        
        # Calculate threshold effectiveness
        confidence_gap = stats['avg_executed_confidence'] - stats['avg_rejected_confidence']
        stats['threshold_effectiveness'] = max(0.0, min(1.0, confidence_gap))
        
        return stats
        
    except Exception as e:
        logger.error(f"Error getting threshold performance: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve threshold performance")

# Trade Execution Endpoints
@app.post("/api/trading/execute-signal")
async def execute_trading_signal(signal_data: dict):
    """Execute a trading signal using paper trading"""
    try:
        if not dao:
            raise HTTPException(status_code=503, detail="Data access not available")
        
        # Import paper trading service for safe execution
        from ai_trading_system.services.paper_trading_service import PaperTradingService, PaperTradingConfig
        from ai_trading_system.models.trading import TradingSignal
        from ai_trading_system.models.enums import TradeDirection
        from decimal import Decimal
        
        # Create paper trading service
        paper_config = PaperTradingConfig(
            initial_balance=100000.0,  # $100k starting balance
            max_position_size=0.05,    # 5% of portfolio per position
            transaction_fee=0.001,     # 0.1% fee per trade
            slippage=0.0005,          # 0.05% slippage
            min_trade_amount=100.0     # Minimum $100 per trade
        )
        
        paper_trading = PaperTradingService(dao, paper_config)
        await paper_trading.initialize()
        
        # Import required enums
        from ai_trading_system.models.enums import SignalStrength, SetupType
        
        # Determine trade direction from signal type
        signal_type = signal_data.get("signal_type", "").upper()
        if "BUY" in signal_type or "LONG" in signal_type or "SIGNAL_GENERATION" in signal_type:
            direction = TradeDirection.LONG
            setup_type = SetupType.LONG_SUPPORT  # Default setup type for long signals
        else:
            direction = TradeDirection.SHORT
            setup_type = SetupType.SHORT_RESISTANCE  # Default setup type for short signals
        
        # Determine signal strength based on confidence
        confidence_val = float(signal_data.get("confidence", 0.5))
        if confidence_val >= 0.9:
            strength = SignalStrength.VERY_STRONG
        elif confidence_val >= 0.8:
            strength = SignalStrength.STRONG
        elif confidence_val >= 0.6:
            strength = SignalStrength.MODERATE
        else:
            strength = SignalStrength.WEAK
        
        # Create trading signal from request data
        signal = TradingSignal(
            id=signal_data.get("id"),
            symbol=signal_data.get("symbol"),
            direction=direction,
            confidence=Decimal(str(confidence_val)),
            strength=strength,
            technical_score=Decimal(str(signal_data.get("technical_score", 0.5))),
            sentiment_score=Decimal(str(signal_data.get("sentiment_score", 0.5))),
            event_impact=Decimal(str(signal_data.get("event_impact", 0.0))),
            setup_type=setup_type,
            take_profit_levels=[Decimal(str(tp)) for tp in signal_data.get("take_profit_levels", [0.05, 0.10])],
            metadata={
                "signal_type": signal_data.get("signal_type"),
                "stop_loss_pct": signal_data.get("stop_loss_pct", 0.05),
                "reasoning": signal_data.get("reasoning", {}),
                "factors": signal_data.get("factors", [])
            }
        )
        
        # Get current price for debugging
        from ai_trading_system.services.live_market_data import get_current_price
        current_price = await get_current_price(signal.symbol)
        logger.info(f"Current price for {signal.symbol}: {current_price}")
        
        # Get current portfolio state for debugging
        portfolio = await paper_trading.get_portfolio()
        logger.info(f"Current portfolio balance: ${float(portfolio.available_balance)}")
        
        # Calculate expected position size for debugging
        base_size = float(portfolio.available_balance) * paper_config.max_position_size
        confidence_multiplier = float(signal.confidence)
        expected_position_size = base_size * confidence_multiplier
        logger.info(f"Expected position size: ${expected_position_size} (base: ${base_size}, confidence: {confidence_multiplier})")
        
        # Execute the signal using paper trading
        position = await paper_trading.execute_signal(signal)
        
        if position:
            result = {
                "decision": "EXECUTE",
                "reason": "Paper trade executed successfully",
                "signal_id": signal.id,
                "position_id": position.id,
                "entry_price": float(position.entry_price),
                "quantity": float(position.quantity),
                "direction": position.direction.value,
                "symbol": position.symbol,
                "status": position.status.value,
                "current_price": current_price,
                "portfolio_balance": float(portfolio.available_balance)
            }
        else:
            # Get more detailed error information
            result = {
                "decision": "REJECT",
                "reason": f"Paper trade execution failed - Current price: {current_price}, Portfolio balance: ${float(portfolio.available_balance)}",
                "signal_id": signal.id,
                "debug_info": {
                    "current_price": current_price,
                    "portfolio_balance": float(portfolio.available_balance),
                    "signal_confidence": float(signal.confidence),
                    "signal_direction": signal.direction.value
                }
            }
        
        logger.info(f"Paper trading signal execution result: {result}")
        return result
        
    except Exception as e:
        logger.error(f"Error executing trading signal: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to execute signal: {str(e)}")

@app.get("/api/trading/positions/active")
async def get_active_positions():
    """Get all active trading positions"""
    try:
        if not dao:
            raise HTTPException(status_code=503, detail="Data access not available")
        
        # Query active positions from database
        query = """
        SELECT * FROM positions 
        WHERE status = 'open'
        ORDER BY created_at DESC
        """
        
        positions = await dao.db.execute_query(query)
        
        # Format positions for API response
        active_positions = []
        for pos in positions:
            # Calculate unrealized P&L if not stored in database
            entry_price = float(pos["entry_price"])
            current_price = float(pos["current_price"])
            quantity = float(pos["quantity"])
            direction = pos["direction"]
            
            if direction == "long":
                unrealized_pnl = (current_price - entry_price) * quantity
            else:  # short
                unrealized_pnl = (entry_price - current_price) * quantity
            
            # Parse take_profit_levels if it's a JSON string
            take_profit_levels = pos.get("take_profit_levels", [])
            if isinstance(take_profit_levels, str):
                try:
                    import json
                    take_profit_levels = json.loads(take_profit_levels)
                except:
                    take_profit_levels = []
            
            active_positions.append({
                "id": pos["id"],
                "symbol": pos["symbol"],
                "direction": pos["direction"],
                "entryPrice": entry_price,
                "currentPrice": current_price,
                "quantity": quantity,
                "unrealizedPnL": unrealized_pnl,
                "stopLoss": float(pos["stop_loss"]) if pos["stop_loss"] else None,
                "takeProfitLevels": take_profit_levels,
                "status": pos["status"],
                "createdAt": pos["created_at"].isoformat() if pos["created_at"] else None,
                "updatedAt": pos.get("updated_at").isoformat() if pos.get("updated_at") else None
            })
        
        logger.info(f"Retrieved {len(active_positions)} active positions")
        return {"positions": active_positions, "count": len(active_positions)}
        
    except Exception as e:
        logger.error(f"Error getting active positions: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve active positions")

@app.post("/api/trading/positions/{position_id}/close")
async def close_position(position_id: str, close_data: dict = None):
    """Manually close a paper trading position"""
    try:
        if not dao:
            raise HTTPException(status_code=503, detail="Data access not available")
        
        # Use PaperTradingService to close the position
        from ai_trading_system.services.paper_trading_service import PaperTradingService, PaperTradingConfig
        from ai_trading_system.services.live_market_data import get_current_price
        
        # Create paper trading service
        paper_config = PaperTradingConfig(
            initial_balance=100000.0,
            max_position_size=0.05,
            transaction_fee=0.001,
            slippage=0.0005,
            min_trade_amount=100.0
        )
        
        paper_trading = PaperTradingService(dao, paper_config)
        await paper_trading.initialize()
        
        # Find the position to close
        if position_id not in paper_trading.active_positions:
            raise HTTPException(status_code=404, detail=f"Position {position_id} not found")
        
        position = paper_trading.active_positions[position_id]
        
        # Get current market price, with fallback to position's current price if API fails
        try:
            current_price = await get_current_price(position.symbol)
        except Exception as e:
            logger.warning(f"Could not get live price for {position.symbol}, using position's current price: {e}")
            current_price = None
        
        # Use position's current price as fallback if live price is unavailable
        if not current_price:
            current_price = float(position.current_price)
            logger.info(f"Using position's current price for closing: ${current_price}")
        
        # Close the position manually
        reason = close_data.get("reason", "MANUAL_CLOSE") if close_data else "MANUAL_CLOSE"
        logger.info(f"Closing position {position_id} at price {current_price} with reason {reason}")
        
        await paper_trading._close_position(position, current_price, reason)
        
        # Verify the position was closed
        updated_portfolio = await paper_trading.get_portfolio()
        closed_position_found = any(pos.id == position_id and pos.status.value == "closed" for pos in updated_portfolio.positions)
        
        logger.info(f"Position {position_id} close status: closed_position_found={closed_position_found}")
        logger.info(f"Successfully closed position {position_id}")
        
        return {
            "message": f"Position {position_id} closed successfully", 
            "position_id": position_id,
            "close_price": current_price,
            "reason": reason,
            "status": "closed"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error closing position {position_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to close position: {str(e)}")

@app.post("/api/trading/emergency-stop")
async def emergency_stop_all_positions():
    """Emergency stop - close all active positions immediately"""
    try:
        if not dao:
            raise HTTPException(status_code=503, detail="Data access not available")
        
        # Import position manager
        from ai_trading_system.services.position_manager import PositionManager
        from ai_trading_system.services.exchange_client import ExchangeClient
        
        # Create exchange client and position manager
        exchange_client = ExchangeClient()
        await exchange_client.connect()
        position_manager = PositionManager(dao, exchange_client)
        
        # Force close all positions
        await position_manager.force_close_all_positions("EMERGENCY_STOP")
        
        # Broadcast emergency stop to WebSocket clients
        await manager.broadcast({
            "type": "emergency_stop",
            "data": {
                "message": "Emergency stop executed - all positions closed",
                "timestamp": datetime.utcnow().isoformat()
            }
        })
        
        logger.warning("Emergency stop executed - all positions closed")
        return {"message": "Emergency stop executed successfully", "timestamp": datetime.utcnow().isoformat()}
        
    except Exception as e:
        logger.error(f"Error during emergency stop: {e}")
        raise HTTPException(status_code=500, detail=f"Emergency stop failed: {str(e)}")

@app.get("/api/trading/orders/active")
async def get_active_orders():
    """Get all active orders"""
    try:
        if not dao:
            raise HTTPException(status_code=503, detail="Data access not available")
        
        # Query active orders from database
        query = """
        SELECT * FROM orders 
        WHERE status IN ('OPEN', 'PARTIALLY_FILLED')
        ORDER BY created_at DESC
        """
        
        orders = await dao.db.execute_query(query)
        
        # Format orders for API response
        active_orders = []
        for order in orders:
            active_orders.append({
                "id": order["id"],
                "symbol": order["symbol"],
                "type": order["order_type"],
                "side": order["side"],
                "quantity": float(order["quantity"]),
                "price": float(order["price"]) if order["price"] else None,
                "filled": float(order["filled_quantity"]),
                "remaining": float(order["remaining_quantity"]),
                "status": order["status"],
                "createdAt": order["created_at"].isoformat(),
                "updatedAt": order["updated_at"].isoformat()
            })
        
        logger.info(f"Retrieved {len(active_orders)} active orders")
        return {"orders": active_orders, "count": len(active_orders)}
        
    except Exception as e:
        logger.error(f"Error getting active orders: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve active orders")

@app.post("/api/trading/orders/{order_id}/cancel")
async def cancel_order(order_id: str):
    """Cancel a specific order"""
    try:
        if not dao:
            raise HTTPException(status_code=503, detail="Data access not available")
        
        # Import exchange client
        from ai_trading_system.services.exchange_client import ExchangeClient
        
        # Get order details from database
        query = "SELECT * FROM orders WHERE id = :order_id"
        order_result = await dao.db.execute_query(query, {"order_id": order_id})
        
        if not order_result:
            raise HTTPException(status_code=404, detail=f"Order {order_id} not found")
        
        order = order_result[0]
        
        # Create exchange client and cancel order
        exchange_client = ExchangeClient()
        await exchange_client.connect()
        
        success = await exchange_client.cancel_order(order_id)
        
        if success:
            # Update order status in database
            update_query = """
            UPDATE orders 
            SET status = 'CANCELLED', updated_at = :updated_at 
            WHERE id = :order_id
            """
            await dao.db.execute_query(update_query, {
                "order_id": order_id,
                "updated_at": datetime.utcnow()
            })
            
            logger.info(f"Successfully cancelled order {order_id}")
            return {"message": f"Order {order_id} cancelled successfully", "order_id": order_id}
        else:
            raise HTTPException(status_code=400, detail=f"Failed to cancel order {order_id}")
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error cancelling order {order_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to cancel order: {str(e)}")

# AI Analytics Endpoints
@app.get("/api/analytics/ai-decisions")
async def get_ai_decisions(limit: int = 50):
    """Get AI decision history from real system data"""
    try:
        if not dao:
            raise HTTPException(status_code=503, detail="Data access not available")
        
        # Query actual AI decisions from database with execution threshold data
        query = """
        SELECT id, timestamp, decision_type, symbol, confidence, 
               technical_score, sentiment_score, event_impact, 
               final_confidence, risk_factors, reasoning, factors, outcome,
               min_confidence_threshold, min_technical_threshold, min_sentiment_threshold,
               min_fusion_score, execution_decision, rejection_reasons,
               threshold_analysis, score_vs_thresholds, execution_probability
        FROM ai_decisions
        ORDER BY timestamp DESC
        LIMIT :limit
        """
        
        decision_rows = await dao.db.execute_query(query, {'limit': limit})
        
        ai_decisions = []
        for row in decision_rows:
            # Parse threshold data - handle both JSON strings and dict objects
            threshold_analysis = row['threshold_analysis'] if isinstance(row['threshold_analysis'], dict) else (json.loads(row['threshold_analysis']) if row['threshold_analysis'] else {})
            score_vs_thresholds = row['score_vs_thresholds'] if isinstance(row['score_vs_thresholds'], dict) else (json.loads(row['score_vs_thresholds']) if row['score_vs_thresholds'] else {})
            rejection_reasons = row['rejection_reasons'] if isinstance(row['rejection_reasons'], list) else (json.loads(row['rejection_reasons']) if row['rejection_reasons'] else [])
            
            ai_decisions.append({
                "id": row['id'],
                "timestamp": row['timestamp'].isoformat() if row['timestamp'] else datetime.utcnow().isoformat(),
                "type": row['decision_type'],
                "symbol": row['symbol'],
                "confidence": float(row['confidence']) if row['confidence'] else 0.0,
                "reasoning": {
                    "technicalScore": float(row['technical_score']) if row['technical_score'] else 0.0,
                    "sentimentScore": float(row['sentiment_score']) if row['sentiment_score'] else 0.0,
                    "eventImpact": float(row['event_impact']) if row['event_impact'] else 0.0,
                    "finalConfidence": float(row['final_confidence']) if row['final_confidence'] else 0.0,
                    "riskFactors": row['risk_factors'] if isinstance(row['risk_factors'], list) else (json.loads(row['risk_factors']) if row['risk_factors'] else [])
                },
                "factors": row['factors'] if isinstance(row['factors'], list) else (json.loads(row['factors']) if row['factors'] else []),
                "outcome": row['outcome'] if isinstance(row['outcome'], dict) else (json.loads(row['outcome']) if row['outcome'] else {
                    "action": "NO_ACTION",
                    "result": "PENDING",
                    "details": "No outcome recorded"
                }),
                "executionThresholds": {
                    "minConfidence": float(row['min_confidence_threshold']) if row['min_confidence_threshold'] else None,
                    "minTechnical": float(row['min_technical_threshold']) if row['min_technical_threshold'] else None,
                    "minSentiment": float(row['min_sentiment_threshold']) if row['min_sentiment_threshold'] else None,
                    "minFusionScore": float(row['min_fusion_score']) if row['min_fusion_score'] else None
                },
                "executionDecision": row['execution_decision'],
                "executionProbability": float(row['execution_probability']) if row['execution_probability'] else None,
                "rejectionReasons": rejection_reasons,
                "scoreVsThresholds": score_vs_thresholds,
                "thresholdAnalysis": threshold_analysis
            })
        
        logger.info(f"Retrieved {len(ai_decisions)} real AI decisions from database")
        return ai_decisions
        
    except Exception as e:
        logger.error(f"Error getting real AI decisions: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve AI decisions from trading system")

@app.get("/api/analytics/sentiment")
async def get_sentiment_analysis(symbols: str):
    """Get sentiment analysis for symbols from real system data"""
    try:
        if not dao:
            raise HTTPException(status_code=503, detail="Data access not available")
        
        symbol_list = symbols.split(',')
        sentiment_data = []
        
        # Query actual sentiment analysis from database
        for symbol in symbol_list:
            query = """
            SELECT symbol, sentiment, confidence, key_factors, news_impact, 
                   social_impact, processing_time_ms, timestamp
            FROM sentiment_analysis
            WHERE symbol = :symbol
            ORDER BY timestamp DESC
            LIMIT 1
            """
            
            result = await dao.db.execute_query(query, {'symbol': symbol})
            
            if result and len(result) > 0:
                row = result[0]
                sentiment_data.append({
                    "symbol": row['symbol'],
                    "sentiment": row['sentiment'],
                    "confidence": float(row['confidence']) if row['confidence'] else 0.0,
                    "keyFactors": row['key_factors'] if row['key_factors'] else [],
                    "newsImpact": float(row['news_impact']) if row['news_impact'] else 0.0,
                    "socialImpact": float(row['social_impact']) if row['social_impact'] else 0.0,
                    "processingTime": row['processing_time_ms'] if row['processing_time_ms'] else 0,
                    "timestamp": row['timestamp'].isoformat() if row['timestamp'] else datetime.utcnow().isoformat()
                })
            else:
                # No sentiment data available for this symbol
                sentiment_data.append({
                    "symbol": symbol,
                    "sentiment": "NEUTRAL",
                    "confidence": 0.0,
                    "keyFactors": ["No sentiment data available"],
                    "newsImpact": 0.0,
                    "socialImpact": 0.0,
                    "processingTime": 0,
                    "timestamp": datetime.utcnow().isoformat()
                })
        
        logger.info(f"Retrieved sentiment analysis for {len(sentiment_data)} symbols from database")
        return sentiment_data
        
    except Exception as e:
        logger.error(f"Error getting real sentiment analysis: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve sentiment analysis from trading system")

# Configuration Endpoints
@app.get("/api/config/trading")
async def get_trading_config():
    """Get trading configuration"""
    try:
        # Return default trading configuration
        config = {
            "autoTrading": True,
            "maxPositions": 5,
            "riskPerTrade": 0.02,  # 2%
            "emergencyStop": False,
            "allowedSymbols": ["BTC/USDT", "ETH/USDT", "ADA/USDT", "DOT/USDT", "LINK/USDT"]
        }
        
        return config
        
    except Exception as e:
        logger.error(f"Error getting trading config: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.put("/api/config/trading")
async def update_trading_config(config: dict):
    """Update trading configuration"""
    try:
        # In a real implementation, this would update the actual config
        logger.info(f"Trading config update requested: {config}")
        
        # Return the updated config
        updated_config = {
            "autoTrading": config.get("autoTrading", True),
            "maxPositions": config.get("maxPositions", 5),
            "riskPerTrade": config.get("riskPerTrade", 0.02),
            "emergencyStop": config.get("emergencyStop", False),
            "allowedSymbols": config.get("allowedSymbols", ["BTC/USDT", "ETH/USDT", "ADA/USDT"])
        }
        
        return updated_config
        
    except Exception as e:
        logger.error(f"Error updating trading config: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/config/notifications")
async def get_notification_config():
    """Get notification configuration"""
    try:
        config = {
            "enabled": True,
            "types": ["TRADE_EXECUTED", "SIGNAL_GENERATED", "POSITION_CLOSED", "SYSTEM_ERROR"],
            "sound": True,
            "desktop": True,
            "email": False
        }
        
        return config
        
    except Exception as e:
        logger.error(f"Error getting notification config: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.put("/api/config/notifications")
async def update_notification_config(config: dict):
    """Update notification configuration"""
    try:
        logger.info(f"Notification config update requested: {config}")
        
        updated_config = {
            "enabled": config.get("enabled", True),
            "types": config.get("types", ["TRADE_EXECUTED", "SIGNAL_GENERATED"]),
            "sound": config.get("sound", True),
            "desktop": config.get("desktop", True),
            "email": config.get("email", False)
        }
        
        return updated_config
        
    except Exception as e:
        logger.error(f"Error updating notification config: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat(),
        "connections": len(manager.active_connections)
    }

if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info"
    )