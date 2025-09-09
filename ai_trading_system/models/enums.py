"""
Enums and constants for the AI trading system
"""

from enum import Enum


class TradeDirection(str, Enum):
    """Direction of a trade"""
    LONG = "long"
    SHORT = "short"


class PositionStatus(str, Enum):
    """Status of a trading position"""
    OPEN = "open"
    CLOSED = "closed"
    PARTIALLY_CLOSED = "partially_closed"
    PENDING = "pending"
    CANCELLED = "cancelled"


class MarketRegime(str, Enum):
    """Market regime classification"""
    BULL = "bull"
    BEAR = "bear"
    RANGE = "range"


class OrderType(str, Enum):
    """Types of orders"""
    MARKET = "market"
    LIMIT = "limit"
    STOP_LOSS = "stop_loss"
    TAKE_PROFIT = "take_profit"
    OCO = "oco"  # One-Cancels-Other


class OrderStatus(str, Enum):
    """Status of an order"""
    PENDING = "pending"
    OPEN = "open"
    FILLED = "filled"
    PARTIALLY_FILLED = "partially_filled"
    CANCELLED = "cancelled"
    REJECTED = "rejected"


class Sentiment(str, Enum):
    """Sentiment classification"""
    POSITIVE = "positive"
    NEGATIVE = "negative"
    NEUTRAL = "neutral"


class EventType(str, Enum):
    """Types of market events"""
    HACK = "hack"
    REGULATION = "regulation"
    UNLOCK = "unlock"
    PARTNERSHIP = "partnership"
    UPGRADE = "upgrade"
    DELISTING = "delisting"
    LISTING = "listing"
    FORK = "fork"
    HALVING = "halving"
    OTHER = "other"


class EventSeverity(str, Enum):
    """Severity of market events"""
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class SetupType(str, Enum):
    """Types of technical setups"""
    LONG_SUPPORT = "long_support"
    LONG_OVERSOLD = "long_oversold"
    LONG_BULLISH_CROSS = "long_bullish_cross"
    SHORT_RESISTANCE = "short_resistance"
    SHORT_OVERBOUGHT = "short_overbought"
    SHORT_BEARISH_CROSS = "short_bearish_cross"


class SignalStrength(str, Enum):
    """Strength of trading signals"""
    WEAK = "weak"
    MODERATE = "moderate"
    STRONG = "strong"
    VERY_STRONG = "very_strong"