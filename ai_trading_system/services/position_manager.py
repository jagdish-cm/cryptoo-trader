"""
Position Management Service
Handles active position monitoring, updates, and lifecycle management
"""

import asyncio
import logging
from datetime import datetime, timedelta
from typing import Dict, List, Optional
from decimal import Decimal

from ..models.trading import Position, Trade
from ..models.enums import TradeDirection, PositionStatus, SetupType
from ..services.data_storage import DataAccessObject
from ..services.exchange_client import ExchangeClient
from ..services.multi_source_market_data import get_current_prices
from ..utils.logging import get_logger

logger = get_logger(__name__)

class PositionManager:
    """
    Manages all active positions and their lifecycle
    Implements Phase 6: Active Trade Management
    """
    
    def __init__(self, dao: DataAccessObject, exchange_client: ExchangeClient):
        self.dao = dao
        self.exchange = exchange_client
        self.active_positions: Dict[str, Position] = {}
        self.monitoring_tasks: Dict[str, asyncio.Task] = {}
        self.trailing_stop_enabled = True
        self.trailing_stop_distance = 0.02  # 2% trailing stop
        
    async def start_position_monitoring(self):
        """
        Start monitoring all active positions
        """
        try:
            logger.info("Starting position monitoring service")
            
            # Load all active positions from database
            active_positions = await self._load_active_positions()
            
            for position in active_positions:
                await self.add_position_monitoring(position)
            
            logger.info(f"Started monitoring {len(active_positions)} active positions")
            
        except Exception as e:
            logger.error(f"Error starting position monitoring: {e}")
    
    async def add_position_monitoring(self, position: Position):
        """
        Add a position to active monitoring
        """
        try:
            if position.id in self.monitoring_tasks:
                # Cancel existing monitoring task
                self.monitoring_tasks[position.id].cancel()
            
            # Start new monitoring task
            task = asyncio.create_task(self._monitor_position(position))
            self.monitoring_tasks[position.id] = task
            self.active_positions[position.id] = position
            
            logger.info(f"Added position {position.id} to monitoring")
            
        except Exception as e:
            logger.error(f"Error adding position monitoring for {position.id}: {e}")
    
    async def remove_position_monitoring(self, position_id: str):
        """
        Remove a position from active monitoring
        """
        try:
            if position_id in self.monitoring_tasks:
                self.monitoring_tasks[position_id].cancel()
                del self.monitoring_tasks[position_id]
            
            if position_id in self.active_positions:
                del self.active_positions[position_id]
            
            logger.info(f"Removed position {position_id} from monitoring")
            
        except Exception as e:
            logger.error(f"Error removing position monitoring for {position_id}: {e}")
    
    async def _monitor_position(self, position: Position):
        """
        Monitor a single position continuously
        """
        try:
            logger.info(f"Starting monitoring for position {position.id}")
            
            while position.status == PositionStatus.OPEN:
                # Update position with current market data
                await self._update_position_data(position)
                
                # Check take-profit levels
                await self._check_take_profit_execution(position)
                
                # Update trailing stop if enabled
                if self.trailing_stop_enabled:
                    await self._update_trailing_stop(position)
                
                # Check for position closure conditions
                if await self._should_close_position(position):
                    await self._close_position(position, "SYSTEM_CLOSE")
                    break
                
                # Save updated position to database
                await self._save_position_update(position)
                
                # Wait before next check
                await asyncio.sleep(30)  # Check every 30 seconds
                
                # Reload position from database to get latest status
                updated_position = await self._get_position_from_db(position.id)
                if not updated_position or updated_position.status != PositionStatus.OPEN:
                    break
                
                position = updated_position
            
            # Remove from active monitoring when done
            await self.remove_position_monitoring(position.id)
            
            logger.info(f"Monitoring ended for position {position.id}")
            
        except asyncio.CancelledError:
            logger.info(f"Monitoring cancelled for position {position.id}")
        except Exception as e:
            logger.error(f"Error monitoring position {position.id}: {e}")
    
    async def _update_position_data(self, position: Position):
        """
        Update position with current market data
        """
        try:
            # Get current price
            current_prices = await get_current_prices([position.symbol])
            if position.symbol not in current_prices:
                logger.warning(f"Could not get current price for {position.symbol}")
                return
            
            current_price = Decimal(str(current_prices[position.symbol]['price']))
            position.current_price = current_price
            
            # Calculate unrealized P&L
            if position.direction == TradeDirection.LONG:
                position.unrealized_pnl = (current_price - position.entry_price) * position.quantity
            else:  # SHORT
                position.unrealized_pnl = (position.entry_price - current_price) * position.quantity
            
            position.updated_at = datetime.utcnow()
            
        except Exception as e:
            logger.error(f"Error updating position data for {position.id}: {e}")
    
    async def _check_take_profit_execution(self, position: Position):
        """
        Check if any take-profit levels should be executed
        """
        try:
            if not position.take_profit_levels:
                return
            
            current_price = position.current_price
            
            for i, tp_level in enumerate(position.take_profit_levels):
                should_execute = False
                
                if position.direction == TradeDirection.LONG and current_price >= tp_level:
                    should_execute = True
                elif position.direction == TradeDirection.SHORT and current_price <= tp_level:
                    should_execute = True
                
                if should_execute:
                    await self._execute_partial_close(position, tp_level, f"TAKE_PROFIT_{i+1}")
                    # Remove executed take-profit level
                    position.take_profit_levels.remove(tp_level)
                    break  # Only execute one level at a time
            
        except Exception as e:
            logger.error(f"Error checking take-profit for position {position.id}: {e}")
    
    async def _execute_partial_close(self, position: Position, price: Decimal, reason: str):
        """
        Execute partial position closure at take-profit level
        """
        try:
            # Calculate quantity to close (e.g., 50% for first TP, 100% for final)
            close_percentage = 0.5 if len(position.take_profit_levels) > 1 else 1.0
            close_quantity = position.quantity * Decimal(str(close_percentage))
            
            # Place market order to close partial position
            close_order = await self.exchange.place_market_order(
                symbol=position.symbol,
                side="sell" if position.direction == TradeDirection.LONG else "buy",
                quantity=float(close_quantity)
            )
            
            if close_order and close_order.get("status") == "filled":
                # Update position quantity
                position.quantity -= close_quantity
                
                # Create trade record for the closed portion
                await self._create_trade_record(position, close_order, reason, close_quantity)
                
                # If position is fully closed, update status
                if position.quantity <= 0:
                    position.status = PositionStatus.CLOSED
                
                logger.info(f"Executed partial close for position {position.id}: {close_quantity} at {price}")
                
        except Exception as e:
            logger.error(f"Error executing partial close for position {position.id}: {e}")
    
    async def _update_trailing_stop(self, position: Position):
        """
        Update trailing stop-loss based on favorable price movement
        """
        try:
            if not position.stop_loss:
                return
            
            current_price = position.current_price
            current_stop = position.stop_loss
            
            # Calculate new trailing stop
            if position.direction == TradeDirection.LONG:
                # For long positions, trail stop up as price increases
                new_stop = current_price * (1 - self.trailing_stop_distance)
                if new_stop > current_stop:
                    position.stop_loss = new_stop
                    logger.info(f"Updated trailing stop for {position.id}: {current_stop} -> {new_stop}")
            else:
                # For short positions, trail stop down as price decreases
                new_stop = current_price * (1 + self.trailing_stop_distance)
                if new_stop < current_stop:
                    position.stop_loss = new_stop
                    logger.info(f"Updated trailing stop for {position.id}: {current_stop} -> {new_stop}")
            
        except Exception as e:
            logger.error(f"Error updating trailing stop for position {position.id}: {e}")
    
    async def _should_close_position(self, position: Position) -> bool:
        """
        Check if position should be closed based on various conditions
        """
        try:
            current_price = position.current_price
            
            # Check stop-loss
            if position.stop_loss:
                if position.direction == TradeDirection.LONG and current_price <= position.stop_loss:
                    logger.info(f"Stop-loss triggered for position {position.id}")
                    return True
                elif position.direction == TradeDirection.SHORT and current_price >= position.stop_loss:
                    logger.info(f"Stop-loss triggered for position {position.id}")
                    return True
            
            # Check maximum holding time (e.g., 7 days)
            max_holding_time = timedelta(days=7)
            if datetime.utcnow() - position.created_at > max_holding_time:
                logger.info(f"Maximum holding time reached for position {position.id}")
                return True
            
            # Check for extreme unrealized loss (e.g., -10%)
            loss_threshold = position.entry_price * position.quantity * Decimal("0.10")
            if position.unrealized_pnl < -loss_threshold:
                logger.warning(f"Extreme loss detected for position {position.id}: {position.unrealized_pnl}")
                return True
            
            return False
            
        except Exception as e:
            logger.error(f"Error checking close conditions for position {position.id}: {e}")
            return False
    
    async def _close_position(self, position: Position, reason: str):
        """
        Close a position completely
        """
        try:
            logger.info(f"Closing position {position.id} - Reason: {reason}")
            
            # Cancel any existing orders for this position
            await self.exchange.cancel_all_orders(position.symbol)
            
            # Place market order to close position
            close_order = await self.exchange.place_market_order(
                symbol=position.symbol,
                side="sell" if position.direction == TradeDirection.LONG else "buy",
                quantity=float(position.quantity)
            )
            
            if close_order and close_order.get("status") == "filled":
                # Update position status
                position.status = PositionStatus.CLOSED
                position.updated_at = datetime.utcnow()
                
                # Create trade record
                await self._create_trade_record(position, close_order, reason, position.quantity)
                
                # Save final position state
                await self._save_position_update(position)
                
                logger.info(f"Successfully closed position {position.id}")
            else:
                logger.error(f"Failed to close position {position.id}")
                
        except Exception as e:
            logger.error(f"Error closing position {position.id}: {e}")
    
    async def _create_trade_record(self, position: Position, close_order: Dict, exit_reason: str, quantity: Decimal):
        """
        Create a trade record for a closed position or partial close
        """
        try:
            exit_price = Decimal(str(close_order["fill_price"]))
            
            # Calculate realized P&L
            if position.direction == TradeDirection.LONG:
                realized_pnl = (exit_price - position.entry_price) * quantity
            else:
                realized_pnl = (position.entry_price - exit_price) * quantity
            
            trade = Trade(
                id=f"trade_{position.id}_{datetime.utcnow().timestamp()}",
                position_id=position.id,
                symbol=position.symbol,
                direction=position.direction,
                entry_price=position.entry_price,
                exit_price=exit_price,
                quantity=quantity,
                entry_time=position.created_at,
                exit_time=datetime.utcnow(),
                realized_pnl=realized_pnl,
                fees=Decimal(str(close_order.get("fees", 0))),
                exit_reason=exit_reason,
                setup_type=None  # Could be populated from original signal
            )
            
            # Save trade to database
            await self._save_trade_record(trade)
            
            logger.info(f"Created trade record {trade.id} for position {position.id}")
            
        except Exception as e:
            logger.error(f"Error creating trade record for position {position.id}: {e}")
    
    async def get_active_positions(self) -> List[Position]:
        """
        Get all currently active positions
        """
        return list(self.active_positions.values())
    
    async def get_position_by_id(self, position_id: str) -> Optional[Position]:
        """
        Get a specific position by ID
        """
        if position_id in self.active_positions:
            return self.active_positions[position_id]
        
        return await self._get_position_from_db(position_id)
    
    async def force_close_position(self, position_id: str, reason: str = "MANUAL_CLOSE") -> bool:
        """
        Force close a position manually
        """
        try:
            position = await self.get_position_by_id(position_id)
            if not position:
                logger.error(f"Position {position_id} not found")
                return False
            
            await self._close_position(position, reason)
            return True
            
        except Exception as e:
            logger.error(f"Error force closing position {position_id}: {e}")
            return False
    
    async def force_close_all_positions(self, reason: str = "EMERGENCY_CLOSE"):
        """
        Force close all active positions (emergency stop)
        """
        try:
            logger.warning("Force closing all active positions")
            
            positions = list(self.active_positions.values())
            for position in positions:
                await self._close_position(position, reason)
            
            logger.info(f"Force closed {len(positions)} positions")
            
        except Exception as e:
            logger.error(f"Error force closing all positions: {e}")
    
    # Database helper methods
    async def _load_active_positions(self) -> List[Position]:
        """Load active positions from database"""
        # Implementation would query database for active positions
        return []
    
    async def _get_position_from_db(self, position_id: str) -> Optional[Position]:
        """Get position from database"""
        # Implementation would query database
        return None
    
    async def _save_position_update(self, position: Position):
        """Save position update to database"""
        # Implementation would update database
        pass
    
    async def _save_trade_record(self, trade: Trade):
        """Save trade record to database"""
        # Implementation would save to database
        pass