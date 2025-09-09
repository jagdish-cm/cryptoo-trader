"""
Signal fusion engine that combines technical analysis with sentiment analysis for high-confidence signals
"""

import asyncio
from typing import List, Dict, Any, Optional, Tuple
from datetime import datetime, timedelta
from decimal import Decimal
from dataclasses import dataclass
from enum import Enum
import heapq

from ai_trading_system.interfaces.base import Analyzer
from ai_trading_system.analyzers.technical_analyzer import TechnicalSetup, TechnicalAnalyzer
from ai_trading_system.analyzers.sentiment_analyzer import SentimentResult, MarketEvent, SentimentAnalyzer, EventDetector
from ai_trading_system.models.trading import TradingSignal
from ai_trading_system.models.enums import TradeDirection, SetupType, SignalStrength, Sentiment, EventSeverity
from ai_trading_system.services.data_storage import DataAccessObject
from ai_trading_system.utils.logging import get_logger
from ai_trading_system.utils.errors import AnalysisError


class FusionCriteria(str, Enum):
    """Fusion criteria for signal generation"""
    TECHNICAL_CONFIRMATION = "technical_confirmation"
    SENTIMENT_ALIGNMENT = "sentiment_alignment"
    EVENT_VALIDATION = "event_validation"
    VOLUME_CONFIRMATION = "volume_confirmation"
    MULTI_TIMEFRAME = "multi_timeframe"


@dataclass
class FusionScore:
    """Fusion scoring breakdown"""
    technical_score: float
    sentiment_score: float
    event_score: float
    volume_score: float
    timeframe_score: float
    overall_score: float
    confidence: float


@dataclass
class SignalCandidate:
    """Signal candidate for fusion analysis"""
    technical_setup: TechnicalSetup
    sentiment_result: Optional[SentimentResult]
    recent_events: List[MarketEvent]
    fusion_score: Optional[FusionScore]
    rejection_reasons: List[str]
    timestamp: datetime


class FusionEngine(Analyzer):
    """Main signal fusion engine"""
    
    def __init__(
        self, 
        dao: DataAccessObject,
        technical_analyzer: TechnicalAnalyzer,
        sentiment_analyzer: SentimentAnalyzer,
        event_detector: EventDetector
    ):
        self.dao = dao
        self.technical_analyzer = technical_analyzer
        self.sentiment_analyzer = sentiment_analyzer
        self.event_detector = event_detector
        self.logger = get_logger("fusion_engine")
        
        # Fusion configuration
        self.min_fusion_score = 0.6  # Minimum score for signal generation
        self.min_technical_score = 0.5
        self.min_sentiment_confidence = 0.4
        self.max_negative_events = 2  # Max critical negative events for long signals
        
        # Scoring weights
        self.fusion_weights = {
            'technical': 0.4,
            'sentiment': 0.3,
            'events': 0.2,
            'volume': 0.05,
            'timeframe': 0.05
        }
        
        # Signal cache
        self.signal_cache_ttl = 1800  # 30 minutes
        
    async def initialize(self) -> None:
        """Initialize fusion engine"""
        await self.technical_analyzer.initialize()
        await self.sentiment_analyzer.initialize()
        await self.event_detector.initialize()
        
        self.logger.info("Fusion engine initialized", {
            "min_fusion_score": self.min_fusion_score,
            "fusion_weights": self.fusion_weights
        })
    
    async def analyze(self, symbol: str, timeframe: str = "4h") -> Optional[TradingSignal]:
        """Generate trading signal through fusion analysis"""
        try:
            # Check for cached signal first
            cached_signal = await self._get_cached_signal(symbol)
            if cached_signal:
                return cached_signal
            
            # Step 1: Get technical setup
            technical_setup = await self.technical_analyzer.detect_setup(symbol, timeframe)
            if not technical_setup:
                self.logger.debug("No technical setup found", {"symbol": symbol})
                return None
            
            # Step 2: Create signal candidate
            candidate = await self._create_signal_candidate(technical_setup)
            
            # Step 3: Perform fusion analysis
            fusion_result = await self._perform_fusion_analysis(candidate)
            
            # Step 4: Generate signal if criteria met
            if fusion_result:
                signal = await self._generate_trading_signal(fusion_result)
                
                # Cache the signal
                await self._cache_signal(signal)
                
                self.logger.info("Trading signal generated", {
                    "symbol": symbol,
                    "direction": signal.direction.value,
                    "confidence": signal.confidence,
                    "fusion_score": fusion_result.fusion_score.overall_score
                })
                
                return signal
            
            return None
            
        except Exception as e:
            self.logger.error("Fusion analysis failed", {
                "symbol": symbol,
                "error": str(e)
            })
            raise AnalysisError(
                f"Fusion analysis failed for {symbol}",
                analyzer="fusion_engine",
                original_error=e
            )
    
    async def _create_signal_candidate(self, technical_setup: TechnicalSetup) -> SignalCandidate:
        """Create signal candidate with all required data"""
        symbol = technical_setup.symbol
        
        # Get sentiment analysis
        try:
            sentiment_result = await self.sentiment_analyzer.analyze(symbol)
        except Exception as e:
            self.logger.warning("Sentiment analysis failed", {
                "symbol": symbol,
                "error": str(e)
            })
            sentiment_result = None
        
        # Get recent events
        try:
            recent_events = await self.event_detector.get_recent_events(symbol, hours=24)
        except Exception as e:
            self.logger.warning("Event detection failed", {
                "symbol": symbol,
                "error": str(e)
            })
            recent_events = []
        
        return SignalCandidate(
            technical_setup=technical_setup,
            sentiment_result=sentiment_result,
            recent_events=recent_events,
            fusion_score=None,
            rejection_reasons=[],
            timestamp=datetime.utcnow()
        )
    
    async def _perform_fusion_analysis(self, candidate: SignalCandidate) -> Optional[SignalCandidate]:
        """Perform comprehensive fusion analysis"""
        
        # Calculate fusion scores
        fusion_score = await self._calculate_fusion_score(candidate)
        candidate.fusion_score = fusion_score
        
        # Apply fusion criteria
        if not await self._validate_fusion_criteria(candidate):
            return None
        
        # Check minimum score threshold
        if fusion_score.overall_score < self.min_fusion_score:
            candidate.rejection_reasons.append(
                f"Fusion score {fusion_score.overall_score:.3f} below threshold {self.min_fusion_score}"
            )
            return None
        
        self.logger.debug("Fusion analysis passed", {
            "symbol": candidate.technical_setup.symbol,
            "fusion_score": fusion_score.overall_score,
            "technical_score": fusion_score.technical_score,
            "sentiment_score": fusion_score.sentiment_score
        })
        
        return candidate
    
    async def _calculate_fusion_score(self, candidate: SignalCandidate) -> FusionScore:
        """Calculate comprehensive fusion score"""
        
        # Technical score (base confidence from technical analysis)
        technical_score = candidate.technical_setup.confidence
        
        # Sentiment score
        sentiment_score = await self._calculate_sentiment_score(candidate)
        
        # Event score
        event_score = await self._calculate_event_score(candidate)
        
        # Volume score
        volume_score = await self._calculate_volume_score(candidate)
        
        # Multi-timeframe score
        timeframe_score = await self._calculate_timeframe_score(candidate)
        
        # Calculate weighted overall score
        overall_score = (
            technical_score * self.fusion_weights['technical'] +
            sentiment_score * self.fusion_weights['sentiment'] +
            event_score * self.fusion_weights['events'] +
            volume_score * self.fusion_weights['volume'] +
            timeframe_score * self.fusion_weights['timeframe']
        )
        
        # Calculate confidence (based on data availability and quality)
        confidence = self._calculate_fusion_confidence(candidate, overall_score)
        
        return FusionScore(
            technical_score=technical_score,
            sentiment_score=sentiment_score,
            event_score=event_score,
            volume_score=volume_score,
            timeframe_score=timeframe_score,
            overall_score=overall_score,
            confidence=confidence
        )
    
    async def _calculate_sentiment_score(self, candidate: SignalCandidate) -> float:
        """Calculate sentiment component score"""
        if not candidate.sentiment_result:
            return 0.5  # Neutral if no sentiment data
        
        sentiment = candidate.sentiment_result.sentiment
        confidence = candidate.sentiment_result.confidence
        setup_direction = self._get_setup_direction(candidate.technical_setup)
        
        # Score based on sentiment alignment with setup direction
        if setup_direction == TradeDirection.LONG:
            if sentiment == Sentiment.POSITIVE:
                return confidence
            elif sentiment == Sentiment.NEUTRAL:
                return 0.6 * confidence
            else:  # NEGATIVE
                return 0.2 * confidence
        
        else:  # SHORT setup
            if sentiment == Sentiment.NEGATIVE:
                return confidence
            elif sentiment == Sentiment.NEUTRAL:
                return 0.6 * confidence
            else:  # POSITIVE
                return 0.2 * confidence
    
    async def _calculate_event_score(self, candidate: SignalCandidate) -> float:
        """Calculate event impact score"""
        if not candidate.recent_events:
            return 0.7  # Neutral if no events
        
        setup_direction = self._get_setup_direction(candidate.technical_setup)
        
        # Analyze events for alignment with setup
        positive_impact = 0.0
        negative_impact = 0.0
        total_weight = 0.0
        
        for event in candidate.recent_events:
            # Weight by severity and confidence
            severity_weights = {
                EventSeverity.LOW: 0.25,
                EventSeverity.MEDIUM: 0.5,
                EventSeverity.HIGH: 0.75,
                EventSeverity.CRITICAL: 1.0
            }
            
            weight = severity_weights.get(event.severity, 0.5) * event.confidence
            total_weight += weight
            
            # Determine impact alignment
            if setup_direction == TradeDirection.LONG:
                if event.impact == "BULLISH":
                    positive_impact += weight
                elif event.impact == "BEARISH":
                    negative_impact += weight
            else:  # SHORT setup
                if event.impact == "BEARISH":
                    positive_impact += weight
                elif event.impact == "BULLISH":
                    negative_impact += weight
        
        if total_weight == 0:
            return 0.7  # Neutral
        
        # Calculate net impact score
        net_impact = (positive_impact - negative_impact) / total_weight
        
        # Convert to 0-1 score
        return max(0.0, min(1.0, 0.5 + net_impact * 0.5))
    
    async def _calculate_volume_score(self, candidate: SignalCandidate) -> float:
        """Calculate volume confirmation score"""
        try:
            # Get recent volume data
            recent_data = await self.dao.get_market_data_history(
                candidate.technical_setup.symbol, "1h", limit=24
            )
            
            if len(recent_data) < 10:
                return 0.5  # Neutral if insufficient data
            
            # Calculate volume metrics
            volumes = [float(md.ohlcv.volume) for md in recent_data[:10]]
            avg_volume = sum(volumes) / len(volumes)
            current_volume = volumes[0]
            
            # Volume ratio
            volume_ratio = current_volume / avg_volume if avg_volume > 0 else 1.0
            
            # Score based on volume confirmation
            if volume_ratio >= 1.5:  # High volume
                return 1.0
            elif volume_ratio >= 1.2:  # Above average
                return 0.8
            elif volume_ratio >= 0.8:  # Normal
                return 0.6
            else:  # Low volume
                return 0.3
                
        except Exception:
            return 0.5  # Neutral if calculation fails
    
    async def _calculate_timeframe_score(self, candidate: SignalCandidate) -> float:
        """Calculate multi-timeframe alignment score"""
        try:
            symbol = candidate.technical_setup.symbol
            setup_direction = self._get_setup_direction(candidate.technical_setup)
            
            # Check higher timeframe (daily if current is 4h)
            higher_tf = "1d" if candidate.technical_setup.timeframe == "4h" else "4h"
            
            # Get higher timeframe data
            higher_tf_data = await self.dao.get_market_data_history(
                symbol, higher_tf, limit=50
            )
            
            if len(higher_tf_data) < 20:
                return 0.6  # Neutral if insufficient data
            
            # Simple trend analysis
            recent_closes = [float(md.ohlcv.close) for md in higher_tf_data[:10]]
            older_closes = [float(md.ohlcv.close) for md in higher_tf_data[10:20]]
            
            recent_avg = sum(recent_closes) / len(recent_closes)
            older_avg = sum(older_closes) / len(older_closes)
            
            trend_direction = TradeDirection.LONG if recent_avg > older_avg else TradeDirection.SHORT
            
            # Score based on alignment
            if trend_direction == setup_direction:
                return 0.9  # Good alignment
            else:
                return 0.4  # Poor alignment
                
        except Exception:
            return 0.6  # Neutral if calculation fails
    
    def _calculate_fusion_confidence(self, candidate: SignalCandidate, overall_score: float) -> float:
        """Calculate overall confidence in fusion result"""
        confidence_factors = []
        
        # Technical confidence
        confidence_factors.append(candidate.technical_setup.confidence)
        
        # Sentiment confidence
        if candidate.sentiment_result:
            confidence_factors.append(candidate.sentiment_result.confidence)
        else:
            confidence_factors.append(0.5)  # Lower confidence without sentiment
        
        # Event confidence (based on number and quality of events)
        if candidate.recent_events:
            event_confidences = [event.confidence for event in candidate.recent_events]
            avg_event_confidence = sum(event_confidences) / len(event_confidences)
            confidence_factors.append(avg_event_confidence)
        else:
            confidence_factors.append(0.6)  # Neutral without events
        
        # Data completeness factor
        data_completeness = 0.7  # Base completeness
        if candidate.sentiment_result:
            data_completeness += 0.15
        if candidate.recent_events:
            data_completeness += 0.15
        
        confidence_factors.append(data_completeness)
        
        # Calculate weighted average
        base_confidence = sum(confidence_factors) / len(confidence_factors)
        
        # Adjust based on overall score (higher scores get confidence boost)
        score_adjustment = (overall_score - 0.5) * 0.2
        
        final_confidence = base_confidence + score_adjustment
        return max(0.0, min(1.0, final_confidence))
    
    async def _validate_fusion_criteria(self, candidate: SignalCandidate) -> bool:
        """Validate fusion criteria for signal generation"""
        
        # Criterion 1: Minimum technical score
        if candidate.technical_setup.confidence < self.min_technical_score:
            candidate.rejection_reasons.append(
                f"Technical confidence {candidate.technical_setup.confidence:.3f} below minimum {self.min_technical_score}"
            )
            return False
        
        # Criterion 2: Sentiment alignment (for high-confidence signals)
        if candidate.sentiment_result and candidate.sentiment_result.confidence > 0.7:
            setup_direction = self._get_setup_direction(candidate.technical_setup)
            sentiment = candidate.sentiment_result.sentiment
            
            # Strong sentiment should align with setup direction
            if setup_direction == TradeDirection.LONG and sentiment == Sentiment.NEGATIVE:
                candidate.rejection_reasons.append("Strong negative sentiment conflicts with long setup")
                return False
            elif setup_direction == TradeDirection.SHORT and sentiment == Sentiment.POSITIVE:
                candidate.rejection_reasons.append("Strong positive sentiment conflicts with short setup")
                return False
        
        # Criterion 3: Critical event validation
        critical_events = [
            event for event in candidate.recent_events 
            if event.severity == EventSeverity.CRITICAL
        ]
        
        if len(critical_events) > self.max_negative_events:
            setup_direction = self._get_setup_direction(candidate.technical_setup)
            
            # Check if critical events conflict with setup
            conflicting_events = []
            for event in critical_events:
                if setup_direction == TradeDirection.LONG and event.impact == "BEARISH":
                    conflicting_events.append(event)
                elif setup_direction == TradeDirection.SHORT and event.impact == "BULLISH":
                    conflicting_events.append(event)
            
            if len(conflicting_events) > 1:
                candidate.rejection_reasons.append(
                    f"Too many conflicting critical events: {len(conflicting_events)}"
                )
                return False
        
        return True
    
    def _get_setup_direction(self, setup: TechnicalSetup) -> TradeDirection:
        """Get trade direction from technical setup"""
        long_setups = [
            SetupType.LONG_SUPPORT,
            SetupType.LONG_OVERSOLD,
            SetupType.LONG_BULLISH_CROSS
        ]
        
        return TradeDirection.LONG if setup.setup_type in long_setups else TradeDirection.SHORT
    
    async def _generate_trading_signal(self, candidate: SignalCandidate) -> TradingSignal:
        """Generate final trading signal from validated candidate"""
        
        setup = candidate.technical_setup
        fusion_score = candidate.fusion_score
        
        # Determine signal strength based on fusion score
        if fusion_score.overall_score >= 0.9:
            strength = SignalStrength.VERY_STRONG
        elif fusion_score.overall_score >= 0.8:
            strength = SignalStrength.STRONG
        elif fusion_score.overall_score >= 0.7:
            strength = SignalStrength.MODERATE
        else:
            strength = SignalStrength.WEAK
        
        # Create metadata
        metadata = {
            'fusion_analysis': {
                'technical_score': fusion_score.technical_score,
                'sentiment_score': fusion_score.sentiment_score,
                'event_score': fusion_score.event_score,
                'volume_score': fusion_score.volume_score,
                'timeframe_score': fusion_score.timeframe_score,
                'overall_score': fusion_score.overall_score
            },
            'technical_setup': {
                'setup_type': setup.setup_type.value,
                'technical_confidence': setup.confidence,
                'indicators': setup.indicators,
                'patterns': [p.pattern_name for p in setup.patterns]
            }
        }
        
        # Add sentiment data if available
        if candidate.sentiment_result:
            metadata['sentiment_analysis'] = {
                'sentiment': candidate.sentiment_result.sentiment.value,
                'confidence': candidate.sentiment_result.confidence,
                'key_factors': candidate.sentiment_result.key_factors
            }
        
        # Add event data if available
        if candidate.recent_events:
            metadata['recent_events'] = [
                {
                    'type': event.event_type.value,
                    'severity': event.severity.value,
                    'impact': event.impact,
                    'description': event.description
                }
                for event in candidate.recent_events[:3]  # Top 3 events
            ]
        
        return TradingSignal(
            symbol=setup.symbol,
            direction=self._get_setup_direction(setup),
            confidence=Decimal(str(fusion_score.confidence)),
            strength=strength,
            technical_score=Decimal(str(fusion_score.technical_score)),
            sentiment_score=Decimal(str(fusion_score.sentiment_score)),
            event_impact=Decimal(str(fusion_score.event_score)),
            setup_type=setup.setup_type,
            entry_price=setup.entry_price,
            stop_loss=setup.stop_loss,
            take_profit_levels=setup.take_profit_levels,
            expires_at=datetime.utcnow() + timedelta(hours=4),  # 4-hour expiry
            metadata=metadata
        )
    
    async def _get_cached_signal(self, symbol: str) -> Optional[TradingSignal]:
        """Get cached trading signal"""
        try:
            cache_key = f"trading_signal:{symbol}"
            cached_data = await self.dao.cache.get(cache_key)
            
            if cached_data:
                # Check if signal is still valid (not expired)
                expires_at = datetime.fromisoformat(cached_data['expires_at'])
                if datetime.utcnow() < expires_at:
                    return TradingSignal(
                        id=cached_data['id'],
                        symbol=cached_data['symbol'],
                        direction=TradeDirection(cached_data['direction']),
                        confidence=Decimal(str(cached_data['confidence'])),
                        strength=SignalStrength(cached_data['strength']),
                        technical_score=Decimal(str(cached_data['technical_score'])),
                        sentiment_score=Decimal(str(cached_data['sentiment_score'])),
                        event_impact=Decimal(str(cached_data['event_impact'])),
                        setup_type=SetupType(cached_data['setup_type']),
                        entry_price=Decimal(str(cached_data['entry_price'])) if cached_data['entry_price'] else None,
                        stop_loss=Decimal(str(cached_data['stop_loss'])) if cached_data['stop_loss'] else None,
                        take_profit_levels=[Decimal(str(tp)) for tp in cached_data['take_profit_levels']],
                        timestamp=datetime.fromisoformat(cached_data['timestamp']),
                        expires_at=expires_at,
                        metadata=cached_data['metadata']
                    )
            
            return None
            
        except Exception as e:
            self.logger.warning("Failed to get cached signal", {
                "symbol": symbol,
                "error": str(e)
            })
            return None
    
    async def _cache_signal(self, signal: TradingSignal) -> None:
        """Cache trading signal"""
        try:
            cache_key = f"trading_signal:{signal.symbol}"
            cache_data = {
                'id': signal.id,
                'symbol': signal.symbol,
                'direction': signal.direction.value,
                'confidence': float(signal.confidence),
                'strength': signal.strength.value,
                'technical_score': float(signal.technical_score),
                'sentiment_score': float(signal.sentiment_score),
                'event_impact': float(signal.event_impact),
                'setup_type': signal.setup_type.value,
                'entry_price': float(signal.entry_price) if signal.entry_price else None,
                'stop_loss': float(signal.stop_loss) if signal.stop_loss else None,
                'take_profit_levels': [float(tp) for tp in signal.take_profit_levels],
                'timestamp': signal.timestamp.isoformat(),
                'expires_at': signal.expires_at.isoformat() if signal.expires_at else None,
                'metadata': signal.metadata
            }
            
            await self.dao.cache.set(cache_key, cache_data, ttl=self.signal_cache_ttl)
            
        except Exception as e:
            self.logger.warning("Failed to cache signal", {
                "symbol": signal.symbol,
                "error": str(e)
            })


class SignalRanker:
    """Ranks and prioritizes multiple trading signals"""
    
    def __init__(self):
        self.logger = get_logger("signal_ranker")
    
    def rank_signals(self, signals: List[TradingSignal]) -> List[TradingSignal]:
        """Rank signals by priority and quality"""
        if not signals:
            return []
        
        # Calculate priority scores for each signal
        scored_signals = []
        for signal in signals:
            priority_score = self._calculate_priority_score(signal)
            scored_signals.append((priority_score, signal))
        
        # Sort by priority score (highest first)
        scored_signals.sort(key=lambda x: x[0], reverse=True)
        
        # Return ranked signals
        ranked_signals = [signal for _, signal in scored_signals]
        
        self.logger.debug("Signals ranked", {
            "total_signals": len(signals),
            "top_score": scored_signals[0][0] if scored_signals else 0,
            "score_range": f"{scored_signals[-1][0]:.3f} - {scored_signals[0][0]:.3f}" if len(scored_signals) > 1 else "N/A"
        })
        
        return ranked_signals
    
    def _calculate_priority_score(self, signal: TradingSignal) -> float:
        """Calculate priority score for a signal"""
        score_components = []
        
        # Base confidence score (40% weight)
        confidence_score = float(signal.confidence)
        score_components.append(("confidence", confidence_score, 0.4))
        
        # Signal strength score (25% weight)
        strength_scores = {
            SignalStrength.VERY_STRONG: 1.0,
            SignalStrength.STRONG: 0.8,
            SignalStrength.MODERATE: 0.6,
            SignalStrength.WEAK: 0.4
        }
        strength_score = strength_scores.get(signal.strength, 0.5)
        score_components.append(("strength", strength_score, 0.25))
        
        # Technical score (20% weight)
        technical_score = float(signal.technical_score)
        score_components.append(("technical", technical_score, 0.2))
        
        # Sentiment score (10% weight)
        sentiment_score = float(signal.sentiment_score)
        score_components.append(("sentiment", sentiment_score, 0.1))
        
        # Time decay factor (5% weight)
        time_diff = (datetime.utcnow() - signal.timestamp).total_seconds()
        time_score = max(0.5, 1.0 - (time_diff / 3600))  # Decay over 1 hour
        score_components.append(("time", time_score, 0.05))
        
        # Calculate weighted score
        total_score = sum(score * weight for _, score, weight in score_components)
        
        return min(total_score, 1.0)  # Cap at 1.0
    
    def filter_signals_by_quality(
        self, 
        signals: List[TradingSignal], 
        min_confidence: float = 0.6,
        max_signals: int = 5
    ) -> List[TradingSignal]:
        """Filter signals by quality criteria"""
        
        # Filter by minimum confidence
        quality_signals = [
            signal for signal in signals 
            if float(signal.confidence) >= min_confidence
        ]
        
        # Rank the filtered signals
        ranked_signals = self.rank_signals(quality_signals)
        
        # Return top N signals
        return ranked_signals[:max_signals]