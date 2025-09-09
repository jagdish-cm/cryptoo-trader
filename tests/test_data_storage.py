"""
Tests for data storage and caching layer
"""

import pytest
import asyncio
from unittest.mock import AsyncMock, MagicMock, patch
from datetime import datetime, timedelta
from decimal import Decimal
import json

from ai_trading_system.services.data_storage import (
    RedisCache, DatabaseConnection, DataAccessObject, 
    CacheKey, DataRetentionManager
)
from ai_trading_system.config.settings import RedisConfig, DatabaseConfig
from ai_trading_system.models.market_data import MarketData, OHLCV, TechnicalIndicators
from ai_trading_system.models.trading import TradingSignal
from ai_trading_system.models.enums import TradeDirection, SetupType, SignalStrength


class TestCacheKey:
    """Test cache key generation"""
    
    def test_market_data_key(self):
        key = CacheKey.market_data("BTC/USDT", "1h")
        assert key == "market_data:BTC/USDT:1h"
    
    def test_latest_price_key(self):
        key = CacheKey.latest_price("ETH/USDT")
        assert key == "price:latest:ETH/USDT"
    
    def test_technical_indicators_key(self):
        key = CacheKey.technical_indicators("BTC/USDT", "4h")
        assert key == "indicators:BTC/USDT:4h"
    
    def test_trading_signal_key(self):
        key = CacheKey.trading_signal("BTC/USDT")
        assert key == "signal:BTC/USDT"
    
    def test_position_key(self):
        key = CacheKey.position("pos-123")
        assert key == "position:pos-123"
    
    def test_trade_history_key(self):
        key_all = CacheKey.trade_history()
        key_symbol = CacheKey.trade_history("BTC/USDT")
        
        assert key_all == "trades:history:all"
        assert key_symbol == "trades:history:BTC/USDT"


class TestRedisCache:
    """Test Redis caching functionality"""
    
    @pytest.fixture
    def redis_config(self):
        return RedisConfig(
            host="localhost",
            port=6379,
            db=1,  # Use test database
            ttl=300
        )
    
    @pytest.fixture
    def mock_redis(self):
        """Mock Redis client"""
        mock_redis = AsyncMock()
        mock_redis.ping = AsyncMock(return_value=True)
        mock_redis.setex = AsyncMock(return_value=True)
        mock_redis.get = AsyncMock(return_value=None)
        mock_redis.delete = AsyncMock(return_value=1)
        mock_redis.exists = AsyncMock(return_value=1)
        mock_redis.expire = AsyncMock(return_value=True)
        mock_redis.keys = AsyncMock(return_value=[])
        mock_redis.flushdb = AsyncMock(return_value=True)
        mock_redis.close = AsyncMock()
        return mock_redis
    
    @pytest.fixture
    def redis_cache(self, redis_config, mock_redis):
        """Create Redis cache with mocked client"""
        with patch('ai_trading_system.services.data_storage.aioredis') as mock_aioredis:
            mock_aioredis.from_url.return_value = mock_redis
            cache = RedisCache(redis_config)
            return cache
    
    @pytest.mark.asyncio
    async def test_connect_success(self, redis_cache, mock_redis):
        """Test successful Redis connection"""
        await redis_cache.connect()
        
        assert redis_cache._connected is True
        mock_redis.ping.assert_called_once()
    
    @pytest.mark.asyncio
    async def test_connect_failure(self, redis_config):
        """Test Redis connection failure"""
        with patch('ai_trading_system.services.data_storage.aioredis') as mock_aioredis:
            mock_redis = AsyncMock()
            mock_redis.ping.side_effect = Exception("Connection failed")
            mock_aioredis.from_url.return_value = mock_redis
            
            cache = RedisCache(redis_config)
            
            with pytest.raises(Exception):  # Should raise SystemError
                await cache.connect()
    
    @pytest.mark.asyncio
    async def test_set_json_value(self, redis_cache, mock_redis):
        """Test setting JSON serializable value"""
        test_data = {"price": 50000.0, "volume": 100.5}
        
        result = await redis_cache.set("test_key", test_data, ttl=60)
        
        assert result is True
        mock_redis.setex.assert_called_once()
        
        # Check that JSON serialization was used
        call_args = mock_redis.setex.call_args[0]
        assert call_args[0] == "test_key"
        assert call_args[1] == 60
        assert json.loads(call_args[2]) == test_data
    
    @pytest.mark.asyncio
    async def test_set_pydantic_model(self, redis_cache, mock_redis):
        """Test setting Pydantic model"""
        market_data = MarketData(
            symbol="BTC/USDT",
            timestamp=datetime.utcnow(),
            ohlcv=OHLCV(
                open=Decimal('50000'),
                high=Decimal('51000'),
                low=Decimal('49000'),
                close=Decimal('50500'),
                volume=Decimal('100')
            ),
            source="test"
        )
        
        result = await redis_cache.set("market_data", market_data)
        
        assert result is True
        mock_redis.setex.assert_called_once()
    
    @pytest.mark.asyncio
    async def test_get_json_value(self, redis_cache, mock_redis):
        """Test getting JSON value"""
        test_data = {"price": 50000.0, "volume": 100.5}
        mock_redis.get.return_value = json.dumps(test_data)
        
        result = await redis_cache.get("test_key")
        
        assert result == test_data
        mock_redis.get.assert_called_with("test_key")
    
    @pytest.mark.asyncio
    async def test_get_nonexistent_key(self, redis_cache, mock_redis):
        """Test getting non-existent key"""
        mock_redis.get.return_value = None
        
        result = await redis_cache.get("nonexistent", default="default_value")
        
        assert result == "default_value"
    
    @pytest.mark.asyncio
    async def test_delete_key(self, redis_cache, mock_redis):
        """Test deleting key"""
        result = await redis_cache.delete("test_key")
        
        assert result is True
        mock_redis.delete.assert_called_with("test_key")
    
    @pytest.mark.asyncio
    async def test_exists_key(self, redis_cache, mock_redis):
        """Test checking key existence"""
        mock_redis.exists.return_value = 1
        
        result = await redis_cache.exists("test_key")
        
        assert result is True
        mock_redis.exists.assert_called_with("test_key")
    
    @pytest.mark.asyncio
    async def test_expire_key(self, redis_cache, mock_redis):
        """Test setting key expiration"""
        result = await redis_cache.expire("test_key", 300)
        
        assert result is True
        mock_redis.expire.assert_called_with("test_key", 300)
    
    @pytest.mark.asyncio
    async def test_keys_pattern(self, redis_cache, mock_redis):
        """Test getting keys by pattern"""
        mock_redis.keys.return_value = [b"key1", b"key2", "key3"]
        
        result = await redis_cache.keys("test_*")
        
        assert result == ["key1", "key2", "key3"]
        mock_redis.keys.assert_called_with("test_*")
    
    @pytest.mark.asyncio
    async def test_flushdb(self, redis_cache, mock_redis):
        """Test flushing database"""
        result = await redis_cache.flushdb()
        
        assert result is True
        mock_redis.flushdb.assert_called_once()
    
    @pytest.mark.asyncio
    async def test_disconnect(self, redis_cache, mock_redis):
        """Test disconnection"""
        await redis_cache.connect()
        await redis_cache.disconnect()
        
        assert redis_cache._connected is False
        mock_redis.close.assert_called_once()


class TestDatabaseConnection:
    """Test PostgreSQL database connection"""
    
    @pytest.fixture
    def db_config(self):
        return DatabaseConfig(
            host="localhost",
            port=5432,
            database="test_trading",
            username="test_user",
            password="test_password"
        )
    
    @pytest.fixture
    def mock_engine(self):
        """Mock SQLAlchemy engine"""
        mock_engine = AsyncMock()
        mock_conn = AsyncMock()
        mock_engine.begin.return_value.__aenter__.return_value = mock_conn
        mock_engine.dispose = AsyncMock()
        return mock_engine
    
    @pytest.fixture
    def mock_session_factory(self):
        """Mock session factory"""
        mock_session = AsyncMock()
        mock_session.commit = AsyncMock()
        mock_session.rollback = AsyncMock()
        mock_session.execute = AsyncMock()
        
        mock_factory = MagicMock()
        mock_factory.return_value.__aenter__.return_value = mock_session
        mock_factory.return_value.__aexit__.return_value = None
        
        return mock_factory, mock_session
    
    @pytest.fixture
    def db_connection(self, db_config, mock_engine, mock_session_factory):
        """Create database connection with mocked components"""
        factory, session = mock_session_factory
        
        with patch('ai_trading_system.services.data_storage.create_async_engine') as mock_create_engine:
            with patch('ai_trading_system.services.data_storage.sessionmaker') as mock_sessionmaker:
                mock_create_engine.return_value = mock_engine
                mock_sessionmaker.return_value = factory
                
                db = DatabaseConnection(db_config)
                return db, mock_engine, session
    
    @pytest.mark.asyncio
    async def test_connect_success(self, db_connection):
        """Test successful database connection"""
        db, mock_engine, mock_session = db_connection
        
        await db.connect()
        
        assert db._connected is True
        mock_engine.begin.assert_called_once()
    
    @pytest.mark.asyncio
    async def test_connect_failure(self, db_config):
        """Test database connection failure"""
        with patch('ai_trading_system.services.data_storage.create_async_engine') as mock_create_engine:
            mock_engine = AsyncMock()
            mock_engine.begin.side_effect = Exception("Connection failed")
            mock_create_engine.return_value = mock_engine
            
            db = DatabaseConnection(db_config)
            
            with pytest.raises(Exception):  # Should raise SystemError
                await db.connect()
    
    @pytest.mark.asyncio
    async def test_disconnect(self, db_connection):
        """Test database disconnection"""
        db, mock_engine, mock_session = db_connection
        
        await db.connect()
        await db.disconnect()
        
        assert db._connected is False
        mock_engine.dispose.assert_called_once()
    
    @pytest.mark.asyncio
    async def test_execute_query(self, db_connection):
        """Test executing raw SQL query"""
        db, mock_engine, mock_session = db_connection
        
        # Mock query result
        mock_result = MagicMock()
        mock_result.fetchall.return_value = [
            {'id': 1, 'symbol': 'BTC/USDT', 'price': 50000.0}
        ]
        mock_session.execute.return_value = mock_result
        
        await db.connect()
        result = await db.execute_query("SELECT * FROM test_table", {'param': 'value'})
        
        assert len(result) == 1
        assert result[0]['symbol'] == 'BTC/USDT'
        mock_session.execute.assert_called_once()
    
    @pytest.mark.asyncio
    async def test_create_tables(self, db_connection):
        """Test creating database tables"""
        db, mock_engine, mock_session = db_connection
        
        await db.connect()
        await db.create_tables()
        
        # Should execute the CREATE TABLE statements
        mock_engine.begin.assert_called()


class TestDataAccessObject:
    """Test Data Access Object functionality"""
    
    @pytest.fixture
    def mock_db(self):
        """Mock database connection"""
        db = AsyncMock()
        db.execute_query = AsyncMock()
        
        # Mock session context manager
        mock_session = AsyncMock()
        mock_session.execute = AsyncMock()
        db.session.return_value.__aenter__.return_value = mock_session
        db.session.return_value.__aexit__.return_value = None
        
        return db, mock_session
    
    @pytest.fixture
    def mock_cache(self):
        """Mock Redis cache"""
        cache = AsyncMock()
        cache.set = AsyncMock(return_value=True)
        cache.get = AsyncMock(return_value=None)
        return cache
    
    @pytest.fixture
    def dao(self, mock_db, mock_cache):
        """Create DAO with mocked dependencies"""
        db, session = mock_db
        return DataAccessObject(db, mock_cache), db, session, mock_cache
    
    @pytest.fixture
    def sample_market_data(self):
        """Sample market data for testing"""
        return MarketData(
            symbol="BTC/USDT",
            timestamp=datetime.utcnow(),
            ohlcv=OHLCV(
                open=Decimal('50000'),
                high=Decimal('51000'),
                low=Decimal('49000'),
                close=Decimal('50500'),
                volume=Decimal('100')
            ),
            timeframe="1h",
            source="binance"
        )
    
    @pytest.mark.asyncio
    async def test_store_market_data(self, dao, sample_market_data):
        """Test storing market data"""
        dao_obj, mock_db, mock_session, mock_cache = dao
        
        result = await dao_obj.store_market_data(sample_market_data)
        
        assert result is True
        mock_session.execute.assert_called_once()
        
        # Check cache calls
        assert mock_cache.set.call_count == 2  # Latest price + market data
    
    @pytest.mark.asyncio
    async def test_get_latest_price_from_cache(self, dao):
        """Test getting latest price from cache"""
        dao_obj, mock_db, mock_session, mock_cache = dao
        
        # Mock cache hit
        mock_cache.get.return_value = 50500.0
        
        price = await dao_obj.get_latest_price("BTC/USDT")
        
        assert price == Decimal('50500.0')
        mock_cache.get.assert_called_once()
        mock_db.execute_query.assert_not_called()  # Should not hit database
    
    @pytest.mark.asyncio
    async def test_get_latest_price_from_database(self, dao):
        """Test getting latest price from database when cache misses"""
        dao_obj, mock_db, mock_session, mock_cache = dao
        
        # Mock cache miss and database hit
        mock_cache.get.return_value = None
        mock_db.execute_query.return_value = [{'close_price': 50500.0}]
        
        price = await dao_obj.get_latest_price("BTC/USDT")
        
        assert price == Decimal('50500.0')
        mock_cache.get.assert_called_once()
        mock_db.execute_query.assert_called_once()
        mock_cache.set.assert_called_once()  # Should cache the result
    
    @pytest.mark.asyncio
    async def test_get_latest_price_not_found(self, dao):
        """Test getting latest price when not found"""
        dao_obj, mock_db, mock_session, mock_cache = dao
        
        # Mock cache miss and empty database result
        mock_cache.get.return_value = None
        mock_db.execute_query.return_value = []
        
        price = await dao_obj.get_latest_price("UNKNOWN/USDT")
        
        assert price is None
    
    @pytest.mark.asyncio
    async def test_get_market_data_history(self, dao):
        """Test getting market data history"""
        dao_obj, mock_db, mock_session, mock_cache = dao
        
        # Mock database result
        mock_db.execute_query.return_value = [
            {
                'symbol': 'BTC/USDT',
                'timestamp': datetime.utcnow(),
                'timeframe': '1h',
                'open_price': 50000.0,
                'high_price': 51000.0,
                'low_price': 49000.0,
                'close_price': 50500.0,
                'volume': 100.0,
                'source': 'binance'
            }
        ]
        
        history = await dao_obj.get_market_data_history("BTC/USDT", "1h", limit=100)
        
        assert len(history) == 1
        assert isinstance(history[0], MarketData)
        assert history[0].symbol == "BTC/USDT"
        mock_db.execute_query.assert_called_once()
    
    @pytest.mark.asyncio
    async def test_store_technical_indicators(self, dao):
        """Test storing technical indicators"""
        dao_obj, mock_db, mock_session, mock_cache = dao
        
        indicators = TechnicalIndicators(
            symbol="BTC/USDT",
            timestamp=datetime.utcnow(),
            timeframe="1h",
            rsi=Decimal('65'),
            macd=Decimal('0.5'),
            sma_20=Decimal('50000')
        )
        
        result = await dao_obj.store_technical_indicators(indicators)
        
        assert result is True
        mock_session.execute.assert_called_once()
        mock_cache.set.assert_called_once()
    
    @pytest.mark.asyncio
    async def test_store_trading_signal(self, dao):
        """Test storing trading signal"""
        dao_obj, mock_db, mock_session, mock_cache = dao
        
        signal = TradingSignal(
            symbol="BTC/USDT",
            direction=TradeDirection.LONG,
            confidence=Decimal('0.85'),
            strength=SignalStrength.STRONG,
            technical_score=Decimal('0.8'),
            sentiment_score=Decimal('0.9'),
            setup_type=SetupType.LONG_SUPPORT,
            entry_price=Decimal('50000'),
            take_profit_levels=[Decimal('52000'), Decimal('54000')]
        )
        
        result = await dao_obj.store_trading_signal(signal)
        
        assert result is True
        mock_session.execute.assert_called_once()
        mock_cache.set.assert_called_once()
    
    @pytest.mark.asyncio
    async def test_cleanup_old_data(self, dao):
        """Test cleaning up old data"""
        dao_obj, mock_db, mock_session, mock_cache = dao
        
        # Mock successful cleanup
        mock_result = MagicMock()
        mock_result.rowcount = 100
        mock_session.execute.return_value = mock_result
        
        await dao_obj.cleanup_old_data(days_to_keep=30)
        
        # Should execute multiple cleanup queries
        assert mock_session.execute.call_count >= 4


class TestDataRetentionManager:
    """Test data retention manager"""
    
    @pytest.fixture
    def mock_dao(self):
        """Mock DAO"""
        dao = AsyncMock()
        dao.cleanup_old_data = AsyncMock()
        return dao
    
    @pytest.fixture
    def retention_manager(self, mock_dao):
        """Create retention manager with mocked DAO"""
        return DataRetentionManager(mock_dao), mock_dao
    
    @pytest.mark.asyncio
    async def test_start_cleanup_scheduler(self, retention_manager):
        """Test starting cleanup scheduler"""
        manager, mock_dao = retention_manager
        
        # Start scheduler with very short interval for testing
        await manager.start_cleanup_scheduler(cleanup_interval_hours=0.001)  # ~3.6 seconds
        
        # Wait a bit and check if cleanup was called
        await asyncio.sleep(0.1)
        
        assert manager._running is True
        assert manager._cleanup_task is not None
        
        # Stop scheduler
        await manager.stop_cleanup_scheduler()
        
        assert manager._running is False
    
    @pytest.mark.asyncio
    async def test_stop_cleanup_scheduler(self, retention_manager):
        """Test stopping cleanup scheduler"""
        manager, mock_dao = retention_manager
        
        await manager.start_cleanup_scheduler(cleanup_interval_hours=24)
        await manager.stop_cleanup_scheduler()
        
        assert manager._running is False
        assert manager._cleanup_task.cancelled()


class TestIntegration:
    """Integration tests for storage components"""
    
    @pytest.mark.asyncio
    async def test_full_storage_workflow(self):
        """Test complete storage workflow with mocked components"""
        # This test demonstrates the full workflow without real database/Redis
        
        # Mock configurations
        redis_config = RedisConfig(host="localhost", port=6379, db=1)
        db_config = DatabaseConfig(
            host="localhost",
            port=5432,
            database="test_db",
            username="test_user",
            password="test_pass"
        )
        
        # Mock Redis
        mock_redis = AsyncMock()
        mock_redis.ping = AsyncMock(return_value=True)
        mock_redis.setex = AsyncMock(return_value=True)
        mock_redis.get = AsyncMock(return_value=None)
        mock_redis.close = AsyncMock()
        
        # Mock Database
        mock_engine = AsyncMock()
        mock_session = AsyncMock()
        mock_session.execute = AsyncMock()
        mock_session.commit = AsyncMock()
        
        with patch('ai_trading_system.services.data_storage.aioredis') as mock_aioredis:
            with patch('ai_trading_system.services.data_storage.create_async_engine') as mock_create_engine:
                with patch('ai_trading_system.services.data_storage.sessionmaker') as mock_sessionmaker:
                    
                    # Setup mocks
                    mock_aioredis.from_url.return_value = mock_redis
                    mock_create_engine.return_value = mock_engine
                    mock_sessionmaker.return_value = lambda: mock_session
                    mock_engine.begin.return_value.__aenter__.return_value = mock_session
                    
                    # Create components
                    cache = RedisCache(redis_config)
                    db = DatabaseConnection(db_config)
                    dao = DataAccessObject(db, cache)
                    
                    # Connect
                    await cache.connect()
                    await db.connect()
                    
                    # Test market data storage
                    market_data = MarketData(
                        symbol="BTC/USDT",
                        timestamp=datetime.utcnow(),
                        ohlcv=OHLCV(
                            open=Decimal('50000'),
                            high=Decimal('51000'),
                            low=Decimal('49000'),
                            close=Decimal('50500'),
                            volume=Decimal('100')
                        ),
                        source="test"
                    )
                    
                    result = await dao.store_market_data(market_data)
                    assert result is True
                    
                    # Test price retrieval
                    mock_redis.get.return_value = "50500.0"
                    price = await dao.get_latest_price("BTC/USDT")
                    assert price == Decimal('50500.0')
                    
                    # Cleanup
                    await cache.disconnect()
                    await db.disconnect()
                    
                    # Verify calls
                    mock_redis.ping.assert_called()
                    mock_redis.setex.assert_called()
                    mock_session.execute.assert_called()
                    mock_redis.close.assert_called()
                    mock_engine.dispose.assert_called()