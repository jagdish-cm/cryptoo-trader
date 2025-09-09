"""
Trading-related models for positions, trades, and orders
"""

from datetime import datetime
from typing import List, Optional, Dict, Any
from uuid import uuid4
from pydantic import BaseModel, Field, validator
from decimal import Decimal

from .enums import (
    TradeDirection, PositionStatus, OrderType, OrderStatus,
    SetupType, SignalStrength
)


class Order(BaseModel):
    """Individual order model"""
    id: str = Field(default_factory=lambda: str(uuid4()), description="Unique order ID")
    symbol: str = Field(description="Trading symbol")
    order_type: OrderType = Field(description="Type of order")
    direction: TradeDirection = Field(description="Long or short")
    quantity: Decimal = Field(description="Order quantity")
    price: Optional[Decimal] = Field(default=None, description="Order price (None for market orders)")
    stop_price: Optional[Decimal] = Field(default=None, description="Stop price for stop orders")
    status: OrderStatus = Field(default=OrderStatus.PENDING, description="Order status")
    
    created_at: datetime = Field(default_factory=datetime.utcnow, description="Order creation time")
    filled_at: Optional[datetime] = Field(default=None, description="Order fill time")
    cancelled_at: Optional[datetime] = Field(default=None, description="Order cancellation time")
    
    filled_quantity: Decimal = Field(default=Decimal('0'), description="Filled quantity")
    average_fill_price: Optional[Decimal] = Field(default=None, description="Average fill price")
    
    exchange_order_id: Optional[str] = Field(default=None, description="Exchange order ID")
    fees: Optional[Decimal] = Field(default=None, description="Trading fees")
    
    @validator('quantity', 'filled_quantity')
    def validate_positive_quantity(cls, v):
        if v < 0:
            raise ValueError('Quantity must be positive')
        return v
    
    @validator('price', 'stop_price')
    def validate_positive_price(cls, v):
        if v is not None and v <= 0:
            raise ValueError('Price must be positive')
        return v
    
    @property
    def is_filled(self) -> bool:
        """Check if order is completely filled"""
        return self.status == OrderStatus.FILLED
    
    @property
    def is_partially_filled(self) -> bool:
        """Check if order is partially filled"""
        return self.status == OrderStatus.PARTIALLY_FILLED
    
    @property
    def remaining_quantity(self) -> Decimal:
        """Calculate remaining quantity to fill"""
        return self.quantity - self.filled_quantity


class Position(BaseModel):
    """Trading position model"""
    id: str = Field(default_factory=lambda: str(uuid4()), description="Unique position ID")
    symbol: str = Field(description="Trading symbol")
    direction: TradeDirection = Field(description="Long or short position")
    
    entry_price: Decimal = Field(description="Average entry price")
    current_price: Decimal = Field(description="Current market price")
    quantity: Decimal = Field(description="Position size")
    
    stop_loss: Optional[Decimal] = Field(default=None, description="Stop loss price")
    take_profit_levels: List[Decimal] = Field(default_factory=list, description="Take profit levels")
    
    status: PositionStatus = Field(default=PositionStatus.OPEN, description="Position status")
    created_at: datetime = Field(default_factory=datetime.utcnow, description="Position creation time")
    closed_at: Optional[datetime] = Field(default=None, description="Position close time")
    
    entry_orders: List[str] = Field(default_factory=list, description="Entry order IDs")
    exit_orders: List[str] = Field(default_factory=list, description="Exit order IDs")
    
    metadata: Optional[Dict[str, Any]] = Field(default=None, description="Additional position metadata")
    
    @validator('entry_price', 'current_price', 'quantity')
    def validate_positive_values(cls, v):
        if v <= 0:
            raise ValueError('Price and quantity values must be positive')
        return v
    
    @validator('stop_loss')
    def validate_stop_loss(cls, v, values):
        if v is not None and 'entry_price' in values and 'direction' in values:
            entry_price = values['entry_price']
            direction = values['direction']
            
            if direction == TradeDirection.LONG and v >= entry_price:
                raise ValueError('Stop loss for long position must be below entry price')
            elif direction == TradeDirection.SHORT and v <= entry_price:
                raise ValueError('Stop loss for short position must be above entry price')
        return v
    
    @property
    def unrealized_pnl(self) -> Decimal:
        """Calculate unrealized P&L"""
        if self.direction == TradeDirection.LONG:
            return (self.current_price - self.entry_price) * self.quantity
        else:
            return (self.entry_price - self.current_price) * self.quantity
    
    @property
    def unrealized_pnl_percentage(self) -> Decimal:
        """Calculate unrealized P&L as percentage"""
        if self.direction == TradeDirection.LONG:
            return ((self.current_price - self.entry_price) / self.entry_price) * 100
        else:
            return ((self.entry_price - self.current_price) / self.entry_price) * 100
    
    @property
    def position_value(self) -> Decimal:
        """Calculate current position value"""
        return self.current_price * self.quantity
    
    @property
    def is_profitable(self) -> bool:
        """Check if position is currently profitable"""
        return self.unrealized_pnl > 0


class Trade(BaseModel):
    """Completed trade model"""
    id: str = Field(default_factory=lambda: str(uuid4()), description="Unique trade ID")
    position_id: str = Field(description="Associated position ID")
    symbol: str = Field(description="Trading symbol")
    direction: TradeDirection = Field(description="Long or short trade")
    
    entry_price: Decimal = Field(description="Entry price")
    exit_price: Decimal = Field(description="Exit price")
    quantity: Decimal = Field(description="Trade quantity")
    
    entry_time: datetime = Field(description="Trade entry time")
    exit_time: datetime = Field(description="Trade exit time")
    
    realized_pnl: Decimal = Field(description="Realized profit/loss")
    fees: Decimal = Field(default=Decimal('0'), description="Total trading fees")
    
    exit_reason: str = Field(description="Reason for trade exit")
    setup_type: Optional[SetupType] = Field(default=None, description="Technical setup that triggered trade")
    
    metadata: Optional[Dict[str, Any]] = Field(default=None, description="Additional trade metadata")
    
    @validator('entry_price', 'exit_price', 'quantity')
    def validate_positive_values(cls, v):
        if v <= 0:
            raise ValueError('Price and quantity values must be positive')
        return v
    
    @validator('exit_time')
    def validate_exit_after_entry(cls, v, values):
        if 'entry_time' in values and v <= values['entry_time']:
            raise ValueError('Exit time must be after entry time')
        return v
    
    @property
    def duration_minutes(self) -> int:
        """Calculate trade duration in minutes"""
        return int((self.exit_time - self.entry_time).total_seconds() / 60)
    
    @property
    def pnl_percentage(self) -> Decimal:
        """Calculate P&L as percentage"""
        if self.direction == TradeDirection.LONG:
            return ((self.exit_price - self.entry_price) / self.entry_price) * 100
        else:
            return ((self.entry_price - self.exit_price) / self.entry_price) * 100
    
    @property
    def is_profitable(self) -> bool:
        """Check if trade was profitable"""
        return self.realized_pnl > 0


class Portfolio(BaseModel):
    """Portfolio model with positions and performance metrics"""
    total_value: Decimal = Field(description="Total portfolio value")
    available_balance: Decimal = Field(description="Available cash balance")
    positions: List[Position] = Field(default_factory=list, description="Open positions")
    
    daily_pnl: Decimal = Field(default=Decimal('0'), description="Daily P&L")
    total_pnl: Decimal = Field(default=Decimal('0'), description="Total realized P&L")
    max_drawdown: Decimal = Field(default=Decimal('0'), description="Maximum drawdown")
    
    last_updated: datetime = Field(default_factory=datetime.utcnow, description="Last update time")
    
    @validator('total_value', 'available_balance')
    def validate_positive_values(cls, v):
        if v < 0:
            raise ValueError('Portfolio values cannot be negative')
        return v
    
    @property
    def total_unrealized_pnl(self) -> Decimal:
        """Calculate total unrealized P&L from all positions"""
        return sum(position.unrealized_pnl for position in self.positions)
    
    @property
    def total_position_value(self) -> Decimal:
        """Calculate total value of all positions"""
        return sum(position.position_value for position in self.positions)
    
    @property
    def equity(self) -> Decimal:
        """Calculate total equity (balance + unrealized P&L)"""
        return self.available_balance + self.total_unrealized_pnl
    
    @property
    def margin_used(self) -> Decimal:
        """Calculate margin used by positions"""
        return self.total_position_value
    
    @property
    def margin_available(self) -> Decimal:
        """Calculate available margin"""
        return self.total_value - self.margin_used
    
    @property
    def open_positions_count(self) -> int:
        """Count of open positions"""
        return len([p for p in self.positions if p.status == PositionStatus.OPEN])


class TradingSignal(BaseModel):
    """Trading signal model"""
    id: str = Field(default_factory=lambda: str(uuid4()), description="Unique signal ID")
    symbol: str = Field(description="Trading symbol")
    direction: TradeDirection = Field(description="Signal direction")
    
    confidence: Decimal = Field(description="Signal confidence (0-1)")
    strength: SignalStrength = Field(description="Signal strength")
    
    technical_score: Decimal = Field(description="Technical analysis score")
    sentiment_score: Decimal = Field(description="Sentiment analysis score")
    event_impact: Decimal = Field(default=Decimal('0'), description="Event impact score")
    
    setup_type: SetupType = Field(description="Technical setup type")
    entry_price: Optional[Decimal] = Field(default=None, description="Suggested entry price")
    stop_loss: Optional[Decimal] = Field(default=None, description="Suggested stop loss")
    take_profit_levels: List[Decimal] = Field(default_factory=list, description="Take profit levels")
    
    timestamp: datetime = Field(default_factory=datetime.utcnow, description="Signal generation time")
    expires_at: Optional[datetime] = Field(default=None, description="Signal expiration time")
    
    metadata: Optional[Dict[str, Any]] = Field(default=None, description="Additional signal data")
    
    @validator('confidence', 'technical_score', 'sentiment_score', 'event_impact')
    def validate_score_range(cls, v):
        if not 0 <= v <= 1:
            raise ValueError('Scores must be between 0 and 1')
        return v
    
    @property
    def is_expired(self) -> bool:
        """Check if signal has expired"""
        return self.expires_at is not None and datetime.utcnow() > self.expires_at
    
    @property
    def is_strong_signal(self) -> bool:
        """Check if this is a strong signal"""
        return self.strength in [SignalStrength.STRONG, SignalStrength.VERY_STRONG]