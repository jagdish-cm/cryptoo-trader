"""
Live Analysis Service - Simulates real-time AI trading analysis
This service provides live updates about what the AI algorithm is currently doing
"""

import asyncio
import random
from datetime import datetime, timedelta, timezone
from typing import Dict, List, Optional, Any
from enum import Enum
from dataclasses import dataclass
from uuid import uuid4

from ai_trading_system.models.enums import TradeDirection, MarketRegime, SignalStrength, SetupType
from ai_trading_system.services.multi_source_market_data import get_current_prices
from ai_trading_system.utils.logging import get_logger
from ai_trading_system.config.settings import load_config
from ai_trading_system.models.trading import TradingSignal
from decimal import Decimal


class AnalysisPhase(str, Enum):
    """Current analysis phase"""
    IDLE = "idle"
    MARKET_SCAN = "market_scan"
    TECHNICAL_ANALYSIS = "technical_analysis"
    SENTIMENT_ANALYSIS = "sentiment_analysis"
    RISK_ASSESSMENT = "risk_assessment"
    SIGNAL_GENERATION = "signal_generation"
    DECISION_MAKING = "decision_making"


@dataclass
class AnalysisStatus:
    """Current analysis status"""
    phase: AnalysisPhase
    current_symbol: Optional[str]
    progress: float  # 0-100
    message: str
    started_at: datetime
    estimated_completion: Optional[datetime]
    details: Dict[str, Any]


@dataclass
class AIDecision:
    """AI decision with reasoning"""
    id: str
    timestamp: datetime
    symbol: str
    decision_type: str
    confidence: float
    reasoning: str
    factors: List[str]
    outcome: str


class LiveAnalysisService:
    """Service that simulates live AI trading analysis"""
    
    def __init__(self, paper_trading_service=None):
        self.logger = get_logger("live_analysis")
        self.paper_trading_service = paper_trading_service
        self.current_status = AnalysisStatus(
            phase=AnalysisPhase.IDLE,
            current_symbol=None,
            progress=0.0,
            message="System ready",
            started_at=datetime.utcnow(),
            estimated_completion=None,
            details={}
        )
        
        # Load configuration and use watchlist from config
        self.config = load_config()
        self.watchlist = self.config.trading.watchlist
        
        # Recent decisions
        self.recent_decisions: List[AIDecision] = []
        self.max_decisions = 50
        
        # Analysis cycle settings - Reduced frequency to avoid rate limits
        self.cycle_interval = 120  # seconds between full cycles (2 minutes)
        self.is_running = False
        self.next_analysis_time = datetime.utcnow() + timedelta(seconds=self.cycle_interval)
        
        # Market regime
        self.current_regime = MarketRegime.RANGE
        self.regime_confidence = 0.75
        
        # Price cache to avoid excessive API calls
        self._price_cache: Dict[str, Dict[str, Any]] = {}
        self._cache_ttl = 60  # Cache prices for 60 seconds
    
    async def start_analysis_loop(self):
        """Start the continuous analysis loop"""
        self.is_running = True
        self.logger.info("Starting live analysis loop")
        
        while self.is_running:
            try:
                await self._run_analysis_cycle()
                
                # Set next analysis time to be exactly when the next cycle will start
                self.next_analysis_time = datetime.now(timezone.utc).replace(tzinfo=None) + timedelta(seconds=self.cycle_interval)
                
                # Log for debugging
                self.logger.info(f"Next analysis scheduled for: {self.next_analysis_time.isoformat()}")
                
                # Wait for next cycle
                await asyncio.sleep(self.cycle_interval)
                
            except Exception as e:
                self.logger.error(f"Error in analysis loop: {e}")
                await asyncio.sleep(5)
    
    def stop_analysis_loop(self):
        """Stop the analysis loop"""
        self.is_running = False
        self.logger.info("Stopping live analysis loop")
    
    async def _run_analysis_cycle(self):
        """Run a complete analysis cycle"""
        self.logger.info("Starting new analysis cycle")
        
        # Phase 1: Market Scan - Fetch all prices at once to avoid rate limits
        await self._update_status(
            AnalysisPhase.MARKET_SCAN,
            None,
            0,
            "Scanning market conditions and fetching live prices...",
            {"symbols_to_scan": len(self.watchlist)}
        )
        
        # Intelligently fetch prices only when needed
        try:
            # Check which symbols need fresh data
            symbols_to_fetch = []
            for symbol in self.watchlist:
                if not self.is_price_cache_valid(symbol):
                    symbols_to_fetch.append(symbol)
            
            if symbols_to_fetch:
                self.logger.info(f"Fetching fresh prices for {len(symbols_to_fetch)} symbols: {symbols_to_fetch}")
                fresh_prices = await get_current_prices(symbols_to_fetch, force_refresh=False)
                
                # Update cache with fresh data
                for symbol, price_data in fresh_prices.items():
                    self._price_cache[symbol] = {
                        "price": price_data.get("price", 0),
                        "timestamp": datetime.utcnow(),
                        "symbol": symbol,
                        "change24h": price_data.get("change24h", 0),
                        "volume24h": price_data.get("volume24h", 0),
                        "source": price_data.get("source", "unknown")
                    }
                
                self.logger.info(f"Updated cache with {len(fresh_prices)} fresh prices")
            else:
                self.logger.info(f"All {len(self.watchlist)} prices are cached and fresh, skipping API calls")
                
        except Exception as e:
            self.logger.error(f"Failed to fetch prices for analysis cycle: {e}")
            # Continue with cached data if available
        
        await asyncio.sleep(2)
        
        # Update market regime
        await self._detect_market_regime()
        
        # Phase 2: Analyze each symbol using cached prices
        for i, symbol in enumerate(self.watchlist):
            progress = (i / len(self.watchlist)) * 100
            
            # Technical Analysis
            await self._update_status(
                AnalysisPhase.TECHNICAL_ANALYSIS,
                symbol,
                progress,
                f"Analyzing technical indicators for {symbol}...",
                {"indicators": ["RSI", "MACD", "Bollinger Bands", "Support/Resistance"]}
            )
            await asyncio.sleep(1)
            
            # Sentiment Analysis
            await self._update_status(
                AnalysisPhase.SENTIMENT_ANALYSIS,
                symbol,
                progress + 10,
                f"Analyzing sentiment for {symbol}...",
                {"sources": ["Social Media", "News", "On-chain Data"]}
            )
            await asyncio.sleep(1)
            
            # Risk Assessment
            await self._update_status(
                AnalysisPhase.RISK_ASSESSMENT,
                symbol,
                progress + 20,
                f"Assessing risk factors for {symbol}...",
                {"risk_factors": ["Volatility", "Liquidity", "Correlation"]}
            )
            await asyncio.sleep(1)
            
            # Signal Generation
            await self._update_status(
                AnalysisPhase.SIGNAL_GENERATION,
                symbol,
                progress + 30,
                f"Generating trading signals for {symbol}...",
                {"signal_strength": "Building..."}
            )
            await asyncio.sleep(1)
            
            # Make AI decision
            await self._make_ai_decision(symbol)
        
        # Phase 3: Final Decision Making
        await self._update_status(
            AnalysisPhase.DECISION_MAKING,
            None,
            95,
            "Finalizing trading decisions...",
            {"decisions_made": len([d for d in self.recent_decisions if d.timestamp > datetime.utcnow() - timedelta(minutes=1)])}
        )
        await asyncio.sleep(2)
        
        # Return to idle
        await self._update_status(
            AnalysisPhase.IDLE,
            None,
            100,
            "Analysis complete. Waiting for next cycle.",
            {"cycle_completed": True}
        )
    
    async def _update_status(self, phase: AnalysisPhase, symbol: Optional[str], 
                           progress: float, message: str, details: Dict[str, Any]):
        """Update the current analysis status"""
        self.current_status = AnalysisStatus(
            phase=phase,
            current_symbol=symbol,
            progress=progress,
            message=message,
            started_at=self.current_status.started_at if phase == self.current_status.phase else datetime.utcnow(),
            estimated_completion=datetime.utcnow() + timedelta(seconds=5) if phase != AnalysisPhase.IDLE else None,
            details=details
        )
    
    async def _detect_market_regime(self):
        """Detect current market regime"""
        # Simulate market regime detection
        regimes = [MarketRegime.BULL, MarketRegime.BEAR, MarketRegime.RANGE]
        weights = [0.3, 0.2, 0.5]  # Range is most common
        
        self.current_regime = random.choices(regimes, weights=weights)[0]
        self.regime_confidence = random.uniform(0.6, 0.9)
        
        self.logger.info(f"Market regime detected: {self.current_regime.value} (confidence: {self.regime_confidence:.2f})")
    
    async def _make_ai_decision(self, symbol: str):
        """Make an AI trading decision for a symbol"""
        try:
            # Use cached price - no API calls during decision making
            current_price = 0
            price_source = "none"
            
            if symbol in self._price_cache:
                cached_data = self._price_cache[symbol]
                current_price = cached_data.get("price", 0)
                price_source = cached_data.get("source", "cache")
                cache_age = (datetime.utcnow() - cached_data.get("timestamp", datetime.utcnow())).total_seconds()
                
                self.logger.debug(f"Using cached price for {symbol}: ${current_price} (source: {price_source}, age: {cache_age:.1f}s)")
            else:
                self.logger.warning(f"No cached price found for {symbol}, using fallback price")
            
            # Simulate AI decision making
            decision_types = ["SIGNAL_GENERATION", "RISK_REJECTION", "MARKET_TIMING", "PORTFOLIO_BALANCE"]
            decision_type = random.choice(decision_types)
            
            confidence = random.uniform(0.3, 0.95)
            
            # Generate realistic reasoning based on decision type
            if decision_type == "SIGNAL_GENERATION":
                if confidence > 0.7:
                    direction = random.choice([TradeDirection.LONG, TradeDirection.SHORT])
                    reasoning = f"Strong {direction.value} signal detected. RSI showing {'oversold' if direction == TradeDirection.LONG else 'overbought'} conditions."
                    outcome = f"SIGNAL_GENERATED_{direction.value.upper()}"
                    factors = ["Technical indicators", "Volume analysis", "Price action"]
                else:
                    reasoning = "Mixed signals detected. Technical indicators showing conflicting data."
                    outcome = "NO_SIGNAL"
                    factors = ["Conflicting indicators", "Low volume", "Sideways movement"]
            
            elif decision_type == "RISK_REJECTION":
                reasoning = f"High volatility detected for {symbol}. Risk threshold exceeded."
                outcome = "REJECTED_HIGH_RISK"
                factors = ["Volatility spike", "Market uncertainty", "Risk management"]
            
            elif decision_type == "MARKET_TIMING":
                reasoning = f"Market timing unfavorable. Current regime: {self.current_regime.value}"
                outcome = "DEFERRED_TIMING"
                factors = ["Market regime", "Timing analysis", "Macro conditions"]
            
            else:  # PORTFOLIO_BALANCE
                reasoning = "Portfolio exposure limits reached. Maintaining current allocation."
                outcome = "REJECTED_EXPOSURE"
                factors = ["Portfolio balance", "Risk limits", "Diversification"]
            
            # Create AI decision
            decision = AIDecision(
                id=str(uuid4())[:8],
                timestamp=datetime.utcnow(),
                symbol=symbol,
                decision_type=decision_type,
                confidence=confidence,
                reasoning=reasoning,
                factors=factors,
                outcome=outcome
            )
            
            # Add to recent decisions
            self.recent_decisions.append(decision)
            
            # Keep only recent decisions
            if len(self.recent_decisions) > self.max_decisions:
                self.recent_decisions = self.recent_decisions[-self.max_decisions:]
            
            # Execute paper trade if signal was generated and paper trading service is available
            if outcome.startswith("SIGNAL_GENERATED_"):
                self.logger.info(f"🎯 Signal generated for {symbol}: {outcome} (confidence: {confidence:.2f})")
                
                # Debug the execution conditions
                paper_service_available = self.paper_trading_service is not None
                price_valid = current_price > 0
                
                self.logger.info(f"📊 Execution conditions check:", {
                    "paper_service_available": paper_service_available,
                    "current_price": current_price,
                    "price_valid": price_valid,
                    "symbol": symbol
                })
                
                if paper_service_available and price_valid:
                    self.logger.info(f"🚀 Attempting to execute paper trade for {symbol}")
                    await self._execute_paper_trade(decision, current_price)
                else:
                    # Log why execution was skipped
                    reasons = []
                    if not paper_service_available:
                        reasons.append("paper_trading_service_not_available")
                    if not price_valid:
                        reasons.append(f"invalid_price_{current_price}")
                    
                    self.logger.warning(f"❌ Skipped paper trade execution for {symbol}: {', '.join(reasons)}")
                    decision.outcome = f"{decision.outcome}_SKIPPED"
            
            self.logger.info(f"AI decision made for {symbol}: {outcome} (confidence: {confidence:.2f})")
            
            # Store additional trade execution details in the decision for frontend display
            if hasattr(decision, 'metadata') and decision.metadata:
                decision.entry_price = decision.metadata.get('entry_price')
                decision.stop_loss = decision.metadata.get('stop_loss')
                decision.stop_loss_percentage = decision.metadata.get('stop_loss_percentage')
                decision.stop_loss_reasoning = decision.metadata.get('stop_loss_reasoning')
                decision.take_profit_1 = decision.metadata.get('take_profit_1')
                decision.take_profit_reasoning = decision.metadata.get('take_profit_reasoning')
            
        except Exception as e:
            self.logger.error(f"Error making AI decision for {symbol}: {e}")
    
    async def _execute_paper_trade(self, decision: AIDecision, current_price: float):
        """Execute a paper trade based on an AI decision"""
        try:
            self.logger.info(f"🔧 Starting paper trade execution for {decision.symbol}")
            
            # Extract direction from outcome (e.g., "SIGNAL_GENERATED_LONG" -> "LONG")
            direction_str = decision.outcome.split("_")[-1]  # Gets "LONG" or "SHORT"
            direction = TradeDirection.LONG if direction_str == "LONG" else TradeDirection.SHORT
            
            self.logger.info(f"📈 Trade direction: {direction.value} for {decision.symbol}")
            
            # Calculate dynamic stop loss and take profit levels based on signal strength and market conditions
            stop_loss_data = self._calculate_dynamic_stop_loss(decision.confidence, current_price, direction)
            take_profit_data = self._calculate_dynamic_take_profits(decision.confidence, current_price, direction)
            
            # Determine signal strength based on confidence
            if decision.confidence >= 0.9:
                strength = SignalStrength.VERY_STRONG
            elif decision.confidence >= 0.8:
                strength = SignalStrength.STRONG
            elif decision.confidence >= 0.6:
                strength = SignalStrength.MODERATE
            else:
                strength = SignalStrength.WEAK
            
            # Determine setup type based on direction and reasoning
            if direction == TradeDirection.LONG:
                if "oversold" in decision.reasoning.lower():
                    setup_type = SetupType.LONG_OVERSOLD
                elif "support" in decision.reasoning.lower():
                    setup_type = SetupType.LONG_SUPPORT
                else:
                    setup_type = SetupType.LONG_BULLISH_CROSS
            else:  # SHORT
                if "overbought" in decision.reasoning.lower():
                    setup_type = SetupType.SHORT_OVERBOUGHT
                elif "resistance" in decision.reasoning.lower():
                    setup_type = SetupType.SHORT_RESISTANCE
                else:
                    setup_type = SetupType.SHORT_BEARISH_CROSS
            
            # Create a trading signal from the AI decision
            signal = TradingSignal(
                id=f"signal_{decision.id}",
                symbol=decision.symbol,
                direction=direction,
                confidence=Decimal(str(decision.confidence)),
                strength=strength,
                technical_score=Decimal(str(decision.confidence)),
                sentiment_score=Decimal(str(decision.confidence * 0.8)),
                event_impact=Decimal('0.0'),
                setup_type=setup_type,
                entry_price=Decimal(str(current_price)),
                stop_loss=Decimal(str(stop_loss_data['price'])),
                take_profit_levels=[Decimal(str(tp)) for tp in take_profit_data['levels']],
                timestamp=decision.timestamp,
                metadata={
                    "reasoning": decision.reasoning,
                    "factors": decision.factors,
                    "market_regime": self.current_regime.value,
                    "stop_loss_percentage": stop_loss_data['percentage'],
                    "stop_loss_reasoning": stop_loss_data['reasoning'],
                    "take_profit_reasoning": take_profit_data['reasoning'],
                    "ai_decision_id": decision.id
                }
            )
            
            self.logger.info(f"📊 Created trading signal: {signal.id} for {signal.symbol} {signal.direction.value} @ ${signal.entry_price}")
            
            # Execute the paper trade
            self.logger.info(f"🎯 Calling paper trading service execute_signal...")
            position = await self.paper_trading_service.execute_signal(signal)
            
            if position:
                self.logger.info(f"✅ Paper trade executed successfully!", {
                    "signal_id": signal.id,
                    "position_id": position.id,
                    "symbol": position.symbol,
                    "direction": position.direction.value,
                    "entry_price": float(position.entry_price),
                    "quantity": float(position.quantity),
                    "confidence": decision.confidence
                })
                
                # Update the decision outcome to indicate execution
                decision.outcome = f"{decision.outcome}_EXECUTED"
                
                # Store trade execution details for frontend display
                decision.entry_price = float(signal.entry_price)
                decision.stop_loss = float(signal.stop_loss)
                decision.stop_loss_percentage = stop_loss_data['percentage']
                decision.stop_loss_reasoning = stop_loss_data['reasoning']
                decision.take_profit_1 = float(signal.take_profit_levels[0]) if signal.take_profit_levels else None
                decision.take_profit_reasoning = take_profit_data['reasoning']
            else:
                self.logger.error(f"❌ Paper trading service returned None position for signal {signal.id}")
                self.logger.error(f"❌ This indicates the paper trading service rejected the signal")
                decision.outcome = f"{decision.outcome}_FAILED"
                
        except Exception as e:
            self.logger.error(f"💥 Exception during paper trade execution for decision {decision.id}: {e}")
            import traceback
            self.logger.error(f"💥 Full traceback: {traceback.format_exc()}")
            decision.outcome = f"{decision.outcome}_ERROR"
    
    def _calculate_dynamic_stop_loss(self, confidence: float, current_price: float, direction: TradeDirection) -> Dict[str, Any]:
        """
        Professional crypto trader stop loss algorithm - optimized for crypto volatility and realistic targets
        Focus: Tight stops, quick exits, preserve capital for next opportunity
        """
        
        # Professional crypto trader approach: Much tighter stops for faster decision making
        # BTC/ETH can move 1-2% easily, so stops should be within that range
        
        if current_price >= 50000:  # BTC range - tighter stops due to high absolute values
            if confidence >= 0.9:  # Very high confidence
                base_stop_pct = 0.008  # 0.8% - very tight for BTC
                reasoning = "BTC high confidence - ultra-tight stop for quick exit"
            elif confidence >= 0.8:  # High confidence  
                base_stop_pct = 0.012  # 1.2% - tight but reasonable
                reasoning = "BTC high confidence - tight professional stop"
            elif confidence >= 0.7:  # Moderate confidence
                base_stop_pct = 0.015  # 1.5% - standard crypto day trading
                reasoning = "BTC moderate confidence - standard day trading stop"
            elif confidence >= 0.6:  # Lower confidence
                base_stop_pct = 0.020  # 2.0% - wider but still reasonable
                reasoning = "BTC lower confidence - conservative stop"
            else:  # Low confidence
                base_stop_pct = 0.025  # 2.5% - maximum for BTC
                reasoning = "BTC low confidence - maximum defensive stop"
                
        elif current_price >= 2000:  # ETH range - slightly wider due to higher volatility
            if confidence >= 0.9:  # Very high confidence
                base_stop_pct = 0.012  # 1.2%
                reasoning = "ETH high confidence - tight stop for quick decision"
            elif confidence >= 0.8:  # High confidence
                base_stop_pct = 0.018  # 1.8%
                reasoning = "ETH high confidence - professional stop"
            elif confidence >= 0.7:  # Moderate confidence
                base_stop_pct = 0.022  # 2.2%
                reasoning = "ETH moderate confidence - standard stop"
            elif confidence >= 0.6:  # Lower confidence
                base_stop_pct = 0.028  # 2.8%
                reasoning = "ETH lower confidence - wider stop"
            else:  # Low confidence
                base_stop_pct = 0.035  # 3.5% - maximum for ETH
                reasoning = "ETH low confidence - maximum defensive stop"
                
        else:  # Other cryptos - can handle slightly wider stops
            if confidence >= 0.9:
                base_stop_pct = 0.015  # 1.5%
                reasoning = "Altcoin high confidence - tight stop"
            elif confidence >= 0.8:
                base_stop_pct = 0.025  # 2.5%
                reasoning = "Altcoin high confidence - moderate stop"
            elif confidence >= 0.7:
                base_stop_pct = 0.035  # 3.5%
                reasoning = "Altcoin moderate confidence - standard stop"
            else:
                base_stop_pct = 0.045  # 4.5%
                reasoning = "Altcoin lower confidence - wider stop"
        
        # Market regime adjustments - but keep them minimal for crypto
        regime_multiplier = 1.0
        if self.current_regime == MarketRegime.BULL:
            regime_multiplier = 0.9   # Slightly tighter in bull (10% reduction)
            reasoning += " | Bull: tighter"
        elif self.current_regime == MarketRegime.BEAR:
            regime_multiplier = 1.1   # Slightly wider in bear (10% increase)
            reasoning += " | Bear: wider"
        else:  # RANGE
            regime_multiplier = 1.0   # No adjustment in range
            reasoning += " | Range: standard"
        
        # Calculate final stop loss percentage
        final_stop_pct = base_stop_pct * regime_multiplier
        
        # Professional rule: Never exceed 3% stop on BTC, 4% on ETH regardless of calculation
        if current_price >= 50000:  # BTC
            final_stop_pct = min(final_stop_pct, 0.03)  # Max 3% for BTC
            if final_stop_pct == 0.03:
                reasoning += " | Capped at 3% max for BTC"
        elif current_price >= 2000:  # ETH
            final_stop_pct = min(final_stop_pct, 0.04)  # Max 4% for ETH
            if final_stop_pct == 0.04:
                reasoning += " | Capped at 4% max for ETH"
        else:  # Other cryptos
            final_stop_pct = min(final_stop_pct, 0.05)  # Max 5% for altcoins
        
        # Calculate stop loss price
        if direction == TradeDirection.LONG:
            stop_loss_price = current_price * (1 - final_stop_pct)
        else:  # SHORT
            stop_loss_price = current_price * (1 + final_stop_pct)
        
        return {
            "price": stop_loss_price,
            "percentage": final_stop_pct * 100,  # Convert to percentage for display
            "reasoning": reasoning
        }
    
    def _calculate_dynamic_take_profits(self, confidence: float, current_price: float, direction: TradeDirection) -> Dict[str, Any]:
        """
        Professional crypto trader take profit algorithm - realistic targets for day trading
        Focus: Quick scalping profits, realistic targets that can be hit within hours
        """
        
        # Professional crypto day trading approach: Much more realistic targets
        # BTC/ETH typically move 1-3% in a few hours, so targets should be achievable
        
        if current_price >= 50000:  # BTC range - conservative targets due to size
            if confidence >= 0.9:  # Very high confidence
                tp_levels = [0.015, 0.025, 0.040]  # 1.5%, 2.5%, 4% - realistic BTC targets
                reasoning = "BTC high confidence - realistic scalping targets"
            elif confidence >= 0.8:  # High confidence
                tp_levels = [0.012, 0.020, 0.035]  # 1.2%, 2%, 3.5%
                reasoning = "BTC high confidence - conservative targets"
            elif confidence >= 0.7:  # Moderate confidence
                tp_levels = [0.010, 0.018, 0.030]  # 1%, 1.8%, 3%
                reasoning = "BTC moderate confidence - quick profit targets"
            elif confidence >= 0.6:  # Lower confidence
                tp_levels = [0.008, 0.015, 0.025]  # 0.8%, 1.5%, 2.5%
                reasoning = "BTC lower confidence - very conservative targets"
            else:  # Low confidence
                tp_levels = [0.006, 0.012, 0.020]  # 0.6%, 1.2%, 2%
                reasoning = "BTC low confidence - minimal profit targets"
                
        elif current_price >= 2000:  # ETH range - slightly more aggressive
            if confidence >= 0.9:  # Very high confidence
                tp_levels = [0.020, 0.035, 0.055]  # 2%, 3.5%, 5.5%
                reasoning = "ETH high confidence - aggressive but realistic targets"
            elif confidence >= 0.8:  # High confidence
                tp_levels = [0.018, 0.030, 0.045]  # 1.8%, 3%, 4.5%
                reasoning = "ETH high confidence - solid targets"
            elif confidence >= 0.7:  # Moderate confidence
                tp_levels = [0.015, 0.025, 0.040]  # 1.5%, 2.5%, 4%
                reasoning = "ETH moderate confidence - balanced targets"
            elif confidence >= 0.6:  # Lower confidence
                tp_levels = [0.012, 0.020, 0.032]  # 1.2%, 2%, 3.2%
                reasoning = "ETH lower confidence - conservative targets"
            else:  # Low confidence
                tp_levels = [0.010, 0.018, 0.028]  # 1%, 1.8%, 2.8%
                reasoning = "ETH low confidence - safe targets"
                
        else:  # Other cryptos - can be more aggressive due to higher volatility
            if confidence >= 0.9:
                tp_levels = [0.025, 0.045, 0.070]  # 2.5%, 4.5%, 7%
                reasoning = "Altcoin high confidence - volatile targets"
            elif confidence >= 0.8:
                tp_levels = [0.020, 0.035, 0.055]  # 2%, 3.5%, 5.5%
                reasoning = "Altcoin high confidence - moderate targets"
            elif confidence >= 0.7:
                tp_levels = [0.018, 0.030, 0.045]  # 1.8%, 3%, 4.5%
                reasoning = "Altcoin moderate confidence - standard targets"
            else:
                tp_levels = [0.015, 0.025, 0.040]  # 1.5%, 2.5%, 4%
                reasoning = "Altcoin lower confidence - conservative targets"
        
        # Market regime adjustments - keep them realistic
        if self.current_regime == MarketRegime.BULL:
            # Slightly more aggressive in bull market (20% increase)
            tp_levels = [tp * 1.2 for tp in tp_levels]
            reasoning += " | Bull: extended"
        elif self.current_regime == MarketRegime.BEAR:
            # More conservative in bear market (20% reduction)
            tp_levels = [tp * 0.8 for tp in tp_levels]
            reasoning += " | Bear: conservative"
        else:  # RANGE
            # Standard targets in range market
            reasoning += " | Range: standard"
        
        # Professional rule: Cap maximum take profits to prevent unrealistic targets
        if current_price >= 50000:  # BTC - max 5% target
            tp_levels = [min(tp, 0.05) for tp in tp_levels]
        elif current_price >= 2000:  # ETH - max 7% target
            tp_levels = [min(tp, 0.07) for tp in tp_levels]
        else:  # Altcoins - max 10% target
            tp_levels = [min(tp, 0.10) for tp in tp_levels]
        
        # Calculate actual take profit prices
        if direction == TradeDirection.LONG:
            tp_prices = [current_price * (1 + tp) for tp in tp_levels]
        else:  # SHORT
            tp_prices = [current_price * (1 - tp) for tp in tp_levels]
        
        return {
            "levels": tp_prices,
            "percentages": [tp * 100 for tp in tp_levels],  # Convert to percentages for display
            "reasoning": reasoning
        }
    
    def get_current_status(self) -> Dict[str, Any]:
        """Get current analysis status"""
        # Always calculate next_analysis_time dynamically to ensure it's current
        current_time = datetime.now(timezone.utc)  # Use timezone-aware UTC
        
        # Only update next_analysis_time if it's significantly in the past (more than cycle_interval)
        # This prevents constantly resetting the countdown
        time_diff = (self.next_analysis_time - current_time.replace(tzinfo=None)).total_seconds()
        
        if time_diff < -self.cycle_interval:  # Only update if more than one full cycle behind
            self.next_analysis_time = current_time.replace(tzinfo=None) + timedelta(seconds=self.cycle_interval)
            self.logger.info(f"Fixed stale next_analysis_time: {self.next_analysis_time.isoformat()}Z (was {time_diff:.1f}s behind)")
        
        # Calculate seconds remaining
        seconds_remaining = (self.next_analysis_time - current_time.replace(tzinfo=None)).total_seconds()
        
        # Return timezone-aware ISO format for frontend
        next_analysis_utc = self.next_analysis_time.replace(tzinfo=timezone.utc)
        
        return {
            "phase": self.current_status.phase.value,
            "current_symbol": self.current_status.current_symbol,
            "progress": self.current_status.progress,
            "message": self.current_status.message,
            "started_at": self.current_status.started_at.isoformat() + "Z",
            "estimated_completion": (self.current_status.estimated_completion.isoformat() + "Z") if self.current_status.estimated_completion else None,
            "details": self.current_status.details,
            "next_analysis_time": next_analysis_utc.isoformat(),  # This will include timezone info
            "is_running": self.is_running,
            "seconds_remaining": max(0, int(seconds_remaining))  # Add this for frontend debugging
        }
    
    def get_market_regime(self) -> Dict[str, Any]:
        """Get current market regime"""
        return {
            "current": self.current_regime.value,
            "confidence": self.regime_confidence,
            "last_updated": datetime.utcnow().isoformat()
        }
    
    def get_recent_decisions(self, limit: int = 10) -> List[Dict[str, Any]]:
        """Get recent AI decisions with trade execution details"""
        recent = self.recent_decisions[-limit:] if self.recent_decisions else []
        return [
            {
                "id": decision.id,
                "timestamp": decision.timestamp.isoformat(),
                "symbol": decision.symbol,
                "decision_type": decision.decision_type,
                "confidence": decision.confidence,
                "reasoning": decision.reasoning,
                "factors": decision.factors,
                "outcome": decision.outcome,
                # Include trade execution details if available
                "entry_price": getattr(decision, 'entry_price', None),
                "stop_loss": getattr(decision, 'stop_loss', None),
                "stop_loss_percentage": getattr(decision, 'stop_loss_percentage', None),
                "stop_loss_reasoning": getattr(decision, 'stop_loss_reasoning', None),
                "take_profit_1": getattr(decision, 'take_profit_1', None),
                "take_profit_reasoning": getattr(decision, 'take_profit_reasoning', None)
            }
            for decision in reversed(recent)
        ]
    
    def get_cached_prices(self, symbols: Optional[List[str]] = None) -> Dict[str, Dict[str, Any]]:
        """Get cached prices to avoid API calls"""
        current_time = datetime.utcnow()
        valid_prices = {}
        
        # Filter symbols if specified
        symbols_to_check = symbols if symbols else list(self._price_cache.keys())
        
        for symbol in symbols_to_check:
            if symbol in self._price_cache:
                cached_data = self._price_cache[symbol]
                cache_age = (current_time - cached_data["timestamp"]).total_seconds()
                
                # Check if cache is still valid (within TTL)
                if cache_age < self._cache_ttl:
                    valid_prices[symbol] = {
                        "symbol": symbol,
                        "price": cached_data["price"],
                        "change24h": cached_data.get("change24h", 0),
                        "volume24h": cached_data.get("volume24h", 0),
                        "timestamp": cached_data["timestamp"].isoformat(),
                        "source": cached_data.get("source", "cache"),
                        "age_seconds": cache_age,
                        "cached": True
                    }
        
        self.logger.debug(f"Served {len(valid_prices)} cached prices (requested: {len(symbols_to_check) if symbols_to_check else 'all'})")
        return valid_prices
    
    def is_price_cache_valid(self, symbol: str) -> bool:
        """Check if cached price for symbol is still valid"""
        if symbol not in self._price_cache:
            return False
        
        cached_data = self._price_cache[symbol]
        current_time = datetime.utcnow()
        return (current_time - cached_data["timestamp"]).total_seconds() < self._cache_ttl


# Global instance
_live_analysis_service: Optional[LiveAnalysisService] = None


def get_live_analysis_service(paper_trading_service=None) -> LiveAnalysisService:
    """Get or create the global live analysis service instance"""
    global _live_analysis_service
    
    if _live_analysis_service is None:
        _live_analysis_service = LiveAnalysisService(paper_trading_service)
    
    return _live_analysis_service


async def start_live_analysis():
    """Start the live analysis service"""
    service = get_live_analysis_service()
    if not service.is_running:
        asyncio.create_task(service.start_analysis_loop())


def stop_live_analysis():
    """Stop the live analysis service"""
    service = get_live_analysis_service()
    service.stop_analysis_loop()