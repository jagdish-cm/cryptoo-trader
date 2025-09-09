"""
Market data models for OHLCV and related structures
"""

from datetime import datetime
from typing import Optional, Dict, Any
from pydantic import BaseModel, Field, validator
from decimal import Decimal


class OHLCV(BaseModel):
    """Open, High, Low, Close, Volume data structure"""
    open: Decimal = Field(description="Opening price")
    high: Decimal = Field(description="Highest price")
    low: Decimal = Field(description="Lowest price")
    close: Decimal = Field(description="Closing price")
    volume: Decimal = Field(description="Trading volume")
    
    @validator('open', 'high', 'low', 'close', 'volume')
    def validate_positive_values(cls, v):
        if v <= 0:
            raise ValueError('Price and volume values must be positive')
        return v
    
    @validator('high')
    def validate_high_price(cls, v, values):
        if 'low' in values and v < values['low']:
            raise ValueError('High price cannot be lower than low price')
        return v
    
    @validator('low')
    def validate_low_price(cls, v, values):
        if 'high' in values and v > values['high']:
            raise ValueError('Low price cannot be higher than high price')
        return v
    
    @property
    def typical_price(self) -> Decimal:
        """Calculate typical price (HLC/3)"""
        return (self.high + self.low + self.close) / 3
    
    @property
    def price_range(self) -> Decimal:
        """Calculate price range (High - Low)"""
        return self.high - self.low
    
    @property
    def body_size(self) -> Decimal:
        """Calculate candle body size"""
        return abs(self.close - self.open)
    
    @property
    def is_bullish(self) -> bool:
        """Check if candle is bullish"""
        return self.close > self.open
    
    @property
    def is_bearish(self) -> bool:
        """Check if candle is bearish"""
        return self.close < self.open


class MarketData(BaseModel):
    """Market data with metadata"""
    symbol: str = Field(description="Trading symbol (e.g., BTC/USDT)")
    timestamp: datetime = Field(description="Data timestamp")
    ohlcv: OHLCV = Field(description="OHLCV data")
    timeframe: str = Field(default="1h", description="Timeframe (1m, 5m, 1h, 4h, 1d)")
    source: str = Field(description="Data source (exchange name)")
    metadata: Optional[Dict[str, Any]] = Field(default=None, description="Additional metadata")
    
    @validator('symbol')
    def validate_symbol_format(cls, v):
        if '/' not in v:
            raise ValueError('Symbol must be in format BASE/QUOTE (e.g., BTC/USDT)')
        return v.upper()
    
    @validator('timeframe')
    def validate_timeframe(cls, v):
        valid_timeframes = ['1m', '5m', '15m', '30m', '1h', '2h', '4h', '6h', '8h', '12h', '1d', '3d', '1w', '1M']
        if v not in valid_timeframes:
            raise ValueError(f'Invalid timeframe. Must be one of: {valid_timeframes}')
        return v
    
    @property
    def base_asset(self) -> str:
        """Get base asset from symbol"""
        return self.symbol.split('/')[0]
    
    @property
    def quote_asset(self) -> str:
        """Get quote asset from symbol"""
        return self.symbol.split('/')[1]
    
    @property
    def price(self) -> Decimal:
        """Get current price (close price)"""
        return self.ohlcv.close
    
    @property
    def volume_usd(self) -> Optional[Decimal]:
        """Calculate volume in USD (if quote is USDT/USD)"""
        if self.quote_asset in ['USDT', 'USD', 'USDC']:
            return self.ohlcv.volume * self.ohlcv.close
        return None


class PriceLevel(BaseModel):
    """Support/Resistance price level"""
    price: Decimal = Field(description="Price level")
    strength: int = Field(description="Number of touches/tests")
    last_test: datetime = Field(description="Last time price tested this level")
    level_type: str = Field(description="support or resistance")
    
    @validator('strength')
    def validate_strength(cls, v):
        if v < 1:
            raise ValueError('Strength must be at least 1')
        return v
    
    @validator('level_type')
    def validate_level_type(cls, v):
        if v not in ['support', 'resistance']:
            raise ValueError('Level type must be either support or resistance')
        return v


class TechnicalIndicators(BaseModel):
    """Technical indicators for a given timeframe"""
    symbol: str = Field(description="Trading symbol")
    timestamp: datetime = Field(description="Calculation timestamp")
    timeframe: str = Field(description="Timeframe")
    
    # Moving averages
    sma_20: Optional[Decimal] = Field(default=None, description="20-period Simple Moving Average")
    sma_50: Optional[Decimal] = Field(default=None, description="50-period Simple Moving Average")
    sma_200: Optional[Decimal] = Field(default=None, description="200-period Simple Moving Average")
    ema_12: Optional[Decimal] = Field(default=None, description="12-period Exponential Moving Average")
    ema_26: Optional[Decimal] = Field(default=None, description="26-period Exponential Moving Average")
    
    # Oscillators
    rsi: Optional[Decimal] = Field(default=None, description="Relative Strength Index")
    macd: Optional[Decimal] = Field(default=None, description="MACD line")
    macd_signal: Optional[Decimal] = Field(default=None, description="MACD signal line")
    macd_histogram: Optional[Decimal] = Field(default=None, description="MACD histogram")
    
    # Volatility
    bollinger_upper: Optional[Decimal] = Field(default=None, description="Bollinger Band upper")
    bollinger_middle: Optional[Decimal] = Field(default=None, description="Bollinger Band middle")
    bollinger_lower: Optional[Decimal] = Field(default=None, description="Bollinger Band lower")
    atr: Optional[Decimal] = Field(default=None, description="Average True Range")
    
    # Volume
    volume_sma: Optional[Decimal] = Field(default=None, description="Volume Simple Moving Average")
    
    @validator('rsi')
    def validate_rsi_range(cls, v):
        if v is not None and not (0 <= v <= 100):
            raise ValueError('RSI must be between 0 and 100')
        return v
    
    @property
    def is_oversold(self) -> bool:
        """Check if RSI indicates oversold condition"""
        return self.rsi is not None and self.rsi < 30
    
    @property
    def is_overbought(self) -> bool:
        """Check if RSI indicates overbought condition"""
        return self.rsi is not None and self.rsi > 70
    
    @property
    def macd_bullish_crossover(self) -> bool:
        """Check if MACD shows bullish crossover"""
        return (self.macd is not None and 
                self.macd_signal is not None and 
                self.macd > self.macd_signal and 
                self.macd_histogram is not None and 
                self.macd_histogram > 0)
    
    @property
    def macd_bearish_crossover(self) -> bool:
        """Check if MACD shows bearish crossover"""
        return (self.macd is not None and 
                self.macd_signal is not None and 
                self.macd < self.macd_signal and 
                self.macd_histogram is not None and 
                self.macd_histogram < 0)