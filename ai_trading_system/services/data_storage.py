"""
Data storage and caching layer with Redis and PostgreSQL integration
"""

import asyncio
import json
import pickle
from typing import List, Optional, Dict, Any, Union
from datetime import datetime, timedelta
from decimal import Decimal
from dataclasses import dataclass
import redis.asyncio as redis
import asyncpg
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import text, select, insert, update, delete
from contextlib import asynccontextmanager

from ai_trading_system.models.market_data import MarketData, TechnicalIndicators
from ai_trading_system.models.trading import Trade, Position, Portfolio, TradingSignal
from ai_trading_system.config.settings import DatabaseConfig, RedisConfig
from ai_trading_system.utils.logging import get_logger
from ai_trading_system.utils.errors import SystemError, DataIngestionError


@dataclass
class CacheKey:
    """Cache key generator for consistent Redis keys"""
    
    @staticmethod
    def market_data(symbol: str, timeframe: str) -> str:
        return f"market_data:{symbol}:{timeframe}"
    
    @staticmethod
    def latest_price(symbol: str) -> str:
        return f"price:latest:{symbol}"
    
    @staticmethod
    def technical_indicators(symbol: str, timeframe: str) -> str:
        return f"indicators:{symbol}:{timeframe}"
    
    @staticmethod
    def trading_signal(symbol: str) -> str:
        return f"signal:{symbol}"
    
    @staticmethod
    def portfolio() -> str:
        return "portfolio:current"
    
    @staticmethod
    def position(position_id: str) -> str:
        return f"position:{position_id}"
    
    @staticmethod
    def active_positions() -> str:
        return "positions:active"
    
    @staticmethod
    def trade_history(symbol: str = None) -> str:
        if symbol:
            return f"trades:history:{symbol}"
        return "trades:history:all"


class RedisCache:
    """Redis caching client with TTL management"""
    
    def __init__(self, config: RedisConfig):
        self.config = config
        self.logger = get_logger("redis_cache")
        self.redis: Optional[redis.Redis] = None
        self._connected = False
    
    async def connect(self) -> None:
        """Connect to Redis"""
        try:
            connection_params = {
                'host': self.config.host,
                'port': self.config.port,
                'db': self.config.db,
                'decode_responses': False,  # We'll handle encoding ourselves
                'socket_connect_timeout': 10,
                'socket_timeout': 10,
                'retry_on_timeout': True,
                'health_check_interval': 30
            }
            
            if self.config.password:
                connection_params['password'] = self.config.password
            
            self.redis = redis.Redis(
                host=self.config.host,
                port=self.config.port,
                db=self.config.db,
                password=self.config.password,
                decode_responses=False,
                socket_connect_timeout=10,
                socket_timeout=10,
                retry_on_timeout=True,
                health_check_interval=30
            )
            
            # Test connection
            await self.redis.ping()
            self._connected = True
            
            self.logger.info("Connected to Redis", {
                "host": self.config.host,
                "port": self.config.port,
                "db": self.config.db
            })
            
        except Exception as e:
            self.logger.error("Failed to connect to Redis", {
                "host": self.config.host,
                "port": self.config.port,
                "error": str(e)
            })
            raise SystemError(
                "Redis connection failed",
                component="redis_cache",
                original_error=e
            )
    
    async def disconnect(self) -> None:
        """Disconnect from Redis"""
        if self.redis:
            await self.redis.close()
            self._connected = False
            self.logger.info("Disconnected from Redis")
    
    async def set(self, key: str, value: Any, ttl: Optional[int] = None) -> bool:
        """Set a value in cache with optional TTL"""
        if not self._connected:
            await self.connect()
        
        try:
            # Serialize value with proper datetime/decimal handling
            def json_serializer(obj):
                """Custom JSON serializer for datetime and Decimal objects"""
                if isinstance(obj, datetime):
                    return obj.isoformat()
                elif isinstance(obj, Decimal):
                    return float(obj)
                return str(obj)
            
            if isinstance(value, (dict, list)):
                serialized_value = json.dumps(value, default=json_serializer)
            elif hasattr(value, 'dict'):  # Pydantic model
                serialized_value = json.dumps(value.dict(), default=json_serializer)
            else:
                serialized_value = pickle.dumps(value)
            
            ttl = ttl or self.config.ttl
            result = await self.redis.setex(key, ttl, serialized_value)
            
            self.logger.debug("Cached value", {
                "key": key,
                "ttl": ttl,
                "size": len(serialized_value)
            })
            
            return result
            
        except Exception as e:
            self.logger.error("Failed to set cache value", {
                "key": key,
                "error": str(e)
            })
            return False
    
    async def get(self, key: str, default: Any = None) -> Any:
        """Get a value from cache"""
        if not self._connected:
            await self.connect()
        
        try:
            value = await self.redis.get(key)
            
            if value is None:
                return default
            
            # Try JSON first, then pickle
            try:
                return json.loads(value)
            except (json.JSONDecodeError, UnicodeDecodeError):
                return pickle.loads(value)
                
        except Exception as e:
            self.logger.error("Failed to get cache value", {
                "key": key,
                "error": str(e)
            })
            return default
    
    async def delete(self, key: str) -> bool:
        """Delete a key from cache"""
        if not self._connected:
            await self.connect()
        
        try:
            result = await self.redis.delete(key)
            self.logger.debug("Deleted cache key", {"key": key})
            return bool(result)
            
        except Exception as e:
            self.logger.error("Failed to delete cache key", {
                "key": key,
                "error": str(e)
            })
            return False
    
    async def exists(self, key: str) -> bool:
        """Check if key exists in cache"""
        if not self._connected:
            await self.connect()
        
        try:
            result = await self.redis.exists(key)
            return bool(result)
        except Exception as e:
            self.logger.error("Failed to check key existence", {
                "key": key,
                "error": str(e)
            })
            return False
    
    async def expire(self, key: str, ttl: int) -> bool:
        """Set TTL for existing key"""
        if not self._connected:
            await self.connect()
        
        try:
            result = await self.redis.expire(key, ttl)
            return bool(result)
        except Exception as e:
            self.logger.error("Failed to set key expiration", {
                "key": key,
                "ttl": ttl,
                "error": str(e)
            })
            return False
    
    async def keys(self, pattern: str) -> List[str]:
        """Get keys matching pattern"""
        if not self._connected:
            await self.connect()
        
        try:
            keys = await self.redis.keys(pattern)
            return [key.decode() if isinstance(key, bytes) else key for key in keys]
        except Exception as e:
            self.logger.error("Failed to get keys", {
                "pattern": pattern,
                "error": str(e)
            })
            return []
    
    async def flushdb(self) -> bool:
        """Clear all keys in current database"""
        if not self._connected:
            await self.connect()
        
        try:
            await self.redis.flushdb()
            self.logger.warning("Flushed Redis database", {"db": self.config.db})
            return True
        except Exception as e:
            self.logger.error("Failed to flush database", {"error": str(e)})
            return False


class DatabaseConnection:
    """PostgreSQL database connection with async SQLAlchemy"""
    
    def __init__(self, config: DatabaseConfig):
        self.config = config
        self.logger = get_logger("database")
        self.engine = None
        self.session_factory = None
        self._connected = False
    
    async def connect(self) -> None:
        """Connect to PostgreSQL database"""
        try:
            # Create async engine
            self.engine = create_async_engine(
                self.config.connection_string.replace('postgresql://', 'postgresql+asyncpg://'),
                echo=False,  # Set to True for SQL debugging
                pool_size=10,
                max_overflow=20,
                pool_pre_ping=True,
                pool_recycle=3600
            )
            
            # Create session factory
            self.session_factory = sessionmaker(
                self.engine,
                class_=AsyncSession,
                expire_on_commit=False
            )
            
            # Test connection
            async with self.engine.begin() as conn:
                await conn.execute(text("SELECT 1"))
            
            self._connected = True
            
            self.logger.info("Connected to PostgreSQL", {
                "host": self.config.host,
                "port": self.config.port,
                "database": self.config.database
            })
            
        except Exception as e:
            self.logger.error("Failed to connect to PostgreSQL", {
                "host": self.config.host,
                "port": self.config.port,
                "database": self.config.database,
                "error": str(e)
            })
            raise SystemError(
                "Database connection failed",
                component="database",
                original_error=e
            )
    
    async def disconnect(self) -> None:
        """Disconnect from database"""
        if self.engine:
            await self.engine.dispose()
            self._connected = False
            self.logger.info("Disconnected from PostgreSQL")
    
    @asynccontextmanager
    async def session(self):
        """Get database session context manager"""
        if not self._connected:
            await self.connect()
        
        async with self.session_factory() as session:
            try:
                yield session
                await session.commit()
            except Exception:
                await session.rollback()
                raise
    
    async def execute_query(self, query: str, params: Dict = None) -> List[Dict]:
        """Execute raw SQL query that returns rows"""
        async with self.session() as session:
            result = await session.execute(text(query), params or {})
            rows = result.fetchall()
            return [dict(row._mapping) for row in rows]
    
    async def execute_non_query(self, query: str, params: Dict = None) -> None:
        """Execute raw SQL query that doesn't return rows (INSERT, UPDATE, DELETE)"""
        async with self.session() as session:
            await session.execute(text(query), params or {})
            await session.commit()
    
    async def create_tables(self) -> None:
        """Create database tables"""
        table_statements = [
            # Market data table
            """
            CREATE TABLE IF NOT EXISTS market_data (
                id SERIAL PRIMARY KEY,
                symbol VARCHAR(20) NOT NULL,
                timestamp TIMESTAMP NOT NULL,
                timeframe VARCHAR(10) NOT NULL,
                open_price DECIMAL(20, 8) NOT NULL,
                high_price DECIMAL(20, 8) NOT NULL,
                low_price DECIMAL(20, 8) NOT NULL,
                close_price DECIMAL(20, 8) NOT NULL,
                volume DECIMAL(20, 8) NOT NULL,
                source VARCHAR(50) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(symbol, timestamp, timeframe, source)
            )
            """,
            
            # Technical indicators table
            """
            CREATE TABLE IF NOT EXISTS technical_indicators (
                id SERIAL PRIMARY KEY,
                symbol VARCHAR(20) NOT NULL,
                timestamp TIMESTAMP NOT NULL,
                timeframe VARCHAR(10) NOT NULL,
                rsi DECIMAL(10, 4),
                macd DECIMAL(20, 8),
                macd_signal DECIMAL(20, 8),
                macd_histogram DECIMAL(20, 8),
                sma_20 DECIMAL(20, 8),
                sma_50 DECIMAL(20, 8),
                sma_200 DECIMAL(20, 8),
                ema_12 DECIMAL(20, 8),
                ema_26 DECIMAL(20, 8),
                bollinger_upper DECIMAL(20, 8),
                bollinger_middle DECIMAL(20, 8),
                bollinger_lower DECIMAL(20, 8),
                atr DECIMAL(20, 8),
                volume_sma DECIMAL(20, 8),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(symbol, timestamp, timeframe)
            )
            """,
            
            # Trading signals table
            """
            CREATE TABLE IF NOT EXISTS trading_signals (
                id VARCHAR(50) PRIMARY KEY,
                symbol VARCHAR(20) NOT NULL,
                direction VARCHAR(10) NOT NULL,
                confidence DECIMAL(5, 4) NOT NULL,
                strength VARCHAR(20) NOT NULL,
                technical_score DECIMAL(5, 4) NOT NULL,
                sentiment_score DECIMAL(5, 4) NOT NULL,
                event_impact DECIMAL(5, 4) DEFAULT 0,
                setup_type VARCHAR(50) NOT NULL,
                entry_price DECIMAL(20, 8),
                stop_loss DECIMAL(20, 8),
                take_profit_levels JSONB,
                timestamp TIMESTAMP NOT NULL,
                expires_at TIMESTAMP,
                metadata JSONB,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
            """,
            
            # Positions table
            """
            CREATE TABLE IF NOT EXISTS positions (
                id VARCHAR(50) PRIMARY KEY,
                symbol VARCHAR(20) NOT NULL,
                direction VARCHAR(10) NOT NULL,
                entry_price DECIMAL(20, 8) NOT NULL,
                current_price DECIMAL(20, 8) NOT NULL,
                quantity DECIMAL(20, 8) NOT NULL,
                stop_loss DECIMAL(20, 8),
                take_profit_levels JSONB,
                status VARCHAR(20) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                closed_at TIMESTAMP,
                entry_orders JSONB,
                exit_orders JSONB,
                metadata JSONB
            )
            """,
            
            # Trades table
            """
            CREATE TABLE IF NOT EXISTS trades (
                id VARCHAR(50) PRIMARY KEY,
                position_id VARCHAR(50) NOT NULL,
                symbol VARCHAR(20) NOT NULL,
                direction VARCHAR(10) NOT NULL,
                entry_price DECIMAL(20, 8) NOT NULL,
                exit_price DECIMAL(20, 8) NOT NULL,
                quantity DECIMAL(20, 8) NOT NULL,
                entry_time TIMESTAMP NOT NULL,
                exit_time TIMESTAMP NOT NULL,
                realized_pnl DECIMAL(20, 8) NOT NULL,
                fees DECIMAL(20, 8) DEFAULT 0,
                exit_reason VARCHAR(100) NOT NULL,
                setup_type VARCHAR(50),
                metadata JSONB,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
            """,
            
            # Portfolio snapshots table
            """
            CREATE TABLE IF NOT EXISTS portfolio_snapshots (
                id SERIAL PRIMARY KEY,
                total_value DECIMAL(20, 8) NOT NULL,
                available_balance DECIMAL(20, 8) NOT NULL,
                daily_pnl DECIMAL(20, 8) DEFAULT 0,
                total_pnl DECIMAL(20, 8) DEFAULT 0,
                max_drawdown DECIMAL(20, 8) DEFAULT 0,
                positions_count INTEGER DEFAULT 0,
                timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
            """
        ]
        
        index_statements = [
            "CREATE INDEX IF NOT EXISTS idx_market_data_symbol_time ON market_data(symbol, timestamp DESC)",
            "CREATE INDEX IF NOT EXISTS idx_market_data_timeframe ON market_data(timeframe)",
            "CREATE INDEX IF NOT EXISTS idx_technical_indicators_symbol_time ON technical_indicators(symbol, timestamp DESC)",
            "CREATE INDEX IF NOT EXISTS idx_trading_signals_symbol ON trading_signals(symbol)",
            "CREATE INDEX IF NOT EXISTS idx_trading_signals_timestamp ON trading_signals(timestamp DESC)",
            "CREATE INDEX IF NOT EXISTS idx_positions_status ON positions(status)",
            "CREATE INDEX IF NOT EXISTS idx_positions_symbol ON positions(symbol)",
            "CREATE INDEX IF NOT EXISTS idx_trades_symbol ON trades(symbol)",
            "CREATE INDEX IF NOT EXISTS idx_trades_entry_time ON trades(entry_time DESC)",
            "CREATE INDEX IF NOT EXISTS idx_portfolio_snapshots_timestamp ON portfolio_snapshots(timestamp DESC)"
        ]
        
        try:
            async with self.engine.begin() as conn:
                # Create tables first
                for statement in table_statements:
                    await conn.execute(text(statement.strip()))
                
                # Create indexes
                for statement in index_statements:
                    await conn.execute(text(statement))
            
            self.logger.info("Database tables created successfully")
            
        except Exception as e:
            self.logger.error("Failed to create database tables", {"error": str(e)})
            raise SystemError(
                "Database table creation failed",
                component="database",
                original_error=e
            )


class DataAccessObject:
    """Data Access Object for market data and trading operations"""
    
    def __init__(self, db: DatabaseConnection, cache: RedisCache):
        self.db = db
        self.cache = cache
        self.logger = get_logger("data_access")
    
    async def store_market_data(self, market_data: MarketData) -> bool:
        """Store market data in database and cache"""
        try:
            # Store in database
            query = """
            INSERT INTO market_data (symbol, timestamp, timeframe, open_price, high_price, 
                                   low_price, close_price, volume, source)
            VALUES (:symbol, :timestamp, :timeframe, :open_price, :high_price, 
                   :low_price, :close_price, :volume, :source)
            ON CONFLICT (symbol, timestamp, timeframe, source) DO UPDATE SET
                open_price = EXCLUDED.open_price,
                high_price = EXCLUDED.high_price,
                low_price = EXCLUDED.low_price,
                close_price = EXCLUDED.close_price,
                volume = EXCLUDED.volume
            """
            
            params = {
                'symbol': market_data.symbol,
                'timestamp': market_data.timestamp,
                'timeframe': market_data.timeframe,
                'open_price': market_data.ohlcv.open,
                'high_price': market_data.ohlcv.high,
                'low_price': market_data.ohlcv.low,
                'close_price': market_data.ohlcv.close,
                'volume': market_data.ohlcv.volume,
                'source': market_data.source
            }
            
            async with self.db.session() as session:
                await session.execute(text(query), params)
            
            # Cache latest price
            await self.cache.set(
                CacheKey.latest_price(market_data.symbol),
                float(market_data.ohlcv.close),
                ttl=60  # 1 minute TTL for latest price
            )
            
            # Cache market data (convert datetime to string for JSON serialization)
            cache_data = market_data.dict()
            cache_data['timestamp'] = market_data.timestamp.isoformat()
            await self.cache.set(
                CacheKey.market_data(market_data.symbol, market_data.timeframe),
                cache_data,
                ttl=300  # 5 minutes TTL
            )
            
            self.logger.debug("Stored market data", {
                "symbol": market_data.symbol,
                "timestamp": market_data.timestamp,
                "price": float(market_data.ohlcv.close)
            })
            
            return True
            
        except Exception as e:
            self.logger.error("Failed to store market data", {
                "symbol": market_data.symbol,
                "error": str(e)
            })
            return False
    
    async def get_latest_price(self, symbol: str) -> Optional[Decimal]:
        """Get latest price from cache, database, or live market data"""
        try:
            # Try cache first
            cached_price = await self.cache.get(CacheKey.latest_price(symbol))
            if cached_price is not None:
                return Decimal(str(cached_price))
            
            # Try database
            query = """
            SELECT close_price FROM market_data 
            WHERE symbol = :symbol 
            ORDER BY timestamp DESC 
            LIMIT 1
            """
            
            result = await self.db.execute_query(query, {'symbol': symbol})
            if result:
                price = Decimal(str(result[0]['close_price']))
                # Cache for next time
                await self.cache.set(
                    CacheKey.latest_price(symbol),
                    float(price),
                    ttl=60
                )
                return price
            
            # Fallback to live market data
            try:
                from ai_trading_system.services.multi_source_market_data import get_current_prices
                price_data = await get_current_prices([symbol])
                live_price = price_data[symbol]['price'] if price_data and symbol in price_data else None
                if live_price is not None:
                    price = Decimal(str(live_price))
                    # Cache the live price
                    await self.cache.set(
                        CacheKey.latest_price(symbol),
                        float(price),
                        ttl=60
                    )
                    self.logger.info(f"Using live price for {symbol}: ${live_price}")
                    return price
            except Exception as e:
                self.logger.warning(f"Failed to get live price for {symbol}: {e}")
            
            return None
            
        except Exception as e:
            self.logger.error("Failed to get latest price", {
                "symbol": symbol,
                "error": str(e)
            })
            return None
    
    async def get_market_data_history(
        self, 
        symbol: str, 
        timeframe: str, 
        limit: int = 100,
        start_time: Optional[datetime] = None,
        end_time: Optional[datetime] = None
    ) -> List[MarketData]:
        """Get historical market data"""
        try:
            query = """
            SELECT symbol, timestamp, timeframe, open_price, high_price, 
                   low_price, close_price, volume, source
            FROM market_data 
            WHERE symbol = :symbol AND timeframe = :timeframe
            """
            
            params = {'symbol': symbol, 'timeframe': timeframe}
            
            if start_time:
                query += " AND timestamp >= :start_time"
                params['start_time'] = start_time
            
            if end_time:
                query += " AND timestamp <= :end_time"
                params['end_time'] = end_time
            
            query += " ORDER BY timestamp DESC LIMIT :limit"
            params['limit'] = limit
            
            result = await self.db.execute_query(query, params)
            
            market_data_list = []
            for row in result:
                from ai_trading_system.models.market_data import OHLCV
                
                market_data = MarketData(
                    symbol=row['symbol'],
                    timestamp=row['timestamp'],
                    timeframe=row['timeframe'],
                    ohlcv=OHLCV(
                        open=Decimal(str(row['open_price'])),
                        high=Decimal(str(row['high_price'])),
                        low=Decimal(str(row['low_price'])),
                        close=Decimal(str(row['close_price'])),
                        volume=Decimal(str(row['volume']))
                    ),
                    source=row['source']
                )
                market_data_list.append(market_data)
            
            return market_data_list
            
        except Exception as e:
            self.logger.error("Failed to get market data history", {
                "symbol": symbol,
                "timeframe": timeframe,
                "error": str(e)
            })
            return []
    
    async def store_technical_indicators(self, indicators: TechnicalIndicators) -> bool:
        """Store technical indicators"""
        try:
            query = """
            INSERT INTO technical_indicators (
                symbol, timestamp, timeframe, rsi, macd, macd_signal, macd_histogram,
                sma_20, sma_50, sma_200, ema_12, ema_26, bollinger_upper, 
                bollinger_middle, bollinger_lower, atr, volume_sma
            ) VALUES (
                :symbol, :timestamp, :timeframe, :rsi, :macd, :macd_signal, :macd_histogram,
                :sma_20, :sma_50, :sma_200, :ema_12, :ema_26, :bollinger_upper,
                :bollinger_middle, :bollinger_lower, :atr, :volume_sma
            ) ON CONFLICT (symbol, timestamp, timeframe) DO UPDATE SET
                rsi = EXCLUDED.rsi,
                macd = EXCLUDED.macd,
                macd_signal = EXCLUDED.macd_signal,
                macd_histogram = EXCLUDED.macd_histogram,
                sma_20 = EXCLUDED.sma_20,
                sma_50 = EXCLUDED.sma_50,
                sma_200 = EXCLUDED.sma_200,
                ema_12 = EXCLUDED.ema_12,
                ema_26 = EXCLUDED.ema_26,
                bollinger_upper = EXCLUDED.bollinger_upper,
                bollinger_middle = EXCLUDED.bollinger_middle,
                bollinger_lower = EXCLUDED.bollinger_lower,
                atr = EXCLUDED.atr,
                volume_sma = EXCLUDED.volume_sma
            """
            
            params = {
                'symbol': indicators.symbol,
                'timestamp': indicators.timestamp,
                'timeframe': indicators.timeframe,
                'rsi': float(indicators.rsi) if indicators.rsi else None,
                'macd': float(indicators.macd) if indicators.macd else None,
                'macd_signal': float(indicators.macd_signal) if indicators.macd_signal else None,
                'macd_histogram': float(indicators.macd_histogram) if indicators.macd_histogram else None,
                'sma_20': float(indicators.sma_20) if indicators.sma_20 else None,
                'sma_50': float(indicators.sma_50) if indicators.sma_50 else None,
                'sma_200': float(indicators.sma_200) if indicators.sma_200 else None,
                'ema_12': float(indicators.ema_12) if indicators.ema_12 else None,
                'ema_26': float(indicators.ema_26) if indicators.ema_26 else None,
                'bollinger_upper': float(indicators.bollinger_upper) if indicators.bollinger_upper else None,
                'bollinger_middle': float(indicators.bollinger_middle) if indicators.bollinger_middle else None,
                'bollinger_lower': float(indicators.bollinger_lower) if indicators.bollinger_lower else None,
                'atr': float(indicators.atr) if indicators.atr else None,
                'volume_sma': float(indicators.volume_sma) if indicators.volume_sma else None
            }
            
            async with self.db.session() as session:
                await session.execute(text(query), params)
            
            # Cache indicators
            await self.cache.set(
                CacheKey.technical_indicators(indicators.symbol, indicators.timeframe),
                indicators.dict(),
                ttl=300
            )
            
            return True
            
        except Exception as e:
            self.logger.error("Failed to store technical indicators", {
                "symbol": indicators.symbol,
                "error": str(e)
            })
            return False
    
    async def store_trading_signal(self, signal: TradingSignal) -> bool:
        """Store trading signal"""
        try:
            query = """
            INSERT INTO trading_signals (
                id, symbol, direction, confidence, strength, technical_score,
                sentiment_score, event_impact, setup_type, entry_price, stop_loss,
                take_profit_levels, timestamp, expires_at, metadata
            ) VALUES (
                :id, :symbol, :direction, :confidence, :strength, :technical_score,
                :sentiment_score, :event_impact, :setup_type, :entry_price, :stop_loss,
                :take_profit_levels, :timestamp, :expires_at, :metadata
            ) ON CONFLICT (id) DO UPDATE SET
                confidence = EXCLUDED.confidence,
                technical_score = EXCLUDED.technical_score,
                sentiment_score = EXCLUDED.sentiment_score,
                event_impact = EXCLUDED.event_impact
            """
            
            params = {
                'id': signal.id,
                'symbol': signal.symbol,
                'direction': signal.direction.value,
                'confidence': float(signal.confidence),
                'strength': signal.strength.value,
                'technical_score': float(signal.technical_score),
                'sentiment_score': float(signal.sentiment_score),
                'event_impact': float(signal.event_impact),
                'setup_type': signal.setup_type.value,
                'entry_price': float(signal.entry_price) if signal.entry_price else None,
                'stop_loss': float(signal.stop_loss) if signal.stop_loss else None,
                'take_profit_levels': json.dumps([float(tp) for tp in signal.take_profit_levels]),
                'timestamp': signal.timestamp,
                'expires_at': signal.expires_at,
                'metadata': json.dumps(signal.metadata) if signal.metadata else None
            }
            
            async with self.db.session() as session:
                await session.execute(text(query), params)
            
            # Cache signal
            await self.cache.set(
                CacheKey.trading_signal(signal.symbol),
                signal.dict(),
                ttl=1800  # 30 minutes
            )
            
            return True
            
        except Exception as e:
            self.logger.error("Failed to store trading signal", {
                "signal_id": signal.id,
                "symbol": signal.symbol,
                "error": str(e)
            })
            return False
    
    async def cleanup_old_data(self, days_to_keep: int = 30) -> None:
        """Clean up old data to manage storage"""
        try:
            cutoff_date = datetime.utcnow() - timedelta(days=days_to_keep)
            
            # Clean up old market data (keep only recent data)
            cleanup_queries = [
                "DELETE FROM market_data WHERE timestamp < :cutoff_date",
                "DELETE FROM technical_indicators WHERE timestamp < :cutoff_date",
                "DELETE FROM trading_signals WHERE timestamp < :cutoff_date",
                "DELETE FROM portfolio_snapshots WHERE timestamp < :cutoff_date"
            ]
            
            async with self.db.session() as session:
                for query in cleanup_queries:
                    result = await session.execute(text(query), {'cutoff_date': cutoff_date})
                    self.logger.info(f"Cleaned up old data", {
                        "table": query.split()[2],
                        "rows_deleted": result.rowcount
                    })
            
            self.logger.info("Data cleanup completed", {
                "cutoff_date": cutoff_date,
                "days_kept": days_to_keep
            })
            
        except Exception as e:
            self.logger.error("Failed to cleanup old data", {"error": str(e)})


class DataRetentionManager:
    """Manages data retention policies and cleanup"""
    
    def __init__(self, dao: DataAccessObject):
        self.dao = dao
        self.logger = get_logger("data_retention")
        self._cleanup_task: Optional[asyncio.Task] = None
        self._running = False
    
    async def start_cleanup_scheduler(self, cleanup_interval_hours: int = 24) -> None:
        """Start automatic data cleanup scheduler"""
        self._running = True
        
        async def cleanup_loop():
            while self._running:
                try:
                    await self.dao.cleanup_old_data()
                    await asyncio.sleep(cleanup_interval_hours * 3600)  # Convert to seconds
                except Exception as e:
                    self.logger.error("Error in cleanup scheduler", {"error": str(e)})
                    await asyncio.sleep(3600)  # Wait 1 hour before retry
        
        self._cleanup_task = asyncio.create_task(cleanup_loop())
        self.logger.info("Data cleanup scheduler started", {
            "interval_hours": cleanup_interval_hours
        })
    
    async def stop_cleanup_scheduler(self) -> None:
        """Stop automatic data cleanup scheduler"""
        self._running = False
        if self._cleanup_task:
            self._cleanup_task.cancel()
            try:
                await self._cleanup_task
            except asyncio.CancelledError:
                pass
        
        self.logger.info("Data cleanup scheduler stopped")