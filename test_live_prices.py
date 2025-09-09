#!/usr/bin/env python3
"""
Test script to verify live market data is working correctly
"""

import asyncio
import sys
import os

# Add the project root to the path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from ai_trading_system.services.live_market_data import get_current_prices, LiveMarketDataService


async def test_live_prices():
    """Test live price fetching"""
    print("🔍 Testing Live Market Data Service...")
    print("=" * 50)
    
    # Test symbols
    symbols = ["BTC/USDT", "ETH/USDT"]
    
    try:
        # Test using the convenience function
        print("📊 Fetching live prices using convenience function...")
        prices = await get_current_prices(symbols)
        
        if prices:
            print("✅ Successfully fetched live prices:")
            for symbol, data in prices.items():
                price = data.get('price', 0)
                change = data.get('change24h', 0)
                volume = data.get('volume24h', 0)
                
                change_symbol = "📈" if change >= 0 else "📉"
                print(f"  {symbol}: ${price:,.2f} {change_symbol} {change:+.2f}% (Vol: ${volume:,.0f})")
        else:
            print("❌ No live prices received")
        
        print("\n" + "=" * 50)
        
        # Test using the service directly
        print("🔧 Testing LiveMarketDataService directly...")
        
        async with LiveMarketDataService() as service:
            # Test single price
            btc_price = await service.get_price("BTC/USDT")
            if btc_price:
                print(f"✅ BTC/USDT single price: ${btc_price:,.2f}")
            else:
                print("❌ Failed to get BTC price")
            
            # Test market data format
            btc_market_data = await service.get_market_data("BTC/USDT")
            if btc_market_data:
                print(f"✅ BTC MarketData object created successfully")
                print(f"   Symbol: {btc_market_data.symbol}")
                print(f"   Price: ${btc_market_data.ohlcv.close}")
                print(f"   Source: {btc_market_data.source}")
                print(f"   Timestamp: {btc_market_data.timestamp}")
            else:
                print("❌ Failed to create MarketData object")
        
        print("\n" + "=" * 50)
        print("✅ Live market data test completed successfully!")
        
    except Exception as e:
        print(f"❌ Error during testing: {e}")
        import traceback
        traceback.print_exc()


async def test_data_storage_integration():
    """Test integration with data storage service"""
    print("\n🔗 Testing Data Storage Integration...")
    print("=" * 50)
    
    try:
        from ai_trading_system.config.settings import load_config
        from ai_trading_system.services.data_storage import DataAccessObject, RedisCache
        
        # Load config
        config = load_config()
        
        # Initialize cache only (database might not be available)
        cache = RedisCache(config.redis)
        
        try:
            await cache.connect()
            print("✅ Connected to Redis cache")
            
            # Create DAO with cache only
            dao = DataAccessObject(None, cache)
            
            # Test getting latest price (should use live data as fallback)
            btc_price = await dao.get_latest_price("BTC/USDT")
            if btc_price:
                print(f"✅ DAO returned BTC price: ${btc_price}")
            else:
                print("❌ DAO failed to get BTC price")
            
            await cache.disconnect()
            print("✅ Data storage integration test completed")
            
        except Exception as e:
            print(f"⚠️  Redis not available, skipping cache test: {e}")
            
    except Exception as e:
        print(f"❌ Error testing data storage integration: {e}")


async def main():
    """Main test function"""
    print("🚀 Starting Live Market Data Tests")
    print("=" * 60)
    
    await test_live_prices()
    await test_data_storage_integration()
    
    print("\n" + "=" * 60)
    print("🎉 All tests completed!")


if __name__ == "__main__":
    asyncio.run(main())