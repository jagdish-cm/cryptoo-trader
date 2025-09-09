"""
Data collector implementations for market data ingestion
"""

import asyncio
from abc import ABC, abstractmethod
from typing import AsyncGenerator, List, Optional, Dict, Any, Set
from datetime import datetime, timedelta
from dataclasses import dataclass
from enum import Enum

from ai_trading_system.interfaces.base import DataCollector
from ai_trading_system.models.market_data import MarketData, OHLCV
from ai_trading_system.models.enums import EventType, EventSeverity
from ai_trading_system.utils.logging import get_logger
from ai_trading_system.utils.errors import DataIngestionError, NetworkError


class DataSourceType(str, Enum):
    """Types of data sources"""
    EXCHANGE = "exchange"
    NEWS = "news"
    SOCIAL_MEDIA = "social_media"
    BLOCKCHAIN = "blockchain"


@dataclass
class DataSourceConfig:
    """Configuration for a data source"""
    name: str
    source_type: DataSourceType
    enabled: bool = True
    rate_limit: int = 10  # requests per second
    timeout: int = 30
    retry_attempts: int = 3
    retry_delay: float = 1.0
    health_check_interval: int = 60


class MarketDataCollector(DataCollector):
    """Base class for market data collection from exchanges"""
    
    def __init__(self, config: DataSourceConfig, symbols: List[str]):
        self.config = config
        self.symbols = symbols
        self.logger = get_logger(f"data_collector.{config.name}")
        self._running = False
        self._last_health_check = datetime.utcnow()
        self._consecutive_failures = 0
        self._max_failures = 5
        
    async def collect(self) -> AsyncGenerator[MarketData, None]:
        """Collect market data continuously"""
        self._running = True
        self.logger.info("Starting market data collection", {
            "source": self.config.name,
            "symbols": self.symbols,
            "rate_limit": self.config.rate_limit
        })
        
        while self._running:
            try:
                # Collect data for all symbols
                for symbol in self.symbols:
                    if not self._running:
                        break
                    
                    try:
                        market_data = await self._fetch_market_data(symbol)
                        if market_data:
                            yield market_data
                            self._consecutive_failures = 0
                    except Exception as e:
                        await self._handle_collection_error(symbol, e)
                
                # Rate limiting
                await asyncio.sleep(1.0 / self.config.rate_limit)
                
            except Exception as e:
                self.logger.error("Critical error in data collection loop", {
                    "error": str(e),
                    "source": self.config.name
                })
                await asyncio.sleep(5)  # Back off on critical errors
    
    @abstractmethod
    async def _fetch_market_data(self, symbol: str) -> Optional[MarketData]:
        """Fetch market data for a specific symbol"""
        pass
    
    async def health_check(self) -> bool:
        """Check if the data source is healthy"""
        try:
            # Perform a simple test request
            test_symbol = self.symbols[0] if self.symbols else "BTC/USDT"
            result = await self._fetch_market_data(test_symbol)
            
            self._last_health_check = datetime.utcnow()
            is_healthy = result is not None
            
            self.logger.debug("Health check completed", {
                "source": self.config.name,
                "healthy": is_healthy,
                "test_symbol": test_symbol
            })
            
            return is_healthy
            
        except Exception as e:
            self.logger.warning("Health check failed", {
                "source": self.config.name,
                "error": str(e)
            })
            return False
    
    async def start(self) -> None:
        """Start the data collection process"""
        if self._running:
            self.logger.warning("Data collector already running")
            return
        
        self.logger.info("Starting data collector", {
            "source": self.config.name,
            "symbols_count": len(self.symbols)
        })
        
        # Perform initial health check
        if not await self.health_check():
            raise DataIngestionError(
                f"Initial health check failed for {self.config.name}",
                source=self.config.name
            )
        
        self._running = True
    
    async def stop(self) -> None:
        """Stop the data collection process"""
        self.logger.info("Stopping data collector", {
            "source": self.config.name
        })
        self._running = False
    
    async def _handle_collection_error(self, symbol: str, error: Exception) -> None:
        """Handle errors during data collection"""
        self._consecutive_failures += 1
        
        self.logger.error("Data collection error", {
            "symbol": symbol,
            "source": self.config.name,
            "error": str(error),
            "consecutive_failures": self._consecutive_failures
        })
        
        # Circuit breaker pattern
        if self._consecutive_failures >= self._max_failures:
            self.logger.critical("Too many consecutive failures, stopping collector", {
                "source": self.config.name,
                "failures": self._consecutive_failures
            })
            await self.stop()
            raise DataIngestionError(
                f"Circuit breaker triggered for {self.config.name}",
                source=self.config.name,
                severity="critical"
            )
        
        # Exponential backoff
        delay = min(self.config.retry_delay * (2 ** self._consecutive_failures), 60)
        await asyncio.sleep(delay)


class NewsCollector(DataCollector):
    """Collector for cryptocurrency news and events"""
    
    def __init__(self, config: DataSourceConfig, keywords: List[str]):
        self.config = config
        self.keywords = keywords
        self.logger = get_logger(f"news_collector.{config.name}")
        self._running = False
        self._seen_articles: Set[str] = set()
        
    async def collect(self) -> AsyncGenerator[Dict[str, Any], None]:
        """Collect news articles continuously"""
        self._running = True
        self.logger.info("Starting news collection", {
            "source": self.config.name,
            "keywords": self.keywords
        })
        
        while self._running:
            try:
                articles = await self._fetch_news()
                
                for article in articles:
                    if not self._running:
                        break
                    
                    # Deduplicate articles
                    article_id = self._get_article_id(article)
                    if article_id not in self._seen_articles:
                        self._seen_articles.add(article_id)
                        yield article
                
                # Clean up old article IDs to prevent memory growth
                if len(self._seen_articles) > 10000:
                    # Keep only recent half
                    recent_articles = list(self._seen_articles)[-5000:]
                    self._seen_articles = set(recent_articles)
                
                await asyncio.sleep(60)  # Check for news every minute
                
            except Exception as e:
                self.logger.error("Error collecting news", {
                    "source": self.config.name,
                    "error": str(e)
                })
                await asyncio.sleep(300)  # Back off for 5 minutes on error
    
    @abstractmethod
    async def _fetch_news(self) -> List[Dict[str, Any]]:
        """Fetch news articles from the source"""
        pass
    
    def _get_article_id(self, article: Dict[str, Any]) -> str:
        """Generate unique ID for an article"""
        # Use URL or title + timestamp as unique identifier
        return article.get('url', '') or f"{article.get('title', '')}_{article.get('timestamp', '')}"
    
    async def health_check(self) -> bool:
        """Check if the news source is accessible"""
        try:
            articles = await self._fetch_news()
            return len(articles) >= 0  # Even empty result is OK
        except Exception:
            return False
    
    async def start(self) -> None:
        """Start news collection"""
        self._running = True
        self.logger.info("News collector started", {"source": self.config.name})
    
    async def stop(self) -> None:
        """Stop news collection"""
        self._running = False
        self.logger.info("News collector stopped", {"source": self.config.name})


class SocialMediaCollector(DataCollector):
    """Collector for social media sentiment data"""
    
    def __init__(self, config: DataSourceConfig, symbols: List[str], platforms: List[str]):
        self.config = config
        self.symbols = symbols
        self.platforms = platforms  # ['twitter', 'reddit', etc.]
        self.logger = get_logger(f"social_collector.{config.name}")
        self._running = False
        self._seen_posts: Set[str] = set()
    
    async def collect(self) -> AsyncGenerator[Dict[str, Any], None]:
        """Collect social media posts continuously"""
        self._running = True
        self.logger.info("Starting social media collection", {
            "source": self.config.name,
            "symbols": self.symbols,
            "platforms": self.platforms
        })
        
        while self._running:
            try:
                for symbol in self.symbols:
                    if not self._running:
                        break
                    
                    for platform in self.platforms:
                        posts = await self._fetch_social_posts(symbol, platform)
                        
                        for post in posts:
                            post_id = self._get_post_id(post)
                            if post_id not in self._seen_posts:
                                self._seen_posts.add(post_id)
                                post['symbol'] = symbol
                                post['platform'] = platform
                                yield post
                
                # Clean up old post IDs
                if len(self._seen_posts) > 50000:
                    recent_posts = list(self._seen_posts)[-25000:]
                    self._seen_posts = set(recent_posts)
                
                await asyncio.sleep(120)  # Check every 2 minutes
                
            except Exception as e:
                self.logger.error("Error collecting social media data", {
                    "source": self.config.name,
                    "error": str(e)
                })
                await asyncio.sleep(600)  # Back off for 10 minutes on error
    
    @abstractmethod
    async def _fetch_social_posts(self, symbol: str, platform: str) -> List[Dict[str, Any]]:
        """Fetch social media posts for a symbol from a platform"""
        pass
    
    def _get_post_id(self, post: Dict[str, Any]) -> str:
        """Generate unique ID for a social media post"""
        return post.get('id', '') or f"{post.get('text', '')[:50]}_{post.get('timestamp', '')}"
    
    async def health_check(self) -> bool:
        """Check if social media sources are accessible"""
        try:
            test_symbol = self.symbols[0] if self.symbols else "BTC"
            test_platform = self.platforms[0] if self.platforms else "twitter"
            posts = await self._fetch_social_posts(test_symbol, test_platform)
            return len(posts) >= 0
        except Exception:
            return False
    
    async def start(self) -> None:
        """Start social media collection"""
        self._running = True
        self.logger.info("Social media collector started", {"source": self.config.name})
    
    async def stop(self) -> None:
        """Stop social media collection"""
        self._running = False
        self.logger.info("Social media collector stopped", {"source": self.config.name})


class DataNormalizer:
    """Utility class for normalizing data from different sources"""
    
    def __init__(self):
        self.logger = get_logger("data_normalizer")
    
    def normalize_market_data(self, raw_data: Dict[str, Any], source: str) -> MarketData:
        """Normalize raw market data to MarketData model"""
        try:
            # Extract OHLCV data based on source format
            ohlcv_data = self._extract_ohlcv(raw_data, source)
            
            return MarketData(
                symbol=self._normalize_symbol(raw_data.get('symbol', ''), source),
                timestamp=self._parse_timestamp(raw_data.get('timestamp')),
                ohlcv=OHLCV(**ohlcv_data),
                timeframe=raw_data.get('timeframe', '1h'),
                source=source,
                metadata=raw_data.get('metadata')
            )
            
        except Exception as e:
            self.logger.error("Failed to normalize market data", {
                "source": source,
                "error": str(e),
                "raw_data_keys": list(raw_data.keys())
            })
            raise DataIngestionError(
                f"Data normalization failed for {source}",
                source=source,
                original_error=e
            )
    
    def normalize_news_article(self, raw_article: Dict[str, Any], source: str) -> Dict[str, Any]:
        """Normalize news article data"""
        return {
            'title': raw_article.get('title', ''),
            'content': raw_article.get('content', raw_article.get('description', '')),
            'url': raw_article.get('url', ''),
            'timestamp': self._parse_timestamp(raw_article.get('published_at', raw_article.get('timestamp'))),
            'source': source,
            'symbols': self._extract_symbols_from_text(raw_article.get('title', '') + ' ' + raw_article.get('content', '')),
            'sentiment': None,  # To be filled by sentiment analyzer
            'events': []  # To be filled by event detector
        }
    
    def normalize_social_post(self, raw_post: Dict[str, Any], source: str, platform: str) -> Dict[str, Any]:
        """Normalize social media post data"""
        return {
            'id': raw_post.get('id', ''),
            'text': raw_post.get('text', raw_post.get('content', '')),
            'author': raw_post.get('author', raw_post.get('username', '')),
            'timestamp': self._parse_timestamp(raw_post.get('created_at', raw_post.get('timestamp'))),
            'platform': platform,
            'source': source,
            'engagement': {
                'likes': raw_post.get('likes', raw_post.get('favorite_count', 0)),
                'shares': raw_post.get('shares', raw_post.get('retweet_count', 0)),
                'comments': raw_post.get('comments', raw_post.get('reply_count', 0))
            },
            'symbols': self._extract_symbols_from_text(raw_post.get('text', '')),
            'sentiment': None,  # To be filled by sentiment analyzer
            'influence_score': self._calculate_influence_score(raw_post)
        }
    
    def _extract_ohlcv(self, raw_data: Dict[str, Any], source: str) -> Dict[str, float]:
        """Extract OHLCV data from raw format"""
        # Handle different source formats
        if source == 'binance':
            return {
                'open': float(raw_data.get('open', raw_data.get('o', 0))),
                'high': float(raw_data.get('high', raw_data.get('h', 0))),
                'low': float(raw_data.get('low', raw_data.get('l', 0))),
                'close': float(raw_data.get('close', raw_data.get('c', 0))),
                'volume': float(raw_data.get('volume', raw_data.get('v', 0)))
            }
        else:
            # Generic format
            return {
                'open': float(raw_data.get('open', 0)),
                'high': float(raw_data.get('high', 0)),
                'low': float(raw_data.get('low', 0)),
                'close': float(raw_data.get('close', 0)),
                'volume': float(raw_data.get('volume', 0))
            }
    
    def _normalize_symbol(self, symbol: str, source: str) -> str:
        """Normalize symbol format to BASE/QUOTE"""
        if not symbol:
            return "UNKNOWN/UNKNOWN"
        
        # Handle different exchange formats
        if source == 'binance':
            # Binance uses BTCUSDT format
            if 'USDT' in symbol:
                base = symbol.replace('USDT', '')
                return f"{base}/USDT"
            elif 'BTC' in symbol and symbol != 'BTC':
                base = symbol.replace('BTC', '')
                return f"{base}/BTC"
        
        # If already in BASE/QUOTE format
        if '/' in symbol:
            return symbol.upper()
        
        # Default fallback
        return f"{symbol}/USDT"
    
    def _parse_timestamp(self, timestamp: Any) -> datetime:
        """Parse timestamp from various formats"""
        if isinstance(timestamp, datetime):
            return timestamp
        elif isinstance(timestamp, (int, float)):
            # Unix timestamp
            if timestamp > 1e10:  # Milliseconds
                return datetime.fromtimestamp(timestamp / 1000)
            else:  # Seconds
                return datetime.fromtimestamp(timestamp)
        elif isinstance(timestamp, str):
            # ISO format or other string formats
            try:
                return datetime.fromisoformat(timestamp.replace('Z', '+00:00'))
            except:
                return datetime.utcnow()
        else:
            return datetime.utcnow()
    
    def _extract_symbols_from_text(self, text: str) -> List[str]:
        """Extract cryptocurrency symbols from text"""
        import re
        
        # Common crypto symbols
        crypto_symbols = ['BTC', 'ETH', 'ADA', 'DOT', 'LINK', 'UNI', 'AAVE', 'SOL', 'AVAX', 'MATIC']
        
        found_symbols = []
        text_upper = text.upper()
        
        for symbol in crypto_symbols:
            if symbol in text_upper:
                found_symbols.append(f"{symbol}/USDT")
        
        # Look for $SYMBOL pattern
        dollar_symbols = re.findall(r'\$([A-Z]{2,10})', text_upper)
        for symbol in dollar_symbols:
            if symbol not in [s.split('/')[0] for s in found_symbols]:
                found_symbols.append(f"{symbol}/USDT")
        
        return found_symbols
    
    def _calculate_influence_score(self, post: Dict[str, Any]) -> float:
        """Calculate influence score for social media post"""
        likes = post.get('likes', post.get('favorite_count', 0))
        shares = post.get('shares', post.get('retweet_count', 0))
        comments = post.get('comments', post.get('reply_count', 0))
        
        # Simple influence score calculation
        score = (likes * 1) + (shares * 3) + (comments * 2)
        
        # Normalize to 0-1 range (log scale for large numbers)
        import math
        if score > 0:
            return min(math.log10(score + 1) / 6, 1.0)  # Max score of 1M gives 1.0
        return 0.0