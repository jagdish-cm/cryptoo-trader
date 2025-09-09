"""
Sentiment analysis pipeline with LLM integration for market sentiment and event detection
"""

import asyncio
from typing import List, Dict, Any, Optional, Tuple
from datetime import datetime, timedelta
from dataclasses import dataclass
from enum import Enum
from decimal import Decimal

from ai_trading_system.interfaces.base import Analyzer
from ai_trading_system.services.llm_client import LLMClient, LLMRequest, LLMResponse, PromptType, ContextManager
from ai_trading_system.services.data_storage import DataAccessObject
from ai_trading_system.models.enums import Sentiment, EventType, EventSeverity
from ai_trading_system.utils.logging import get_logger
from ai_trading_system.utils.errors import AnalysisError


@dataclass
class SentimentResult:
    """Sentiment analysis result"""
    symbol: str
    sentiment: Sentiment
    confidence: float
    key_factors: List[str]
    news_sentiment: Sentiment
    social_sentiment: Sentiment
    sentiment_score: float  # -1.0 to 1.0
    analysis_timestamp: datetime
    reasoning: str
    metadata: Dict[str, Any]


@dataclass
class MarketEvent:
    """Market event detection result"""
    symbol: str
    event_type: EventType
    severity: EventSeverity
    description: str
    confidence: float
    impact: str  # BULLISH, BEARISH, NEUTRAL
    timeframe: str  # IMMEDIATE, SHORT_TERM, LONG_TERM
    detection_timestamp: datetime
    metadata: Dict[str, Any]


@dataclass
class SentimentTrend:
    """Sentiment trend analysis"""
    symbol: str
    current_sentiment: Sentiment
    trend_direction: str  # IMPROVING, DECLINING, STABLE
    trend_strength: float  # 0.0 to 1.0
    sentiment_history: List[Tuple[datetime, float]]  # (timestamp, sentiment_score)
    volatility: float
    analysis_period: timedelta


class SentimentAnalyzer(Analyzer):
    """Main sentiment analysis engine"""
    
    def __init__(self, dao: DataAccessObject, llm_client: LLMClient):
        self.dao = dao
        self.llm_client = llm_client
        self.context_manager = ContextManager(dao)
        self.logger = get_logger("sentiment_analyzer")
        
        # Analysis configuration
        self.cache_ttl = 1800  # 30 minutes
        self.min_confidence_threshold = 0.3
        self.sentiment_history_days = 7
        
        # Sentiment scoring
        self.sentiment_scores = {
            Sentiment.POSITIVE: 1.0,
            Sentiment.NEUTRAL: 0.0,
            Sentiment.NEGATIVE: -1.0
        }
    
    async def initialize(self) -> None:
        """Initialize sentiment analyzer"""
        self.logger.info("Sentiment analyzer initialized")
    
    async def analyze(self, symbol: str) -> SentimentResult:
        """Analyze sentiment for a symbol"""
        try:
            # Build context for sentiment analysis
            context_data = await self.context_manager.build_sentiment_context(symbol)
            
            if not context_data:
                raise AnalysisError(
                    f"Failed to build context for sentiment analysis: {symbol}",
                    analyzer="sentiment_analyzer"
                )
            
            # Create LLM request
            request = LLMRequest(
                prompt_type=PromptType.SENTIMENT_ANALYSIS,
                symbol=symbol,
                context_data=context_data,
                metadata={"analysis_type": "sentiment"}
            )
            
            # Get LLM analysis
            llm_response = await self.llm_client.analyze(request)
            
            # Parse sentiment result
            sentiment_result = self._parse_sentiment_response(symbol, llm_response)
            
            # Store result
            await self._store_sentiment_result(sentiment_result)
            
            self.logger.info("Sentiment analysis completed", {
                "symbol": symbol,
                "sentiment": sentiment_result.sentiment.value,
                "confidence": sentiment_result.confidence,
                "sentiment_score": sentiment_result.sentiment_score
            })
            
            return sentiment_result
            
        except Exception as e:
            self.logger.error("Sentiment analysis failed", {
                "symbol": symbol,
                "error": str(e)
            })
            raise AnalysisError(
                f"Sentiment analysis failed for {symbol}",
                analyzer="sentiment_analyzer",
                original_error=e
            )
    
    def _parse_sentiment_response(self, symbol: str, llm_response: LLMResponse) -> SentimentResult:
        """Parse LLM response into SentimentResult"""
        try:
            parsed_data = llm_response.parsed_data
            
            # Extract sentiment
            sentiment_str = parsed_data.get('sentiment', 'NEUTRAL').upper()
            sentiment = Sentiment(sentiment_str.lower())
            
            # Extract other sentiments
            news_sentiment_str = parsed_data.get('news_sentiment', 'NEUTRAL').upper()
            news_sentiment = Sentiment(news_sentiment_str.lower())
            
            social_sentiment_str = parsed_data.get('social_sentiment', 'NEUTRAL').upper()
            social_sentiment = Sentiment(social_sentiment_str.lower())
            
            # Calculate sentiment score
            sentiment_score = self.sentiment_scores.get(sentiment, 0.0)
            
            # Adjust score based on confidence
            sentiment_score *= llm_response.confidence
            
            return SentimentResult(
                symbol=symbol,
                sentiment=sentiment,
                confidence=llm_response.confidence,
                key_factors=parsed_data.get('key_factors', []),
                news_sentiment=news_sentiment,
                social_sentiment=social_sentiment,
                sentiment_score=sentiment_score,
                analysis_timestamp=llm_response.timestamp,
                reasoning=parsed_data.get('reasoning', ''),
                metadata={
                    'llm_model': llm_response.model_used,
                    'processing_time': llm_response.processing_time,
                    'token_usage': llm_response.token_usage,
                    'raw_response': llm_response.response_text
                }
            )
            
        except Exception as e:
            raise AnalysisError(
                "Failed to parse sentiment response",
                analyzer="sentiment_analyzer",
                original_error=e
            )
    
    async def _store_sentiment_result(self, result: SentimentResult) -> None:
        """Store sentiment result in cache and database"""
        try:
            # Cache key
            cache_key = f"sentiment:{result.symbol}"
            
            # Cache data
            cache_data = {
                'symbol': result.symbol,
                'sentiment': result.sentiment.value,
                'confidence': result.confidence,
                'sentiment_score': result.sentiment_score,
                'key_factors': result.key_factors,
                'analysis_timestamp': result.analysis_timestamp.isoformat(),
                'reasoning': result.reasoning
            }
            
            # Store in cache
            await self.dao.cache.set(cache_key, cache_data, ttl=self.cache_ttl)
            
            # Store in database (would need sentiment table)
            # For now, just log
            self.logger.debug("Sentiment result stored", {
                "symbol": result.symbol,
                "sentiment": result.sentiment.value
            })
            
        except Exception as e:
            self.logger.warning("Failed to store sentiment result", {
                "symbol": result.symbol,
                "error": str(e)
            })
    
    async def get_cached_sentiment(self, symbol: str) -> Optional[SentimentResult]:
        """Get cached sentiment result"""
        try:
            cache_key = f"sentiment:{symbol}"
            cached_data = await self.dao.cache.get(cache_key)
            
            if cached_data:
                return SentimentResult(
                    symbol=cached_data['symbol'],
                    sentiment=Sentiment(cached_data['sentiment']),
                    confidence=cached_data['confidence'],
                    key_factors=cached_data['key_factors'],
                    news_sentiment=Sentiment.NEUTRAL,  # Not cached
                    social_sentiment=Sentiment.NEUTRAL,  # Not cached
                    sentiment_score=cached_data['sentiment_score'],
                    analysis_timestamp=datetime.fromisoformat(cached_data['analysis_timestamp']),
                    reasoning=cached_data['reasoning'],
                    metadata={'cached': True}
                )
            
            return None
            
        except Exception as e:
            self.logger.warning("Failed to get cached sentiment", {
                "symbol": symbol,
                "error": str(e)
            })
            return None
    
    async def analyze_sentiment_trend(self, symbol: str, days: int = 7) -> SentimentTrend:
        """Analyze sentiment trend over time"""
        try:
            # Get historical sentiment data (mock for now)
            sentiment_history = await self._get_sentiment_history(symbol, days)
            
            if len(sentiment_history) < 2:
                # Not enough data for trend analysis
                current_sentiment = await self.analyze(symbol)
                return SentimentTrend(
                    symbol=symbol,
                    current_sentiment=current_sentiment.sentiment,
                    trend_direction="STABLE",
                    trend_strength=0.0,
                    sentiment_history=[(datetime.utcnow(), current_sentiment.sentiment_score)],
                    volatility=0.0,
                    analysis_period=timedelta(days=days)
                )
            
            # Calculate trend
            recent_scores = [score for _, score in sentiment_history[-3:]]
            older_scores = [score for _, score in sentiment_history[:3]]
            
            recent_avg = sum(recent_scores) / len(recent_scores)
            older_avg = sum(older_scores) / len(older_scores)
            
            trend_change = recent_avg - older_avg
            
            if trend_change > 0.1:
                trend_direction = "IMPROVING"
            elif trend_change < -0.1:
                trend_direction = "DECLINING"
            else:
                trend_direction = "STABLE"
            
            trend_strength = min(abs(trend_change), 1.0)
            
            # Calculate volatility
            all_scores = [score for _, score in sentiment_history]
            if len(all_scores) > 1:
                mean_score = sum(all_scores) / len(all_scores)
                variance = sum((score - mean_score) ** 2 for score in all_scores) / len(all_scores)
                volatility = variance ** 0.5
            else:
                volatility = 0.0
            
            # Current sentiment
            current_sentiment = Sentiment.POSITIVE if recent_avg > 0.1 else (
                Sentiment.NEGATIVE if recent_avg < -0.1 else Sentiment.NEUTRAL
            )
            
            return SentimentTrend(
                symbol=symbol,
                current_sentiment=current_sentiment,
                trend_direction=trend_direction,
                trend_strength=trend_strength,
                sentiment_history=sentiment_history,
                volatility=volatility,
                analysis_period=timedelta(days=days)
            )
            
        except Exception as e:
            self.logger.error("Sentiment trend analysis failed", {
                "symbol": symbol,
                "error": str(e)
            })
            raise AnalysisError(
                f"Sentiment trend analysis failed for {symbol}",
                analyzer="sentiment_analyzer",
                original_error=e
            )
    
    async def _get_sentiment_history(self, symbol: str, days: int) -> List[Tuple[datetime, float]]:
        """Get historical sentiment data (mock implementation)"""
        # This would query actual sentiment history from database
        # For now, generate mock data
        import random
        
        history = []
        base_date = datetime.utcnow() - timedelta(days=days)
        
        for i in range(days):
            timestamp = base_date + timedelta(days=i)
            # Generate mock sentiment score with some trend
            score = random.uniform(-0.5, 0.5) + (i / days) * 0.3  # Slight upward trend
            history.append((timestamp, score))
        
        return history


class EventDetector(Analyzer):
    """Market event detection engine"""
    
    def __init__(self, dao: DataAccessObject, llm_client: LLMClient):
        self.dao = dao
        self.llm_client = llm_client
        self.context_manager = ContextManager(dao)
        self.logger = get_logger("event_detector")
        
        # Event configuration
        self.cache_ttl = 3600  # 1 hour
        self.min_event_confidence = 0.4
        
        # Event impact scoring
        self.impact_scores = {
            "BULLISH": 1.0,
            "NEUTRAL": 0.0,
            "BEARISH": -1.0
        }
    
    async def initialize(self) -> None:
        """Initialize event detector"""
        self.logger.info("Event detector initialized")
    
    async def analyze(self, symbol: str) -> List[MarketEvent]:
        """Detect market events for a symbol"""
        try:
            # Build context for event detection
            context_data = await self.context_manager.build_event_context(symbol)
            
            if not context_data:
                self.logger.warning("No context data for event detection", {"symbol": symbol})
                return []
            
            # Create LLM request
            request = LLMRequest(
                prompt_type=PromptType.EVENT_DETECTION,
                symbol=symbol,
                context_data=context_data,
                metadata={"analysis_type": "event_detection"}
            )
            
            # Get LLM analysis
            llm_response = await self.llm_client.analyze(request)
            
            # Parse events
            events = self._parse_event_response(symbol, llm_response)
            
            # Filter events by confidence
            filtered_events = [
                event for event in events 
                if event.confidence >= self.min_event_confidence
            ]
            
            # Store events
            for event in filtered_events:
                await self._store_event(event)
            
            self.logger.info("Event detection completed", {
                "symbol": symbol,
                "events_detected": len(filtered_events),
                "total_events": len(events)
            })
            
            return filtered_events
            
        except Exception as e:
            self.logger.error("Event detection failed", {
                "symbol": symbol,
                "error": str(e)
            })
            raise AnalysisError(
                f"Event detection failed for {symbol}",
                analyzer="event_detector",
                original_error=e
            )
    
    def _parse_event_response(self, symbol: str, llm_response: LLMResponse) -> List[MarketEvent]:
        """Parse LLM response into MarketEvent objects"""
        try:
            parsed_data = llm_response.parsed_data
            events_data = parsed_data.get('events_detected', [])
            
            events = []
            for event_data in events_data:
                try:
                    # Map event type
                    event_type_str = event_data.get('event_type', 'OTHER').upper()
                    event_type = self._map_event_type(event_type_str)
                    
                    # Map severity
                    severity_str = event_data.get('severity', 'MEDIUM').upper()
                    severity = EventSeverity(severity_str.lower())
                    
                    event = MarketEvent(
                        symbol=symbol,
                        event_type=event_type,
                        severity=severity,
                        description=event_data.get('description', ''),
                        confidence=float(event_data.get('confidence', 0.5)),
                        impact=event_data.get('impact', 'NEUTRAL').upper(),
                        timeframe=event_data.get('timeframe', 'SHORT_TERM').upper(),
                        detection_timestamp=llm_response.timestamp,
                        metadata={
                            'llm_model': llm_response.model_used,
                            'processing_time': llm_response.processing_time,
                            'overall_risk_level': parsed_data.get('overall_risk_level', 'MEDIUM'),
                            'recommendation': parsed_data.get('recommendation', '')
                        }
                    )
                    events.append(event)
                    
                except Exception as e:
                    self.logger.warning("Failed to parse individual event", {
                        "event_data": event_data,
                        "error": str(e)
                    })
                    continue
            
            return events
            
        except Exception as e:
            self.logger.error("Failed to parse event response", {"error": str(e)})
            return []
    
    def _map_event_type(self, event_type_str: str) -> EventType:
        """Map string event type to EventType enum"""
        type_mapping = {
            'HACK': EventType.HACK,
            'REGULATION': EventType.REGULATION,
            'PARTNERSHIP': EventType.PARTNERSHIP,
            'UPGRADE': EventType.UPGRADE,
            'UNLOCK': EventType.UNLOCK,
            'LISTING': EventType.LISTING,
            'DELISTING': EventType.DELISTING,
            'WHALE': EventType.OTHER,  # Map to OTHER for now
            'MANIPULATION': EventType.OTHER,
            'OTHER': EventType.OTHER
        }
        
        return type_mapping.get(event_type_str, EventType.OTHER)
    
    async def _store_event(self, event: MarketEvent) -> None:
        """Store market event"""
        try:
            # Cache key
            cache_key = f"event:{event.symbol}:{event.event_type.value}:{int(event.detection_timestamp.timestamp())}"
            
            # Cache data
            cache_data = {
                'symbol': event.symbol,
                'event_type': event.event_type.value,
                'severity': event.severity.value,
                'description': event.description,
                'confidence': event.confidence,
                'impact': event.impact,
                'timeframe': event.timeframe,
                'detection_timestamp': event.detection_timestamp.isoformat()
            }
            
            # Store in cache
            await self.dao.cache.set(cache_key, cache_data, ttl=self.cache_ttl)
            
            self.logger.debug("Event stored", {
                "symbol": event.symbol,
                "event_type": event.event_type.value,
                "severity": event.severity.value
            })
            
        except Exception as e:
            self.logger.warning("Failed to store event", {
                "symbol": event.symbol,
                "error": str(e)
            })
    
    async def get_recent_events(self, symbol: str, hours: int = 24) -> List[MarketEvent]:
        """Get recent events for a symbol"""
        try:
            # Get events from cache (simplified implementation)
            pattern = f"event:{symbol}:*"
            event_keys = await self.dao.cache.keys(pattern)
            
            events = []
            cutoff_time = datetime.utcnow() - timedelta(hours=hours)
            
            for key in event_keys:
                event_data = await self.dao.cache.get(key)
                if event_data:
                    detection_time = datetime.fromisoformat(event_data['detection_timestamp'])
                    
                    if detection_time >= cutoff_time:
                        event = MarketEvent(
                            symbol=event_data['symbol'],
                            event_type=EventType(event_data['event_type']),
                            severity=EventSeverity(event_data['severity']),
                            description=event_data['description'],
                            confidence=event_data['confidence'],
                            impact=event_data['impact'],
                            timeframe=event_data['timeframe'],
                            detection_timestamp=detection_time,
                            metadata={}
                        )
                        events.append(event)
            
            # Sort by detection time (newest first)
            events.sort(key=lambda x: x.detection_timestamp, reverse=True)
            
            return events
            
        except Exception as e:
            self.logger.error("Failed to get recent events", {
                "symbol": symbol,
                "error": str(e)
            })
            return []


class SentimentAggregator:
    """Aggregates sentiment from multiple sources and timeframes"""
    
    def __init__(self, sentiment_analyzer: SentimentAnalyzer, event_detector: EventDetector):
        self.sentiment_analyzer = sentiment_analyzer
        self.event_detector = event_detector
        self.logger = get_logger("sentiment_aggregator")
    
    async def get_comprehensive_sentiment(self, symbol: str) -> Dict[str, Any]:
        """Get comprehensive sentiment analysis including events"""
        try:
            # Get current sentiment
            sentiment_result = await self.sentiment_analyzer.analyze(symbol)
            
            # Get recent events
            recent_events = await self.event_detector.get_recent_events(symbol, hours=24)
            
            # Get sentiment trend
            sentiment_trend = await self.sentiment_analyzer.analyze_sentiment_trend(symbol)
            
            # Calculate event impact
            event_impact = self._calculate_event_impact(recent_events)
            
            # Aggregate overall sentiment
            overall_sentiment = self._aggregate_sentiment(
                sentiment_result, sentiment_trend, event_impact
            )
            
            return {
                'symbol': symbol,
                'current_sentiment': {
                    'sentiment': sentiment_result.sentiment.value,
                    'confidence': sentiment_result.confidence,
                    'score': sentiment_result.sentiment_score,
                    'key_factors': sentiment_result.key_factors
                },
                'sentiment_trend': {
                    'direction': sentiment_trend.trend_direction,
                    'strength': sentiment_trend.trend_strength,
                    'volatility': sentiment_trend.volatility
                },
                'recent_events': [
                    {
                        'type': event.event_type.value,
                        'severity': event.severity.value,
                        'impact': event.impact,
                        'confidence': event.confidence,
                        'description': event.description
                    }
                    for event in recent_events[:5]  # Top 5 events
                ],
                'event_impact': event_impact,
                'overall_sentiment': overall_sentiment,
                'analysis_timestamp': datetime.utcnow().isoformat()
            }
            
        except Exception as e:
            self.logger.error("Comprehensive sentiment analysis failed", {
                "symbol": symbol,
                "error": str(e)
            })
            raise AnalysisError(
                f"Comprehensive sentiment analysis failed for {symbol}",
                analyzer="sentiment_aggregator",
                original_error=e
            )
    
    def _calculate_event_impact(self, events: List[MarketEvent]) -> Dict[str, Any]:
        """Calculate overall impact of recent events"""
        if not events:
            return {
                'impact_score': 0.0,
                'impact_direction': 'NEUTRAL',
                'critical_events': 0,
                'high_impact_events': 0
            }
        
        # Calculate weighted impact score
        total_impact = 0.0
        total_weight = 0.0
        critical_events = 0
        high_impact_events = 0
        
        for event in events:
            # Weight by confidence and severity
            severity_weights = {
                EventSeverity.LOW: 0.25,
                EventSeverity.MEDIUM: 0.5,
                EventSeverity.HIGH: 0.75,
                EventSeverity.CRITICAL: 1.0
            }
            
            weight = severity_weights.get(event.severity, 0.5) * event.confidence
            impact_score = self.event_detector.impact_scores.get(event.impact, 0.0)
            
            total_impact += impact_score * weight
            total_weight += weight
            
            if event.severity == EventSeverity.CRITICAL:
                critical_events += 1
            elif event.severity == EventSeverity.HIGH:
                high_impact_events += 1
        
        # Calculate average impact
        avg_impact = total_impact / total_weight if total_weight > 0 else 0.0
        
        # Determine impact direction
        if avg_impact > 0.1:
            impact_direction = 'BULLISH'
        elif avg_impact < -0.1:
            impact_direction = 'BEARISH'
        else:
            impact_direction = 'NEUTRAL'
        
        return {
            'impact_score': avg_impact,
            'impact_direction': impact_direction,
            'critical_events': critical_events,
            'high_impact_events': high_impact_events,
            'total_events': len(events)
        }
    
    def _aggregate_sentiment(
        self, 
        sentiment_result: SentimentResult, 
        sentiment_trend: SentimentTrend, 
        event_impact: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Aggregate overall sentiment from all sources"""
        
        # Base sentiment score
        base_score = sentiment_result.sentiment_score
        
        # Trend adjustment
        trend_adjustment = 0.0
        if sentiment_trend.trend_direction == "IMPROVING":
            trend_adjustment = sentiment_trend.trend_strength * 0.2
        elif sentiment_trend.trend_direction == "DECLINING":
            trend_adjustment = -sentiment_trend.trend_strength * 0.2
        
        # Event impact adjustment
        event_adjustment = event_impact['impact_score'] * 0.3
        
        # Calculate final score
        final_score = base_score + trend_adjustment + event_adjustment
        final_score = max(-1.0, min(1.0, final_score))  # Clamp to [-1, 1]
        
        # Determine overall sentiment
        if final_score > 0.2:
            overall_sentiment = 'POSITIVE'
        elif final_score < -0.2:
            overall_sentiment = 'NEGATIVE'
        else:
            overall_sentiment = 'NEUTRAL'
        
        # Calculate confidence
        confidence_factors = [
            sentiment_result.confidence,
            1.0 - sentiment_trend.volatility,  # Lower volatility = higher confidence
            min(event_impact.get('total_events', 0) / 5.0, 1.0)  # More events = more data
        ]
        
        overall_confidence = sum(confidence_factors) / len(confidence_factors)
        
        return {
            'sentiment': overall_sentiment,
            'score': final_score,
            'confidence': overall_confidence,
            'components': {
                'base_sentiment': base_score,
                'trend_adjustment': trend_adjustment,
                'event_adjustment': event_adjustment
            }
        }