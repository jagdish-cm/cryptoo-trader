"""
Strategy mode management system for handling regime changes and trade type filtering
"""

import asyncio
from typing import Optional, Dict, Any, List, Callable
from datetime import datetime, timedelta
from dataclasses import dataclass
from enum import Enum
import json

from ai_trading_system.models.enums import MarketRegime, TradeDirection
from ai_trading_system.analyzers.regime_analyzer import RegimeAnalysis, BitcoinPriceAnalyzer
from ai_trading_system.services.data_storage import DataAccessObject, CacheKey
from ai_trading_system.utils.logging import get_logger
from ai_trading_system.utils.errors import SystemError, ValidationError


class StrategyMode(str, Enum):
    """Strategy mode based on market regime"""
    BULL_ONLY = "bull_only"      # Long positions only
    BEAR_ONLY = "bear_only"      # Short positions only
    DUAL_MODE = "dual_mode"      # Both long and short allowed
    DISABLED = "disabled"        # No trading allowed


@dataclass
class StrategyState:
    """Current strategy state"""
    mode: StrategyMode
    regime: MarketRegime
    confidence: float
    last_updated: datetime
    regime_duration: int  # Days in current regime
    disabled_trade_types: List[TradeDirection]
    metadata: Dict[str, Any]


@dataclass
class RegimeChangeEvent:
    """Regime change event data"""
    previous_regime: MarketRegime
    new_regime: MarketRegime
    previous_mode: StrategyMode
    new_mode: StrategyMode
    confidence: float
    timestamp: datetime
    analysis_data: RegimeAnalysis


class StrategyModeManager:
    """Manages strategy mode transitions based on market regime analysis"""
    
    def __init__(self, dao: DataAccessObject, bitcoin_analyzer: BitcoinPriceAnalyzer):
        self.dao = dao
        self.bitcoin_analyzer = bitcoin_analyzer
        self.logger = get_logger("strategy_manager")
        
        # Current state
        self._current_state: Optional[StrategyState] = None
        self._regime_history: List[RegimeAnalysis] = []
        self._change_callbacks: List[Callable[[RegimeChangeEvent], None]] = []
        
        # Configuration
        self.min_confidence_threshold = 0.6  # Minimum confidence for regime change
        self.regime_stability_period = 3     # Days to confirm regime change
        self.analysis_interval = 3600        # 1 hour between analyses
        
        # State persistence
        self._state_cache_key = "strategy:current_state"
        self._history_cache_key = "strategy:regime_history"
        
        # Task management
        self._analysis_task: Optional[asyncio.Task] = None
        self._running = False
    
    async def initialize(self) -> None:
        """Initialize strategy manager and load persisted state"""
        try:
            # Initialize Bitcoin analyzer
            await self.bitcoin_analyzer.initialize()
            
            # Load persisted state
            await self._load_persisted_state()
            
            # If no persisted state, perform initial analysis
            if self._current_state is None:
                await self._perform_initial_analysis()
            
            self.logger.info("Strategy manager initialized", {
                "current_mode": self._current_state.mode.value,
                "current_regime": self._current_state.regime.value,
                "confidence": self._current_state.confidence
            })
            
        except Exception as e:
            self.logger.error("Failed to initialize strategy manager", {"error": str(e)})
            raise SystemError(
                "Strategy manager initialization failed",
                component="strategy_manager",
                original_error=e
            )
    
    async def start_monitoring(self) -> None:
        """Start continuous regime monitoring"""
        if self._running:
            self.logger.warning("Strategy manager already running")
            return
        
        self._running = True
        self._analysis_task = asyncio.create_task(self._monitoring_loop())
        
        self.logger.info("Strategy manager monitoring started", {
            "analysis_interval": self.analysis_interval
        })
    
    async def stop_monitoring(self) -> None:
        """Stop regime monitoring"""
        self._running = False
        
        if self._analysis_task:
            self._analysis_task.cancel()
            try:
                await self._analysis_task
            except asyncio.CancelledError:
                pass
        
        self.logger.info("Strategy manager monitoring stopped")
    
    async def _monitoring_loop(self) -> None:
        """Main monitoring loop for regime analysis"""
        while self._running:
            try:
                # Perform regime analysis
                analysis = await self.bitcoin_analyzer.analyze()
                
                # Process the analysis
                await self._process_regime_analysis(analysis)
                
                # Wait for next analysis
                await asyncio.sleep(self.analysis_interval)
                
            except asyncio.CancelledError:
                break
            except Exception as e:
                self.logger.error("Error in monitoring loop", {"error": str(e)})
                await asyncio.sleep(300)  # Wait 5 minutes before retry
    
    async def _process_regime_analysis(self, analysis: RegimeAnalysis) -> None:
        """Process new regime analysis and update strategy if needed"""
        try:
            # Add to history
            self._regime_history.append(analysis)
            
            # Keep only recent history (last 30 analyses)
            if len(self._regime_history) > 30:
                self._regime_history = self._regime_history[-30:]
            
            # Check if regime change is needed
            should_change, new_mode = await self._should_change_strategy(analysis)
            
            if should_change:
                await self._execute_strategy_change(analysis, new_mode)
            else:
                # Update current state with latest analysis
                await self._update_current_state(analysis)
            
            # Persist state
            await self._persist_state()
            
        except Exception as e:
            self.logger.error("Failed to process regime analysis", {"error": str(e)})
    
    async def _should_change_strategy(self, analysis: RegimeAnalysis) -> tuple[bool, StrategyMode]:
        """Determine if strategy mode should change based on analysis"""
        current_regime = self._current_state.regime
        new_regime = analysis.regime
        
        # No change if regime is the same
        if current_regime == new_regime:
            return False, self._current_state.mode
        
        # Check confidence threshold
        if analysis.confidence < self.min_confidence_threshold:
            self.logger.debug("Regime change confidence too low", {
                "confidence": analysis.confidence,
                "threshold": self.min_confidence_threshold
            })
            return False, self._current_state.mode
        
        # Check stability period (require consistent regime for multiple analyses)
        if not await self._is_regime_stable(new_regime):
            self.logger.debug("Regime not stable enough for change", {
                "new_regime": new_regime.value,
                "stability_period": self.regime_stability_period
            })
            return False, self._current_state.mode
        
        # Determine new strategy mode
        new_mode = self._regime_to_strategy_mode(new_regime)
        
        return True, new_mode
    
    async def _is_regime_stable(self, regime: MarketRegime) -> bool:
        """Check if regime has been stable for required period"""
        if len(self._regime_history) < self.regime_stability_period:
            return False
        
        # Check last N analyses for consistency
        recent_analyses = self._regime_history[-self.regime_stability_period:]
        
        # Count how many match the new regime
        matching_count = sum(1 for analysis in recent_analyses if analysis.regime == regime)
        
        # Require at least 80% consistency
        required_matches = int(self.regime_stability_period * 0.8)
        
        return matching_count >= required_matches
    
    def _regime_to_strategy_mode(self, regime: MarketRegime) -> StrategyMode:
        """Convert market regime to strategy mode"""
        regime_to_mode = {
            MarketRegime.BULL: StrategyMode.BULL_ONLY,
            MarketRegime.BEAR: StrategyMode.BEAR_ONLY,
            MarketRegime.RANGE: StrategyMode.DUAL_MODE
        }
        
        return regime_to_mode.get(regime, StrategyMode.DUAL_MODE)
    
    async def _execute_strategy_change(self, analysis: RegimeAnalysis, new_mode: StrategyMode) -> None:
        """Execute strategy mode change"""
        previous_state = self._current_state
        
        # Create new state
        new_state = StrategyState(
            mode=new_mode,
            regime=analysis.regime,
            confidence=analysis.confidence,
            last_updated=datetime.utcnow(),
            regime_duration=1,  # Reset duration
            disabled_trade_types=self._get_disabled_trade_types(new_mode),
            metadata={
                "regime_change_reason": "bitcoin_analysis",
                "previous_regime": previous_state.regime.value,
                "trend_strength": analysis.trend_strength.value,
                "price_vs_sma200": analysis.price_vs_sma200
            }
        )
        
        # Create change event
        change_event = RegimeChangeEvent(
            previous_regime=previous_state.regime,
            new_regime=analysis.regime,
            previous_mode=previous_state.mode,
            new_mode=new_mode,
            confidence=analysis.confidence,
            timestamp=datetime.utcnow(),
            analysis_data=analysis
        )
        
        # Update current state
        self._current_state = new_state
        
        # Log the change
        self.logger.info("Strategy mode changed", {
            "previous_regime": change_event.previous_regime.value,
            "new_regime": change_event.new_regime.value,
            "previous_mode": change_event.previous_mode.value,
            "new_mode": change_event.new_mode.value,
            "confidence": change_event.confidence,
            "disabled_trades": [dt.value for dt in new_state.disabled_trade_types]
        })
        
        # Notify callbacks
        await self._notify_change_callbacks(change_event)
    
    async def _update_current_state(self, analysis: RegimeAnalysis) -> None:
        """Update current state with latest analysis (no regime change)"""
        if self._current_state:
            # Increment regime duration
            days_since_update = (datetime.utcnow() - self._current_state.last_updated).days
            new_duration = self._current_state.regime_duration + max(1, days_since_update)
            
            # Update state
            self._current_state = StrategyState(
                mode=self._current_state.mode,
                regime=self._current_state.regime,
                confidence=analysis.confidence,  # Update with latest confidence
                last_updated=datetime.utcnow(),
                regime_duration=new_duration,
                disabled_trade_types=self._current_state.disabled_trade_types,
                metadata={
                    **self._current_state.metadata,
                    "last_analysis_confidence": analysis.confidence,
                    "trend_strength": analysis.trend_strength.value
                }
            )
    
    def _get_disabled_trade_types(self, mode: StrategyMode) -> List[TradeDirection]:
        """Get disabled trade types for a strategy mode"""
        if mode == StrategyMode.BULL_ONLY:
            return [TradeDirection.SHORT]
        elif mode == StrategyMode.BEAR_ONLY:
            return [TradeDirection.LONG]
        elif mode == StrategyMode.DISABLED:
            return [TradeDirection.LONG, TradeDirection.SHORT]
        else:  # DUAL_MODE
            return []
    
    async def _notify_change_callbacks(self, event: RegimeChangeEvent) -> None:
        """Notify registered callbacks of regime change"""
        for callback in self._change_callbacks:
            try:
                if asyncio.iscoroutinefunction(callback):
                    await callback(event)
                else:
                    callback(event)
            except Exception as e:
                self.logger.error("Error in regime change callback", {
                    "callback": callback.__name__,
                    "error": str(e)
                })
    
    async def _perform_initial_analysis(self) -> None:
        """Perform initial regime analysis on startup"""
        try:
            analysis = await self.bitcoin_analyzer.analyze()
            
            initial_mode = self._regime_to_strategy_mode(analysis.regime)
            
            self._current_state = StrategyState(
                mode=initial_mode,
                regime=analysis.regime,
                confidence=analysis.confidence,
                last_updated=datetime.utcnow(),
                regime_duration=1,
                disabled_trade_types=self._get_disabled_trade_types(initial_mode),
                metadata={
                    "initialization": True,
                    "trend_strength": analysis.trend_strength.value,
                    "price_vs_sma200": analysis.price_vs_sma200
                }
            )
            
            self._regime_history.append(analysis)
            
            self.logger.info("Initial strategy analysis completed", {
                "regime": analysis.regime.value,
                "mode": initial_mode.value,
                "confidence": analysis.confidence
            })
            
        except Exception as e:
            self.logger.error("Initial analysis failed", {"error": str(e)})
            raise
    
    async def _load_persisted_state(self) -> None:
        """Load persisted strategy state from cache"""
        try:
            # Load current state
            state_data = await self.dao.cache.get(self._state_cache_key)
            if state_data:
                self._current_state = self._deserialize_state(state_data)
                
                self.logger.info("Loaded persisted strategy state", {
                    "mode": self._current_state.mode.value,
                    "regime": self._current_state.regime.value,
                    "last_updated": self._current_state.last_updated
                })
            
            # Load regime history
            history_data = await self.dao.cache.get(self._history_cache_key)
            if history_data:
                self._regime_history = self._deserialize_history(history_data)
                
                self.logger.debug("Loaded regime history", {
                    "history_length": len(self._regime_history)
                })
                
        except Exception as e:
            self.logger.warning("Failed to load persisted state", {"error": str(e)})
            # Continue with fresh state
    
    async def _persist_state(self) -> None:
        """Persist current strategy state to cache"""
        try:
            # Persist current state
            if self._current_state:
                state_data = self._serialize_state(self._current_state)
                await self.dao.cache.set(
                    self._state_cache_key,
                    state_data,
                    ttl=86400  # 24 hours
                )
            
            # Persist regime history
            if self._regime_history:
                history_data = self._serialize_history(self._regime_history)
                await self.dao.cache.set(
                    self._history_cache_key,
                    history_data,
                    ttl=86400  # 24 hours
                )
                
        except Exception as e:
            self.logger.error("Failed to persist strategy state", {"error": str(e)})
    
    def _serialize_state(self, state: StrategyState) -> Dict[str, Any]:
        """Serialize strategy state for persistence"""
        return {
            "mode": state.mode.value,
            "regime": state.regime.value,
            "confidence": state.confidence,
            "last_updated": state.last_updated.isoformat(),
            "regime_duration": state.regime_duration,
            "disabled_trade_types": [dt.value for dt in state.disabled_trade_types],
            "metadata": state.metadata
        }
    
    def _deserialize_state(self, data: Dict[str, Any]) -> StrategyState:
        """Deserialize strategy state from persistence"""
        return StrategyState(
            mode=StrategyMode(data["mode"]),
            regime=MarketRegime(data["regime"]),
            confidence=data["confidence"],
            last_updated=datetime.fromisoformat(data["last_updated"]),
            regime_duration=data["regime_duration"],
            disabled_trade_types=[TradeDirection(dt) for dt in data["disabled_trade_types"]],
            metadata=data["metadata"]
        )
    
    def _serialize_history(self, history: List[RegimeAnalysis]) -> List[Dict[str, Any]]:
        """Serialize regime history for persistence"""
        return [
            {
                "regime": analysis.regime.value,
                "confidence": analysis.confidence,
                "trend_strength": analysis.trend_strength.value,
                "price_vs_sma200": analysis.price_vs_sma200,
                "analysis_timestamp": analysis.analysis_timestamp.isoformat(),
                "metadata": analysis.metadata
            }
            for analysis in history
        ]
    
    def _deserialize_history(self, data: List[Dict[str, Any]]) -> List[RegimeAnalysis]:
        """Deserialize regime history from persistence"""
        from ai_trading_system.analyzers.regime_analyzer import RegimeAnalysis, TrendStrength
        
        history = []
        for item in data:
            analysis = RegimeAnalysis(
                regime=MarketRegime(item["regime"]),
                confidence=item["confidence"],
                trend_strength=TrendStrength(item["trend_strength"]),
                price_vs_sma200=item["price_vs_sma200"],
                sma_slope=0.0,  # Not persisted, will be recalculated
                volatility=0.0,  # Not persisted, will be recalculated
                volume_trend=0.0,  # Not persisted, will be recalculated
                support_resistance_levels=[],  # Not persisted, will be recalculated
                analysis_timestamp=datetime.fromisoformat(item["analysis_timestamp"]),
                metadata=item["metadata"]
            )
            history.append(analysis)
        
        return history
    
    # Public API methods
    
    def get_current_strategy_mode(self) -> StrategyMode:
        """Get current strategy mode"""
        if self._current_state is None:
            return StrategyMode.DISABLED
        return self._current_state.mode
    
    def get_current_regime(self) -> MarketRegime:
        """Get current market regime"""
        if self._current_state is None:
            return MarketRegime.RANGE
        return self._current_state.regime
    
    def get_current_state(self) -> Optional[StrategyState]:
        """Get complete current strategy state"""
        return self._current_state
    
    def is_trade_allowed(self, direction: TradeDirection) -> bool:
        """Check if a trade direction is allowed in current strategy mode"""
        if self._current_state is None:
            return False
        
        return direction not in self._current_state.disabled_trade_types
    
    def get_regime_history(self, limit: int = 10) -> List[RegimeAnalysis]:
        """Get recent regime analysis history"""
        return self._regime_history[-limit:] if self._regime_history else []
    
    def register_change_callback(self, callback: Callable[[RegimeChangeEvent], None]) -> None:
        """Register callback for regime change events"""
        self._change_callbacks.append(callback)
        
        self.logger.debug("Registered regime change callback", {
            "callback": callback.__name__,
            "total_callbacks": len(self._change_callbacks)
        })
    
    def unregister_change_callback(self, callback: Callable[[RegimeChangeEvent], None]) -> None:
        """Unregister regime change callback"""
        if callback in self._change_callbacks:
            self._change_callbacks.remove(callback)
            
            self.logger.debug("Unregistered regime change callback", {
                "callback": callback.__name__,
                "total_callbacks": len(self._change_callbacks)
            })
    
    async def force_regime_analysis(self) -> RegimeAnalysis:
        """Force immediate regime analysis (for testing/manual triggers)"""
        self.logger.info("Forcing regime analysis")
        
        analysis = await self.bitcoin_analyzer.analyze()
        await self._process_regime_analysis(analysis)
        
        return analysis
    
    async def override_strategy_mode(
        self, 
        mode: StrategyMode, 
        reason: str, 
        duration_hours: Optional[int] = None
    ) -> None:
        """Manually override strategy mode (for emergency situations)"""
        
        if self._current_state is None:
            raise ValidationError("No current strategy state to override", field="strategy_state")
        
        previous_state = self._current_state
        
        # Create override state
        override_state = StrategyState(
            mode=mode,
            regime=previous_state.regime,  # Keep current regime
            confidence=0.5,  # Lower confidence for manual override
            last_updated=datetime.utcnow(),
            regime_duration=previous_state.regime_duration,
            disabled_trade_types=self._get_disabled_trade_types(mode),
            metadata={
                **previous_state.metadata,
                "manual_override": True,
                "override_reason": reason,
                "override_timestamp": datetime.utcnow().isoformat(),
                "override_duration_hours": duration_hours,
                "previous_mode": previous_state.mode.value
            }
        )
        
        self._current_state = override_state
        
        # Persist the override
        await self._persist_state()
        
        self.logger.warning("Strategy mode manually overridden", {
            "previous_mode": previous_state.mode.value,
            "new_mode": mode.value,
            "reason": reason,
            "duration_hours": duration_hours
        })
        
        # Schedule automatic revert if duration specified
        if duration_hours:
            asyncio.create_task(self._revert_override_after_delay(duration_hours * 3600))
    
    async def _revert_override_after_delay(self, delay_seconds: int) -> None:
        """Revert manual override after specified delay"""
        await asyncio.sleep(delay_seconds)
        
        if (self._current_state and 
            self._current_state.metadata.get("manual_override")):
            
            self.logger.info("Reverting manual strategy override")
            
            # Force new analysis to determine correct mode
            await self.force_regime_analysis()


class TradeTypeFilter:
    """Utility class for filtering trades based on strategy mode"""
    
    def __init__(self, strategy_manager: StrategyModeManager):
        self.strategy_manager = strategy_manager
        self.logger = get_logger("trade_filter")
    
    def is_trade_allowed(self, direction: TradeDirection) -> tuple[bool, str]:
        """
        Check if trade direction is allowed
        Returns: (allowed, reason)
        """
        if not self.strategy_manager.is_trade_allowed(direction):
            current_mode = self.strategy_manager.get_current_strategy_mode()
            current_regime = self.strategy_manager.get_current_regime()
            
            reason = f"Trade direction {direction.value} not allowed in {current_mode.value} mode (regime: {current_regime.value})"
            
            self.logger.debug("Trade filtered by strategy mode", {
                "direction": direction.value,
                "mode": current_mode.value,
                "regime": current_regime.value
            })
            
            return False, reason
        
        return True, "Trade allowed"
    
    def filter_signals(self, signals: List[Any]) -> List[Any]:
        """Filter trading signals based on current strategy mode"""
        filtered_signals = []
        
        for signal in signals:
            allowed, reason = self.is_trade_allowed(signal.direction)
            if allowed:
                filtered_signals.append(signal)
            else:
                self.logger.debug("Signal filtered", {
                    "signal_id": getattr(signal, 'id', 'unknown'),
                    "direction": signal.direction.value,
                    "reason": reason
                })
        
        if len(filtered_signals) != len(signals):
            self.logger.info("Filtered trading signals", {
                "original_count": len(signals),
                "filtered_count": len(filtered_signals),
                "removed_count": len(signals) - len(filtered_signals)
            })
        
        return filtered_signals