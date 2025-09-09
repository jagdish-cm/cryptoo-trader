"""
Tests for exchange client integration
"""

import pytest
import asyncio
from unittest.mock import AsyncMock, MagicMock, patch
from datetime import datetime
from decimal import Decimal

from ai_trading_system.services.exchange_client import (
    ExchangeClient, CCXTMarketDataCollector, RateLimiter
)
from ai_trading_system.config.settings import ExchangeConfig
from ai_trading_system.models.market_data import MarketData, OHLCV
from ai_trading_system.utils.errors import NetworkError, ExecutionError, RateLimitError


class TestRateLimiter:
    """Test rate limiting functionality"""
    
    @pytest.mark.asyncio
    async def test_rate_limiter_per_second(self):
        """Test per-second rate limiting"""
        limiter = RateLimiter(requests_per_second=2.0)  # 2 requests per second
        
        start_time = asyncio.get_event_loop().time()
        
        # Make 3 requests
        await limiter.acquire()
        await limiter.acquire()
        await limiter.acquire()
        
        end_time = asyncio.get_event_loop().time()
        elapsed = end_time - start_time
        
        # Should take at least 1 second for 3 requests at 2 RPS
        assert elapsed >= 1.0
    
    @pytest.mark.asyncio
    async def test_rate_limiter_per_minute(self):
        """Test per-minute rate limiting"""
        limiter = RateLimiter(requests_per_second=10.0, requests_per_minute=2)
        
        # Make 2 requests (should be fine)
        await limiter.acquire()
        await limiter.acquire()
        
        # Third request should be delayed
        start_time = asyncio.get_event_loop().time()
        await limiter.acquire()
        end_time = asyncio.get_event_loop().time()
        
        # Should have been delayed significantly
        elapsed = end_time - start_time
        assert elapsed > 50  # Should wait almost a full minute


class TestExchangeClient:
    """Test exchange client functionality"""
    
    @pytest.fixture
    def exchange_config(self):
        return ExchangeConfig(
            name="binance",
            api_key="test_api_key_1234567890",
            api_secret="test_api_secret_1234567890",
            sandbox=True,
            rate_limit=5
        )
    
    @pytest.fixture
    def mock_ccxt_exchange(self):
        """Mock CCXT exchange for testing"""
        mock_exchange = MagicMock()
        mock_exchange.load_markets = AsyncMock(return_value={})
        mock_exchange.fetch_ticker = AsyncMock(return_value={
            'symbol': 'BTC/USDT',
            'last': 50000.0,
            'bid': 49999.0,
            'ask': 50001.0,
            'timestamp': 1640995200000
        })
        mock_exchange.fetch_ohlcv = AsyncMock(return_value=[
            [1640995200000, 50000.0, 51000.0, 49000.0, 50500.0, 100.5]
        ])
        mock_exchange.fetch_order_book = AsyncMock(return_value={
            'bids': [[49999.0, 1.0], [49998.0, 2.0]],
            'asks': [[50001.0, 1.5], [50002.0, 2.5]],
            'timestamp': 1640995200000
        })
        mock_exchange.create_order = AsyncMock(return_value={
            'id': 'order123',
            'symbol': 'BTC/USDT',
            'status': 'open',
            'type': 'limit',
            'side': 'buy'
        })
        mock_exchange.cancel_order = AsyncMock(return_value={
            'id': 'order123',
            'status': 'canceled'
        })
        mock_exchange.fetch_order = AsyncMock(return_value={
            'id': 'order123',
            'status': 'filled',
            'filled': 0.1
        })
        mock_exchange.fetch_balance = AsyncMock(return_value={
            'USDT': {'free': 10000.0, 'used': 0.0, 'total': 10000.0},
            'BTC': {'free': 0.0, 'used': 0.0, 'total': 0.0}
        })
        mock_exchange.markets = {
            'BTC/USDT': {'id': 'BTCUSDT', 'symbol': 'BTC/USDT'},
            'ETH/USDT': {'id': 'ETHUSDT', 'symbol': 'ETH/USDT'}
        }
        
        # WebSocket methods
        mock_exchange.watch_ticker = AsyncMock()
        mock_exchange.watch_ohlcv = AsyncMock()
        mock_exchange.close = AsyncMock()
        
        return mock_exchange
    
    @pytest.fixture
    def exchange_client(self, exchange_config, mock_ccxt_exchange):
        """Create exchange client with mocked CCXT"""
        with patch('ai_trading_system.services.exchange_client.ccxt') as mock_ccxt:
            mock_ccxt.binance = MagicMock(return_value=mock_ccxt_exchange)
            client = ExchangeClient(exchange_config)
            return client
    
    @pytest.mark.asyncio
    async def test_exchange_client_initialization(self, exchange_config):
        """Test exchange client initialization"""
        with patch('ai_trading_system.services.exchange_client.ccxt') as mock_ccxt:
            mock_exchange = MagicMock()
            mock_ccxt.binance = MagicMock(return_value=mock_exchange)
            
            client = ExchangeClient(exchange_config)
            
            assert client.config == exchange_config
            assert client.rate_limiter.requests_per_second == 5
            assert not client._connected
    
    @pytest.mark.asyncio
    async def test_connect_success(self, exchange_client):
        """Test successful connection to exchange"""
        await exchange_client.connect()
        
        assert exchange_client._connected is True
        exchange_client.exchange.load_markets.assert_called_once()
    
    @pytest.mark.asyncio
    async def test_connect_failure(self, exchange_config, mock_ccxt_exchange):
        """Test connection failure"""
        mock_ccxt_exchange.load_markets.side_effect = Exception("Connection failed")
        
        with patch('ai_trading_system.services.exchange_client.ccxt') as mock_ccxt:
            mock_ccxt.binance = MagicMock(return_value=mock_ccxt_exchange)
            client = ExchangeClient(exchange_config)
            
            with pytest.raises(NetworkError):
                await client.connect()
    
    @pytest.mark.asyncio
    async def test_disconnect(self, exchange_client):
        """Test disconnection from exchange"""
        await exchange_client.connect()
        await exchange_client.disconnect()
        
        assert exchange_client._connected is False
        exchange_client.exchange.close.assert_called_once()
    
    @pytest.mark.asyncio
    async def test_fetch_ticker(self, exchange_client):
        """Test fetching ticker data"""
        await exchange_client.connect()
        
        ticker = await exchange_client.fetch_ticker("BTC/USDT")
        
        assert ticker['symbol'] == 'BTC/USDT'
        assert ticker['last'] == 50000.0
        exchange_client.exchange.fetch_ticker.assert_called_with("BTC/USDT")
    
    @pytest.mark.asyncio
    async def test_fetch_ohlcv(self, exchange_client):
        """Test fetching OHLCV data"""
        await exchange_client.connect()
        
        ohlcv = await exchange_client.fetch_ohlcv("BTC/USDT", "1h", 100)
        
        assert len(ohlcv) == 1
        assert ohlcv[0][1] == 50000.0  # Open price
        assert ohlcv[0][4] == 50500.0  # Close price
        exchange_client.exchange.fetch_ohlcv.assert_called_with("BTC/USDT", "1h", limit=100)
    
    @pytest.mark.asyncio
    async def test_fetch_order_book(self, exchange_client):
        """Test fetching order book"""
        await exchange_client.connect()
        
        order_book = await exchange_client.fetch_order_book("BTC/USDT", 100)
        
        assert len(order_book['bids']) == 2
        assert len(order_book['asks']) == 2
        assert order_book['bids'][0][0] == 49999.0  # Best bid price
        exchange_client.exchange.fetch_order_book.assert_called_with("BTC/USDT", 100)
    
    @pytest.mark.asyncio
    async def test_place_order(self, exchange_client):
        """Test placing an order"""
        await exchange_client.connect()
        
        order = await exchange_client.place_order(
            symbol="BTC/USDT",
            order_type="limit",
            side="buy",
            amount=0.1,
            price=50000.0
        )
        
        assert order['id'] == 'order123'
        assert order['status'] == 'open'
        exchange_client.exchange.create_order.assert_called_with(
            "BTC/USDT", "limit", "buy", 0.1, 50000.0, {}
        )
    
    @pytest.mark.asyncio
    async def test_cancel_order(self, exchange_client):
        """Test canceling an order"""
        await exchange_client.connect()
        
        result = await exchange_client.cancel_order("order123", "BTC/USDT")
        
        assert result['id'] == 'order123'
        assert result['status'] == 'canceled'
        exchange_client.exchange.cancel_order.assert_called_with("order123", "BTC/USDT")
    
    @pytest.mark.asyncio
    async def test_fetch_order(self, exchange_client):
        """Test fetching order status"""
        await exchange_client.connect()
        
        order = await exchange_client.fetch_order("order123", "BTC/USDT")
        
        assert order['id'] == 'order123'
        assert order['status'] == 'filled'
        assert order['filled'] == 0.1
        exchange_client.exchange.fetch_order.assert_called_with("order123", "BTC/USDT")
    
    @pytest.mark.asyncio
    async def test_fetch_balance(self, exchange_client):
        """Test fetching account balance"""
        await exchange_client.connect()
        
        balance = await exchange_client.fetch_balance()
        
        assert balance['USDT']['free'] == 10000.0
        assert balance['BTC']['free'] == 0.0
        exchange_client.exchange.fetch_balance.assert_called_once()
    
    @pytest.mark.asyncio
    async def test_retry_mechanism_success(self, exchange_config, mock_ccxt_exchange):
        """Test retry mechanism with eventual success"""
        # First call fails, second succeeds
        mock_ccxt_exchange.fetch_ticker.side_effect = [
            Exception("Temporary error"),
            {'symbol': 'BTC/USDT', 'last': 50000.0}
        ]
        
        with patch('ai_trading_system.services.exchange_client.ccxt') as mock_ccxt:
            mock_ccxt.binance = MagicMock(return_value=mock_ccxt_exchange)
            client = ExchangeClient(exchange_config)
            
            await client.connect()
            ticker = await client.fetch_ticker("BTC/USDT")
            
            assert ticker['last'] == 50000.0
            assert mock_ccxt_exchange.fetch_ticker.call_count == 2
    
    @pytest.mark.asyncio
    async def test_retry_mechanism_failure(self, exchange_config, mock_ccxt_exchange):
        """Test retry mechanism with persistent failure"""
        import ccxt
        
        # All calls fail
        mock_ccxt_exchange.fetch_ticker.side_effect = ccxt.NetworkError("Persistent error")
        
        with patch('ai_trading_system.services.exchange_client.ccxt') as mock_ccxt:
            mock_ccxt.binance = MagicMock(return_value=mock_ccxt_exchange)
            client = ExchangeClient(exchange_config)
            client._max_retries = 2  # Reduce for faster testing
            
            await client.connect()
            
            with pytest.raises(NetworkError):
                await client.fetch_ticker("BTC/USDT")
            
            assert mock_ccxt_exchange.fetch_ticker.call_count == 2
    
    @pytest.mark.asyncio
    async def test_rate_limit_handling(self, exchange_config, mock_ccxt_exchange):
        """Test rate limit error handling"""
        import ccxt
        
        # First call hits rate limit, second succeeds
        mock_ccxt_exchange.fetch_ticker.side_effect = [
            ccxt.RateLimitExceeded("Rate limit exceeded"),
            {'symbol': 'BTC/USDT', 'last': 50000.0}
        ]
        
        with patch('ai_trading_system.services.exchange_client.ccxt') as mock_ccxt:
            mock_ccxt.binance = MagicMock(return_value=mock_ccxt_exchange)
            client = ExchangeClient(exchange_config)
            
            await client.connect()
            
            # Should eventually succeed after rate limit delay
            ticker = await client.fetch_ticker("BTC/USDT")
            assert ticker['last'] == 50000.0


class TestCCXTMarketDataCollector:
    """Test CCXT market data collector"""
    
    @pytest.fixture
    def exchange_config(self):
        return ExchangeConfig(
            name="binance",
            api_key="test_api_key_1234567890",
            api_secret="test_api_secret_1234567890",
            sandbox=True,
            rate_limit=5
        )
    
    @pytest.fixture
    def mock_exchange_client(self, exchange_config):
        """Mock exchange client for testing"""
        client = MagicMock()
        client.config = exchange_config
        client.fetch_ohlcv = AsyncMock(return_value=[
            [1640995200000, 50000.0, 51000.0, 49000.0, 50500.0, 100.5]
        ])
        client.fetch_ticker = AsyncMock(return_value={
            'symbol': 'BTC/USDT',
            'last': 50500.0
        })
        
        # Mock WebSocket stream
        async def mock_watch_ohlcv(symbol, timeframe):
            yield [1640995200000, 50000.0, 51000.0, 49000.0, 50500.0, 100.5]
            yield [1640995260000, 50500.0, 51500.0, 49500.0, 51000.0, 150.0]
        
        client.watch_ohlcv = mock_watch_ohlcv
        return client
    
    @pytest.fixture
    def collector(self, mock_exchange_client):
        return CCXTMarketDataCollector(
            mock_exchange_client,
            ["BTC/USDT", "ETH/USDT"],
            "1h"
        )
    
    @pytest.mark.asyncio
    async def test_fetch_market_data(self, collector):
        """Test fetching market data"""
        market_data = await collector._fetch_market_data("BTC/USDT")
        
        assert isinstance(market_data, MarketData)
        assert market_data.symbol == "BTC/USDT"
        assert market_data.ohlcv.open == Decimal('50000.0')
        assert market_data.ohlcv.close == Decimal('50500.0')
        assert market_data.timeframe == "1h"
        assert market_data.source == "binance"
    
    @pytest.mark.asyncio
    async def test_fetch_market_data_no_data(self, mock_exchange_client):
        """Test handling when no data is returned"""
        mock_exchange_client.fetch_ohlcv.return_value = []
        
        collector = CCXTMarketDataCollector(
            mock_exchange_client,
            ["BTC/USDT"],
            "1h"
        )
        
        result = await collector._fetch_market_data("BTC/USDT")
        assert result is None
    
    @pytest.mark.asyncio
    async def test_websocket_stream(self, collector):
        """Test WebSocket data streaming"""
        collected_data = []
        
        async for market_data in collector.start_websocket_stream("BTC/USDT"):
            collected_data.append(market_data)
            if len(collected_data) >= 2:
                break
        
        assert len(collected_data) == 2
        assert all(isinstance(data, MarketData) for data in collected_data)
        assert collected_data[0].ohlcv.close == Decimal('50500.0')
        assert collected_data[1].ohlcv.close == Decimal('51000.0')
    
    @pytest.mark.asyncio
    async def test_health_check_success(self, collector):
        """Test successful health check"""
        result = await collector.health_check()
        assert result is True
        collector.exchange_client.fetch_ticker.assert_called_once()
    
    @pytest.mark.asyncio
    async def test_health_check_failure(self, mock_exchange_client):
        """Test health check failure"""
        mock_exchange_client.fetch_ticker.side_effect = Exception("Connection failed")
        
        collector = CCXTMarketDataCollector(
            mock_exchange_client,
            ["BTC/USDT"],
            "1h"
        )
        
        result = await collector.health_check()
        assert result is False
    
    @pytest.mark.asyncio
    async def test_data_collection_integration(self, collector):
        """Test complete data collection workflow"""
        collected_data = []
        
        await collector.start()
        
        # Collect a few data points
        try:
            async with asyncio.timeout(2):  # 2 second timeout
                async for data in collector.collect():
                    collected_data.append(data)
                    if len(collected_data) >= 2:
                        break
        except asyncio.TimeoutError:
            pass
        
        await collector.stop()
        
        assert len(collected_data) >= 1
        assert all(isinstance(data, MarketData) for data in collected_data)


class TestExchangeIntegration:
    """Integration tests for exchange functionality"""
    
    @pytest.mark.asyncio
    async def test_full_exchange_workflow(self):
        """Test complete exchange workflow with mocked CCXT"""
        # This test demonstrates the full workflow without real API calls
        
        config = ExchangeConfig(
            name="binance",
            api_key="test_key_1234567890",
            api_secret="test_secret_1234567890",
            sandbox=True
        )
        
        # Mock the entire CCXT exchange
        mock_exchange = MagicMock()
        mock_exchange.load_markets = AsyncMock(return_value={})
        mock_exchange.fetch_ticker = AsyncMock(return_value={
            'symbol': 'BTC/USDT',
            'last': 50000.0
        })
        mock_exchange.create_order = AsyncMock(return_value={
            'id': 'test_order_123',
            'status': 'open'
        })
        mock_exchange.close = AsyncMock()
        
        with patch('ai_trading_system.services.exchange_client.ccxt') as mock_ccxt:
            mock_ccxt.binance = MagicMock(return_value=mock_exchange)
            
            # Create and connect client
            client = ExchangeClient(config)
            await client.connect()
            
            # Test market data
            ticker = await client.fetch_ticker("BTC/USDT")
            assert ticker['last'] == 50000.0
            
            # Test order placement
            order = await client.place_order(
                "BTC/USDT", "limit", "buy", 0.1, 49000.0
            )
            assert order['id'] == 'test_order_123'
            
            # Cleanup
            await client.disconnect()
            
            # Verify calls
            mock_exchange.load_markets.assert_called_once()
            mock_exchange.fetch_ticker.assert_called_with("BTC/USDT")
            mock_exchange.create_order.assert_called_once()
            mock_exchange.close.assert_called_once()