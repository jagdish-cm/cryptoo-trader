#!/usr/bin/env python3
"""
Cleanup script to remove old cryptocurrency data and keep only BTC/USDT and ETH/USDT
"""

import asyncio
import sys
from pathlib import Path

# Add the project root to Python path
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

from ai_trading_system.config.settings import load_config
from ai_trading_system.services.data_storage import DatabaseConnection
from ai_trading_system.utils.logging import get_logger

logger = get_logger("cleanup_old_symbols")

async def cleanup_old_symbols():
    """Remove all data for symbols other than BTC/USDT and ETH/USDT"""
    
    config = load_config()
    
    # Check if database config exists
    if not config.database:
        logger.error("No database configuration found. Please set up database config.")
        return
    
    db = DatabaseConnection(config.database)
    
    try:
        await db.connect()
        logger.info("Connected to database successfully")
        
        # Define allowed symbols
        allowed_symbols = ["BTC/USDT", "ETH/USDT"]
        allowed_symbols_str = "', '".join(allowed_symbols)
        
        # Clean up ai_decisions table
        logger.info("Cleaning up ai_decisions table...")
        ai_delete_query = f"""
        DELETE FROM ai_decisions 
        WHERE symbol NOT IN ('{allowed_symbols_str}')
        """
        
        result = await db.execute_query(ai_delete_query)
        logger.info(f"Deleted old AI decisions for non-BTC/ETH symbols")
        
        # Clean up sentiment_analysis table
        logger.info("Cleaning up sentiment_analysis table...")
        sentiment_delete_query = f"""
        DELETE FROM sentiment_analysis 
        WHERE symbol NOT IN ('{allowed_symbols_str}')
        """
        
        result = await db.execute_query(sentiment_delete_query)
        logger.info(f"Deleted old sentiment analysis for non-BTC/ETH symbols")
        
        # Clean up market_data_cache table
        logger.info("Cleaning up market_data_cache table...")
        market_delete_query = f"""
        DELETE FROM market_data_cache 
        WHERE symbol NOT IN ('{allowed_symbols_str}')
        """
        
        result = await db.execute_query(market_delete_query)
        logger.info(f"Deleted old market data cache for non-BTC/ETH symbols")
        
        # Verify cleanup
        ai_count = await db.execute_query("SELECT COUNT(*) as count FROM ai_decisions")
        sentiment_count = await db.execute_query("SELECT COUNT(*) as count FROM sentiment_analysis")
        market_count = await db.execute_query("SELECT COUNT(*) as count FROM market_data_cache")
        
        logger.info("✅ Cleanup completed successfully!")
        logger.info(f"Remaining records:")
        logger.info(f"  - AI decisions: {ai_count[0]['count'] if ai_count else 0}")
        logger.info(f"  - Sentiment analysis: {sentiment_count[0]['count'] if sentiment_count else 0}")
        logger.info(f"  - Market data cache: {market_count[0]['count'] if market_count else 0}")
        
        # Show remaining symbols
        symbols_query = """
        SELECT DISTINCT symbol FROM (
            SELECT symbol FROM ai_decisions
            UNION
            SELECT symbol FROM sentiment_analysis
            UNION
            SELECT symbol FROM market_data_cache
        ) AS all_symbols
        ORDER BY symbol
        """
        
        remaining_symbols = await db.execute_query(symbols_query)
        if remaining_symbols:
            symbols_list = [row['symbol'] for row in remaining_symbols]
            logger.info(f"Remaining symbols in database: {symbols_list}")
        else:
            logger.info("No symbols found in database")
        
    except Exception as e:
        logger.error(f"Error during cleanup: {e}")
        raise
    finally:
        await db.disconnect()

if __name__ == "__main__":
    asyncio.run(cleanup_old_symbols())