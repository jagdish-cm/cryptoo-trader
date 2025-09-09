"""
Logging utilities and structured logging setup
"""

import json
import logging
import sys
from datetime import datetime
from typing import Dict, Any, Optional
from uuid import uuid4

from ai_trading_system.config.settings import LogLevel


class StructuredLogger:
    """Structured logger with correlation IDs and JSON formatting"""
    
    def __init__(self, name: str, level: LogLevel = LogLevel.INFO, format_type: str = "json"):
        self.logger = logging.getLogger(name)
        self.logger.setLevel(getattr(logging, level.value))
        self.format_type = format_type
        self.correlation_id = str(uuid4())
        
        # Remove existing handlers to avoid duplicates
        self.logger.handlers.clear()
        
        # Create handler
        handler = logging.StreamHandler(sys.stdout)
        
        if format_type == "json":
            handler.setFormatter(JsonFormatter())
        else:
            handler.setFormatter(ReadableFormatter())
        
        self.logger.addHandler(handler)
    
    def _log_with_context(self, level: str, message: str, extra: Optional[Dict[str, Any]] = None):
        """Log message with structured context"""
        if self.format_type == "json":
            context = {
                "correlation_id": self.correlation_id,
                "timestamp": datetime.utcnow().isoformat(),
                "level": level,
                "message": message
            }
            
            if extra:
                # Mask sensitive data
                masked_extra = self._mask_sensitive_data(extra)
                context.update(masked_extra)
            
            getattr(self.logger, level.lower())(json.dumps(context))
        else:
            # Text format - create readable message
            if extra:
                masked_extra = self._mask_sensitive_data(extra)
                extra_str = " | ".join([f"{k}={v}" for k, v in masked_extra.items()])
                formatted_message = f"{message} | {extra_str}"
            else:
                formatted_message = message
            
            getattr(self.logger, level.lower())(formatted_message)
    
    def _mask_sensitive_data(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Mask sensitive information in log data"""
        sensitive_keys = ['api_key', 'api_secret', 'password', 'token', 'private_key']
        masked_data = {}
        
        for key, value in data.items():
            if any(sensitive in key.lower() for sensitive in sensitive_keys):
                masked_data[key] = "***MASKED***"
            elif isinstance(value, dict):
                masked_data[key] = self._mask_sensitive_data(value)
            else:
                masked_data[key] = value
        
        return masked_data
    
    def debug(self, message: str, extra: Optional[Dict[str, Any]] = None):
        self._log_with_context("DEBUG", message, extra)
    
    def info(self, message: str, extra: Optional[Dict[str, Any]] = None):
        self._log_with_context("INFO", message, extra)
    
    def warning(self, message: str, extra: Optional[Dict[str, Any]] = None):
        self._log_with_context("WARNING", message, extra)
    
    def error(self, message: str, extra: Optional[Dict[str, Any]] = None):
        self._log_with_context("ERROR", message, extra)
    
    def critical(self, message: str, extra: Optional[Dict[str, Any]] = None):
        self._log_with_context("CRITICAL", message, extra)
    
    def set_correlation_id(self, correlation_id: str):
        """Set correlation ID for request tracking"""
        self.correlation_id = correlation_id


class ReadableFormatter(logging.Formatter):
    """Human-readable formatter for better log readability"""
    
    def __init__(self):
        super().__init__()
        # Color codes for different log levels
        self.colors = {
            'DEBUG': '\033[36m',    # Cyan
            'INFO': '\033[32m',     # Green
            'WARNING': '\033[33m',  # Yellow
            'ERROR': '\033[31m',    # Red
            'CRITICAL': '\033[35m', # Magenta
            'RESET': '\033[0m'      # Reset
        }
        
        # Emoji indicators for log levels
        self.indicators = {
            'DEBUG': '🔍',
            'INFO': '✅',
            'WARNING': '⚠️',
            'ERROR': '❌',
            'CRITICAL': '🚨'
        }
    
    def format(self, record):
        # Get color and indicator for log level
        color = self.colors.get(record.levelname, '')
        reset = self.colors['RESET']
        indicator = self.indicators.get(record.levelname, '📝')
        
        # Format timestamp
        timestamp = datetime.fromtimestamp(record.created).strftime('%H:%M:%S')
        
        # Create readable format
        formatted = f"{color}{indicator} [{timestamp}] {record.name}: {record.getMessage()}{reset}"
        
        return formatted


class JsonFormatter(logging.Formatter):
    """Custom JSON formatter for structured logging"""
    
    def format(self, record):
        log_entry = {
            "timestamp": datetime.utcnow().isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
            "module": record.module,
            "function": record.funcName,
            "line": record.lineno
        }
        
        if hasattr(record, 'correlation_id'):
            log_entry["correlation_id"] = record.correlation_id
        
        return json.dumps(log_entry)


def get_logger(name: str, level: LogLevel = LogLevel.INFO, format_type: Optional[str] = None) -> StructuredLogger:
    """Get a structured logger instance"""
    # Auto-detect format from environment if not specified
    if format_type is None:
        import os
        format_type = os.getenv("TRADING_LOG_FORMAT", "json")
    
    return StructuredLogger(name, level, format_type)