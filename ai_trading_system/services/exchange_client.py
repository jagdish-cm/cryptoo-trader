"""
Exchange API client with CCXT integration, error handling, and rate limiting
"""

import asyncio
import ccxt.pro as ccxt
from typing import Dict, List, Optional, Any, AsyncGenerator
from datetime import datetime, timedelta
from decimal import Decimal
import time
from dataclasses import dataclass, field

from ai_trading_system.services.data_collectors import MarketDataCollector, DataSourceConfig
from ai_trading_system.models.market_data import MarketData, OHLCV
from ai_trading_system.models.trading import Order, OrderStatus, OrderType
from ai_trading_system.models.enums import TradeDirection
from ai_trading_system.config.settings import ExchangeConfig
from ai_trading_system.utils.logging import get_logger
from ai_trading_system.utils.errors import (
    NetworkError, ExecutionError, RateLimitError, 
    DataIngestionError, ValidationError
)


@dataclass
class RateLimiter:
    """Rate limiter for API requests"""
    requests_per_second: float
    requests_per_minute: int = field(default=60)
    
    def __post_init__(self):
        self.request_times: List[float] = []
        self.last_request_time = 0.0
        self.min_interval = 1.0 / self.requests_per_second if self.requests_per_second > 0 else 0
    
    async def acquire(self) -> None:
        """Acquire permission to make a request"""
        current_time = time.time()
        
        # Clean old requests (older than 1 minute)
        cutoff_time = current_time - 60
        self.request_times = [t for t in self.request_times if t > cutoff_time]
        
        # Check per-minute limit
        if len(self.request_times) >= self.requests_per_minute:
            sleep_time = 60 - (current_time - self.request_times[0])
            if sleep_time > 0:
                await asyncio.sleep(sleep_time)
                current_time = time.time()
        
        # Check per-second limit
        time_since_last = current_time - self.last_request_time
        if time_since_last < self.min_interval:
            sleep_time = self.min_interval - time_since_last
            await asyncio.sleep(sleep_time)
            current_time = time.time()
        
        self.request_times.append(current_time)
        self.last_request_time = current_time


class ExchangeClient:
    """Unified exchange client with CCXT integration"""
    
    def __init__(self, config: ExchangeConfig):
        self.config = config
        self.logger = get_logger(f"exchange_client.{config.name}")
        self.rate_limiter = RateLimiter(
            requests_per_second=config.rate_limit,
            requests_per_minute=config.rate_limit * 60
        )
        
        # Initialize CCXT exchange
        self.exchange = self._create_exchange()
        self._connected = False
        self._websocket_connections: Dict[str, Any] = {}
        
        # Connection recovery
        self._max_retries = 3
        self._retry_delay = 1.0
        self._connection_timeout = 30
    
    def _create_exchange(self) -> ccxt.Exchange:
        """Create CCXT exchange instance"""
        try:
            exchange_class = getattr(ccxt, self.config.name.lower())
            
            exchange_config = {
                'apiKey': self.config.api_key,
                'secret': self.config.api_secret,
                'sandbox': self.config.sandbox,
                'enableRateLimit': True,
                'timeout': 30000,  # 30 seconds
                'options': {
                    'defaultType': 'spot',  # Default to spot trading
                }
            }
            
            exchange = exchange_class(exchange_config)
            
            self.logger.info("Exchange client initialized", {
                "exchange": self.config.name,
                "sandbox": self.config.sandbox,
                "rate_limit": self.config.rate_limit
            })
            
            return exchange
            
        except Exception as e:
            self.logger.error("Failed to initialize exchange", {
                "exchange": self.config.name,
                "error": str(e)
            })
            raise ExecutionError(
                f"Failed to initialize {self.config.name} exchange",
                exchange=self.config.name,
                original_error=e
            )
    
    async def connect(self) -> None:
        """Establish connection to the exchange"""
        if self._connected:
            return
        
        try:
            # Test connection with a simple API call
            await self._execute_with_retry(self.exchange.load_markets)
            self._connected = True
            
            self.logger.info("Successfully connected to exchange", {
                "exchange": self.config.name,
                "markets_count": len(self.exchange.markets)
            })
            
        except Exception as e:
            self.logger.error("Failed to connect to exchange", {
                "exchange": self.config.name,
                "error": str(e)
            })
            raise NetworkError(
                f"Failed to connect to {self.config.name}",
                endpoint=self.config.name,
                original_error=e
            )
    
    async def disconnect(self) -> None:
        """Disconnect from the exchange"""
        try:
            # Close WebSocket connections
            for symbol, ws in self._websocket_connections.items():
                try:
                    await ws.close()
                except Exception as e:
                    self.logger.warning("Error closing WebSocket", {
                        "symbol": symbol,
                        "error": str(e)
                    })
            
            self._websocket_connections.clear()
            
            # Close exchange connection
            if hasattr(self.exchange, 'close'):
                await self.exchange.close()
            
            self._connected = False
            
            self.logger.info("Disconnected from exchange", {
                "exchange": self.config.name
            })
            
        except Exception as e:
            self.logger.error("Error during disconnect", {
                "exchange": self.config.name,
                "error": str(e)
            })
    
    async def _execute_with_retry(self, func, *args, **kwargs) -> Any:
        """Execute function with exponential backoff retry"""
        last_exception = None
        
        for attempt in range(self._max_retries):
            try:
                await self.rate_limiter.acquire()
                
                if asyncio.iscoroutinefunction(func):
                    return await func(*args, **kwargs)
                else:
                    return func(*args, **kwargs)
                    
            except ccxt.RateLimitExceeded as e:
                retry_after = getattr(e, 'retry_after', 60)
                self.logger.warning("Rate limit exceeded", {
                    "exchange": self.config.name,
                    "retry_after": retry_after,
                    "attempt": attempt + 1
                })
                
                if attempt == self._max_retries - 1:
                    raise RateLimitError(
                        service=self.config.name,
                        retry_after=retry_after,
                        original_error=e
                    )
                
                await asyncio.sleep(retry_after)
                
            except (ccxt.NetworkError, ccxt.ExchangeNotAvailable) as e:
                self.logger.warning("Network error, retrying", {
                    "exchange": self.config.name,
                    "error": str(e),
                    "attempt": attempt + 1
                })
                
                last_exception = e
                
                if attempt == self._max_retries - 1:
                    raise NetworkError(
                        f"Network error after {self._max_retries} attempts",
                        endpoint=self.config.name,
                        original_error=e
                    )
                
                # Exponential backoff
                delay = self._retry_delay * (2 ** attempt)
                await asyncio.sleep(min(delay, 60))
                
            except Exception as e:
                self.logger.error("Unexpected error in API call", {
                    "exchange": self.config.name,
                    "function": func.__name__,
                    "error": str(e),
                    "attempt": attempt + 1
                })
                
                if attempt == self._max_retries - 1:
                    raise ExecutionError(
                        f"API call failed after {self._max_retries} attempts",
                        exchange=self.config.name,
                        original_error=e
                    )
                
                await asyncio.sleep(self._retry_delay * (attempt + 1))
        
        # Should not reach here, but just in case
        raise ExecutionError(
            "Maximum retries exceeded",
            exchange=self.config.name,
            original_error=last_exception
        )
    
    async def fetch_ticker(self, symbol: str) -> Dict[str, Any]:
        """Fetch current ticker data for a symbol"""
        try:
            ticker = await self._execute_with_retry(
                self.exchange.fetch_ticker, 
                symbol
            )
            
            self.logger.debug("Fetched ticker", {
                "exchange": self.config.name,
                "symbol": symbol,
                "price": ticker.get('last')
            })
            
            return ticker
            
        except Exception as e:
            self.logger.error("Failed to fetch ticker", {
                "exchange": self.config.name,
                "symbol": symbol,
                "error": str(e)
            })
            raise
    
    async def fetch_ohlcv(self, symbol: str, timeframe: str = '1h', limit: int = 100) -> List[List]:
        """Fetch OHLCV data for a symbol"""
        try:
            ohlcv_data = await self._execute_with_retry(
                self.exchange.fetch_ohlcv,
                symbol,
                timeframe,
                limit=limit
            )
            
            self.logger.debug("Fetched OHLCV data", {
                "exchange": self.config.name,
                "symbol": symbol,
                "timeframe": timeframe,
                "candles": len(ohlcv_data)
            })
            
            return ohlcv_data
            
        except Exception as e:
            self.logger.error("Failed to fetch OHLCV", {
                "exchange": self.config.name,
                "symbol": symbol,
                "timeframe": timeframe,
                "error": str(e)
            })
            raise
    
    async def fetch_order_book(self, symbol: str, limit: int = 100) -> Dict[str, Any]:
        """Fetch order book for a symbol"""
        try:
            order_book = await self._execute_with_retry(
                self.exchange.fetch_order_book,
                symbol,
                limit
            )
            
            self.logger.debug("Fetched order book", {
                "exchange": self.config.name,
                "symbol": symbol,
                "bids": len(order_book.get('bids', [])),
                "asks": len(order_book.get('asks', []))
            })
            
            return order_book
            
        except Exception as e:
            self.logger.error("Failed to fetch order book", {
                "exchange": self.config.name,
                "symbol": symbol,
                "error": str(e)
            })
            raise
    
    async def place_order(
        self,
        symbol: str,
        order_type: str,
        side: str,
        amount: float,
        price: Optional[float] = None,
        params: Optional[Dict] = None
    ) -> Dict[str, Any]:
        """Place an order on the exchange"""
        try:
            order_params = params or {}
            
            self.logger.info("Placing order", {
                "exchange": self.config.name,
                "symbol": symbol,
                "type": order_type,
                "side": side,
                "amount": amount,
                "price": price
            })
            
            order = await self._execute_with_retry(
                self.exchange.create_order,
                symbol,
                order_type,
                side,
                amount,
                price,
                order_params
            )
            
            self.logger.info("Order placed successfully", {
                "exchange": self.config.name,
                "order_id": order.get('id'),
                "symbol": symbol,
                "status": order.get('status')
            })
            
            return order
            
        except Exception as e:
            self.logger.error("Failed to place order", {
                "exchange": self.config.name,
                "symbol": symbol,
                "type": order_type,
                "side": side,
                "amount": amount,
                "error": str(e)
            })
            raise ExecutionError(
                f"Failed to place order on {self.config.name}",
                exchange=self.config.name,
                original_error=e
            )
    
    async def cancel_order(self, order_id: str, symbol: str) -> Dict[str, Any]:
        """Cancel an order"""
        try:
            result = await self._execute_with_retry(
                self.exchange.cancel_order,
                order_id,
                symbol
            )
            
            self.logger.info("Order cancelled", {
                "exchange": self.config.name,
                "order_id": order_id,
                "symbol": symbol
            })
            
            return result
            
        except Exception as e:
            self.logger.error("Failed to cancel order", {
                "exchange": self.config.name,
                "order_id": order_id,
                "symbol": symbol,
                "error": str(e)
            })
            raise ExecutionError(
                f"Failed to cancel order {order_id}",
                exchange=self.config.name,
                original_error=e
            )
    
    async def fetch_order(self, order_id: str, symbol: str) -> Dict[str, Any]:
        """Fetch order status"""
        try:
            order = await self._execute_with_retry(
                self.exchange.fetch_order,
                order_id,
                symbol
            )
            
            self.logger.debug("Fetched order status", {
                "exchange": self.config.name,
                "order_id": order_id,
                "status": order.get('status'),
                "filled": order.get('filled')
            })
            
            return order
            
        except Exception as e:
            self.logger.error("Failed to fetch order", {
                "exchange": self.config.name,
                "order_id": order_id,
                "symbol": symbol,
                "error": str(e)
            })
            raise
    
    async def fetch_balance(self) -> Dict[str, Any]:
        """Fetch account balance"""
        try:
            balance = await self._execute_with_retry(
                self.exchange.fetch_balance
            )
            
            self.logger.debug("Fetched balance", {
                "exchange": self.config.name,
                "currencies": len(balance.get('info', {}))
            })
            
            return balance
            
        except Exception as e:
            self.logger.error("Failed to fetch balance", {
                "exchange": self.config.name,
                "error": str(e)
            })
            raise
    
    async def watch_ticker(self, symbol: str) -> AsyncGenerator[Dict[str, Any], None]:
        """Watch ticker updates via WebSocket"""
        try:
            self.logger.info("Starting ticker watch", {
                "exchange": self.config.name,
                "symbol": symbol
            })
            
            while True:
                ticker = await self.exchange.watch_ticker(symbol)
                yield ticker
                
        except Exception as e:
            self.logger.error("Error in ticker watch", {
                "exchange": self.config.name,
                "symbol": symbol,
                "error": str(e)
            })
            raise NetworkError(
                f"WebSocket error for {symbol}",
                endpoint=f"{self.config.name}/ticker/{symbol}",
                original_error=e
            )
    
    async def watch_ohlcv(self, symbol: str, timeframe: str = '1h') -> AsyncGenerator[List, None]:
        """Watch OHLCV updates via WebSocket"""
        try:
            self.logger.info("Starting OHLCV watch", {
                "exchange": self.config.name,
                "symbol": symbol,
                "timeframe": timeframe
            })
            
            while True:
                ohlcv = await self.exchange.watch_ohlcv(symbol, timeframe)
                if ohlcv:
                    yield ohlcv[-1]  # Return latest candle
                    
        except Exception as e:
            self.logger.error("Error in OHLCV watch", {
                "exchange": self.config.name,
                "symbol": symbol,
                "timeframe": timeframe,
                "error": str(e)
            })
            raise NetworkError(
                f"WebSocket error for {symbol} OHLCV",
                endpoint=f"{self.config.name}/ohlcv/{symbol}",
                original_error=e
            )


class CCXTMarketDataCollector(MarketDataCollector):
    """Market data collector using CCXT exchange client"""
    
    def __init__(self, exchange_client: ExchangeClient, symbols: List[str], timeframe: str = '1h'):
        # Create config from exchange client
        config = DataSourceConfig(
            name=exchange_client.config.name,
            source_type="exchange",
            rate_limit=exchange_client.config.rate_limit
        )
        
        super().__init__(config, symbols)
        self.exchange_client = exchange_client
        self.timeframe = timeframe
        self._use_websocket = True
        
    async def _fetch_market_data(self, symbol: str) -> Optional[MarketData]:
        """Fetch market data for a specific symbol"""
        try:
            # Fetch latest OHLCV data
            ohlcv_data = await self.exchange_client.fetch_ohlcv(
                symbol, 
                self.timeframe, 
                limit=1
            )
            
            if not ohlcv_data:
                return None
            
            # Get the latest candle
            latest_candle = ohlcv_data[-1]
            timestamp_ms, open_price, high_price, low_price, close_price, volume = latest_candle
            
            # Convert to MarketData model
            market_data = MarketData(
                symbol=symbol,
                timestamp=datetime.fromtimestamp(timestamp_ms / 1000),
                ohlcv=OHLCV(
                    open=Decimal(str(open_price)),
                    high=Decimal(str(high_price)),
                    low=Decimal(str(low_price)),
                    close=Decimal(str(close_price)),
                    volume=Decimal(str(volume))
                ),
                timeframe=self.timeframe,
                source=self.config.name
            )
            
            return market_data
            
        except Exception as e:
            self.logger.error("Failed to fetch market data", {
                "symbol": symbol,
                "exchange": self.config.name,
                "error": str(e)
            })
            raise DataIngestionError(
                f"Failed to fetch market data for {symbol}",
                source=self.config.name,
                original_error=e
            )
    
    async def start_websocket_stream(self, symbol: str) -> AsyncGenerator[MarketData, None]:
        """Start WebSocket stream for real-time data"""
        try:
            self.logger.info("Starting WebSocket stream", {
                "symbol": symbol,
                "exchange": self.config.name,
                "timeframe": self.timeframe
            })
            
            async for ohlcv_data in self.exchange_client.watch_ohlcv(symbol, self.timeframe):
                timestamp_ms, open_price, high_price, low_price, close_price, volume = ohlcv_data
                
                market_data = MarketData(
                    symbol=symbol,
                    timestamp=datetime.fromtimestamp(timestamp_ms / 1000),
                    ohlcv=OHLCV(
                        open=Decimal(str(open_price)),
                        high=Decimal(str(high_price)),
                        low=Decimal(str(low_price)),
                        close=Decimal(str(close_price)),
                        volume=Decimal(str(volume))
                    ),
                    timeframe=self.timeframe,
                    source=self.config.name
                )
                
                yield market_data
                
        except Exception as e:
            self.logger.error("WebSocket stream error", {
                "symbol": symbol,
                "exchange": self.config.name,
                "error": str(e)
            })
            raise
    
    async def health_check(self) -> bool:
        """Check exchange connectivity"""
        try:
            # Test with a simple ticker fetch
            test_symbol = self.symbols[0] if self.symbols else "BTC/USDT"
            await self.exchange_client.fetch_ticker(test_symbol)
            return True
        except Exception:
            return False