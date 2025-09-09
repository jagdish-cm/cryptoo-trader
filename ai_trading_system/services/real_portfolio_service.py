"""
Real Portfolio Service - Connects to actual trading system database for portfolio data
This service replaces all mock data generation with real database queries
"""

from typing import List, Optional, Dict, Any
from datetime import datetime, timedelta
from decimal import Decimal
import asyncio

from ai_trading_system.models.trading import Portfolio, Position, Trade
from ai_trading_system.models.enums import PositionStatus, TradeDirection
from ai_trading_system.services.data_storage import DatabaseConnection, RedisCache, DataAccessObject
from ai_trading_system.services.multi_source_market_data import get_current_prices
from ai_trading_system.utils.logging import get_logger
from ai_trading_system.utils.errors import SystemError


class RealPortfolioService:
    """Service for managing real portfolio data from trading system database"""
    
    def __init__(self, dao: DataAccessObject):
        self.dao = dao
        self.logger = get_logger("real_portfolio_service")
    
    async def get_portfolio(self) -> Optional[Portfolio]:
        """Get current portfolio with real position data and live price calculations"""
        try:
            # Get actual positions from database
            positions = await self.get_real_positions()
            
            if not positions:
                # Return empty portfolio if no positions exist
                return Portfolio(
                    total_value=Decimal('10000.0'),  # Starting balance
                    available_balance=Decimal('10000.0'),
                    positions=[],
                    daily_pnl=Decimal('0'),
                    total_pnl=Decimal('0'),
                    max_drawdown=Decimal('0'),
                    last_updated=datetime.utcnow()
                )
            
            # Calculate portfolio metrics from real positions
            portfolio_metrics = await self.calculate_portfolio_metrics(positions)
            
            return Portfolio(
                total_value=portfolio_metrics['total_value'],
                available_balance=portfolio_metrics['available_balance'],
                positions=positions,
                daily_pnl=portfolio_metrics['daily_pnl'],
                total_pnl=portfolio_metrics['total_pnl'],
                max_drawdown=portfolio_metrics['max_drawdown'],
                last_updated=datetime.utcnow()
            )
            
        except Exception as e:
            self.logger.error("Failed to get real portfolio data", {"error": str(e)})
            return None
    
    async def get_real_positions(self) -> List[Position]:
        """Get actual open positions from trading system database"""
        try:
            # Query actual positions from database
            query = """
            SELECT id, symbol, direction, entry_price, quantity, stop_loss, 
                   take_profit_levels, status, created_at, closed_at, 
                   entry_orders, exit_orders, metadata
            FROM positions 
            WHERE status = 'OPEN'
            ORDER BY created_at DESC
            """
            
            position_rows = await self.dao.db.execute_query(query)
            
            if not position_rows:
                self.logger.info("No open positions found in database")
                return []
            
            # Get current prices for all position symbols
            symbols = list(set([row['symbol'] for row in position_rows]))
            current_prices = await get_current_prices(symbols)
            
            positions = []
            for row in position_rows:
                symbol = row['symbol']
                
                # Get current price from live market data
                current_price = None
                if symbol in current_prices:
                    current_price = Decimal(str(current_prices[symbol]['price']))
                else:
                    # Fallback to cached price if live data unavailable
                    cached_price = await self.dao.get_latest_price(symbol)
                    if cached_price:
                        current_price = cached_price
                    else:
                        self.logger.warning(f"No current price available for {symbol}")
                        continue
                
                # Create Position object with real data
                position = Position(
                    id=row['id'],
                    symbol=symbol,
                    direction=TradeDirection(row['direction']),
                    entry_price=Decimal(str(row['entry_price'])),
                    current_price=current_price,
                    quantity=Decimal(str(row['quantity'])),
                    stop_loss=Decimal(str(row['stop_loss'])) if row['stop_loss'] else None,
                    take_profit_levels=[Decimal(str(level)) for level in (row['take_profit_levels'] or [])],
                    status=PositionStatus(row['status']),
                    created_at=row['created_at'],
                    closed_at=row['closed_at'],
                    entry_orders=row['entry_orders'] or [],
                    exit_orders=row['exit_orders'] or [],
                    metadata=row['metadata'] or {}
                )
                
                positions.append(position)
                
                self.logger.debug(f"Loaded real position: {symbol} {row['direction']} "
                                f"Entry: ${row['entry_price']} Current: ${current_price} "
                                f"P&L: ${position.unrealized_pnl}")
            
            self.logger.info(f"Loaded {len(positions)} real positions from database")
            return positions
            
        except Exception as e:
            self.logger.error("Failed to get real positions", {"error": str(e)})
            return []
    
    async def calculate_portfolio_metrics(self, positions: List[Position]) -> Dict[str, Decimal]:
        """Calculate real portfolio metrics from actual positions"""
        try:
            # Starting balance (could be configurable or from account balance table)
            starting_balance = Decimal('10000.0')
            
            # Calculate total unrealized P&L from positions
            total_unrealized_pnl = sum(position.unrealized_pnl for position in positions)
            
            # Calculate total position value
            total_position_value = sum(position.position_value for position in positions)
            
            # Calculate invested amount (entry value of positions)
            total_invested = sum(position.entry_price * position.quantity for position in positions)
            
            # Available balance = starting balance - invested amount + realized P&L
            realized_pnl = await self.get_total_realized_pnl()
            available_balance = starting_balance - total_invested + realized_pnl
            
            # Total portfolio value = available balance + current position values
            total_value = available_balance + total_position_value
            
            # Calculate daily P&L (change in portfolio value from yesterday)
            daily_pnl = await self.calculate_daily_pnl()
            
            # Calculate maximum drawdown from trade history
            max_drawdown = await self.calculate_max_drawdown()
            
            metrics = {
                'total_value': total_value,
                'available_balance': max(Decimal('0'), available_balance),  # Ensure non-negative
                'daily_pnl': daily_pnl,
                'total_pnl': realized_pnl + total_unrealized_pnl,
                'max_drawdown': max_drawdown
            }
            
            self.logger.info("Calculated real portfolio metrics", {
                "total_value": float(metrics['total_value']),
                "available_balance": float(metrics['available_balance']),
                "total_pnl": float(metrics['total_pnl']),
                "positions_count": len(positions)
            })
            
            return metrics
            
        except Exception as e:
            self.logger.error("Failed to calculate portfolio metrics", {"error": str(e)})
            # Return safe defaults
            return {
                'total_value': Decimal('10000.0'),
                'available_balance': Decimal('10000.0'),
                'daily_pnl': Decimal('0'),
                'total_pnl': Decimal('0'),
                'max_drawdown': Decimal('0')
            }
    
    async def get_total_realized_pnl(self) -> Decimal:
        """Get total realized P&L from completed trades"""
        try:
            query = """
            SELECT COALESCE(SUM(realized_pnl), 0) as total_realized_pnl
            FROM trades
            """
            
            result = await self.dao.db.execute_query(query)
            
            if result and result[0]['total_realized_pnl'] is not None:
                return Decimal(str(result[0]['total_realized_pnl']))
            
            return Decimal('0')
            
        except Exception as e:
            self.logger.error("Failed to get total realized P&L", {"error": str(e)})
            return Decimal('0')
    
    async def calculate_daily_pnl(self) -> Decimal:
        """Calculate daily P&L change from yesterday's portfolio value"""
        try:
            # Get yesterday's portfolio snapshot
            yesterday = datetime.utcnow() - timedelta(days=1)
            
            query = """
            SELECT total_value, total_pnl
            FROM portfolio_snapshots
            WHERE timestamp >= %s
            ORDER BY timestamp DESC
            LIMIT 1
            """
            
            result = await self.dao.db.execute_query(query, {'timestamp': yesterday})
            
            if result:
                yesterday_total_pnl = Decimal(str(result[0]['total_pnl']))
                current_total_pnl = await self.get_current_total_pnl()
                return current_total_pnl - yesterday_total_pnl
            
            # If no historical data, return 0
            return Decimal('0')
            
        except Exception as e:
            self.logger.error("Failed to calculate daily P&L", {"error": str(e)})
            return Decimal('0')
    
    async def get_current_total_pnl(self) -> Decimal:
        """Get current total P&L (realized + unrealized)"""
        try:
            realized_pnl = await self.get_total_realized_pnl()
            
            # Get unrealized P&L from current positions
            positions = await self.get_real_positions()
            unrealized_pnl = sum(position.unrealized_pnl for position in positions)
            
            return realized_pnl + unrealized_pnl
            
        except Exception as e:
            self.logger.error("Failed to get current total P&L", {"error": str(e)})
            return Decimal('0')
    
    async def calculate_max_drawdown(self) -> Decimal:
        """Calculate maximum drawdown from trade history and portfolio snapshots"""
        try:
            # Get portfolio value history
            query = """
            SELECT total_value, total_pnl, timestamp
            FROM portfolio_snapshots
            ORDER BY timestamp ASC
            """
            
            snapshots = await self.dao.db.execute_query(query)
            
            if not snapshots:
                return Decimal('0')
            
            # Calculate maximum drawdown
            peak_value = Decimal('0')
            max_drawdown = Decimal('0')
            
            for snapshot in snapshots:
                current_value = Decimal(str(snapshot['total_value']))
                
                # Update peak if current value is higher
                if current_value > peak_value:
                    peak_value = current_value
                
                # Calculate drawdown from peak
                if peak_value > 0:
                    drawdown = (current_value - peak_value) / peak_value * 100
                    if drawdown < max_drawdown:
                        max_drawdown = drawdown
            
            return max_drawdown
            
        except Exception as e:
            self.logger.error("Failed to calculate max drawdown", {"error": str(e)})
            return Decimal('0')
    
    async def save_portfolio_snapshot(self, portfolio: Portfolio) -> bool:
        """Save current portfolio state as a snapshot for historical tracking"""
        try:
            query = """
            INSERT INTO portfolio_snapshots (
                total_value, available_balance, daily_pnl, total_pnl, 
                max_drawdown, positions_count, timestamp
            ) VALUES (
                :total_value, :available_balance, :daily_pnl, :total_pnl,
                :max_drawdown, :positions_count, :timestamp
            )
            """
            
            params = {
                'total_value': float(portfolio.total_value),
                'available_balance': float(portfolio.available_balance),
                'daily_pnl': float(portfolio.daily_pnl),
                'total_pnl': float(portfolio.total_pnl),
                'max_drawdown': float(portfolio.max_drawdown),
                'positions_count': len(portfolio.positions),
                'timestamp': datetime.utcnow()
            }
            
            async with self.dao.db.session() as session:
                from sqlalchemy import text
                await session.execute(text(query), params)
            
            self.logger.debug("Saved portfolio snapshot")
            return True
            
        except Exception as e:
            self.logger.error("Failed to save portfolio snapshot", {"error": str(e)})
            return False
    
    async def get_trade_history(self, limit: int = 50, offset: int = 0) -> List[Trade]:
        """Get actual completed trades from database"""
        try:
            query = """
            SELECT id, position_id, symbol, direction, entry_price, exit_price,
                   quantity, entry_time, exit_time, realized_pnl, fees,
                   exit_reason, setup_type, metadata
            FROM trades
            ORDER BY exit_time DESC
            LIMIT :limit OFFSET :offset
            """
            
            trade_rows = await self.dao.db.execute_query(query, {
                'limit': limit,
                'offset': offset
            })
            
            trades = []
            for row in trade_rows:
                trade = Trade(
                    id=row['id'],
                    position_id=row['position_id'],
                    symbol=row['symbol'],
                    direction=TradeDirection(row['direction']),
                    entry_price=Decimal(str(row['entry_price'])),
                    exit_price=Decimal(str(row['exit_price'])),
                    quantity=Decimal(str(row['quantity'])),
                    entry_time=row['entry_time'],
                    exit_time=row['exit_time'],
                    realized_pnl=Decimal(str(row['realized_pnl'])),
                    fees=Decimal(str(row['fees'])) if row['fees'] else Decimal('0'),
                    exit_reason=row['exit_reason'],
                    setup_type=row['setup_type'],
                    metadata=row['metadata'] or {}
                )
                trades.append(trade)
            
            self.logger.info(f"Retrieved {len(trades)} real trades from database")
            return trades
            
        except Exception as e:
            self.logger.error("Failed to get trade history", {"error": str(e)})
            return []
    
    async def calculate_performance_metrics(self, period: str = "30d") -> Dict[str, Any]:
        """Calculate real performance metrics from actual trade data"""
        try:
            # Parse period
            days = 30
            if period.endswith('d'):
                days = int(period[:-1])
            elif period == 'all':
                days = 365 * 10  # 10 years for "all"
            
            # Get trades within period
            start_date = datetime.utcnow() - timedelta(days=days)
            
            query = """
            SELECT realized_pnl, fees, entry_time, exit_time
            FROM trades
            WHERE exit_time >= :start_date
            ORDER BY exit_time DESC
            """
            
            trades = await self.dao.db.execute_query(query, {'start_date': start_date})
            
            if not trades:
                return {
                    "totalReturn": 0.0,
                    "dailyPnL": 0.0,
                    "winRate": 0.0,
                    "sharpeRatio": 0.0,
                    "maxDrawdown": 0.0,
                    "volatility": 0.0,
                    "totalTrades": 0,
                    "avgTradeReturn": 0.0
                }
            
            # Calculate metrics from real trade data
            total_trades = len(trades)
            winning_trades = len([t for t in trades if float(t['realized_pnl']) > 0])
            win_rate = (winning_trades / total_trades * 100) if total_trades > 0 else 0
            
            total_pnl = sum(float(t['realized_pnl']) for t in trades)
            total_fees = sum(float(t['fees']) if t['fees'] else 0 for t in trades)
            net_pnl = total_pnl - total_fees
            
            avg_trade_return = net_pnl / total_trades if total_trades > 0 else 0
            
            # Calculate return percentage (assuming starting balance)
            starting_balance = 10000.0
            total_return_pct = (net_pnl / starting_balance * 100) if starting_balance > 0 else 0
            
            # Calculate daily P&L
            if days > 0:
                daily_pnl = net_pnl / days
            else:
                daily_pnl = 0
            
            # Calculate volatility from trade returns
            if len(trades) > 1:
                returns = [float(t['realized_pnl']) for t in trades]
                mean_return = sum(returns) / len(returns)
                variance = sum([(r - mean_return) ** 2 for r in returns]) / len(returns)
                volatility = (variance ** 0.5) / 100  # Convert to percentage
            else:
                volatility = 0
            
            # Estimate Sharpe ratio (simplified)
            if volatility > 0:
                sharpe_ratio = (total_return_pct / 100) / volatility
            else:
                sharpe_ratio = 0
            
            # Get max drawdown from portfolio snapshots
            max_drawdown = float(await self.calculate_max_drawdown())
            
            metrics = {
                "totalReturn": round(total_return_pct, 2),
                "dailyPnL": round(daily_pnl, 2),
                "winRate": round(win_rate, 1),
                "sharpeRatio": round(sharpe_ratio, 2),
                "maxDrawdown": round(max_drawdown, 2),
                "volatility": round(volatility * 100, 1),  # Convert back to percentage
                "totalTrades": total_trades,
                "avgTradeReturn": round(avg_trade_return, 2)
            }
            
            self.logger.info("Calculated real performance metrics", metrics)
            return metrics
            
        except Exception as e:
            self.logger.error("Failed to calculate performance metrics", {"error": str(e)})
            # Return empty metrics instead of mock data
            return {
                "totalReturn": 0.0,
                "dailyPnL": 0.0,
                "winRate": 0.0,
                "sharpeRatio": 0.0,
                "maxDrawdown": 0.0,
                "volatility": 0.0,
                "totalTrades": 0,
                "avgTradeReturn": 0.0
            }