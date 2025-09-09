"""
Multi-Source Market Data Service with Fallbacks and Intelligent Caching
Production-grade service that handles rate limits and provides reliable price data
"""

import asyncio
import aiohttp
import time
from typing import Dict, List, Optional, Any, Tuple
from datetime import datetime, timedelta
from decimal import Decimal
from enum import Enum
import json

from ai_trading_system.utils.logging import get_logger
from ai_trading_system.utils.errors import DataIngestionError, NetworkError, RateLimitError

logger = get_logger("multi_source_market_data")


class DataSource(str, Enum):
    """Available data sources"""
    COINGECKO = "coingecko"
    BINANCE = "binance"
    COINBASE = "coinbase"
    KRAKEN = "kraken"
    CACHE = "cache"


class PriceData:
    """Price data with metadata"""
    def __init__(self, symbol: str, price: float, source: DataSource, timestamp: datetime, 
                 change_24h: float = 0.0, volume_24h: float = 0.0):
        self.symbol = symbol
        self.price = price
        self.source = source
        self.timestamp = timestamp
        self.change_24h = change_24h
        self.volume_24h = volume_24h
        self.age_seconds = (datetime.utcnow() - timestamp).total_seconds()
    
    def is_stale(self, max_age_seconds: int = 300) -> bool:
        """Check if data is stale (older than max_age_seconds)"""
        return self.age_seconds > max_age_seconds
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "symbol": self.symbol,
            "price": self.price,
            "source": self.source.value,
            "timestamp": self.timestamp.isoformat(),
            "change24h": self.change_24h,
            "volume24h": self.volume_24h,
            "age_seconds": self.age_seconds
        }


class MultiSourceMarketDataService:
    """Production-grade market data service with multiple sources and intelligent caching"""
    
    def __init__(self):
        self.logger = get_logger("multi_source_market_data")
        
        # Symbol mappings for different exchanges
        self.symbol_mappings = {
            DataSource.COINGECKO: {
                "BTC/USDT": "bitcoin",
                "ETH/USDT": "ethereum"
            },
            DataSource.BINANCE: {
                "BTC/USDT": "BTCUSDT",
                "ETH/USDT": "ETHUSDT"
            },
            DataSource.COINBASE: {
                "BTC/USDT": "BTC-USD",
                "ETH/USDT": "ETH-USD"
            },
            DataSource.KRAKEN: {
                "BTC/USDT": "XBTUSD",
                "ETH/USDT": "ETHUSD"
            }
        }
        
        # API endpoints
        self.endpoints = {
            DataSource.COINGECKO: "https://api.coingecko.com/api/v3/simple/price",
            DataSource.BINANCE: "https://api.binance.com/api/v3/ticker/24hr",
            DataSource.COINBASE: "https://api.coinbase.com/v2/exchange-rates",
            DataSource.KRAKEN: "https://api.kraken.com/0/public/Ticker"
        }
        
        # Rate limiting per source (requests per minute)
        self.rate_limits = {
            DataSource.COINGECKO: 10,  # 10 requests per minute (free tier)
            DataSource.BINANCE: 1200,  # 1200 requests per minute
            DataSource.COINBASE: 10000,  # Very high limit
            DataSource.KRAKEN: 60  # 60 requests per minute
        }
        
        # Track last request times for rate limiting
        self.last_request_times = {source: 0 for source in DataSource}
        self.request_counts = {source: [] for source in DataSource}
        
        # In-memory cache with TTL
        self.cache: Dict[str, PriceData] = {}
        self.cache_ttl = 60  # Cache for 60 seconds
        
        # HTTP session
        self.session: Optional[aiohttp.ClientSession] = None
        
        # Source priority order (most reliable first)
        self.source_priority = [
            DataSource.BINANCE,    # Most reliable, highest rate limit
            DataSource.COINBASE,   # Very reliable, high rate limit
            DataSource.KRAKEN,     # Reliable, moderate rate limit
            DataSource.COINGECKO   # Fallback, lowest rate limit
        ]
        
        # Circuit breaker for failed sources
        self.failed_sources = {}  # source -> failure_time
        self.circuit_breaker_timeout = 300  # 5 minutes
    
    async def __aenter__(self):
        await self.connect()
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        await self.disconnect()
    
    async def connect(self):
        """Initialize HTTP session"""
        if not self.session:
            import ssl
            
            # Create SSL context that handles certificate issues
            ssl_context = ssl.create_default_context()
            ssl_context.check_hostname = False
            ssl_context.verify_mode = ssl.CERT_NONE
            
            # Create connector with SSL context
            connector = aiohttp.TCPConnector(
                ssl=ssl_context,
                limit=100,
                limit_per_host=30,
                ttl_dns_cache=300,
                use_dns_cache=True,
            )
            
            timeout = aiohttp.ClientTimeout(total=10, connect=5)
            self.session = aiohttp.ClientSession(
                timeout=timeout,
                connector=connector,
                headers={
                    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
                }
            )
            self.logger.info("Multi-source market data service connected with SSL handling")
    
    async def disconnect(self):
        """Close HTTP session"""
        if self.session:
            await self.session.close()
            self.session = None
            self.logger.info("Multi-source market data service disconnected")
    
    def _is_rate_limited(self, source: DataSource) -> bool:
        """Check if source is rate limited"""
        now = time.time()
        minute_ago = now - 60
        
        # Clean old requests
        self.request_counts[source] = [
            req_time for req_time in self.request_counts[source] 
            if req_time > minute_ago
        ]
        
        # Check if we're at the limit
        return len(self.request_counts[source]) >= self.rate_limits[source]
    
    def _record_request(self, source: DataSource):
        """Record a request for rate limiting"""
        now = time.time()
        self.request_counts[source].append(now)
        self.last_request_times[source] = now
    
    def _is_source_available(self, source: DataSource) -> bool:
        """Check if source is available (not in circuit breaker)"""
        if source in self.failed_sources:
            failure_time = self.failed_sources[source]
            if time.time() - failure_time < self.circuit_breaker_timeout:
                return False
            else:
                # Reset circuit breaker
                del self.failed_sources[source]
        return True
    
    def _mark_source_failed(self, source: DataSource):
        """Mark source as failed (circuit breaker)"""
        self.failed_sources[source] = time.time()
        self.logger.warning(f"Marked {source.value} as failed, circuit breaker activated")
    
    def _get_cached_price(self, symbol: str) -> Optional[PriceData]:
        """Get price from cache if available and not stale"""
        if symbol in self.cache:
            cached_data = self.cache[symbol]
            if not cached_data.is_stale(self.cache_ttl):
                self.logger.debug(f"Cache hit for {symbol}, age: {cached_data.age_seconds:.1f}s")
                return cached_data
            else:
                # Remove stale data
                del self.cache[symbol]
        return None
    
    def _cache_price(self, price_data: PriceData):
        """Cache price data"""
        self.cache[price_data.symbol] = price_data
        self.logger.debug(f"Cached price for {price_data.symbol} from {price_data.source.value}")
    
    async def _fetch_from_coingecko(self, symbols: List[str]) -> Dict[str, PriceData]:
        """Fetch prices from CoinGecko"""
        try:
            if not self.session:
                await self.connect()
            
            # Map symbols to CoinGecko IDs
            ids = []
            symbol_to_id = {}
            for symbol in symbols:
                if symbol in self.symbol_mappings[DataSource.COINGECKO]:
                    cg_id = self.symbol_mappings[DataSource.COINGECKO][symbol]
                    ids.append(cg_id)
                    symbol_to_id[cg_id] = symbol
            
            if not ids:
                return {}
            
            url = f"{self.endpoints[DataSource.COINGECKO]}?ids={','.join(ids)}&vs_currencies=usd&include_24hr_change=true&include_24hr_vol=true"
            
            async with self.session.get(url) as response:
                if response.status == 429:
                    raise RateLimitError("CoinGecko rate limit exceeded")
                
                response.raise_for_status()
                data = await response.json()
                
                results = {}
                timestamp = datetime.utcnow()
                
                for cg_id, price_info in data.items():
                    symbol = symbol_to_id[cg_id]
                    price_data = PriceData(
                        symbol=symbol,
                        price=float(price_info['usd']),
                        source=DataSource.COINGECKO,
                        timestamp=timestamp,
                        change_24h=float(price_info.get('usd_24h_change', 0.0)),
                        volume_24h=float(price_info.get('usd_24h_vol', 0.0))
                    )
                    results[symbol] = price_data
                
                self.logger.info(f"Fetched {len(results)} prices from CoinGecko")
                return results
                
        except Exception as e:
            self.logger.error(f"CoinGecko fetch failed: {e}")
            raise
    
    async def _fetch_from_binance(self, symbols: List[str]) -> Dict[str, PriceData]:
        """Fetch prices from Binance"""
        try:
            if not self.session:
                await self.connect()
            
            results = {}
            timestamp = datetime.utcnow()
            
            for symbol in symbols:
                if symbol not in self.symbol_mappings[DataSource.BINANCE]:
                    continue
                
                binance_symbol = self.symbol_mappings[DataSource.BINANCE][symbol]
                url = f"{self.endpoints[DataSource.BINANCE]}?symbol={binance_symbol}"
                
                async with self.session.get(url) as response:
                    if response.status == 429:
                        raise RateLimitError("Binance rate limit exceeded")
                    
                    response.raise_for_status()
                    data = await response.json()
                    
                    price_data = PriceData(
                        symbol=symbol,
                        price=float(data['lastPrice']),
                        source=DataSource.BINANCE,
                        timestamp=timestamp,
                        change_24h=float(data['priceChangePercent']),
                        volume_24h=float(data['volume'])
                    )
                    results[symbol] = price_data
            
            self.logger.info(f"Fetched {len(results)} prices from Binance")
            return results
            
        except Exception as e:
            self.logger.error(f"Binance fetch failed: {e}")
            raise
    
    async def _fetch_from_coinbase(self, symbols: List[str]) -> Dict[str, PriceData]:
        """Fetch prices from Coinbase"""
        try:
            if not self.session:
                await self.connect()
            
            url = self.endpoints[DataSource.COINBASE]
            
            async with self.session.get(url) as response:
                if response.status == 429:
                    raise RateLimitError("Coinbase rate limit exceeded")
                
                response.raise_for_status()
                data = await response.json()
                
                results = {}
                timestamp = datetime.utcnow()
                rates = data['data']['rates']
                
                for symbol in symbols:
                    if symbol == "BTC/USDT" and "BTC" in rates:
                        price_data = PriceData(
                            symbol=symbol,
                            price=1.0 / float(rates['BTC']),  # Convert from BTC rate to USD price
                            source=DataSource.COINBASE,
                            timestamp=timestamp
                        )
                        results[symbol] = price_data
                    elif symbol == "ETH/USDT" and "ETH" in rates:
                        price_data = PriceData(
                            symbol=symbol,
                            price=1.0 / float(rates['ETH']),  # Convert from ETH rate to USD price
                            source=DataSource.COINBASE,
                            timestamp=timestamp
                        )
                        results[symbol] = price_data
                
                self.logger.info(f"Fetched {len(results)} prices from Coinbase")
                return results
                
        except Exception as e:
            self.logger.error(f"Coinbase fetch failed: {e}")
            raise
    
    async def _fetch_from_kraken(self, symbols: List[str]) -> Dict[str, PriceData]:
        """Fetch prices from Kraken"""
        try:
            if not self.session:
                await self.connect()
            
            # Map symbols to Kraken pairs
            kraken_pairs = []
            symbol_to_pair = {}
            for symbol in symbols:
                if symbol in self.symbol_mappings[DataSource.KRAKEN]:
                    kraken_pair = self.symbol_mappings[DataSource.KRAKEN][symbol]
                    kraken_pairs.append(kraken_pair)
                    symbol_to_pair[kraken_pair] = symbol
            
            if not kraken_pairs:
                return {}
            
            url = f"{self.endpoints[DataSource.KRAKEN]}?pair={','.join(kraken_pairs)}"
            
            async with self.session.get(url) as response:
                if response.status == 429:
                    raise RateLimitError("Kraken rate limit exceeded")
                
                response.raise_for_status()
                data = await response.json()
                
                results = {}
                timestamp = datetime.utcnow()
                
                if 'result' in data:
                    for kraken_pair, price_info in data['result'].items():
                        if kraken_pair in symbol_to_pair:
                            symbol = symbol_to_pair[kraken_pair]
                            price_data = PriceData(
                                symbol=symbol,
                                price=float(price_info['c'][0]),  # Last trade price
                                source=DataSource.KRAKEN,
                                timestamp=timestamp,
                                volume_24h=float(price_info['v'][1])  # 24h volume
                            )
                            results[symbol] = price_data
                
                self.logger.info(f"Fetched {len(results)} prices from Kraken")
                return results
                
        except Exception as e:
            self.logger.error(f"Kraken fetch failed: {e}")
            raise
    
    async def get_current_prices(self, symbols: List[str], force_refresh: bool = False) -> Dict[str, Dict[str, Any]]:
        """
        Get current prices with intelligent fallback strategy
        
        Args:
            symbols: List of symbols to fetch
            force_refresh: Skip cache and force fresh data
            
        Returns:
            Dict mapping symbol to price data
        """
        results = {}
        symbols_to_fetch = []
        
        # Check cache first (unless force_refresh)
        if not force_refresh:
            for symbol in symbols:
                cached_data = self._get_cached_price(symbol)
                if cached_data:
                    results[symbol] = cached_data.to_dict()
                else:
                    symbols_to_fetch.append(symbol)
        else:
            symbols_to_fetch = symbols.copy()
        
        if not symbols_to_fetch:
            self.logger.debug(f"All {len(symbols)} prices served from cache")
            return results
        
        self.logger.info(f"Fetching fresh data for {len(symbols_to_fetch)} symbols: {symbols_to_fetch}")
        
        # Try sources in priority order
        for source in self.source_priority:
            if not symbols_to_fetch:
                break
            
            # Skip if source is not available or rate limited
            if not self._is_source_available(source) or self._is_rate_limited(source):
                self.logger.debug(f"Skipping {source.value}: {'not available' if not self._is_source_available(source) else 'rate limited'}")
                continue
            
            try:
                self._record_request(source)
                
                # Fetch from source
                if source == DataSource.COINGECKO:
                    source_results = await self._fetch_from_coingecko(symbols_to_fetch)
                elif source == DataSource.BINANCE:
                    source_results = await self._fetch_from_binance(symbols_to_fetch)
                elif source == DataSource.COINBASE:
                    source_results = await self._fetch_from_coinbase(symbols_to_fetch)
                elif source == DataSource.KRAKEN:
                    source_results = await self._fetch_from_kraken(symbols_to_fetch)
                else:
                    continue
                
                # Process results
                for symbol, price_data in source_results.items():
                    if symbol in symbols_to_fetch:
                        # Cache the data
                        self._cache_price(price_data)
                        
                        # Add to results
                        results[symbol] = price_data.to_dict()
                        
                        # Remove from symbols to fetch
                        symbols_to_fetch.remove(symbol)
                
                if source_results:
                    self.logger.info(f"Successfully fetched {len(source_results)} prices from {source.value}")
                
            except RateLimitError as e:
                self.logger.warning(f"Rate limit hit for {source.value}: {e}")
                continue
            except Exception as e:
                self.logger.error(f"Failed to fetch from {source.value}: {e}")
                self._mark_source_failed(source)
                continue
        
        # Log any symbols we couldn't fetch
        if symbols_to_fetch:
            self.logger.warning(f"Could not fetch prices for: {symbols_to_fetch}")
        
        self.logger.info(f"Price fetch complete: {len(results)}/{len(symbols)} symbols retrieved")
        return results
    
    def get_cache_stats(self) -> Dict[str, Any]:
        """Get cache statistics"""
        total_cached = len(self.cache)
        fresh_cached = sum(1 for data in self.cache.values() if not data.is_stale(self.cache_ttl))
        
        return {
            "total_cached": total_cached,
            "fresh_cached": fresh_cached,
            "stale_cached": total_cached - fresh_cached,
            "cache_hit_rate": fresh_cached / max(total_cached, 1),
            "failed_sources": list(self.failed_sources.keys()),
            "rate_limit_status": {
                source.value: len(self.request_counts[source]) 
                for source in DataSource if source != DataSource.CACHE
            }
        }


# Global instance
_market_data_service: Optional[MultiSourceMarketDataService] = None


async def get_current_prices(symbols: List[str], force_refresh: bool = False) -> Dict[str, Dict[str, Any]]:
    """
    Convenience function to get current prices with intelligent caching and fallbacks
    
    Args:
        symbols: List of symbols to fetch (e.g., ["BTC/USDT", "ETH/USDT"])
        force_refresh: Skip cache and force fresh data
        
    Returns:
        Dict mapping symbol to price data with metadata
    """
    global _market_data_service
    
    if _market_data_service is None:
        _market_data_service = MultiSourceMarketDataService()
    
    async with _market_data_service as service:
        return await service.get_current_prices(symbols, force_refresh)


async def get_cache_stats() -> Dict[str, Any]:
    """Get cache and source statistics"""
    global _market_data_service
    
    if _market_data_service is None:
        return {"error": "Service not initialized"}
    
    return _market_data_service.get_cache_stats()