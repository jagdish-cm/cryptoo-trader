"""
Tests for data collector interfaces and implementations
"""

import pytest
import asyncio
from datetime import datetime, timedelta
from unittest.mock import AsyncMock, MagicMock, patch
from decimal import Decimal

from ai_trading_system.services.data_collectors import (
    DataSourceConfig, DataSourceType, MarketDataCollector, 
    NewsCollector, SocialMediaCollector, DataNormalizer
)
from ai_trading_system.models.market_data import MarketData, OHLCV
from ai_trading_system.utils.errors import DataIngestionError


class MockMarketDataCollector(MarketDataCollector):
    """Mock implementation for testing"""
    
    def __init__(self, config: DataSourceConfig, symbols: list, mock_data: dict = None):
        super().__init__(config, symbols)
        self.mock_data = mock_data or {}
        self.fetch_calls = []
    
    async def _fetch_market_data(self, symbol: str):
        self.fetch_calls.append(symbol)
        
        if symbol in self.mock_data:
            data = self.mock_data[symbol]
            if isinstance(data, Exception):
                raise data
            return data
        
        # Default mock data
        return MarketData(
            symbol=symbol,
            timestamp=datetime.utcnow(),
            ohlcv=OHLCV(
                open=Decimal('50000'),
                high=Decimal('51000'),
                low=Decimal('49000'),
                close=Decimal('50500'),
                volume=Decimal('100')
            ),
            source=self.config.name
        )


class MockNewsCollector(NewsCollector):
    """Mock news collector for testing"""
    
    def __init__(self, config: DataSourceConfig, keywords: list, mock_articles: list = None):
        super().__init__(config, keywords)
        self.mock_articles = mock_articles or []
        self.fetch_calls = 0
    
    async def _fetch_news(self):
        self.fetch_calls += 1
        return self.mock_articles


class MockSocialMediaCollector(SocialMediaCollector):
    """Mock social media collector for testing"""
    
    def __init__(self, config: DataSourceConfig, symbols: list, platforms: list, mock_posts: dict = None):
        super().__init__(config, symbols, platforms)
        self.mock_posts = mock_posts or {}
        self.fetch_calls = []
    
    async def _fetch_social_posts(self, symbol: str, platform: str):
        self.fetch_calls.append((symbol, platform))
        return self.mock_posts.get(f"{symbol}_{platform}", [])


class TestDataSourceConfig:
    """Test data source configuration"""
    
    def test_default_config(self):
        config = DataSourceConfig(
            name="test_source",
            source_type=DataSourceType.EXCHANGE
        )
        
        assert config.name == "test_source"
        assert config.source_type == DataSourceType.EXCHANGE
        assert config.enabled is True
        assert config.rate_limit == 10
        assert config.timeout == 30
        assert config.retry_attempts == 3


class TestMarketDataCollector:
    """Test market data collector functionality"""
    
    @pytest.fixture
    def config(self):
        return DataSourceConfig(
            name="test_exchange",
            source_type=DataSourceType.EXCHANGE,
            rate_limit=2  # 2 requests per second for faster testing
        )
    
    @pytest.fixture
    def collector(self, config):
        return MockMarketDataCollector(config, ["BTC/USDT", "ETH/USDT"])
    
    @pytest.mark.asyncio
    async def test_successful_data_collection(self, collector):
        """Test successful data collection"""
        collected_data = []
        
        # Start collector
        await collector.start()
        
        # Collect a few data points
        async for data in collector.collect():
            collected_data.append(data)
            if len(collected_data) >= 4:  # 2 symbols * 2 iterations
                break
        
        await collector.stop()
        
        assert len(collected_data) >= 4
        assert all(isinstance(data, MarketData) for data in collected_data)
        assert "BTC/USDT" in [data.symbol for data in collected_data]
        assert "ETH/USDT" in [data.symbol for data in collected_data]
    
    @pytest.mark.asyncio
    async def test_health_check_success(self, collector):
        """Test successful health check"""
        result = await collector.health_check()
        assert result is True
        assert len(collector.fetch_calls) == 1
    
    @pytest.mark.asyncio
    async def test_health_check_failure(self, config):
        """Test health check failure"""
        # Create collector that raises exception
        mock_data = {"BTC/USDT": Exception("Connection failed")}
        collector = MockMarketDataCollector(config, ["BTC/USDT"], mock_data)
        
        result = await collector.health_check()
        assert result is False
    
    @pytest.mark.asyncio
    async def test_error_handling_and_circuit_breaker(self, config):
        """Test error handling and circuit breaker"""
        # Create collector that always fails
        mock_data = {
            "BTC/USDT": Exception("Network error"),
            "ETH/USDT": Exception("Network error")
        }
        collector = MockMarketDataCollector(config, ["BTC/USDT", "ETH/USDT"], mock_data)
        collector._max_failures = 2  # Lower threshold for testing
        
        await collector.start()
        
        # Should trigger circuit breaker
        with pytest.raises(DataIngestionError):
            collected_data = []
            async for data in collector.collect():
                collected_data.append(data)
                if len(collected_data) >= 10:  # Should break before this
                    break
    
    @pytest.mark.asyncio
    async def test_start_stop_lifecycle(self, collector):
        """Test collector start/stop lifecycle"""
        assert collector._running is False
        
        await collector.start()
        assert collector._running is True
        
        await collector.stop()
        assert collector._running is False
    
    @pytest.mark.asyncio
    async def test_start_with_failed_health_check(self, config):
        """Test start failure when health check fails"""
        mock_data = {"BTC/USDT": Exception("Connection failed")}
        collector = MockMarketDataCollector(config, ["BTC/USDT"], mock_data)
        
        with pytest.raises(DataIngestionError):
            await collector.start()


class TestNewsCollector:
    """Test news collector functionality"""
    
    @pytest.fixture
    def config(self):
        return DataSourceConfig(
            name="test_news",
            source_type=DataSourceType.NEWS
        )
    
    @pytest.fixture
    def mock_articles(self):
        return [
            {
                'title': 'Bitcoin reaches new high',
                'url': 'https://example.com/article1',
                'timestamp': datetime.utcnow().isoformat()
            },
            {
                'title': 'Ethereum upgrade announced',
                'url': 'https://example.com/article2',
                'timestamp': datetime.utcnow().isoformat()
            }
        ]
    
    @pytest.mark.asyncio
    async def test_news_collection(self, config, mock_articles):
        """Test news collection functionality"""
        collector = MockNewsCollector(config, ["bitcoin", "ethereum"], mock_articles)
        
        collected_articles = []
        await collector.start()
        
        # Collect articles with timeout
        try:
            async with asyncio.timeout(2):  # 2 second timeout
                async for article in collector.collect():
                    collected_articles.append(article)
                    if len(collected_articles) >= 2:
                        break
        except asyncio.TimeoutError:
            pass
        
        await collector.stop()
        
        assert len(collected_articles) == 2
        assert collector.fetch_calls >= 1
    
    @pytest.mark.asyncio
    async def test_article_deduplication(self, config, mock_articles):
        """Test that duplicate articles are filtered out"""
        # Add duplicate article
        duplicate_articles = mock_articles + [mock_articles[0]]  # Duplicate first article
        
        collector = MockNewsCollector(config, ["bitcoin"], duplicate_articles)
        
        collected_articles = []
        await collector.start()
        
        try:
            async with asyncio.timeout(2):
                async for article in collector.collect():
                    collected_articles.append(article)
                    if len(collected_articles) >= 3:
                        break
        except asyncio.TimeoutError:
            pass
        
        await collector.stop()
        
        # Should only get 2 unique articles, not 3
        assert len(collected_articles) == 2
    
    @pytest.mark.asyncio
    async def test_health_check(self, config):
        """Test news collector health check"""
        collector = MockNewsCollector(config, ["bitcoin"], [])
        
        result = await collector.health_check()
        assert result is True  # Empty result is OK for news


class TestSocialMediaCollector:
    """Test social media collector functionality"""
    
    @pytest.fixture
    def config(self):
        return DataSourceConfig(
            name="test_social",
            source_type=DataSourceType.SOCIAL_MEDIA
        )
    
    @pytest.fixture
    def mock_posts(self):
        return {
            "BTC_twitter": [
                {
                    'id': 'tweet1',
                    'text': 'Bitcoin is going to the moon! $BTC',
                    'timestamp': datetime.utcnow().isoformat(),
                    'likes': 100
                }
            ],
            "ETH_reddit": [
                {
                    'id': 'post1',
                    'text': 'Ethereum 2.0 is amazing',
                    'timestamp': datetime.utcnow().isoformat(),
                    'likes': 50
                }
            ]
        }
    
    @pytest.mark.asyncio
    async def test_social_media_collection(self, config, mock_posts):
        """Test social media collection"""
        collector = MockSocialMediaCollector(
            config, 
            ["BTC", "ETH"], 
            ["twitter", "reddit"], 
            mock_posts
        )
        
        collected_posts = []
        await collector.start()
        
        try:
            async with asyncio.timeout(3):
                async for post in collector.collect():
                    collected_posts.append(post)
                    if len(collected_posts) >= 2:
                        break
        except asyncio.TimeoutError:
            pass
        
        await collector.stop()
        
        assert len(collected_posts) == 2
        assert any(post['platform'] == 'twitter' for post in collected_posts)
        assert any(post['platform'] == 'reddit' for post in collected_posts)
    
    @pytest.mark.asyncio
    async def test_post_deduplication(self, config):
        """Test social media post deduplication"""
        duplicate_posts = {
            "BTC_twitter": [
                {'id': 'tweet1', 'text': 'Same tweet', 'timestamp': datetime.utcnow().isoformat()},
                {'id': 'tweet1', 'text': 'Same tweet', 'timestamp': datetime.utcnow().isoformat()}  # Duplicate
            ]
        }
        
        collector = MockSocialMediaCollector(config, ["BTC"], ["twitter"], duplicate_posts)
        
        collected_posts = []
        await collector.start()
        
        try:
            async with asyncio.timeout(2):
                async for post in collector.collect():
                    collected_posts.append(post)
                    if len(collected_posts) >= 2:
                        break
        except asyncio.TimeoutError:
            pass
        
        await collector.stop()
        
        # Should only get 1 unique post
        assert len(collected_posts) == 1


class TestDataNormalizer:
    """Test data normalization functionality"""
    
    @pytest.fixture
    def normalizer(self):
        return DataNormalizer()
    
    def test_normalize_market_data_binance_format(self, normalizer):
        """Test normalizing Binance format market data"""
        raw_data = {
            'symbol': 'BTCUSDT',
            'o': '50000.00',  # Binance format
            'h': '51000.00',
            'l': '49000.00',
            'c': '50500.00',
            'v': '100.5',
            'timestamp': 1640995200000  # Millisecond timestamp
        }
        
        normalized = normalizer.normalize_market_data(raw_data, 'binance')
        
        assert isinstance(normalized, MarketData)
        assert normalized.symbol == 'BTC/USDT'
        assert normalized.ohlcv.open == Decimal('50000.00')
        assert normalized.ohlcv.close == Decimal('50500.00')
        assert normalized.source == 'binance'
    
    def test_normalize_market_data_generic_format(self, normalizer):
        """Test normalizing generic format market data"""
        raw_data = {
            'symbol': 'BTC/USDT',
            'open': 50000.0,
            'high': 51000.0,
            'low': 49000.0,
            'close': 50500.0,
            'volume': 100.5,
            'timestamp': datetime.utcnow()
        }
        
        normalized = normalizer.normalize_market_data(raw_data, 'generic')
        
        assert isinstance(normalized, MarketData)
        assert normalized.symbol == 'BTC/USDT'
        assert normalized.ohlcv.open == Decimal('50000.0')
        assert normalized.source == 'generic'
    
    def test_normalize_news_article(self, normalizer):
        """Test normalizing news article"""
        raw_article = {
            'title': 'Bitcoin reaches $50,000 milestone',
            'content': 'Bitcoin has reached a new milestone of $50,000...',
            'url': 'https://example.com/news/bitcoin-50k',
            'published_at': '2024-01-01T12:00:00Z'
        }
        
        normalized = normalizer.normalize_news_article(raw_article, 'news_source')
        
        assert normalized['title'] == 'Bitcoin reaches $50,000 milestone'
        assert normalized['source'] == 'news_source'
        assert 'BTC/USDT' in normalized['symbols']  # Should extract BTC from title
        assert isinstance(normalized['timestamp'], datetime)
    
    def test_normalize_social_post(self, normalizer):
        """Test normalizing social media post"""
        raw_post = {
            'id': 'tweet123',
            'text': 'Just bought more $BTC! To the moon! 🚀',
            'username': 'crypto_trader',
            'created_at': '2024-01-01T12:00:00Z',
            'favorite_count': 150,
            'retweet_count': 50
        }
        
        normalized = normalizer.normalize_social_post(raw_post, 'twitter_api', 'twitter')
        
        assert normalized['id'] == 'tweet123'
        assert normalized['platform'] == 'twitter'
        assert normalized['engagement']['likes'] == 150
        assert normalized['engagement']['shares'] == 50
        assert 'BTC/USDT' in normalized['symbols']  # Should extract $BTC
        assert normalized['influence_score'] > 0
    
    def test_symbol_extraction_from_text(self, normalizer):
        """Test symbol extraction from text"""
        text = "I'm bullish on $BTC and $ETH. Also watching Bitcoin and Ethereum closely."
        symbols = normalizer._extract_symbols_from_text(text)
        
        assert 'BTC/USDT' in symbols
        assert 'ETH/USDT' in symbols
    
    def test_timestamp_parsing(self, normalizer):
        """Test various timestamp format parsing"""
        # Unix timestamp (seconds)
        ts1 = normalizer._parse_timestamp(1640995200)
        assert isinstance(ts1, datetime)
        
        # Unix timestamp (milliseconds)
        ts2 = normalizer._parse_timestamp(1640995200000)
        assert isinstance(ts2, datetime)
        
        # ISO string
        ts3 = normalizer._parse_timestamp('2024-01-01T12:00:00Z')
        assert isinstance(ts3, datetime)
        
        # Datetime object
        now = datetime.utcnow()
        ts4 = normalizer._parse_timestamp(now)
        assert ts4 == now
        
        # Invalid format should return current time
        ts5 = normalizer._parse_timestamp("invalid")
        assert isinstance(ts5, datetime)
    
    def test_influence_score_calculation(self, normalizer):
        """Test social media influence score calculation"""
        # High engagement post
        high_engagement = {
            'likes': 1000,
            'shares': 500,
            'comments': 200
        }
        score1 = normalizer._calculate_influence_score(high_engagement)
        
        # Low engagement post
        low_engagement = {
            'likes': 5,
            'shares': 1,
            'comments': 2
        }
        score2 = normalizer._calculate_influence_score(low_engagement)
        
        # No engagement post
        no_engagement = {}
        score3 = normalizer._calculate_influence_score(no_engagement)
        
        assert score1 > score2 > score3
        assert 0 <= score1 <= 1
        assert 0 <= score2 <= 1
        assert score3 == 0
    
    def test_normalize_symbol_formats(self, normalizer):
        """Test symbol normalization for different exchange formats"""
        # Binance format
        assert normalizer._normalize_symbol('BTCUSDT', 'binance') == 'BTC/USDT'
        assert normalizer._normalize_symbol('ETHBTC', 'binance') == 'ETH/BTC'
        
        # Already normalized
        assert normalizer._normalize_symbol('BTC/USDT', 'generic') == 'BTC/USDT'
        
        # Unknown format
        assert normalizer._normalize_symbol('UNKNOWN', 'generic') == 'UNKNOWN/USDT'
        
        # Empty symbol
        assert normalizer._normalize_symbol('', 'generic') == 'UNKNOWN/UNKNOWN'