"""
LLM client for sentiment analysis and event detection with OpenAI integration
"""

import asyncio
import json
from typing import Dict, List, Any, Optional, Union
from datetime import datetime, timedelta
from dataclasses import dataclass
from enum import Enum
import time

# OpenAI imports (optional)
try:
    import openai
    from openai import AsyncOpenAI
    OPENAI_AVAILABLE = True
except ImportError:
    OPENAI_AVAILABLE = False
    openai = None
    AsyncOpenAI = None

from ai_trading_system.config.settings import LLMConfig
from ai_trading_system.services.data_storage import RedisCache
from ai_trading_system.services.ollama_client import OllamaClient
from ai_trading_system.utils.logging import get_logger
from ai_trading_system.utils.errors import AnalysisError, RateLimitError, NetworkError


class PromptType(str, Enum):
    """Types of LLM prompts"""
    SENTIMENT_ANALYSIS = "sentiment_analysis"
    EVENT_DETECTION = "event_detection"
    NEWS_ANALYSIS = "news_analysis"
    SOCIAL_ANALYSIS = "social_analysis"
    MARKET_SUMMARY = "market_summary"


@dataclass
class LLMRequest:
    """LLM request structure"""
    prompt_type: PromptType
    symbol: str
    context_data: Dict[str, Any]
    max_tokens: Optional[int] = None
    temperature: Optional[float] = None
    metadata: Optional[Dict[str, Any]] = None


@dataclass
class LLMResponse:
    """LLM response structure"""
    request_id: str
    prompt_type: PromptType
    symbol: str
    response_text: str
    parsed_data: Dict[str, Any]
    confidence: float
    processing_time: float
    timestamp: datetime
    model_used: str
    token_usage: Dict[str, int]


class PromptManager:
    """Manages LLM prompts and templates"""
    
    def __init__(self, config: LLMConfig):
        self.config = config
        self.logger = get_logger("prompt_manager")
        
        # Load prompt templates
        self.templates = self._load_prompt_templates()
        
        # Context management
        self.context_window = 4000  # Max context tokens
        self.max_context_age_hours = 24
    
    def _load_prompt_templates(self) -> Dict[PromptType, str]:
        """Load prompt templates for different analysis types"""
        return {
            PromptType.SENTIMENT_ANALYSIS: """
Analyze the sentiment for cryptocurrency {symbol} based on the following data:

Recent News Headlines:
{news_headlines}

Social Media Posts:
{social_posts}

Market Context:
- Current Price: ${current_price}
- 24h Change: {price_change_24h}%
- Volume: {volume}

Instructions:
1. Analyze the overall sentiment (POSITIVE, NEGATIVE, or NEUTRAL)
2. Provide a confidence score (0.0 to 1.0)
3. Identify key sentiment drivers
4. Consider both news and social media sentiment

Respond in JSON format:
{{
    "sentiment": "POSITIVE|NEGATIVE|NEUTRAL",
    "confidence": 0.0-1.0,
    "key_factors": ["factor1", "factor2", ...],
    "news_sentiment": "POSITIVE|NEGATIVE|NEUTRAL",
    "social_sentiment": "POSITIVE|NEGATIVE|NEUTRAL",
    "reasoning": "Brief explanation of the sentiment analysis"
}}
""",
            
            PromptType.EVENT_DETECTION: """
Analyze the following data for cryptocurrency {symbol} to detect critical market events:

Recent News:
{news_data}

Social Media Activity:
{social_data}

Price Action Context:
- Current Price: ${current_price}
- Recent High: ${recent_high}
- Recent Low: ${recent_low}
- Volatility: {volatility}%

Look for these types of events:
- Security breaches/hacks
- Regulatory announcements
- Major partnerships
- Technical upgrades
- Token unlocks/vesting
- Exchange listings/delistings
- Whale movements
- Market manipulation

Respond in JSON format:
{{
    "events_detected": [
        {{
            "event_type": "HACK|REGULATION|PARTNERSHIP|UPGRADE|UNLOCK|LISTING|WHALE|MANIPULATION|OTHER",
            "severity": "LOW|MEDIUM|HIGH|CRITICAL",
            "description": "Brief description",
            "confidence": 0.0-1.0,
            "impact": "BULLISH|BEARISH|NEUTRAL",
            "timeframe": "IMMEDIATE|SHORT_TERM|LONG_TERM"
        }}
    ],
    "overall_risk_level": "LOW|MEDIUM|HIGH|CRITICAL",
    "recommendation": "Brief trading recommendation"
}}
""",
            
            PromptType.NEWS_ANALYSIS: """
Analyze the following news articles for cryptocurrency {symbol}:

{news_articles}

Market Context:
- Symbol: {symbol}
- Current Price: ${current_price}
- Market Cap Rank: #{market_cap_rank}

For each article, assess:
1. Relevance to {symbol} (0.0 to 1.0)
2. Sentiment impact (POSITIVE, NEGATIVE, NEUTRAL)
3. Credibility of source (0.0 to 1.0)
4. Potential market impact (LOW, MEDIUM, HIGH)

Respond in JSON format:
{{
    "articles_analysis": [
        {{
            "title": "Article title",
            "relevance": 0.0-1.0,
            "sentiment": "POSITIVE|NEGATIVE|NEUTRAL",
            "credibility": 0.0-1.0,
            "impact": "LOW|MEDIUM|HIGH",
            "key_points": ["point1", "point2"]
        }}
    ],
    "overall_sentiment": "POSITIVE|NEGATIVE|NEUTRAL",
    "confidence": 0.0-1.0,
    "summary": "Brief summary of news impact"
}}
""",
            
            PromptType.SOCIAL_ANALYSIS: """
Analyze social media sentiment for cryptocurrency {symbol}:

Twitter/X Posts:
{twitter_posts}

Reddit Posts:
{reddit_posts}

Telegram/Discord Activity:
{chat_activity}

Analysis Requirements:
1. Overall social sentiment
2. Sentiment trend (improving/declining)
3. Influence level of posts (based on engagement)
4. Key themes and topics
5. Potential FUD or FOMO indicators

Respond in JSON format:
{{
    "social_sentiment": "POSITIVE|NEGATIVE|NEUTRAL",
    "sentiment_strength": 0.0-1.0,
    "sentiment_trend": "IMPROVING|DECLINING|STABLE",
    "influence_level": "LOW|MEDIUM|HIGH",
    "key_themes": ["theme1", "theme2"],
    "fud_indicators": ["indicator1", "indicator2"],
    "fomo_indicators": ["indicator1", "indicator2"],
    "engagement_metrics": {{
        "high_engagement_posts": 0,
        "total_posts_analyzed": 0,
        "avg_sentiment_score": 0.0
    }}
}}
""",
            
            PromptType.MARKET_SUMMARY: """
Provide a comprehensive market analysis summary for {symbol}:

Technical Analysis:
{technical_data}

Fundamental Data:
{fundamental_data}

News & Events:
{news_events}

Social Sentiment:
{social_sentiment}

Create a trading-focused summary that includes:
1. Overall market outlook
2. Key support/resistance levels
3. Sentiment analysis
4. Risk factors
5. Trading recommendations

Respond in JSON format:
{{
    "market_outlook": "BULLISH|BEARISH|NEUTRAL",
    "outlook_confidence": 0.0-1.0,
    "key_levels": {{
        "support": [price1, price2],
        "resistance": [price1, price2]
    }},
    "sentiment_summary": "Brief sentiment overview",
    "risk_factors": ["risk1", "risk2"],
    "opportunities": ["opportunity1", "opportunity2"],
    "trading_bias": "LONG|SHORT|NEUTRAL",
    "time_horizon": "SHORT_TERM|MEDIUM_TERM|LONG_TERM",
    "summary": "Comprehensive market summary"
}}
"""
        }
    
    def build_prompt(self, request: LLMRequest) -> str:
        """Build prompt from template and context data"""
        template = self.templates.get(request.prompt_type)
        if not template:
            raise AnalysisError(
                f"No template found for prompt type: {request.prompt_type}",
                analyzer="prompt_manager"
            )
        
        try:
            # Format template with context data
            formatted_prompt = template.format(
                symbol=request.symbol,
                **request.context_data
            )
            
            return formatted_prompt
            
        except KeyError as e:
            raise AnalysisError(
                f"Missing context data for prompt: {e}",
                analyzer="prompt_manager"
            )
    
    def validate_context_data(self, prompt_type: PromptType, context_data: Dict[str, Any]) -> bool:
        """Validate that context data contains required fields"""
        required_fields = {
            PromptType.SENTIMENT_ANALYSIS: ['news_headlines', 'social_posts', 'current_price'],
            PromptType.EVENT_DETECTION: ['news_data', 'social_data', 'current_price'],
            PromptType.NEWS_ANALYSIS: ['news_articles', 'current_price'],
            PromptType.SOCIAL_ANALYSIS: ['twitter_posts', 'reddit_posts'],
            PromptType.MARKET_SUMMARY: ['technical_data', 'news_events']
        }
        
        required = required_fields.get(prompt_type, [])
        missing_fields = [field for field in required if field not in context_data]
        
        if missing_fields:
            self.logger.warning("Missing required context fields", {
                "prompt_type": prompt_type.value,
                "missing_fields": missing_fields
            })
            return False
        
        return True


class LLMClient:
    """Multi-provider LLM client with support for OpenAI and Ollama"""
    
    def __init__(self, config: LLMConfig, cache: Optional[RedisCache] = None):
        self.config = config
        self.cache = cache
        self.logger = get_logger("llm_client")
        
        # Determine provider
        self.provider = self._determine_provider()
        
        # Initialize appropriate client
        self.openai_client = None
        self.ollama_client = None
        
        if self.provider == "openai":
            if not OPENAI_AVAILABLE:
                raise AnalysisError(
                    "OpenAI provider requested but openai package not installed",
                    analyzer="llm_client"
                )
            if not config.api_key:
                raise AnalysisError(
                    "OpenAI API key required for OpenAI provider",
                    analyzer="llm_client"
                )
            self.openai_client = AsyncOpenAI(api_key=config.api_key)
            
        elif self.provider == "ollama":
            self.ollama_client = OllamaClient(config)
        
        # Rate limiting (mainly for OpenAI)
        self.rate_limiter = self._create_rate_limiter() if self.provider == "openai" else None
        
        # Request tracking
        self.request_count = 0
        self.total_tokens_used = 0
        self.last_request_time = None
        
        # Prompt manager
        self.prompt_manager = PromptManager(config)
        
        self.logger.info("LLM client initialized", {
            "provider": self.provider,
            "model": config.model_name if self.provider == "openai" else config.ollama_model
        })
    
    def _determine_provider(self) -> str:
        """Determine which LLM provider to use"""
        if self.config.provider == "auto":
            # Auto-detect based on available configuration
            if self.config.api_key and OPENAI_AVAILABLE:
                return "openai"
            else:
                return "ollama"
        elif self.config.provider == "openai":
            return "openai"
        elif self.config.provider == "ollama":
            return "ollama"
        else:
            raise AnalysisError(
                f"Unknown LLM provider: {self.config.provider}",
                analyzer="llm_client"
            )
    
    async def health_check(self) -> bool:
        """Check if the LLM service is available"""
        try:
            if self.provider == "openai" and self.openai_client:
                # Simple test request to OpenAI
                response = await self.openai_client.chat.completions.create(
                    model=self.config.model_name,
                    messages=[{"role": "user", "content": "Hello"}],
                    max_tokens=5
                )
                return bool(response.choices)
                
            elif self.provider == "ollama" and self.ollama_client:
                return await self.ollama_client.health_check()
                
            return False
            
        except Exception as e:
            self.logger.error("LLM health check failed", {
                "provider": self.provider,
                "error": str(e)
            })
            return False
    
    def _create_rate_limiter(self) -> 'RateLimiter':
        """Create rate limiter for API requests"""
        from ai_trading_system.services.exchange_client import RateLimiter
        
        # Convert requests per minute to requests per second
        requests_per_second = self.config.requests_per_minute / 60.0
        
        return RateLimiter(
            requests_per_second=requests_per_second,
            requests_per_minute=self.config.requests_per_minute
        )
    
    async def analyze(self, request: LLMRequest) -> LLMResponse:
        """Perform LLM analysis with caching and rate limiting"""
        request_id = self._generate_request_id(request)
        
        try:
            # Check cache first
            if self.cache:
                cached_response = await self._get_cached_response(request_id)
                if cached_response:
                    self.logger.debug("Using cached LLM response", {
                        "request_id": request_id,
                        "symbol": request.symbol,
                        "prompt_type": request.prompt_type.value
                    })
                    return cached_response
            
            # Validate context data
            if not self.prompt_manager.validate_context_data(request.prompt_type, request.context_data):
                raise AnalysisError(
                    "Invalid context data for LLM request",
                    analyzer="llm_client"
                )
            
            # Build prompt
            prompt = self.prompt_manager.build_prompt(request)
            
            # Make API request with rate limiting (OpenAI only)
            if self.rate_limiter:
                await self.rate_limiter.acquire()
            
            start_time = time.time()
            api_response = await self._make_api_request(prompt, request)
            processing_time = time.time() - start_time
            
            # Parse response
            response = self._parse_api_response(
                request_id, request, api_response, processing_time
            )
            
            # Cache response
            if self.cache:
                await self._cache_response(request_id, response)
            
            # Update statistics
            self._update_statistics(response)
            
            self.logger.info("LLM analysis completed", {
                "request_id": request_id,
                "symbol": request.symbol,
                "prompt_type": request.prompt_type.value,
                "processing_time": processing_time,
                "tokens_used": response.token_usage.get('total_tokens', 0)
            })
            
            return response
            
        except Exception as e:
            self.logger.error("LLM analysis failed", {
                "request_id": request_id,
                "symbol": request.symbol,
                "prompt_type": request.prompt_type.value,
                "error": str(e)
            })
            raise AnalysisError(
                f"LLM analysis failed for {request.symbol}",
                analyzer="llm_client",
                original_error=e
            )
    
    async def _make_api_request(self, prompt: str, request: LLMRequest) -> Any:
        """Make API request to the configured LLM provider"""
        system_prompt = "You are a professional cryptocurrency market analyst. Provide accurate, objective analysis based on the given data. Always respond in the requested JSON format."
        
        if self.provider == "openai":
            return await self._make_openai_request(prompt, request, system_prompt)
        elif self.provider == "ollama":
            return await self._make_ollama_request(prompt, request, system_prompt)
        else:
            raise AnalysisError(
                f"Unsupported provider: {self.provider}",
                analyzer="llm_client"
            )
    
    async def _make_openai_request(self, prompt: str, request: LLMRequest, system_prompt: str) -> Any:
        """Make API request to OpenAI"""
        try:
            if not self.openai_client:
                raise AnalysisError(
                    "OpenAI client not initialized",
                    analyzer="llm_client"
                )
            
            response = await self.openai_client.chat.completions.create(
                model=self.config.model_name,
                messages=[
                    {
                        "role": "system",
                        "content": system_prompt
                    },
                    {
                        "role": "user",
                        "content": prompt
                    }
                ],
                max_tokens=request.max_tokens or self.config.max_tokens,
                temperature=request.temperature or self.config.temperature,
                timeout=self.config.timeout
            )
            
            return response
            
        except openai.RateLimitError as e:
            raise RateLimitError(
                service="openai",
                retry_after=60,  # Default retry after 1 minute
                original_error=e
            )
        except openai.APITimeoutError as e:
            raise NetworkError(
                "OpenAI API timeout",
                endpoint="openai_api",
                original_error=e
            )
        except Exception as e:
            raise AnalysisError(
                "OpenAI API request failed",
                analyzer="llm_client",
                original_error=e
            )
    
    async def _make_ollama_request(self, prompt: str, request: LLMRequest, system_prompt: str) -> Any:
        """Make API request to Ollama"""
        try:
            if not self.ollama_client:
                raise AnalysisError(
                    "Ollama client not initialized",
                    analyzer="llm_client"
                )
            
            # Try chat completion first (if supported by model)
            try:
                messages = [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": prompt}
                ]
                
                response = await self.ollama_client.chat_completion(
                    messages=messages,
                    max_tokens=request.max_tokens or self.config.max_tokens,
                    temperature=request.temperature or self.config.temperature
                )
                
                # Convert Ollama response to OpenAI-like format for compatibility
                return self._convert_ollama_response(response, "chat")
                
            except Exception:
                # Fallback to generate completion
                full_prompt = f"{system_prompt}\n\nUser: {prompt}\n\nAssistant:"
                
                response = await self.ollama_client.generate_completion(
                    prompt=full_prompt,
                    max_tokens=request.max_tokens or self.config.max_tokens,
                    temperature=request.temperature or self.config.temperature
                )
                
                return self._convert_ollama_response(response, "generate")
                
        except NetworkError:
            # Re-raise network errors as-is
            raise
        except Exception as e:
            raise AnalysisError(
                "Ollama API request failed",
                analyzer="llm_client",
                original_error=e
            )
    
    def _convert_ollama_response(self, ollama_response: Dict[str, Any], response_type: str) -> Any:
        """Convert Ollama response to OpenAI-compatible format"""
        class MockChoice:
            def __init__(self, content: str):
                self.message = MockMessage(content)
        
        class MockMessage:
            def __init__(self, content: str):
                self.content = content
        
        class MockUsage:
            def __init__(self, prompt_tokens: int = 0, completion_tokens: int = 0):
                self.prompt_tokens = prompt_tokens
                self.completion_tokens = completion_tokens
                self.total_tokens = prompt_tokens + completion_tokens
        
        class MockResponse:
            def __init__(self, content: str, model: str, usage: MockUsage):
                self.choices = [MockChoice(content)]
                self.model = model
                self.usage = usage
        
        # Extract content from Ollama response
        content = ollama_response.get('response', '')
        model = ollama_response.get('model', self.config.ollama_model)
        
        # Estimate token usage (rough approximation)
        prompt_tokens = ollama_response.get('prompt_eval_count', 0)
        completion_tokens = ollama_response.get('eval_count', 0)
        
        if prompt_tokens == 0 and completion_tokens == 0:
            # Fallback estimation: ~4 characters per token
            completion_tokens = len(content) // 4
            prompt_tokens = 100  # Rough estimate
        
        usage = MockUsage(prompt_tokens, completion_tokens)
        
        return MockResponse(content, model, usage)
    
    def _parse_api_response(
        self, 
        request_id: str, 
        request: LLMRequest, 
        api_response: Any, 
        processing_time: float
    ) -> LLMResponse:
        """Parse OpenAI API response"""
        try:
            # Extract response text
            response_text = api_response.choices[0].message.content
            
            # Parse JSON response
            try:
                parsed_data = json.loads(response_text)
                confidence = self._calculate_response_confidence(parsed_data, request.prompt_type)
            except json.JSONDecodeError:
                # Fallback for non-JSON responses
                parsed_data = {"raw_response": response_text}
                confidence = 0.5
            
            # Extract token usage
            token_usage = {
                "prompt_tokens": api_response.usage.prompt_tokens,
                "completion_tokens": api_response.usage.completion_tokens,
                "total_tokens": api_response.usage.total_tokens
            }
            
            return LLMResponse(
                request_id=request_id,
                prompt_type=request.prompt_type,
                symbol=request.symbol,
                response_text=response_text,
                parsed_data=parsed_data,
                confidence=confidence,
                processing_time=processing_time,
                timestamp=datetime.utcnow(),
                model_used=api_response.model,
                token_usage=token_usage
            )
            
        except Exception as e:
            raise AnalysisError(
                "Failed to parse LLM response",
                analyzer="llm_client",
                original_error=e
            )
    
    def _calculate_response_confidence(self, parsed_data: Dict[str, Any], prompt_type: PromptType) -> float:
        """Calculate confidence in LLM response based on content"""
        # Check if response has explicit confidence
        if 'confidence' in parsed_data:
            return float(parsed_data['confidence'])
        
        # Calculate confidence based on response completeness
        confidence_factors = []
        
        if prompt_type == PromptType.SENTIMENT_ANALYSIS:
            required_fields = ['sentiment', 'key_factors']
            present_fields = sum(1 for field in required_fields if field in parsed_data)
            confidence_factors.append(present_fields / len(required_fields))
        
        elif prompt_type == PromptType.EVENT_DETECTION:
            if 'events_detected' in parsed_data:
                events = parsed_data['events_detected']
                if isinstance(events, list) and len(events) > 0:
                    confidence_factors.append(0.8)
                else:
                    confidence_factors.append(0.6)
            else:
                confidence_factors.append(0.4)
        
        # Default confidence calculation
        if not confidence_factors:
            confidence_factors.append(0.7)  # Default moderate confidence
        
        return sum(confidence_factors) / len(confidence_factors)
    
    def _generate_request_id(self, request: LLMRequest) -> str:
        """Generate unique request ID for caching"""
        import hashlib
        
        # Create hash from request parameters
        request_str = f"{request.prompt_type.value}:{request.symbol}:{hash(str(request.context_data))}"
        return hashlib.md5(request_str.encode()).hexdigest()
    
    async def _get_cached_response(self, request_id: str) -> Optional[LLMResponse]:
        """Get cached LLM response"""
        if not self.cache:
            return None
        
        try:
            cache_key = f"llm_response:{request_id}"
            cached_data = await self.cache.get(cache_key)
            
            if cached_data:
                # Deserialize cached response
                return LLMResponse(
                    request_id=cached_data['request_id'],
                    prompt_type=PromptType(cached_data['prompt_type']),
                    symbol=cached_data['symbol'],
                    response_text=cached_data['response_text'],
                    parsed_data=cached_data['parsed_data'],
                    confidence=cached_data['confidence'],
                    processing_time=cached_data['processing_time'],
                    timestamp=datetime.fromisoformat(cached_data['timestamp']),
                    model_used=cached_data['model_used'],
                    token_usage=cached_data['token_usage']
                )
            
            return None
            
        except Exception as e:
            self.logger.warning("Failed to get cached response", {"error": str(e)})
            return None
    
    async def _cache_response(self, request_id: str, response: LLMResponse) -> None:
        """Cache LLM response"""
        if not self.cache:
            return
        
        try:
            cache_key = f"llm_response:{request_id}"
            cache_data = {
                'request_id': response.request_id,
                'prompt_type': response.prompt_type.value,
                'symbol': response.symbol,
                'response_text': response.response_text,
                'parsed_data': response.parsed_data,
                'confidence': response.confidence,
                'processing_time': response.processing_time,
                'timestamp': response.timestamp.isoformat(),
                'model_used': response.model_used,
                'token_usage': response.token_usage
            }
            
            await self.cache.set(cache_key, cache_data, ttl=self.config.cache_ttl)
            
        except Exception as e:
            self.logger.warning("Failed to cache response", {"error": str(e)})
    
    def _update_statistics(self, response: LLMResponse) -> None:
        """Update client statistics"""
        self.request_count += 1
        self.total_tokens_used += response.token_usage.get('total_tokens', 0)
        self.last_request_time = datetime.utcnow()
    
    def get_statistics(self) -> Dict[str, Any]:
        """Get client usage statistics"""
        return {
            'request_count': self.request_count,
            'total_tokens_used': self.total_tokens_used,
            'last_request_time': self.last_request_time.isoformat() if self.last_request_time else None,
            'avg_tokens_per_request': (
                self.total_tokens_used / max(self.request_count, 1)
            )
        }


class ContextManager:
    """Manages context data for LLM requests"""
    
    def __init__(self, dao):
        self.dao = dao
        self.logger = get_logger("context_manager")
        
        # Context configuration
        self.max_news_items = 10
        self.max_social_posts = 20
        self.context_time_window = timedelta(hours=24)
    
    async def build_sentiment_context(self, symbol: str) -> Dict[str, Any]:
        """Build context for sentiment analysis"""
        try:
            # Get current price
            current_price = await self.dao.get_latest_price(symbol)
            
            # Get recent news (mock for now - would integrate with news API)
            news_headlines = await self._get_recent_news(symbol)
            
            # Get social media posts (mock for now - would integrate with social APIs)
            social_posts = await self._get_social_posts(symbol)
            
            # Get price change data
            price_change_24h = await self._get_price_change_24h(symbol)
            
            # Get volume data
            volume = await self._get_recent_volume(symbol)
            
            return {
                'current_price': float(current_price) if current_price else 0,
                'price_change_24h': price_change_24h,
                'volume': volume,
                'news_headlines': news_headlines,
                'social_posts': social_posts
            }
            
        except Exception as e:
            self.logger.error("Failed to build sentiment context", {
                "symbol": symbol,
                "error": str(e)
            })
            return {}
    
    async def build_event_context(self, symbol: str) -> Dict[str, Any]:
        """Build context for event detection"""
        try:
            # Get current market data
            current_price = await self.dao.get_latest_price(symbol)
            
            # Get recent price extremes
            recent_data = await self.dao.get_market_data_history(symbol, "1h", limit=24)
            
            if recent_data:
                recent_high = max(float(md.ohlcv.high) for md in recent_data)
                recent_low = min(float(md.ohlcv.low) for md in recent_data)
                
                # Calculate volatility
                prices = [float(md.ohlcv.close) for md in recent_data]
                if len(prices) > 1:
                    returns = [(prices[i] - prices[i+1]) / prices[i+1] for i in range(len(prices)-1)]
                    volatility = (sum(r*r for r in returns) / len(returns)) ** 0.5 * 100
                else:
                    volatility = 0
            else:
                recent_high = float(current_price) if current_price else 0
                recent_low = float(current_price) if current_price else 0
                volatility = 0
            
            # Get news and social data
            news_data = await self._get_recent_news(symbol, detailed=True)
            social_data = await self._get_social_posts(symbol, detailed=True)
            
            return {
                'current_price': float(current_price) if current_price else 0,
                'recent_high': recent_high,
                'recent_low': recent_low,
                'volatility': volatility,
                'news_data': news_data,
                'social_data': social_data
            }
            
        except Exception as e:
            self.logger.error("Failed to build event context", {
                "symbol": symbol,
                "error": str(e)
            })
            return {}
    
    async def _get_recent_news(self, symbol: str, detailed: bool = False) -> List[Dict[str, Any]]:
        """Get recent news for symbol (mock implementation)"""
        # This would integrate with actual news APIs
        # For now, return mock data
        mock_news = [
            {
                "title": f"{symbol} shows strong technical indicators",
                "summary": f"Technical analysis suggests {symbol} is in a bullish trend",
                "source": "CryptoNews",
                "timestamp": datetime.utcnow().isoformat(),
                "sentiment": "positive"
            },
            {
                "title": f"Market volatility affects {symbol} trading",
                "summary": f"Recent market conditions impact {symbol} price action",
                "source": "MarketWatch",
                "timestamp": (datetime.utcnow() - timedelta(hours=2)).isoformat(),
                "sentiment": "neutral"
            }
        ]
        
        if detailed:
            return mock_news
        else:
            return [item["title"] for item in mock_news]
    
    async def _get_social_posts(self, symbol: str, detailed: bool = False) -> List[Dict[str, Any]]:
        """Get recent social media posts (mock implementation)"""
        # This would integrate with Twitter/Reddit APIs
        # For now, return mock data
        mock_posts = [
            {
                "text": f"Bullish on {symbol}! Great fundamentals 🚀",
                "platform": "twitter",
                "engagement": 150,
                "timestamp": datetime.utcnow().isoformat(),
                "sentiment": "positive"
            },
            {
                "text": f"Watching {symbol} closely, could break resistance soon",
                "platform": "reddit",
                "engagement": 75,
                "timestamp": (datetime.utcnow() - timedelta(hours=1)).isoformat(),
                "sentiment": "neutral"
            }
        ]
        
        if detailed:
            return mock_posts
        else:
            return [post["text"] for post in mock_posts]
    
    async def _get_price_change_24h(self, symbol: str) -> float:
        """Get 24h price change percentage"""
        try:
            # Get current and 24h ago prices
            recent_data = await self.dao.get_market_data_history(symbol, "1h", limit=24)
            
            if len(recent_data) >= 24:
                current_price = float(recent_data[0].ohlcv.close)
                price_24h_ago = float(recent_data[23].ohlcv.close)
                
                change_pct = ((current_price - price_24h_ago) / price_24h_ago) * 100
                return round(change_pct, 2)
            
            return 0.0
            
        except Exception:
            return 0.0
    
    async def _get_recent_volume(self, symbol: str) -> float:
        """Get recent trading volume"""
        try:
            recent_data = await self.dao.get_market_data_history(symbol, "1h", limit=1)
            
            if recent_data:
                return float(recent_data[0].ohlcv.volume)
            
            return 0.0
            
        except Exception:
            return 0.0