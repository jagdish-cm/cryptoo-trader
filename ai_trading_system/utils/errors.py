"""
Custom exceptions and error handling utilities
"""

from enum import Enum
from typing import Optional, Dict, Any
from datetime import datetime


class ErrorCategory(str, Enum):
    """Categories of errors in the trading system"""
    DATA_INGESTION = "data_ingestion"
    ANALYSIS = "analysis"
    EXECUTION = "execution"
    SYSTEM = "system"
    VALIDATION = "validation"
    NETWORK = "network"


class ErrorSeverity(str, Enum):
    """Severity levels for errors"""
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class TradingSystemError(Exception):
    """Base exception for all trading system errors"""
    
    def __init__(
        self,
        message: str,
        category: ErrorCategory,
        severity: ErrorSeverity = ErrorSeverity.MEDIUM,
        context: Optional[Dict[str, Any]] = None,
        original_error: Optional[Exception] = None
    ):
        super().__init__(message)
        self.message = message
        self.category = category
        self.severity = severity
        self.context = context or {}
        self.original_error = original_error
        self.timestamp = datetime.utcnow()
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert error to dictionary for logging"""
        return {
            "error_type": self.__class__.__name__,
            "message": self.message,
            "category": self.category.value,
            "severity": self.severity.value,
            "context": self.context,
            "timestamp": self.timestamp.isoformat(),
            "original_error": str(self.original_error) if self.original_error else None
        }


class DataIngestionError(TradingSystemError):
    """Errors related to data collection and ingestion"""
    
    def __init__(self, message: str, source: str, **kwargs):
        super().__init__(message, ErrorCategory.DATA_INGESTION, **kwargs)
        self.context["source"] = source


class AnalysisError(TradingSystemError):
    """Errors related to data analysis and signal generation"""
    
    def __init__(self, message: str, analyzer: str, **kwargs):
        super().__init__(message, ErrorCategory.ANALYSIS, **kwargs)
        self.context["analyzer"] = analyzer


class ExecutionError(TradingSystemError):
    """Errors related to trade execution"""
    
    def __init__(self, message: str, exchange: str, **kwargs):
        super().__init__(message, ErrorCategory.EXECUTION, **kwargs)
        self.context["exchange"] = exchange


class ValidationError(TradingSystemError):
    """Errors related to data or parameter validation"""
    
    def __init__(self, message: str, field: str, **kwargs):
        super().__init__(message, ErrorCategory.VALIDATION, **kwargs)
        self.context["field"] = field


class NetworkError(TradingSystemError):
    """Errors related to network connectivity"""
    
    def __init__(self, message: str, endpoint: str, **kwargs):
        super().__init__(message, ErrorCategory.NETWORK, **kwargs)
        self.context["endpoint"] = endpoint


class SystemError(TradingSystemError):
    """System-level errors"""
    
    def __init__(self, message: str, component: str, **kwargs):
        super().__init__(message, ErrorCategory.SYSTEM, **kwargs)
        self.context["component"] = component


class CircuitBreakerError(TradingSystemError):
    """Error when circuit breaker is open"""
    
    def __init__(self, service: str, **kwargs):
        message = f"Circuit breaker is open for service: {service}"
        super().__init__(message, ErrorCategory.SYSTEM, **kwargs)
        self.context["service"] = service


class RateLimitError(TradingSystemError):
    """Error when rate limit is exceeded"""
    
    def __init__(self, service: str, retry_after: Optional[int] = None, **kwargs):
        message = f"Rate limit exceeded for service: {service}"
        super().__init__(message, ErrorCategory.NETWORK, **kwargs)
        self.context["service"] = service
        if retry_after:
            self.context["retry_after"] = retry_after