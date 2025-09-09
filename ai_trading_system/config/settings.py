"""
Configuration management using Pydantic models
"""

import os
import json
import yaml
from pathlib import Path
from typing import Optional, List, Dict, Any, Union
from pydantic import BaseModel, Field, validator, root_validator
from enum import Enum
from dotenv import load_dotenv


class LogLevel(str, Enum):
    DEBUG = "DEBUG"
    INFO = "INFO"
    WARNING = "WARNING"
    ERROR = "ERROR"
    CRITICAL = "CRITICAL"


class TradingConfig(BaseModel):
    """Trading-specific configuration parameters"""
    max_position_risk: float = Field(default=0.01, description="Maximum risk per trade (1%)")
    max_portfolio_exposure: float = Field(default=0.20, description="Maximum exposure per asset (20%)")
    max_sector_exposure: float = Field(default=0.40, description="Maximum exposure per sector (40%)")
    volatility_threshold: float = Field(default=0.05, description="Maximum volatility threshold (5%)")
    watchlist: List[str] = Field(default=["BTC/USDT", "ETH/USDT"], description="Assets to monitor")
    timeframe: str = Field(default="4h", description="Primary analysis timeframe")
    
    # Additional trading parameters
    min_signal_confidence: float = Field(default=0.7, description="Minimum signal confidence to trade")
    max_open_positions: int = Field(default=5, description="Maximum number of open positions")
    position_timeout_hours: int = Field(default=24, description="Maximum hours to hold a position")
    emergency_exit_enabled: bool = Field(default=True, description="Enable emergency exits on critical events")
    
    # Technical analysis settings
    rsi_oversold: int = Field(default=30, description="RSI oversold threshold")
    rsi_overbought: int = Field(default=70, description="RSI overbought threshold")
    sma_periods: List[int] = Field(default=[20, 50, 200], description="SMA periods to calculate")
    
    @validator('max_position_risk', 'max_portfolio_exposure', 'max_sector_exposure', 'volatility_threshold', 'min_signal_confidence')
    def validate_percentages(cls, v):
        if not 0 < v <= 1:
            raise ValueError('Percentage values must be between 0 and 1')
        return v
    
    @validator('rsi_oversold', 'rsi_overbought')
    def validate_rsi_thresholds(cls, v):
        if not 0 <= v <= 100:
            raise ValueError('RSI thresholds must be between 0 and 100')
        return v
    
    @validator('max_open_positions')
    def validate_max_positions(cls, v):
        if v < 1:
            raise ValueError('Maximum open positions must be at least 1')
        return v


class ExchangeConfig(BaseModel):
    """Exchange API configuration"""
    name: str = Field(description="Exchange name")
    api_key: str = Field(description="API key")
    api_secret: str = Field(description="API secret")
    sandbox: bool = Field(default=True, description="Use sandbox environment")
    rate_limit: int = Field(default=10, description="Requests per second limit")
    
    @validator('api_key', 'api_secret')
    def validate_credentials(cls, v):
        if not v or len(v) < 10:
            raise ValueError('API credentials must be provided and valid')
        return v


class LLMConfig(BaseModel):
    """LLM service configuration"""
    provider: str = Field(default="auto", description="LLM provider: 'openai', 'ollama', or 'auto'")
    model_name: str = Field(default="gpt-4", description="LLM model to use")
    api_key: Optional[str] = Field(default=None, description="LLM API key (required for OpenAI)")
    max_tokens: int = Field(default=1000, description="Maximum tokens per request")
    temperature: float = Field(default=0.1, description="Model temperature")
    timeout: int = Field(default=30, description="Request timeout in seconds")
    max_retries: int = Field(default=3, description="Maximum retry attempts")
    
    # Ollama-specific settings
    ollama_base_url: str = Field(default="http://localhost:11434", description="Ollama server URL")
    ollama_model: str = Field(default="llama3:8b", description="Ollama model name")
    
    # Prompt templates
    sentiment_prompt_template: str = Field(
        default="Analyze the sentiment for {symbol} based on recent news and social media. Respond with POSITIVE, NEGATIVE, or NEUTRAL.",
        description="Template for sentiment analysis prompts"
    )
    event_detection_prompt_template: str = Field(
        default="Identify any critical events for {symbol} in the last 24 hours. Focus on hacks, regulations, major unlocks, or other market-moving events.",
        description="Template for event detection prompts"
    )
    
    # Rate limiting
    requests_per_minute: int = Field(default=60, description="Maximum requests per minute")
    cache_ttl: int = Field(default=300, description="Cache TTL for LLM responses in seconds")
    
    @validator('temperature')
    def validate_temperature(cls, v):
        if not 0 <= v <= 2:
            raise ValueError('Temperature must be between 0 and 2')
        return v
    
    @validator('max_tokens')
    def validate_max_tokens(cls, v):
        if v < 1 or v > 4000:
            raise ValueError('Max tokens must be between 1 and 4000')
        return v


class DatabaseConfig(BaseModel):
    """Database configuration"""
    host: str = Field(default="localhost", description="Database host")
    port: int = Field(default=5432, description="Database port")
    database: str = Field(default="trading_system", description="Database name")
    username: str = Field(description="Database username")
    password: str = Field(description="Database password")
    
    @property
    def connection_string(self) -> str:
        return f"postgresql://{self.username}:{self.password}@{self.host}:{self.port}/{self.database}"


class RedisConfig(BaseModel):
    """Redis cache configuration"""
    host: str = Field(default="localhost", description="Redis host")
    port: int = Field(default=6379, description="Redis port")
    db: int = Field(default=0, description="Redis database number")
    password: Optional[str] = Field(default=None, description="Redis password")
    ttl: int = Field(default=300, description="Default TTL in seconds")


class SystemConfig(BaseModel):
    """System-wide configuration"""
    log_level: LogLevel = Field(default=LogLevel.INFO, description="Logging level")
    log_format: str = Field(default="json", description="Log format (json or text)")
    max_workers: int = Field(default=4, description="Maximum worker threads")
    health_check_interval: int = Field(default=30, description="Health check interval in seconds")
    
    # Configuration file paths
    trading: TradingConfig = Field(default_factory=TradingConfig)
    exchange: Optional[ExchangeConfig] = None
    llm: Optional[LLMConfig] = None
    database: Optional[DatabaseConfig] = None
    redis: RedisConfig = Field(default_factory=RedisConfig)
    
    class Config:
        env_prefix = "TRADING_"
        env_nested_delimiter = "__"


class ConfigLoader:
    """Configuration loader with support for multiple file formats"""
    
    @staticmethod
    def load_from_file(file_path: Union[str, Path]) -> Dict[str, Any]:
        """Load configuration from JSON or YAML file"""
        file_path = Path(file_path)
        
        if not file_path.exists():
            raise FileNotFoundError(f"Configuration file not found: {file_path}")
        
        with open(file_path, 'r') as f:
            if file_path.suffix.lower() in ['.yaml', '.yml']:
                try:
                    import yaml
                    return yaml.safe_load(f)
                except ImportError:
                    raise ImportError("PyYAML is required to load YAML configuration files")
            elif file_path.suffix.lower() == '.json':
                return json.load(f)
            else:
                raise ValueError(f"Unsupported configuration file format: {file_path.suffix}")
    
    @staticmethod
    def load_from_env() -> Dict[str, Any]:
        """Load configuration from environment variables"""
        config = {}
        
        # System config
        if os.getenv("TRADING_LOG_LEVEL"):
            config["log_level"] = os.getenv("TRADING_LOG_LEVEL")
        if os.getenv("TRADING_MAX_WORKERS"):
            config["max_workers"] = int(os.getenv("TRADING_MAX_WORKERS"))
        
        # Trading config
        trading_config = {}
        if os.getenv("TRADING_MAX_POSITION_RISK"):
            trading_config["max_position_risk"] = float(os.getenv("TRADING_MAX_POSITION_RISK"))
        if os.getenv("TRADING_WATCHLIST"):
            trading_config["watchlist"] = os.getenv("TRADING_WATCHLIST").split(",")
        if trading_config:
            config["trading"] = trading_config
        
        # Exchange config
        if os.getenv("EXCHANGE_API_KEY"):
            config["exchange"] = {
                "name": os.getenv("EXCHANGE_NAME", "binance"),
                "api_key": os.getenv("EXCHANGE_API_KEY"),
                "api_secret": os.getenv("EXCHANGE_API_SECRET", ""),
                "sandbox": os.getenv("EXCHANGE_SANDBOX", "true").lower() == "true"
            }
        
        # LLM config
        llm_config = {}
        if os.getenv("LLM_PROVIDER"):
            llm_config["provider"] = os.getenv("LLM_PROVIDER")
        if os.getenv("LLM_API_KEY"):
            llm_config["api_key"] = os.getenv("LLM_API_KEY")
        if os.getenv("LLM_MODEL_NAME"):
            llm_config["model_name"] = os.getenv("LLM_MODEL_NAME")
        if os.getenv("OLLAMA_BASE_URL"):
            llm_config["ollama_base_url"] = os.getenv("OLLAMA_BASE_URL")
        if os.getenv("OLLAMA_MODEL"):
            llm_config["ollama_model"] = os.getenv("OLLAMA_MODEL")
        
        # Auto-detect provider if not specified
        if not llm_config.get("provider"):
            if llm_config.get("api_key"):
                llm_config["provider"] = "openai"
            else:
                llm_config["provider"] = "ollama"
        
        if llm_config:
            config["llm"] = llm_config
        
        # Database config
        if os.getenv("DB_USERNAME"):
            config["database"] = {
                "username": os.getenv("DB_USERNAME"),
                "password": os.getenv("DB_PASSWORD", ""),
                "host": os.getenv("DB_HOST", "localhost"),
                "port": int(os.getenv("DB_PORT", "5432")),
                "database": os.getenv("DB_NAME", "trading_system")
            }
        
        return config
    
    @staticmethod
    def merge_configs(*configs: Dict[str, Any]) -> Dict[str, Any]:
        """Merge multiple configuration dictionaries"""
        merged = {}
        for config in configs:
            for key, value in config.items():
                if key in merged and isinstance(merged[key], dict) and isinstance(value, dict):
                    merged[key] = {**merged[key], **value}
                else:
                    merged[key] = value
        return merged


def load_config(config_file: Optional[Union[str, Path]] = None) -> SystemConfig:
    """
    Load configuration from multiple sources with precedence:
    1. Configuration file (if provided)
    2. Environment variables
    3. Default values
    """
    # Load .env file automatically
    load_dotenv()
    
    configs = []
    
    # Load from file if provided
    if config_file:
        try:
            file_config = ConfigLoader.load_from_file(config_file)
            configs.append(file_config)
        except Exception as e:
            print(f"Warning: Could not load config file {config_file}: {e}")
    
    # Load from environment variables
    env_config = ConfigLoader.load_from_env()
    configs.append(env_config)
    
    # Merge all configurations
    if configs:
        merged_config = ConfigLoader.merge_configs(*configs)
        return SystemConfig(**merged_config)
    else:
        return SystemConfig()


def save_config(config: SystemConfig, file_path: Union[str, Path], format: str = "yaml") -> None:
    """Save configuration to file"""
    file_path = Path(file_path)
    config_dict = config.dict()
    
    # Remove None values and sensitive data
    def clean_dict(d):
        cleaned = {}
        for k, v in d.items():
            if v is None:
                continue
            if isinstance(v, dict):
                cleaned[k] = clean_dict(v)
            elif k in ['api_key', 'api_secret', 'password']:
                cleaned[k] = "***MASKED***"
            else:
                cleaned[k] = v
        return cleaned
    
    cleaned_config = clean_dict(config_dict)
    
    with open(file_path, 'w') as f:
        if format.lower() == "yaml":
            try:
                import yaml
                yaml.dump(cleaned_config, f, default_flow_style=False, indent=2)
            except ImportError:
                raise ImportError("PyYAML is required to save YAML configuration files")
        elif format.lower() == "json":
            json.dump(cleaned_config, f, indent=2, default=str)
        else:
            raise ValueError(f"Unsupported format: {format}")


def validate_config(config: SystemConfig) -> List[str]:
    """Validate configuration and return list of warnings/errors"""
    warnings = []
    
    # Check if essential services are configured
    if not config.exchange:
        warnings.append("Exchange configuration is missing - trading will not work")
    
    if not config.llm:
        warnings.append("LLM configuration is missing - sentiment analysis will not work")
    
    if not config.database:
        warnings.append("Database configuration is missing - data persistence will not work")
    
    # Check trading configuration
    if config.trading.max_position_risk > 0.05:  # 5%
        warnings.append("Position risk is very high (>5%) - consider reducing it")
    
    if len(config.trading.watchlist) == 0:
        warnings.append("Watchlist is empty - no assets will be monitored")
    
    # Check for conflicting settings
    if config.trading.rsi_oversold >= config.trading.rsi_overbought:
        warnings.append("RSI oversold threshold should be less than overbought threshold")
    
    return warnings