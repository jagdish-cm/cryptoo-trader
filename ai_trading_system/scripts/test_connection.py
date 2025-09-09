"""
Test script to verify all connections and configurations
"""

import asyncio
import sys
from pathlib import Path

# Add the project root to Python path
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from ai_trading_system.config.settings import load_config, validate_config
from ai_trading_system.services.data_storage import DatabaseConnection, RedisCache
from ai_trading_system.services.exchange_client import ExchangeClient
from ai_trading_system.services.llm_client import LLMClient, LLMRequest, PromptType
from ai_trading_system.utils.logging import get_logger


async def test_database_connection():
    """Test database connection"""
    logger = get_logger("test_db")
    
    try:
        config = load_config()
        if not config.database:
            logger.warning("Database not configured")
            return False
        
        db = DatabaseConnection(config.database)
        await db.connect()
        
        # Test query
        result = await db.execute_query("SELECT 1 as test")
        
        await db.disconnect()
        
        logger.info("Database connection successful", {"result": result})
        return True
        
    except Exception as e:
        logger.error("Database connection failed", {"error": str(e)})
        return False


async def test_redis_connection():
    """Test Redis connection"""
    logger = get_logger("test_redis")
    
    try:
        config = load_config()
        cache = RedisCache(config.redis)
        
        await cache.connect()
        
        # Test set/get
        await cache.set("test_key", "test_value", ttl=60)
        value = await cache.get("test_key")
        
        await cache.disconnect()
        
        if value == "test_value":
            logger.info("Redis connection successful")
            return True
        else:
            logger.error("Redis test failed", {"expected": "test_value", "got": value})
            return False
        
    except Exception as e:
        logger.error("Redis connection failed", {"error": str(e)})
        return False


async def test_exchange_connection():
    """Test exchange connection"""
    logger = get_logger("test_exchange")
    
    try:
        config = load_config()
        if not config.exchange:
            logger.warning("Exchange not configured")
            return False
        
        client = ExchangeClient(config.exchange)
        await client.connect()
        
        # Test API call
        ticker = await client.fetch_ticker("BTC/USDT")
        
        await client.disconnect()
        
        logger.info("Exchange connection successful", {
            "exchange": config.exchange.name,
            "sandbox": config.exchange.sandbox,
            "btc_price": ticker.get('last', 'N/A')
        })
        return True
        
    except Exception as e:
        logger.error("Exchange connection failed", {"error": str(e)})
        return False


async def test_llm_connection():
    """Test LLM connection"""
    logger = get_logger("test_llm")
    
    try:
        config = load_config()
        if not config.llm:
            logger.warning("LLM not configured")
            return False
        
        client = LLMClient(config.llm)
        
        # Test simple request
        request = LLMRequest(
            prompt_type=PromptType.SENTIMENT_ANALYSIS,
            symbol="BTC/USDT",
            context_data={
                'current_price': 50000,
                'price_change_24h': 2.5,
                'volume': 1000000,
                'news_headlines': ['Bitcoin shows strong momentum'],
                'social_posts': ['Bullish on BTC! 🚀']
            }
        )
        
        response = await client.analyze(request)
        
        logger.info("LLM connection successful", {
            "model": response.model_used,
            "confidence": response.confidence,
            "tokens_used": response.token_usage.get('total_tokens', 0)
        })
        return True
        
    except Exception as e:
        logger.error("LLM connection failed", {"error": str(e)})
        return False


async def run_all_tests():
    """Run all connection tests"""
    logger = get_logger("test_runner")
    
    print("🧪 Testing AI Trading System Connections...\n")
    
    # Load and validate configuration
    config = load_config()
    warnings = validate_config(config)
    
    if warnings:
        print("⚠️  Configuration Warnings:")
        for warning in warnings:
            print(f"   - {warning}")
        print()
    
    # Test results
    results = {}
    
    # Test database
    print("📊 Testing database connection...")
    results['database'] = await test_database_connection()
    
    # Test Redis
    print("🔄 Testing Redis connection...")
    results['redis'] = await test_redis_connection()
    
    # Test exchange
    print("💱 Testing exchange connection...")
    results['exchange'] = await test_exchange_connection()
    
    # Test LLM
    print("🤖 Testing LLM connection...")
    results['llm'] = await test_llm_connection()
    
    # Summary
    print("\n" + "="*50)
    print("📋 CONNECTION TEST RESULTS")
    print("="*50)
    
    all_passed = True
    for service, passed in results.items():
        status = "✅ PASS" if passed else "❌ FAIL"
        print(f"{service.upper():12} {status}")
        if not passed:
            all_passed = False
    
    print("="*50)
    
    if all_passed:
        print("🎉 All connections successful! System is ready to run.")
        print("\nTo start the system:")
        print("python -m ai_trading_system.main")
    else:
        print("⚠️  Some connections failed. Please check your configuration.")
        print("\nTroubleshooting:")
        if not results.get('database'):
            print("- Database: Check PostgreSQL is running and credentials are correct")
        if not results.get('redis'):
            print("- Redis: Check Redis server is running (brew services start redis)")
        if not results.get('exchange'):
            print("- Exchange: Check Binance testnet API keys are valid")
        if not results.get('llm'):
            print("- LLM: Check OpenAI API key is valid and has credits")
    
    return all_passed


def main():
    """Main entry point"""
    success = asyncio.run(run_all_tests())
    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()