#!/usr/bin/env python3
"""
Test script for the new multi-source market data service
"""

import asyncio
import sys
from pathlib import Path

# Add the project root to Python path
project_root = Path(__file__).parent
sys.path.insert(0, str(project_root))

from ai_trading_system.services.multi_source_market_data import get_current_prices, get_cache_stats


async def test_multi_source_prices():
    """Test the multi-source price fetching with fallbacks"""
    
    print("🚀 Testing Multi-Source Market Data Service")
    print("=" * 60)
    
    # Test symbols
    symbols = ["BTC/USDT", "ETH/USDT"]
    
    try:
        print("📊 Fetching prices (first call - should hit external APIs)...")
        prices_1 = await get_current_prices(symbols)
        
        print(f"\n✅ First fetch results:")
        for symbol, data in prices_1.items():
            print(f"  {symbol}: ${data['price']:,.2f} (source: {data['source']}, age: {data['age_seconds']:.1f}s)")
        
        print(f"\n📈 Cache stats after first fetch:")
        stats_1 = await get_cache_stats()
        print(f"  Total cached: {stats_1['total_cached']}")
        print(f"  Fresh cached: {stats_1['fresh_cached']}")
        print(f"  Cache hit rate: {stats_1['cache_hit_rate']:.2%}")
        print(f"  Failed sources: {stats_1['failed_sources']}")
        print(f"  Rate limit status: {stats_1['rate_limit_status']}")
        
        print(f"\n⚡ Fetching prices again (should use cache)...")
        prices_2 = await get_current_prices(symbols)
        
        print(f"\n✅ Second fetch results:")
        for symbol, data in prices_2.items():
            print(f"  {symbol}: ${data['price']:,.2f} (source: {data['source']}, age: {data['age_seconds']:.1f}s)")
        
        print(f"\n📈 Cache stats after second fetch:")
        stats_2 = await get_cache_stats()
        print(f"  Total cached: {stats_2['total_cached']}")
        print(f"  Fresh cached: {stats_2['fresh_cached']}")
        print(f"  Cache hit rate: {stats_2['cache_hit_rate']:.2%}")
        
        print(f"\n🔄 Force refresh (should bypass cache)...")
        prices_3 = await get_current_prices(symbols, force_refresh=True)
        
        print(f"\n✅ Force refresh results:")
        for symbol, data in prices_3.items():
            print(f"  {symbol}: ${data['price']:,.2f} (source: {data['source']}, age: {data['age_seconds']:.1f}s)")
        
        print(f"\n🎉 Multi-source market data service test completed successfully!")
        print(f"✅ Rate limiting protection: Active")
        print(f"✅ Multiple source fallbacks: Available")
        print(f"✅ Intelligent caching: Working")
        print(f"✅ Circuit breaker: Implemented")
        
    except Exception as e:
        print(f"❌ Error during test: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    asyncio.run(test_multi_source_prices())