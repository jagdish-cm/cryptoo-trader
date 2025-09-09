"""
Market regime analysis module for Bitcoin price analysis and strategy mode detection
"""

import asyncio
from typing import List, Optional, Dict, Any, Tuple
from datetime import datetime, timedelta
from decimal import Decimal
from dataclasses import dataclass
from enum import Enum
import numpy as np
import pandas as pd

from ai_trading_system.interfaces.base import Analyzer
from ai_trading_system.models.market_data import MarketData, TechnicalIndicators
from ai_trading_system.models.enums import MarketRegime
from ai_trading_system.services.data_storage import DataAccessObject
from ai_trading_system.utils.logging import get_logger
from ai_trading_system.utils.errors import AnalysisError


class TrendStrength(str, Enum):
    """Trend strength classification"""
    VERY_WEAK = "very_weak"
    WEAK = "weak"
    MODERATE = "moderate"
    STRONG = "strong"
    VERY_STRONG = "very_strong"


@dataclass
class RegimeAnalysis:
    """Market regime analysis result"""
    regime: MarketRegime
    confidence: float
    trend_strength: TrendStrength
    price_vs_sma200: float  # Percentage above/below SMA200
    sma_slope: float  # SMA200 slope (trend direction)
    volatility: float
    volume_trend: float
    support_resistance_levels: List[Decimal]
    analysis_timestamp: datetime
    metadata: Dict[str, Any]


class BitcoinPriceAnalyzer(Analyzer):
    """Bitcoin price analyzer for market regime detection"""
    
    def __init__(self, dao: DataAccessObject):
        self.dao = dao
        self.logger = get_logger("bitcoin_analyzer")
        self.btc_symbol = "BTC/USDT"
        self.analysis_timeframe = "1d"  # Daily analysis for regime detection
        self.lookback_periods = 200  # For SMA200 calculation
        
        # Regime thresholds
        self.bull_threshold = 0.05  # 5% above SMA200 for bull market
        self.bear_threshold = -0.05  # 5% below SMA200 for bear market
        self.trend_strength_thresholds = {
            TrendStrength.VERY_STRONG: 0.20,  # 20%+
            TrendStrength.STRONG: 0.10,       # 10-20%
            TrendStrength.MODERATE: 0.05,     # 5-10%
            TrendStrength.WEAK: 0.02,         # 2-5%
            TrendStrength.VERY_WEAK: 0.0      # 0-2%
        }
    
    async def initialize(self) -> None:
        """Initialize the analyzer"""
        self.logger.info("Initializing Bitcoin price analyzer")
        
        # Check for existing historical data
        history = await self.dao.get_market_data_history(
            self.btc_symbol,
            self.analysis_timeframe,
            limit=self.lookback_periods
        )
        
        if len(history) < 10:  # Very minimal requirement for startup
            self.logger.warning("Limited historical data available - will collect data during operation", {
                "symbol": self.btc_symbol,
                "current_data_points": len(history),
                "recommended_minimum": 50
            })
            
            # Set a flag to indicate we're in data collection mode
            self._data_collection_mode = True
        else:
            self._data_collection_mode = False
            self.logger.info("Bitcoin analyzer initialized with historical data", {
                "symbol": self.btc_symbol,
                "timeframe": self.analysis_timeframe,
                "historical_data_points": len(history)
            })
    
    async def analyze(self, data: Optional[MarketData] = None) -> RegimeAnalysis:
        """Analyze Bitcoin price and determine market regime"""
        try:
            # Get historical data for analysis
            history = await self.dao.get_market_data_history(
                self.btc_symbol,
                self.analysis_timeframe,
                limit=self.lookback_periods
            )
            
            # Handle insufficient data gracefully
            if len(history) < 10:
                self.logger.warning("Very limited data available - using fallback analysis", {
                    "data_points": len(history),
                    "required": self.lookback_periods
                })
                return self._fallback_analysis(history)
            
            elif len(history) < self.lookback_periods:
                self.logger.info("Using partial data analysis", {
                    "data_points": len(history),
                    "optimal": self.lookback_periods
                })
                # Use available data but with reduced confidence
                return self._partial_analysis(history)
            
            # Full analysis with sufficient data
            df = self._create_dataframe(history)
            df = self._calculate_indicators(df)
            regime_analysis = self._analyze_regime(df)
            
            self.logger.info("Bitcoin regime analysis completed", {
                "regime": regime_analysis.regime.value,
                "confidence": regime_analysis.confidence,
                "trend_strength": regime_analysis.trend_strength.value,
                "price_vs_sma200": regime_analysis.price_vs_sma200
            })
            
            return regime_analysis
            
        except Exception as e:
            self.logger.error("Bitcoin analysis failed", {"error": str(e)})
            raise AnalysisError(
                "Bitcoin regime analysis failed",
                analyzer="bitcoin_price_analyzer",
                original_error=e
            )
    
    def _fallback_analysis(self, history: List[MarketData]) -> RegimeAnalysis:
        """Fallback analysis when very little data is available"""
        if not history:
            # Default neutral regime
            return RegimeAnalysis(
                regime=MarketRegime.RANGE,
                confidence=0.1,
                trend_strength=TrendStrength.VERY_WEAK,
                price_vs_sma200=0.0,
                sma_slope=0.0,
                volatility=0.0,
                volume_trend=1.0,
                support_resistance_levels=[],
                analysis_timestamp=datetime.utcnow(),
                metadata={"fallback_mode": True, "reason": "no_data"}
            )
        
        # Simple analysis with available data
        latest = history[0]  # Most recent data
        current_price = float(latest.ohlcv.close)
        
        # Simple trend detection if we have multiple points
        if len(history) >= 2:
            older_price = float(history[-1].ohlcv.close)
            price_change = (current_price - older_price) / older_price
            
            if price_change > 0.02:  # 2% increase
                regime = MarketRegime.BULL
                trend_strength = TrendStrength.WEAK
            elif price_change < -0.02:  # 2% decrease
                regime = MarketRegime.BEAR
                trend_strength = TrendStrength.WEAK
            else:
                regime = MarketRegime.RANGE
                trend_strength = TrendStrength.VERY_WEAK
        else:
            regime = MarketRegime.RANGE
            trend_strength = TrendStrength.VERY_WEAK
            price_change = 0.0
        
        return RegimeAnalysis(
            regime=regime,
            confidence=0.3,  # Low confidence due to limited data
            trend_strength=trend_strength,
            price_vs_sma200=price_change,  # Use price change as proxy
            sma_slope=price_change,
            volatility=0.0,
            volume_trend=1.0,
            support_resistance_levels=[Decimal(str(current_price))],
            analysis_timestamp=datetime.utcnow(),
            metadata={
                "fallback_mode": True,
                "data_points": len(history),
                "current_price": current_price
            }
        )
    
    def _partial_analysis(self, history: List[MarketData]) -> RegimeAnalysis:
        """Partial analysis with limited but usable data"""
        df = self._create_dataframe(history)
        
        # Calculate what indicators we can with available data
        available_periods = len(df)
        
        # Use shorter periods for moving averages
        short_ma_period = min(20, available_periods // 2)
        long_ma_period = min(50, available_periods - 1)
        
        if short_ma_period >= 5:
            df['sma_short'] = df['close'].rolling(window=short_ma_period).mean()
        if long_ma_period >= 10:
            df['sma_long'] = df['close'].rolling(window=long_ma_period).mean()
        
        # Simple trend analysis
        latest = df.iloc[-1]
        current_price = latest['close']
        
        # Determine regime based on available indicators
        if 'sma_long' in df.columns and not pd.isna(latest['sma_long']):
            price_vs_ma = (current_price - latest['sma_long']) / latest['sma_long']
            
            if price_vs_ma > 0.03:  # 3% above MA
                regime = MarketRegime.BULL
                trend_strength = TrendStrength.MODERATE
            elif price_vs_ma < -0.03:  # 3% below MA
                regime = MarketRegime.BEAR
                trend_strength = TrendStrength.MODERATE
            else:
                regime = MarketRegime.RANGE
                trend_strength = TrendStrength.WEAK
        else:
            # Very basic price momentum
            if available_periods >= 5:
                price_momentum = df['close'].pct_change(periods=min(5, available_periods-1)).iloc[-1]
                if price_momentum > 0.02:
                    regime = MarketRegime.BULL
                    trend_strength = TrendStrength.WEAK
                elif price_momentum < -0.02:
                    regime = MarketRegime.BEAR
                    trend_strength = TrendStrength.WEAK
                else:
                    regime = MarketRegime.RANGE
                    trend_strength = TrendStrength.VERY_WEAK
                price_vs_ma = price_momentum
            else:
                regime = MarketRegime.RANGE
                trend_strength = TrendStrength.VERY_WEAK
                price_vs_ma = 0.0
        
        return RegimeAnalysis(
            regime=regime,
            confidence=0.5,  # Moderate confidence with partial data
            trend_strength=trend_strength,
            price_vs_sma200=price_vs_ma,
            sma_slope=price_vs_ma,  # Use as proxy
            volatility=df['close'].pct_change().std() if available_periods > 5 else 0.0,
            volume_trend=1.0,
            support_resistance_levels=[Decimal(str(current_price))],
            analysis_timestamp=datetime.utcnow(),
            metadata={
                "partial_analysis": True,
                "data_points": available_periods,
                "indicators_available": list(df.columns)
            }
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
    
    def _calculate_indicators(self, df: pd.DataFrame) -> pd.DataFrame:
        """Calculate technical indicators for regime analysis"""
        # Simple Moving Averages
        df['sma_20'] = df['close'].rolling(window=20).mean()
        df['sma_50'] = df['close'].rolling(window=50).mean()
        df['sma_200'] = df['close'].rolling(window=200).mean()
        
        # Exponential Moving Averages
        df['ema_12'] = df['close'].ewm(span=12).mean()
        df['ema_26'] = df['close'].ewm(span=26).mean()
        
        # MACD
        df['macd'] = df['ema_12'] - df['ema_26']
        df['macd_signal'] = df['macd'].ewm(span=9).mean()
        df['macd_histogram'] = df['macd'] - df['macd_signal']
        
        # RSI
        delta = df['close'].diff()
        gain = (delta.where(delta > 0, 0)).rolling(window=14).mean()
        loss = (-delta.where(delta < 0, 0)).rolling(window=14).mean()
        rs = gain / loss
        df['rsi'] = 100 - (100 / (1 + rs))
        
        # Bollinger Bands
        df['bb_middle'] = df['close'].rolling(window=20).mean()
        bb_std = df['close'].rolling(window=20).std()
        df['bb_upper'] = df['bb_middle'] + (bb_std * 2)
        df['bb_lower'] = df['bb_middle'] - (bb_std * 2)
        
        # Average True Range (ATR)
        df['tr1'] = df['high'] - df['low']
        df['tr2'] = abs(df['high'] - df['close'].shift())
        df['tr3'] = abs(df['low'] - df['close'].shift())
        df['true_range'] = df[['tr1', 'tr2', 'tr3']].max(axis=1)
        df['atr'] = df['true_range'].rolling(window=14).mean()
        
        # Volume indicators
        df['volume_sma'] = df['volume'].rolling(window=20).mean()
        df['volume_ratio'] = df['volume'] / df['volume_sma']
        
        # Price position relative to moving averages
        df['price_vs_sma200'] = (df['close'] - df['sma_200']) / df['sma_200']
        df['price_vs_sma50'] = (df['close'] - df['sma_50']) / df['sma_50']
        df['price_vs_sma20'] = (df['close'] - df['sma_20']) / df['sma_20']
        
        # SMA slope (trend direction)
        df['sma200_slope'] = df['sma_200'].pct_change(periods=5)  # 5-day slope
        df['sma50_slope'] = df['sma_50'].pct_change(periods=3)    # 3-day slope
        
        # Volatility (20-day rolling standard deviation)
        df['volatility'] = df['close'].pct_change().rolling(window=20).std() * np.sqrt(252)
        
        return df
    
    def _analyze_regime(self, df: pd.DataFrame) -> RegimeAnalysis:
        """Analyze market regime based on technical indicators"""
        latest = df.iloc[-1]
        
        # Get key metrics
        current_price = latest['close']
        sma_200 = latest['sma_200']
        price_vs_sma200 = latest['price_vs_sma200']
        sma_slope = latest['sma200_slope']
        volatility = latest['volatility']
        volume_trend = latest['volume_ratio']
        
        # Determine base regime
        if price_vs_sma200 > self.bull_threshold and sma_slope > 0:
            base_regime = MarketRegime.BULL
        elif price_vs_sma200 < self.bear_threshold and sma_slope < 0:
            base_regime = MarketRegime.BEAR
        else:
            base_regime = MarketRegime.RANGE
        
        # Calculate trend strength
        trend_strength = self._calculate_trend_strength(abs(price_vs_sma200))
        
        # Calculate confidence based on multiple factors
        confidence = self._calculate_confidence(df, base_regime)
        
        # Find support and resistance levels
        support_resistance = self._find_support_resistance_levels(df)
        
        # Additional analysis metadata
        metadata = {
            'current_price': current_price,
            'sma_200': sma_200,
            'sma_50': latest['sma_50'],
            'sma_20': latest['sma_20'],
            'rsi': latest['rsi'],
            'macd': latest['macd'],
            'macd_signal': latest['macd_signal'],
            'bb_position': self._calculate_bb_position(latest),
            'volume_analysis': self._analyze_volume_trend(df),
            'momentum_indicators': self._analyze_momentum(df)
        }
        
        return RegimeAnalysis(
            regime=base_regime,
            confidence=confidence,
            trend_strength=trend_strength,
            price_vs_sma200=price_vs_sma200,
            sma_slope=sma_slope,
            volatility=volatility,
            volume_trend=volume_trend,
            support_resistance_levels=support_resistance,
            analysis_timestamp=datetime.utcnow(),
            metadata=metadata
        )
    
    def _calculate_trend_strength(self, price_deviation: float) -> TrendStrength:
        """Calculate trend strength based on price deviation from SMA200"""
        for strength, threshold in self.trend_strength_thresholds.items():
            if price_deviation >= threshold:
                return strength
        return TrendStrength.VERY_WEAK
    
    def _calculate_confidence(self, df: pd.DataFrame, regime: MarketRegime) -> float:
        """Calculate confidence in regime classification"""
        latest = df.iloc[-1]
        recent = df.tail(20)  # Last 20 days
        
        confidence_factors = []
        
        # Factor 1: Consistency of price vs SMA200
        sma200_consistency = (recent['price_vs_sma200'] > 0).mean() if regime == MarketRegime.BULL else (recent['price_vs_sma200'] < 0).mean()
        confidence_factors.append(sma200_consistency)
        
        # Factor 2: SMA alignment (20 > 50 > 200 for bull, reverse for bear)
        if regime == MarketRegime.BULL:
            sma_alignment = (latest['sma_20'] > latest['sma_50'] > latest['sma_200'])
        elif regime == MarketRegime.BEAR:
            sma_alignment = (latest['sma_20'] < latest['sma_50'] < latest['sma_200'])
        else:
            sma_alignment = 0.5  # Neutral for range
        
        confidence_factors.append(float(sma_alignment))
        
        # Factor 3: Volume confirmation
        volume_confirmation = min(latest['volume_ratio'], 2.0) / 2.0  # Cap at 2x average
        confidence_factors.append(volume_confirmation)
        
        # Factor 4: Momentum consistency (MACD)
        if regime == MarketRegime.BULL:
            momentum_factor = 1.0 if latest['macd'] > latest['macd_signal'] else 0.3
        elif regime == MarketRegime.BEAR:
            momentum_factor = 1.0 if latest['macd'] < latest['macd_signal'] else 0.3
        else:
            momentum_factor = 0.6  # Neutral
        
        confidence_factors.append(momentum_factor)
        
        # Factor 5: Volatility factor (lower volatility = higher confidence)
        volatility_factor = max(0.2, 1.0 - (latest['volatility'] / 2.0))  # Normalize volatility
        confidence_factors.append(volatility_factor)
        
        # Calculate weighted average confidence
        weights = [0.3, 0.25, 0.15, 0.2, 0.1]  # SMA200, alignment, volume, momentum, volatility
        confidence = sum(f * w for f, w in zip(confidence_factors, weights))
        
        return min(max(confidence, 0.0), 1.0)  # Clamp between 0 and 1
    
    def _find_support_resistance_levels(self, df: pd.DataFrame, lookback: int = 50) -> List[Decimal]:
        """Find key support and resistance levels"""
        recent_data = df.tail(lookback)
        
        # Find local highs and lows
        highs = []
        lows = []
        
        for i in range(2, len(recent_data) - 2):
            # Local high
            if (recent_data.iloc[i]['high'] > recent_data.iloc[i-1]['high'] and 
                recent_data.iloc[i]['high'] > recent_data.iloc[i-2]['high'] and
                recent_data.iloc[i]['high'] > recent_data.iloc[i+1]['high'] and 
                recent_data.iloc[i]['high'] > recent_data.iloc[i+2]['high']):
                highs.append(recent_data.iloc[i]['high'])
            
            # Local low
            if (recent_data.iloc[i]['low'] < recent_data.iloc[i-1]['low'] and 
                recent_data.iloc[i]['low'] < recent_data.iloc[i-2]['low'] and
                recent_data.iloc[i]['low'] < recent_data.iloc[i+1]['low'] and 
                recent_data.iloc[i]['low'] < recent_data.iloc[i+2]['low']):
                lows.append(recent_data.iloc[i]['low'])
        
        # Combine and sort levels
        levels = sorted(set(highs + lows))
        
        # Convert to Decimal and return top 10 most significant levels
        return [Decimal(str(level)) for level in levels[-10:]]
    
    def _calculate_bb_position(self, latest_data: pd.Series) -> str:
        """Calculate Bollinger Band position"""
        price = latest_data['close']
        bb_upper = latest_data['bb_upper']
        bb_lower = latest_data['bb_lower']
        bb_middle = latest_data['bb_middle']
        
        if price > bb_upper:
            return "above_upper"
        elif price < bb_lower:
            return "below_lower"
        elif price > bb_middle:
            return "upper_half"
        else:
            return "lower_half"
    
    def _analyze_volume_trend(self, df: pd.DataFrame) -> Dict[str, Any]:
        """Analyze volume trends"""
        recent = df.tail(20)
        
        return {
            'avg_volume_ratio': recent['volume_ratio'].mean(),
            'volume_trend': 'increasing' if recent['volume'].iloc[-1] > recent['volume'].iloc[-10] else 'decreasing',
            'high_volume_days': (recent['volume_ratio'] > 1.5).sum(),
            'volume_volatility': recent['volume_ratio'].std()
        }
    
    def _analyze_momentum(self, df: pd.DataFrame) -> Dict[str, Any]:
        """Analyze momentum indicators"""
        latest = df.iloc[-1]
        recent = df.tail(10)
        
        return {
            'rsi_level': latest['rsi'],
            'rsi_trend': 'rising' if latest['rsi'] > recent['rsi'].iloc[-5] else 'falling',
            'macd_signal': 'bullish' if latest['macd'] > latest['macd_signal'] else 'bearish',
            'macd_histogram_trend': 'increasing' if latest['macd_histogram'] > recent['macd_histogram'].iloc[-3] else 'decreasing',
            'price_momentum': recent['close'].pct_change().mean() * 100  # Average daily return %
        }


class MovingAverageCalculator:
    """Utility class for moving average calculations"""
    
    @staticmethod
    def sma(prices: List[float], period: int) -> List[float]:
        """Calculate Simple Moving Average"""
        if len(prices) < period:
            return []
        
        sma_values = []
        for i in range(period - 1, len(prices)):
            avg = sum(prices[i - period + 1:i + 1]) / period
            sma_values.append(avg)
        
        return sma_values
    
    @staticmethod
    def ema(prices: List[float], period: int) -> List[float]:
        """Calculate Exponential Moving Average"""
        if len(prices) < period:
            return []
        
        multiplier = 2 / (period + 1)
        ema_values = []
        
        # Start with SMA for first value
        ema = sum(prices[:period]) / period
        ema_values.append(ema)
        
        # Calculate EMA for remaining values
        for price in prices[period:]:
            ema = (price * multiplier) + (ema * (1 - multiplier))
            ema_values.append(ema)
        
        return ema_values
    
    @staticmethod
    def detect_trend(sma_values: List[float], lookback: int = 5) -> str:
        """Detect trend direction based on SMA slope"""
        if len(sma_values) < lookback + 1:
            return "insufficient_data"
        
        recent_values = sma_values[-lookback-1:]
        slope = (recent_values[-1] - recent_values[0]) / lookback
        
        if slope > 0.001:  # 0.1% threshold
            return "uptrend"
        elif slope < -0.001:
            return "downtrend"
        else:
            return "sideways"


class TrendDetector:
    """Advanced trend detection algorithms"""
    
    def __init__(self):
        self.logger = get_logger("trend_detector")
    
    def detect_sustained_trend(
        self, 
        prices: List[float], 
        sma_200: List[float], 
        min_duration: int = 10
    ) -> Tuple[str, int, float]:
        """
        Detect sustained trends above/below SMA200
        Returns: (trend_type, duration, strength)
        """
        if len(prices) != len(sma_200) or len(prices) < min_duration:
            return "insufficient_data", 0, 0.0
        
        # Calculate price position relative to SMA200
        price_positions = [(p - sma) / sma for p, sma in zip(prices, sma_200)]
        
        # Find current trend
        current_trend = "above" if price_positions[-1] > 0 else "below"
        trend_duration = 0
        trend_strength = 0.0
        
        # Count consecutive periods in current trend
        for i in range(len(price_positions) - 1, -1, -1):
            if current_trend == "above" and price_positions[i] > 0:
                trend_duration += 1
                trend_strength += price_positions[i]
            elif current_trend == "below" and price_positions[i] < 0:
                trend_duration += 1
                trend_strength += abs(price_positions[i])
            else:
                break
        
        # Average strength over duration
        if trend_duration > 0:
            trend_strength /= trend_duration
        
        # Classify trend
        if trend_duration >= min_duration:
            if current_trend == "above":
                return "sustained_uptrend", trend_duration, trend_strength
            else:
                return "sustained_downtrend", trend_duration, trend_strength
        else:
            return "no_sustained_trend", trend_duration, trend_strength
    
    def classify_market_regime(
        self, 
        trend_type: str, 
        trend_duration: int, 
        trend_strength: float,
        volatility: float
    ) -> MarketRegime:
        """Classify market regime based on trend analysis"""
        
        # Strong sustained trends
        if trend_type == "sustained_uptrend" and trend_duration >= 20 and trend_strength > 0.05:
            return MarketRegime.BULL
        elif trend_type == "sustained_downtrend" and trend_duration >= 20 and trend_strength > 0.05:
            return MarketRegime.BEAR
        
        # Moderate trends with lower volatility
        elif trend_type == "sustained_uptrend" and volatility < 0.6:
            return MarketRegime.BULL
        elif trend_type == "sustained_downtrend" and volatility < 0.6:
            return MarketRegime.BEAR
        
        # Default to range market
        else:
            return MarketRegime.RANGE