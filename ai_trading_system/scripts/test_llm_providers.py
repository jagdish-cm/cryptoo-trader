#!/usr/bin/env python3
"""
Test script for LLM providers (OpenAI and Ollama)
"""

import asyncio
import sys
import os
from pathlib import Path

# Add the project root to the Python path
project_root = Path(__file__).parent.parent.parent
sys.path.insert(0, str(project_root))

from ai_trading_system.config.settings import load_config
from ai_trading_system.services.llm_client import LLMClient, LLMRequest, PromptType
from ai_trading_system.utils.logging import get_logger


async def test_openai_provider():
    """Test OpenAI provider"""
    print("\n=== Testing OpenAI Provider ===")
    
    # Load config and force OpenAI provider
    config = load_config()
    if not config.llm:
        print("❌ No LLM configuration found")
        return False
    
    # Override provider to test OpenAI specifically
    config.llm.provider = "openai"
    
    if not config.llm.api_key:
        print("❌ OpenAI API key not configured - skipping OpenAI test")
        return False
    
    try:
        client = LLMClient(config.llm)
        
        try:
            # Health check
            print("🔍 Performing health check...")
            health_ok = await client.health_check()
            if not health_ok:
                print("❌ OpenAI health check failed")
                return False
            print("✅ OpenAI health check passed")
            
            # Test sentiment analysis
            print("🔍 Testing sentiment analysis...")
            request = LLMRequest(
                prompt_type=PromptType.SENTIMENT_ANALYSIS,
                symbol="BTC",
                context_data={
                    "news_headlines": ["Bitcoin reaches new all-time high", "Institutional adoption continues"],
                    "social_posts": ["BTC to the moon! 🚀", "Bullish on Bitcoin long term"],
                    "current_price": 50000,
                    "price_change_24h": 5.2,
                    "volume": 1000000
                }
            )
            
            response = await client.analyze(request)
            print(f"✅ OpenAI sentiment analysis completed")
            print(f"   Confidence: {response.confidence}")
            print(f"   Model: {response.model_used}")
            print(f"   Tokens used: {response.token_usage.get('total_tokens', 0)}")
            
            return True
            
        finally:
            # Clean up Ollama client session if it exists
            if hasattr(client, 'ollama_client') and client.ollama_client:
                await client.ollama_client.close()
        
    except Exception as e:
        print(f"❌ OpenAI test failed: {e}")
        return False


async def test_ollama_provider():
    """Test Ollama provider"""
    print("\n=== Testing Ollama Provider ===")
    
    # Load config and force Ollama provider
    config = load_config()
    if not config.llm:
        print("❌ No LLM configuration found")
        return False
    
    # Override provider to test Ollama specifically
    config.llm.provider = "ollama"
    
    try:
        client = LLMClient(config.llm)
        
        try:
            # Health check
            print("🔍 Performing health check...")
            health_ok = await client.health_check()
            if not health_ok:
                print("❌ Ollama health check failed")
                print("   Make sure Ollama is running: ollama serve")
                print(f"   And the model '{config.llm.ollama_model}' is available: ollama pull {config.llm.ollama_model}")
                return False
            print("✅ Ollama health check passed")
            
            # Test sentiment analysis
            print("🔍 Testing sentiment analysis...")
            request = LLMRequest(
                prompt_type=PromptType.SENTIMENT_ANALYSIS,
                symbol="BTC",
                context_data={
                    "news_headlines": ["Bitcoin reaches new all-time high", "Institutional adoption continues"],
                    "social_posts": ["BTC to the moon! 🚀", "Bullish on Bitcoin long term"],
                    "current_price": 50000,
                    "price_change_24h": 5.2,
                    "volume": 1000000
                }
            )
            
            response = await client.analyze(request)
            print(f"✅ Ollama sentiment analysis completed")
            print(f"   Confidence: {response.confidence}")
            print(f"   Model: {response.model_used}")
            print(f"   Processing time: {response.processing_time:.2f}s")
            
            return True
            
        finally:
            # Clean up Ollama client session
            if hasattr(client, 'ollama_client') and client.ollama_client:
                await client.ollama_client.close()
        
    except Exception as e:
        print(f"❌ Ollama test failed: {e}")
        return False


async def test_auto_provider():
    """Test auto provider detection"""
    print("\n=== Testing Auto Provider Detection ===")
    
    config = load_config()
    if not config.llm:
        print("❌ No LLM configuration found")
        return False
    
    # Use auto detection
    config.llm.provider = "auto"
    
    try:
        client = LLMClient(config.llm)
        print(f"✅ Auto-detected provider: {client.provider}")
        
        # Health check
        health_ok = await client.health_check()
        if health_ok:
            print(f"✅ {client.provider.upper()} provider is working")
        else:
            print(f"❌ {client.provider.upper()} provider health check failed")
        
        return health_ok
        
    except Exception as e:
        print(f"❌ Auto provider test failed: {e}")
        return False


async def main():
    """Main test function"""
    print("🚀 LLM Provider Test Suite")
    print("=" * 50)
    
    # Test results
    results = {}
    
    # Test auto provider detection first
    results['auto'] = await test_auto_provider()
    
    # Test OpenAI if configured
    results['openai'] = await test_openai_provider()
    
    # Test Ollama
    results['ollama'] = await test_ollama_provider()
    
    # Summary
    print("\n" + "=" * 50)
    print("📊 Test Results Summary")
    print("=" * 50)
    
    for provider, success in results.items():
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{provider.upper():10} {status}")
    
    # Overall result
    any_passed = any(results.values())
    if any_passed:
        print("\n🎉 At least one LLM provider is working!")
        return 0
    else:
        print("\n💥 No LLM providers are working!")
        print("\nTroubleshooting:")
        print("1. For OpenAI: Set LLM_API_KEY in your .env file")
        print("2. For Ollama: Run 'ollama serve' and 'ollama pull llama3.2'")
        return 1


if __name__ == "__main__":
    exit_code = asyncio.run(main())
    sys.exit(exit_code)