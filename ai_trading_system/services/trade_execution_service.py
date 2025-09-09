"""
Trade Execution Service
Handles the actual execution of trading signals into real trades
"""

import asyncio
import logging
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple
from decimal import Decimal
from enum import Enum

from ..models.trading import Position, Trade, TradingSignal, Portfolio
from ..models.enums import TradeDirection, PositionStatus, SetupType
from ..services.data_storage import DataAccessObject
from ..services.exchange_client import ExchangeClient
from ..services.multi_source_market_data import get_current_prices
from ..utils.logging import get_logger

logger = get_logger(__name__)

class ExecutionDecision(Enum):
    EXECUTE = "EXECUTE"
    REJECT = "REJECT"
    DEFER = "DEFER"

class RiskCheckResult(Enum):
    PASS = "PASS"
    FAIL_REGIME = "FAIL_REGIME"
    FAIL_EXPOSURE = "FAIL_EXPOSURE"
    FAIL_VOLATILITY = "FAIL_VOLATILITY"
    FAIL_LIQUIDITY = "FAIL_LIQUIDITY"

class TradeExecutionService:
    """
    Core service for executing trading signals into actual trades
    Implements the complete trading pipeline from signal to execution
    """
    
    def __init__(self, dao: DataAccessObject, exchange_client: ExchangeClient):
        self.dao = dao
        self.exchange = exchange_client
        self.max_portfolio_risk = 0.02  # 2% max risk per trade
        self.max_position_size = 0.10   # 10% max position size
        self.max_sector_exposure = 0.30 # 30% max sector exposure
        
    async def process_signal(self, signal: TradingSignal) -> Dict:
        """
        Main entry point for processing a trading signal
        Implements the complete pipeline from Phase 3 to Phase 5
        """
        try:
            logger.info(f"Processing signal {signal.id} for {signal.symbol} - {signal.signal_type}")
            
            # Phase 3: The Gauntlet - Final Risk Checks
            risk_result = await self._perform_risk_checks(signal)
            if risk_result != RiskCheckResult.PASS:
                await self._log_rejection(signal, f"Risk check failed: {risk_result.value}")
                return {
                    "decision": ExecutionDecision.REJECT.value,
                    "reason": f"Risk check failed: {risk_result.value}",
                    "signal_id": signal.id
                }
            
            # Phase 4: The Blueprint - Define Trade Parameters
            trade_params = await self._calculate_trade_parameters(signal)
            if not trade_params:
                await self._log_rejection(signal, "Failed to calculate trade parameters")
                return {
                    "decision": ExecutionDecision.REJECT.value,
                    "reason": "Failed to calculate trade parameters",
                    "signal_id": signal.id
                }
            
            # Phase 5: The Execution - Execute the trade
            execution_result = await self._execute_trade(signal, trade_params)
            
            # Log the execution decision
            await self._log_execution_decision(signal, execution_result)
            
            return execution_result
            
        except Exception as e:
            logger.error(f"Error processing signal {signal.id}: {e}")
            await self._log_rejection(signal, f"Execution error: {str(e)}")
            return {
                "decision": ExecutionDecision.REJECT.value,
                "reason": f"Execution error: {str(e)}",
                "signal_id": signal.id
            }
    
    async def _perform_risk_checks(self, signal: TradingSignal) -> RiskCheckResult:
        """
        Phase 3: Perform comprehensive risk checks before execution
        """
        try:
            # 1. Regime Compliance Check
            current_regime = await self._get_current_market_regime()
            if not self._is_signal_regime_compliant(signal, current_regime):
                logger.info(f"Signal {signal.id} rejected: regime compliance failure")
                return RiskCheckResult.FAIL_REGIME
            
            # 2. Portfolio Exposure Check
            current_portfolio = await self._get_current_portfolio()
            if not await self._check_portfolio_exposure(signal, current_portfolio):
                logger.info(f"Signal {signal.id} rejected: portfolio exposure limit")
                return RiskCheckResult.FAIL_EXPOSURE
            
            # 3. Volatility Check
            if not await self._check_volatility_limits(signal):
                logger.info(f"Signal {signal.id} rejected: volatility too high")
                return RiskCheckResult.FAIL_VOLATILITY
            
            # 4. Liquidity Check
            if not await self._check_liquidity(signal):
                logger.info(f"Signal {signal.id} rejected: insufficient liquidity")
                return RiskCheckResult.FAIL_LIQUIDITY
            
            logger.info(f"Signal {signal.id} passed all risk checks")
            return RiskCheckResult.PASS
            
        except Exception as e:
            logger.error(f"Error in risk checks for signal {signal.id}: {e}")
            return RiskCheckResult.FAIL_VOLATILITY  # Default to rejection
    
    async def _calculate_trade_parameters(self, signal: TradingSignal) -> Optional[Dict]:
        """
        Phase 4: Calculate precise trade parameters
        """
        try:
            # Get current market price
            current_prices = await get_current_prices([signal.symbol])
            if signal.symbol not in current_prices:
                logger.error(f"Could not get current price for {signal.symbol}")
                return None
            
            current_price = current_prices[signal.symbol]['price']
            
            # Calculate entry price (with small buffer for market orders)
            if "BUY" in signal.signal_type or "LONG" in signal.signal_type:
                entry_price = current_price * 1.001  # 0.1% above current price
                stop_loss_price = current_price * (1 - signal.stop_loss_pct)
                take_profit_prices = [
                    current_price * (1 + tp) for tp in signal.take_profit_levels
                ]
            else:  # SELL_SIGNAL or SHORT
                entry_price = current_price * 0.999  # 0.1% below current price
                stop_loss_price = current_price * (1 + signal.stop_loss_pct)
                take_profit_prices = [
                    current_price * (1 - tp) for tp in signal.take_profit_levels
                ]
            
            # Calculate position size based on risk management
            portfolio_value = await self._get_portfolio_value()
            risk_amount = portfolio_value * self.max_portfolio_risk
            
            # Position size = Risk Amount / Distance to Stop Loss
            price_distance = abs(entry_price - stop_loss_price)
            if price_distance == 0:
                logger.error(f"Invalid stop loss distance for signal {signal.id}")
                return None
            
            position_size = risk_amount / price_distance
            
            # Ensure position size doesn't exceed maximum position size
            max_position_value = portfolio_value * self.max_position_size
            if position_size * entry_price > max_position_value:
                position_size = max_position_value / entry_price
            
            trade_params = {
                "entry_price": float(entry_price),
                "stop_loss_price": float(stop_loss_price),
                "take_profit_prices": [float(tp) for tp in take_profit_prices],
                "position_size": float(position_size),
                "direction": TradeDirection.LONG if "BUY" in signal.signal_type or "LONG" in signal.signal_type else TradeDirection.SHORT,
                "risk_amount": float(risk_amount),
                "current_price": float(current_price)
            }
            
            logger.info(f"Calculated trade parameters for {signal.symbol}: {trade_params}")
            return trade_params
            
        except Exception as e:
            logger.error(f"Error calculating trade parameters for signal {signal.id}: {e}")
            return None
    
    async def _execute_trade(self, signal: TradingSignal, trade_params: Dict) -> Dict:
        """
        Phase 5: Execute the actual trade on the exchange
        """
        try:
            # 1. Place entry order
            entry_order = await self.exchange.place_market_order(
                symbol=signal.symbol,
                side="buy" if trade_params["direction"] == TradeDirection.LONG else "sell",
                quantity=trade_params["position_size"]
            )
            
            if not entry_order or entry_order.get("status") != "filled":
                logger.error(f"Entry order failed for signal {signal.id}")
                return {
                    "decision": ExecutionDecision.REJECT.value,
                    "reason": "Entry order execution failed",
                    "signal_id": signal.id
                }
            
            # 2. Create position record
            position = Position(
                id=f"pos_{signal.id}",
                symbol=signal.symbol,
                direction=trade_params["direction"],
                entry_price=Decimal(str(entry_order["fill_price"])),
                current_price=Decimal(str(entry_order["fill_price"])),
                quantity=Decimal(str(entry_order["filled_quantity"])),
                unrealized_pnl=Decimal("0"),
                stop_loss=Decimal(str(trade_params["stop_loss_price"])),
                take_profit_levels=[Decimal(str(tp)) for tp in trade_params["take_profit_prices"]],
                status=PositionStatus.OPEN,
                created_at=datetime.utcnow(),
                updated_at=datetime.utcnow()
            )
            
            # 3. Save position to database
            await self._save_position(position)
            
            # 4. Place OCO (One-Cancels-Other) orders for stop-loss and take-profit
            await self._place_oco_orders(position, trade_params)
            
            # 5. Start position monitoring
            asyncio.create_task(self._monitor_position(position))
            
            logger.info(f"Successfully executed trade for signal {signal.id}, position {position.id}")
            
            return {
                "decision": ExecutionDecision.EXECUTE.value,
                "reason": "Trade executed successfully",
                "signal_id": signal.id,
                "position_id": position.id,
                "entry_price": float(position.entry_price),
                "quantity": float(position.quantity),
                "order_id": entry_order["order_id"]
            }
            
        except Exception as e:
            logger.error(f"Error executing trade for signal {signal.id}: {e}")
            return {
                "decision": ExecutionDecision.REJECT.value,
                "reason": f"Trade execution failed: {str(e)}",
                "signal_id": signal.id
            }
    
    async def _place_oco_orders(self, position: Position, trade_params: Dict):
        """
        Place OCO (One-Cancels-Other) orders for stop-loss and take-profit
        """
        try:
            # Place stop-loss order
            stop_loss_order = await self.exchange.place_stop_loss_order(
                symbol=position.symbol,
                side="sell" if position.direction == TradeDirection.LONG else "buy",
                quantity=float(position.quantity),
                stop_price=float(position.stop_loss)
            )
            
            # Place first take-profit order
            if position.take_profit_levels:
                first_tp = position.take_profit_levels[0]
                take_profit_order = await self.exchange.place_limit_order(
                    symbol=position.symbol,
                    side="sell" if position.direction == TradeDirection.LONG else "buy",
                    quantity=float(position.quantity) * 0.5,  # Sell 50% at first TP
                    price=float(first_tp)
                )
            
            logger.info(f"Placed OCO orders for position {position.id}")
            
        except Exception as e:
            logger.error(f"Error placing OCO orders for position {position.id}: {e}")
    
    async def _monitor_position(self, position: Position):
        """
        Phase 6: Active trade management and monitoring
        """
        try:
            logger.info(f"Starting position monitoring for {position.id}")
            
            while position.status == PositionStatus.OPEN:
                # Update current price and P&L
                await self._update_position_pnl(position)
                
                # Check for take-profit levels
                await self._check_take_profit_levels(position)
                
                # Check for trailing stop updates
                await self._update_trailing_stop(position)
                
                # Check for emergency exit conditions
                if await self._check_emergency_exit(position):
                    await self._emergency_exit_position(position)
                    break
                
                # Sleep for monitoring interval
                await asyncio.sleep(30)  # Check every 30 seconds
                
                # Reload position status from database
                position = await self._get_position_by_id(position.id)
                if not position or position.status != PositionStatus.OPEN:
                    break
            
            logger.info(f"Position monitoring ended for {position.id}")
            
        except Exception as e:
            logger.error(f"Error monitoring position {position.id}: {e}")
    
    async def _check_emergency_exit(self, position: Position) -> bool:
        """
        Check if emergency exit conditions are met
        """
        try:
            # Query LLM for critical events
            from ..services.llm_client import LLMClient
            llm = LLMClient()
            
            # Check for critical negative events
            event_check = await llm.check_critical_events(position.symbol)
            if event_check.get("critical_event_detected"):
                logger.warning(f"Critical event detected for {position.symbol}: {event_check.get('event_description')}")
                return True
            
            # Check for extreme volatility
            current_prices = await get_current_prices([position.symbol])
            if position.symbol in current_prices:
                current_price = current_prices[position.symbol]['price']
                price_change = abs(current_price - float(position.entry_price)) / float(position.entry_price)
                
                if price_change > 0.15:  # 15% price change threshold
                    logger.warning(f"Extreme price movement detected for {position.symbol}: {price_change:.2%}")
                    return True
            
            return False
            
        except Exception as e:
            logger.error(f"Error checking emergency exit for position {position.id}: {e}")
            return False
    
    async def _emergency_exit_position(self, position: Position):
        """
        Execute emergency exit for a position
        """
        try:
            logger.warning(f"Executing emergency exit for position {position.id}")
            
            # Cancel all existing orders for this position
            await self.exchange.cancel_all_orders(position.symbol)
            
            # Place market order to close position immediately
            close_order = await self.exchange.place_market_order(
                symbol=position.symbol,
                side="sell" if position.direction == TradeDirection.LONG else "buy",
                quantity=float(position.quantity)
            )
            
            if close_order and close_order.get("status") == "filled":
                # Update position status
                position.status = PositionStatus.CLOSED
                position.updated_at = datetime.utcnow()
                await self._save_position(position)
                
                # Create trade record
                await self._create_trade_record(position, close_order, "EMERGENCY_EXIT")
                
                logger.info(f"Emergency exit completed for position {position.id}")
            else:
                logger.error(f"Emergency exit failed for position {position.id}")
                
        except Exception as e:
            logger.error(f"Error in emergency exit for position {position.id}: {e}")
    
    # Helper methods for risk checks and calculations
    async def _get_current_market_regime(self) -> str:
        """Get current market regime (BULL/BEAR/RANGE)"""
        # Implementation would check Bitcoin's position relative to key MAs
        # For now, return a default
        return "RANGE"
    
    def _is_signal_regime_compliant(self, signal: TradingSignal, regime: str) -> bool:
        """Check if signal complies with current market regime"""
        if regime == "BULL" and ("SELL" in signal.signal_type or "SHORT" in signal.signal_type):
            return False
        if regime == "BEAR" and ("BUY" in signal.signal_type or "LONG" in signal.signal_type):
            return False
        return True
    
    async def _check_portfolio_exposure(self, signal: TradingSignal, portfolio: Portfolio) -> bool:
        """Check if adding this position would exceed portfolio exposure limits"""
        # Implementation would check sector exposure, correlation, etc.
        return True  # Simplified for now
    
    async def _check_volatility_limits(self, signal: TradingSignal) -> bool:
        """Check if asset volatility is within acceptable limits"""
        # Implementation would check recent volatility metrics
        return True  # Simplified for now
    
    async def _check_liquidity(self, signal: TradingSignal) -> bool:
        """Check if asset has sufficient liquidity for the trade"""
        # Implementation would check order book depth, recent volume
        return True  # Simplified for now
    
    async def _get_current_portfolio(self) -> Portfolio:
        """Get current portfolio state"""
        # Implementation would fetch from database
        pass
    
    async def _get_portfolio_value(self) -> float:
        """Get total portfolio value"""
        # Implementation would calculate total portfolio value
        return 100000.0  # Placeholder
    
    async def _save_position(self, position: Position):
        """Save position to database"""
        # Implementation would save to database
        pass
    
    async def _log_execution_decision(self, signal: TradingSignal, result: Dict):
        """Log the execution decision to database"""
        try:
            decision_log = {
                "signal_id": signal.id,
                "symbol": signal.symbol,
                "decision": result["decision"],
                "reason": result["reason"],
                "timestamp": datetime.utcnow(),
                "signal_confidence": signal.confidence,
                "execution_details": result
            }
            
            # Save to ai_decisions table
            query = """
            INSERT INTO ai_decisions (
                id, timestamp, decision_type, symbol, confidence,
                technical_score, sentiment_score, event_impact,
                reasoning, factors, outcome, execution_decision,
                rejection_reasons, execution_probability
            ) VALUES (
                :id, :timestamp, :decision_type, :symbol, :confidence,
                :technical_score, :sentiment_score, :event_impact,
                :reasoning, :factors, :outcome, :execution_decision,
                :rejection_reasons, :execution_probability
            )
            """
            
            await self.dao.db.execute_query(query, {
                "id": signal.id,
                "timestamp": datetime.utcnow(),
                "decision_type": "TRADE_EXECUTION",
                "symbol": signal.symbol,
                "confidence": float(signal.confidence),
                "technical_score": float(signal.technical_score or 0),
                "sentiment_score": float(signal.sentiment_score or 0),
                "event_impact": float(signal.event_impact or 0),
                "reasoning": signal.reasoning or {},
                "factors": signal.factors or {},
                "outcome": result,
                "execution_decision": result["decision"],
                "rejection_reasons": [result["reason"]] if result["decision"] == "REJECT" else [],
                "execution_probability": float(signal.confidence)
            })
            
            logger.info(f"Logged execution decision for signal {signal.id}")
            
        except Exception as e:
            logger.error(f"Error logging execution decision: {e}")
    
    async def _log_rejection(self, signal: TradingSignal, reason: str):
        """Log signal rejection"""
        await self._log_execution_decision(signal, {
            "decision": ExecutionDecision.REJECT.value,
            "reason": reason,
            "signal_id": signal.id
        })