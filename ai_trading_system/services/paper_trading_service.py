"""
Paper Trading Service - Simulates trade execution based on AI signals
This service creates realistic paper trades without using real money
"""

import asyncio
import json
from typing import Dict, List, Optional, Tuple
from datetime import datetime, timedelta
from decimal import Decimal
from uuid import uuid4
from dataclasses import dataclass

from ai_trading_system.models.trading import TradingSignal, Position, Trade, Portfolio
from ai_trading_system.models.enums import TradeDirection, PositionStatus, SetupType
from ai_trading_system.services.data_storage import DataAccessObject
from ai_trading_system.services.multi_source_market_data import get_current_prices
from ai_trading_system.utils.logging import get_logger


@dataclass
class PaperTradingConfig:
    """Configuration for paper trading"""
    initial_balance: float = 100000.0  # $100k starting balance
    max_position_size: float = 0.05  # 5% of portfolio per position
    transaction_fee: float = 0.001  # 0.1% fee per trade
    slippage: float = 0.0005  # 0.05% slippage
    min_trade_amount: float = 100.0  # Minimum $100 per trade


class PaperTradingService:
    """Service for executing paper trades based on AI signals"""
    
    def __init__(self, dao: DataAccessObject, config: PaperTradingConfig = None):
        self.dao = dao
        self.config = config or PaperTradingConfig()
        self.logger = get_logger("paper_trading")
        
        # Portfolio state
        self.current_balance = self.config.initial_balance
        self.total_pnl = 0.0
        self.daily_pnl = 0.0
        self.max_drawdown = 0.0
        
        # Position tracking
        self.active_positions: Dict[str, Position] = {}
        self.completed_trades: List[Trade] = []
        
    async def initialize(self):
        """Initialize paper trading service"""
        # Load existing positions and balance from database
        await self._load_portfolio_state()
        self.logger.info("Paper trading service initialized", {
            "balance": self.current_balance,
            "active_positions": len(self.active_positions),
            "total_pnl": self.total_pnl
        })
    
    async def execute_signal(self, signal: TradingSignal) -> Optional[Position]:
        """Execute a paper trade based on an AI signal"""
        try:
            # Get current market price using multi-source service
            price_data = await get_current_prices([signal.symbol])
            if not price_data or signal.symbol not in price_data:
                self.logger.warning(f"Could not get price for {signal.symbol}, skipping trade")
                return None
            
            current_price = price_data[signal.symbol]['price']
            
            # Calculate position size based on portfolio risk
            position_size = self._calculate_position_size(signal, current_price)
            if position_size < self.config.min_trade_amount:
                self.logger.info(f"Position size too small for {signal.symbol}: ${position_size}")
                return None
            
            # Check if we have enough balance
            required_margin = position_size * (1 + self.config.transaction_fee)
            if required_margin > self.current_balance:
                self.logger.warning(f"Insufficient balance for {signal.symbol}: need ${required_margin}, have ${self.current_balance}")
                return None
            
            # Apply slippage to entry price
            entry_price = self._apply_slippage(current_price, signal.direction, is_entry=True)
            
            # Calculate quantity
            quantity = position_size / entry_price
            
            # Generate order ID for entry order
            entry_order_id = f"order_{str(uuid4())[:8]}"
            
            # Create position
            position = Position(
                id=str(uuid4()),
                symbol=signal.symbol,
                direction=signal.direction,
                entry_price=Decimal(str(entry_price)),
                current_price=Decimal(str(current_price)),
                quantity=Decimal(str(quantity)),
                stop_loss=signal.stop_loss,
                take_profit_levels=signal.take_profit_levels,
                status=PositionStatus.OPEN,
                created_at=datetime.utcnow(),
                entry_orders=[entry_order_id],  # Store order ID as string
                exit_orders=[],
                metadata={
                    "signal_id": signal.id,
                    "setup_type": signal.setup_type.value,
                    "ai_confidence": float(signal.confidence),
                    "technical_score": float(signal.technical_score),
                    "sentiment_score": float(signal.sentiment_score),
                    "entry_order_details": {  # Store order details in metadata
                        entry_order_id: {
                            "type": "MARKET",
                            "price": entry_price,
                            "quantity": quantity,
                            "timestamp": datetime.utcnow().isoformat(),
                            "fee": position_size * self.config.transaction_fee
                        }
                    },
                    "exit_order_details": {}
                }
            )
            
            # Update balance
            total_cost = position_size + (position_size * self.config.transaction_fee)
            self.current_balance -= total_cost
            
            # Store position
            self.active_positions[position.id] = position
            
            # Store position in database
            try:
                await self._store_position(position)
                self.logger.info(f"Successfully stored position {position.id} in database")
            except Exception as e:
                self.logger.error(f"Failed to store position {position.id} in database: {e}")
                # Remove from active positions if database storage failed
                if position.id in self.active_positions:
                    del self.active_positions[position.id]
                raise
            
            self.logger.info("Paper trade executed", {
                "symbol": signal.symbol,
                "direction": signal.direction.value,
                "entry_price": entry_price,
                "quantity": quantity,
                "position_size": position_size,
                "remaining_balance": self.current_balance
            })
            
            return position
            
        except Exception as e:
            self.logger.error(f"Failed to execute paper trade for {signal.symbol}: {e}")
            return None
    
    async def update_positions(self):
        """Update all active positions with current market prices"""
        if not self.active_positions:
            return
        
        updated_positions = []
        
        for position_id, position in list(self.active_positions.items()):
            try:
                # Get current price using multi-source service
                price_data = await get_current_prices([position.symbol])
                if not price_data or position.symbol not in price_data:
                    continue
                
                current_price = price_data[position.symbol]['price']
                
                # Update position
                old_price = float(position.current_price)
                position.current_price = Decimal(str(current_price))
                
                # Note: unrealized_pnl is automatically calculated as a property
                # based on current_price, entry_price, and quantity
                
                # Check for stop loss or take profit
                should_close, exit_reason = self._should_close_position(position, current_price)
                
                if should_close:
                    await self._close_position(position, current_price, exit_reason)
                    updated_positions.append(position)
                else:
                    # Update position in database
                    await self._update_position(position)
                    updated_positions.append(position)
                
                # Log significant price movements
                price_change = abs(current_price - old_price) / old_price
                if price_change > 0.02:  # 2% change
                    self.logger.debug(f"Position {position.symbol} price update: ${old_price:.2f} -> ${current_price:.2f} ({price_change:.1%})")
                
            except Exception as e:
                self.logger.error(f"Failed to update position here {position.symbol}: {e}")
        
        if updated_positions:
            self.logger.debug(f"Updated {len(updated_positions)} positions")
    
    def _calculate_position_size(self, signal: TradingSignal, current_price: float) -> float:
        """Calculate position size based on risk management"""
        # Base position size on portfolio percentage
        base_size = self.current_balance * self.config.max_position_size
        
        # Adjust based on signal confidence
        confidence_multiplier = float(signal.confidence)
        adjusted_size = base_size * confidence_multiplier
        
        # Ensure minimum trade size
        return max(adjusted_size, self.config.min_trade_amount)
    
    def _apply_slippage(self, price: float, direction: TradeDirection, is_entry: bool) -> float:
        """Apply realistic slippage to trade price"""
        slippage_factor = self.config.slippage
        
        if is_entry:
            # Entry: buy higher, sell lower
            if direction == TradeDirection.LONG:
                return price * (1 + slippage_factor)
            else:  # SHORT
                return price * (1 - slippage_factor)
        else:
            # Exit: opposite of entry
            if direction == TradeDirection.LONG:
                return price * (1 - slippage_factor)
            else:  # SHORT
                return price * (1 + slippage_factor)
    
    def _should_close_position(self, position: Position, current_price: float) -> Tuple[bool, str]:
        """Check if position should be closed based on stop loss or take profit"""
        
        # Check stop loss
        if position.stop_loss:
            stop_price = float(position.stop_loss)
            
            if position.direction == TradeDirection.LONG and current_price <= stop_price:
                return True, "STOP_LOSS"
            elif position.direction == TradeDirection.SHORT and current_price >= stop_price:
                return True, "STOP_LOSS"
        
        # Check take profit levels
        if position.take_profit_levels:
            for tp_level in position.take_profit_levels:
                tp_price = float(tp_level)
                
                if position.direction == TradeDirection.LONG and current_price >= tp_price:
                    return True, "TAKE_PROFIT"
                elif position.direction == TradeDirection.SHORT and current_price <= tp_price:
                    return True, "TAKE_PROFIT"
        
        # Check position timeout (24 hours default)
        position_age = datetime.utcnow() - position.created_at
        if position_age > timedelta(hours=24):
            return True, "TIMEOUT"
        
        return False, ""
    
    async def _close_position(self, position: Position, exit_price: float, exit_reason: str):
        """Close a position and create a completed trade"""
        try:
            # Apply slippage to exit price
            final_exit_price = self._apply_slippage(exit_price, position.direction, is_entry=False)
            
            # Calculate realized P&L
            if position.direction == TradeDirection.LONG:
                pnl = (final_exit_price - float(position.entry_price)) * float(position.quantity)
            else:  # SHORT
                pnl = (float(position.entry_price) - final_exit_price) * float(position.quantity)
            
            # Subtract fees
            exit_fee = (final_exit_price * float(position.quantity)) * self.config.transaction_fee
            realized_pnl = pnl - exit_fee
            
            # Update balance
            position_value = final_exit_price * float(position.quantity)
            self.current_balance += position_value - exit_fee
            self.total_pnl += realized_pnl
            self.daily_pnl += realized_pnl
            
            # Create completed trade
            trade = Trade(
                id=str(uuid4()),
                position_id=position.id,
                symbol=position.symbol,
                direction=position.direction,
                entry_price=position.entry_price,
                exit_price=Decimal(str(final_exit_price)),
                quantity=position.quantity,
                entry_time=position.created_at,
                exit_time=datetime.utcnow(),
                realized_pnl=Decimal(str(realized_pnl)),
                fees=Decimal(str(exit_fee)),
                exit_reason=exit_reason,
                setup_type=SetupType(position.metadata.get("setup_type", "LONG_SUPPORT")),
                metadata=position.metadata
            )
            
            # Generate exit order ID
            exit_order_id = f"order_{str(uuid4())[:8]}"
            
            # Update position status
            position.status = PositionStatus.CLOSED
            position.closed_at = datetime.utcnow()
            position.exit_orders.append(exit_order_id)  # Store order ID as string
            
            # Store exit order details in metadata
            if "exit_order_details" not in position.metadata:
                position.metadata["exit_order_details"] = {}
            position.metadata["exit_order_details"][exit_order_id] = {
                "type": "MARKET",
                "price": final_exit_price,
                "quantity": float(position.quantity),
                "timestamp": datetime.utcnow().isoformat(),
                "fee": exit_fee,
                "reason": exit_reason
            }
            
            # Store trade and update position
            await self._store_trade(trade)
            await self._update_position(position)
            
            # Remove from active positions
            if position.id in self.active_positions:
                del self.active_positions[position.id]
            
            # Update max drawdown
            self._update_max_drawdown()
            
            self.logger.info("Position closed", {
                "symbol": position.symbol,
                "direction": position.direction.value,
                "entry_price": float(position.entry_price),
                "exit_price": final_exit_price,
                "pnl": realized_pnl,
                "reason": exit_reason,
                "balance": self.current_balance
            })
            
        except Exception as e:
            self.logger.error(f"Failed to close position {position.symbol}: {e}")
    
    def _update_max_drawdown(self):
        """Update maximum drawdown calculation"""
        current_total = self.current_balance + sum(float(pos.unrealized_pnl) for pos in self.active_positions.values())
        peak_value = max(self.config.initial_balance, current_total)
        drawdown = (peak_value - current_total) / peak_value
        self.max_drawdown = max(self.max_drawdown, drawdown)
    
    async def get_portfolio(self) -> Portfolio:
        """Get current portfolio state"""
        # Update positions first
        await self.update_positions()
        
        # Calculate total portfolio value
        unrealized_pnl = sum(float(pos.unrealized_pnl) for pos in self.active_positions.values())
        total_value = self.current_balance + unrealized_pnl
        
        return Portfolio(
            total_value=Decimal(str(total_value)),
            available_balance=Decimal(str(self.current_balance)),
            positions=list(self.active_positions.values()),
            daily_pnl=Decimal(str(self.daily_pnl)),
            total_pnl=Decimal(str(self.total_pnl)),
            max_drawdown=Decimal(str(self.max_drawdown)),
            last_updated=datetime.utcnow()
        )
    
    async def _store_position(self, position: Position):
        """Store position in database"""
        try:
            query = """
            INSERT INTO positions (
                id, symbol, direction, entry_price, current_price, quantity,
                stop_loss, take_profit_levels, status, created_at, closed_at,
                entry_orders, exit_orders, metadata
            ) VALUES (
                :id, :symbol, :direction, :entry_price, :current_price, :quantity,
                :stop_loss, :take_profit_levels, :status, :created_at, :closed_at,
                :entry_orders, :exit_orders, :metadata
            )
            """
            
            await self.dao.db.execute_non_query(query, {
                'id': position.id,
                'symbol': position.symbol,
                'direction': position.direction.value,
                'entry_price': float(position.entry_price),
                'current_price': float(position.current_price),
                'quantity': float(position.quantity),
                'stop_loss': float(position.stop_loss) if position.stop_loss else None,
                'take_profit_levels': json.dumps([float(tp) for tp in position.take_profit_levels]),
                'status': position.status.value,
                'created_at': position.created_at,
                'closed_at': position.closed_at,
                'entry_orders': json.dumps(position.entry_orders),
                'exit_orders': json.dumps(position.exit_orders),
                'metadata': json.dumps(position.metadata)
            })
            
        except Exception as e:
            self.logger.error(f"Failed to store position: {e}")
    
    async def _update_position(self, position: Position):
        """Update position in database"""
        try:
            query = """
            UPDATE positions SET
                current_price = :current_price,
                status = :status,
                closed_at = :closed_at,
                exit_orders = :exit_orders
            WHERE id = :id
            """
            
            await self.dao.db.execute_non_query(query, {
                'id': position.id,
                'current_price': float(position.current_price),
                'status': position.status.value,
                'closed_at': position.closed_at,
                'exit_orders': json.dumps(position.exit_orders)
            })
            
        except Exception as e:
            self.logger.error(f"Failed to update position: {e}")
    
    async def _store_trade(self, trade: Trade):
        """Store completed trade in database"""
        try:
            query = """
            INSERT INTO trades (
                id, position_id, symbol, direction, entry_price, exit_price,
                quantity, entry_time, exit_time, realized_pnl, fees,
                exit_reason, setup_type, metadata
            ) VALUES (
                :id, :position_id, :symbol, :direction, :entry_price, :exit_price,
                :quantity, :entry_time, :exit_time, :realized_pnl, :fees,
                :exit_reason, :setup_type, :metadata
            )
            """
            
            await self.dao.db.execute_non_query(query, {
                'id': trade.id,
                'position_id': trade.position_id,
                'symbol': trade.symbol,
                'direction': trade.direction.value,
                'entry_price': float(trade.entry_price),
                'exit_price': float(trade.exit_price),
                'quantity': float(trade.quantity),
                'entry_time': trade.entry_time,
                'exit_time': trade.exit_time,
                'realized_pnl': float(trade.realized_pnl),
                'fees': float(trade.fees),
                'exit_reason': trade.exit_reason,
                'setup_type': trade.setup_type.value if trade.setup_type else None,
                'metadata': json.dumps(trade.metadata)
            })
            
        except Exception as e:
            self.logger.error(f"Failed to store trade: {e}")
    
    async def _load_portfolio_state(self):
        """Load existing portfolio state from database"""
        try:
            # Load active positions
            positions_query = """
            SELECT * FROM positions WHERE status = 'open'
            """
            
            position_rows = await self.dao.db.execute_query(positions_query)
            self.logger.info(f"Loading portfolio state: found {len(position_rows) if position_rows else 0} active positions")
            
            for row in position_rows:
                # Helper function to safely parse JSON fields
                def safe_json_loads(value):
                    if isinstance(value, str):
                        return json.loads(value)
                    elif isinstance(value, (list, dict)):
                        return value  # Already parsed
                    else:
                        return value
                
                position = Position(
                    id=row['id'],
                    symbol=row['symbol'],
                    direction=TradeDirection(row['direction']),
                    entry_price=Decimal(str(row['entry_price'])),
                    current_price=Decimal(str(row['current_price'])),
                    quantity=Decimal(str(row['quantity'])),
                    stop_loss=Decimal(str(row['stop_loss'])) if row['stop_loss'] else None,
                    take_profit_levels=[Decimal(str(tp)) for tp in safe_json_loads(row['take_profit_levels'])],
                    status=PositionStatus(row['status']),
                    created_at=row['created_at'],
                    closed_at=row['closed_at'],
                    entry_orders=safe_json_loads(row['entry_orders']),
                    exit_orders=safe_json_loads(row['exit_orders']),
                    metadata=safe_json_loads(row['metadata'])
                )
                self.active_positions[position.id] = position
            
            # Calculate portfolio metrics from completed trades
            trades_query = """
            SELECT SUM(realized_pnl) as total_pnl,
                   SUM(CASE WHEN DATE(exit_time) = CURRENT_DATE THEN realized_pnl ELSE 0 END) as daily_pnl
            FROM trades
            """
            
            result = await self.dao.db.execute_query(trades_query)
            if result and result[0]['total_pnl']:
                self.total_pnl = float(result[0]['total_pnl'])
                self.daily_pnl = float(result[0]['daily_pnl'] or 0)
            
            # Adjust balance based on active positions
            position_value = sum(float(pos.entry_price) * float(pos.quantity) for pos in self.active_positions.values())
            self.current_balance = self.config.initial_balance + self.total_pnl - position_value
            
            self.logger.info("Portfolio state loaded", {
                "active_positions": len(self.active_positions),
                "total_pnl": self.total_pnl,
                "daily_pnl": self.daily_pnl,
                "balance": self.current_balance
            })
            
        except Exception as e:
            self.logger.error(f"Failed to load portfolio state: {e}")
            # Reset to initial state on error
            self.current_balance = self.config.initial_balance
            self.active_positions = {}
    
    async def save_portfolio_snapshot(self, portfolio: Portfolio):
        """Save portfolio snapshot for historical tracking"""
        try:
            # This could be implemented to save portfolio snapshots to database
            # For now, just log the snapshot
            self.logger.debug(f"Portfolio snapshot: Total Value: ${float(portfolio.total_value)}, "
                            f"Positions: {len(portfolio.positions)}, P&L: ${float(portfolio.total_pnl)}")
        except Exception as e:
            self.logger.error(f"Failed to save portfolio snapshot: {e}")