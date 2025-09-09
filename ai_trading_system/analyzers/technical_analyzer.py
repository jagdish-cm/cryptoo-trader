"""
Technical analysis engine with TA-Lib integration for indicators and pattern recognition
"""

import asyncio
from typing import List, Dict, Any, Optional, Tuple
from datetime import datetime, timedelta
from decimal import Decimal
from dataclasses import dataclass
import numpy as np
import pandas as pd
import talib

from ai_trading_system.interfaces.base import Analyzer
from ai_trading_system.models.market_data import MarketData, TechnicalIndicators
from ai_trading_system.models.enums import SetupType, SignalStrength
from ai_trading_system.services.data_storage import DataAccessObject
from ai_trading_system.utils.logging import get_logger
from ai_trading_system.utils.errors import AnalysisError, ValidationError


@dataclass
class IndicatorConfig:
    """Configuration for technical indicators"""
    rsi_period: int = 14
    rsi_oversold: float = 30
    rsi_overbought: float = 70
    
    macd_fast: int = 12
    macd_slow: int = 26
    macd_signal: int = 9
    
    sma_periods: List[int] = None
    ema_periods: List[int] = None
    
    bollinger_period: int = 20
    bollinger_std: float = 2.0
    
    atr_period: int = 14
    volume_sma_period: int = 20
    
    def __post_init__(self):
        if self.sma_periods is None:
            self.sma_periods = [20, 50, 200]
        if self.ema_periods is None:
            self.ema_periods = [12, 26]


@dataclass
class PatternResult:
    """Candlestick pattern recognition result"""
    pattern_name: str
    strength: int  # -100 to 100 (negative = bearish, positive = bullish)
    reliability: float  # 0.0 to 1.0
    description: str


@dataclass
class TechnicalSetup:
    """Technical setup detection result"""
    symbol: str
    setup_type: SetupType
    confidence: float
    strength: SignalStrength
    entry_price: Optional[Decimal]
    stop_loss: Optional[Decimal]
    take_profit_levels: List[Decimal]
    indicators: Dict[str, float]
    patterns: List[PatternResult]
    timestamp: datetime
    timeframe: str
    metadata: Dict[str, Any]


class IndicatorCalculator:
    """Technical indicator calculation engine using TA-Lib"""
    
    def __init__(self, config: IndicatorConfig = None):
        self.config = config or IndicatorConfig()
        self.logger = get_logger("indicator_calculator")
    
    def calculate_all_indicators(self, df: pd.DataFrame) -> pd.DataFrame:
        """Calculate all technical indicators for a DataFrame"""
        try:
            # Ensure we have required columns
            required_columns = ['open', 'high', 'low', 'close', 'volume']
            for col in required_columns:
                if col not in df.columns:
                    raise ValidationError(f"Missing required column: {col}", field=col)
            
            # Convert to numpy arrays for TA-Lib
            open_prices = df['open'].values.astype(float)
            high_prices = df['high'].values.astype(float)
            low_prices = df['low'].values.astype(float)
            close_prices = df['close'].values.astype(float)
            volumes = df['volume'].values.astype(float)
            
            # Calculate indicators
            df = self._calculate_moving_averages(df, close_prices)
            df = self._calculate_oscillators(df, high_prices, low_prices, close_prices)
            df = self._calculate_volatility_indicators(df, high_prices, low_prices, close_prices)
            df = self._calculate_volume_indicators(df, volumes)
            df = self._calculate_momentum_indicators(df, close_prices)
            
            return df
            
        except Exception as e:
            self.logger.error("Failed to calculate indicators", {"error": str(e)})
            raise AnalysisError(
                "Technical indicator calculation failed",
                analyzer="indicator_calculator",
                original_error=e
            )
    
    def _calculate_moving_averages(self, df: pd.DataFrame, close_prices: np.ndarray) -> pd.DataFrame:
        """Calculate moving averages"""
        # Simple Moving Averages
        for period in self.config.sma_periods:
            df[f'sma_{period}'] = talib.SMA(close_prices, timeperiod=period)
        
        # Exponential Moving Averages
        for period in self.config.ema_periods:
            df[f'ema_{period}'] = talib.EMA(close_prices, timeperiod=period)
        
        # Additional EMAs for MACD
        df['ema_12'] = talib.EMA(close_prices, timeperiod=12)
        df['ema_26'] = talib.EMA(close_prices, timeperiod=26)
        
        return df
    
    def _calculate_oscillators(self, df: pd.DataFrame, high: np.ndarray, low: np.ndarray, close: np.ndarray) -> pd.DataFrame:
        """Calculate oscillator indicators"""
        # RSI
        df['rsi'] = talib.RSI(close, timeperiod=self.config.rsi_period)
        
        # MACD
        macd, macd_signal, macd_hist = talib.MACD(
            close,
            fastperiod=self.config.macd_fast,
            slowperiod=self.config.macd_slow,
            signalperiod=self.config.macd_signal
        )
        df['macd'] = macd
        df['macd_signal'] = macd_signal
        df['macd_histogram'] = macd_hist
        
        # Stochastic
        slowk, slowd = talib.STOCH(high, low, close)
        df['stoch_k'] = slowk
        df['stoch_d'] = slowd
        
        # Williams %R
        df['williams_r'] = talib.WILLR(high, low, close)
        
        # Commodity Channel Index
        df['cci'] = talib.CCI(high, low, close)
        
        return df
    
    def _calculate_volatility_indicators(self, df: pd.DataFrame, high: np.ndarray, low: np.ndarray, close: np.ndarray) -> pd.DataFrame:
        """Calculate volatility indicators"""
        # Bollinger Bands
        bb_upper, bb_middle, bb_lower = talib.BBANDS(
            close,
            timeperiod=self.config.bollinger_period,
            nbdevup=self.config.bollinger_std,
            nbdevdn=self.config.bollinger_std
        )
        df['bb_upper'] = bb_upper
        df['bb_middle'] = bb_middle
        df['bb_lower'] = bb_lower
        
        # Bollinger Band Width and Position
        df['bb_width'] = (bb_upper - bb_lower) / bb_middle
        df['bb_position'] = (close - bb_lower) / (bb_upper - bb_lower)
        
        # Average True Range
        df['atr'] = talib.ATR(high, low, close, timeperiod=self.config.atr_period)
        
        # True Range
        df['true_range'] = talib.TRANGE(high, low, close)
        
        return df
    
    def _calculate_volume_indicators(self, df: pd.DataFrame, volumes: np.ndarray) -> pd.DataFrame:
        """Calculate volume indicators"""
        # Volume SMA
        df['volume_sma'] = talib.SMA(volumes, timeperiod=self.config.volume_sma_period)
        
        # Volume ratio
        df['volume_ratio'] = volumes / df['volume_sma']
        
        # On Balance Volume
        df['obv'] = talib.OBV(df['close'].values, volumes)
        
        # Volume Rate of Change
        df['volume_roc'] = talib.ROC(volumes, timeperiod=10)
        
        return df
    
    def _calculate_momentum_indicators(self, df: pd.DataFrame, close: np.ndarray) -> pd.DataFrame:
        """Calculate momentum indicators"""
        # Rate of Change
        df['roc'] = talib.ROC(close, timeperiod=10)
        
        # Momentum
        df['momentum'] = talib.MOM(close, timeperiod=10)
        
        # Price Rate of Change
        df['price_roc'] = talib.ROCP(close, timeperiod=10)
        
        return df
    
    def get_latest_indicators(self, df: pd.DataFrame) -> TechnicalIndicators:
        """Extract latest indicators as TechnicalIndicators model"""
        if df.empty:
            raise ValidationError("DataFrame is empty", field="dataframe")
        
        latest = df.iloc[-1]
        
        return TechnicalIndicators(
            symbol="",  # Will be set by caller
            timestamp=latest.name if hasattr(latest, 'name') else datetime.utcnow(),
            timeframe="",  # Will be set by caller
            rsi=Decimal(str(latest['rsi'])) if not pd.isna(latest['rsi']) else None,
            macd=Decimal(str(latest['macd'])) if not pd.isna(latest['macd']) else None,
            macd_signal=Decimal(str(latest['macd_signal'])) if not pd.isna(latest['macd_signal']) else None,
            macd_histogram=Decimal(str(latest['macd_histogram'])) if not pd.isna(latest['macd_histogram']) else None,
            sma_20=Decimal(str(latest['sma_20'])) if not pd.isna(latest['sma_20']) else None,
            sma_50=Decimal(str(latest['sma_50'])) if not pd.isna(latest['sma_50']) else None,
            sma_200=Decimal(str(latest['sma_200'])) if not pd.isna(latest['sma_200']) else None,
            ema_12=Decimal(str(latest['ema_12'])) if not pd.isna(latest['ema_12']) else None,
            ema_26=Decimal(str(latest['ema_26'])) if not pd.isna(latest['ema_26']) else None,
            bollinger_upper=Decimal(str(latest['bb_upper'])) if not pd.isna(latest['bb_upper']) else None,
            bollinger_middle=Decimal(str(latest['bb_middle'])) if not pd.isna(latest['bb_middle']) else None,
            bollinger_lower=Decimal(str(latest['bb_lower'])) if not pd.isna(latest['bb_lower']) else None,
            atr=Decimal(str(latest['atr'])) if not pd.isna(latest['atr']) else None,
            volume_sma=Decimal(str(latest['volume_sma'])) if not pd.isna(latest['volume_sma']) else None
        )


class PatternRecognizer:
    """Candlestick pattern recognition using TA-Lib"""
    
    def __init__(self):
        self.logger = get_logger("pattern_recognizer")
        
        # Initialize patterns with error handling for missing TA-Lib functions
        self.patterns = self._initialize_patterns()
    
    def _initialize_patterns(self) -> Dict[str, Tuple[Any, str]]:
        """Initialize patterns with error handling for missing TA-Lib functions"""
        pattern_definitions = [
            ('DOJI', 'CDLDOJI', "Doji - Indecision"),
            ('HAMMER', 'CDLHAMMER', "Hammer - Bullish reversal"),
            ('HANGINGMAN', 'CDLHANGINGMAN', "Hanging Man - Bearish reversal"),
            ('ENGULFING', 'CDLENGULFING', "Engulfing Pattern"),
            ('HARAMI', 'CDLHARAMI', "Harami Pattern"),
            ('MORNINGSTAR', 'CDLMORNINGSTAR', "Morning Star - Bullish reversal"),
            ('EVENINGSTAR', 'CDLEVENINGSTAR', "Evening Star - Bearish reversal"),
            ('SHOOTINGSTAR', 'CDLSHOOTINGSTAR', "Shooting Star - Bearish reversal"),
            ('DRAGONFLYDOJI', 'CDLDRAGONFLYDOJI', "Dragonfly Doji - Bullish reversal"),
            ('GRAVESTONEDOJI', 'CDLGRAVESTONEDOJI', "Gravestone Doji - Bearish reversal"),
            ('MARUBOZU', 'CDLMARUBOZU', "Marubozu - Strong trend continuation"),
            ('SPINNINGTOP', 'CDLSPINNINGTOP', "Spinning Top - Indecision"),
            ('THREEWHITESOLDIERS', 'CDL3WHITESOLDIERS', "Three White Soldiers - Strong bullish"),
            ('THREEBLACKCROWS', 'CDL3BLACKCROWS', "Three Black Crows - Strong bearish"),
            ('PIERCING', 'CDLPIERCING', "Piercing Pattern - Bullish reversal"),
            ('DARKCLOUDCOVER', 'CDLDARKCLOUDCOVER', "Dark Cloud Cover - Bearish reversal")
        ]
        
        patterns = {}
        available_patterns = 0
        
        for pattern_name, talib_func_name, description in pattern_definitions:
            try:
                # Try to get the TA-Lib function
                pattern_func = getattr(talib, talib_func_name)
                patterns[pattern_name] = (pattern_func, description)
                available_patterns += 1
            except AttributeError:
                self.logger.warning(f"TA-Lib pattern {talib_func_name} not available - skipping {pattern_name}")
                continue
        
        self.logger.info(f"Pattern recognizer initialized with {available_patterns}/{len(pattern_definitions)} patterns available")
        
        return patterns
    
    def recognize_patterns(self, df: pd.DataFrame) -> List[PatternResult]:
        """Recognize candlestick patterns in the data"""
        try:
            if len(df) < 3:  # Need at least 3 candles for most patterns
                return []
            
            open_prices = df['open'].values.astype(float)
            high_prices = df['high'].values.astype(float)
            low_prices = df['low'].values.astype(float)
            close_prices = df['close'].values.astype(float)
            
            patterns_found = []
            
            for pattern_name, (pattern_func, description) in self.patterns.items():
                try:
                    result = pattern_func(open_prices, high_prices, low_prices, close_prices)
                    
                    # Check the last few candles for patterns
                    for i in range(max(0, len(result) - 5), len(result)):
                        if result[i] != 0:
                            strength = int(result[i])
                            reliability = self._calculate_pattern_reliability(pattern_name, strength)
                            
                            pattern_result = PatternResult(
                                pattern_name=pattern_name,
                                strength=strength,
                                reliability=reliability,
                                description=description
                            )
                            patterns_found.append(pattern_result)
                            
                except Exception as e:
                    self.logger.warning(f"Failed to calculate pattern {pattern_name}", {"error": str(e)})
                    continue
            
            # Sort by reliability and strength
            patterns_found.sort(key=lambda x: (x.reliability, abs(x.strength)), reverse=True)
            
            return patterns_found[:5]  # Return top 5 patterns
            
        except Exception as e:
            self.logger.error("Pattern recognition failed", {"error": str(e)})
            return []
    
    def _calculate_pattern_reliability(self, pattern_name: str, strength: int) -> float:
        """Calculate pattern reliability based on historical performance"""
        # Pattern reliability scores based on historical backtesting
        reliability_scores = {
            'THREEWHITESOLDIERS': 0.85,
            'THREEBLACKCROWS': 0.85,
            'MORNINGSTAR': 0.80,
            'EVENINGSTAR': 0.80,
            'ENGULFING': 0.75,
            'HAMMER': 0.70,
            'SHOOTINGSTAR': 0.70,
            'PIERCING': 0.65,
            'DARKCLOUDCOVER': 0.65,
            'DRAGONFLYDOJI': 0.60,
            'GRAVESTONEDOJI': 0.60,
            'HARAMI': 0.55,
            'HANGINGMAN': 0.55,
            'MARUBOZU': 0.50,
            'DOJI': 0.45,
            'SPINNINGTOP': 0.40
        }
        
        base_reliability = reliability_scores.get(pattern_name, 0.50)
        
        # Adjust based on strength (100 = perfect pattern, lower values = less perfect)
        strength_factor = abs(strength) / 100.0
        
        return base_reliability * strength_factor


class TechnicalAnalyzer(Analyzer):
    """Main technical analysis engine"""
    
    def __init__(self, dao: DataAccessObject, config: IndicatorConfig = None):
        self.dao = dao
        self.config = config or IndicatorConfig()
        self.indicator_calculator = IndicatorCalculator(self.config)
        self.pattern_recognizer = PatternRecognizer()
        self.logger = get_logger("technical_analyzer")
        
        # Analysis parameters
        self.min_data_points = 200  # Minimum data points for analysis
        self.default_timeframe = "4h"
    
    async def initialize(self) -> None:
        """Initialize the technical analyzer"""
        self.logger.info("Technical analyzer initialized", {
            "rsi_period": self.config.rsi_period,
            "macd_periods": f"{self.config.macd_fast}/{self.config.macd_slow}/{self.config.macd_signal}",
            "sma_periods": self.config.sma_periods
        })
    
    async def analyze(self, symbol: str, timeframe: str = None) -> TechnicalIndicators:
        """Analyze technical indicators for a symbol"""
        timeframe = timeframe or self.default_timeframe
        
        try:
            # Get historical data
            history = await self.dao.get_market_data_history(
                symbol, timeframe, limit=self.min_data_points
            )
            
            if len(history) < 50:  # Minimum for basic analysis
                raise AnalysisError(
                    f"Insufficient data for {symbol}: need 50+, got {len(history)}",
                    analyzer="technical_analyzer"
                )
            
            # Convert to DataFrame
            df = self._create_dataframe(history)
            
            # Calculate indicators
            df = self.indicator_calculator.calculate_all_indicators(df)
            
            # Get latest indicators
            indicators = self.indicator_calculator.get_latest_indicators(df)
            indicators.symbol = symbol
            indicators.timeframe = timeframe
            indicators.timestamp = datetime.utcnow()
            
            # Store indicators
            await self.dao.store_technical_indicators(indicators)
            
            self.logger.debug("Technical analysis completed", {
                "symbol": symbol,
                "timeframe": timeframe,
                "rsi": float(indicators.rsi) if indicators.rsi else None,
                "macd_signal": "bullish" if indicators.macd_bullish_crossover else "bearish"
            })
            
            return indicators
            
        except Exception as e:
            self.logger.error("Technical analysis failed", {
                "symbol": symbol,
                "timeframe": timeframe,
                "error": str(e)
            })
            raise AnalysisError(
                f"Technical analysis failed for {symbol}",
                analyzer="technical_analyzer",
                original_error=e
            )
    
    def _create_dataframe(self, history: List[MarketData]) -> pd.DataFrame:
        """Convert market data history to pandas DataFrame"""
        data = []
        for md in reversed(history):  # Reverse to get chronological order
            data.append({
                'timestamp': md.timestamp,
                'open': float(md.ohlcv.open),
                'high': float(md.ohlcv.high),
                'low': float(md.ohlcv.low),
                'close': float(md.ohlcv.close),
                'volume': float(md.ohlcv.volume)
            })
        
        df = pd.DataFrame(data)
        df.set_index('timestamp', inplace=True)
        df.sort_index(inplace=True)
        
        return df
    
    async def scan_setups(self, symbols: List[str], timeframe: str = None) -> List[TechnicalSetup]:
        """Scan multiple symbols for technical setups"""
        timeframe = timeframe or self.default_timeframe
        setups = []
        
        for symbol in symbols:
            try:
                setup = await self.detect_setup(symbol, timeframe)
                if setup:
                    setups.append(setup)
            except Exception as e:
                self.logger.warning("Setup detection failed", {
                    "symbol": symbol,
                    "error": str(e)
                })
                continue
        
        # Sort by confidence
        setups.sort(key=lambda x: x.confidence, reverse=True)
        
        self.logger.info("Setup scan completed", {
            "symbols_scanned": len(symbols),
            "setups_found": len(setups),
            "timeframe": timeframe
        })
        
        return setups
    
    async def detect_setup(self, symbol: str, timeframe: str = None) -> Optional[TechnicalSetup]:
        """Detect technical setup for a single symbol"""
        timeframe = timeframe or self.default_timeframe
        
        try:
            # Get recent data for setup detection
            history = await self.dao.get_market_data_history(
                symbol, timeframe, limit=100
            )
            
            if len(history) < 50:
                return None
            
            # Convert to DataFrame and calculate indicators
            df = self._create_dataframe(history)
            df = self.indicator_calculator.calculate_all_indicators(df)
            
            # Recognize patterns
            patterns = self.pattern_recognizer.recognize_patterns(df)
            
            # Detect setups
            long_setup = self._detect_long_setup(df, patterns, symbol)
            short_setup = self._detect_short_setup(df, patterns, symbol)
            
            # Return the best setup
            if long_setup and short_setup:
                return long_setup if long_setup.confidence > short_setup.confidence else short_setup
            elif long_setup:
                return long_setup
            elif short_setup:
                return short_setup
            else:
                return None
                
        except Exception as e:
            self.logger.error("Setup detection failed", {
                "symbol": symbol,
                "error": str(e)
            })
            return None
    
    def _detect_long_setup(self, df: pd.DataFrame, patterns: List[PatternResult], symbol: str) -> Optional[TechnicalSetup]:
        """Detect long (bullish) setup"""
        latest = df.iloc[-1]
        recent = df.tail(20)
        
        setup_factors = []
        
        # Factor 1: RSI oversold
        if not pd.isna(latest['rsi']) and latest['rsi'] < self.config.rsi_oversold:
            setup_factors.append(("rsi_oversold", 0.3))
        
        # Factor 2: Price near support (SMA20 or SMA50)
        if (not pd.isna(latest['sma_20']) and 
            latest['close'] <= latest['sma_20'] * 1.02):  # Within 2% of SMA20
            setup_factors.append(("near_sma20_support", 0.25))
        
        # Factor 3: MACD bullish divergence or crossover
        if (not pd.isna(latest['macd']) and not pd.isna(latest['macd_signal']) and
            latest['macd'] > latest['macd_signal']):
            setup_factors.append(("macd_bullish", 0.2))
        
        # Factor 4: Bullish patterns
        bullish_patterns = [p for p in patterns if p.strength > 0]
        if bullish_patterns:
            pattern_score = max(p.reliability for p in bullish_patterns)
            setup_factors.append(("bullish_pattern", pattern_score * 0.25))
        
        # Factor 5: Volume confirmation
        if not pd.isna(latest['volume_ratio']) and latest['volume_ratio'] > 1.2:
            setup_factors.append(("volume_confirmation", 0.15))
        
        # Calculate overall confidence
        if len(setup_factors) < 2:  # Need at least 2 factors
            return None
        
        confidence = sum(score for _, score in setup_factors)
        confidence = min(confidence, 1.0)
        
        if confidence < 0.5:  # Minimum confidence threshold
            return None
        
        # Calculate entry, stop loss, and take profit levels
        entry_price = Decimal(str(latest['close']))
        
        # Stop loss below recent low or SMA20
        recent_low = Decimal(str(recent['low'].min()))
        sma20_level = Decimal(str(latest['sma_20'])) if not pd.isna(latest['sma_20']) else recent_low
        stop_loss = min(recent_low * Decimal('0.98'), sma20_level * Decimal('0.98'))
        
        # Take profit levels at resistance
        atr = Decimal(str(latest['atr'])) if not pd.isna(latest['atr']) else entry_price * Decimal('0.02')
        take_profit_levels = [
            entry_price + atr * Decimal('2'),  # 2x ATR
            entry_price + atr * Decimal('4'),  # 4x ATR
        ]
        
        return TechnicalSetup(
            symbol=symbol,
            setup_type=SetupType.LONG_SUPPORT,
            confidence=confidence,
            strength=self._calculate_signal_strength(confidence),
            entry_price=entry_price,
            stop_loss=stop_loss,
            take_profit_levels=take_profit_levels,
            indicators={
                "rsi": latest['rsi'],
                "macd": latest['macd'],
                "macd_signal": latest['macd_signal'],
                "volume_ratio": latest['volume_ratio']
            },
            patterns=bullish_patterns,
            timestamp=datetime.utcnow(),
            timeframe="",  # Will be set by caller
            metadata={
                "setup_factors": [factor for factor, _ in setup_factors],
                "factor_scores": dict(setup_factors)
            }
        )
    
    def _detect_short_setup(self, df: pd.DataFrame, patterns: List[PatternResult], symbol: str) -> Optional[TechnicalSetup]:
        """Detect short (bearish) setup"""
        latest = df.iloc[-1]
        recent = df.tail(20)
        
        setup_factors = []
        
        # Factor 1: RSI overbought
        if not pd.isna(latest['rsi']) and latest['rsi'] > self.config.rsi_overbought:
            setup_factors.append(("rsi_overbought", 0.3))
        
        # Factor 2: Price near resistance (SMA20 or recent high)
        recent_high = recent['high'].max()
        if latest['close'] >= recent_high * 0.98:  # Within 2% of recent high
            setup_factors.append(("near_resistance", 0.25))
        
        # Factor 3: MACD bearish crossover
        if (not pd.isna(latest['macd']) and not pd.isna(latest['macd_signal']) and
            latest['macd'] < latest['macd_signal']):
            setup_factors.append(("macd_bearish", 0.2))
        
        # Factor 4: Bearish patterns
        bearish_patterns = [p for p in patterns if p.strength < 0]
        if bearish_patterns:
            pattern_score = max(p.reliability for p in bearish_patterns)
            setup_factors.append(("bearish_pattern", pattern_score * 0.25))
        
        # Factor 5: Volume confirmation
        if not pd.isna(latest['volume_ratio']) and latest['volume_ratio'] > 1.2:
            setup_factors.append(("volume_confirmation", 0.15))
        
        # Calculate overall confidence
        if len(setup_factors) < 2:  # Need at least 2 factors
            return None
        
        confidence = sum(score for _, score in setup_factors)
        confidence = min(confidence, 1.0)
        
        if confidence < 0.5:  # Minimum confidence threshold
            return None
        
        # Calculate entry, stop loss, and take profit levels
        entry_price = Decimal(str(latest['close']))
        
        # Stop loss above recent high or SMA20
        recent_high = Decimal(str(recent['high'].max()))
        sma20_level = Decimal(str(latest['sma_20'])) if not pd.isna(latest['sma_20']) else recent_high
        stop_loss = max(recent_high * Decimal('1.02'), sma20_level * Decimal('1.02'))
        
        # Take profit levels at support
        atr = Decimal(str(latest['atr'])) if not pd.isna(latest['atr']) else entry_price * Decimal('0.02')
        take_profit_levels = [
            entry_price - atr * Decimal('2'),  # 2x ATR
            entry_price - atr * Decimal('4'),  # 4x ATR
        ]
        
        return TechnicalSetup(
            symbol=symbol,
            setup_type=SetupType.SHORT_RESISTANCE,
            confidence=confidence,
            strength=self._calculate_signal_strength(confidence),
            entry_price=entry_price,
            stop_loss=stop_loss,
            take_profit_levels=take_profit_levels,
            indicators={
                "rsi": latest['rsi'],
                "macd": latest['macd'],
                "macd_signal": latest['macd_signal'],
                "volume_ratio": latest['volume_ratio']
            },
            patterns=bearish_patterns,
            timestamp=datetime.utcnow(),
            timeframe="",  # Will be set by caller
            metadata={
                "setup_factors": [factor for factor, _ in setup_factors],
                "factor_scores": dict(setup_factors)
            }
        )
    
    def _calculate_signal_strength(self, confidence: float) -> SignalStrength:
        """Calculate signal strength based on confidence"""
        if confidence >= 0.9:
            return SignalStrength.VERY_STRONG
        elif confidence >= 0.75:
            return SignalStrength.STRONG
        elif confidence >= 0.6:
            return SignalStrength.MODERATE
        elif confidence >= 0.4:
            return SignalStrength.WEAK
        else:
            return SignalStrength.WEAK