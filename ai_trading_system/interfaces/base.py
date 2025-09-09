"""
Base interfaces and abstract classes for the AI trading system
"""

from abc import ABC, abstractmethod
from typing import AsyncGenerator, List, Optional, Dict, Any
from datetime import datetime
from pydantic import BaseModel


class DataCollector(ABC):
    """Abstract base class for data collection services"""
    
    @abstractmethod
    async def collect(self) -> AsyncGenerator[Any, None]:
        """Collect data from the source"""
        pass
    
    @abstractmethod
    async def health_check(self) -> bool:
        """Check if the data source is healthy and accessible"""
        pass
    
    @abstractmethod
    async def start(self) -> None:
        """Start the data collection process"""
        pass
    
    @abstractmethod
    async def stop(self) -> None:
        """Stop the data collection process"""
        pass


class Analyzer(ABC):
    """Abstract base class for analysis components"""
    
    @abstractmethod
    async def analyze(self, data: Any) -> Any:
        """Analyze the provided data and return results"""
        pass
    
    @abstractmethod
    async def initialize(self) -> None:
        """Initialize the analyzer with required resources"""
        pass


class RiskManager(ABC):
    """Abstract base class for risk management components"""
    
    @abstractmethod
    async def validate_signal(self, signal: Any) -> bool:
        """Validate if a trading signal meets risk criteria"""
        pass
    
    @abstractmethod
    async def calculate_position_size(self, signal: Any, portfolio_value: float) -> float:
        """Calculate appropriate position size based on risk parameters"""
        pass


class TradeExecutor(ABC):
    """Abstract base class for trade execution components"""
    
    @abstractmethod
    async def execute_trade(self, trade_params: Any) -> Any:
        """Execute a trade with the given parameters"""
        pass
    
    @abstractmethod
    async def cancel_order(self, order_id: str) -> bool:
        """Cancel an existing order"""
        pass
    
    @abstractmethod
    async def get_order_status(self, order_id: str) -> Any:
        """Get the status of an order"""
        pass


class EventHandler(ABC):
    """Abstract base class for event handling"""
    
    @abstractmethod
    async def handle_event(self, event: Any) -> None:
        """Handle an incoming event"""
        pass
    
    @abstractmethod
    async def subscribe(self, event_type: str) -> None:
        """Subscribe to a specific event type"""
        pass


class Logger(ABC):
    """Abstract base class for logging components"""
    
    @abstractmethod
    async def log_trade(self, trade_data: Dict[str, Any]) -> None:
        """Log trade information"""
        pass
    
    @abstractmethod
    async def log_error(self, error: Exception, context: Dict[str, Any]) -> None:
        """Log error information with context"""
        pass
    
    @abstractmethod
    async def log_performance(self, metrics: Dict[str, Any]) -> None:
        """Log performance metrics"""
        pass