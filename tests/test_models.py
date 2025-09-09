"""
Tests for data models
"""

import pytest
from datetime import datetime, timedelta
from decimal import Decimal
from pydantic import ValidationError

from ai_trading_system.models.enums import (
    TradeDirection, PositionStatus, OrderType, OrderStatus,
    MarketRegime, Sentiment, EventType, SetupType, SignalStrength
)
from ai_trading_system.models.market_data import OHLCV, MarketData, TechnicalIndicators
from ai_trading_system.models.trading import Order, Position, Trade, Portfolio, TradingSignal


class TestOHLCV:
    """Test OHLCV data model"""
    
    def test_valid_ohlcv(self):
        ohlcv = OHLCV(
            open=Decimal('100'),
            high=Decimal('110'),
            low=Decimal('95'),
            close=Decimal('105'),
            volume=Decimal('1000')
        )
        assert ohlcv.open == Decimal('100')
        assert ohlcv.is_bullish is True
        assert ohlcv.typical_price == Decimal('103.333333333333333333333333333')
    
    def test_invalid_high_low(self):
        with pytest.raises(ValidationError):
            OHLCV(
                open=Decimal('100'),
                high=Decimal('90'),  # High < Low
                low=Decimal('95'),
                close=Decimal('105'),
                volume=Decimal('1000')
            )
    
    def test_negative_values(self):
        with pytest.raises(ValidationError):
            OHLCV(
                open=Decimal('-100'),  # Negative price
                high=Decimal('110'),
                low=Decimal('95'),
                close=Decimal('105'),
                volume=Decimal('1000')
            )
    
    def test_bearish_candle(self):
        ohlcv = OHLCV(
            open=Decimal('105'),
            high=Decimal('110'),
            low=Decimal('95'),
            close=Decimal('100'),  # Close < Open
            volume=Decimal('1000')
        )
        assert ohlcv.is_bearish is True
        assert ohlcv.is_bullish is False


class TestMarketData:
    """Test MarketData model"""
    
    def test_valid_market_data(self):
        ohlcv = OHLCV(
            open=Decimal('100'),
            high=Decimal('110'),
            low=Decimal('95'),
            close=Decimal('105'),
            volume=Decimal('1000')
        )
        
        market_data = MarketData(
            symbol="BTC/USDT",
            timestamp=datetime.utcnow(),
            ohlcv=ohlcv,
            timeframe="4h",
            source="binance"
        )
        
        assert market_data.base_asset == "BTC"
        assert market_data.quote_asset == "USDT"
        assert market_data.price == Decimal('105')
        assert market_data.volume_usd == Decimal('105000')  # 1000 * 105
    
    def test_invalid_symbol_format(self):
        ohlcv = OHLCV(
            open=Decimal('100'),
            high=Decimal('110'),
            low=Decimal('95'),
            close=Decimal('105'),
            volume=Decimal('1000')
        )
        
        with pytest.raises(ValidationError):
            MarketData(
                symbol="BTCUSDT",  # Missing /
                timestamp=datetime.utcnow(),
                ohlcv=ohlcv,
                source="binance"
            )
    
    def test_invalid_timeframe(self):
        ohlcv = OHLCV(
            open=Decimal('100'),
            high=Decimal('110'),
            low=Decimal('95'),
            close=Decimal('105'),
            volume=Decimal('1000')
        )
        
        with pytest.raises(ValidationError):
            MarketData(
                symbol="BTC/USDT",
                timestamp=datetime.utcnow(),
                ohlcv=ohlcv,
                timeframe="invalid",  # Invalid timeframe
                source="binance"
            )


class TestTechnicalIndicators:
    """Test TechnicalIndicators model"""
    
    def test_valid_indicators(self):
        indicators = TechnicalIndicators(
            symbol="BTC/USDT",
            timestamp=datetime.utcnow(),
            timeframe="4h",
            rsi=Decimal('65'),
            macd=Decimal('0.5'),
            macd_signal=Decimal('0.3'),
            macd_histogram=Decimal('0.2')
        )
        
        assert indicators.is_overbought is False
        assert indicators.is_oversold is False
        assert indicators.macd_bullish_crossover is True
    
    def test_invalid_rsi_range(self):
        with pytest.raises(ValidationError):
            TechnicalIndicators(
                symbol="BTC/USDT",
                timestamp=datetime.utcnow(),
                timeframe="4h",
                rsi=Decimal('150')  # RSI > 100
            )
    
    def test_oversold_condition(self):
        indicators = TechnicalIndicators(
            symbol="BTC/USDT",
            timestamp=datetime.utcnow(),
            timeframe="4h",
            rsi=Decimal('25')  # Oversold
        )
        assert indicators.is_oversold is True


class TestOrder:
    """Test Order model"""
    
    def test_valid_order(self):
        order = Order(
            symbol="BTC/USDT",
            order_type=OrderType.LIMIT,
            direction=TradeDirection.LONG,
            quantity=Decimal('0.1'),
            price=Decimal('50000')
        )
        
        assert order.status == OrderStatus.PENDING
        assert order.remaining_quantity == Decimal('0.1')
        assert order.is_filled is False
    
    def test_negative_quantity(self):
        with pytest.raises(ValidationError):
            Order(
                symbol="BTC/USDT",
                order_type=OrderType.LIMIT,
                direction=TradeDirection.LONG,
                quantity=Decimal('-0.1'),  # Negative quantity
                price=Decimal('50000')
            )


class TestPosition:
    """Test Position model"""
    
    def test_valid_long_position(self):
        position = Position(
            symbol="BTC/USDT",
            direction=TradeDirection.LONG,
            entry_price=Decimal('50000'),
            current_price=Decimal('52000'),
            quantity=Decimal('0.1'),
            stop_loss=Decimal('48000')
        )
        
        assert position.unrealized_pnl == Decimal('200')  # (52000 - 50000) * 0.1
        assert position.unrealized_pnl_percentage == Decimal('4')  # 4%
        assert position.is_profitable is True
    
    def test_valid_short_position(self):
        position = Position(
            symbol="BTC/USDT",
            direction=TradeDirection.SHORT,
            entry_price=Decimal('50000'),
            current_price=Decimal('48000'),
            quantity=Decimal('0.1'),
            stop_loss=Decimal('52000')
        )
        
        assert position.unrealized_pnl == Decimal('200')  # (50000 - 48000) * 0.1
        assert position.is_profitable is True
    
    def test_invalid_stop_loss_long(self):
        with pytest.raises(ValidationError):
            Position(
                symbol="BTC/USDT",
                direction=TradeDirection.LONG,
                entry_price=Decimal('50000'),
                current_price=Decimal('52000'),
                quantity=Decimal('0.1'),
                stop_loss=Decimal('55000')  # Stop loss above entry for long
            )
    
    def test_invalid_stop_loss_short(self):
        with pytest.raises(ValidationError):
            Position(
                symbol="BTC/USDT",
                direction=TradeDirection.SHORT,
                entry_price=Decimal('50000'),
                current_price=Decimal('48000'),
                quantity=Decimal('0.1'),
                stop_loss=Decimal('45000')  # Stop loss below entry for short
            )


class TestTrade:
    """Test Trade model"""
    
    def test_valid_profitable_trade(self):
        entry_time = datetime.utcnow()
        exit_time = entry_time + timedelta(hours=2)
        
        trade = Trade(
            position_id="pos-123",
            symbol="BTC/USDT",
            direction=TradeDirection.LONG,
            entry_price=Decimal('50000'),
            exit_price=Decimal('52000'),
            quantity=Decimal('0.1'),
            entry_time=entry_time,
            exit_time=exit_time,
            realized_pnl=Decimal('200'),
            exit_reason="take_profit"
        )
        
        assert trade.is_profitable is True
        assert trade.pnl_percentage == Decimal('4')
        assert trade.duration_minutes == 120
    
    def test_invalid_exit_before_entry(self):
        entry_time = datetime.utcnow()
        exit_time = entry_time - timedelta(hours=1)  # Exit before entry
        
        with pytest.raises(ValidationError):
            Trade(
                position_id="pos-123",
                symbol="BTC/USDT",
                direction=TradeDirection.LONG,
                entry_price=Decimal('50000'),
                exit_price=Decimal('52000'),
                quantity=Decimal('0.1'),
                entry_time=entry_time,
                exit_time=exit_time,
                realized_pnl=Decimal('200'),
                exit_reason="take_profit"
            )


class TestPortfolio:
    """Test Portfolio model"""
    
    def test_valid_portfolio(self):
        position = Position(
            symbol="BTC/USDT",
            direction=TradeDirection.LONG,
            entry_price=Decimal('50000'),
            current_price=Decimal('52000'),
            quantity=Decimal('0.1')
        )
        
        portfolio = Portfolio(
            total_value=Decimal('10000'),
            available_balance=Decimal('5000'),
            positions=[position],
            daily_pnl=Decimal('200'),
            total_pnl=Decimal('1000')
        )
        
        assert portfolio.total_unrealized_pnl == Decimal('200')
        assert portfolio.total_position_value == Decimal('5200')  # 52000 * 0.1
        assert portfolio.equity == Decimal('5200')  # 5000 + 200
        assert portfolio.open_positions_count == 1
    
    def test_negative_balance(self):
        with pytest.raises(ValidationError):
            Portfolio(
                total_value=Decimal('-1000'),  # Negative value
                available_balance=Decimal('5000')
            )


class TestTradingSignal:
    """Test TradingSignal model"""
    
    def test_valid_signal(self):
        signal = TradingSignal(
            symbol="BTC/USDT",
            direction=TradeDirection.LONG,
            confidence=Decimal('0.85'),
            strength=SignalStrength.STRONG,
            technical_score=Decimal('0.8'),
            sentiment_score=Decimal('0.9'),
            setup_type=SetupType.LONG_SUPPORT,
            entry_price=Decimal('50000'),
            stop_loss=Decimal('48000'),
            take_profit_levels=[Decimal('52000'), Decimal('54000')]
        )
        
        assert signal.is_strong_signal is True
        assert signal.is_expired is False
    
    def test_invalid_confidence_range(self):
        with pytest.raises(ValidationError):
            TradingSignal(
                symbol="BTC/USDT",
                direction=TradeDirection.LONG,
                confidence=Decimal('1.5'),  # > 1
                strength=SignalStrength.STRONG,
                technical_score=Decimal('0.8'),
                sentiment_score=Decimal('0.9'),
                setup_type=SetupType.LONG_SUPPORT
            )
    
    def test_expired_signal(self):
        past_time = datetime.utcnow() - timedelta(hours=1)
        
        signal = TradingSignal(
            symbol="BTC/USDT",
            direction=TradeDirection.LONG,
            confidence=Decimal('0.85'),
            strength=SignalStrength.STRONG,
            technical_score=Decimal('0.8'),
            sentiment_score=Decimal('0.9'),
            setup_type=SetupType.LONG_SUPPORT,
            expires_at=past_time
        )
        
        assert signal.is_expired is True