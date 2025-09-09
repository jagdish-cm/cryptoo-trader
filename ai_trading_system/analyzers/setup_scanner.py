"""
Setup detection and scanning system for identifying trading opportunities
"""

import asyncio
from typing import List, Dict, Any, Optional, Tuple
from datetime import datetime, timedelta
from decimal import Decimal
from dataclasses import dataclass
from enum import Enum
import heapq

from ai_trading_system.analyzers.technical_analyzer import TechnicalAnalyzer, TechnicalSetup
from ai_trading_system.models.enums import SetupType, SignalStrength
from ai_trading_system.services.data_storage import DataAccessObject
from ai_trading_system.utils.logging import get_logger
from ai_trading_system.utils.errors import AnalysisError


class ScanPriority(str, Enum):
    """Priority levels for setup scanning"""
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


@dataclass
class ScanResult:
    """Result of a setup scan"""
    symbol: str
    setup: Optional[TechnicalSetup]
    scan_timestamp: datetime
    scan_duration: float  # seconds
    error: Optional[str] = None


@dataclass
class SetupAlert:
    """Alert for detected setup"""
    setup: TechnicalSetup
    priority: ScanPriority
    alert_timestamp: datetime
    expires_at: datetime
    metadata: Dict[str, Any]


class SetupScanner:
    """Main setup scanning engine"""
    
    def __init__(self, dao: DataAccessObject, technical_analyzer: TechnicalAnalyzer):
        self.dao = dao
        self.technical_analyzer = technical_analyzer
        self.logger = get_logger("setup_scanner")
        
        # Scanning configuration
        self.scan_interval = 300  # 5 minutes
        self.max_concurrent_scans = 10
        self.setup_expiry_hours = 4
        
        # Priority scoring
        self.priority_thresholds = {
            ScanPriority.CRITICAL: 0.9,
            ScanPriority.HIGH: 0.75,
            ScanPriority.MEDIUM: 0.6,
            ScanPriority.LOW: 0.4
        }
        
        # State management
        self._active_setups: Dict[str, SetupAlert] = {}
        self._scan_queue: List[Tuple[float, str]] = []  # (priority_score, symbol)
        self._scanning = False
        self._scan_task: Optional[asyncio.Task] = None
        
        # Performance tracking
        self._scan_stats = {
            'total_scans': 0,
            'setups_found': 0,
            'avg_scan_time': 0.0,
            'last_scan_time': None
        }
    
    async def initialize(self, watchlist: List[str]) -> None:
        """Initialize scanner with watchlist"""
        self.watchlist = watchlist
        
        # Initialize technical analyzer
        await self.technical_analyzer.initialize()
        
        # Populate initial scan queue
        for symbol in watchlist:
            heapq.heappush(self._scan_queue, (0.5, symbol))  # Medium priority initially
        
        self.logger.info("Setup scanner initialized", {
            "watchlist_size": len(watchlist),
            "scan_interval": self.scan_interval,
            "max_concurrent": self.max_concurrent_scans
        })
    
    async def start_scanning(self) -> None:
        """Start continuous setup scanning"""
        if self._scanning:
            self.logger.warning("Scanner already running")
            return
        
        self._scanning = True
        self._scan_task = asyncio.create_task(self._scanning_loop())
        
        self.logger.info("Setup scanning started")
    
    async def stop_scanning(self) -> None:
        """Stop setup scanning"""
        self._scanning = False
        
        if self._scan_task:
            self._scan_task.cancel()
            try:
                await self._scan_task
            except asyncio.CancelledError:
                pass
        
        self.logger.info("Setup scanning stopped")
    
    async def _scanning_loop(self) -> None:
        """Main scanning loop"""
        while self._scanning:
            try:
                scan_start = datetime.utcnow()
                
                # Perform batch scan
                await self._perform_batch_scan()
                
                # Clean up expired setups
                self._cleanup_expired_setups()
                
                # Update statistics
                scan_duration = (datetime.utcnow() - scan_start).total_seconds()
                self._update_scan_stats(scan_duration)
                
                # Wait for next scan
                await asyncio.sleep(self.scan_interval)
                
            except asyncio.CancelledError:
                break
            except Exception as e:
                self.logger.error("Error in scanning loop", {"error": str(e)})
                await asyncio.sleep(60)  # Wait 1 minute before retry
    
    async def _perform_batch_scan(self) -> None:
        """Perform batch scanning of symbols"""
        if not self._scan_queue:
            # Repopulate queue if empty
            for symbol in self.watchlist:
                heapq.heappush(self._scan_queue, (0.5, symbol))
        
        # Get symbols to scan (up to max_concurrent_scans)
        symbols_to_scan = []
        for _ in range(min(self.max_concurrent_scans, len(self._scan_queue))):
            if self._scan_queue:
                _, symbol = heapq.heappop(self._scan_queue)
                symbols_to_scan.append(symbol)
        
        if not symbols_to_scan:
            return
        
        # Create scan tasks
        scan_tasks = [
            self._scan_symbol(symbol) for symbol in symbols_to_scan
        ]
        
        # Execute scans concurrently
        scan_results = await asyncio.gather(*scan_tasks, return_exceptions=True)
        
        # Process results
        for result in scan_results:
            if isinstance(result, Exception):
                self.logger.error("Scan task failed", {"error": str(result)})
                continue
            
            if isinstance(result, ScanResult):
                await self._process_scan_result(result)
        
        self.logger.debug("Batch scan completed", {
            "symbols_scanned": len(symbols_to_scan),
            "setups_found": sum(1 for r in scan_results if isinstance(r, ScanResult) and r.setup)
        })
    
    async def _scan_symbol(self, symbol: str) -> ScanResult:
        """Scan a single symbol for setups"""
        scan_start = datetime.utcnow()
        
        try:
            # Detect setup
            setup = await self.technical_analyzer.detect_setup(symbol, "4h")
            
            scan_duration = (datetime.utcnow() - scan_start).total_seconds()
            
            return ScanResult(
                symbol=symbol,
                setup=setup,
                scan_timestamp=scan_start,
                scan_duration=scan_duration
            )
            
        except Exception as e:
            scan_duration = (datetime.utcnow() - scan_start).total_seconds()
            
            self.logger.warning("Symbol scan failed", {
                "symbol": symbol,
                "error": str(e)
            })
            
            return ScanResult(
                symbol=symbol,
                setup=None,
                scan_timestamp=scan_start,
                scan_duration=scan_duration,
                error=str(e)
            )
    
    async def _process_scan_result(self, result: ScanResult) -> None:
        """Process scan result and create alerts if needed"""
        self._scan_stats['total_scans'] += 1
        
        if result.error:
            # Re-queue symbol with lower priority for retry
            heapq.heappush(self._scan_queue, (0.3, result.symbol))
            return
        
        if result.setup:
            self._scan_stats['setups_found'] += 1
            
            # Calculate priority
            priority = self._calculate_setup_priority(result.setup)
            
            # Create alert
            alert = SetupAlert(
                setup=result.setup,
                priority=priority,
                alert_timestamp=result.scan_timestamp,
                expires_at=result.scan_timestamp + timedelta(hours=self.setup_expiry_hours),
                metadata={
                    'scan_duration': result.scan_duration,
                    'confidence': result.setup.confidence,
                    'strength': result.setup.strength.value
                }
            )
            
            # Store alert
            self._active_setups[result.symbol] = alert
            
            self.logger.info("Setup detected", {
                "symbol": result.symbol,
                "setup_type": result.setup.setup_type.value,
                "confidence": result.setup.confidence,
                "priority": priority.value
            })
            
            # Log AI decision for setup detection
            try:
                from ai_trading_system.services.ai_decision_logger import AIDecisionLogger
                decision_logger = AIDecisionLogger(self.dao)
                
                # Determine direction based on setup type
                direction = "LONG" if "long" in result.setup.setup_type.value.lower() else "SHORT"
                
                await decision_logger.log_signal_generation(
                    symbol=result.symbol,
                    direction=direction,
                    confidence=result.setup.confidence,
                    technical_score=result.setup.confidence,  # Use setup confidence as technical score
                    sentiment_score=0.5,  # Default neutral sentiment, would be replaced with real sentiment
                    setup_type=result.setup.setup_type.value,
                    reasoning=f"{result.setup.setup_type.value} setup detected with {result.setup.strength.value} strength"
                )
                
            except Exception as e:
                self.logger.warning(f"Failed to log AI decision: {e}")
            
            # Re-queue with adjusted priority based on setup quality
            next_priority = min(result.setup.confidence + 0.1, 1.0)
            heapq.heappush(self._scan_queue, (next_priority, result.symbol))
        else:
            # No setup found, re-queue with lower priority
            heapq.heappush(self._scan_queue, (0.4, result.symbol))
    
    def _calculate_setup_priority(self, setup: TechnicalSetup) -> ScanPriority:
        """Calculate priority level for a setup"""
        confidence = setup.confidence
        
        for priority, threshold in self.priority_thresholds.items():
            if confidence >= threshold:
                return priority
        
        return ScanPriority.LOW
    
    def _cleanup_expired_setups(self) -> None:
        """Remove expired setup alerts"""
        current_time = datetime.utcnow()
        expired_symbols = []
        
        for symbol, alert in self._active_setups.items():
            if current_time > alert.expires_at:
                expired_symbols.append(symbol)
        
        for symbol in expired_symbols:
            del self._active_setups[symbol]
            
        if expired_symbols:
            self.logger.debug("Cleaned up expired setups", {
                "expired_count": len(expired_symbols),
                "active_count": len(self._active_setups)
            })
    
    def _update_scan_stats(self, scan_duration: float) -> None:
        """Update scanning statistics"""
        self._scan_stats['last_scan_time'] = datetime.utcnow()
        
        # Update average scan time
        if self._scan_stats['avg_scan_time'] == 0:
            self._scan_stats['avg_scan_time'] = scan_duration
        else:
            # Exponential moving average
            alpha = 0.1
            self._scan_stats['avg_scan_time'] = (
                alpha * scan_duration + 
                (1 - alpha) * self._scan_stats['avg_scan_time']
            )
    
    # Public API methods
    
    def get_active_setups(self, priority: Optional[ScanPriority] = None) -> List[SetupAlert]:
        """Get active setup alerts, optionally filtered by priority"""
        alerts = list(self._active_setups.values())
        
        if priority:
            alerts = [alert for alert in alerts if alert.priority == priority]
        
        # Sort by priority and confidence
        priority_order = {
            ScanPriority.CRITICAL: 4,
            ScanPriority.HIGH: 3,
            ScanPriority.MEDIUM: 2,
            ScanPriority.LOW: 1
        }
        
        alerts.sort(
            key=lambda x: (priority_order[x.priority], x.setup.confidence),
            reverse=True
        )
        
        return alerts
    
    def get_setup_for_symbol(self, symbol: str) -> Optional[SetupAlert]:
        """Get active setup for a specific symbol"""
        return self._active_setups.get(symbol)
    
    def get_scan_statistics(self) -> Dict[str, Any]:
        """Get scanning performance statistics"""
        return {
            **self._scan_stats,
            'active_setups': len(self._active_setups),
            'queue_size': len(self._scan_queue),
            'watchlist_size': len(self.watchlist),
            'success_rate': (
                self._scan_stats['setups_found'] / max(self._scan_stats['total_scans'], 1)
            ) * 100
        }
    
    async def force_scan_symbol(self, symbol: str) -> Optional[TechnicalSetup]:
        """Force immediate scan of a specific symbol"""
        self.logger.info("Forcing scan", {"symbol": symbol})
        
        result = await self._scan_symbol(symbol)
        await self._process_scan_result(result)
        
        return result.setup
    
    def add_symbol_to_watchlist(self, symbol: str) -> None:
        """Add symbol to watchlist"""
        if symbol not in self.watchlist:
            self.watchlist.append(symbol)
            heapq.heappush(self._scan_queue, (0.6, symbol))  # Higher priority for new symbols
            
            self.logger.info("Added symbol to watchlist", {"symbol": symbol})
    
    def remove_symbol_from_watchlist(self, symbol: str) -> None:
        """Remove symbol from watchlist"""
        if symbol in self.watchlist:
            self.watchlist.remove(symbol)
            
            # Remove from active setups
            if symbol in self._active_setups:
                del self._active_setups[symbol]
            
            self.logger.info("Removed symbol from watchlist", {"symbol": symbol})


class SetupValidator:
    """Validates technical setups with additional confirmation"""
    
    def __init__(self, dao: DataAccessObject):
        self.dao = dao
        self.logger = get_logger("setup_validator")
    
    async def validate_setup(self, setup: TechnicalSetup) -> Tuple[bool, float, Dict[str, Any]]:
        """
        Validate a technical setup with additional confirmation
        Returns: (is_valid, adjusted_confidence, validation_details)
        """
        validation_factors = []
        
        try:
            # Get recent price data for validation
            recent_data = await self.dao.get_market_data_history(
                setup.symbol, setup.timeframe, limit=20
            )
            
            if len(recent_data) < 10:
                return False, 0.0, {"error": "Insufficient data for validation"}
            
            # Validation Factor 1: Price action confirmation
            price_confirmation = await self._validate_price_action(setup, recent_data)
            validation_factors.append(("price_action", price_confirmation))
            
            # Validation Factor 2: Volume confirmation
            volume_confirmation = await self._validate_volume(setup, recent_data)
            validation_factors.append(("volume", volume_confirmation))
            
            # Validation Factor 3: Multi-timeframe confirmation
            mtf_confirmation = await self._validate_multi_timeframe(setup)
            validation_factors.append(("multi_timeframe", mtf_confirmation))
            
            # Validation Factor 4: Support/Resistance levels
            sr_confirmation = await self._validate_support_resistance(setup, recent_data)
            validation_factors.append(("support_resistance", sr_confirmation))
            
            # Calculate overall validation score
            weights = [0.3, 0.2, 0.3, 0.2]  # Price, Volume, MTF, S/R
            validation_score = sum(
                factor * weight for (_, factor), weight in zip(validation_factors, weights)
            )
            
            # Adjust original confidence
            adjusted_confidence = setup.confidence * validation_score
            
            # Setup is valid if adjusted confidence is above threshold
            is_valid = adjusted_confidence >= 0.5
            
            validation_details = {
                "validation_factors": dict(validation_factors),
                "validation_score": validation_score,
                "original_confidence": setup.confidence,
                "adjusted_confidence": adjusted_confidence,
                "validation_timestamp": datetime.utcnow().isoformat()
            }
            
            self.logger.debug("Setup validation completed", {
                "symbol": setup.symbol,
                "setup_type": setup.setup_type.value,
                "is_valid": is_valid,
                "original_confidence": setup.confidence,
                "adjusted_confidence": adjusted_confidence
            })
            
            return is_valid, adjusted_confidence, validation_details
            
        except Exception as e:
            self.logger.error("Setup validation failed", {
                "symbol": setup.symbol,
                "error": str(e)
            })
            return False, 0.0, {"error": str(e)}
    
    async def _validate_price_action(self, setup: TechnicalSetup, recent_data: List) -> float:
        """Validate price action around setup levels"""
        if not setup.entry_price:
            return 0.5  # Neutral if no entry price
        
        current_price = recent_data[0].ohlcv.close  # Most recent price
        entry_price = setup.entry_price
        
        # Check if price is near entry level (within 2%)
        price_distance = abs(float(current_price - entry_price)) / float(entry_price)
        
        if price_distance <= 0.02:  # Within 2%
            return 1.0
        elif price_distance <= 0.05:  # Within 5%
            return 0.7
        else:
            return 0.3
    
    async def _validate_volume(self, setup: TechnicalSetup, recent_data: List) -> float:
        """Validate volume confirmation"""
        if len(recent_data) < 5:
            return 0.5
        
        # Calculate average volume
        volumes = [float(md.ohlcv.volume) for md in recent_data[:5]]
        avg_volume = sum(volumes) / len(volumes)
        current_volume = volumes[0]
        
        # Volume should be above average for confirmation
        volume_ratio = current_volume / avg_volume if avg_volume > 0 else 1.0
        
        if volume_ratio >= 1.5:  # 50% above average
            return 1.0
        elif volume_ratio >= 1.2:  # 20% above average
            return 0.8
        elif volume_ratio >= 1.0:  # At or above average
            return 0.6
        else:
            return 0.3
    
    async def _validate_multi_timeframe(self, setup: TechnicalSetup) -> float:
        """Validate setup across multiple timeframes"""
        try:
            # Check higher timeframe (daily if setup is 4h)
            higher_tf = "1d" if setup.timeframe == "4h" else "4h"
            
            # Get indicators for higher timeframe
            higher_tf_data = await self.dao.get_market_data_history(
                setup.symbol, higher_tf, limit=50
            )
            
            if len(higher_tf_data) < 20:
                return 0.5  # Neutral if insufficient data
            
            # Simple trend alignment check
            recent_prices = [float(md.ohlcv.close) for md in higher_tf_data[:10]]
            trend_direction = 1 if recent_prices[0] > recent_prices[-1] else -1
            
            # Check if setup aligns with higher timeframe trend
            if setup.setup_type in [SetupType.LONG_SUPPORT, SetupType.LONG_OVERSOLD, SetupType.LONG_BULLISH_CROSS]:
                return 1.0 if trend_direction > 0 else 0.3
            else:  # Short setups
                return 1.0 if trend_direction < 0 else 0.3
                
        except Exception:
            return 0.5  # Neutral if validation fails
    
    async def _validate_support_resistance(self, setup: TechnicalSetup, recent_data: List) -> float:
        """Validate setup against support/resistance levels"""
        if not setup.entry_price or len(recent_data) < 20:
            return 0.5
        
        # Find recent highs and lows
        prices = [float(md.ohlcv.high) for md in recent_data] + [float(md.ohlcv.low) for md in recent_data]
        entry_price = float(setup.entry_price)
        
        # Check if entry price is near significant levels
        for price in prices:
            distance = abs(price - entry_price) / entry_price
            if distance <= 0.01:  # Within 1%
                return 1.0
            elif distance <= 0.02:  # Within 2%
                return 0.8
        
        return 0.5  # No significant level nearby


class SetupPrioritizer:
    """Prioritizes setups based on multiple factors"""
    
    def __init__(self):
        self.logger = get_logger("setup_prioritizer")
    
    def prioritize_setups(self, setups: List[TechnicalSetup]) -> List[TechnicalSetup]:
        """Prioritize setups based on quality and market conditions"""
        if not setups:
            return []
        
        # Calculate priority scores
        scored_setups = []
        for setup in setups:
            score = self._calculate_priority_score(setup)
            scored_setups.append((score, setup))
        
        # Sort by score (highest first)
        scored_setups.sort(key=lambda x: x[0], reverse=True)
        
        # Return sorted setups
        prioritized = [setup for _, setup in scored_setups]
        
        self.logger.debug("Setups prioritized", {
            "total_setups": len(setups),
            "top_score": scored_setups[0][0] if scored_setups else 0,
            "avg_score": sum(score for score, _ in scored_setups) / len(scored_setups) if scored_setups else 0
        })
        
        return prioritized
    
    def _calculate_priority_score(self, setup: TechnicalSetup) -> float:
        """Calculate priority score for a setup"""
        score_factors = []
        
        # Base confidence
        score_factors.append(("confidence", setup.confidence, 0.4))
        
        # Signal strength
        strength_scores = {
            SignalStrength.VERY_STRONG: 1.0,
            SignalStrength.STRONG: 0.8,
            SignalStrength.MODERATE: 0.6,
            SignalStrength.WEAK: 0.4
        }
        strength_score = strength_scores.get(setup.strength, 0.5)
        score_factors.append(("strength", strength_score, 0.2))
        
        # Risk-reward ratio
        if setup.entry_price and setup.stop_loss and setup.take_profit_levels:
            risk = abs(float(setup.entry_price - setup.stop_loss))
            reward = abs(float(setup.take_profit_levels[0] - setup.entry_price)) if setup.take_profit_levels else risk
            rr_ratio = reward / risk if risk > 0 else 1.0
            rr_score = min(rr_ratio / 3.0, 1.0)  # Normalize to 0-1, cap at 3:1 ratio
            score_factors.append(("risk_reward", rr_score, 0.2))
        else:
            score_factors.append(("risk_reward", 0.5, 0.2))
        
        # Pattern reliability
        if setup.patterns:
            avg_reliability = sum(p.reliability for p in setup.patterns) / len(setup.patterns)
            score_factors.append(("patterns", avg_reliability, 0.1))
        else:
            score_factors.append(("patterns", 0.5, 0.1))
        
        # Time factor (newer setups get slight boost)
        time_diff = (datetime.utcnow() - setup.timestamp).total_seconds()
        time_score = max(0.5, 1.0 - (time_diff / 3600))  # Decay over 1 hour
        score_factors.append(("time", time_score, 0.1))
        
        # Calculate weighted score
        total_score = sum(score * weight for _, score, weight in score_factors)
        
        return min(total_score, 1.0)  # Cap at 1.0