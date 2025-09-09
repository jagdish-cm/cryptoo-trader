#!/usr/bin/env python3
"""
Seed initial market data for the AI Trading System
"""

import asyncio
import sys
from pathlib import Path
from datetime import datetime, timedelta
from decimal import Decimal

# Add the project root to the Python path
project_root = Path(__file__).parent.parent.parent
sys.path.insert(0, str(project_root))

from ai_trading_system.config.settings import load_config
from ai_trading_system.services.data_storage import DatabaseConnection, RedisCache, DataAccessObject
from ai_trading_system.services.exchange_client import ExchangeClient
from ai_trading_system.models.market_data import MarketData, OHLCV
from ai_trading_system.utils.logging import get_logger


async def fetch_and_store_historical_data():
    """Fetch historical data from exchange and store it"""
    logger = get_logger("seed_data")
    
    try:
        # Load configuration
        config = load_config()
        
        if not config.exchange or not config.database:
            logger.error("Exchange and database configuration required")
            return False
        
        logger.info("Starting data seeding process")
        
        # Initialize components
        db = DatabaseConnection(config.database)
        await db.connect()
        
        cache = RedisCache(config.redis)
        await cache.connect()
        
        dao = DataAccessObject(db, cache)
        
        exchange_client = ExchangeClient(config.exchange)
        await exchange_client.connect()
        
        # Symbols to fetch data for
        symbols = config.trading.watchlist
        timeframes = ["1h", "4h", "1d"]  # Different timeframes
        
        logger.info("Fetching historical data", {
            "symbols": symbols,
            "timeframes": timeframes
        })
        
        total_records = 0
        
        for symbol in symbols:
            for timeframe in timeframes:
                try:
                    logger.info("Fetching data", {
                        "symbol": symbol,
                        "timeframe": timeframe
                    })
                    
                    # Fetch enough data for analysis
                    if timeframe == "1d":
                        limit = 250  # Extra buffer for 200-day SMA
                    else:
                        limit = 100
                    
                    ohlcv_data = await exchange_client.fetch_ohlcv(
                        symbol=symbol,
                        timeframe=timeframe,
                        limit=limit
                    )
                    
                    if not ohlcv_data:
                        logger.warning("No data received", {
                            "symbol": symbol,
                            "timeframe": timeframe
                        })
                        continue
                    
                    # Store each candle
                    stored_count = 0
                    for candle in ohlcv_data:
                        timestamp = datetime.fromtimestamp(candle[0] / 1000)
                        
                        market_data = MarketData(
                            symbol=symbol,
                            timestamp=timestamp,
                            timeframe=timeframe,
                            ohlcv=OHLCV(
                                open=Decimal(str(candle[1])),
                                high=Decimal(str(candle[2])),
                                low=Decimal(str(candle[3])),
                                close=Decimal(str(candle[4])),
                                volume=Decimal(str(candle[5]))
                            ),
                            source="binance"
                        )
                        
                        success = await dao.store_market_data(market_data)
                        if success:
                            stored_count += 1
                    
                    total_records += stored_count
                    logger.info("Data stored", {
                        "symbol": symbol,
                        "timeframe": timeframe,
                        "records": stored_count
                    })
                    
                    # Small delay to respect rate limits
                    await asyncio.sleep(0.1)
                    
                except Exception as e:
                    logger.error("Failed to fetch data", {
                        "symbol": symbol,
                        "timeframe": timeframe,
                        "error": str(e)
                    })
                    continue
        
        # Cleanup
        await exchange_client.disconnect()
        await cache.disconnect()
        await db.disconnect()
        
        logger.info("Data seeding completed", {
            "total_records": total_records
        })
        
        return total_records > 0
        
    except Exception as e:
        logger.error("Data seeding failed", {"error": str(e)})
        return False


async def main():
    """Main entry point"""
    print("🌱 Seeding AI Trading System with historical data...")
    
    success = await fetch_and_store_historical_data()
    
    if success:
        print("✅ Data seeding completed successfully!")
        print("\nNext steps:")
        print("1. Run the system: python -m ai_trading_system.main")
        print("2. The system should now have enough data for Bitcoin regime analysis")
    else:
        print("❌ Data seeding failed. Check the logs above.")
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())