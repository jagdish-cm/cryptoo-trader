"""
Live market data service using CoinGecko API
This service provides consistent live market data across the entire system
"""

import asyncio
import aiohttp
from typing import Dict, List, Optional
from datetime import datetime
from decimal import Decimal

from ai_trading_system.models.market_data import MarketData, OHLCV
from ai_trading_system.utils.logging import get_logger
from ai_trading_system.utils.errors import DataIngestionError, NetworkError, RateLimitError

logger = get_logger("live_market_data")


class LiveMarketDataService:
    """Service for fetching live market data from CoinGecko API"""
    
    def __init__(self):
        self.base_url = "https://api.coingecko.com/api/v3"
        self.session: Optional[aiohttp.ClientSession] = None
        
        # Map trading symbols to CoinGecko IDs - Focus on BTC and ETH only
        self.symbol_to_id = {
            "BTC/USDT": "bitcoin",
            "ETH/USDT": "ethereum"
        }
        
        # Rate limiting
        self._last_request_time = 0
        self._min_request_interval = 1.0  # 1 second between requests
    
    async def __aenter__(self):
        """Async context manager entry"""
        await self.connect()
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Async context manager exit"""
        await self.disconnect()
    
    async def connect(self):
        """Initialize HTTP session"""
        if not self.session:
            import ssl
            
            # Create SSL context that doesn't verify certificates (for development)
            ssl_context = ssl.create_default_context()
            ssl_context.check_hostname = False
            ssl_context.verify_mode = ssl.CERT_NONE
            
            timeout = aiohttp.ClientTimeout(total=30)
            connector = aiohttp.TCPConnector(ssl=ssl_context)
            self.session = aiohttp.ClientSession(timeout=timeout, connector=connector)
            logger.info("Live market data service connected")
    
    async def disconnect(self):
        """Close HTTP session"""
        if self.session:
            await self.session.close()
            self.session = None
            logger.info("Live market data service disconnected")
    
    async def _rate_limit(self):
        """Apply rate limiting"""
        current_time = asyncio.get_event_loop().time()
        time_since_last = current_time - self._last_request_time
        
        if time_since_last < self._min_request_interval:
            sleep_time = self._min_request_interval - time_since_last
            await asyncio.sleep(sleep_time)
        
        self._last_request_time = asyncio.get_event_loop().time()
    
    async def get_current_prices(self, symbols: List[str]) -> Dict[str, Dict]:
        """Get current prices for multiple symbols"""
        if not self.session:
            await self.connect()
        
        await self._rate_limit()
        
        # Map symbols to CoinGecko IDs
        coin_ids = []
        symbol_map = {}
        
        for symbol in symbols:
            if symbol in self.symbol_to_id:
                coin_id = self.symbol_to_id[symbol]
                coin_ids.append(coin_id)
                symbol_map[coin_id] = symbol
            else:
                logger.warning(f"Symbol {symbol} not supported by CoinGecko service")
        
        if not coin_ids:
            logger.warning("No valid symbols found for CoinGecko API")
            return {}
        
        try:
            url = f"{self.base_url}/simple/price"
            params = {
                "ids": ",".join(coin_ids),
                "vs_currencies": "usd",
                "include_24hr_change": "true",
                "include_24hr_vol": "true",
                "include_market_cap": "true"
            }
            
            async with self.session.get(url, params=params) as response:
                if response.status == 200:
                    data = await response.json()
                    
                    result = {}
                    for coin_id, price_data in data.items():
                        if coin_id in symbol_map:
                            symbol = symbol_map[coin_id]
                            price = price_data.get("usd", 0)
                            change_24h = price_data.get("usd_24h_change", 0)
                            volume_24h = price_data.get("usd_24h_vol", 0)
                            market_cap = price_data.get("usd_market_cap", 0)
                            
                            # Calculate high/low estimates based on 24h change
                            if change_24h > 0:
                                high_24h = price
                                low_24h = price / (1 + change_24h / 100)
                            else:
                                high_24h = price / (1 + change_24h / 100)
                                low_24h = price
                            
                            result[symbol] = {
                                "symbol": symbol,
                                "price": price,
                                "change24h": change_24h,
                                "volume24h": volume_24h,
                                "high24h": high_24h,
                                "low24h": low_24h,
                                "market_cap": market_cap,
                                "timestamp": datetime.utcnow().isoformat()
                            }
                            
                            logger.debug(f"Fetched live price for {symbol}: ${price}")
                    
                    return result
                    
                elif response.status == 429:
                    logger.warning("CoinGecko API rate limit exceeded")
                    raise RateLimitError(
                        service="coingecko",
                        retry_after=60
                    )
                else:
                    logger.error(f"CoinGecko API returned status {response.status}")
                    raise NetworkError(
                        f"API request failed with status {response.status}",
                        endpoint="coingecko"
                    )
                    
        except aiohttp.ClientError as e:
            logger.error(f"Network error fetching from CoinGecko: {e}")
            raise NetworkError(
                "Failed to fetch market data",
                endpoint="coingecko",
                original_error=e
            )
        except Exception as e:
            logger.error(f"Unexpected error fetching market data: {e}")
            raise DataIngestionError(
                "Market data fetch failed",
                source="coingecko",
                original_error=e
            )
    
    async def get_price(self, symbol: str) -> Optional[float]:
        """Get current price for a single symbol"""
        try:
            prices = await self.get_current_prices([symbol])
            if symbol in prices:
                return prices[symbol]["price"]
            return None
        except Exception as e:
            logger.error(f"Error getting price for {symbol}: {e}")
            return None
    
    async def get_market_data(self, symbol: str, timeframe: str = "1h") -> Optional[MarketData]:
        """Get market data in MarketData format"""
        try:
            prices = await self.get_current_prices([symbol])
            if symbol not in prices:
                return None
            
            price_data = prices[symbol]
            price = Decimal(str(price_data["price"]))
            
            # Create OHLCV data (using current price as all OHLC values for simplicity)
            # In a real implementation, you'd fetch actual OHLCV data
            ohlcv = OHLCV(
                open=price,
                high=Decimal(str(price_data["high24h"])),
                low=Decimal(str(price_data["low24h"])),
                close=price,
                volume=Decimal(str(price_data["volume24h"]))
            )
            
            return MarketData(
                symbol=symbol,
                timestamp=datetime.utcnow(),
                ohlcv=ohlcv,
                timeframe=timeframe,
                source="coingecko"
            )
            
        except Exception as e:
            logger.error(f"Error creating MarketData for {symbol}: {e}")
            return None
    
    async def get_historical_data(self, symbol: str, days: int = 7) -> List[Dict]:
        """Get historical price data"""
        if not self.session:
            await self.connect()
        
        if symbol not in self.symbol_to_id:
            logger.warning(f"Symbol {symbol} not supported for historical data")
            return []
        
        await self._rate_limit()
        
        try:
            coin_id = self.symbol_to_id[symbol]
            url = f"{self.base_url}/coins/{coin_id}/market_chart"
            params = {
                "vs_currency": "usd",
                "days": str(days),
                "interval": "hourly" if days <= 7 else "daily"
            }
            
            async with self.session.get(url, params=params) as response:
                if response.status == 200:
                    data = await response.json()
                    
                    prices = data.get("prices", [])
                    volumes = data.get("total_volumes", [])
                    
                    historical_data = []
                    for i, (timestamp_ms, price) in enumerate(prices):
                        volume = volumes[i][1] if i < len(volumes) else 0
                        
                        historical_data.append({
                            "timestamp": datetime.fromtimestamp(timestamp_ms / 1000),
                            "price": price,
                            "volume": volume
                        })
                    
                    logger.debug(f"Fetched {len(historical_data)} historical data points for {symbol}")
                    return historical_data
                    
                else:
                    logger.error(f"Historical data request failed with status {response.status}")
                    return []
                    
        except Exception as e:
            logger.error(f"Error fetching historical data for {symbol}: {e}")
            return []


# Global instance
_live_market_service: Optional[LiveMarketDataService] = None


async def get_live_market_service() -> LiveMarketDataService:
    """Get or create the global live market data service instance"""
    global _live_market_service
    
    if _live_market_service is None:
        _live_market_service = LiveMarketDataService()
        await _live_market_service.connect()
    
    return _live_market_service


async def get_current_price(symbol: str) -> Optional[float]:
    """Convenience function to get current price for a symbol"""
    service = await get_live_market_service()
    return await service.get_price(symbol)


async def get_current_prices(symbols: List[str]) -> Dict[str, Dict]:
    """Convenience function to get current prices for multiple symbols"""
    service = await get_live_market_service()
    return await service.get_current_prices(symbols)


async def cleanup_live_market_service():
    """Cleanup the global service instance"""
    global _live_market_service
    
    if _live_market_service:
        await _live_market_service.disconnect()
        _live_market_service = None