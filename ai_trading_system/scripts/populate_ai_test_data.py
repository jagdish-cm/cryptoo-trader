#!/usr/bin/env python3
"""
Script to populate the database with sample AI decision and sentiment analysis data
This will help test the real data integration in the dashboard
"""

import asyncio
import json
import sys
import os
from datetime import datetime, timedelta
from decimal import Decimal
import random

# Add parent directory to path
sys.path.append(os.path.join(os.path.dirname(__file__), '../..'))

from ai_trading_system.config.settings import load_config
from ai_trading_system.services.data_storage import DatabaseConnection
from ai_trading_system.utils.logging import get_logger

logger = get_logger("populate_test_data")

async def populate_ai_decisions(db: DatabaseConnection, count: int = 20):
    """Populate AI decisions table with sample data"""
    
    symbols = ["BTC/USDT", "ETH/USDT"]
    decision_types = ["SIGNAL_GENERATION", "POSITION_SIZING", "RISK_ASSESSMENT", "MARKET_ANALYSIS"]
    outcomes = ["SUCCESS", "FAILURE", "PENDING"]
    
    for i in range(count):
        # Generate realistic timestamps (last 24 hours)
        timestamp = datetime.utcnow() - timedelta(hours=random.randint(0, 24))
        
        symbol = random.choice(symbols)
        decision_type = random.choice(decision_types)
        
        # Generate realistic confidence scores
        confidence = round(random.uniform(0.6, 0.95), 3)
        technical_score = round(random.uniform(0.5, 0.9), 3)
        sentiment_score = round(random.uniform(0.4, 0.95), 3)
        event_impact = round(random.uniform(0.1, 0.8), 3)
        final_confidence = round((technical_score + sentiment_score + event_impact) / 3, 3)
        
        # Generate risk factors
        risk_factors = random.sample([
            "High volatility", "Low liquidity", "News uncertainty", 
            "Market correlation", "Technical divergence", "Volume anomaly"
        ], random.randint(1, 3))
        
        # Generate factors
        factors = [
            {
                "type": "RSI",
                "value": round(random.uniform(0.2, 0.8), 2),
                "weight": 0.3,
                "description": "RSI indicator analysis"
            },
            {
                "type": "MACD",
                "value": round(random.uniform(0.1, 0.9), 2),
                "weight": 0.25,
                "description": "MACD signal analysis"
            },
            {
                "type": "Sentiment",
                "value": sentiment_score,
                "weight": 0.45,
                "description": "Market sentiment analysis"
            }
        ]
        
        # Generate outcome
        outcome_result = random.choice(outcomes)
        if outcome_result == "SUCCESS":
            outcome = {
                "action": f"GENERATE_{random.choice(['LONG', 'SHORT'])}_SIGNAL",
                "result": "SUCCESS",
                "details": "Signal generated successfully with high confidence"
            }
        elif outcome_result == "FAILURE":
            outcome = {
                "action": "NO_ACTION",
                "result": "FAILURE", 
                "details": "Insufficient confidence for signal generation"
            }
        else:
            outcome = {
                "action": "ANALYZING",
                "result": "PENDING",
                "details": "Analysis in progress"
            }
        
        # Insert into database
        query = """
        INSERT INTO ai_decisions (
            timestamp, decision_type, symbol, confidence, 
            technical_score, sentiment_score, event_impact, 
            final_confidence, risk_factors, reasoning, factors, outcome
        ) VALUES (
            :timestamp, :decision_type, :symbol, :confidence, 
            :technical_score, :sentiment_score, :event_impact, 
            :final_confidence, :risk_factors, :reasoning, :factors, :outcome
        )
        """
        
        await db.execute_non_query(query, {
            'timestamp': timestamp,
            'decision_type': decision_type,
            'symbol': symbol,
            'confidence': confidence,
            'technical_score': technical_score,
            'sentiment_score': sentiment_score,
            'event_impact': event_impact,
            'final_confidence': final_confidence,
            'risk_factors': json.dumps(risk_factors),
            'reasoning': json.dumps({"summary": f"Analysis for {symbol}"}),
            'factors': json.dumps(factors),
            'outcome': json.dumps(outcome)
        })
    
    logger.info(f"Inserted {count} AI decisions into database")

async def populate_sentiment_analysis(db: DatabaseConnection, count: int = 10):
    """Populate sentiment analysis table with sample data"""
    
    symbols = ["BTC/USDT", "ETH/USDT"]
    sentiments = ["POSITIVE", "NEGATIVE", "NEUTRAL"]
    
    for symbol in symbols:
        for i in range(count // len(symbols)):
            timestamp = datetime.utcnow() - timedelta(hours=random.randint(0, 12))
            
            sentiment = random.choice(sentiments)
            confidence = round(random.uniform(0.6, 0.95), 3)
            
            # Generate key factors based on sentiment
            if sentiment == "POSITIVE":
                key_factors = random.sample([
                    "Institutional adoption", "Positive regulatory news", 
                    "Technical breakout", "Strong fundamentals", "Market momentum"
                ], random.randint(2, 4))
                news_impact = round(random.uniform(0.7, 0.95), 3)
                social_impact = round(random.uniform(0.6, 0.9), 3)
            elif sentiment == "NEGATIVE":
                key_factors = random.sample([
                    "Regulatory concerns", "Market correction", 
                    "Technical breakdown", "Negative news", "Risk aversion"
                ], random.randint(2, 4))
                news_impact = round(random.uniform(0.3, 0.7), 3)
                social_impact = round(random.uniform(0.2, 0.6), 3)
            else:  # NEUTRAL
                key_factors = random.sample([
                    "Mixed signals", "Consolidation", "Moderate volume",
                    "Sideways trend", "Uncertainty"
                ], random.randint(1, 3))
                news_impact = round(random.uniform(0.4, 0.6), 3)
                social_impact = round(random.uniform(0.4, 0.6), 3)
            
            processing_time_ms = random.randint(500, 2000)
            
            # Insert into database
            query = """
            INSERT INTO sentiment_analysis (
                symbol, sentiment, confidence, key_factors, 
                news_impact, social_impact, processing_time_ms, source, timestamp
            ) VALUES (
                :symbol, :sentiment, :confidence, :key_factors, 
                :news_impact, :social_impact, :processing_time_ms, :source, :timestamp
            )
            """
            
            await db.execute_non_query(query, {
                'symbol': symbol,
                'sentiment': sentiment,
                'confidence': confidence,
                'key_factors': json.dumps(key_factors),
                'news_impact': news_impact,
                'social_impact': social_impact,
                'processing_time_ms': processing_time_ms,
                'source': 'test_data',
                'timestamp': timestamp
            })
    
    logger.info(f"Inserted sentiment analysis data for {len(symbols)} symbols")

async def main():
    """Main function to populate test data"""
    try:
        # Load configuration and connect to database
        config = load_config()
        db = DatabaseConnection(config.database)
        await db.connect()
        
        logger.info("Starting to populate AI test data...")
        
        # Populate AI decisions
        await populate_ai_decisions(db, count=25)
        
        # Populate sentiment analysis
        await populate_sentiment_analysis(db, count=15)
        
        # Verify data was inserted
        ai_count = await db.execute_query("SELECT COUNT(*) as count FROM ai_decisions")
        sentiment_count = await db.execute_query("SELECT COUNT(*) as count FROM sentiment_analysis")
        
        logger.info(f"✅ Database populated successfully!")
        logger.info(f"   AI Decisions: {ai_count[0]['count']}")
        logger.info(f"   Sentiment Analysis: {sentiment_count[0]['count']}")
        
        await db.disconnect()
        
    except Exception as e:
        logger.error(f"Error populating test data: {e}")
        raise

if __name__ == "__main__":
    asyncio.run(main())