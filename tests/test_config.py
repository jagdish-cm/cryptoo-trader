"""
Tests for configuration management
"""

import os
import json
import tempfile
import pytest
from pathlib import Path
from pydantic import ValidationError
from ai_trading_system.config.settings import (
    TradingConfig, 
    ExchangeConfig, 
    LLMConfig, 
    SystemConfig,
    ConfigLoader,
    load_config,
    save_config,
    validate_config
)


class TestTradingConfig:
    """Test trading configuration validation"""
    
    def test_default_values(self):
        config = TradingConfig()
        assert config.max_position_risk == 0.01
        assert config.max_portfolio_exposure == 0.20
        assert config.max_sector_exposure == 0.40
        assert config.volatility_threshold == 0.05
        assert config.timeframe == "4h"
        assert config.min_signal_confidence == 0.7
        assert config.max_open_positions == 5
        assert config.rsi_oversold == 30
        assert config.rsi_overbought == 70
    
    def test_invalid_percentage_values(self):
        with pytest.raises(ValidationError):
            TradingConfig(max_position_risk=1.5)  # > 1
        
        with pytest.raises(ValidationError):
            TradingConfig(max_position_risk=0)  # = 0
        
        with pytest.raises(ValidationError):
            TradingConfig(max_position_risk=-0.1)  # < 0
    
    def test_invalid_rsi_thresholds(self):
        with pytest.raises(ValidationError):
            TradingConfig(rsi_oversold=150)  # > 100
        
        with pytest.raises(ValidationError):
            TradingConfig(rsi_overbought=-10)  # < 0
    
    def test_invalid_max_positions(self):
        with pytest.raises(ValidationError):
            TradingConfig(max_open_positions=0)  # < 1


class TestExchangeConfig:
    """Test exchange configuration validation"""
    
    def test_valid_config(self):
        config = ExchangeConfig(
            name="binance",
            api_key="test_api_key_123456789",
            api_secret="test_api_secret_123456789"
        )
        assert config.name == "binance"
        assert config.sandbox is True  # default
    
    def test_invalid_credentials(self):
        with pytest.raises(ValidationError):
            ExchangeConfig(
                name="binance",
                api_key="short",  # too short
                api_secret="test_api_secret_123456789"
            )


class TestLLMConfig:
    """Test LLM configuration validation"""
    
    def test_default_values(self):
        config = LLMConfig(api_key="test_api_key_123456789")
        assert config.model_name == "gpt-4"
        assert config.max_tokens == 1000
        assert config.temperature == 0.1
    
    def test_invalid_temperature(self):
        with pytest.raises(ValidationError):
            LLMConfig(
                api_key="test_api_key_123456789",
                temperature=3.0  # > 2
            )


class TestSystemConfig:
    """Test system configuration"""
    
    def test_load_config_defaults(self):
        config = load_config()
        assert config.log_level.value == "INFO"
        assert config.max_workers == 4
        assert config.health_check_interval == 30

class
 TestLLMConfigEnhanced:
    """Test enhanced LLM configuration validation"""
    
    def test_enhanced_default_values(self):
        config = LLMConfig(api_key="test_api_key_123456789")
        assert config.timeout == 30
        assert config.max_retries == 3
        assert config.requests_per_minute == 60
        assert config.cache_ttl == 300
    
    def test_invalid_max_tokens(self):
        with pytest.raises(ValidationError):
            LLMConfig(
                api_key="test_api_key_123456789",
                max_tokens=5000  # > 4000
            )
        
        with pytest.raises(ValidationError):
            LLMConfig(
                api_key="test_api_key_123456789",
                max_tokens=0  # < 1
            )


class TestConfigLoader:
    """Test configuration loading functionality"""
    
    def test_load_from_json_file(self):
        config_data = {
            "log_level": "DEBUG",
            "trading": {
                "max_position_risk": 0.02,
                "watchlist": ["BTC/USDT", "ETH/USDT", "ADA/USDT"]
            }
        }
        
        with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as f:
            json.dump(config_data, f)
            temp_path = f.name
        
        try:
            loaded_config = ConfigLoader.load_from_file(temp_path)
            assert loaded_config["log_level"] == "DEBUG"
            assert loaded_config["trading"]["max_position_risk"] == 0.02
            assert len(loaded_config["trading"]["watchlist"]) == 3
        finally:
            os.unlink(temp_path)
    
    def test_load_from_nonexistent_file(self):
        with pytest.raises(FileNotFoundError):
            ConfigLoader.load_from_file("nonexistent_config.json")
    
    def test_load_from_env(self):
        # Set environment variables
        os.environ["TRADING_LOG_LEVEL"] = "DEBUG"
        os.environ["TRADING_MAX_POSITION_RISK"] = "0.02"
        os.environ["EXCHANGE_API_KEY"] = "test_key_123456789"
        os.environ["EXCHANGE_NAME"] = "binance"
        
        try:
            env_config = ConfigLoader.load_from_env()
            assert env_config["log_level"] == "DEBUG"
            assert env_config["trading"]["max_position_risk"] == 0.02
            assert env_config["exchange"]["name"] == "binance"
        finally:
            # Clean up environment variables
            for key in ["TRADING_LOG_LEVEL", "TRADING_MAX_POSITION_RISK", "EXCHANGE_API_KEY", "EXCHANGE_NAME"]:
                os.environ.pop(key, None)
    
    def test_merge_configs(self):
        config1 = {
            "log_level": "INFO",
            "trading": {"max_position_risk": 0.01}
        }
        config2 = {
            "log_level": "DEBUG",  # This should override config1
            "trading": {"watchlist": ["BTC/USDT"]},  # This should merge with config1
            "exchange": {"name": "binance"}  # This is new
        }
        
        merged = ConfigLoader.merge_configs(config1, config2)
        
        assert merged["log_level"] == "DEBUG"  # Overridden
        assert merged["trading"]["max_position_risk"] == 0.01  # From config1
        assert merged["trading"]["watchlist"] == ["BTC/USDT"]  # From config2
        assert merged["exchange"]["name"] == "binance"  # New from config2


class TestConfigFileOperations:
    """Test configuration file save/load operations"""
    
    def test_save_and_load_config(self):
        # Create a test configuration
        config = SystemConfig(
            log_level="DEBUG",
            trading=TradingConfig(
                max_position_risk=0.02,
                watchlist=["BTC/USDT", "ETH/USDT"]
            )
        )
        
        with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as f:
            temp_path = f.name
        
        try:
            # Save configuration
            save_config(config, temp_path, format="json")
            
            # Load it back
            loaded_config = load_config(temp_path)
            
            assert loaded_config.log_level.value == "DEBUG"
            assert loaded_config.trading.max_position_risk == 0.02
            assert len(loaded_config.trading.watchlist) == 2
        finally:
            os.unlink(temp_path)
    
    def test_load_config_with_file_and_env(self):
        # Create config file
        file_config = {
            "log_level": "DEBUG",
            "trading": {"max_position_risk": 0.02}
        }
        
        with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as f:
            json.dump(file_config, f)
            temp_path = f.name
        
        # Set environment variable that should override file
        os.environ["TRADING_LOG_LEVEL"] = "ERROR"
        os.environ["TRADING_MAX_WORKERS"] = "8"
        
        try:
            config = load_config(temp_path)
            
            # Environment should override file
            assert config.log_level.value == "ERROR"
            assert config.max_workers == 8
            
            # File values should still be present where not overridden
            assert config.trading.max_position_risk == 0.02
        finally:
            os.unlink(temp_path)
            os.environ.pop("TRADING_LOG_LEVEL", None)
            os.environ.pop("TRADING_MAX_WORKERS", None)


class TestConfigValidation:
    """Test configuration validation"""
    
    def test_validate_complete_config(self):
        config = SystemConfig(
            exchange=ExchangeConfig(
                name="binance",
                api_key="test_key_123456789",
                api_secret="test_secret_123456789"
            ),
            llm=LLMConfig(api_key="test_llm_key_123456789"),
            database=DatabaseConfig(
                username="testuser",
                password="testpass"
            )
        )
        
        warnings = validate_config(config)
        assert len(warnings) == 0  # Should have no warnings
    
    def test_validate_incomplete_config(self):
        config = SystemConfig()  # Default config with no services
        
        warnings = validate_config(config)
        
        # Should have warnings for missing services
        warning_messages = " ".join(warnings)
        assert "Exchange configuration is missing" in warning_messages
        assert "LLM configuration is missing" in warning_messages
        assert "Database configuration is missing" in warning_messages
    
    def test_validate_risky_config(self):
        config = SystemConfig(
            trading=TradingConfig(
                max_position_risk=0.1,  # 10% - very high
                watchlist=[],  # Empty watchlist
                rsi_oversold=80,  # Invalid: oversold > overbought
                rsi_overbought=70
            )
        )
        
        warnings = validate_config(config)
        
        warning_messages = " ".join(warnings)
        assert "Position risk is very high" in warning_messages
        assert "Watchlist is empty" in warning_messages
        assert "RSI oversold threshold should be less than overbought" in warning_messages


class TestSystemConfigIntegration:
    """Test complete system configuration integration"""
    
    def test_full_config_loading_precedence(self):
        # Create a config file
        file_config = {
            "log_level": "DEBUG",
            "max_workers": 2,
            "trading": {
                "max_position_risk": 0.02,
                "watchlist": ["BTC/USDT"]
            }
        }
        
        with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as f:
            json.dump(file_config, f)
            temp_path = f.name
        
        # Set environment variables (should override file)
        os.environ["TRADING_LOG_LEVEL"] = "ERROR"
        os.environ["TRADING_MAX_POSITION_RISK"] = "0.03"
        
        try:
            config = load_config(temp_path)
            
            # Environment should override file
            assert config.log_level.value == "ERROR"
            assert config.trading.max_position_risk == 0.03
            
            # File should provide values not in environment
            assert config.max_workers == 2
            assert config.trading.watchlist == ["BTC/USDT"]
            
            # Defaults should fill in missing values
            assert config.health_check_interval == 30  # Default value
        finally:
            os.unlink(temp_path)
            os.environ.pop("TRADING_LOG_LEVEL", None)
            os.environ.pop("TRADING_MAX_POSITION_RISK", None)