"""
Tests for logging utilities
"""

import json
import pytest
from ai_trading_system.utils.logging import StructuredLogger, get_logger
from ai_trading_system.config.settings import LogLevel


class TestStructuredLogger:
    """Test structured logging functionality"""
    
    def test_logger_creation(self):
        logger = StructuredLogger("test_logger", LogLevel.DEBUG)
        assert logger.logger.name == "test_logger"
        assert logger.format_type == "json"
    
    def test_mask_sensitive_data(self):
        logger = StructuredLogger("test_logger")
        
        sensitive_data = {
            "api_key": "secret123",
            "password": "mypassword",
            "normal_field": "normal_value",
            "nested": {
                "api_secret": "secret456",
                "safe_field": "safe_value"
            }
        }
        
        masked = logger._mask_sensitive_data(sensitive_data)
        
        assert masked["api_key"] == "***MASKED***"
        assert masked["password"] == "***MASKED***"
        assert masked["normal_field"] == "normal_value"
        assert masked["nested"]["api_secret"] == "***MASKED***"
        assert masked["nested"]["safe_field"] == "safe_value"
    
    def test_correlation_id_setting(self):
        logger = StructuredLogger("test_logger")
        original_id = logger.correlation_id
        
        new_id = "test-correlation-123"
        logger.set_correlation_id(new_id)
        
        assert logger.correlation_id == new_id
        assert logger.correlation_id != original_id


def test_get_logger():
    """Test logger factory function"""
    logger = get_logger("test_factory")
    assert isinstance(logger, StructuredLogger)
    assert logger.logger.name == "test_factory"