#!/usr/bin/env python3
"""
Startup script for the Trading Dashboard API
This script starts the FastAPI server with proper initialization
"""

import asyncio
import sys
import os
import uvicorn
from pathlib import Path

# Add the parent directory to the path to import AI trading system
parent_dir = Path(__file__).parent.parent
sys.path.append(str(parent_dir))

from ai_trading_system.utils.logging import get_logger

logger = get_logger("api_startup")


async def test_live_data():
    """Test live market data before starting the server"""
    try:
        from ai_trading_system.services.live_market_data import get_current_prices
        
        logger.info("Testing live market data connection...")
        test_symbols = ["BTC/USDT", "ETH/USDT"]
        
        prices = await get_current_prices(test_symbols)
        
        if prices:
            logger.info("✅ Live market data is working!")
            for symbol, data in prices.items():
                price = data.get('price', 0)
                logger.info(f"  {symbol}: ${price:,.2f}")
        else:
            logger.warning("⚠️  No live market data received, will use fallback")
            
    except Exception as e:
        logger.warning(f"⚠️  Live market data test failed: {e}")
        logger.info("API will still start with fallback data")


def main():
    """Main startup function"""
    print("🚀 Starting Trading Dashboard API")
    print("=" * 50)
    
    # Test live data connection
    try:
        asyncio.run(test_live_data())
    except Exception as e:
        logger.error(f"Error testing live data: {e}")
    
    print("=" * 50)
    print("🌐 Starting FastAPI server...")
    print("📊 Dashboard will be available at: http://localhost:3000")
    print("🔗 API will be available at: http://localhost:8000")
    print("📖 API docs will be available at: http://localhost:8000/docs")
    print("=" * 50)
    
    # Start the FastAPI server
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info",
        access_log=True
    )


if __name__ == "__main__":
    main()